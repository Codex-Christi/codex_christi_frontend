ALTER TABLE "MerchizeFulfillmentOrder"
ADD COLUMN "lastTrackingSyncAt" TIMESTAMP(3),
ADD COLUMN "merchizeTrackingPayload" JSONB;
