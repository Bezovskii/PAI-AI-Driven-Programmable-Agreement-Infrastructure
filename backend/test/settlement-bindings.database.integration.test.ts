import assert from "node:assert/strict";
import {
  randomUUID,
} from "node:crypto";
import test from "node:test";

import {
  loadEnv,
} from "../src/config/env.js";

import {
  createPrismaClient,
} from "../src/db/prisma.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

import {
  SettlementBindingConflictError,
  createPrismaSettlementBindingOperations,
} from "../src/settlement-bindings/service.js";

const CLIENT_WALLET =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const CONTRACTOR_WALLET =
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

const CONTRACT_ADDRESS =
  "0x1111111111111111111111111111111111111111";

test(
  "PAI settlement mapping integrity persists through PostgreSQL",
  async (t) => {
    const config =
      loadEnv();

    const prisma =
      createPrismaClient(
        config.databaseUrl,
      );

    const suffix =
      randomUUID();

    const clientUserId =
      `settlement-integration-user-${suffix}`;

    const createdAgreementIds:
      string[] = [];

    t.after(
      async () => {
        if (
          createdAgreementIds.length >
          0
        ) {
          await prisma
            .agreement
            .deleteMany({
              where: {
                id: {
                  in:
                    createdAgreementIds,
                },
              },
            });
        }

        await prisma
          .user
          .deleteMany({
            where: {
              id:
                clientUserId,
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

    const actor = {
      userId:
        clientUserId,

      walletAddress:
        CLIENT_WALLET,
    };

    const agreementOperations =
      createPrismaAgreementOperations(
        prisma,
      );

    const settlementOperations =
      createPrismaSettlementBindingOperations(
        prisma,
      );

    /* =====================================================
       AGREEMENT ONE
       ===================================================== */

    const agreementOne =
      await agreementOperations
        .createAgreement({
          actor,

          contractorWalletAddress:
            CONTRACTOR_WALLET,

          title:
            "Settlement integration agreement one",
        });

    createdAgreementIds.push(
      agreementOne.id,
    );

    const milestoneOne =
      await agreementOperations
        .addMilestone({
          actor,

          agreementId:
            agreementOne.id,

          title:
            "Agreement one milestone",
        });

    /* =====================================================
       AGREEMENT TWO

       Used to prove milestone mappings cannot cross
       PAI agreement boundaries.
       ===================================================== */

    const agreementTwo =
      await agreementOperations
        .createAgreement({
          actor,

          contractorWalletAddress:
            CONTRACTOR_WALLET,

          title:
            "Settlement integration agreement two",
        });

    createdAgreementIds.push(
      agreementTwo.id,
    );

    const milestoneTwo =
      await agreementOperations
        .addMilestone({
          actor,

          agreementId:
            agreementTwo.id,

          title:
            "Agreement two milestone",
        });

    /* =====================================================
       EXTERNAL AGREEMENT BINDING
       ===================================================== */

    const agreementBinding =
      await settlementOperations
        .createAgreementBinding({
          actor,

          agreementId:
            agreementOne.id,

          provider:
            "ESCT",

          chainId:
            11155111,

          contractAddress:
            CONTRACT_ADDRESS,

          externalAgreementId:
            `external-agreement-${suffix}`,
        });

    assert.equal(
      agreementBinding.agreementId,
      agreementOne.id,
    );

    assert.equal(
      agreementBinding.provider,
      "esct",
    );

    /* =====================================================
       EXTERNAL MILESTONE BINDING
       ===================================================== */

    const milestoneBinding =
      await settlementOperations
        .createMilestoneBinding({
          actor,

          agreementId:
            agreementOne.id,

          agreementSettlementBindingId:
            agreementBinding.id,

          milestoneId:
            milestoneOne.id,

          externalMilestoneId:
            `external-milestone-${suffix}`,
        });

    assert.equal(
      milestoneBinding.milestoneId,
      milestoneOne.id,
    );

    /* =====================================================
       VERIFY ACTUAL PERSISTED GRAPH
       ===================================================== */

    const persistedBinding =
      await prisma
        .agreementSettlementBinding
        .findUnique({
          where: {
            id:
              agreementBinding.id,
          },

          include: {
            milestoneBindings:
              true,
          },
        });

    assert.ok(
      persistedBinding,
    );

    assert.equal(
      persistedBinding.agreementId,
      agreementOne.id,
    );

    assert.equal(
      persistedBinding.provider,
      "esct",
    );

    assert.equal(
      persistedBinding.chainId,
      11155111,
    );

    assert.equal(
      persistedBinding.contractAddress,
      CONTRACT_ADDRESS,
    );

    assert.equal(
      persistedBinding.milestoneBindings.length,
      1,
    );

    assert.equal(
      persistedBinding
        .milestoneBindings[0]
        ?.milestoneId,
      milestoneOne.id,
    );

    assert.equal(
      persistedBinding
        .milestoneBindings[0]
        ?.externalMilestoneId,
      `external-milestone-${suffix}`,
    );

    /* =====================================================
       HARD INTEGRITY CHECK

       A milestone belonging to agreement two must not be
       attached to agreement one's settlement binding.
       ===================================================== */

    await assert.rejects(
      settlementOperations
        .createMilestoneBinding({
          actor,

          agreementId:
            agreementOne.id,

          agreementSettlementBindingId:
            agreementBinding.id,

          milestoneId:
            milestoneTwo.id,

          externalMilestoneId:
            `invalid-cross-agreement-${suffix}`,
        }),

      SettlementBindingConflictError,
    );

    const finalMilestoneBindingCount =
      await prisma
        .milestoneSettlementBinding
        .count({
          where: {
            agreementSettlementBindingId:
              agreementBinding.id,
          },
        });

    assert.equal(
      finalMilestoneBindingCount,
      1,
    );
  },
);