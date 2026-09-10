import assert from "node:assert/strict";
import {
  createHash,
} from "node:crypto";
import test from "node:test";

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
  "agreement-handoff-1";

const CLIENT_PARTY_ID =
  "party-client";

const CONTRACTOR_PARTY_ID =
  "party-contractor";

const CLIENT_TOKEN =
  "11".repeat(32);

const CONTRACTOR_TOKEN =
  "22".repeat(32);

const OTHER_AGREEMENT_TOKEN =
  "33".repeat(32);

const CANONICAL_TERMS = {
  title:
    "Canonical handoff agreement",

  description:
    "Test agreement for wallet-binding handoff creation.",

  totalValue:
    "1000",

  settlementAsset:
    "USDC",

  deadline:
    null,

  approvalWindow:
    null,

  milestones: [
    {
      amount:
        "1000",

      deliverable:
        "Deliver the agreed work.",

      acceptanceCriteria:
        "Client confirms delivery.",

      deadline:
        null,
    },
  ],
};

const AGREEMENT_HASH =
  computeCanonicalAgreementHash(
    CANONICAL_TERMS,
  );

function asPrismaClient(
  value:
    unknown,
): PrismaClient {
  return value as PrismaClient;
}

function sha256(
  value:
    string,
): string {
  return createHash("sha256")
    .update(
      value,
      "utf8",
    )
    .digest("hex");
}

function createFixture(
  options?: {
    readonly acceptedPartyIds?:
      readonly string[];

    readonly agreementHash?:
      string;

    readonly revisionHash?:
      string;

    readonly canonicalTerms?:
      typeof CANONICAL_TERMS;
  },
) {
  const acceptedPartyIds =
    new Set(
      options
        ?.acceptedPartyIds ??
      [
        CLIENT_PARTY_ID,
        CONTRACTOR_PARTY_ID,
      ],
    );

  const agreementHash =
    options
      ?.agreementHash ??
    AGREEMENT_HASH;

  const revisionHash =
    options
      ?.revisionHash ??
    agreementHash;

  const canonicalTerms =
    options
      ?.canonicalTerms ??
    CANONICAL_TERMS;

  const agreement = {
    id:
      AGREEMENT_ID,

    termsVersion:
      3,

    termsHash:
      agreementHash,

    parties: [
      {
        id:
          CLIENT_PARTY_ID,

        role:
          "CLIENT",

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

        accessCredentialHash:
          hashPartyAccessToken(
            CONTRACTOR_TOKEN,
          ),
      },
    ],
  };

  const persistedHandoffs:
    Array<any> = [];

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
        async () => ({
          ...agreement,

          parties:
            agreement.parties.map(
              (party) => ({
                ...party,
              }),
            ),
        }),
    },

    agreementRevision: {
      findUnique:
        async () => ({
          agreementHash:
            revisionHash,

          canonicalTerms,
        }),
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
    },

    walletBindingHandoff: {
      create:
        async (
          args:
            any,
        ) => {
          persistedHandoffs.push(
            structuredClone(
              args.data,
            ),
          );

          return {
            id:
              "handoff-row-1",

            ...args.data,

            consumedAt:
              null,

            createdAt:
              new Date(),
          };
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
    persistedHandoffs,

    operations:
      createPrismaAgreementOperations(
        prisma,
      ),
  };
}

test(
  "valid CLIENT party token creates exact-tuple one-time handoff material",
  async () => {
    const fixture =
      createFixture();

    const before =
      Date.now();

    const result =
      await fixture.operations
        .createWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        });

    const after =
      Date.now();

    assert.match(
      result.handoffId,
      /^[A-Za-z0-9_-]{43}$/,
    );

    assert.equal(
      fixture.persistedHandoffs.length,
      1,
    );

    const persisted =
      fixture.persistedHandoffs[0];

    assert.equal(
      persisted.agreementId,
      AGREEMENT_ID,
    );

    assert.equal(
      persisted.agreementVersion,
      3,
    );

    assert.equal(
      persisted.agreementHash,
      AGREEMENT_HASH,
    );

    assert.equal(
      persisted.partyId,
      CLIENT_PARTY_ID,
    );

    assert.equal(
      persisted.role,
      "CLIENT",
    );

    assert.equal(
      persisted.secretHash,
      sha256(
        result.handoffId,
      ),
    );

    assert.notEqual(
      persisted.secretHash,
      result.handoffId,
    );

    const expiresAtMs =
      Date.parse(
        result.expiresAt,
      );

    assert.ok(
      expiresAtMs >=
        before +
          5 * 60 * 1000,
    );

    assert.ok(
      expiresAtMs <=
        after +
          5 * 60 * 1000,
    );

    assert.equal(
      JSON.stringify(
        persisted,
      ).includes(
        result.handoffId,
      ),
      false,
    );
  },
);

test(
  "valid CONTRACTOR party token creates handoff bound to CONTRACTOR",
  async () => {
    const fixture =
      createFixture();

    const result =
      await fixture.operations
        .createWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CONTRACTOR_PARTY_ID,

          partyAccessToken:
            CONTRACTOR_TOKEN,
        });

    assert.match(
      result.handoffId,
      /^[A-Za-z0-9_-]{43}$/,
    );

    assert.equal(
      fixture.persistedHandoffs.length,
      1,
    );

    assert.equal(
      fixture.persistedHandoffs[0]
        .partyId,
      CONTRACTOR_PARTY_ID,
    );

    assert.equal(
      fixture.persistedHandoffs[0]
        .role,
      "CONTRACTOR",
    );
  },
);

test(
  "invalid party token cannot create wallet-binding handoff",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .createWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            "ff".repeat(32),
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.persistedHandoffs.length,
      0,
    );
  },
);

test(
  "party credential from another agreement cannot create target handoff",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .createWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            OTHER_AGREEMENT_TOKEN,
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.persistedHandoffs.length,
      0,
    );
  },
);

test(
  "valid credential cannot create handoff for the wrong party route",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .createWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CONTRACTOR_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.persistedHandoffs.length,
      0,
    );
  },
);

test(
  "handoff creation is rejected before both current acceptances exist",
  async () => {
    const fixture =
      createFixture({
        acceptedPartyIds: [
          CLIENT_PARTY_ID,
        ],
      });

    await assert.rejects(
      fixture.operations
        .createWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.persistedHandoffs.length,
      0,
    );
  },
);

test(
  "handoff creation fails closed when current revision hash does not match agreement",
  async () => {
    const fixture =
      createFixture({
        revisionHash:
          "0x" +
          "aa".repeat(32),
      });

    await assert.rejects(
      fixture.operations
        .createWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.persistedHandoffs.length,
      0,
    );
  },
);

test(
  "handoff creation fails closed when persisted canonical terms do not hash to current tuple",
  async () => {
    const fixture =
      createFixture({
        canonicalTerms: {
          ...CANONICAL_TERMS,

          description:
            "Tampered canonical terms.",
        },
      });

    await assert.rejects(
      fixture.operations
        .createWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.persistedHandoffs.length,
      0,
    );
  },
);
