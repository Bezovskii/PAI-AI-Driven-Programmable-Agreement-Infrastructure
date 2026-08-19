/*
  Warnings:

  - Added the required column `walletId` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "walletId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Session_walletId_idx" ON "Session"("walletId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
