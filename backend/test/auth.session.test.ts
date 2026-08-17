import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionIssuer,
  createSessionResolver,
  createSessionRevoker,
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

/* =========================================================
   TOKEN HASHING
   ========================================================= */

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

/* =========================================================
   SESSION ISSUANCE
   ========================================================= */

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

/* =========================================================
   SESSION RESOLUTION
   ========================================================= */

test(
  "session resolver accepts active session",
  async () => {
    const resolveSession =
      createSessionResolver(
        async () => ({
          userId:
            "user-1",

          walletAddress:
            WALLET,

          expiresAt:
            new Date(
              NOW.getTime() +
              60_000,
            ),

          revokedAt:
            null,
        }),

        {
          now:
            () =>
              NOW,
        },
      );

    const resolved =
      await resolveSession(
        RAW_TOKEN,
      );

    assert.deepEqual(
      resolved,
      {
        userId:
          "user-1",

        walletAddress:
          WALLET,
      },
    );
  },
);

test(
  "session resolver hashes raw token before lookup",
  async () => {
    let receivedHash =
      "";

    const resolveSession =
      createSessionResolver(
        async (
          tokenHash,
        ) => {
          receivedHash =
            tokenHash;

          return {
            userId:
              "user-1",

            walletAddress:
              WALLET,

            expiresAt:
              new Date(
                NOW.getTime() +
                60_000,
              ),

            revokedAt:
              null,
          };
        },

        {
          now:
            () =>
              NOW,
        },
      );

    await resolveSession(
      RAW_TOKEN,
    );

    assert.equal(
      receivedHash,
      hashSessionToken(
        RAW_TOKEN,
      ),
    );

    assert.notEqual(
      receivedHash,
      RAW_TOKEN,
    );
  },
);

test(
  "session resolver rejects unknown session",
  async () => {
    const resolveSession =
      createSessionResolver(
        async () =>
          null,

        {
          now:
            () =>
              NOW,
        },
      );

    const resolved =
      await resolveSession(
        RAW_TOKEN,
      );

    assert.equal(
      resolved,
      null,
    );
  },
);

test(
  "session resolver rejects expired session",
  async () => {
    const resolveSession =
      createSessionResolver(
        async () => ({
          userId:
            "user-1",

          walletAddress:
            WALLET,

          expiresAt:
            new Date(
              NOW.getTime() -
              1,
            ),

          revokedAt:
            null,
        }),

        {
          now:
            () =>
              NOW,
        },
      );

    const resolved =
      await resolveSession(
        RAW_TOKEN,
      );

    assert.equal(
      resolved,
      null,
    );
  },
);

test(
  "session resolver rejects revoked session",
  async () => {
    const resolveSession =
      createSessionResolver(
        async () => ({
          userId:
            "user-1",

          walletAddress:
            WALLET,

          expiresAt:
            new Date(
              NOW.getTime() +
              60_000,
            ),

          revokedAt:
            new Date(
              NOW.getTime() -
              1_000,
            ),
        }),

        {
          now:
            () =>
              NOW,
        },
      );

    const resolved =
      await resolveSession(
        RAW_TOKEN,
      );

    assert.equal(
      resolved,
      null,
    );
  },
);

/* =========================================================
   SESSION REVOCATION
   ========================================================= */

test(
  "session revoker hashes token and supplies revocation timestamp",
  async () => {
    let receivedHash =
      "";

    let receivedDate:
      Date |
      undefined;

    const revokeSession =
      createSessionRevoker(
        async (
          tokenHash,
          revokedAt,
        ) => {
          receivedHash =
            tokenHash;

          receivedDate =
            revokedAt;

          return true;
        },

        {
          now:
            () =>
              NOW,
        },
      );

    const revoked =
      await revokeSession(
        RAW_TOKEN,
      );

    assert.equal(
      revoked,
      true,
    );

    assert.equal(
      receivedHash,
      hashSessionToken(
        RAW_TOKEN,
      ),
    );

    assert.equal(
      receivedDate
        ?.toISOString(),
      NOW.toISOString(),
    );
  },
);

test(
  "session revoker rejects empty token without database call",
  async () => {
    let called =
      false;

    const revokeSession =
      createSessionRevoker(
        async () => {
          called =
            true;

          return true;
        },
      );

    const revoked =
      await revokeSession(
        "",
      );

    assert.equal(
      revoked,
      false,
    );

    assert.equal(
      called,
      false,
    );
  },
);