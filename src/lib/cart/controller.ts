import { deepEqual } from 'fast-equals';
import {
  createCartDocument,
  consumeCartPurchase,
  editCart,
  projectCart,
  reconcileCart,
  resolveCartConflict,
  settleCartWrite,
} from './model';
import { CartRepository, cartId } from './repository';
import { cartTransport, CartTransportError } from './transport';
import type {
  CartCheckoutSnapshot,
  CartCommand,
  CartDocument,
  CartFlight,
  CartOwner,
  CartPurchaseLine,
  CartVariant,
} from './types';

export type CartConflict = {
  variantId: string;
  title: string;
  localQuantity: number;
  remoteQuantity: number;
  uncertain?: boolean;
  message?: string;
  line?: CartVariant;
};
export type CartView = {
  variants: CartVariant[];
  owner: CartOwner | null;
  hydrated: boolean;
  storageError: string | null;
  syncError: string | null;
  syncStatus: 'idle' | 'syncing' | 'offline' | 'conflict' | 'uncertain' | 'error' | 'synced';
  conflicts: CartConflict[];
};
export const initialCartView: CartView = {
  variants: [],
  owner: null,
  hydrated: false,
  storageError: null,
  syncError: null,
  syncStatus: 'idle',
  conflicts: [],
};
const quantityOf = (document: CartDocument, variantId: string) =>
  document.baseline.find((line) => line.variantId === variantId)?.quantity ?? 0;
const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'We could not sync your cart. Your changes are still on this device.';

/** The sole coordinator for local commands, account boundaries and serialized remote writes. */
export class CartController {
  private owner: CartOwner | null = null;
  private document: CartDocument | null = null;
  private memory = new Map<CartOwner, CartDocument>();
  private unsaved = new Map<CartOwner, Array<(document: CartDocument) => CartDocument>>();
  private queue: Promise<unknown> = Promise.resolve();
  private session = 0;
  private authenticated = false;
  private disposed = false;
  private request: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingSync: Promise<void> | null = null;
  private busy = false;
  private storageError: string | null = null;
  private syncError: string | null = null;
  private retryDelay = 1_000;
  private initialized: Promise<void>;
  private markInitialized!: () => void;
  private projection?: {
    owner: CartOwner | null;
    document: CartDocument | null;
    variants: CartVariant[];
  };

  constructor(
    private repository: CartRepository,
    private publish: (view: CartView) => void,
    private transport = cartTransport,
    private online = () => typeof navigator === 'undefined' || navigator.onLine,
  ) {
    this.initialized = new Promise((resolve) => {
      this.markInitialized = resolve;
    });
  }

  private projectedVariants() {
    const previous = this.projection;
    if (previous?.owner === this.owner && previous.document === this.document)
      return previous.variants;
    const projected = this.document ? projectCart(this.document) : [];
    const sameCart =
      previous?.owner === this.owner && previous.document?.cartId === this.document?.cartId;
    // Status updates and unchanged reads must not restart price/availability effects in consumers.
    const variants =
      sameCart && deepEqual(previous.variants, projected) ? previous.variants : projected;
    this.projection = { owner: this.owner, document: this.document, variants };
    return variants;
  }

  private render() {
    const document = this.document;
    const conflicts: CartConflict[] = document
      ? Object.entries(document.edits).flatMap(([variantId, edit]) => {
          const flight = document.flights[variantId];
          if (!edit.conflict && !edit.error && flight?.phase !== 'uncertain') return [];
          return [
            {
              variantId,
              title: edit.line.title,
              line: edit.line,
              localQuantity: edit.quantity,
              remoteQuantity: edit.conflict?.remoteQuantity ?? quantityOf(document, variantId),
              uncertain: flight?.phase === 'uncertain',
              message: edit.error ?? flight?.error,
            },
          ];
        })
      : [];
    const pending =
      document &&
      (Object.keys(document.edits).length > 0 || Object.keys(document.flights).length > 0);
    const syncStatus: CartView['syncStatus'] = conflicts.some((item) => item.uncertain)
      ? 'uncertain'
      : conflicts.length
        ? 'conflict'
        : this.busy
          ? 'syncing'
          : this.syncError
            ? 'error'
            : document?.owner !== 'guest' && (!this.authenticated || !this.online())
              ? 'offline'
              : document?.owner === 'guest' || !document
                ? 'idle'
                : document.fetched && !pending
                  ? 'synced'
                  : 'idle';
    this.publish({
      variants: this.projectedVariants(),
      owner: this.owner,
      hydrated: Boolean(document),
      storageError: this.storageError,
      syncError: this.syncError,
      syncStatus,
      conflicts,
    });
  }

