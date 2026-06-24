CREATE TABLE "PaidOrderRecoveryProjection" (
    "id" TEXT NOT NULL,
    "orderToken" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "djangoOrderIntentUuid" TEXT,
    "djangoOrderIntentOrderId" TEXT,
    "djangoPaymentSaveCustomId" TEXT,
    "userId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "paypalLedgerStatus" TEXT NOT NULL,
    "adminRecoveryStatus" TEXT NOT NULL,
    "customerRecoveryStatus" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "isQueueVisible" BOOLEAN NOT NULL DEFAULT false,
    "isCustomerProtectionVisible" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "needsProviderDetailSync" BOOLEAN NOT NULL DEFAULT false,
    "needsAdminAttention" BOOLEAN NOT NULL DEFAULT false,
    "canRetryFullPostProcessing" BOOLEAN NOT NULL DEFAULT false,
    "canRetryFulfillment" BOOLEAN NOT NULL DEFAULT false,
    "canSyncProviderDetails" BOOLEAN NOT NULL DEFAULT false,
    "merchizeExternalOrderNumber" TEXT,
    "merchizeOrderId" TEXT,
    "merchizeOrderCode" TEXT,
    "merchizeOpsSyncStatus" TEXT,
    "merchizeProductionGateStatus" TEXT,
    "merchizeProgressStatus" TEXT,
    "merchizeDeliveryStatus" TEXT,
    "receiptLink" TEXT,
    "receiptFile" TEXT,
    "paidAmountLabel" TEXT,
    "processingSourceLabel" TEXT,
    "processingSourceTone" TEXT,
    "latestWebhookSourceLabel" TEXT,
    "latestWebhookEventType" TEXT,
    "latestWebhookProcessingStatus" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "recoveryReason" TEXT,
    "recoveryStage" TEXT,
    "recoverySeverity" TEXT,
    "paypalIntentUpdatedAt" TIMESTAMP(3),
    "merchizeOpsUpdatedAt" TIMESTAMP(3),
    "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaidOrderRecoveryProjection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaidOrderRecoveryProjection_orderToken_key"
    ON "PaidOrderRecoveryProjection"("orderToken");

CREATE INDEX "PaidOrderRecoveryProjection_adminRecoveryStatus_updatedAt_idx"
    ON "PaidOrderRecoveryProjection"("adminRecoveryStatus", "updatedAt");

CREATE INDEX "PaidOrderRecoveryProjection_customerRecoveryStatus_updatedAt_idx"
    ON "PaidOrderRecoveryProjection"("customerRecoveryStatus", "updatedAt");

CREATE INDEX "PaidOrderRecoveryProjection_isQueueVisible_updatedAt_idx"
    ON "PaidOrderRecoveryProjection"("isQueueVisible", "updatedAt");

CREATE INDEX "PaidOrderRecoveryProjection_isCustomerProtectionVisible_updatedAt_idx"
    ON "PaidOrderRecoveryProjection"("isCustomerProtectionVisible", "updatedAt");

CREATE INDEX "PaidOrderRecoveryProjection_customerEmail_updatedAt_idx"
    ON "PaidOrderRecoveryProjection"("customerEmail", "updatedAt");

CREATE INDEX "PaidOrderRecoveryProjection_paypalLedgerStatus_idx"
    ON "PaidOrderRecoveryProjection"("paypalLedgerStatus");

CREATE INDEX "PaidOrderRecoveryProjection_djangoPaymentSaveCustomId_idx"
    ON "PaidOrderRecoveryProjection"("djangoPaymentSaveCustomId");

CREATE INDEX "PaidOrderRecoveryProjection_needsProviderDetailSync_idx"
    ON "PaidOrderRecoveryProjection"("needsProviderDetailSync");

CREATE INDEX "PaidOrderRecoveryProjection_needsAdminAttention_idx"
    ON "PaidOrderRecoveryProjection"("needsAdminAttention");
