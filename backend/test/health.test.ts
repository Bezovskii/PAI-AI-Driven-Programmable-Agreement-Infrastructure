import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import {
  loadEnv,
} from "../src/config/env.js";

const TEST_DATABASE_URL =
  "postgresql://esct:test@127.0.0.1:5432/esct";

const TEST_REQUIRED_ENV:
  NodeJS.ProcessEnv = {
    DATABASE_URL:
      TEST_DATABASE_URL,

    SIWE_DOMAIN:
      "localhost:5173",

    SIWE_URI:
      "http://localhost:5173",

    CHAIN_ID:
      "31337",

    SESSION_COOKIE_NAME:
      "esct_session",

    SESSION_TTL_SECONDS:
      "604800",
  };

function buildTestApp() {
  return buildApp({
    readinessProbe:
      async () => true,
  });
}

test(
  "GET /healthz returns backend health",
  async (t) => {
    const app =
      buildTestApp();

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
          "/healthz",
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json(),
      {
        status:
          "ok",

        service:
          "esct-backend",
      },
    );
  },
);

test(
  "loadEnv uses safe runtime defaults",
  () => {
    const config =
      loadEnv(
        TEST_REQUIRED_ENV,
      );

    assert.deepEqual(
      config,
      {
        nodeEnv:
          "development",

        host:
          "127.0.0.1",

        port:
          3001,

        databaseUrl:
          TEST_DATABASE_URL,

        siweDomain:
          "localhost:5173",

        siweUri:
          "http://localhost:5173",

        chainId:
          31337,

        sessionCookieName:
          "esct_session",

        sessionTtlSeconds:
          604800,
      },
    );
  },
);

test(
  "loadEnv rejects an invalid port",
  () => {
    assert.throws(
      () => {
        loadEnv({
          ...TEST_REQUIRED_ENV,

          PORT:
            "70000",
        });
      },

      /PORT must be an integer between 1 and 65535/,
    );
  },
);

test(
  "loadEnv rejects an invalid NODE_ENV",
  () => {
    assert.throws(
      () => {
        loadEnv({
          ...TEST_REQUIRED_ENV,

          NODE_ENV:
            "banana",
        });
      },

      /Invalid NODE_ENV/,
    );
  },
);

test(
  "loadEnv requires DATABASE_URL",
  () => {
    assert.throws(
      () => {
        loadEnv({
          SIWE_DOMAIN:
            "localhost:5173",

          SIWE_URI:
            "http://localhost:5173",

          CHAIN_ID:
            "31337",
        });
      },

      /DATABASE_URL is required/,
    );
  },
);

test(
  "loadEnv rejects non-PostgreSQL DATABASE_URL",
  () => {
    assert.throws(
      () => {
        loadEnv({
          ...TEST_REQUIRED_ENV,

          DATABASE_URL:
            "mysql://localhost/example",
        });
      },

      /must use the postgresql:\/\/ or postgres:\/\//,
    );
  },
);

test(
  "loadEnv requires SIWE_DOMAIN",
  () => {
    assert.throws(
      () => {
        loadEnv({
          DATABASE_URL:
            TEST_DATABASE_URL,

          SIWE_URI:
            "http://localhost:5173",

          CHAIN_ID:
            "31337",
        });
      },

      /SIWE_DOMAIN is required/,
    );
  },
);

test(
  "loadEnv rejects a non-http SIWE_URI",
  () => {
    assert.throws(
      () => {
        loadEnv({
          ...TEST_REQUIRED_ENV,

          SIWE_URI:
            "ftp://localhost:5173",
        });
      },

      /SIWE_URI must use http:\/\/ or https:\/\//,
    );
  },
);

test(
  "loadEnv rejects an invalid CHAIN_ID",
  () => {
    assert.throws(
      () => {
        loadEnv({
          ...TEST_REQUIRED_ENV,

          CHAIN_ID:
            "0",
        });
      },

      /CHAIN_ID must be a positive safe integer/,
    );
  },
);