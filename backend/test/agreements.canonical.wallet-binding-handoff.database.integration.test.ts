import assert from "node:assert/strict";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import test from "node:test";

import type {
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

import {
  AgreementConflictError,
} from "../src/agreements/routes.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

import {
  createPrismaClient,
} from "../src/db/prisma.js";

const CLIENT_WALLET =
  "0x1111111111111111111111111111111111111111";

const CONTRACTOR_WALLET =
  "0x2222222222222222222222222222222222222222";

const TERMS:
  CanonicalAgreementTerms = {
    title:
      "Wallet-binding handoff DB concurrency test",

    description:
      "Verify one-time handoff redemption atomically through PostgreSQL.",

    totalValue:
      "1000",

    settlementAsset:
      "USDC",

    deadline:
      "2026-12-31T00:00:00.000Z",

    approvalWindow:
      "P3D",

    milestones: [
      {
        amount:
          "1000",

        deliverable:
          "Complete the agreed implementation.",

        acceptanceCriteria:
          "Client confirms completion.",

        deadline:
          "2026-12-31T00:00:00.000Z",
      },
    ],
  };

function hashHandoffSecret(
  secret:
    string,
): string {
  return createHash("sha256")
    .update(
      secret,
      "utf8",
    )
    .digest("hex");
}

test(
  "wallet-binding handoff is hash-only, transactionally one-time, and race-safe through PostgreSQL",
  async (t) => {
    const databaseUrl =
      process.env.DATABASE_URL;

    assert.ok(
      databaseUrl,
      "DATABASE_URL is required for database integration tests.",
    );

    /*
     * Two independent Prisma clients are intentional.
     * They force concurrent redemption through independent
     * database connections and real PostgreSQL row locks.
     */
    const prismaA =
      createPrismaClient(
        databaseUrl,
      );

    const prismaB =
      createPrismaClient(
        databaseUrl,
      );

    const runId =
      randomUUID();

    const creatorUserId =
      `pai-handoff-db-${runId}`;

    t.after(
      async () => {
        await prismaA
          .agreement
          .deleteMany({
            where: {
              createdByUserId:
                creatorUserId,
            },
          });

        await prismaA
          .user
          .deleteMany({
            where: {
              id:
                creatorUserId,
            },
          });

        await Promise.allSettled([
          prismaA.$disconnect(),
          prismaB.$disconnect(),
        ]);
      },
    );

    await prismaA
      .user
      .create({
        data: {
          id:
            creatorUserId,
        },
      });

    const operationsA =
      createPrismaAgreementOperations(
        prismaA,
      );

    const operationsB =
      createPrismaAgreementOperations(
        prismaB,
      );

    /* =====================================================
       CREATE CANONICAL AGREEMENT
       ===================================================== */

    const created =
      await operationsA
        .persistReviewedAgreement({
          actor: {
            userId:
              creatorUserId,
          },

          terms:
            TERMS,

          client: {
            displayName:
              "Handoff DB Client",
          },

          contractor: {
            displayName:
              "Handoff DB Contractor",
          },
        });

    const reference =
      created.lifecycle
        .reference;

    const agreementId =
      reference.agreementId;

    const clientAccess =
      created.partyAccess.find(
        (party) =>
          party.role ===
          "CLIENT",
      );

    const contractorAccess =
      created.partyAccess.find(
        (party) =>
          party.role ===
          "CONTRACTOR",
      );

    assert.ok(
      clientAccess,
    );

    assert.ok(
      contractorAccess,
    );

    /* =====================================================
       EXACT CURRENT DUAL ACCEPTANCE
       ===================================================== */

    await operationsA
      .acceptAgreementVersion({
        agreementId,

        agreementVersion:
          reference
            .agreementVersion,

        agreementHash:
          reference
            .agreementHash,

        partyId:
          clientAccess.partyId,

        partyAccessToken:
          clientAccess.accessToken,
      });

    const accepted =
      await operationsA
        .acceptAgreementVersion({
          agreementId,

          agreementVersion:
            reference
              .agreementVersion,

          agreementHash:
            reference
              .agreementHash,

          partyId:
            contractorAccess.partyId,

          partyAccessToken:
            contractorAccess.accessToken,
        });

    assert.equal(
      accepted.lifecycle.status,
      "ACCEPTED",
    );

    /* =====================================================
       CREATE CLIENT HANDOFF
       ===================================================== */

    const clientHandoff =
      await operationsA
        .createWalletBindingHandoff({
          agreementId,

          partyId:
            clientAccess.partyId,

          partyAccessToken:
            clientAccess.accessToken,
        });

    assert.match(
      clientHandoff.handoffId,
      /^[A-Za-z0-9_-]{43}$/,
    );

    const clientSecretHash =
      hashHandoffSecret(
        clientHandoff.handoffId,
      );

    const persistedBeforeRace =
      await prismaA
        .walletBindingHandoff
        .findUnique({
          where: {
            secretHash:
              clientSecretHash,
          },
        });

    assert.ok(
      persistedBeforeRace,
    );

    assert.equal(
      persistedBeforeRace
        .agreementId,
      agreementId,
    );

    assert.equal(
      persistedBeforeRace
        .agreementVersion,
      reference
        .agreementVersion,
    );

    assert.equal(
      persistedBeforeRace
        .agreementHash,
      reference
        .agreementHash,
    );

    assert.equal(
      persistedBeforeRace.partyId,
      clientAccess.partyId,
    );

    assert.equal(
      persistedBeforeRace.role,
      "CLIENT",
    );

    assert.equal(
      persistedBeforeRace
        .consumedAt,
      null,
    );

    /*
     * Database persistence must contain only SHA-256(secret),
     * never the raw opaque browser handoff value.
     */
    assert.equal(
      persistedBeforeRace
        .secretHash,
      clientSecretHash,
    );

    assert.notEqual(
      persistedBeforeRace
        .secretHash,
      clientHandoff.handoffId,
    );

    assert.equal(
      JSON.stringify(
        persistedBeforeRace,
      ).includes(
        clientHandoff.handoffId,
      ),
      false,
    );

    /* =====================================================
       REAL CONCURRENT DOUBLE REDEMPTION
       ===================================================== */

    const redeemInput = {
      agreementId,

      partyId:
        clientAccess.partyId,

      handoffId:
        clientHandoff.handoffId,

      actor: {
        userId:
          creatorUserId,

        walletAddress:
          CLIENT_WALLET,
      },
    };

    const race =
      await Promise.allSettled([
        operationsA
          .redeemWalletBindingHandoff(
            redeemInput,
          ),

        operationsB
          .redeemWalletBindingHandoff(
            redeemInput,
          ),
      ]);

    const fulfilled =
      race.filter(
        (entry) =>
          entry.status ===
          "fulfilled",
      );

    const rejected =
      race.filter(
        (entry) =>
          entry.status ===
          "rejected",
      );

    assert.equal(
      fulfilled.length,
      1,
      "Exactly one concurrent redemption must succeed.",
    );

    assert.equal(
      rejected.length,
      1,
      "Exactly one concurrent redemption must fail closed.",
    );

    const success =
      fulfilled[0];

    assert.ok(
      success &&
      success.status ===
        "fulfilled",
    );

    assert.equal(
      success.value.partyId,
      clientAccess.partyId,
    );

    assert.equal(
      success.value
        .walletAddress,
      CLIENT_WALLET
        .toLowerCase(),
    );

    assert.equal(
      success.value
        .lifecycle
        .status,
      "ACCEPTED",
    );

    const failure =
      rejected[0];

    assert.ok(
      failure &&
      failure.status ===
        "rejected",
    );

    assert.ok(
      failure.reason instanceof
        AgreementConflictError,
    );

    /* =====================================================
       DATABASE STATE AFTER RACE
       ===================================================== */

    const clientPartyAfterRace =
      await prismaA
        .agreementParty
        .findUnique({
          where: {
            id:
              clientAccess.partyId,
          },
        });

    assert.ok(
      clientPartyAfterRace,
    );

    assert.equal(
      clientPartyAfterRace
        .walletAddress,
      CLIENT_WALLET
        .toLowerCase(),
    );

    const consumedClientHandoff =
      await prismaA
        .walletBindingHandoff
        .findUnique({
          where: {
            secretHash:
              clientSecretHash,
          },
        });

    assert.ok(
      consumedClientHandoff,
    );

    assert.ok(
      consumedClientHandoff
        .consumedAt instanceof Date,
    );

    const clientHandoffRows =
      await prismaA
        .walletBindingHandoff
        .count({
          where: {
            agreementId,

            partyId:
              clientAccess.partyId,
          },
        });

    assert.equal(
      clientHandoffRows,
      1,
    );

    /*
     * A completed race winner cannot be replayed later.
     */
    await assert.rejects(
      operationsA
        .redeemWalletBindingHandoff(
          redeemInput,
        ),

      AgreementConflictError,
    );

    /* =====================================================
       FAILED BIND MUST NOT CONSUME HANDOFF
       ===================================================== */

    const contractorHandoff =
      await operationsA
        .createWalletBindingHandoff({
          agreementId,

          partyId:
            contractorAccess.partyId,

          partyAccessToken:
            contractorAccess.accessToken,
        });

    const contractorSecretHash =
      hashHandoffSecret(
        contractorHandoff
          .handoffId,
      );

    /*
     * CLIENT already owns CLIENT_WALLET.
     * CONTRACTOR attempting to redeem using the same SIWE
     * wallet must fail the canonical different-wallet rule.
     */
    await assert.rejects(
      operationsA
        .redeemWalletBindingHandoff({
          agreementId,

          partyId:
            contractorAccess.partyId,

          handoffId:
            contractorHandoff
              .handoffId,

          actor: {
            userId:
              creatorUserId,

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    const contractorAfterFailedBind =
      await prismaA
        .agreementParty
        .findUnique({
          where: {
            id:
              contractorAccess.partyId,
          },
        });

    assert.ok(
      contractorAfterFailedBind,
    );

    assert.equal(
      contractorAfterFailedBind
        .walletAddress,
      null,
    );

    const handoffAfterFailedBind =
      await prismaA
        .walletBindingHandoff
        .findUnique({
          where: {
            secretHash:
              contractorSecretHash,
          },
        });

    assert.ok(
      handoffAfterFailedBind,
    );

    assert.equal(
      handoffAfterFailedBind
        .consumedAt,
      null,
      "Failed wallet binding must roll back handoff consumption.",
    );

    /* =====================================================
       SAME UNCONSUMED HANDOFF MAY THEN BIND CORRECT SIWE WALLET
       ===================================================== */

    const contractorBound =
      await operationsA
        .redeemWalletBindingHandoff({
          agreementId,

          partyId:
            contractorAccess.partyId,

          handoffId:
            contractorHandoff
              .handoffId,

          actor: {
            userId:
              creatorUserId,

            walletAddress:
              CONTRACTOR_WALLET,
          },
        });

    assert.equal(
      contractorBound
        .walletAddress,
      CONTRACTOR_WALLET
        .toLowerCase(),
    );

    assert.equal(
      contractorBound
        .lifecycle
        .status,
      "READY_TO_FUND",
    );

    assert.equal(
      contractorBound
        .lifecycle
        .walletBindingComplete,
      true,
    );

    const finalAgreement =
      await prismaA
        .agreement
        .findUnique({
          where: {
            id:
              agreementId,
          },

          include: {
            parties:
              true,

            walletBindingHandoffs:
              true,
          },
        });

    assert.ok(
      finalAgreement,
    );

    assert.equal(
      finalAgreement.status,
      "READY_TO_FUND",
    );

    assert.equal(
      finalAgreement
        .walletBindingHandoffs
        .length,
      2,
    );

    assert.ok(
      finalAgreement
        .walletBindingHandoffs
        .every(
          (handoff) =>
            handoff.consumedAt !==
            null,
        ),
    );

    assert.equal(
      finalAgreement
        .parties
        .find(
          (party) =>
            party.role ===
            "CLIENT",
        )
        ?.walletAddress,
      CLIENT_WALLET
        .toLowerCase(),
    );

    assert.equal(
      finalAgreement
        .parties
        .find(
          (party) =>
            party.role ===
            "CONTRACTOR",
        )
        ?.walletAddress,
      CONTRACTOR_WALLET
        .toLowerCase(),
    );
  },
);
