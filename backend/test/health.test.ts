import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";

test(
  "GET /healthz returns backend health",
  async (t) => {
    const app = buildApp();

    t.after(
      async () => {
        await app.close();
      },
    );

    const response =
      await app.inject({
        method: "GET",
        url: "/healthz",
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json(),
      {
        status: "ok",
        service: "esct-backend",
      },
    );
  },
);

test(
  "loadEnv uses safe development defaults",
  () => {
    const config = loadEnv({});

    assert.deepEqual(
      config,
      {
        nodeEnv: "development",
        host: "127.0.0.1",
        port: 3001,
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
          PORT: "70000",
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
          NODE_ENV: "banana",
        });
      },
      /Invalid NODE_ENV/,
    );
  },
);
