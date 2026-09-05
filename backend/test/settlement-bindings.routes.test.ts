import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import {
  SettlementBindingAccessError,
  type SettlementBindingOperations,
} from "../src/settlement-bindings/service.js";

const COOKIE_NAME =
  "pai_session";

const RAW_TOKEN =
  "pai-test-session";

const CLIENT_WALLET =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function unexpectedOperations():
  SettlementBindingOperations {
  return {
    createAgreementBinding:
      async () => {
        throw new Error(
          "createAgreementBinding must not be called.",
        );
      },

    getAgreementBindings:
      async () => {
        throw new Error(
          "getAgreementBindings must not be called.",
        );
      },

    createMilestoneBinding:
      async () => {
        throw new Error(
          "createMilestoneBinding must not be called.",
        );
      },
  };
}

function resolveSession(
  rawToken:
    string,
) {
  if (
    rawToken !==
    RAW_TOKEN
  ) {
    return Promise.resolve(
      null,
    );
  }

  return Promise.resolve({
    userId:
      "user-client",

    walletAddress:
      CLIENT_WALLET,

    expiresAt:
      new Date(
        Date.now() +
          60_000,
      ),

    revokedAt:
      null,
  });
}

test(
  "settlement-binding routes require an authenticated PAI session",
  async (t) => {
    const app =
      buildApp({
        logger:
          false,

        readinessProbe:
          async () =>
            true,

        settlementBindings: {
          sessionCookieName:
            COOKIE_NAME,

          resolveSession,

          operations:
            unexpectedOperations(),
        },
      });

    t.after(
      async () => {
        await app.close();
      },
    );

    const requests = [
      {
        method:
          "POST" as const,

        url:
          "/api/v1/agreements/agreement-1/settlement-bindings",

        payload: {
          provider:
            "esct",

          chainId:
            11155111,

          contractAddress:
            "0x1111111111111111111111111111111111111111",

          externalAgreementId:
            "42",
        },
      },

      {
        method:
          "GET" as const,

        url:
          "/api/v1/agreements/agreement-1/settlement-bindings",
      },

      {
        method:
          "POST" as const,

        url:
          "/api/v1/agreements/agreement-1/settlement-bindings/binding-1/milestones/milestone-1",

        payload: {
          externalMilestoneId:
            "7",
        },
      },
    ];

    for (
      const request
      of requests
    ) {
      const response =
        await app.inject(
          request,
        );

      assert.equal(
        response.statusCode,
        401,
      );

      assert.deepEqual(
        response.json(),
        {
          error:
            "unauthenticated",
        },
      );
    }
  },
);

test(
  "authenticated route passes PAI agreement ID and external binding metadata to service",
  async (t) => {
    let capturedInput:
      unknown;

    const operations:
      SettlementBindingOperations = {
        ...unexpectedOperations(),

        createAgreementBinding:
          async (
            input,
          ) => {
            capturedInput =
              input;

            return {
              id:
                "binding-1",

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

              createdAt:
                new Date(),

              updatedAt:
                new Date(),

              milestoneBindings:
                [],
            };
          },
      };

    const app =
      buildApp({
        logger:
          false,

        readinessProbe:
          async () =>
            true,

        settlementBindings: {
          sessionCookieName:
            COOKIE_NAME,

          resolveSession,

          operations,
        },
      });

    t.after(
      async () => {
        await app.close();
      },
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          "/api/v1/agreements/agreement-1/settlement-bindings",

        headers: {
          cookie:
            `${COOKIE_NAME}=${RAW_TOKEN}`,
        },

        payload: {
          provider:
            "esct",

          chainId:
            11155111,

          contractAddress:
            "0x1111111111111111111111111111111111111111",

          externalAgreementId:
            "42",
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.deepEqual(
      capturedInput,
      {
        actor: {
          userId:
            "user-client",

          walletAddress:
            CLIENT_WALLET,
        },

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
  },
);

test(
  "settlement-binding route maps service access errors to 403",
  async (t) => {
    const operations:
      SettlementBindingOperations = {
        ...unexpectedOperations(),

        getAgreementBindings:
          async () => {
            throw new SettlementBindingAccessError();
          },
      };

    const app =
      buildApp({
        logger:
          false,

        readinessProbe:
          async () =>
            true,

        settlementBindings: {
          sessionCookieName:
            COOKIE_NAME,

          resolveSession,

          operations,
        },
      });

    t.after(
      async () => {
        await app.close();
      },
    );

    const response =
      await app.inject({
        method:
          "GET",

        url:
          "/api/v1/agreements/agreement-1/settlement-bindings",

        headers: {
          cookie:
            `${COOKIE_NAME}=${RAW_TOKEN}`,
        },
      });

    assert.equal(
      response.statusCode,
      403,
    );

    assert.deepEqual(
      response.json(),
      {
        error:
          "settlement_binding_forbidden",
      },
    );
  },
);