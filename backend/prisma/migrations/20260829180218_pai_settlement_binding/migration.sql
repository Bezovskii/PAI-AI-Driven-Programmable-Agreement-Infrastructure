-- CreateTable
CREATE TABLE "AgreementSettlementBinding" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "externalAgreementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementSettlementBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneSettlementBinding" (
    "id" TEXT NOT NULL,
    "agreementSettlementBindingId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "externalMilestoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneSettlementBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgreementSettlementBinding_agreementId_idx" ON "AgreementSettlementBinding"("agreementId");

-- CreateIndex
CREATE INDEX "AgreementSettlementBinding_provider_chainId_idx" ON "AgreementSettlementBinding"("provider", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementSettlementBinding_agreementId_provider_key" ON "AgreementSettlementBinding"("agreementId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementSettlementBinding_provider_chainId_contractAddress_key" ON "AgreementSettlementBinding"("provider", "chainId", "contractAddress", "externalAgreementId");

-- CreateIndex
CREATE INDEX "MilestoneSettlementBinding_milestoneId_idx" ON "MilestoneSettlementBinding"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneSettlementBinding_agreementSettlementBindingId_mil_key" ON "MilestoneSettlementBinding"("agreementSettlementBindingId", "milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneSettlementBinding_agreementSettlementBindingId_ext_key" ON "MilestoneSettlementBinding"("agreementSettlementBindingId", "externalMilestoneId");

-- AddForeignKey
ALTER TABLE "AgreementSettlementBinding" ADD CONSTRAINT "AgreementSettlementBinding_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSettlementBinding" ADD CONSTRAINT "MilestoneSettlementBinding_agreementSettlementBindingId_fkey" FOREIGN KEY ("agreementSettlementBindingId") REFERENCES "AgreementSettlementBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSettlementBinding" ADD CONSTRAINT "MilestoneSettlementBinding_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
