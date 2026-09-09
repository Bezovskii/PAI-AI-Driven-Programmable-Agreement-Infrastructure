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
  hashPartyAccessToken,
} from "../src/agreements/canonical.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

const AGREEMENT_ID =
  "agreement-review-1";

const CLIENT_PARTY_ID =
  "party-client";

const CONTRACTOR_PARTY_ID =
  "party-contractor";

const CLIENT_TOKEN =
  "11".repeat(32);

const CONTRACTOR_TOKEN =
  "22".repeat(32);

const WRONG_TOKEN =
  "33".repeat(32);

/**
 * Represents a valid credential issued for some other
 * agreement. It must never authorize this agreement.
 */
const OTHER_AGREEMENT_TOKEN =
  "44".repeat(32);

const TERMS:
  CanonicalAgreementTerms = {
    title:
      "Research brief",

    description:
      "Prepare a competitive research brief.",

    totalValue:
      "1000",

    settlementAsset:
      "USDC",

    deadline:
      "2026-10-31",

    approvalWindow:
      "3 days",

    milestones: [
      {
        amount:
          "1000",

        deliverable:
          "Research brief",

        acceptanceCriteria:
          "Coverage of five competitors",

        deadline:
          "2026-10-31",
      },
    ],
  };

const AGREEMENT_HASH =
  computeCanonicalAgreementHash(
    TERMS,
  );

function asPrismaClient(
  value:
    unknown,
): PrismaClient {
  return value as PrismaClient;
}

