-- CreateTable
CREATE TABLE "AdminNotificationRecipientGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "recipientEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "includeMasterAdmins" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByCodexUserId" TEXT,
    "updatedByCodexUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNotificationRecipientGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotificationRecipientGroup_key_key"
  ON "AdminNotificationRecipientGroup"("key");

-- CreateIndex
CREATE INDEX "AdminNotificationRecipientGroup_enabled_idx"
  ON "AdminNotificationRecipientGroup"("enabled");

-- CreateIndex
CREATE INDEX "AdminNotificationRecipientGroup_createdAt_idx"
  ON "AdminNotificationRecipientGroup"("createdAt");
