-- CreateTable
CREATE TABLE "MerchizeFulfillmentOrder" (
    "id" TEXT NOT NULL,
    "orderToken" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "djangoOrderIntentUuid" TEXT,
    "djangoOrderIntentOrderId" TEXT,
    "djangoPaymentSaveCustomId" TEXT NOT NULL,
    "merchizeExternalOrderNumber" TEXT NOT NULL,
    "merchizeOrderId" TEXT,
    "merchizeOrderCode" TEXT,
    "merchizeIdentifier" TEXT,
    "merchizeStatus" TEXT,
    "merchizeSubStatus" TEXT,
    "merchizeIsEnqueued" BOOLEAN,
    "merchizeIsDeleted" BOOLEAN,
    "merchizeHidden" BOOLEAN,
    "customerEmailRedacted" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingCountry" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "orderCurrency" TEXT,
    "productionGateStatus" TEXT,
    "addressReviewStatus" TEXT,
    "costReviewStatus" TEXT,
    "progressStatus" TEXT,
    "deliveryStatus" TEXT,
    "releasedToProductionAt" TIMESTAMP(3),
    "heldAt" TIMESTAMP(3),
    "lastAddressCheckAt" TIMESTAMP(3),
    "lastCostCheckAt" TIMESTAMP(3),
    "lastProgressSyncAt" TIMESTAMP(3),
    "lastHistorySyncAt" TIMESTAMP(3),
    "djangoProcessResponsePayload" JSONB,
    "merchizeExternalLookupPayload" JSONB,
    "merchizeInDepthOrderDetailPayload" JSONB,
    "merchizeAddressSuggestionPayload" JSONB,
    "merchizeFulfillmentCostPayload" JSONB,
    "merchizeTransactionFeePayload" JSONB,
    "merchizeProgressPayload" JSONB,
    "merchizeHistoryPayload" JSONB,
    "syncStatus" TEXT NOT NULL,
    "lastSyncErrorCode" TEXT,
    "lastSyncErrorMessage" TEXT,
    "lastLookupAt" TIMESTAMP(3),
    "lastDetailSyncAt" TIMESTAMP(3),
    "duplicateDetectedAt" TIMESTAMP(3),
    "manuallyLinkedAt" TIMESTAMP(3),
    "manuallyLinkedBy" TEXT,
    "manualLinkReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchizeFulfillmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchizeFulfillmentItem" (
    "id" TEXT NOT NULL,
    "merchizeFulfillmentOrderId" TEXT NOT NULL,
    "merchizeLineItemId" TEXT,
    "productId" TEXT,
    "merchizeSku" TEXT,
    "sellerSku" TEXT,
    "title" TEXT,
    "quantity" INTEGER NOT NULL,
    "currency" TEXT,
    "unitPrice" DECIMAL(65,30),
    "imageUrl" TEXT,
    "variantSummary" TEXT,
    "itemPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchizeFulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchizeFulfillmentSyncAttempt" (
    "id" TEXT NOT NULL,
    "merchizeFulfillmentOrderId" TEXT,
    "orderToken" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "requestSummary" JSONB,
    "responseSummary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchizeFulfillmentSyncAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchizeFulfillmentAdminAction" (
    "id" TEXT NOT NULL,
    "merchizeFulfillmentOrderId" TEXT,
    "orderToken" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchizeFulfillmentAdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchizeFulfillmentOrder_merchizeExternalOrderNumber_key" ON "MerchizeFulfillmentOrder"("merchizeExternalOrderNumber");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_orderToken_idx" ON "MerchizeFulfillmentOrder"("orderToken");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_djangoPaymentSaveCustomId_idx" ON "MerchizeFulfillmentOrder"("djangoPaymentSaveCustomId");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_merchizeOrderId_idx" ON "MerchizeFulfillmentOrder"("merchizeOrderId");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_merchizeOrderCode_idx" ON "MerchizeFulfillmentOrder"("merchizeOrderCode");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_merchizeStatus_idx" ON "MerchizeFulfillmentOrder"("merchizeStatus");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_syncStatus_idx" ON "MerchizeFulfillmentOrder"("syncStatus");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_productionGateStatus_idx" ON "MerchizeFulfillmentOrder"("productionGateStatus");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_addressReviewStatus_idx" ON "MerchizeFulfillmentOrder"("addressReviewStatus");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_costReviewStatus_idx" ON "MerchizeFulfillmentOrder"("costReviewStatus");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_progressStatus_idx" ON "MerchizeFulfillmentOrder"("progressStatus");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_deliveryStatus_idx" ON "MerchizeFulfillmentOrder"("deliveryStatus");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentOrder_updatedAt_idx" ON "MerchizeFulfillmentOrder"("updatedAt");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentItem_merchizeFulfillmentOrderId_idx" ON "MerchizeFulfillmentItem"("merchizeFulfillmentOrderId");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentItem_merchizeSku_idx" ON "MerchizeFulfillmentItem"("merchizeSku");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentItem_sellerSku_idx" ON "MerchizeFulfillmentItem"("sellerSku");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentItem_productId_idx" ON "MerchizeFulfillmentItem"("productId");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentSyncAttempt_merchizeFulfillmentOrderId_idx" ON "MerchizeFulfillmentSyncAttempt"("merchizeFulfillmentOrderId");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentSyncAttempt_orderToken_idx" ON "MerchizeFulfillmentSyncAttempt"("orderToken");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentSyncAttempt_action_idx" ON "MerchizeFulfillmentSyncAttempt"("action");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentSyncAttempt_status_idx" ON "MerchizeFulfillmentSyncAttempt"("status");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentSyncAttempt_startedAt_idx" ON "MerchizeFulfillmentSyncAttempt"("startedAt");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentAdminAction_merchizeFulfillmentOrderId_idx" ON "MerchizeFulfillmentAdminAction"("merchizeFulfillmentOrderId");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentAdminAction_orderToken_idx" ON "MerchizeFulfillmentAdminAction"("orderToken");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentAdminAction_action_idx" ON "MerchizeFulfillmentAdminAction"("action");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentAdminAction_status_idx" ON "MerchizeFulfillmentAdminAction"("status");

-- CreateIndex
CREATE INDEX "MerchizeFulfillmentAdminAction_createdAt_idx" ON "MerchizeFulfillmentAdminAction"("createdAt");

-- AddForeignKey
ALTER TABLE "MerchizeFulfillmentItem" ADD CONSTRAINT "MerchizeFulfillmentItem_merchizeFulfillmentOrderId_fkey" FOREIGN KEY ("merchizeFulfillmentOrderId") REFERENCES "MerchizeFulfillmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchizeFulfillmentSyncAttempt" ADD CONSTRAINT "MerchizeFulfillmentSyncAttempt_merchizeFulfillmentOrderId_fkey" FOREIGN KEY ("merchizeFulfillmentOrderId") REFERENCES "MerchizeFulfillmentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchizeFulfillmentAdminAction" ADD CONSTRAINT "MerchizeFulfillmentAdminAction_merchizeFulfillmentOrderId_fkey" FOREIGN KEY ("merchizeFulfillmentOrderId") REFERENCES "MerchizeFulfillmentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
