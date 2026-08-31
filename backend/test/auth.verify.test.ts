import assert from "node:assert/strict";
import test from "node:test";

import {
  Wallet,
} from "ethers";

import {
  SiweMessage,
} from "siwe";

import {
  buildApp,
} from "../src/app.js";

import {
  createSiweVerifier,
  InvalidSiweAuthenticationError,
  type StoredAuthNonce,
} from "../src/auth/verify.js";

const PRIVATE_KEY =
  "0x0123456789012345678901234567890123456789012345678901234567890123";

const OTHER_PRIVATE_KEY =
  "0x1123456789012345678901234567890123456789012345678901234567890123";

const wallet =
  new Wallet(
    PRIVATE_KEY,
  );

const otherWallet =
  new Wallet(
    OTHER_PRIVATE_KEY,
  );

const NONCE =
  "testNonce123456";

const NOW =
  new Date(
    "2026-08-14T09:30:00.000Z",
  );

const NONCE_EXPIRY =
  new Date(
    "2026-08-14T09:35:00.000Z",
  );

const MESSAGE_EXPIRY =
  new Date(
    "2026-08-14T09:34:00.000Z",
  );

const CONFIG = {
  domain:
    "localhost:5173",

  uri:
    "http://localhost:5173",

  chainId:
    31337,
};

interface MessageOverrides {
  readonly domain?: string;
  readonly uri?: string;
  readonly chainId?: number;
  readonly nonce?: string;
  readonly address?: string;
  readonly expirationTime?: string;
}

function makeMessage(
  overrides: MessageOverrides = {},
): string {
  const message =
    new SiweMessage({
      domain:
        overrides.domain ??
        CONFIG.domain,

      address:
        overrides.address ??
        wallet.address,

      statement:
        "Sign in to ESCT.",

      uri:
        overrides.uri ??
        CONFIG.uri,

      version:
        "1",

      chainId:
        overrides.chainId ??
        CONFIG.chainId,

      nonce:
        overrides.nonce ??
        NONCE,

      issuedAt:
        NOW.toISOString(),

      expirationTime:
        overrides.expirationTime ??
        MESSAGE_EXPIRY
          .toISOString(),
    });

  return message.prepareMessage();
}

function makeStoredNonce(
  overrides:
    Partial<StoredAuthNonce> = {},
): StoredAuthNonce {
  return {
    id:
      "nonce-record-1",

    walletAddress:
      wallet.address,

    nonce:
      NONCE,

    expiresAt:
      NONCE_EXPIRY,

    consumedAt:
      null,

    ...overrides,
  };
}

function buildVerifier(
  stored:
    StoredAuthNonce | null =
      makeStoredNonce(),
  consumeResult = true,
) {
  let consumed:
    {
      id: string;
      consumedAt: Date;
    } |
    undefined;

  const verifySiwe =
    createSiweVerifier(
      async () =>
        stored,

      async (input) => {
        consumed =
          input;

        return consumeResult;
      },

      CONFIG,

      {
        now:
          () =>
            NOW,
      },
    );

  return {
    verifySiwe,

    getConsumed:
      () =>
        consumed,
  };
}

test(
  "SIWE verifier accepts valid wallet signature and consumes nonce",
  async () => {
    const {
      verifySiwe,
      getConsumed,
    } =
      buildVerifier();

    const message =
      makeMessage();

    const signature =
      await wallet.signMessage(
        message,
      );

    const result =
      await verifySiwe({
        message,
        signature,
      });

    assert.deepEqual(
      result,
      {
        walletAddress:
          wallet.address,

        nonce:
          NONCE,
      },
    );

    assert.deepEqual(
      getConsumed(),
      {
        id:
          "nonce-record-1",

        consumedAt:
          NOW,
      },
    );
  },
);

test(
  "SIWE verifier rejects signature from another wallet",
  async () => {
    const {
      verifySiwe,
      getConsumed,
    } =
      buildVerifier();

    const message =
      makeMessage();

    const signature =
      await otherWallet
        .signMessage(
          message,
        );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      InvalidSiweAuthenticationError,
    );

    assert.equal(
      getConsumed(),
      undefined,
    );
  },
);

test(
  "SIWE verifier rejects wrong domain",
  async () => {
    const {
      verifySiwe,
    } =
      buildVerifier();

    const message =
      makeMessage({
        domain:
          "evil.example",
      });

    const signature =
      await wallet.signMessage(
        message,
      );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      InvalidSiweAuthenticationError,
    );
  },
);

test(
  "SIWE verifier rejects wrong URI",
  async () => {
    const {
      verifySiwe,
    } =
      buildVerifier();

    const message =
      makeMessage({
        uri:
          "https://evil.example",
      });

    const signature =
      await wallet.signMessage(
        message,
      );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      InvalidSiweAuthenticationError,
    );
  },
);

