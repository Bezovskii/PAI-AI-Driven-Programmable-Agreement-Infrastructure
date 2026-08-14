import {
  buildApp,
} from "./app.js";

import {
  loadEnv,
} from "./config/env.js";

import {
  createPrismaClient,
  isDatabaseReady,
} from "./db/prisma.js";

const config =
  loadEnv();

const prisma =
  createPrismaClient(
    config.databaseUrl,
  );

const app =
  buildApp({
    logger: true,

    readinessProbe:
      async () =>
        isDatabaseReady(
          prisma,
        ),
  });

let shuttingDown =
  false;

async function shutdown(
  signal: NodeJS.Signals,
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown =
    true;

  app.log.info(
    { signal },
    "Shutdown signal received",
  );

  let failed =
    false;

  try {
    await app.close();
  } catch (error) {
    failed = true;

    app.log.error(
      error,
      "Failed to close HTTP server",
    );
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    failed = true;

    app.log.error(
      error,
      "Failed to disconnect database",
    );
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  app.log.info(
    "ESCT backend stopped cleanly",
  );
}

process.once(
  "SIGINT",
  () => {
    void shutdown(
      "SIGINT",
    );
  },
);

process.once(
  "SIGTERM",
  () => {
    void shutdown(
      "SIGTERM",
    );
  },
);

try {
  await app.listen({
    host:
      config.host,

    port:
      config.port,
  });

  app.log.info(
    {
      environment:
        config.nodeEnv,

      host:
        config.host,

      port:
        config.port,
    },
    "ESCT backend started",
  );
} catch (error) {
  app.log.error(
    error,
    "Failed to start ESCT backend",
  );

  try {
    await prisma.$disconnect();
  } catch {
    // Startup has already failed.
  }

  process.exitCode = 1;
}
