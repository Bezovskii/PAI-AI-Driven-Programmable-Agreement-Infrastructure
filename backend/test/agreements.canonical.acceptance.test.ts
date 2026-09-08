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

function asPrismaClient(
  value:
    unknown,
): PrismaClient {
  return value as PrismaClient;
}

function createFixture() {
  const agreement = {
    id:
      AGREEMENT_ID,

    status:
      "AWAITING_ACCEPTANCE",

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
          null,

        accessCredentialHash:
          hashPartyAccessToken(
            CONTRACTOR_TOKEN,
          ),
      },
    ],
  };

  const acceptances:
    Array<{
      partyId:
        string;

      termsVersion:
        number;

      termsHash:
        string;

      acceptedAt:
        Date;
    }> = [];

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
          agreement.status =
            args.data.status;

          return {
            count:
              1,
          };
        },
    },

    agreementAcceptance: {
      upsert:
        async (
          args:
            any,
        ) => {
          const key =
            args.where
              .agreementId_partyId_termsVersion;

          const existing =
            acceptances.find(
              (entry) =>
                entry.partyId ===
                  key.partyId &&
                entry.termsVersion ===
                  key.termsVersion,
            );

          if (existing) {
            return existing;
          }

          const created = {
            partyId:
              args.create.partyId,

            termsVersion:
              args.create
                .termsVersion,

            termsHash:
              args.create
                .termsHash,

            acceptedAt:
              new Date(
                `2026-09-07T13:00:0${acceptances.length}Z`,
              ),
          };

          acceptances.push(
            created,
          );

          return created;
        },

      findMany:
        async (
          args:
            any,
        ) =>
          acceptances
            .filter(
              (entry) =>
                entry.termsVersion ===
                  args.where
                    .termsVersion &&
                entry.termsHash ===
                  args.where
                    .termsHash,
            )
            .map(
              (entry) => ({
                partyId:
                  entry.partyId,
              }),
            ),
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
    acceptances,
    operationOrder,

    operations:
      createPrismaAgreementOperations(
        prisma,
      ),
  };
}

test(
  "CLIENT exact-tuple acceptance remains AWAITING_ACCEPTANCE and locks before read",
  async () => {
    const fixture =
      createFixture();

    const result =
      await fixture.operations
        .acceptAgreementVersion({
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            1,

          agreementHash:
            AGREEMENT_HASH,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        });

    assert.deepEqual(
      fixture.operationOrder
        .slice(0, 2),
      [
        "lock",
        "find",
      ],
    );

    assert.equal(
      fixture.acceptances.length,
      1,
    );

    assert.equal(
      result.acceptance.role,
      "CLIENT",
    );

    assert.equal(
      result.acceptance.current,
      true,
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
  },
);

test(
  "CLIENT plus CONTRACTOR current acceptance transitions canonical agreement to ACCEPTED",
  async () => {
    const fixture =
      createFixture();

    await fixture.operations
      .acceptAgreementVersion({
        agreementId:
          AGREEMENT_ID,

        agreementVersion:
          1,

        agreementHash:
          AGREEMENT_HASH,

        partyId:
          CLIENT_PARTY_ID,

        partyAccessToken:
          CLIENT_TOKEN,
      });

    const result =
      await fixture.operations
        .acceptAgreementVersion({
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            1,

          agreementHash:
            AGREEMENT_HASH,

          partyId:
            CONTRACTOR_PARTY_ID,

          partyAccessToken:
            CONTRACTOR_TOKEN,
        });

    assert.equal(
      fixture.acceptances.length,
      2,
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

    assert.equal(
      fixture.agreement.status,
      "ACCEPTED",
    );
  },
);

test(
  "canonical acceptance rejects stale agreement version",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .acceptAgreementVersion({
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            2,

          agreementHash:
            AGREEMENT_HASH,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.acceptances.length,
      0,
    );
  },
);

test(
  "canonical acceptance rejects stale agreement hash",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .acceptAgreementVersion({
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            1,

          agreementHash:
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.acceptances.length,
      0,
    );
  },
);

test(
  "duplicate exact canonical acceptance is idempotent",
  async () => {
    const fixture =
      createFixture();

    const first =
      await fixture.operations
        .acceptAgreementVersion({
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            1,

          agreementHash:
            AGREEMENT_HASH,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        });

    const second =
      await fixture.operations
        .acceptAgreementVersion({
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            1,

          agreementHash:
            AGREEMENT_HASH,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        });

    assert.equal(
      fixture.acceptances.length,
      1,
    );

    assert.equal(
      first.acceptance
        .acceptedAt,
      second.acceptance
        .acceptedAt,
    );

    assert.equal(
      second.lifecycle.status,
      "AWAITING_ACCEPTANCE",
    );
  },
);

test(
  "CLIENT credential cannot authorize CONTRACTOR acceptance",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .acceptAgreementVersion({
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            1,

          agreementHash:
            AGREEMENT_HASH,

          partyId:
            CONTRACTOR_PARTY_ID,

          partyAccessToken:
            CLIENT_TOKEN,
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.acceptances.length,
      0,
    );
  },
);

test(
  "empty party credential is rejected",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .acceptAgreementVersion({
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            1,

          agreementHash:
            AGREEMENT_HASH,

          partyId:
            CLIENT_PARTY_ID,

          partyAccessToken:
            "",
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.acceptances.length,
      0,
    );
  },
);