  private accept(document: CartDocument) {
    if (document.owner !== this.owner) return;
    if (this.document?.cartId === document.cartId && this.document.revision > document.revision)
      return;
    this.document = document;
    this.render();
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  async activate(owner: CartOwner | null, authenticated: boolean) {
    this.disposed = false;
    this.authenticated = authenticated;
    if (owner === null) {
      this.request?.abort();
      this.render();
      return;
    }
    if (owner === this.owner && this.document) {
      this.render();
      await this.refresh();
      this.schedule(0);
      return;
    }
    const session = ++this.session;
    this.request?.abort();
    clearTimeout(this.timer);
    this.owner = owner;
    this.document = null;
    this.busy = false;
    this.storageError = this.syncError = null;
    this.render();
    await this.serialize(async () => {
      try {
        const document = await (owner === 'guest'
          ? this.repository.read(owner)
          : this.repository.adoptGuest(owner));
        if (session !== this.session) return;
        this.accept(document);
      } catch (error) {
        if (session !== this.session) return;
        this.storageError = messageOf(error);
        const document = this.memory.get(owner) ?? createCartDocument(owner, cartId());
        this.memory.set(owner, document);
        this.accept(document);
      }
      this.markInitialized();
    });
    this.schedule(0);
  }

  private async save(
    owner: CartOwner,
    change: (document: CartDocument) => CartDocument,
    durableOnly = false,
  ) {
    let commandError: unknown;
    try {
      const document = await this.repository.update(owner, (stored) => {
        try {
          const document = (this.unsaved.get(owner) ?? []).reduce(
            (current, apply) => apply(current),
            stored,
          );
          return change(document);
        } catch (error) {
          commandError = error;
          throw error;
        }
      });
      this.memory.delete(owner);
      this.unsaved.delete(owner);
      if (owner === this.owner) this.storageError = null;
      this.accept(document);
      return document;
    } catch (error) {
      if (commandError) throw commandError;
      if (owner === this.owner) {
        this.storageError = messageOf(error);
        this.render();
      }
      if (durableOnly) throw error;
      const previous =
        this.memory.get(owner) ??
        (this.document?.owner === owner ? this.document : createCartDocument(owner, cartId()));
      const document = { ...change(previous), revision: previous.revision + 1 };
      this.memory.set(owner, document);
      this.unsaved.set(owner, [...(this.unsaved.get(owner) ?? []), change]);
      this.accept(document);
      return document;
    }
  }

  private async commandOwner() {
    const owner = this.owner;
    const session = this.session;
    await this.initialized;
    if (owner && (owner !== this.owner || session !== this.session))
      throw new Error('Your account changed. Review the intended cart before editing it.');
    return owner ?? this.owner!;
  }

  async command(command: CartCommand) {
    const owner = await this.commandOwner();
    const id = cartId();
    await this.serialize(() => this.save(owner, (document) => editCart(document, command, id)));
    this.schedule();
  }

  async reduce(variantId: string, quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity <= 0)
      throw new Error('Choose a valid whole-number quantity.');
    const owner = await this.commandOwner();
    const id = cartId();
    await this.serialize(() =>
      this.save(owner, (document) => {
        const line = projectCart(document).find((item) => item.variantId === variantId);
        return line
          ? editCart(
              document,
              { type: 'setQuantity', variantId, quantity: Math.max(0, line.quantity - quantity) },
              id,
            )
          : document;
      }),
    );
    this.schedule();
  }

