-- Add nullable provenance fields for webhook delivery source and fulfillment runner source.
ALTER TABLE "PaypalIntent"
ADD COLUMN "processingTriggerSource" TEXT,
ADD COLUMN "processingTriggerDetail" TEXT,
ADD COLUMN "processingTriggeredAt" TIMESTAMP(3);

ALTER TABLE "PaypalWebhookEvent"
ADD COLUMN "orderToken" TEXT,
ADD COLUMN "matchedWebhookId" TEXT,
ADD COLUMN "matchedWebhookSource" TEXT,
ADD COLUMN "matchedWebhookBindingKey" TEXT,
ADD COLUMN "matchedWebhookLabel" TEXT,
ADD COLUMN "webhookVerificationMode" TEXT;

CREATE INDEX "PaypalIntent_processingTriggerSource_idx" ON "PaypalIntent"("processingTriggerSource");
CREATE INDEX "PaypalWebhookEvent_orderToken_idx" ON "PaypalWebhookEvent"("orderToken");
CREATE INDEX "PaypalWebhookEvent_matchedWebhookSource_idx" ON "PaypalWebhookEvent"("matchedWebhookSource");
CREATE INDEX "PaypalWebhookEvent_matchedWebhookBindingKey_idx" ON "PaypalWebhookEvent"("matchedWebhookBindingKey");
