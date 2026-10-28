import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import type { AuthSessionState } from '@/lib/auth/session-snapshot';
import { isFreshServerSession } from '@/lib/auth/session-snapshot';
import {
  HISTORY_PAGE_SIZE,
  HISTORY_POST_CAPTURE_STATUSES,
  historyOrderSelect,
  historyReceiptUrl,
  toHistoryOrder,
  type HistoryLedgerRow,
  type HistoryFulfillment,
} from './model';

export class AccountHistoryAccessError extends Error {}
export class InvalidHistoryQueryError extends Error {}

const querySchema = z.object({
  filter: z.enum(['all', 'refunds']).default('all'),
  cursor: z
    .string()
    .max(256)
    .regex(/^[A-Za-z0-9_-]+$/u)
    .optional(),
});
const cursorSchema = z.object({
  date: z.iso.datetime(),
  id: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/u),
});

function parseHistoryQuery(input: { filter?: unknown; cursor?: unknown }) {
  try {
    const query = querySchema.parse(input);
    const cursor = query.cursor
      ? cursorSchema.parse(JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')))
      : null;
    return { filter: query.filter, cursor };
  } catch {
    throw new InvalidHistoryQueryError('This order-history link is invalid.');
  }
}

function cursorFor(row: HistoryLedgerRow) {
  return Buffer.from(JSON.stringify({ date: row.createdAt.toISOString(), id: row.id })).toString(
    'base64url',
  );
}

// Include reported post-capture records even when damaged evidence requires review.
function purchaseWhere(): Prisma.PaypalIntentWhereInput {
  return {
    OR: [
      { status: { in: HISTORY_POST_CAPTURE_STATUSES } },
      ...[
        ['status'],
        ['purchaseUnits', '0', 'payments', 'captures', '0', 'status'],
        ['purchase_units', '0', 'payments', 'captures', '0', 'status'],
      ].map((path) => ({ capturePayload: { path, equals: 'COMPLETED' } })),
    ],
  };
}

type ListQuery = {
  where: Prisma.PaypalIntentWhereInput;
  select: typeof historyOrderSelect;
  take: number;
  orderBy: Prisma.PaypalIntentOrderByWithRelationInput[];
};
type DetailQuery = Pick<ListQuery, 'where' | 'select'>;
type Dependencies = {
  session: () => Promise<AuthSessionState>;
  list: (query: ListQuery) => Promise<HistoryLedgerRow[]>;
  detail: (query: DetailQuery) => Promise<HistoryLedgerRow | null>;
  fulfillment: (tokens: string[]) => Promise<HistoryFulfillment[]>;
};

export function createAccountOrderReader(deps: Dependencies) {
  async function owner() {
    const session = await deps.session();
    if (!isFreshServerSession(session))
      throw new AccountHistoryAccessError('Sign in to view your orders.');
    return session;
  }
  async function shipmentUpdates(tokens: string[]) {
    try {
      const updates = await deps.fulfillment(tokens);
      return {
        updates: updates.filter((update) => tokens.includes(update.orderToken)),
        unavailable: false,
      };
    } catch {
      return { updates: [] as HistoryFulfillment[], unavailable: true };
    }
  }
  async function ownedOrder(orderToken: string) {
    const session = await owner();
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(orderToken)) return { session, row: null };
    const row = await deps.detail({
      where: { userId: session.user_id, orderToken, AND: [purchaseWhere()] },
      select: historyOrderSelect,
    });
    return {
      session,
      row: row?.userId === session.user_id && row.orderToken === orderToken ? row : null,
    };
  }
  return {
    async list(input: { filter?: unknown; cursor?: unknown } = {}) {
      const session = await owner();
      const { filter, cursor } = parseHistoryQuery(input);
      const conditions: Prisma.PaypalIntentWhereInput[] = [purchaseWhere()];
      if (filter === 'refunds') conditions.push({ status: 'refunded' });
      if (cursor)
        conditions.push({
          OR: [
            { createdAt: { lt: new Date(cursor.date) } },
            { createdAt: new Date(cursor.date), id: { lt: cursor.id } },
          ],
        });
      const rows = await deps.list({
        where: { userId: session.user_id, AND: conditions },
        select: historyOrderSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: HISTORY_PAGE_SIZE + 1,
      });
      const page = rows.slice(0, HISTORY_PAGE_SIZE);
      if (rows.some((row) => row.userId !== session.user_id))
        throw new AccountHistoryAccessError('Order ownership could not be verified.');
      return {
        session,
        filter,
        orders: page.map(toHistoryOrder),
        nextCursor: rows.length > HISTORY_PAGE_SIZE ? cursorFor(page[page.length - 1]) : null,
      };
    },
    async detail(orderToken: string) {
      const { session, row } = await ownedOrder(orderToken);
      if (!row) return null;
      return {
        session,
        order: toHistoryOrder(row),
        ...(await shipmentUpdates([row.orderToken])),
      };
    },
    async receipt(orderToken: string) {
      const { row } = await ownedOrder(orderToken);
      return row ? historyReceiptUrl(row.receiptLink) : null;
    },
  };
}
