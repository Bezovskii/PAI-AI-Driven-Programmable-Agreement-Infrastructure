import assert from "node:assert/strict";
import test from "node:test";

import {
  createServicePrincipalResolver,
} from "../src/auth/service.js";

const SERVICE_TOKEN =
  "telegram-service-token-for-tests-0123456789";

const WRONG_TOKEN =
  "wrong-service-token-for-tests-012345678901";

const SERVICE_USER_ID =
  "service:telegram";

test(
  "service principal resolver accepts the configured bearer token",
  async () => {
    let ensuredUserId:
      string | undefined;

    const resolveServicePrincipal =
      createServicePrincipalResolver(
        {
          token:
            SERVICE_TOKEN,

          userId:
            SERVICE_USER_ID,
        },

        async (
          userId,
        ) => {
          ensuredUserId =
            userId;
        },
      );

    const principal =
      await resolveServicePrincipal(
        `Bearer ${SERVICE_TOKEN}`,
      );

    assert.deepEqual(
      principal,
      {
        userId:
          SERVICE_USER_ID,
      },
    );

    assert.equal(
      ensuredUserId,
      SERVICE_USER_ID,
    );
  },
);

test(
  "service principal resolver rejects a wrong bearer token without ensuring a principal",
  async () => {
    let ensureCalled =
      false;

    const resolveServicePrincipal =
      createServicePrincipalResolver(
        {
          token:
            SERVICE_TOKEN,

          userId:
            SERVICE_USER_ID,
        },

        async () => {
          ensureCalled =
            true;
        },
      );

    const principal =
      await resolveServicePrincipal(
        `Bearer ${WRONG_TOKEN}`,
      );

    assert.equal(
      principal,
      null,
    );

    assert.equal(
      ensureCalled,
      false,
    );
  },
);

test(
  "service principal resolver rejects missing or malformed authorization",
  async () => {
    let ensureCallCount =
      0;

    const resolveServicePrincipal =
      createServicePrincipalResolver(
        {
          token:
            SERVICE_TOKEN,

          userId:
            SERVICE_USER_ID,
        },

        async () => {
          ensureCallCount++;
        },
      );

    assert.equal(
      await resolveServicePrincipal(
        undefined,
      ),
      null,
    );

    assert.equal(
      await resolveServicePrincipal(
        SERVICE_TOKEN,
      ),
      null,
    );

    assert.equal(
      await resolveServicePrincipal(
        `Basic ${SERVICE_TOKEN}`,
      ),
      null,
    );

    assert.equal(
      await resolveServicePrincipal(
        "Bearer",
      ),
      null,
    );

    assert.equal(
      ensureCallCount,
      0,
    );
  },
);

test(
  "service principal resolver rejects a short configured token",
  () => {
    assert.throws(
      () => {
        createServicePrincipalResolver(
          {
            token:
              "too-short",

            userId:
              SERVICE_USER_ID,
          },

          async () => {},
        );
      },

      /Service authentication token must contain at least 32 characters/,
    );
  },
);

test(
  "service principal resolver rejects an empty service user ID",
  () => {
    assert.throws(
      () => {
        createServicePrincipalResolver(
          {
            token:
              SERVICE_TOKEN,

            userId:
              "   ",
          },

          async () => {},
        );
      },

      /Service principal user ID must not be empty/,
    );
  },
);
