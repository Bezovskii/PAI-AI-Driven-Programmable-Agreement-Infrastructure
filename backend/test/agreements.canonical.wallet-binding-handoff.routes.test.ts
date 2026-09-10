import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgreementRouteOperations,
  CanonicalAgreementRouteOperations,
} from "../src/agreements/routes.js";

import {
  AgreementAccessError,
} from "../src/agreements/routes.js";

import {
  buildApp,
} from "../src/app.js";

const COOKIE_NAME =
  "pai_session";

const SESSION_TOKEN =
  "handoff-route-session";

const SERVICE_AUTHORIZATION =
  "Bearer telegram-handoff-service-token";

const AGREEMENT_ID =
  "agreement-handoff-route";

const CLIENT_PARTY_ID =
  "party-client";

const CLIENT_WALLET =
  "0x1111111111111111111111111111111111111111";

const PARTY_TOKEN =
  "11".repeat(32);

const HANDOFF_ID =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const EXPIRES_AT =
  "2026-09-10T20:00:00.000Z";

const AGREEMENT_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const LIFECYCLE = {
  reference: {
    agreementId:
      AGREEMENT_ID,

    agreementVersion:
      1,

    agreementHash:
      AGREEMENT_HASH,
  },

  status:
    "ACCEPTED" as const,

  acceptanceComplete:
    true,

  walletBindingComplete:
    false,

  parties: [
    {
      partyId:
        CLIENT_PARTY_ID,

      role:
        "CLIENT" as const,

      displayName:
        "Client",

      acceptedCurrentVersion:
        true,

      walletBound:
        true,

      walletAddress:
        CLIENT_WALLET,
    },

    {
      partyId:
        "party-contractor",

      role:
        "CONTRACTOR" as const,

      displayName:
        "Contractor",

      acceptedCurrentVersion:
        true,

      walletBound:
        false,

      walletAddress:
        null,
    },
  ],
};

type CanonicalRouteOperations =
  AgreementRouteOperations &
  CanonicalAgreementRouteOperations;

function asOperations(
  value:
    Partial<CanonicalRouteOperations>,
): CanonicalRouteOperations {
  return value as
    CanonicalRouteOperations;
}

function buildCanonicalApp(
  operations:
    AgreementRouteOperations,

  resolveSession:
    (
      rawToken:
        string,
    ) => Promise<
      {
        readonly userId:
          string;

        readonly walletAddress:
          string;
      } |
      null
    > =
      async (
        rawToken,
      ) => {
        assert.equal(
          rawToken,
          SESSION_TOKEN,
        );

        return {
          userId:
            "user-client",

          walletAddress:
            CLIENT_WALLET,
        };
      },

  resolveServicePrincipal?:
    (
      authorizationHeader:
        string | undefined,
    ) => Promise<
      {
        readonly userId:
          string;
      } |
      null
    >,
) {
  return buildApp({
    logger:
      false,

    readinessProbe:
      async () =>
        true,

    agreements: {
      sessionCookieName:
        COOKIE_NAME,

      resolveSession,

      ...(
        resolveServicePrincipal
          ? {
              resolveServicePrincipal,
            }
          : {}
      ),

      operations,
    },
  });
}

test(
  "POST handoff create uses only x-pai-party-token and does not resolve SIWE or service auth",
  async (t) => {
    let received:
      unknown;

    let sessionResolverCalled =
      false;

    let serviceResolverCalled =
      false;

    const app =
      buildCanonicalApp(
        asOperations({
          createWalletBindingHandoff:
            async (
              input,
            ) => {
              received =
                input;

              return {
                handoffId:
                  HANDOFF_ID,

                expiresAt:
                  EXPIRES_AT,
              };
            },
        }),

        async () => {
          sessionResolverCalled =
            true;

          throw new Error(
            "Create handoff must not resolve SIWE.",
          );
        },

        async () => {
          serviceResolverCalled =
            true;

          throw new Error(
            "Create handoff must not resolve service auth.",
          );
        },
      );

    t.after(
      async () =>
        app.close(),
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding-handoffs`,

        headers: {
          "x-pai-party-token":
            PARTY_TOKEN,
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.deepEqual(
      received,
      {
        agreementId:
          AGREEMENT_ID,

        partyId:
          CLIENT_PARTY_ID,

        partyAccessToken:
          PARTY_TOKEN,
      },
    );

    assert.deepEqual(
      response.json(),
      {
        handoffId:
          HANDOFF_ID,

        expiresAt:
          EXPIRES_AT,
      },
    );

    assert.equal(
      sessionResolverCalled,
      false,
    );

    assert.equal(
      serviceResolverCalled,
      false,
    );
  },
);

test(
  "POST handoff create rejects missing party credential",
  async (t) => {
    let receivedToken:
      string |
      undefined;

    const app =
      buildCanonicalApp(
        asOperations({
          createWalletBindingHandoff:
            async (
              input,
            ) => {
              receivedToken =
                input.partyAccessToken;

              throw new AgreementAccessError(
                "Missing handoff credential.",
              );
            },
        }),
      );

    t.after(
      async () =>
        app.close(),
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding-handoffs`,
      });

    assert.equal(
      response.statusCode,
      403,
    );

    assert.equal(
      receivedToken,
      "",
    );

    assert.deepEqual(
      response.json(),
      {
        error:
          "agreement_action_forbidden",
      },
    );
  },
);

