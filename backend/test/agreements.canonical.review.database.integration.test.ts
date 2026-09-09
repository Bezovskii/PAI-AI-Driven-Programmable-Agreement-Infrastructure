import assert from "node:assert/strict";

import {
  randomUUID,
} from "node:crypto";

import test from "node:test";

import type {
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

import {
  buildApp,
} from "../src/app.js";

import {
  createPrismaClient,
} from "../src/db/prisma.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

const TERMS:
  CanonicalAgreementTerms = {
    title:
      "Canonical review DB test",

    description:
      "Review the exact canonical agreement before acceptance.",

    totalValue:
      "1500",

    settlementAsset:
      "USDC",

    deadline:
      "2026-11-30T00:00:00.000Z",

    approvalWindow:
      "P3D",

    milestones: [
      {
        amount:
          "1500",

        deliverable:
          "Final implementation",

        acceptanceCriteria:
          "All agreed requirements are satisfied",

        deadline:
          "2026-11-30T00:00:00.000Z",
      },
    ],
  };

const OTHER_TERMS:
  CanonicalAgreementTerms = {
    ...TERMS,

    title:
      "Other agreement",

    description:
      "This agreement exists only to issue an unrelated credential.",
  };

const SERVICE_AUTHORIZATION =
  "Bearer telegram-service-review-test-token";

function stableDatabaseSnapshot(
  value: {
    readonly status:
      string;

    readonly termsVersion:
      number;

    readonly termsHash:
      string | null;

    readonly parties:
      readonly {
        readonly id:
          string;

        readonly role:
          string;

        readonly walletAddress:
          string | null;

        readonly accessCredentialHash:
          string | null;
      }[];

    readonly acceptances:
      readonly {
        readonly id:
          string;
      }[];

    readonly revisions:
      readonly {
        readonly id:
          string;

        readonly agreementVersion:
          number;

        readonly agreementHash:
          string;
      }[];
  },
) {
  return {
    status:
      value.status,

    termsVersion:
      value.termsVersion,

    termsHash:
      value.termsHash,

    parties:
      value.parties
        .map(
          (
            party,
          ) => ({
            id:
              party.id,

            role:
              party.role,

            walletAddress:
              party.walletAddress,

            accessCredentialHash:
              party
                .accessCredentialHash,
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.id.localeCompare(
              right.id,
            ),
        ),

    acceptanceIds:
      value.acceptances
        .map(
          (
            acceptance,
          ) =>
            acceptance.id,
        )
        .sort(),

    revisions:
      value.revisions
        .map(
          (
            revision,
          ) => ({
            id:
              revision.id,

            agreementVersion:
              revision
                .agreementVersion,

            agreementHash:
              revision
                .agreementHash,
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.agreementVersion -
            right.agreementVersion,
        ),
  };
}

test(
  "canonical review endpoint is party-token authenticated, pre-wallet, exact-revision, and read-only through PostgreSQL",
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

    const creatorUserId =
      `pai-review-db-creator-${runId}`;

    t.after(
      async () => {
        await prisma
          .agreement
          .deleteMany({
            where: {
              createdByUserId:
                creatorUserId,
            },
          });

        await prisma
          .user
          .deleteMany({
            where: {
              id:
                creatorUserId,
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
            creatorUserId,
        },
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const created =
      await operations
        .persistReviewedAgreement({
          actor: {
            userId:
              creatorUserId,
          },

          terms:
            TERMS,

          client: {
            displayName:
              "Database Client",
          },

          contractor: {
            displayName:
              "Database Contractor",
          },
        });

    const otherCreated =
      await operations
        .persistReviewedAgreement({
          actor: {
            userId:
              creatorUserId,
          },

          terms:
            OTHER_TERMS,

          client: {
            displayName:
              "Other Client",
          },

          contractor: {
            displayName:
              "Other Contractor",
          },
        });

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

    const otherAgreementAccess =
      otherCreated.partyAccess.find(
        (
          party,
        ) =>
          party.role ===
          "CLIENT",
      );

    assert.ok(
      clientAccess,
    );

    assert.ok(
      contractorAccess,
    );

    assert.ok(
      otherAgreementAccess,
    );

    const before =
      await prisma
        .agreement
        .findUnique({
          where: {
            id:
              agreementId,
          },

          include: {
            parties:
              true,

            acceptances:
              true,

            revisions:
              true,
          },
        });

    assert.ok(
      before,
    );

    assert.equal(
      before.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      before.acceptances.length,
      0,
    );

    assert.ok(
      before.parties.every(
        (
          party,
        ) =>
          party.walletAddress ===
          null,
      ),
    );

    const beforeSnapshot =
      stableDatabaseSnapshot(
        before,
      );

    let sessionResolverCalled =
      false;

    let serviceResolverCalled =
      false;

    const app =
      buildApp({
        logger:
          false,

        readinessProbe:
          async () =>
            true,

        agreements: {
          sessionCookieName:
            "pai_session",

          resolveSession:
            async () => {
              sessionResolverCalled =
                true;

              throw new Error(
                "Canonical review must not resolve SIWE.",
              );
            },

          resolveServicePrincipal:
            async () => {
              serviceResolverCalled =
                true;

              return {
                userId:
                  "service:telegram",
              };
            },

          operations,
        },
      });

    t.after(
      async () =>
        app.close(),
    );

    /* =====================================================
       CLIENT PRE-WALLET REVIEW
       ===================================================== */

    const clientResponse =
      await app.inject({
        method:
          "GET",

        url:
          `/api/v1/agreements/${agreementId}/review`,

        headers: {
          "x-pai-party-token":
            clientAccess
              .accessToken,
        },
      });

    assert.equal(
      clientResponse.statusCode,
      200,
    );

    const clientReview =
      clientResponse.json();

    assert.deepEqual(
      clientReview.reference,
      created.lifecycle
        .reference,
    );

    assert.deepEqual(
      clientReview.terms,
      TERMS,
    );

    assert.deepEqual(
      clientReview.party,
      {
        partyId:
          clientAccess.partyId,

        role:
          "CLIENT",

        displayName:
          "Database Client",

        acceptedCurrentVersion:
          false,
      },
    );

    assert.equal(
      clientReview.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      clientReview
        .acceptanceComplete,
      false,
    );

    assert.equal(
      "walletAddress" in
        clientReview.party,
      false,
    );

    /* =====================================================
       CONTRACTOR PRE-WALLET REVIEW
       ===================================================== */

    const contractorResponse =
      await app.inject({
        method:
          "GET",

        url:
          `/api/v1/agreements/${agreementId}/review`,

        headers: {
          "x-pai-party-token":
            contractorAccess
              .accessToken,
        },
      });

    assert.equal(
      contractorResponse
        .statusCode,
      200,
    );

    const contractorReview =
      contractorResponse.json();

    assert.equal(
      contractorReview.party.partyId,
      contractorAccess.partyId,
    );

    assert.equal(
      contractorReview.party.role,
      "CONTRACTOR",
    );

    assert.deepEqual(
      contractorReview.reference,
      created.lifecycle
        .reference,
    );

    assert.deepEqual(
      contractorReview.terms,
      TERMS,
    );

    /* =====================================================
       CROSS-AGREEMENT CREDENTIAL MUST FAIL
       ===================================================== */

    const crossAgreementResponse =
      await app.inject({
        method:
          "GET",

        url:
          `/api/v1/agreements/${agreementId}/review`,

        headers: {
          "x-pai-party-token":
            otherAgreementAccess
              .accessToken,
        },
      });

    assert.equal(
      crossAgreementResponse
        .statusCode,
      403,
    );

    assert.deepEqual(
      crossAgreementResponse
        .json(),
      {
        error:
          "agreement_action_forbidden",
      },
    );

    /* =====================================================
       MISSING CREDENTIAL MUST FAIL
       ===================================================== */

    const missingResponse =
      await app.inject({
        method:
          "GET",

        url:
          `/api/v1/agreements/${agreementId}/review`,
      });

    assert.equal(
      missingResponse.statusCode,
      403,
    );

    /* =====================================================
       SERVICE AUTH MUST NOT SUBSTITUTE
       ===================================================== */

    const serviceResponse =
      await app.inject({
        method:
          "GET",

        url:
          `/api/v1/agreements/${agreementId}/review`,

        headers: {
          authorization:
            SERVICE_AUTHORIZATION,
        },
      });

    assert.equal(
      serviceResponse.statusCode,
      403,
    );

    assert.equal(
      sessionResolverCalled,
      false,
    );

    assert.equal(
      serviceResolverCalled,
      false,
    );

    /* =====================================================
       READ MUST NOT MUTATE ACCEPTANCE/LIFECYCLE
       ===================================================== */

    const afterReads =
      await prisma
        .agreement
        .findUnique({
          where: {
            id:
              agreementId,
          },

          include: {
            parties:
              true,

            acceptances:
              true,

            revisions:
              true,
          },
        });

    assert.ok(
      afterReads,
    );

    assert.deepEqual(
      stableDatabaseSnapshot(
        afterReads,
      ),
      beforeSnapshot,
    );

    /* =====================================================
       REVISION HASH MISMATCH MUST FAIL CLOSED
       ===================================================== */

    const currentRevision =
      await prisma
        .agreementRevision
        .findUnique({
          where: {
            agreementId_agreementVersion:
              {
                agreementId,

                agreementVersion:
                  created.lifecycle
                    .reference
                    .agreementVersion,
              },
          },
        });

    assert.ok(
      currentRevision,
    );

    const originalRevisionHash =
      currentRevision
        .agreementHash;

    await prisma
      .agreementRevision
      .update({
        where: {
          id:
            currentRevision.id,
        },

        data: {
          agreementHash:
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      });

    const mismatchResponse =
      await app.inject({
        method:
          "GET",

        url:
          `/api/v1/agreements/${agreementId}/review`,

        headers: {
          "x-pai-party-token":
            clientAccess
              .accessToken,
        },
      });

    assert.equal(
      mismatchResponse.statusCode,
      409,
    );

    assert.deepEqual(
      mismatchResponse.json(),
      {
        error:
          "agreement_state_conflict",
      },
    );

    await prisma
      .agreementRevision
      .update({
        where: {
          id:
            currentRevision.id,
        },

        data: {
          agreementHash:
            originalRevisionHash,
        },
      });

    const restoredResponse =
      await app.inject({
        method:
          "GET",

        url:
          `/api/v1/agreements/${agreementId}/review`,

        headers: {
          "x-pai-party-token":
            clientAccess
              .accessToken,
        },
      });

    assert.equal(
      restoredResponse.statusCode,
      200,
    );
  },
);
