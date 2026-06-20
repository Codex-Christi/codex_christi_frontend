import 'server-only';

import { createHash, createHmac } from 'crypto';
import { headers } from 'next/headers';
import { getAdminSessionSecret } from './admin-config';

export type AdminRequestAuditContext = {
  ipHash: string | null;
  userAgentHash: string | null;
};

export async function getAdminRequestAuditContext(): Promise<AdminRequestAuditContext> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get('x-forwarded-for');
  const realIp = headerStore.get('x-real-ip');
  const userAgent = headerStore.get('user-agent');

  return {
    ipHash: hashAuditValue(forwardedFor?.split(',')[0]?.trim() ?? realIp),
    userAgentHash: hashAuditValue(userAgent),
  };
}

function hashAuditValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const secret = getAdminSessionSecret();

  if (secret) {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  return createHash('sha256').update(value).digest('hex');
}