test(
  "SIWE verifier rejects wrong chain ID",
  async () => {
    const {
      verifySiwe,
    } =
      buildVerifier();

    const message =
      makeMessage({
        chainId:
          1,
      });

    const signature =
      await wallet.signMessage(
        message,
      );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      InvalidSiweAuthenticationError,
    );
  },
);

test(
  "SIWE verifier rejects expired server nonce",
  async () => {
    const {
      verifySiwe,
      getConsumed,
    } =
      buildVerifier(
        makeStoredNonce({
          expiresAt:
            new Date(
              "2026-08-14T09:29:59.000Z",
            ),
        }),
      );

    const message =
      makeMessage();

    const signature =
      await wallet.signMessage(
        message,
      );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      InvalidSiweAuthenticationError,
    );

    assert.equal(
      getConsumed(),
      undefined,
    );
  },
);

test(
  "SIWE verifier rejects already consumed nonce",
  async () => {
    const {
      verifySiwe,
    } =
      buildVerifier(
        makeStoredNonce({
          consumedAt:
            new Date(
              "2026-08-14T09:28:00.000Z",
            ),
        }),
      );

    const message =
      makeMessage();

    const signature =
      await wallet.signMessage(
        message,
      );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      InvalidSiweAuthenticationError,
    );
  },
);

test(
  "SIWE verifier rejects atomic nonce consumption race",
  async () => {
    const {
      verifySiwe,
    } =
      buildVerifier(
        makeStoredNonce(),
        false,
      );

    const message =
      makeMessage();

    const signature =
      await wallet.signMessage(
        message,
      );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      InvalidSiweAuthenticationError,
    );
  },
);

test(
  "POST /api/v1/auth/verify accepts valid SIWE authentication",
  async (t) => {
    const {
      verifySiwe,
    } =
      buildVerifier();

    const app =
      buildApp({
        readinessProbe:
          async () => true,

        auth: {
          issueNonce:
            async () => ({
              walletAddress:
                wallet.address,

              nonce:
                NONCE,

              expiresAt:
                NONCE_EXPIRY,
            }),

          verifySiwe,

          siwe:
            CONFIG,
        },
      });

    t.after(
      async () => {
        await app.close();
      },
    );

    const message =
      makeMessage();

    const signature =
      await wallet.signMessage(
        message,
      );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          "/api/v1/auth/verify",

        payload: {
          message,
          signature,
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json(),
      {
        authenticated:
          true,

        walletAddress:
          wallet.address,
      },
    );
  },
);

test(
  "POST /api/v1/auth/verify returns 401 for invalid signature",
  async (t) => {
    const {
      verifySiwe,
    } =
      buildVerifier();

    const app =
      buildApp({
        readinessProbe:
          async () => true,

        auth: {
          issueNonce:
            async () => ({
              walletAddress:
                wallet.address,

              nonce:
                NONCE,

              expiresAt:
                NONCE_EXPIRY,
            }),

          verifySiwe,

          siwe:
            CONFIG,
        },
      });

    t.after(
      async () => {
        await app.close();
      },
    );

    const message =
      makeMessage();

    const signature =
      await otherWallet
        .signMessage(
          message,
        );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          "/api/v1/auth/verify",

        payload: {
          message,
          signature,
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
          "invalid_siwe_authentication",
      },
    );
  },
);
test(
  "SIWE verifier rejects nonexistent nonce",
  async () => {
    const {
      verifySiwe,
      getConsumed,
    } =
      buildVerifier(
        null,
      );

    const message =
      makeMessage();

    const signature =
      await wallet.signMessage(
        message,
      );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      (error: unknown) => {
        assert.ok(
          error instanceof
            InvalidSiweAuthenticationError,
        );

        assert.equal(
          error.reason,
          "nonce_not_found",
        );

        return true;
      },
    );

    assert.equal(
      getConsumed(),
      undefined,
    );
  },
);

test(
  "SIWE verifier rejects wallet that does not match stored nonce",
  async () => {
    const {
      verifySiwe,
      getConsumed,
    } =
      buildVerifier(
        makeStoredNonce({
          walletAddress:
            otherWallet.address,
        }),
      );

    const message =
      makeMessage();

    const signature =
      await wallet.signMessage(
        message,
      );

    await assert.rejects(
      verifySiwe({
        message,
        signature,
      }),
      (error: unknown) => {
        assert.ok(
          error instanceof
            InvalidSiweAuthenticationError,
        );

        assert.equal(
          error.reason,
          "wallet_mismatch",
        );

        return true;
      },
    );

    assert.equal(
      getConsumed(),
      undefined,
    );
  },
);
