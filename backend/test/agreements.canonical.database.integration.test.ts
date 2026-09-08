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
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const CONTRACTOR_WALLET =
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

const ORIGINAL_TERMS:
  CanonicalAgreementTerms = {
    title:
      "Research brief",

    description:
      "Prepare a competitor research brief.",

    totalValue:
      "1000",

    settlementAsset:
      "USDC",

    deadline:
      "2026-12-10T00:00:00.000Z",

    approvalWindow:
      "P3D",

    milestones: [
      {
        amount:
          "1000",

        deliverable:
          "Final research brief",

        acceptanceCriteria:
          "Covers five competitors",

        deadline:
          "2026-12-10T00:00:00.000Z",
      },
    ],
  };

const REVISED_TERMS:
  CanonicalAgreementTerms = {
    ...ORIGINAL_TERMS,

    description:
      "Prepare an expanded competitor research brief.",

    milestones: [
      {
        ...ORIGINAL_TERMS
          .milestones[0]!,

        acceptanceCriteria:
          "Covers seven competitors",
      },
    ],
  };

function hashCredential(
  token:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest(
      "hex",
    );
}

test(
  "canonical agreement acceptance lifecycle persists end-to-end through PostgreSQL",
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
      `pai-canonical-db-client-${runId}`;

    const contractorUserId =
      `pai-canonical-db-contractor-${runId}`;

    t.after(
      async () => {
        await prisma
          .agreement
          .deleteMany({
            where: {
              createdByUserId:
                clientUserId,
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
       REVIEWED AGREEMENT / IMMUTABLE V1
       ===================================================== */

    const created =
      await operations
        .persistReviewedAgreement({
          actor:
            clientActor,

          terms:
            ORIGINAL_TERMS,

          client: {
            displayName:
              "Canonical Client",
          },

          contractor: {
            displayName:
              "Canonical Contractor",
          },
        });

    assert.equal(
      created.lifecycle.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      created.lifecycle
        .reference
        .agreementVersion,
      1,
    );

    assert.match(
      created.lifecycle
        .reference
        .agreementHash,
      /^0x[a-f0-9]{64}$/,
    );

    const agreementId =
      created.lifecycle
        .reference
        .agreementId;

    const clientAccess =
      created.partyAccess.find(
        (
          party,
        ) =>
          party.role ===
          "CLIENT",
      );

    const contractorAccess =
      created.partyAccess.find(
        (
          party,
        ) =>
          party.role ===
          "CONTRACTOR",
      );

    assert.ok(
      clientAccess,
    );

    assert.ok(
      contractorAccess,
    );

    assert.notEqual(
      clientAccess.accessToken,
      contractorAccess.accessToken,
    );

    assert.match(
      clientAccess.accessToken,
      /^[a-f0-9]{64}$/,
    );

    assert.match(
      contractorAccess.accessToken,
      /^[a-f0-9]{64}$/,
    );

    const persistedV1 =
      await prisma
        .agreement
        .findUnique({
          where: {
            id:
              agreementId,
          },

          include: {
            revisions: {
              orderBy: {
                agreementVersion:
                  "asc",
              },
            },

            parties:
              true,

            acceptances:
              true,
          },
        });

    assert.ok(
      persistedV1,
    );

    assert.equal(
      persistedV1.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      persistedV1.termsVersion,
      1,
    );

    assert.equal(
      persistedV1.termsHash,
      created.lifecycle
        .reference
        .agreementHash,
    );

    assert.equal(
      persistedV1.revisions.length,
      1,
    );

    assert.equal(
      persistedV1
        .revisions[0]
        ?.agreementVersion,
      1,
    );

    assert.equal(
      persistedV1
        .revisions[0]
        ?.agreementHash,
      created.lifecycle
        .reference
        .agreementHash,
    );

    assert.equal(
      persistedV1
        .acceptances
        .length,
      0,
    );

    const clientParty =
      persistedV1.parties.find(
        (
          party,
        ) =>
          party.role ===
          "CLIENT",
      );

    const contractorParty =
      persistedV1.parties.find(
        (
          party,
        ) =>
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
      null,
    );

    assert.equal(
      contractorParty.walletAddress,
      null,
    );

    assert.equal(
      clientParty
        .accessCredentialHash,
      hashCredential(
        clientAccess.accessToken,
      ),
    );

    assert.equal(
      contractorParty
        .accessCredentialHash,
      hashCredential(
        contractorAccess.accessToken,
      ),
    );

    assert.notEqual(
      clientParty
        .accessCredentialHash,
      clientAccess.accessToken,
    );

    assert.notEqual(
      contractorParty
        .accessCredentialHash,
      contractorAccess.accessToken,
    );

    /* =====================================================
       EXACT-TUPLE DUAL ACCEPTANCE V1
       ===================================================== */

    const referenceV1 =
      created.lifecycle
        .reference;

    const clientAcceptedV1 =
      await operations
        .acceptAgreementVersion({
          agreementId:
            agreementId,

          agreementVersion:
            referenceV1
              .agreementVersion,

          agreementHash:
            referenceV1
              .agreementHash,

          partyId:
            clientAccess.partyId,

          partyAccessToken:
            clientAccess.accessToken,
        });

    assert.equal(
      clientAcceptedV1
        .lifecycle
        .status,
      "AWAITING_ACCEPTANCE",
    );

    const contractorAcceptedV1 =
      await operations
        .acceptAgreementVersion({
          agreementId:
            agreementId,

          agreementVersion:
            referenceV1
              .agreementVersion,

          agreementHash:
            referenceV1
              .agreementHash,

          partyId:
            contractorAccess.partyId,

          partyAccessToken:
            contractorAccess.accessToken,
        });

    assert.equal(
      contractorAcceptedV1
        .lifecycle
        .status,
      "ACCEPTED",
    );

    /* =====================================================
       IMMUTABLE REVISION V2
       ===================================================== */

    const revised =
      await operations
        .reviseCanonicalAgreement({
          expected:
            referenceV1,

          terms:
            REVISED_TERMS,

          actor:
            clientActor,
        });

    assert.equal(
      revised.previous
        .agreementVersion,
      1,
    );

    assert.equal(
      revised.current
        .agreementVersion,
      2,
    );

    assert.notEqual(
      revised.current
        .agreementHash,
      revised.previous
        .agreementHash,
    );

    assert.equal(
      revised.lifecycle.status,
      "AWAITING_ACCEPTANCE",
    );

    const persistedV2 =
      await prisma
        .agreement
        .findUnique({
          where: {
            id:
              agreementId,
          },

          include: {
            revisions: {
              orderBy: {
                agreementVersion:
                  "asc",
              },
            },

            acceptances: {
              orderBy: [
                {
                  termsVersion:
                    "asc",
                },
                {
                  acceptedAt:
                    "asc",
                },
              ],
            },
          },
        });

    assert.ok(
      persistedV2,
    );

    assert.equal(
      persistedV2
        .termsVersion,
      2,
    );

    assert.equal(
      persistedV2.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      persistedV2
        .revisions
        .length,
      2,
    );

    assert.deepEqual(
      persistedV2
        .revisions
        .map(
          (
            revision,
          ) =>
            revision
              .agreementVersion,
        ),
      [
        1,
        2,
      ],
    );

    assert.equal(
      persistedV2
        .acceptances
        .length,
      2,
    );

    const historyAfterRevision =
      await operations
        .listCanonicalAgreementAcceptances({
          agreementId:
            agreementId,
        });

    assert.equal(
      historyAfterRevision.length,
      2,
    );

    assert.ok(
      historyAfterRevision.every(
        (
          acceptance,
        ) =>
          acceptance
            .agreementVersion ===
            1 &&
          acceptance.current ===
            false,
      ),
    );

    /* =====================================================
       DUAL RE-ACCEPTANCE V2
       ===================================================== */

    await operations
      .acceptAgreementVersion({
        agreementId:
          agreementId,

        agreementVersion:
          revised.current
            .agreementVersion,

        agreementHash:
          revised.current
            .agreementHash,

        partyId:
          clientAccess.partyId,

        partyAccessToken:
          clientAccess.accessToken,
      });

    const acceptedV2 =
      await operations
        .acceptAgreementVersion({
          agreementId:
            agreementId,

          agreementVersion:
            revised.current
              .agreementVersion,

          agreementHash:
            revised.current
              .agreementHash,

          partyId:
            contractorAccess.partyId,

          partyAccessToken:
            contractorAccess.accessToken,
        });

    assert.equal(
      acceptedV2
        .lifecycle
        .status,
      "ACCEPTED",
    );

    /* =====================================================
       WALLET BINDING
       ===================================================== */

    const clientBound =
      await operations
        .bindAgreementPartyWallet({
          agreementId:
            agreementId,

          partyId:
            clientAccess.partyId,

          partyAccessToken:
            clientAccess.accessToken,

          actor:
            clientActor,
        });

    assert.equal(
      clientBound
        .walletAddress,
      CLIENT_WALLET
        .toLowerCase(),
    );

    assert.equal(
      clientBound
        .lifecycle
        .status,
      "ACCEPTED",
    );

    const contractorBound =
      await operations
        .bindAgreementPartyWallet({
          agreementId:
            agreementId,

          partyId:
            contractorAccess.partyId,

          partyAccessToken:
            contractorAccess.accessToken,

          actor:
            contractorActor,
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

    const finalLifecycle =
      await operations
        .getCanonicalAgreementLifecycle({
          agreementId:
            agreementId,
        });

    assert.equal(
      finalLifecycle.status,
      "READY_TO_FUND",
    );

    assert.equal(
      finalLifecycle
        .acceptanceComplete,
      true,
    );

    assert.equal(
      finalLifecycle
        .walletBindingComplete,
      true,
    );

    /* =====================================================
       HISTORICAL ACCEPTANCE QUERYABILITY
       ===================================================== */

    const finalHistory =
      await operations
        .listCanonicalAgreementAcceptances({
          agreementId:
            agreementId,
        });

    assert.equal(
      finalHistory.length,
      4,
    );

    const v1History =
      finalHistory.filter(
        (
          acceptance,
        ) =>
          acceptance
            .agreementVersion ===
            1,
      );

    const v2History =
      finalHistory.filter(
        (
          acceptance,
        ) =>
          acceptance
            .agreementVersion ===
            2,
      );

    assert.equal(
      v1History.length,
      2,
    );

    assert.equal(
      v2History.length,
      2,
    );

    assert.ok(
      v1History.every(
        (
          acceptance,
        ) =>
          acceptance.current ===
          false,
      ),
    );

    assert.ok(
      v2History.every(
        (
          acceptance,
        ) =>
          acceptance.current ===
          true,
      ),
    );

    const finalPersisted =
      await prisma
        .agreement
        .findUnique({
          where: {
            id:
              agreementId,
          },

          include: {
            revisions:
              true,

            acceptances:
              true,

            parties:
              true,
          },
        });

    assert.ok(
      finalPersisted,
    );

    assert.equal(
      finalPersisted.status,
      "READY_TO_FUND",
    );

    assert.equal(
      finalPersisted
        .termsVersion,
      2,
    );

    assert.equal(
      finalPersisted
        .revisions
        .length,
      2,
    );

    assert.equal(
      finalPersisted
        .acceptances
        .length,
      4,
    );

    assert.equal(
      finalPersisted
        .parties
        .find(
          (
            party,
          ) =>
            party.role ===
            "CLIENT",
        )
        ?.walletAddress,
      CLIENT_WALLET
        .toLowerCase(),
    );

    assert.equal(
      finalPersisted
        .parties
        .find(
          (
            party,
          ) =>
            party.role ===
            "CONTRACTOR",
        )
        ?.walletAddress,
      CONTRACTOR_WALLET
        .toLowerCase(),
    );

    /* =====================================================
       READY_TO_FUND IS REVISION-IMMUTABLE
       ===================================================== */

    await assert.rejects(
      () =>
        operations
          .reviseCanonicalAgreement({
            expected:
              revised.current,

            terms: {
              ...REVISED_TERMS,

              description:
                "This revision must be rejected.",
            },

            actor:
              clientActor,
          }),

      AgreementConflictError,
    );
  },
);