import assert from "node:assert/strict";
import test from "node:test";

import type {
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

import type {
  PrismaClient,
} from "../src/generated/prisma/client.js";

import {
  AgreementAccessError,
  AgreementConflictError,
} from "../src/agreements/routes.js";

import {
  computeCanonicalAgreementHash,
  serializeCanonicalAgreementTerms,
} from "../src/agreements/canonical.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

const AGREEMENT_ID =
  "agreement-reviewed-1";

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

const ORIGINAL_HASH =
  computeCanonicalAgreementHash(
    ORIGINAL_TERMS,
  );

const REVISED_HASH =
  computeCanonicalAgreementHash(
    REVISED_TERMS,
  );

function asPrismaClient(
  value:
    unknown,
): PrismaClient {
  return value as PrismaClient;
}

function createFixture(
  options?: {
    readonly status?:
      "ACCEPTED" |
      "READY_TO_FUND";

    readonly createdByUserId?:
      string;

    readonly clientWalletAddress?:
      string | null;
  },
) {
  const agreement = {
    id:
      AGREEMENT_ID,

    createdByUserId:
      options
        ?.createdByUserId ??
      "user-client",

    status:
      options?.status ??
      "ACCEPTED",

    termsVersion:
      1,

    termsHash:
      ORIGINAL_HASH,

    title:
      ORIGINAL_TERMS.title,

    parties: [
      {
        id:
          "party-client",

        role:
          "CLIENT",

        displayName:
          "Amir",

        walletAddress:
          options
            ?.clientWalletAddress ??
          null,
      },

      {
        id:
          "party-contractor",

        role:
          "CONTRACTOR",

        displayName:
          "Mina",

        walletAddress:
          null,
      },
    ],
  };

  const revisions = [
    {
      agreementId:
        AGREEMENT_ID,

      agreementVersion:
        1,

      agreementHash:
        ORIGINAL_HASH,

      canonicalTerms:
        JSON.parse(
          serializeCanonicalAgreementTerms(
            ORIGINAL_TERMS,
          ),
        ),
    },
  ];

  const historicalAcceptances = [
    {
      partyId:
        "party-client",

      termsVersion:
        1,

      termsHash:
        ORIGINAL_HASH,
    },

    {
      partyId:
        "party-contractor",

      termsVersion:
        1,

      termsHash:
        ORIGINAL_HASH,
    },
  ];

  const operationOrder:
    string[] = [];

  const transaction = {
    $queryRaw:
      async () => {
        operationOrder.push(
          "lock",
        );

        return [
          {
            id:
              AGREEMENT_ID,
          },
        ];
      },

    agreement: {
      findUnique:
        async () => {
          operationOrder.push(
            "find",
          );

          return {
            ...agreement,

            parties:
              agreement.parties.map(
                (party) => ({
                  ...party,
                }),
              ),
          };
        },

      updateMany:
        async (
          args:
            any,
        ) => {
          if (
            args.where.id !==
              agreement.id ||
            args.where
              .termsVersion !==
              agreement.termsVersion ||
            args.where
              .termsHash !==
              agreement.termsHash
          ) {
            return {
              count:
                0,
            };
          }

          agreement.title =
            args.data.title;

          agreement.termsVersion =
            args.data
              .termsVersion;

          agreement.termsHash =
            args.data.termsHash;

          agreement.status =
            args.data.status;

          return {
            count:
              1,
          };
        },
    },

    agreementRevision: {
      findUnique:
        async (
          args:
            any,
        ) => {
          const key =
            args.where
              .agreementId_agreementVersion;

          const found =
            revisions.find(
              (revision) =>
                revision
                  .agreementId ===
                  key.agreementId &&
                revision
                  .agreementVersion ===
                  key.agreementVersion,
            );

          if (!found) {
            return null;
          }

          return {
            agreementHash:
              found
                .agreementHash,
          };
        },

      create:
        async (
          args:
            any,
        ) => {
          revisions.push({
            agreementId:
              args.data
                .agreementId,

            agreementVersion:
              args.data
                .agreementVersion,

            agreementHash:
              args.data
                .agreementHash,

            canonicalTerms:
              args.data
                .canonicalTerms,
          });

          return revisions[
            revisions.length -
              1
          ];
        },
    },
  };

  const prisma =
    asPrismaClient({
      $transaction:
        async (
          work:
            (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
        ) =>
          work(
            transaction,
          ),
    });

  return {
    agreement,
    revisions,
    historicalAcceptances,
    operationOrder,

    operations:
      createPrismaAgreementOperations(
        prisma,
      ),
  };
}

test(
  "canonical revision locks current tuple, creates immutable version+1, and preserves historical acceptance",
  async () => {
    const fixture =
      createFixture({
        clientWalletAddress:
          "0x1111111111111111111111111111111111111111",
      });

    const result =
      await fixture.operations
        .reviseCanonicalAgreement({
          actor: {
            userId:
              "user-client",

            walletAddress:
              "0x1111111111111111111111111111111111111111",
          },

          expected: {
            agreementId:
              AGREEMENT_ID,

            agreementVersion:
              1,

            agreementHash:
              ORIGINAL_HASH,
          },

          terms:
            REVISED_TERMS,
        });

    assert.deepEqual(
      fixture.operationOrder
        .slice(0, 2),
      [
        "lock",
        "find",
      ],
    );

    assert.deepEqual(
      result.previous,
      {
        agreementId:
          AGREEMENT_ID,

        agreementVersion:
          1,

        agreementHash:
          ORIGINAL_HASH,
      },
    );

    assert.deepEqual(
      result.current,
      {
        agreementId:
          AGREEMENT_ID,

        agreementVersion:
          2,

        agreementHash:
          REVISED_HASH,
      },
    );

    assert.equal(
      fixture.revisions.length,
      2,
    );

    assert.deepEqual(
      fixture.revisions[1],
      {
        agreementId:
          AGREEMENT_ID,

        agreementVersion:
          2,

        agreementHash:
          REVISED_HASH,

        canonicalTerms:
          JSON.parse(
            serializeCanonicalAgreementTerms(
              REVISED_TERMS,
            ),
          ),
      },
    );

    assert.equal(
      fixture
        .historicalAcceptances
        .length,
      2,
    );

    assert.deepEqual(
      fixture
        .historicalAcceptances
        .map(
          (entry) =>
            entry.termsVersion,
        ),
      [
        1,
        1,
      ],
    );

    assert.equal(
      fixture.agreement
        .termsVersion,
      2,
    );

    assert.equal(
      fixture.agreement
        .termsHash,
      REVISED_HASH,
    );

    assert.equal(
      fixture.agreement.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      result.lifecycle.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      result.lifecycle
        .acceptanceComplete,
      false,
    );

    assert.equal(
      result.lifecycle
        .parties[0]
        ?.acceptedCurrentVersion,
      false,
    );

    assert.equal(
      result.lifecycle
        .parties[1]
        ?.acceptedCurrentVersion,
      false,
    );

    assert.equal(
      result.lifecycle
        .parties[0]
        ?.walletBound,
      true,
    );
  },
);

test(
  "canonical revision rejects stale expected version",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .reviseCanonicalAgreement({
          actor: {
            userId:
              "user-client",

            walletAddress:
              "0x1111111111111111111111111111111111111111",
          },

          expected: {
            agreementId:
              AGREEMENT_ID,

            agreementVersion:
              2,

            agreementHash:
              ORIGINAL_HASH,
          },

          terms:
            REVISED_TERMS,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.revisions.length,
      1,
    );
  },
);

test(
  "canonical revision rejects stale expected hash",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .reviseCanonicalAgreement({
          actor: {
            userId:
              "user-client",

            walletAddress:
              "0x1111111111111111111111111111111111111111",
          },

          expected: {
            agreementId:
              AGREEMENT_ID,

            agreementVersion:
              1,

            agreementHash:
              "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          },

          terms:
            REVISED_TERMS,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.revisions.length,
      1,
    );
  },
);

test(
  "READY_TO_FUND canonical agreement cannot be revised",
  async () => {
    const fixture =
      createFixture({
        status:
          "READY_TO_FUND",
      });

    await assert.rejects(
      fixture.operations
        .reviseCanonicalAgreement({
          actor: {
            userId:
              "user-client",

            walletAddress:
              "0x1111111111111111111111111111111111111111",
          },

          expected: {
            agreementId:
              AGREEMENT_ID,

            agreementVersion:
              1,

            agreementHash:
              ORIGINAL_HASH,
          },

          terms:
            REVISED_TERMS,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.revisions.length,
      1,
    );

    assert.equal(
      fixture.agreement
        .termsVersion,
      1,
    );
  },
);

test(
  "non-creator authenticated session cannot revise canonical agreement",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .reviseCanonicalAgreement({
          actor: {
            userId:
              "different-user",

            walletAddress:
              "0x2222222222222222222222222222222222222222",
          },

          expected: {
            agreementId:
              AGREEMENT_ID,

            agreementVersion:
              1,

            agreementHash:
              ORIGINAL_HASH,
          },

          terms:
            REVISED_TERMS,
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.revisions.length,
      1,
    );
  },
);