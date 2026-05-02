-- CreateTable
CREATE TABLE "CheckoutRecoveryOtpChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CheckoutRecoveryOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckoutRecoveryOtpChallenge_email_expiresAt_idx" ON "CheckoutRecoveryOtpChallenge"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "CheckoutRecoveryOtpChallenge_consumedAt_idx" ON "CheckoutRecoveryOtpChallenge"("consumedAt");
