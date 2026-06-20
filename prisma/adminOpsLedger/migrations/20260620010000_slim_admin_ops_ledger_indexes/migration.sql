-- Drop redundant dashboard/audit indexes for the minimum-storage Admin Ops Ledger profile.
DROP INDEX IF EXISTS "AdminUser_email_idx";
DROP INDEX IF EXISTS "AdminUser_role_idx";
DROP INDEX IF EXISTS "AdminUser_status_idx";
DROP INDEX IF EXISTS "AdminUser_updatedAt_idx";

DROP INDEX IF EXISTS "AdminUnlockAttempt_adminUserId_idx";
DROP INDEX IF EXISTS "AdminUnlockAttempt_codexUserId_idx";
DROP INDEX IF EXISTS "AdminUnlockAttempt_success_idx";

DROP INDEX IF EXISTS "AdminAuditLog_actorAdminUserId_idx";
DROP INDEX IF EXISTS "AdminAuditLog_actorCodexUserId_idx";
DROP INDEX IF EXISTS "AdminAuditLog_action_idx";
DROP INDEX IF EXISTS "AdminAuditLog_targetType_targetId_idx";
DROP INDEX IF EXISTS "AdminAuditLog_outcome_idx";

CREATE INDEX IF NOT EXISTS "AdminUnlockAttempt_codexUserId_success_createdAt_idx"
  ON "AdminUnlockAttempt"("codexUserId", "success", "createdAt");
