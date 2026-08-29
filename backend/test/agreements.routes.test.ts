import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import type {
  AgreementRouteOperations,
  CreateAgreementInput,
} from "../src/agreements/routes.js";

const COOKIE_NAME =
  "pai_session";

const RAW_TOKEN =
  "pai-test-session";

const CLIENT_WALLET =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const CONTRACTOR_WALLET =
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

function createUnexpectedOperations():
  AgreementRouteOperations {
  return {
    createAgreement:
      async () => {
        throw new Error(
          "createAgreement must not be called.",
        );
      },

    getAgreement:
      async () => {
        throw new Error(
          "getAgreement must not be called.",
        );
      },

    addMilestone:
      async () => {
        throw new Error(
          "addMilestone must not be called.",
        );
      },

    proposeAgreement:
      async () => {
        throw new Error(
          "proposeAgreement must not be called.",
        );
      },

    acceptAgreement:
      async () => {
        throw new Error(
          "acceptAgreement must not be called.",
        );
      },

    submitEvidence:
      async () => {
        throw new Error(
          "submitEvidence must not be called.",
        );
      },
  };
}

/* =========================================================
   SESSION ENFORCEMENT
   ========================================================= */

test(
  "PAI agreement routes reject requests without authenticated session",
  async (t) => {
    let resolverCalled =
      false;

    const app =
      buildApp({
        logger:
          false,

        readinessProbe:
          async () =>
            true,

        agreements: {
          sessionCookieName:
            COOKIE_NAME,

          resolveSession:
            async () => {
              resolverCalled =
                true;

              return {
                userId:
                  "unexpected-user",

                walletAddress:
                  CLIENT_WALLET,
              };
            },

          operations:
            createUnexpectedOperations(),
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
          "/api/v1/agreements",

        payload: {
          contractorWalletAddress:
            CONTRACTOR_WALLET,
        },
      },

      {
        method:
          "GET" as const,

        url:
          "/api/v1/agreements/agreement-1",
      },

      {
        method:
          "POST" as const,

        url:
          "/api/v1/agreements/agreement-1/milestones",

        payload: {},
      },

      {
        method:
          "POST" as const,

        url:
          "/api/v1/agreements/agreement-1/propose",
      },

      {
        method:
          "POST" as const,

        url:
          "/api/v1/agreements/agreement-1/accept",
      },

      {
        method:
          "POST" as const,

        url:
          "/api/v1/agreements/agreement-1/milestones/milestone-1/evidence",

        payload: {
          uri:
            "ipfs://evidence-1",
        },
      },
    ];

    for (
      const request of requests
    ) {
      const response =
        await app.inject(
          request,
        );

      assert.equal(
        response.statusCode,
        401,
        `${request.method} ${request.url}`,
      );

      assert.deepEqual(
        response.json(),
        {
          error:
            "unauthenticated",
        },
        `${request.method} ${request.url}`,
      );
    }

    assert.equal(
      resolverCalled,
      false,
      "session resolver must not run when cookie is missing",
    );
  },
);

/* =========================================================
   ACTOR PROPAGATION
   ========================================================= */

test(
  "POST /api/v1/agreements forwards authenticated PAI actor",
  async (t) => {
    let receivedToken =
      "";

    let receivedInput:
      CreateAgreementInput |
      undefined;

    const operations:
      AgreementRouteOperations = {
        createAgreement:
          async (
            input,
          ) => {
            receivedInput =
              input;

            return {
              id:
                "agreement-1",

              status:
                "DRAFT",
            };
          },

        getAgreement:
          async () =>
            null,

        addMilestone:
          async () => ({
            id:
              "milestone-1",

            agreementId:
              "agreement-1",

            position:
              1,

            status:
              "PENDING",
          }),

        proposeAgreement:
          async () => ({
            id:
              "agreement-1",

            status:
              "PROPOSED",
          }),

        acceptAgreement:
          async () => ({
            id:
              "agreement-1",

            status:
              "ACCEPTED",
          }),

        submitEvidence:
          async () => ({
            id:
              "evidence-1",

            milestoneId:
              "milestone-1",

            uri:
              "ipfs://evidence-1",

            hash:
              null,
          }),
      };

    const app =
      buildApp({
        logger:
          false,

        readinessProbe:
          async () =>
            true,

        agreements: {
          sessionCookieName:
            COOKIE_NAME,

          resolveSession:
            async (
              rawToken,
            ) => {
              receivedToken =
                rawToken;

              return {
                userId:
                  "user-1",

                walletAddress:
                  CLIENT_WALLET,
              };
            },

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
          "/api/v1/agreements",

        headers: {
          cookie:
            `${COOKIE_NAME}=${RAW_TOKEN}`,
        },

        payload: {
          contractorWalletAddress:
            CONTRACTOR_WALLET,

          title:
            "Website delivery",

          metadataUri:
            "ipfs://agreement-metadata",

          termsHash:
            "0xterms",
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.deepEqual(
      response.json(),
      {
        id:
          "agreement-1",

        status:
          "DRAFT",
      },
    );

    assert.equal(
      receivedToken,
      RAW_TOKEN,
    );

    assert.deepEqual(
      receivedInput,
      {
        actor: {
          userId:
            "user-1",

          walletAddress:
            CLIENT_WALLET,
        },

        contractorWalletAddress:
          CONTRACTOR_WALLET,

        title:
          "Website delivery",

        metadataUri:
          "ipfs://agreement-metadata",

        termsHash:
          "0xterms",
      },
    );
  },
);

/* =========================================================
   INVALID SESSION
   ========================================================= */

test(
  "PAI agreement route rejects invalid session cookie",
  async (t) => {
    const app =
      buildApp({
        logger:
          false,

        readinessProbe:
          async () =>
            true,

        agreements: {
          sessionCookieName:
            COOKIE_NAME,

          resolveSession:
            async () =>
              null,

          operations:
            createUnexpectedOperations(),
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
          "/api/v1/agreements",

        headers: {
          cookie:
            `${COOKIE_NAME}=invalid-token`,
        },

        payload: {
          contractorWalletAddress:
            CONTRACTOR_WALLET,
        },
      });

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
  },
);