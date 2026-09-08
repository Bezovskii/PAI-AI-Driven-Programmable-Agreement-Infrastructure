import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgreementRouteOperations,
  CanonicalAgreementRouteOperations,
} from "../src/agreements/routes.js";

import {
  buildApp,
} from "../src/app.js";

const COOKIE_NAME =
  "pai_session";

const SESSION_TOKEN =
  "canonical-route-session";

const CLIENT_WALLET =
  "0x1111111111111111111111111111111111111111";

const PARTY_TOKEN =
  "11".repeat(32);

const SERVICE_USER_ID =
  "service:telegram";

const SERVICE_AUTHORIZATION =
  "Bearer telegram-service-test-token";

const AGREEMENT_ID =
  "agreement-canonical-1";

const CLIENT_PARTY_ID =
  "party-client";

const AGREEMENT_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const TERMS = {
  title:
    "Research brief",

  description:
    "Prepare a competitor research brief.",

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
        "Final research brief",

      acceptanceCriteria:
        "Covers five competitors",

      deadline:
        null,
    },
  ],
};

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
    "AWAITING_ACCEPTANCE" as const,

  acceptanceComplete:
    false,

  walletBindingComplete:
    false,

  parties: [
    {
      partyId:
        CLIENT_PARTY_ID,

      role:
        "CLIENT" as const,

      displayName:
        "Amir",

      acceptedCurrentVersion:
        false,

      walletBound:
        false,

      walletAddress:
        null,
    },

    {
      partyId:
        "party-contractor",

      role:
        "CONTRACTOR" as const,

      displayName:
        "Mina",

      acceptedCurrentVersion:
        false,

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
  "POST /reviewed uses authenticated session and returns canonical creation result",
  async (t) => {
    let received:
      unknown;

    const app =
      buildCanonicalApp(
        asOperations({
          persistReviewedAgreement:
            async (
              input,
            ) => {
              received =
                input;

              return {
                lifecycle:
                  LIFECYCLE,

                partyAccess: [
                  {
                    partyId:
                      CLIENT_PARTY_ID,

                    role:
                      "CLIENT",

                    accessToken:
                      PARTY_TOKEN,
                  },

                  {
                    partyId:
                      "party-contractor",

                    role:
                      "CONTRACTOR",

                    accessToken:
                      "22".repeat(
                        32,
                      ),
                  },
                ],
              };
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
          "/api/v1/agreements/reviewed",

        headers: {
          cookie:
            `${COOKIE_NAME}=${SESSION_TOKEN}`,
        },

        payload: {
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
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.deepEqual(
      received,
      {
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
      },
    );
  },
);

test(
  "POST /:id/revisions forwards authenticated actor and exact optimistic tuple",
  async (t) => {
    let received:
      unknown;

    const app =
      buildCanonicalApp(
        asOperations({
          reviseCanonicalAgreement:
            async (
              input,
            ) => {
              received =
                input;

              return {
                previous:
                  LIFECYCLE
                    .reference,

                current: {
                  agreementId:
                    AGREEMENT_ID,

                  agreementVersion:
                    2,

                  agreementHash:
                    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                },

                lifecycle: {
                  ...LIFECYCLE,

                  reference: {
                    agreementId:
                      AGREEMENT_ID,

                    agreementVersion:
                      2,

                    agreementHash:
                      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                  },
                },
              };
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
          `/api/v1/agreements/${AGREEMENT_ID}/revisions`,

        headers: {
          cookie:
            `${COOKIE_NAME}=${SESSION_TOKEN}`,
        },

        payload: {
          expected:
            LIFECYCLE
              .reference,

          terms:
            TERMS,
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.deepEqual(
      received,
      {
        actor: {
          userId:
            "user-client",
        },

        expected:
          LIFECYCLE
            .reference,

        terms:
          TERMS,
      },
    );
  },
);

test(
  "POST /:id/acceptances uses x-pai-party-token without requiring SIWE session",
  async (t) => {
    let received:
      unknown;

    const app =
      buildCanonicalApp(
        asOperations({
          acceptAgreementVersion:
            async (
              input,
            ) => {
              received =
                input;

              return {
                acceptance: {
                  partyId:
                    CLIENT_PARTY_ID,

                  role:
                    "CLIENT",

                  agreementVersion:
                    1,

                  agreementHash:
                    AGREEMENT_HASH,

                  acceptedAt:
                    "2026-09-07T20:00:00.000Z",

                  current:
                    true,
                },

                lifecycle:
                  LIFECYCLE,
              };
            },
        }),

        async () => {
          throw new Error(
            "Acceptance route must not resolve a SIWE session.",
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
          `/api/v1/agreements/${AGREEMENT_ID}/acceptances`,

        headers: {
          "x-pai-party-token":
            PARTY_TOKEN,
        },

        payload: {
          agreementId:
            AGREEMENT_ID,

          agreementVersion:
            1,

          agreementHash:
            AGREEMENT_HASH,

          partyId:
            CLIENT_PARTY_ID,
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

        agreementVersion:
          1,

        agreementHash:
          AGREEMENT_HASH,

        partyId:
          CLIENT_PARTY_ID,

        partyAccessToken:
          PARTY_TOKEN,
      },
    );
  },
);

test(
  "GET /:id/lifecycle reads canonical lifecycle without requiring SIWE session",
  async (t) => {
    let received:
      unknown;

    const app =
      buildCanonicalApp(
        asOperations({
          getCanonicalAgreementLifecycle:
            async (
              input,
            ) => {
              received =
                input;

              return LIFECYCLE;
            },
        }),

        async () => {
          throw new Error(
            "Lifecycle read must not resolve a SIWE session.",
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
          "GET",

        url:
          `/api/v1/agreements/${AGREEMENT_ID}/lifecycle`,
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
      },
    );

    assert.equal(
      response.json()
        .reference
        .agreementHash,
      AGREEMENT_HASH,
    );
  },
);

test(
  "POST wallet-binding uses authenticated wallet plus x-pai-party-token",
  async (t) => {
    let received:
      unknown;

    const app =
      buildCanonicalApp(
        asOperations({
          bindAgreementPartyWallet:
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

                lifecycle: {
                  ...LIFECYCLE,

                  status:
                    "ACCEPTED",

                  acceptanceComplete:
                    true,

                  parties:
                    LIFECYCLE
                      .parties
                      .map(
                        (
                          party,
                        ) =>
                          party
                            .partyId ===
                            CLIENT_PARTY_ID
                            ? {
                                ...party,

                                acceptedCurrentVersion:
                                  true,

                                walletBound:
                                  true,

                                walletAddress:
                                  CLIENT_WALLET,
                              }
                            : {
                                ...party,

                                acceptedCurrentVersion:
                                  true,
                              },
                      ),
                },
              };
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
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding`,

        headers: {
          cookie:
            `${COOKIE_NAME}=${SESSION_TOKEN}`,

          "x-pai-party-token":
            PARTY_TOKEN,
        },

        payload: {
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,
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

        partyAccessToken:
          PARTY_TOKEN,

        actor: {
          userId:
            "user-client",

          walletAddress:
            CLIENT_WALLET,
        },
      },
    );
  },
);

test(
  "POST /reviewed accepts Telegram service principal without SIWE",
  async (t) => {
    let received:
      unknown;

    const app =
      buildCanonicalApp(
        asOperations({
          persistReviewedAgreement:
            async (
              input,
            ) => {
              received =
                input;

              return {
                lifecycle:
                  LIFECYCLE,

                partyAccess: [
                  {
                    partyId:
                      CLIENT_PARTY_ID,

                    role:
                      "CLIENT",

                    accessToken:
                      PARTY_TOKEN,
                  },

                  {
                    partyId:
                      "party-contractor",

                    role:
                      "CONTRACTOR",

                    accessToken:
                      "22".repeat(32),
                  },
                ],
              };
            },
        }),

        async () =>
          null,

        async (
          authorizationHeader,
        ) => {
          assert.equal(
            authorizationHeader,
            SERVICE_AUTHORIZATION,
          );

          return {
            userId:
              SERVICE_USER_ID,
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
          "/api/v1/agreements/reviewed",

        headers: {
          authorization:
            SERVICE_AUTHORIZATION,
        },

        payload: {
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
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.deepEqual(
      received,
      {
        actor: {
          userId:
            SERVICE_USER_ID,
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
      },
    );
  },
);

test(
  "POST /:id/revisions accepts Telegram service principal without SIWE",
  async (t) => {
    let received:
      unknown;

    const app =
      buildCanonicalApp(
        asOperations({
          reviseCanonicalAgreement:
            async (
              input,
            ) => {
              received =
                input;

              return {
                previous:
                  LIFECYCLE.reference,

                current: {
                  agreementId:
                    AGREEMENT_ID,

                  agreementVersion:
                    2,

                  agreementHash:
                    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                },

                lifecycle: {
                  ...LIFECYCLE,

                  reference: {
                    agreementId:
                      AGREEMENT_ID,

                    agreementVersion:
                      2,

                    agreementHash:
                      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                  },
                },
              };
            },
        }),

        async () =>
          null,

        async (
          authorizationHeader,
        ) => {
          assert.equal(
            authorizationHeader,
            SERVICE_AUTHORIZATION,
          );

          return {
            userId:
              SERVICE_USER_ID,
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
          `/api/v1/agreements/${AGREEMENT_ID}/revisions`,

        headers: {
          authorization:
            SERVICE_AUTHORIZATION,
        },

        payload: {
          expected:
            LIFECYCLE.reference,

          terms:
            TERMS,
        },
      });

    assert.equal(
      response.statusCode,
      201,
    );

    assert.deepEqual(
      received,
      {
        actor: {
          userId:
            SERVICE_USER_ID,
        },

        expected:
          LIFECYCLE.reference,

        terms:
          TERMS,
      },
    );
  },
);

test(
  "Telegram service principal cannot authorize wallet binding",
  async (t) => {
    let serviceResolverCalled =
      false;

    let walletBindingCalled =
      false;

    const app =
      buildCanonicalApp(
        asOperations({
          bindAgreementPartyWallet:
            async () => {
              walletBindingCalled =
                true;

              throw new Error(
                "wallet binding must not execute",
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
              SERVICE_USER_ID,
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
          `/api/v1/agreements/${AGREEMENT_ID}/parties/${CLIENT_PARTY_ID}/wallet-binding`,

        headers: {
          authorization:
            SERVICE_AUTHORIZATION,

          "x-pai-party-token":
            PARTY_TOKEN,
        },

        payload: {
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,
        },
      });

    assert.equal(
      response.statusCode,
      401,
    );

    assert.equal(
      serviceResolverCalled,
      false,
    );

    assert.equal(
      walletBindingCalled,
      false,
    );
  },
);