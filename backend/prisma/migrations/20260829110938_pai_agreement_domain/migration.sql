-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgreementPartyRole" AS ENUM ('CLIENT', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT,
    "metadataUri" TEXT,
    "termsHash" TEXT,
    "termsVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementParty" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" "AgreementPartyRole" NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementAcceptance" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "termsVersion" INTEGER NOT NULL,
    "termsHash" TEXT,
    "signature" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT,
    "specificationUri" TEXT,
    "amount" TEXT,
    "asset" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "submittedByPartyId" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "hash" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agreement_createdByUserId_idx" ON "Agreement"("createdByUserId");

-- CreateIndex
CREATE INDEX "Agreement_status_idx" ON "Agreement"("status");

-- CreateIndex
CREATE INDEX "AgreementParty_agreementId_role_idx" ON "AgreementParty"("agreementId", "role");

-- CreateIndex
CREATE INDEX "AgreementParty_walletAddress_idx" ON "AgreementParty"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementParty_agreementId_walletAddress_key" ON "AgreementParty"("agreementId", "walletAddress");

-- CreateIndex
CREATE INDEX "AgreementAcceptance_agreementId_idx" ON "AgreementAcceptance"("agreementId");

-- CreateIndex
CREATE INDEX "AgreementAcceptance_partyId_idx" ON "AgreementAcceptance"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementAcceptance_agreementId_partyId_termsVersion_key" ON "AgreementAcceptance"("agreementId", "partyId", "termsVersion");

-- CreateIndex
CREATE INDEX "Milestone_agreementId_idx" ON "Milestone"("agreementId");

-- CreateIndex
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_agreementId_position_key" ON "Milestone"("agreementId", "position");

-- CreateIndex
CREATE INDEX "Evidence_milestoneId_createdAt_idx" ON "Evidence"("milestoneId", "createdAt");

-- CreateIndex
CREATE INDEX "Evidence_submittedByPartyId_idx" ON "Evidence"("submittedByPartyId");

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementParty" ADD CONSTRAINT "AgreementParty_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "AgreementParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_submittedByPartyId_fkey" FOREIGN KEY ("submittedByPartyId") REFERENCES "AgreementParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
