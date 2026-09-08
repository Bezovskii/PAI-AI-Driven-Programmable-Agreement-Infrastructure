import assert from "node:assert/strict";
import test from "node:test";

import type {
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

import type {
  PrismaClient,
} from "../src/generated/prisma/client.js";

import {
  hashPartyAccessToken,
  serializeCanonicalAgreementTerms,
} from "../src/agreements/canonical.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

function asPrismaClient(
  value:
    unknown,
): PrismaClient {
  return value as PrismaClient;
}

const TERMS:
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
          "Covers all five competitors",

        deadline:
          "2026-12-10T00:00:00.000Z",
      },
    ],
  };

test(
  "reviewed agreement persists immutable v1 with hash-only pre-wallet credentials",
  async () => {
    let capturedData:
      any;

    const transaction = {
      agreement: {
        create:
          async (
            args:
              any,
          ) => {
            capturedData =
              args.data;

            return {
              id:
                "agreement-reviewed-1",

              status:
                "AWAITING_ACCEPTANCE",

              termsVersion:
                1,

              termsHash:
                args.data
                  .termsHash,

              parties: [
                {
                  id:
                    "party-client",

                  role:
                    "CLIENT",

                  displayName:
                    "Amir",

                  walletAddress:
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

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .persistReviewedAgreement({
          actor: {
            userId:
              "user-client",
          },

          terms:
            TERMS,

          client: {
            displayName:
              "Amir",
          },

          contractor: {
            displayName:
              "Mina",
          },
        });

    assert.equal(
      result.lifecycle
        .reference
        .agreementVersion,
      1,
    );

    assert.match(
      result.lifecycle
        .reference
        .agreementHash,
      /^0x[0-9a-f]{64}$/,
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
        .walletBindingComplete,
      false,
    );

    assert.equal(
      result.partyAccess.length,
      2,
    );

    const clientAccess =
      result.partyAccess.find(
        (entry) =>
          entry.role ===
          "CLIENT",
      );

    const contractorAccess =
      result.partyAccess.find(
        (entry) =>
          entry.role ===
          "CONTRACTOR",
      );

    assert.ok(clientAccess);
    assert.ok(contractorAccess);

    assert.equal(
      Buffer.from(
        clientAccess.accessToken,
        "hex",
      ).length,
      32,
    );

    assert.equal(
      Buffer.from(
        contractorAccess.accessToken,
        "hex",
      ).length,
      32,
    );

    assert.notEqual(
      clientAccess.accessToken,
      contractorAccess.accessToken,
    );

    assert.equal(
      capturedData.status,
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      capturedData.termsVersion,
      1,
    );

    assert.equal(
      capturedData.parties
        .create[0]
        .walletAddress,
      null,
    );

    assert.equal(
      capturedData.parties
        .create[1]
        .walletAddress,
      null,
    );

    assert.equal(
      capturedData.parties
        .create[0]
        .accessCredentialHash,
      hashPartyAccessToken(
        clientAccess.accessToken,
      ),
    );

    assert.equal(
      capturedData.parties
        .create[1]
        .accessCredentialHash,
      hashPartyAccessToken(
        contractorAccess.accessToken,
      ),
    );

    assert.notEqual(
      capturedData.parties
        .create[0]
        .accessCredentialHash,
      clientAccess.accessToken,
    );

    assert.notEqual(
      capturedData.parties
        .create[1]
        .accessCredentialHash,
      contractorAccess.accessToken,
    );

    assert.equal(
      JSON.stringify(
        capturedData,
      ).includes(
        clientAccess.accessToken,
      ),
      false,
    );

    assert.equal(
      JSON.stringify(
        capturedData,
      ).includes(
        contractorAccess.accessToken,
      ),
      false,
    );

    assert.equal(
      capturedData.revisions
        .create
        .agreementVersion,
      1,
    );

    assert.equal(
      capturedData.revisions
        .create
        .agreementHash,
      result.lifecycle
        .reference
        .agreementHash,
    );

    assert.deepEqual(
      capturedData.revisions
        .create
        .canonicalTerms,
      JSON.parse(
        serializeCanonicalAgreementTerms(
          TERMS,
        ),
      ),
    );
  },
);