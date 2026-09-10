-- CreateTable
CREATE TABLE "WalletBindingHandoff" (
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "agreementVersion" INTEGER NOT NULL,
    "agreementHash" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "role" "AgreementPartyRole" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletBindingHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletBindingHandoff_secretHash_key"
ON "WalletBindingHandoff"("secretHash");

-- CreateIndex
CREATE INDEX "WalletBindingHandoff_agreementId_partyId_idx"
ON "WalletBindingHandoff"("agreementId", "partyId");

-- CreateIndex
CREATE INDEX "WalletBindingHandoff_agreementId_agreementVersion_idx"
ON "WalletBindingHandoff"("agreementId", "agreementVersion");

-- CreateIndex
CREATE INDEX "WalletBindingHandoff_expiresAt_idx"
ON "WalletBindingHandoff"("expiresAt");

-- AddForeignKey
ALTER TABLE "WalletBindingHandoff"
ADD CONSTRAINT "WalletBindingHandoff_agreementId_fkey"
FOREIGN KEY ("agreementId")
REFERENCES "Agreement"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBindingHandoff"
ADD CONSTRAINT "WalletBindingHandoff_partyId_fkey"
FOREIGN KEY ("partyId")
REFERENCES "AgreementParty"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