  async refresh() {
    if (!this.owner || !this.document || this.memory.has(this.owner)) return;
    try {
      this.accept(await this.repository.read(this.owner));
    } catch (error) {
      this.storageError = messageOf(error);
      this.render();
    }
  }

  schedule(delay = 250) {
    clearTimeout(this.timer);
    if (
      this.owner === null ||
      this.owner === 'guest' ||
      this.disposed ||
      !this.authenticated ||
      !this.online() ||
      this.storageError
    ) {
      this.render();
      return;
    }
    this.timer = setTimeout(() => {
      void this.sync();
    }, delay);
  }

  async retry() {
    const owner = await this.commandOwner();
    try {
      if (this.memory.has(owner)) {
        if (owner !== 'guest') await this.repository.adoptGuest(owner);
        await this.save(owner, (document) => document, true);
      } else {
        this.storageError = null;
        await this.refresh();
      }
    } catch {
      return;
    }
    await this.sync();
  }

  async resolveConflict(variantId: string, choice: 'local' | 'remote') {
    const owner = await this.commandOwner();
    const id = cartId();
    await this.serialize(() =>
      this.save(owner, (document) => resolveCartConflict(document, variantId, choice, id)),
    );
    this.syncError = null;
    this.schedule(0);
  }

  sync(): Promise<void> {
    if (this.pendingSync) return this.pendingSync;
    const owner = this.owner;
    if (
      !owner ||
      owner === 'guest' ||
      this.disposed ||
      !this.authenticated ||
      !this.online() ||
      this.storageError
    ) {
      this.render();
      return Promise.resolve();
    }
    const session = this.session;
    const request = new AbortController();
    this.request = request;
    const current = () => session === this.session && this.authenticated && !request.signal.aborted;
    const userId = owner.slice(5);
    this.pendingSync = (async () => {
      this.busy = true;
      this.syncError = null;
      this.render();
      try {
        await this.repository.withLease(owner, async (ownsLease) => {
          await this.save(
            owner,
            (document) => ({
              ...document,
              flights: Object.fromEntries(
                Object.entries(document.flights).map(([id, flight]) => [
                  id,
                  { ...flight, phase: 'uncertain' as const },
                ]),
              ),
            }),
            true,
          );
          let remote = await this.transport.read(userId, request.signal);
          if (!current()) return;
          let document = await this.save(
            owner,
            (document) => {
              for (const flight of Object.values(document.flights)) {
                if (
                  flight.acknowledged &&
                  (remote.find((line) => line.variantId === flight.variantId)?.quantity ?? 0) ===
                    flight.quantity
                )
                  document = settleCartWrite(document, flight, remote);
              }
              return reconcileCart(document, remote);
            },
            true,
          );
          for (let count = 0; count < 100 && current(); count++) {
            const edit = Object.values(document.edits).find(
              (edit) => !edit.conflict && !edit.error && !document.flights[edit.line.variantId],
            );
            if (!edit || !(await ownsLease()) || !current()) break;
            const variantId = edit.line.variantId;
            const baseQuantity = quantityOf(document, variantId);
            const flight: CartFlight = {
              editId: edit.id,
              variantId,
              quantity: edit.quantity,
              baseQuantity,
              kind: edit.quantity === 0 ? 'remove' : baseQuantity === 0 ? 'add' : 'update',
              phase: 'sending',
            };
            document = await this.save(
              owner,
              (latest) =>
                latest.edits[variantId]?.id !== edit.id
                  ? latest
                  : { ...latest, flights: { ...latest.flights, [variantId]: flight } },
              true,
            );
            if (document.flights[variantId]?.editId !== edit.id) continue;
            if (!current() || !(await ownsLease())) return;
            try {
              await this.transport.write(
                userId,
                flight.kind,
                { ...edit.line, quantity: edit.quantity },
                request.signal,
              );
              flight.acknowledged = true;
              if (!current()) return;
              document = await this.save(
                owner,
                (latest) => ({ ...latest, flights: { ...latest.flights, [variantId]: flight } }),
                true,
              );
              remote = await this.transport.read(userId, request.signal);
              if (!current() || !(await ownsLease())) return;
              document = await this.save(
                owner,
                (latest) => settleCartWrite(latest, flight, remote),
                true,
              );
            } catch (error) {
              if (!current()) return;
              const uncertain =
                flight.acknowledged || !(error instanceof CartTransportError) || error.uncertain;
              document = await this.save(
                owner,
                (latest) => {
                  const flights = { ...latest.flights };
                  if (uncertain)
                    flights[variantId] = {
                      ...flight,
                      phase: 'uncertain',
                      error:
                        'Your change is saved here, but we could not confirm it online. Review this quantity before trying again.',
                    };
                  else delete flights[variantId];
                  const pending = latest.edits[variantId];
                  const permanent =
                    error instanceof CartTransportError &&
                    [400, 403, 404, 422].includes(error.status);
                  return {
                    ...latest,
                    flights,
                    edits:
                      pending && permanent
                        ? { ...latest.edits, [variantId]: { ...pending, error: messageOf(error) } }
                        : latest.edits,
                  };
                },
                true,
              );
              if (!uncertain) throw error;
            }
          }
        });
        this.retryDelay = 1_000;
      } catch (error) {
        if (current()) this.syncError = messageOf(error);
        this.retryDelay = Math.min(30_000, this.retryDelay * 2);
      } finally {
        if (session === this.session) {
          this.busy = false;
          this.render();
        }
        this.pendingSync = null;
        if (this.request === request) this.request = null;
        if (session !== this.session || (request.signal.aborted && this.authenticated))
          this.schedule(0);
        else if (
          current() &&
          this.document &&
          Object.values(this.document.edits).some(
            (edit) => !edit.conflict && !edit.error && !this.document!.flights[edit.line.variantId],
          )
        )
          this.schedule(this.retryDelay);
      }
    })();
    return this.pendingSync;
  }

