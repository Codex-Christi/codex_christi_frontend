CREATE TABLE "CustomerNotificationOutbox" (
    "id" TEXT NOT NULL,
    "orderToken" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dedupeKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerNotificationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerNotificationOutbox_dedupeKey_key"
  ON "CustomerNotificationOutbox"("dedupeKey");

CREATE INDEX "CustomerNotificationOutbox_orderToken_idx"
  ON "CustomerNotificationOutbox"("orderToken");

CREATE INDEX "CustomerNotificationOutbox_paypalOrderId_idx"
  ON "CustomerNotificationOutbox"("paypalOrderId");

CREATE INDEX "CustomerNotificationOutbox_type_idx"
  ON "CustomerNotificationOutbox"("type");

CREATE INDEX "CustomerNotificationOutbox_status_idx"
  ON "CustomerNotificationOutbox"("status");

CREATE INDEX "CustomerNotificationOutbox_recipient_idx"
  ON "CustomerNotificationOutbox"("recipient");

CREATE INDEX "CustomerNotificationOutbox_createdAt_idx"
  ON "CustomerNotificationOutbox"("createdAt");
