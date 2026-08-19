import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import {
  AUTH_NONCE_TTL_MS,
  createAuthNonceIssuer,
  InvalidWalletAddressError,
  normalizeWalletAddress,
  type NewAuthNonceRecord,
} from "../src/auth/nonce.js";

const WALLET_LOWERCASE =
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";

const WALLET_CHECKSUM =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const FIXED_NOW =
  new Date(
    "2026-08-14T08:00:00.000Z",
  );

const FIXED_NONCE =
  "testNonce123456";

test(
  "normalizeWalletAddress returns checksum address",
  () => {
    assert.equal(
      normalizeWalletAddress(
        WALLET_LOWERCASE,
      ),
      WALLET_CHECKSUM,
    );
  },
);

test(
  "normalizeWalletAddress rejects invalid address",
  () => {
    assert.throws(
      () => {
        normalizeWalletAddress(
          "not-an-address",
        );
      },
      InvalidWalletAddressError,
    );
  },
);

test(
  "auth nonce issuer persists wallet-associated five-minute nonce",
  async () => {
    let persisted:
      NewAuthNonceRecord |
      undefined;

    const issueNonce =
      createAuthNonceIssuer(
        async (record) => {
          persisted =
            record;
        },
        {
          now:
            () =>
              FIXED_NOW,

          generateNonce:
            () =>
              FIXED_NONCE,
        },
      );

    const issued =
      await issueNonce(
        WALLET_LOWERCASE,
      );

    const expectedExpiry =
      new Date(
        FIXED_NOW.getTime() +
          AUTH_NONCE_TTL_MS,
      );

    assert.deepEqual(
      issued,
      {
        walletAddress:
          WALLET_CHECKSUM,

        nonce:
          FIXED_NONCE,

        expiresAt:
          expectedExpiry,
      },
    );

    assert.deepEqual(
      persisted,
      {
        walletAddress:
          WALLET_CHECKSUM,

        nonce:
          FIXED_NONCE,

        expiresAt:
          expectedExpiry,
      },
    );
  },
);

test(
  "POST /api/v1/auth/nonce returns persisted SIWE parameters",
  async (t) => {
    const issueNonce =
      createAuthNonceIssuer(
        async () => {
          // Persistence is exercised
          // separately above.
        },
        {
          now:
            () =>
              FIXED_NOW,

          generateNonce:
            () =>
              FIXED_NONCE,
        },
      );

    const app =
      buildApp({
        readinessProbe:
          async () => true,

        auth: {
          issueNonce,

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
          "/api/v1/auth/nonce",

        payload: {
          walletAddress:
            WALLET_LOWERCASE,
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json(),
      {
        walletAddress:
          WALLET_CHECKSUM,

        nonce:
          FIXED_NONCE,

        expiresAt:
          "2026-08-14T08:05:00.000Z",

        domain:
          "localhost:5173",

        uri:
          "http://localhost:5173",

        version:
          "1",

        chainId:
          31337,
      },
    );
  },
);

test(
  "POST /api/v1/auth/nonce rejects invalid wallet address",
  async (t) => {
    const issueNonce =
      createAuthNonceIssuer(
        async () => {
          assert.fail(
            "invalid wallet must not be persisted",
          );
        },
      );

    const app =
      buildApp({
        readinessProbe:
          async () => true,

        auth: {
          issueNonce,

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
          "/api/v1/auth/nonce",

        payload: {
          walletAddress:
            "not-an-address",
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );

    assert.deepEqual(
      response.json(),
      {
        error:
          "invalid_wallet_address",
      },
    );
  },
);

test(
  "POST /api/v1/auth/nonce requires walletAddress",
  async (t) => {
    const app =
      buildApp({
        readinessProbe:
          async () => true,

        auth: {
          issueNonce:
            async () => {
              assert.fail(
                "issuer must not run for invalid body",
              );
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
          "/api/v1/auth/nonce",

        payload: {},
      });

    assert.equal(
      response.statusCode,
      400,
    );
  },
);