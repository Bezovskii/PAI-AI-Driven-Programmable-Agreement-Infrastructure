import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/application.js";

const WALLET =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const SESSION_EXPIRY =
  new Date(
    "2026-08-21T10:30:00.000Z",
  );

const SESSION_TOKEN =
  "test-session-token";

const SESSION_TTL_SECONDS =
  7 * 24 * 60 * 60;

function getSetCookieHeader(
  value:
    string |
    string[] |
    undefined,
): string {
  assert.ok(
    value,
    "Set-Cookie header must exist.",
  );

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.join(
      "; ",
    );
  }

  return value;
}

test(
  "POST /api/v1/auth/verify sets HttpOnly opaque session cookie",
  async (t) => {
    let issuedFor:
      string |
      undefined;

    const app =
      buildApp({
        readinessProbe:
          async () => true,

        auth: {
          issueNonce:
            async () => ({
              walletAddress:
                WALLET,

              nonce:
                "unusedNonce",

              expiresAt:
                SESSION_EXPIRY,
            }),

          verifySiwe:
            async () => ({
              walletAddress:
                WALLET,

              nonce:
                "verifiedNonce",
            }),

          issueSession:
            async (
              walletAddress,
            ) => {
              issuedFor =
                walletAddress;

              return {
                userId:
                  "user-1",

                walletAddress,

                token:
                  SESSION_TOKEN,

                expiresAt:
                  SESSION_EXPIRY,
              };
            },

          sessionCookie: {
            name:
              "esct_session",

            secure:
              false,

            maxAgeSeconds:
              SESSION_TTL_SECONDS,
          },

          siwe: {
            domain:
              "localhost:5173",

            uri:
              "http://localhost:5173",

            chainId:
              31337,
          },
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
          "/api/v1/auth/verify",

        payload: {
          message:
            "test-message",

          signature:
            "test-signature",
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      issuedFor,
      WALLET,
    );

    assert.deepEqual(
      response.json(),
      {
        authenticated:
          true,

        walletAddress:
          WALLET,
      },
    );

    const setCookie =
      getSetCookieHeader(
        response.headers[
          "set-cookie"
        ],
      );

    assert.match(
      setCookie,
      /^esct_session=test-session-token;/,
    );

    assert.match(
      setCookie,
      /HttpOnly/i,
    );

    assert.match(
      setCookie,
      /SameSite=Lax/i,
    );

    assert.match(
      setCookie,
      /Path=\//i,
    );

    assert.match(
      setCookie,
      /Max-Age=604800/i,
    );

    assert.doesNotMatch(
      setCookie,
      /;\s*Secure(?:;|$)/i,
    );

    assert.equal(
      Object.hasOwn(
        response.json(),
        "token",
      ),
      false,
    );
  },
);

test(
  "production session cookie includes Secure flag",
  async (t) => {
    const app =
      buildApp({
        readinessProbe:
          async () => true,

        auth: {
          issueNonce:
            async () => ({
              walletAddress:
                WALLET,

              nonce:
                "unusedNonce",

              expiresAt:
                SESSION_EXPIRY,
            }),

          verifySiwe:
            async () => ({
              walletAddress:
                WALLET,

              nonce:
                "verifiedNonce",
            }),

          issueSession:
            async (
              walletAddress,
            ) => ({
              userId:
                "user-1",

              walletAddress,

              token:
                SESSION_TOKEN,

              expiresAt:
                SESSION_EXPIRY,
            }),

          sessionCookie: {
            name:
              "esct_session",

            secure:
              true,

            maxAgeSeconds:
              SESSION_TTL_SECONDS,
          },

          siwe: {
            domain:
              "localhost:5173",

            uri:
              "http://localhost:5173",

            chainId:
              31337,
          },
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
          "/api/v1/auth/verify",

        payload: {
          message:
            "test-message",

          signature:
            "test-signature",
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const setCookie =
      getSetCookieHeader(
        response.headers[
          "set-cookie"
        ],
      );

    assert.match(
      setCookie,
      /;\s*Secure(?:;|$)/i,
    );
  },
);