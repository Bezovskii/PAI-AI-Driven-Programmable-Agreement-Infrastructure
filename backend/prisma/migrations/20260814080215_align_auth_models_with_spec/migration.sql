/*
  Warnings:

  - You are about to drop the column `usedAt` on the `AuthNonce` table. All the data in the column will be lost.
  - Added the required column `walletAddress` to the `AuthNonce` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuthNonce" DROP COLUMN "usedAt",
ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "walletAddress" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AuthNonce_walletAddress_idx" ON "AuthNonce"("walletAddress");
