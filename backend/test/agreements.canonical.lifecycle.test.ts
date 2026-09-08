import assert from "node:assert/strict";
import test from "node:test";

import type {
  PrismaClient,
} from "../src/generated/prisma/client.js";

import {
  AgreementConflictError,
} from "../src/agreements/routes.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

const AGREEMENT_ID =
  "agreement-reviewed-1";

const HASH_V1 =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const HASH_V2 =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const CLIENT_PARTY_ID =
  "party-client";

const CONTRACTOR_PARTY_ID =
  "party-contractor";

const CLIENT_WALLET =
  "0x1111111111111111111111111111111111111111";

const CONTRACTOR_WALLET =
  "0x2222222222222222222222222222222222222222";

function asPrismaClient(
  value:
    unknown,
): PrismaClient {
  return value as PrismaClient;
}

function createFixture(
  options?: {
    readonly version?:
      number;

    readonly hash?:
      string;

    readonly clientAccepted?:
      boolean;

    readonly contractorAccepted?:
      boolean;

    readonly clientWalletAddress?:
      string | null;

    readonly contractorWalletAddress?:
      string | null;

    readonly currentRevisionExists?:
      boolean;
  },
) {
  const version =
    options?.version ??
    1;

  const hash =
    options?.hash ??
    HASH_V1;

  const agreement = {
    id:
      AGREEMENT_ID,

    status:
      "AWAITING_ACCEPTANCE",

    termsVersion:
      version,

    termsHash:
      hash,

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
      },
    ],
  };

  const currentAcceptances:
    Array<{
      partyId:
        string;
    }> = [];

  if (
    options
      ?.clientAccepted
  ) {
    currentAcceptances.push({
      partyId:
        CLIENT_PARTY_ID,
    });
  }

  if (
    options
      ?.contractorAccepted
  ) {
    currentAcceptances.push({
      partyId:
        CONTRACTOR_PARTY_ID,
    });
  }

  const historicalAcceptances = [
    {
      partyId:
        CLIENT_PARTY_ID,

      termsVersion:
        1,

      termsHash:
        HASH_V1,

      acceptedAt:
        new Date(
          "2026-09-07T10:00:00.000Z",
        ),

      party: {
        role:
          "CLIENT",
      },
    },

    {
      partyId:
        CONTRACTOR_PARTY_ID,

      termsVersion:
        1,

      termsHash:
        HASH_V1,

      acceptedAt:
        new Date(
          "2026-09-07T10:01:00.000Z",
        ),

      party: {
        role:
          "CONTRACTOR",
      },
    },
  ];

  if (
    version ===
    2 &&
    options
      ?.clientAccepted
  ) {
    historicalAcceptances.push({
      partyId:
        CLIENT_PARTY_ID,

      termsVersion:
        2,

      termsHash:
        HASH_V2,

      acceptedAt:
        new Date(
          "2026-09-07T11:00:00.000Z",
        ),

      party: {
        role:
          "CLIENT",
      },
    });
  }

  if (
    version ===
    2 &&
    options
      ?.contractorAccepted
  ) {
    historicalAcceptances.push({
      partyId:
        CONTRACTOR_PARTY_ID,

      termsVersion:
        2,

      termsHash:
        HASH_V2,

      acceptedAt:
        new Date(
          "2026-09-07T11:01:00.000Z",
        ),

      party: {
        role:
          "CONTRACTOR",
      },
    });
  }

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
            args.select
              .parties
          ) {
            return {
              ...agreement,

              parties:
                agreement
                  .parties
                  .map(
                    (party) => ({
                      ...party,
                    }),
                  ),
            };
          }

          return {
            id:
              agreement.id,

            termsVersion:
              agreement
                .termsVersion,

            termsHash:
              agreement
                .termsHash,
          };
        },
    },

    agreementRevision: {
      findUnique:
        async () => {
          if (
            options
              ?.currentRevisionExists ===
            false
          ) {
            return null;
          }

          return {
            agreementHash:
              hash,
          };
        },
    },

    agreementAcceptance: {
      findMany:
        async (
          args:
            any,
        ) => {
          if (
            args.where
              .termsVersion !==
              undefined
          ) {
            return currentAcceptances;
          }

          return historicalAcceptances;
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
    historicalAcceptances,

    operations:
      createPrismaAgreementOperations(
        prisma,
      ),
  };
}

