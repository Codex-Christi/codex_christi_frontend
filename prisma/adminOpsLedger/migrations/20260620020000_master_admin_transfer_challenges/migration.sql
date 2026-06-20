-- CreateTable
CREATE TABLE "AdminMasterTransferChallenge" (
    "id" TEXT NOT NULL,
    "actorAdminUserId" TEXT,
    "actorCodexUserId" TEXT NOT NULL,
    "targetCodexUserId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "targetPasswordHash" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMasterTransferChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminMasterTransferChallenge_actorAdminUserId_consumedAt_expiresAt_idx"
  ON "AdminMasterTransferChallenge"("actorAdminUserId", "consumedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminMasterTransferChallenge_createdAt_idx"
  ON "AdminMasterTransferChallenge"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminMasterTransferChallenge"
  ADD CONSTRAINT "AdminMasterTransferChallenge_actorAdminUserId_fkey"
  FOREIGN KEY ("actorAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
