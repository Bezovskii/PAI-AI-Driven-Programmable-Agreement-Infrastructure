import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

test(
  "GET /readyz returns 200 when database is ready",
  async (t) => {
    const app =
      buildApp({
        readinessProbe:
          async () => true,
      });

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
          "/readyz",
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json(),
      {
        status:
          "ready",

        database:
          "ready",
      },
    );
  },
);

test(
  "GET /readyz returns 503 when database is unavailable",
  async (t) => {
    const app =
      buildApp({
        readinessProbe:
          async () => false,
      });

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
          "/readyz",
      });

    assert.equal(
      response.statusCode,
      503,
    );

    assert.deepEqual(
      response.json(),
      {
        status:
          "not_ready",

        database:
          "unavailable",
      },
    );
  },
);

test(
  "GET /readyz returns 503 when readiness probe throws",
  async (t) => {
    const app =
      buildApp({
        readinessProbe:
          async () => {
            throw new Error(
              "database unavailable",
            );
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
          "GET",

        url:
          "/readyz",
      });

    assert.equal(
      response.statusCode,
      503,
    );
  },
);
