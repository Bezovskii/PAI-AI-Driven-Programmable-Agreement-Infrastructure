-- AlterEnum
ALTER TYPE "AgreementStatus" ADD VALUE 'AWAITING_ACCEPTANCE' BEFORE 'ACCEPTED';
ALTER TYPE "AgreementStatus" ADD VALUE 'READY_TO_FUND' AFTER 'ACCEPTED';

-- AlterTable
ALTER TABLE "AgreementParty"
    ALTER COLUMN "walletAddress" DROP NOT NULL,
    ADD COLUMN "accessCredentialHash" TEXT;

-- CreateTable
CREATE TABLE "AgreementRevision" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "agreementVersion" INTEGER NOT NULL,
    "agreementHash" TEXT NOT NULL,
    "canonicalTerms" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgreementParty_accessCredentialHash_key"
ON "AgreementParty"("accessCredentialHash");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementRevision_agreementId_agreementVersion_key"
ON "AgreementRevision"("agreementId", "agreementVersion");

-- CreateIndex
CREATE INDEX "AgreementRevision_agreementId_idx"
ON "AgreementRevision"("agreementId");

-- CreateIndex
CREATE INDEX "AgreementRevision_agreementHash_idx"
ON "AgreementRevision"("agreementHash");

-- AddForeignKey
ALTER TABLE "AgreementRevision"
ADD CONSTRAINT "AgreementRevision_agreementId_fkey"
FOREIGN KEY ("agreementId")
REFERENCES "Agreement"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;