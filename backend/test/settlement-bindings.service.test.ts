import assert from "node:assert/strict";
import test from "node:test";

import type {
  PrismaClient,
} from "../src/generated/prisma/client.js";

import {
  SettlementBindingAccessError,
  SettlementBindingConflictError,
  createPrismaSettlementBindingOperations,
} from "../src/settlement-bindings/service.js";

const CLIENT_WALLET =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const CONTRACTOR_WALLET =
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

const CLIENT_ACTOR = {
  userId: "user-client",
  walletAddress: CLIENT_WALLET,
};

const CONTRACTOR_ACTOR = {
  userId: "user-contractor",
  walletAddress: CONTRACTOR_WALLET,
};

function asPrismaClient(
  value: unknown,
): PrismaClient {
  return value as PrismaClient;
}

test(
  "CLIENT creates an external agreement settlement binding",
  async () => {
    let capturedData:
      unknown;

    const createdAt =
      new Date("2026-08-29T12:00:00.000Z");

    const updatedAt =
      new Date("2026-08-29T12:00:01.000Z");

    const prisma =
      asPrismaClient({
        agreement: {
          findUnique:
            async () => ({
              id: "agreement-1",
              parties: [
                {
                  role: "CLIENT",
                },
              ],
            }),
        },

        agreementSettlementBinding: {
          findFirst:
            async () =>
              null,

          create:
            async (
              args: {
                data: unknown;
              },
            ) => {
              capturedData =
                args.data;

              return {
                id: "binding-1",
                agreementId: "agreement-1",
                provider: "esct",
                chainId: 11155111,
                contractAddress:
                  "0x1111111111111111111111111111111111111111",
                externalAgreementId: "42",
                createdAt,
                updatedAt,
                milestoneBindings: [],
              };
            },
        },
      });

    const operations =
      createPrismaSettlementBindingOperations(
        prisma,
      );

    const result =
      await operations
        .createAgreementBinding({
          actor:
            CLIENT_ACTOR,

          agreementId:
            "agreement-1",

          provider:
            "ESCT",

          chainId:
            11155111,

          contractAddress:
            "0x1111111111111111111111111111111111111111",

          externalAgreementId:
            "42",
        });

    assert.deepEqual(
      capturedData,
      {
        agreementId:
          "agreement-1",

        provider:
          "esct",

        chainId:
          11155111,

        contractAddress:
          "0x1111111111111111111111111111111111111111",

        externalAgreementId:
          "42",
      },
    );

    assert.equal(
      result.id,
      "binding-1",
    );

    assert.equal(
      result.provider,
      "esct",
    );

    assert.equal(
      result.externalAgreementId,
      "42",
    );
  },
);


test(
  "CONTRACTOR cannot create settlement mappings",
  async () => {
    let bindingLookupCalled =
      false;

    const prisma =
      asPrismaClient({
        agreement: {
          findUnique:
            async () => ({
              id: "agreement-1",
              parties: [
                {
                  role: "CONTRACTOR",
                },
              ],
            }),
        },

        agreementSettlementBinding: {
          findFirst:
            async () => {
              bindingLookupCalled =
                true;

              return null;
            },
        },
      });

    const operations =
      createPrismaSettlementBindingOperations(
        prisma,
      );

    await assert.rejects(
      operations
        .createAgreementBinding({
          actor:
            CONTRACTOR_ACTOR,

          agreementId:
            "agreement-1",

          provider:
            "esct",

          chainId:
            11155111,

          contractAddress:
            "0x1111111111111111111111111111111111111111",

          externalAgreementId:
            "42",
        }),

      SettlementBindingAccessError,
    );

    assert.equal(
      bindingLookupCalled,
      false,
    );
  },
);


test(
  "milestone mapping cannot cross PAI agreement boundaries",
  async () => {
    let createCalled =
      false;

    const prisma =
      asPrismaClient({
        agreement: {
          findUnique:
            async () => ({
              id: "agreement-1",
              parties: [
                {
                  role: "CLIENT",
                },
              ],
            }),
        },

        agreementSettlementBinding: {
          findFirst:
            async () => ({
              id: "binding-1",
            }),
        },

        milestone: {
          findUnique:
            async () => ({
              id: "milestone-2",
              agreementId: "agreement-2",
            }),
        },

        milestoneSettlementBinding: {
          create:
            async () => {
              createCalled =
                true;

              throw new Error(
                "create must not be called",
              );
            },
        },
      });

    const operations =
      createPrismaSettlementBindingOperations(
        prisma,
      );

    await assert.rejects(
      operations
        .createMilestoneBinding({
          actor:
            CLIENT_ACTOR,

          agreementId:
            "agreement-1",

          agreementSettlementBindingId:
            "binding-1",

          milestoneId:
            "milestone-2",

          externalMilestoneId:
            "7",
        }),

      SettlementBindingConflictError,
    );

    assert.equal(
      createCalled,
      false,
    );
  },
);


test(
  "agreement parties can read settlement mappings",
  async () => {
    const createdAt =
      new Date("2026-08-29T12:00:00.000Z");

    const updatedAt =
      new Date("2026-08-29T12:00:01.000Z");

    const prisma =
      asPrismaClient({
        agreement: {
          findUnique:
            async () => ({
              id: "agreement-1",
              parties: [
                {
                  role: "CONTRACTOR",
                },
              ],
            }),
        },

        agreementSettlementBinding: {
          findMany:
            async () => [
              {
                id: "binding-1",
                agreementId: "agreement-1",
                provider: "esct",
                chainId: 11155111,
                contractAddress:
                  "0x1111111111111111111111111111111111111111",
                externalAgreementId: "42",
                createdAt,
                updatedAt,

                milestoneBindings: [
                  {
                    id:
                      "milestone-binding-1",

                    milestoneId:
                      "milestone-1",

                    externalMilestoneId:
                      "7",

                    createdAt,
                  },
                ],
              },
            ],
        },
      });

    const operations =
      createPrismaSettlementBindingOperations(
        prisma,
      );

    const result =
      await operations
        .getAgreementBindings({
          actor:
            CONTRACTOR_ACTOR,

          agreementId:
            "agreement-1",
        });

    assert.equal(
      result.length,
      1,
    );

    assert.equal(
      result[0]?.externalAgreementId,
      "42",
    );

    assert.equal(
      result[0]
        ?.milestoneBindings[0]
        ?.externalMilestoneId,
      "7",
    );
  },
);