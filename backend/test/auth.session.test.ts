import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionIssuer,
  hashSessionToken,
  type PersistSessionInput,
} from "../src/auth/session.js";

const WALLET =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const NOW =
  new Date(
    "2026-08-14T10:30:00.000Z",
  );

const RAW_TOKEN =
  "test-session-token";

const SEVEN_DAYS =
  7 * 24 * 60 * 60;

test(
  "hashSessionToken returns SHA-256 hex digest",
  () => {
    const hash =
      hashSessionToken(
        RAW_TOKEN,
      );

    assert.equal(
      hash.length,
      64,
    );

    assert.match(
      hash,
      /^[a-f0-9]{64}$/,
    );

    assert.notEqual(
      hash,
      RAW_TOKEN,
    );
  },
);

test(
  "session issuer stores only token hash and returns raw opaque token",
  async () => {
    let persisted:
      PersistSessionInput |
      undefined;

    const issueSession =
      createSessionIssuer(
        async (input) => {
          persisted =
            input;

          return {
            userId:
              "user-1",
          };
        },

        {
          ttlSeconds:
            SEVEN_DAYS,
        },

        {
          now:
            () =>
              NOW,

          generateToken:
            () =>
              RAW_TOKEN,
        },
      );

    const session =
      await issueSession(
        WALLET,
      );

    assert.equal(
      session.userId,
      "user-1",
    );

    assert.equal(
      session.walletAddress,
      WALLET,
    );

    assert.equal(
      session.token,
      RAW_TOKEN,
    );

    assert.equal(
      session.expiresAt
        .toISOString(),
      "2026-08-21T10:30:00.000Z",
    );

    assert.ok(
      persisted,
    );

    assert.equal(
      persisted.walletAddress,
      WALLET,
    );

    assert.equal(
      persisted.tokenHash,
      hashSessionToken(
        RAW_TOKEN,
      ),
    );

    assert.notEqual(
      persisted.tokenHash,
      RAW_TOKEN,
    );

    assert.equal(
      persisted.lastUsedAt
        .toISOString(),
      NOW.toISOString(),
    );

    assert.equal(
      persisted.expiresAt
        .toISOString(),
      "2026-08-21T10:30:00.000Z",
    );
  },
);

test(
  "session issuer rejects invalid TTL",
  () => {
    assert.throws(
      () => {
        createSessionIssuer(
          async () => ({
            userId:
              "user-1",
          }),

          {
            ttlSeconds:
              0,
          },
        );
      },

      /Session TTL must be a positive safe integer/,
    );
  },
);