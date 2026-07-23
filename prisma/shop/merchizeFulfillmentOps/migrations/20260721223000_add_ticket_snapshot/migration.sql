ALTER TABLE "MerchizeFulfillmentOrder"
ADD COLUMN "merchizeTicketsPayload" JSONB,
ADD COLUMN "lastTicketSyncAt" TIMESTAMP(3);
