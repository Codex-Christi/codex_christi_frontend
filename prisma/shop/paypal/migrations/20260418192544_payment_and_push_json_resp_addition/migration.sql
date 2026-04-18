-- AlterTable
ALTER TABLE "PaypalIntent" ADD COLUMN     "fulfillmentSendResponsePayload" JSONB,
ADD COLUMN     "paymentSaveResponsePayload" JSONB;
