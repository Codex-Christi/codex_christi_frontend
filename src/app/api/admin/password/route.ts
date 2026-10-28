import { adminPasswordChangeSchema } from '@/lib/formSchemas/admin-password';
import { adminCredentialPost, adminAuthReply } from '@/lib/admin/admin-auth-route';
import { changeAdminUnlockPassword } from '@/lib/admin/admin-credentials';
import { clearAdminSessionCookie } from '@/lib/admin/admin-session-cookies';

export async function POST(request: Request) {
  return adminCredentialPost(request, adminPasswordChangeSchema, async (input) => {
    await changeAdminUnlockPassword(input);
    return clearAdminSessionCookie(adminAuthReply({ success: true }));
  });
}
