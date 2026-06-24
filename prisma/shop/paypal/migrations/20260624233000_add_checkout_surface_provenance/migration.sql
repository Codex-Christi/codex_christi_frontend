ALTER TABLE "PaypalIntent"
ADD COLUMN "checkoutSurfaceHost" TEXT,
ADD COLUMN "checkoutSurfaceOrigin" TEXT,
ADD COLUMN "checkoutSurfaceLabel" TEXT;

ALTER TABLE "PaidOrderRecoveryProjection"
ADD COLUMN "checkoutSurfaceHost" TEXT,
ADD COLUMN "checkoutSurfaceLabel" TEXT;

CREATE INDEX "PaypalIntent_checkoutSurfaceHost_idx" ON "PaypalIntent"("checkoutSurfaceHost");
CREATE INDEX "PaidOrderRecoveryProjection_checkoutSurfaceHost_idx" ON "PaidOrderRecoveryProjection"("checkoutSurfaceHost");
