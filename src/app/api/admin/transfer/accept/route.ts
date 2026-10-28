import { adminCredentialPost, adminAuthReply } from '@/lib/admin/admin-auth-route';
import { adminTransferAcceptanceSchema } from '@/lib/formSchemas/admin-transfer';
import { acceptMasterAdminTransfer } from '@/lib/admin/admin-master-transfer';
import { getServerSessionState } from '@/lib/session/server-session';
import { AdminCredentialError } from '@/lib/admin/admin-credential-work';
import { clearAdminSessionCookie } from '@/lib/admin/admin-session-cookies';

export async function POST(request: Request) {
  return adminCredentialPost(request, adminTransferAcceptanceSchema, async (input) => {
    const primary = await getServerSessionState();
    if (!primary.isAuthenticated || !primary.userID)
      throw new AdminCredentialError(
        'Sign in to the invited website account before accepting ownership.',
        401,
      );
    await acceptMasterAdminTransfer({ recipientUserId: primary.userID, input });
    // Require the new admin password without changing ordinary access/refresh cookies.
    return clearAdminSessionCookie(adminAuthReply({ success: true }));
  });
}
