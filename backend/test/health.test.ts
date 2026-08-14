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
  "loadEnv uses safe non-database defaults",
  () => {
    const config =
      loadEnv({
        DATABASE_URL:
          TEST_DATABASE_URL,
      });

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
          DATABASE_URL:
            TEST_DATABASE_URL,

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
          DATABASE_URL:
            TEST_DATABASE_URL,

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
        loadEnv({});
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
          DATABASE_URL:
            "mysql://localhost/example",
        });
      },

      /must use the postgresql:\/\/ or postgres:\/\//,
    );
  },
);