  checkoutSnapshot(): CartCheckoutSnapshot {
    if (
      !this.document ||
      this.storageError ||
      Object.values(this.document.edits).some((edit) => edit.conflict || edit.error) ||
      Object.values(this.document.flights).some((flight) => flight.phase === 'uncertain')
    )
      throw new Error('Review and save your cart before starting checkout.');
    return {
      owner: this.document.owner,
      cartId: this.document.cartId,
      lines: projectCart(this.document).map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        lineage: this.document!.lineage[line.variantId],
      })),
    };
  }

  async recordCheckout(orderId: string, snapshot: CartCheckoutSnapshot) {
    if (this.owner !== snapshot.owner || this.document?.cartId !== snapshot.cartId)
      throw new Error('Your account changed. Review your cart before starting checkout.');
    await this.repository.recordCheckout(orderId, snapshot);
    if (this.owner !== snapshot.owner)
      throw new Error('Your account changed. Review your cart before starting checkout.');
  }

  async consumePurchase(orderId: string, paidLines: CartPurchaseLine[]) {
    const owner = await this.repository.purchaseOwner(orderId);
    if (!owner) return;
    await this.serialize(() =>
      this.save(
        owner,
        (document) => {
          const snapshot = document.checkoutSnapshots[orderId];
          if (!snapshot || snapshot.cartId !== document.cartId || snapshot.owner !== owner)
            return document;
          const lines = paidLines.flatMap((paid) => {
            const captured = snapshot.lines.find((line) => line.variantId === paid.variantId);
            return captured?.lineage
              ? [
                  {
                    ...paid,
                    quantity: Math.min(paid.quantity, captured.quantity),
                    lineage: captured.lineage,
                  },
                ]
              : [];
          });
          return consumeCartPurchase(document, orderId, lines, cartId);
        },
        true,
      ),
    );
    this.schedule(0);
  }

  dispose() {
    this.disposed = true;
    this.authenticated = false;
    this.session += 1;
    clearTimeout(this.timer);
    this.request?.abort();
  }
}