function createFixture(
  options?: {
    readonly acceptedPartyIds?:
      readonly string[];

    readonly revisionExists?:
      boolean;

    readonly revisionHash?:
      string;

    readonly revisionTerms?:
      CanonicalAgreementTerms;

    readonly clientWalletAddress?:
      string | null;

    readonly contractorWalletAddress?:
      string | null;
  },
) {
  const acceptedPartyIds =
    new Set(
      options
        ?.acceptedPartyIds ??
      [],
    );

  const agreement = {
    id:
      AGREEMENT_ID,

    termsVersion:
      1,

    termsHash:
      AGREEMENT_HASH,

    parties: [
      {
        id:
          CLIENT_PARTY_ID,

        role:
          "CLIENT",

        displayName:
          "Amir",

        walletAddress:
          options
            ?.clientWalletAddress ??
          null,

        accessCredentialHash:
          hashPartyAccessToken(
            CLIENT_TOKEN,
          ),
      },

      {
        id:
          CONTRACTOR_PARTY_ID,

        role:
          "CONTRACTOR",

        displayName:
          "Mina",

        walletAddress:
          options
            ?.contractorWalletAddress ??
          null,

        accessCredentialHash:
          hashPartyAccessToken(
            CONTRACTOR_TOKEN,
          ),
      },
    ],
  };

  let mutationCount =
    0;

  const mutation =
    async () => {
      mutationCount++;

      throw new Error(
        "canonical review must remain read-only",
      );
    };

  const transaction = {
    $queryRaw:
      async () => [
        {
          id:
            AGREEMENT_ID,
        },
      ],

    agreement: {
      findUnique:
        async (
          args:
            any,
        ) => {
          if (
            args.where.id !==
            AGREEMENT_ID
          ) {
            return null;
          }

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

      update:
        mutation,

      updateMany:
        mutation,
    },

    agreementRevision: {
      findUnique:
        async (
          args:
            any,
        ) => {
          if (
            options
              ?.revisionExists ===
              false
          ) {
            return null;
          }

          const key =
            args.where
              .agreementId_agreementVersion;

          if (
            key.agreementId !==
              AGREEMENT_ID ||
            key.agreementVersion !==
              1
          ) {
            return null;
          }

          return {
            agreementHash:
              options
                ?.revisionHash ??
              AGREEMENT_HASH,

            canonicalTerms:
              options
                ?.revisionTerms ??
              TERMS,
          };
        },

      create:
        mutation,
    },

    agreementAcceptance: {
      findMany:
        async () =>
          Array.from(
            acceptedPartyIds,
          ).map(
            (partyId) => ({
              partyId,
            }),
          ),

      create:
        mutation,

      upsert:
        mutation,
    },

    agreementParty: {
      update:
        mutation,

      updateMany:
        mutation,
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
    get mutationCount() {
      return mutationCount;
    },

    operations:
      createPrismaAgreementOperations(
        prisma,
      ),
  };
}

test(
  "CLIENT credential reads exact current canonical terms before wallet binding",
  async () => {
    const fixture =
      createFixture();

    const result =
      await fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        });

    assert.deepEqual(
      result.reference,
      {
        agreementId:
          AGREEMENT_ID,

        agreementVersion:
          1,

        agreementHash:
          AGREEMENT_HASH,
      },
    );

    assert.deepEqual(
      result.terms,
      TERMS,
    );

    assert.deepEqual(
      result.party,
      {
        partyId:
          CLIENT_PARTY_ID,

        role:
          "CLIENT",

        displayName:
          "Amir",

        acceptedCurrentVersion:
          false,
      },
    );

    assert.equal(
      result.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      result.acceptanceComplete,
      false,
    );

    assert.equal(
      "walletAddress" in result.party,
      false,
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);

test(
  "CONTRACTOR credential reads exact current canonical terms before wallet binding",
  async () => {
    const fixture =
      createFixture();

    const result =
      await fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            CONTRACTOR_TOKEN,
        });

    assert.equal(
      result.party.partyId,
      CONTRACTOR_PARTY_ID,
    );

    assert.equal(
      result.party.role,
      "CONTRACTOR",
    );

    assert.equal(
      result.party.displayName,
      "Mina",
    );

    assert.deepEqual(
      result.terms,
      TERMS,
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);

test(
  "wrong credential cannot read canonical agreement review",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            WRONG_TOKEN,
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);

test(
  "credential issued for another agreement cannot read this canonical agreement",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            OTHER_AGREEMENT_TOKEN,
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);

test(
  "missing party credential is rejected",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            "",
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);

test(
  "canonical review fails closed when current revision hash mismatches agreement hash",
  async () => {
    const fixture =
      createFixture({
        revisionHash:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      });

    await assert.rejects(
      fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);

test(
  "canonical review fails closed when stored revision terms do not hash to current hash",
  async () => {
    const fixture =
      createFixture({
        revisionTerms: {
          ...TERMS,

          description:
            "Tampered canonical terms.",
        },
      });

    await assert.rejects(
      fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);

test(
  "canonical review reports only current tuple acceptance state without mutation",
  async () => {
    const fixture =
      createFixture({
        acceptedPartyIds: [
          CLIENT_PARTY_ID,
        ],
      });

    const result =
      await fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        });

    assert.equal(
      result.party
        .acceptedCurrentVersion,
      true,
    );

    assert.equal(
      result.acceptanceComplete,
      false,
    );

    assert.equal(
      result.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);

test(
  "canonical review reports ACCEPTED when both parties accepted current tuple without requiring wallets",
  async () => {
    const fixture =
      createFixture({
        acceptedPartyIds: [
          CLIENT_PARTY_ID,
          CONTRACTOR_PARTY_ID,
        ],

        clientWalletAddress:
          null,

        contractorWalletAddress:
          null,
      });

    const result =
      await fixture.operations
        .getCanonicalAgreementReview({
          agreementId:
            AGREEMENT_ID,

          partyAccessToken:
            CONTRACTOR_TOKEN,
        });

    assert.equal(
      result.party
        .acceptedCurrentVersion,
      true,
    );

    assert.equal(
      result.acceptanceComplete,
      true,
    );

    assert.equal(
      result.status,
      "ACCEPTED",
    );

    assert.equal(
      fixture.mutationCount,
      0,
    );
  },
);
