-- CreateTable
CREATE TABLE "PaypalIntent" (
    "id" TEXT NOT NULL,
    "orderToken" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "paypalAuthorizationId" TEXT,
    "otpOrderId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "userId" TEXT,
    "countryIso2" TEXT,
    "countryIso3" TEXT,
    "initialCurrency" TEXT,
    "cartSnapshot" JSONB NOT NULL,
    "shippingSnapshot" JSONB NOT NULL,
    "authorizePayload" JSONB,
    "capturePayload" JSONB,
    "backendCustomId" TEXT,
    "receiptLink" TEXT,
    "receiptFile" TEXT,
    "status" TEXT NOT NULL,
    "lastEventType" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "postProcessingLockId" TEXT,
    "postProcessingLockedAt" TIMESTAMP(3),
    "postProcessingLockExpiresAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaypalIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaypalWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "payload" JSONB NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'received',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaypalWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaypalIntent_orderToken_key" ON "PaypalIntent"("orderToken");

-- CreateIndex
CREATE UNIQUE INDEX "PaypalIntent_paypalOrderId_key" ON "PaypalIntent"("paypalOrderId");

-- CreateIndex
CREATE INDEX "PaypalIntent_customerEmail_idx" ON "PaypalIntent"("customerEmail");

-- CreateIndex
CREATE INDEX "PaypalIntent_status_idx" ON "PaypalIntent"("status");

-- CreateIndex
CREATE INDEX "PaypalIntent_createdAt_idx" ON "PaypalIntent"("createdAt");

-- CreateIndex
CREATE INDEX "PaypalIntent_postProcessingLockExpiresAt_idx" ON "PaypalIntent"("postProcessingLockExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaypalWebhookEvent_eventId_key" ON "PaypalWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "PaypalWebhookEvent_paypalOrderId_idx" ON "PaypalWebhookEvent"("paypalOrderId");

-- CreateIndex
CREATE INDEX "PaypalWebhookEvent_eventType_idx" ON "PaypalWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaypalWebhookEvent_processingStatus_idx" ON "PaypalWebhookEvent"("processingStatus");

-- CreateIndex
CREATE INDEX "PaypalWebhookEvent_processedAt_idx" ON "PaypalWebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "PaypalWebhookEvent_createdAt_idx" ON "PaypalWebhookEvent"("createdAt");
