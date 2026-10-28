import { adminUnlockSchema } from '@/lib/formSchemas/admin-password';
import { adminCredentialPost, adminAuthReply } from '@/lib/admin/admin-auth-route';
import { unlockAdmin } from '@/lib/admin/admin-credentials';
import { buildExpiredAdminCookies } from '@/lib/admin/admin-session-cookies';
import { appendResponseCookies } from '@/lib/session/response-cookies';

export async function POST(request: Request) {
  return adminCredentialPost(request, adminUnlockSchema, async ({ password }) => {
    const cookie = await unlockAdmin(password);
    const legacy = buildExpiredAdminCookies().filter((value) => value.options.path === '/');
    return appendResponseCookies(adminAuthReply({ success: true }), [...legacy, cookie]);
  });
}