test(
  "Telegram service authorization alone cannot create wallet-binding handoff",
  async (t) => {
    let serviceResolverCalled =
      false;

    let operationCalled =
      false;

    const app =
      buildCanonicalApp(
        asOperations({
          createWalletBindingHandoff:
            async (
              input,
            ) => {
              operationCalled =
                true;

              assert.equal(
                input.partyAccessToken,
                "",
              );

              throw new AgreementAccessError(
                "Party token required.",
              );
            },
        }),

        async () =>
          null,

        async () => {
          serviceResolverCalled =
            true;

          return {
            userId:
              "service:telegram",
          };
        },
      );

    t.after(
      async () =>
        app.close(),
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding-handoffs`,

        headers: {
          authorization:
            SERVICE_AUTHORIZATION,
        },
      });

    assert.equal(
      response.statusCode,
      403,
    );

    assert.equal(
      operationCalled,
      true,
    );

    assert.equal(
      serviceResolverCalled,
      false,
    );
  },
);

test(
  "POST handoff redeem uses authenticated SIWE actor and only opaque handoffId",
  async (t) => {
    let received:
      unknown;

    let serviceResolverCalled =
      false;

    const app =
      buildCanonicalApp(
        asOperations({
          redeemWalletBindingHandoff:
            async (
              input,
            ) => {
              received =
                input;

              return {
                partyId:
                  CLIENT_PARTY_ID,

                role:
                  "CLIENT",

                walletAddress:
                  CLIENT_WALLET,

                lifecycle:
                  LIFECYCLE,
              };
            },
        }),

        async (
          rawToken,
        ) => {
          assert.equal(
            rawToken,
            SESSION_TOKEN,
          );

          return {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          };
        },

        async () => {
          serviceResolverCalled =
            true;

          throw new Error(
            "Redeem must not resolve service principal.",
          );
        },
      );

    t.after(
      async () =>
        app.close(),
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding-handoffs/redeem`,

        headers: {
          cookie:
            `${COOKIE_NAME}=${SESSION_TOKEN}`,
        },

        payload: {
          handoffId:
            HANDOFF_ID,
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      received,
      {
        agreementId:
          AGREEMENT_ID,

        partyId:
          CLIENT_PARTY_ID,

        handoffId:
          HANDOFF_ID,

        actor: {
          userId:
            "user-client",

          walletAddress:
            CLIENT_WALLET,
        },
      },
    );

    assert.equal(
      response.json()
        .walletAddress,
      CLIENT_WALLET,
    );

    assert.equal(
      serviceResolverCalled,
      false,
    );
  },
);

test(
  "POST handoff redeem rejects unauthenticated browser",
  async (t) => {
    let redeemCalled =
      false;

    const app =
      buildCanonicalApp(
        asOperations({
          redeemWalletBindingHandoff:
            async () => {
              redeemCalled =
                true;

              throw new Error(
                "Redeem must not execute.",
              );
            },
        }),

        async () =>
          null,
      );

    t.after(
      async () =>
        app.close(),
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding-handoffs/redeem`,

        payload: {
          handoffId:
            HANDOFF_ID,
        },
      });

    assert.equal(
      response.statusCode,
      401,
    );

    assert.equal(
      redeemCalled,
      false,
    );
  },
);

test(
  "Telegram service authorization cannot substitute for SIWE on redeem",
  async (t) => {
    let serviceResolverCalled =
      false;

    let redeemCalled =
      false;

    const app =
      buildCanonicalApp(
        asOperations({
          redeemWalletBindingHandoff:
            async () => {
              redeemCalled =
                true;

              throw new Error(
                "Redeem must not execute.",
              );
            },
        }),

        async () =>
          null,

        async () => {
          serviceResolverCalled =
            true;

          return {
            userId:
              "service:telegram",
          };
        },
      );

    t.after(
      async () =>
        app.close(),
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding-handoffs/redeem`,

        headers: {
          authorization:
            SERVICE_AUTHORIZATION,
        },

        payload: {
          handoffId:
            HANDOFF_ID,
        },
      });

    assert.equal(
      response.statusCode,
      401,
    );

    assert.equal(
      redeemCalled,
      false,
    );

    assert.equal(
      serviceResolverCalled,
      false,
    );
  },
);

test(
  "redeem body rejects walletAddress and does not execute operation",
  async (t) => {
    let redeemCalled =
      false;

    const app =
      buildCanonicalApp(
        asOperations({
          redeemWalletBindingHandoff:
            async () => {
              redeemCalled =
                true;

              throw new Error(
                "Invalid body must not reach operation.",
              );
            },
        }),
      );

    t.after(
      async () =>
        app.close(),
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding-handoffs/redeem`,

        headers: {
          cookie:
            `${COOKIE_NAME}=${SESSION_TOKEN}`,
        },

        payload: {
          handoffId:
            HANDOFF_ID,

          walletAddress:
            "0x3333333333333333333333333333333333333333",
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      redeemCalled,
      false,
    );
  },
);
