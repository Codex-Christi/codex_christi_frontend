import type { NextRequest } from 'next/server';
import {
  listAdminAuditLogsForExport,
  type AdminAuditLogFilters,
  type AdminAuditLogSummary,
} from '@/lib/admin/admin-auth-ledger';
import { isAdminScopeAllowed } from '@/lib/admin/admin-config';
import { getAdminAuthContext } from '@/lib/admin/require-admin';

export async function GET(request: NextRequest) {
  const admin = await getAdminAuthContext();

  if (!admin || !isAdminScopeAllowed(admin.scopes, 'audit.view', admin.role)) {
    return new Response('Admin authorization required.', { status: 403 });
  }

  const filters = getAuditLogFilters(request.nextUrl.searchParams);
  const rows = await listAdminAuditLogsForExport({ filters });
  const csv = toAuditLogCsv(rows);

  return new Response(csv, {
    headers: {
      'Content-Disposition': 'attachment; filename="admin-security-records.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}

function getAuditLogFilters(params: URLSearchParams): AdminAuditLogFilters {
  return {
    action: getSearchValue(params, 'action'),
    actorCodexUserId: getSearchValue(params, 'actorCodexUserId'),
    outcome: getSearchValue(params, 'outcome'),
    since: getSearchValue(params, 'since') === '24h' ? '24h' : undefined,
    targetId: getSearchValue(params, 'targetId'),
  };
}

function getSearchValue(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() || undefined;
}

function toAuditLogCsv(rows: AdminAuditLogSummary[]) {
  const header = [
    'createdAt',
    'outcome',
    'action',
    'actorCodexUserId',
    'targetType',
    'targetId',
    'ipHash',
    'userAgentHash',
    'metadata',
  ];
  const body = rows.map((row) =>
    [
      row.createdAt.toISOString(),
      row.outcome,
      row.action,
      row.actorCodexUserId,
      row.targetType,
      row.targetId,
      row.ipHash,
      row.userAgentHash,
      row.metadata,
    ]
      .map(toCsvCell)
      .join(','),
  );

  return [header.join(','), ...body].join('\n');
}

function toCsvCell(value: unknown) {
  const text =
    value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);

  return `"${text.replaceAll('"', '""')}"`;
}
