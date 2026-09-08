import assert from "node:assert/strict";
import test from "node:test";

import type {
  PrismaClient,
} from "../src/generated/prisma/client.js";

import {
  AgreementAccessError,
  AgreementConflictError,
} from "../src/agreements/routes.js";

import {
  hashPartyAccessToken,
} from "../src/agreements/canonical.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

const AGREEMENT_ID =
  "agreement-reviewed-1";

const AGREEMENT_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const CLIENT_PARTY_ID =
  "party-client";

const CONTRACTOR_PARTY_ID =
  "party-contractor";

const CLIENT_TOKEN =
  "11".repeat(32);

const CONTRACTOR_TOKEN =
  "22".repeat(32);

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
    readonly acceptedPartyIds?:
      readonly string[];

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
      [
        CLIENT_PARTY_ID,
        CONTRACTOR_PARTY_ID,
      ],
    );

  const agreement = {
    id:
      AGREEMENT_ID,

    status:
      "ACCEPTED",

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

  let partyUpdateCount =
    0;

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

      updateMany:
        async (
          args:
            any,
        ) => {
          agreement.status =
            args.data.status;

          return {
            count:
              1,
          };
        },
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

    agreementParty: {
      updateMany:
        async (
          args:
            any,
        ) => {
          const party =
            agreement.parties.find(
              (candidate) =>
                candidate.id ===
                args.where.id,
            );

          if (
            !party ||
            party.walletAddress !==
              null
          ) {
            return {
              count:
                0,
            };
          }

          party.walletAddress =
            args.data
              .walletAddress;

          partyUpdateCount++;

          return {
            count:
              1,
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
    agreement,

    get partyUpdateCount() {
      return partyUpdateCount;
    },

    operations:
      createPrismaAgreementOperations(
        prisma,
      ),
  };
}

test(
  "wallet binding is rejected until both current acceptances exist",
  async () => {
    const fixture =
      createFixture({
        acceptedPartyIds: [
          CLIENT_PARTY_ID,
        ],
      });

    await assert.rejects(
      fixture.operations
        .bindAgreementPartyWallet({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.partyUpdateCount,
      0,
    );
  },
);

test(
  "wrong party token cannot claim an unbound wallet slot",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .bindAgreementPartyWallet({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CONTRACTOR_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,

          actor: {
            userId:
              "authenticated-stranger",

            walletAddress:
              CONTRACTOR_WALLET,
          },
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.partyUpdateCount,
      0,
    );
  },
);

test(
  "wallet binding persists the authenticated SIWE session wallet and remains ACCEPTED with one wallet",
  async () => {
    const fixture =
      createFixture();

    const result =
      await fixture.operations
        .bindAgreementPartyWallet({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,

          actor: {
            userId:
              "user-client",

            walletAddress:
              "0x1111111111111111111111111111111111111111",
          },
        });

    assert.equal(
      fixture.agreement
        .parties[0]
        ?.walletAddress,
      CLIENT_WALLET,
    );

    assert.equal(
      result.walletAddress,
      CLIENT_WALLET,
    );

    assert.equal(
      result.lifecycle.status,
      "ACCEPTED",
    );

    assert.equal(
      result.lifecycle
        .acceptanceComplete,
      true,
    );

    assert.equal(
      result.lifecycle
        .walletBindingComplete,
      false,
    );
  },
);

test(
  "second authenticated party wallet binding transitions to READY_TO_FUND",
  async () => {
    const fixture =
      createFixture({
        clientWalletAddress:
          CLIENT_WALLET,
      });

    const result =
      await fixture.operations
        .bindAgreementPartyWallet({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CONTRACTOR_PARTY_ID,

          partyAccessToken:
            CONTRACTOR_TOKEN,

          actor: {
            userId:
              "user-contractor",

            walletAddress:
              CONTRACTOR_WALLET,
          },
        });

    assert.equal(
      result.lifecycle.status,
      "READY_TO_FUND",
    );

    assert.equal(
      result.lifecycle
        .walletBindingComplete,
      true,
    );

    assert.equal(
      fixture.agreement.status,
      "READY_TO_FUND",
    );
  },
);

test(
  "rebinding the same party to the same authenticated wallet is idempotent",
  async () => {
    const fixture =
      createFixture({
        clientWalletAddress:
          CLIENT_WALLET,
      });

    const result =
      await fixture.operations
        .bindAgreementPartyWallet({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        });

    assert.equal(
      fixture.partyUpdateCount,
      0,
    );

    assert.equal(
      result.walletAddress,
      CLIENT_WALLET,
    );

    assert.equal(
      result.lifecycle.status,
      "ACCEPTED",
    );
  },
);

test(
  "already-bound party cannot be rebound to a different authenticated wallet",
  async () => {
    const fixture =
      createFixture({
        clientWalletAddress:
          CLIENT_WALLET,
      });

    await assert.rejects(
      fixture.operations
        .bindAgreementPartyWallet({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,

          actor: {
            userId:
              "user-client",

            walletAddress:
              "0x3333333333333333333333333333333333333333",
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.partyUpdateCount,
      0,
    );
  },
);

test(
  "CLIENT and CONTRACTOR cannot bind the same wallet",
  async () => {
    const fixture =
      createFixture({
        clientWalletAddress:
          CLIENT_WALLET,
      });

    await assert.rejects(
      fixture.operations
        .bindAgreementPartyWallet({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CONTRACTOR_PARTY_ID,

          partyAccessToken:
            CONTRACTOR_TOKEN,

          actor: {
            userId:
              "user-contractor",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.partyUpdateCount,
      0,
    );
  },
);

test(
  "wallet address cannot be supplied through the canonical bind request body contract",
  async () => {
    const fixture =
      createFixture();

    const input = {
      agreementId:
        AGREEMENT_ID,

      partyId:
        CLIENT_PARTY_ID,

      partyAccessToken:
        CLIENT_TOKEN,

      actor: {
        userId:
          "user-client",

        walletAddress:
          CLIENT_WALLET,
      },

      walletAddress:
        "0x9999999999999999999999999999999999999999",
    };

    const result =
      await fixture.operations
        .bindAgreementPartyWallet(
          input,
        );

    assert.equal(
      result.walletAddress,
      CLIENT_WALLET,
    );

    assert.notEqual(
      result.walletAddress,
      input.walletAddress,
    );
  },
);