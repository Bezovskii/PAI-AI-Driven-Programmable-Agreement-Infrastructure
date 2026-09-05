import assert from "node:assert/strict";
import {
  randomUUID,
} from "node:crypto";
import test from "node:test";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

import {
  createPrismaClient,
} from "../src/db/prisma.js";

const CLIENT_WALLET =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const CONTRACTOR_WALLET =
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

test(
  "PAI agreement lifecycle persists through PostgreSQL",
  async (t) => {
    const databaseUrl =
      process.env.DATABASE_URL;

    assert.ok(
      databaseUrl,
      "DATABASE_URL is required for database integration tests.",
    );

    const prisma =
      createPrismaClient(
        databaseUrl,
      );

    const runId =
      randomUUID();

    const clientUserId =
      `pai-db-client-${runId}`;

    const contractorUserId =
      `pai-db-contractor-${runId}`;

    t.after(
      async () => {
        await prisma
          .agreement
          .deleteMany({
            where: {
              createdByUserId: {
                in: [
                  clientUserId,
                  contractorUserId,
                ],
              },
            },
          });

        await prisma
          .user
          .deleteMany({
            where: {
              id: {
                in: [
                  clientUserId,
                  contractorUserId,
                ],
              },
            },
          });

        await prisma
          .$disconnect();
      },
    );

    await prisma
      .user
      .create({
        data: {
          id:
            clientUserId,
        },
      });

    await prisma
      .user
      .create({
        data: {
          id:
            contractorUserId,
        },
      });

    const clientActor = {
      userId:
        clientUserId,

      walletAddress:
        CLIENT_WALLET,
    };

    const contractorActor = {
      userId:
        contractorUserId,

      walletAddress:
        CONTRACTOR_WALLET,
    };

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    /* =====================================================
       CREATE
       ===================================================== */

    const created =
      await operations
        .createAgreement({
          actor:
            clientActor,

          contractorWalletAddress:
            CONTRACTOR_WALLET,

          title:
            "PAI database lifecycle test",

          metadataUri:
            "ipfs://pai/database-test/agreement",

          termsHash:
            "0xpaiterms",
        });

    assert.equal(
      created.status,
      "DRAFT",
    );

    /* =====================================================
       MILESTONE
       ===================================================== */

    const milestone =
      await operations
        .addMilestone({
          actor:
            clientActor,

          agreementId:
            created.id,

          title:
            "Deliver MVP",

          specificationUri:
            "ipfs://pai/database-test/milestone",

          amount:
            "500",

          asset:
            "USDC",
        });

    assert.equal(
      milestone.agreementId,
      created.id,
    );

    assert.equal(
      milestone.position,
      1,
    );

    assert.equal(
      milestone.status,
      "PENDING",
    );

    /* =====================================================
       PROPOSE
       ===================================================== */

    const proposed =
      await operations
        .proposeAgreement({
          actor:
            clientActor,

          agreementId:
            created.id,
        });

    assert.deepEqual(
      proposed,
      {
        id:
          created.id,

        status:
          "PROPOSED",
      },
    );

    /* =====================================================
       ACCEPT
       ===================================================== */

    const accepted =
      await operations
        .acceptAgreement({
          actor:
            contractorActor,

          agreementId:
            created.id,
        });

    assert.deepEqual(
      accepted,
      {
        id:
          created.id,

        status:
          "ACCEPTED",
      },
    );

    /* =====================================================
       EVIDENCE
       ===================================================== */

    const evidence =
      await operations
        .submitEvidence({
          actor:
            contractorActor,

          agreementId:
            created.id,

          milestoneId:
            milestone.id,

          uri:
            "ipfs://pai/database-test/evidence",

          hash:
            "0xpaievidence",

          description:
            "Completed MVP delivery.",
        });

    assert.equal(
      evidence.milestoneId,
      milestone.id,
    );

    assert.equal(
      evidence.uri,
      "ipfs://pai/database-test/evidence",
    );

    assert.equal(
      evidence.hash,
      "0xpaievidence",
    );

    /* =====================================================
       VERIFY ACTUAL DATABASE STATE
       ===================================================== */

    const persisted =
      await prisma
        .agreement
        .findUnique({
          where: {
            id:
              created.id,
          },

          include: {
            parties: {
              orderBy: {
                createdAt:
                  "asc",
              },
            },

            acceptances:
              true,

            milestones: {
              orderBy: {
                position:
                  "asc",
              },

              include: {
                evidence:
                  true,
              },
            },
          },
        });

    assert.ok(
      persisted,
    );

    assert.equal(
      persisted.status,
      "IN_PROGRESS",
    );

    assert.equal(
      persisted.createdByUserId,
      clientUserId,
    );

    assert.equal(
      persisted.parties.length,
      2,
    );

    const clientParty =
      persisted.parties.find(
        (party) =>
          party.role ===
          "CLIENT",
      );

    const contractorParty =
      persisted.parties.find(
        (party) =>
          party.role ===
          "CONTRACTOR",
      );

    assert.ok(
      clientParty,
    );

    assert.ok(
      contractorParty,
    );

    assert.equal(
      clientParty.walletAddress,
      CLIENT_WALLET.toLowerCase(),
    );

    assert.equal(
      contractorParty.walletAddress,
      CONTRACTOR_WALLET.toLowerCase(),
    );

    assert.equal(
      persisted.acceptances.length,
      1,
    );

    assert.equal(
      persisted.acceptances[0]?.partyId,
      contractorParty.id,
    );

    assert.equal(
      persisted.acceptances[0]?.termsVersion,
      1,
    );

    assert.equal(
      persisted.acceptances[0]?.termsHash,
      "0xpaiterms",
    );

    assert.equal(
      persisted.milestones.length,
      1,
    );

    const persistedMilestone =
      persisted.milestones[0];

    assert.ok(
      persistedMilestone,
    );

    assert.equal(
      persistedMilestone.status,
      "SUBMITTED",
    );

    assert.equal(
      persistedMilestone.position,
      1,
    );

    assert.equal(
      persistedMilestone.amount,
      "500",
    );

    assert.equal(
      persistedMilestone.asset,
      "USDC",
    );

    assert.equal(
      persistedMilestone.evidence.length,
      1,
    );

    const persistedEvidence =
      persistedMilestone
        .evidence[0];

    assert.ok(
      persistedEvidence,
    );

    assert.equal(
      persistedEvidence.submittedByPartyId,
      contractorParty.id,
    );

    assert.equal(
      persistedEvidence.uri,
      "ipfs://pai/database-test/evidence",
    );

    assert.equal(
      persistedEvidence.hash,
      "0xpaievidence",
    );
  },
);