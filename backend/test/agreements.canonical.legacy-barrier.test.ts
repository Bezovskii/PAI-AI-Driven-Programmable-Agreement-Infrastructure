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

const CONTRACTOR_WALLET =
  "0x2222222222222222222222222222222222222222";

function asPrismaClient(
  value:
    unknown,
): PrismaClient {
  return value as PrismaClient;
}

test(
  "legacy accept cannot bypass canonical dual acceptance even if canonical status is PROPOSED",
  async () => {
    let acceptanceReadCalled =
      false;

    let acceptanceCreateCalled =
      false;

    let agreementUpdateCalled =
      false;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-canonical-1",

            status:
              "PROPOSED",

            termsVersion:
              1,

            termsHash:
              "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",

            revisions: [
              {
                id:
                  "revision-1",
              },
            ],

            parties: [
              {
                id:
                  "party-contractor",

                role:
                  "CONTRACTOR",
              },
            ],
          }),

        updateMany:
          async () => {
            agreementUpdateCalled =
              true;

            return {
              count:
                1,
            };
          },
      },

      agreementAcceptance: {
        findFirst:
          async () => {
            acceptanceReadCalled =
              true;

            return null;
          },

        create:
          async () => {
            acceptanceCreateCalled =
              true;

            return {
              id:
                "acceptance-legacy-1",
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

    await assert.rejects(
      operations.acceptAgreement({
        actor: {
          userId:
            "user-contractor",

          walletAddress:
            CONTRACTOR_WALLET,
        },

        agreementId:
          "agreement-canonical-1",
      }),

      (
        error:
          unknown,
      ) => {
        assert.ok(
          error instanceof
            AgreementConflictError,
        );

        assert.equal(
          error.message,
          "Canonical agreements must use exact-tuple dual acceptance.",
        );

        return true;
      },
    );

    assert.equal(
      acceptanceReadCalled,
      false,
    );

    assert.equal(
      acceptanceCreateCalled,
      false,
    );

    assert.equal(
      agreementUpdateCalled,
      false,
    );
  },
);