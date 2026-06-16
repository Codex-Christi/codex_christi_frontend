-- CreateTable
CREATE TABLE "AdminNotificationOutbox" (
    "id" TEXT NOT NULL,
    "orderToken" TEXT,
    "paypalOrderId" TEXT,
    "type" TEXT NOT NULL,
    "stage" TEXT,
    "errorCode" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dedupeKey" TEXT NOT NULL,
    "recipient" TEXT,
    "payload" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotificationOutbox_dedupeKey_key" ON "AdminNotificationOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "AdminNotificationOutbox_orderToken_idx" ON "AdminNotificationOutbox"("orderToken");

-- CreateIndex
CREATE INDEX "AdminNotificationOutbox_paypalOrderId_idx" ON "AdminNotificationOutbox"("paypalOrderId");

-- CreateIndex
CREATE INDEX "AdminNotificationOutbox_type_idx" ON "AdminNotificationOutbox"("type");

-- CreateIndex
CREATE INDEX "AdminNotificationOutbox_stage_idx" ON "AdminNotificationOutbox"("stage");

-- CreateIndex
CREATE INDEX "AdminNotificationOutbox_errorCode_idx" ON "AdminNotificationOutbox"("errorCode");

-- CreateIndex
CREATE INDEX "AdminNotificationOutbox_severity_idx" ON "AdminNotificationOutbox"("severity");

-- CreateIndex
CREATE INDEX "AdminNotificationOutbox_status_idx" ON "AdminNotificationOutbox"("status");

-- CreateIndex
CREATE INDEX "AdminNotificationOutbox_createdAt_idx" ON "AdminNotificationOutbox"("createdAt");
