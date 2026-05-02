ALTER TABLE "PaypalIntent" RENAME COLUMN "otpOrderId" TO "djangoOrderIntentOrderId";
ALTER TABLE "PaypalIntent" RENAME COLUMN "backendCustomId" TO "djangoPaymentSaveCustomId";
ALTER TABLE "PaypalIntent" RENAME COLUMN "fulfillmentSendResponsePayload" TO "merchizeFulfillmentResponsePayload";
ALTER TABLE "PaypalIntent" RENAME COLUMN "paymentSaveResponsePayload" TO "djangoPaymentSaveResponsePayload";

ALTER TABLE "PaypalIntent"
ADD COLUMN "djangoOrderIntentUuid" TEXT,
ADD COLUMN "djangoOrderIntentPayload" JSONB,
ADD COLUMN "djangoOrderIntentVerifyPayload" JSONB,
ADD COLUMN "merchizeFulfillmentRequestPayload" JSONB,
ADD COLUMN "merchizeFulfillmentProcessingId" TEXT,
ADD COLUMN "merchizeProviderOrderId" TEXT,
ADD COLUMN "merchizeProviderOrderCode" TEXT,
ADD COLUMN "fulfillmentAddressOverride" JSONB,
ADD COLUMN "fulfillmentAddressOverrideReason" TEXT,
ADD COLUMN "fulfillmentAddressOverriddenBy" TEXT,
ADD COLUMN "fulfillmentAddressOverriddenAt" TIMESTAMP(3);

CREATE INDEX "PaypalIntent_djangoOrderIntentUuid_idx" ON "PaypalIntent"("djangoOrderIntentUuid");
CREATE INDEX "PaypalIntent_djangoOrderIntentOrderId_idx" ON "PaypalIntent"("djangoOrderIntentOrderId");
CREATE INDEX "PaypalIntent_djangoPaymentSaveCustomId_idx" ON "PaypalIntent"("djangoPaymentSaveCustomId");
