CREATE TABLE "PaypalLedgerTransactionWebhookBinding" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "paypalPaymentMode" TEXT NOT NULL,
    "deploymentTarget" TEXT NOT NULL,
    "envVarName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "expectedUrl" TEXT,
    "eventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncStatus" TEXT NOT NULL DEFAULT 'unknown',
    "lastSyncSummary" TEXT,
    "lastObservedEnvWebhookId" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),
    "lastNotificationDedupeKey" TEXT,
    "createdByAdminId" TEXT,
    "createdByCodexUserId" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByCodexUserId" TEXT,
    "activatedByAdminId" TEXT,
    "activatedByCodexUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaypalLedgerTransactionWebhookBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaypalLedgerTransactionWebhookBinding_key_key"
    ON "PaypalLedgerTransactionWebhookBinding"("key");

CREATE INDEX "PaypalLedgerTransactionWebhookBinding_paypalPaymentMode_isActive_idx"
    ON "PaypalLedgerTransactionWebhookBinding"("paypalPaymentMode", "isActive");

CREATE INDEX "PaypalLedgerTransactionWebhookBinding_deploymentTarget_idx"
    ON "PaypalLedgerTransactionWebhookBinding"("deploymentTarget");

CREATE INDEX "PaypalLedgerTransactionWebhookBinding_envVarName_idx"
    ON "PaypalLedgerTransactionWebhookBinding"("envVarName");

CREATE INDEX "PaypalLedgerTransactionWebhookBinding_lastSyncStatus_idx"
    ON "PaypalLedgerTransactionWebhookBinding"("lastSyncStatus");

CREATE INDEX "PaypalLedgerTransactionWebhookBinding_updatedAt_idx"
    ON "PaypalLedgerTransactionWebhookBinding"("updatedAt");
