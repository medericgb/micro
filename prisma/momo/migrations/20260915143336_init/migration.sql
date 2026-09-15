-- CreateTable
CREATE TABLE "ProviderAccount" (
    "msisdn" TEXT NOT NULL,
    "balanceMinor" BIGINT NOT NULL DEFAULT 1000000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAccount_pkey" PRIMARY KEY ("msisdn")
);

-- CreateTable
CREATE TABLE "ProviderCharge" (
    "providerRef" TEXT NOT NULL,
    "msisdn" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "reference" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCharge_pkey" PRIMARY KEY ("providerRef")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCharge_reference_key" ON "ProviderCharge"("reference");