test(
  "canonical lifecycle read reports both current acceptances while one wallet remains ACCEPTED",
  async () => {
    const fixture =
      createFixture({
        clientAccepted:
          true,

        contractorAccepted:
          true,

        clientWalletAddress:
          CLIENT_WALLET,
      });

    const lifecycle =
      await fixture.operations
        .getCanonicalAgreementLifecycle({
          agreementId:
            AGREEMENT_ID,
        });

    assert.equal(
      lifecycle.status,
      "ACCEPTED",
    );

    assert.equal(
      lifecycle
        .acceptanceComplete,
      true,
    );

    assert.equal(
      lifecycle
        .walletBindingComplete,
      false,
    );

    assert.equal(
      lifecycle
        .parties[0]
        ?.acceptedCurrentVersion,
      true,
    );

    assert.equal(
      lifecycle
        .parties[1]
        ?.acceptedCurrentVersion,
      true,
    );

    assert.equal(
      lifecycle
        .parties[0]
        ?.walletBound,
      true,
    );

    assert.equal(
      lifecycle
        .parties[1]
        ?.walletBound,
      false,
    );
  },
);

test(
  "canonical lifecycle read reports READY_TO_FUND only with both current acceptances and both wallets",
  async () => {
    const fixture =
      createFixture({
        clientAccepted:
          true,

        contractorAccepted:
          true,

        clientWalletAddress:
          CLIENT_WALLET,

        contractorWalletAddress:
          CONTRACTOR_WALLET,
      });

    const lifecycle =
      await fixture.operations
        .getCanonicalAgreementLifecycle({
          agreementId:
            AGREEMENT_ID,
        });

    assert.equal(
      lifecycle.status,
      "READY_TO_FUND",
    );

    assert.equal(
      lifecycle
        .acceptanceComplete,
      true,
    );

    assert.equal(
      lifecycle
        .walletBindingComplete,
      true,
    );
  },
);

test(
  "historical v1 acceptances are non-current after immutable v2 revision",
  async () => {
    const fixture =
      createFixture({
        version:
          2,

        hash:
          HASH_V2,
      });

    const lifecycle =
      await fixture.operations
        .getCanonicalAgreementLifecycle({
          agreementId:
            AGREEMENT_ID,
        });

    assert.equal(
      lifecycle.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      lifecycle
        .acceptanceComplete,
      false,
    );

    const history =
      await fixture.operations
        .listCanonicalAgreementAcceptances({
          agreementId:
            AGREEMENT_ID,
        });

    assert.equal(
      history.length,
      2,
    );

    assert.equal(
      history[0]
        ?.agreementVersion,
      1,
    );

    assert.equal(
      history[0]
        ?.current,
      false,
    );

    assert.equal(
      history[1]
        ?.current,
      false,
    );
  },
);

test(
  "historical acceptance query preserves old versions and marks only revised tuple acceptances current",
  async () => {
    const fixture =
      createFixture({
        version:
          2,

        hash:
          HASH_V2,

        clientAccepted:
          true,

        contractorAccepted:
          true,
      });

    const history =
      await fixture.operations
        .listCanonicalAgreementAcceptances({
          agreementId:
            AGREEMENT_ID,
        });

    assert.equal(
      history.length,
      4,
    );

    assert.deepEqual(
      history.map(
        (entry) => ({
          version:
            entry
              .agreementVersion,

          role:
            entry.role,

          current:
            entry.current,
        }),
      ),
      [
        {
          version:
            1,

          role:
            "CLIENT",

          current:
            false,
        },

        {
          version:
            1,

          role:
            "CONTRACTOR",

          current:
            false,
        },

        {
          version:
            2,

          role:
            "CLIENT",

          current:
            true,
        },

        {
          version:
            2,

          role:
            "CONTRACTOR",

          current:
            true,
        },
      ],
    );

    assert.equal(
      history[0]
        ?.acceptedAt,
      "2026-09-07T10:00:00.000Z",
    );
  },
);

test(
  "canonical lifecycle read rejects an agreement without a matching canonical revision",
  async () => {
    const fixture =
      createFixture({
        currentRevisionExists:
          false,
      });

    await assert.rejects(
      fixture.operations
        .getCanonicalAgreementLifecycle({
          agreementId:
            AGREEMENT_ID,
        }),

      AgreementConflictError,
    );
  },
);