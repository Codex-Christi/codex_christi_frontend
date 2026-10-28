BEGIN;

ALTER TABLE "AdminMasterTransferChallenge"
  ALTER COLUMN "targetPasswordHash" DROP NOT NULL,
  ADD COLUMN "acceptanceVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sourceSessionVersion" INTEGER,
  ADD COLUMN "targetAdminUserId" TEXT,
  ADD COLUMN "targetAdminSessionVersion" INTEGER;

-- Legacy codes cannot be used by the recipient-owned acceptance flow.
UPDATE "AdminMasterTransferChallenge"
SET "consumedAt" = CURRENT_TIMESTAMP
WHERE "consumedAt" IS NULL AND "acceptanceVersion" = 1;

ALTER TABLE "AdminMasterTransferChallenge"
  ADD CONSTRAINT "AdminMasterTransferChallenge_active_version_check" CHECK (
    "acceptanceVersion" = 2 OR "consumedAt" IS NOT NULL
  ),
  ADD CONSTRAINT "AdminMasterTransferChallenge_recipient_state_check" CHECK (
    "acceptanceVersion" <> 2 OR (
      "targetPasswordHash" IS NULL AND "sourceSessionVersion" IS NOT NULL AND
      "sourceSessionVersion" > 0 AND (
        ("targetAdminUserId" IS NULL AND "targetAdminSessionVersion" IS NULL) OR
        ("targetAdminUserId" IS NOT NULL AND "targetAdminSessionVersion" IS NOT NULL
          AND "targetAdminSessionVersion" > 0)
      )
    )
  );

COMMIT;
