-- Separate provider command acknowledgement from verified fulfillment release and
-- persist the evidence used by the production-readiness gate.
ALTER TABLE "MerchizeFulfillmentOrder"
ADD COLUMN "itemReviewStatus" TEXT,
ADD COLUMN "artworkReviewStatus" TEXT,
ADD COLUMN "attentionReviewStatus" TEXT,
ADD COLUMN "providerPushProgress" TEXT,
ADD COLUMN "manualReleaseRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "providerPaidAt" TIMESTAMP(3),
ADD COLUMN "pushAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN "pushVerifiedAt" TIMESTAMP(3),
ADD COLUMN "providerAddressUpdatedAt" TIMESTAMP(3),
ADD COLUMN "lastReadinessCheckAt" TIMESTAMP(3),
ADD COLUMN "merchizeUnfulfilledItemsPayload" JSONB,
ADD COLUMN "merchizeRequireAttentionPayload" JSONB,
ADD COLUMN "merchizeSendToFulfillmentPayload" JSONB,
ADD COLUMN "merchizeProductionReadinessPayload" JSONB;

CREATE INDEX "MerchizeFulfillmentOrder_itemReviewStatus_idx" ON "MerchizeFulfillmentOrder"("itemReviewStatus");
CREATE INDEX "MerchizeFulfillmentOrder_artworkReviewStatus_idx" ON "MerchizeFulfillmentOrder"("artworkReviewStatus");
CREATE INDEX "MerchizeFulfillmentOrder_attentionReviewStatus_idx" ON "MerchizeFulfillmentOrder"("attentionReviewStatus");
CREATE INDEX "MerchizeFulfillmentOrder_providerPushProgress_idx" ON "MerchizeFulfillmentOrder"("providerPushProgress");
CREATE INDEX "MerchizeFulfillmentOrder_manualReleaseRequired_idx" ON "MerchizeFulfillmentOrder"("manualReleaseRequired");
