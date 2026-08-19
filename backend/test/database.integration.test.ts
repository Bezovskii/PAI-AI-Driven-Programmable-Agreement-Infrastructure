import assert from "node:assert/strict";
import test from "node:test";

import {
  loadEnv,
} from "../src/config/env.js";

import {
  createPrismaClient,
  isDatabaseReady,
} from "../src/db/prisma.js";

test(
  "Prisma connects to local PostgreSQL",
  async (t) => {
    const config =
      loadEnv();

    const prisma =
      createPrismaClient(
        config.databaseUrl,
      );

    t.after(
      async () => {
        await prisma.$disconnect();
      },
    );

    const ready =
      await isDatabaseReady(
        prisma,
      );

    assert.equal(
      ready,
      true,
    );
  },
);
