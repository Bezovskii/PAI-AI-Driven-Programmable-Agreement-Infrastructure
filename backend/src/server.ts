import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const config = loadEnv();

const app = buildApp({
  logger: true,
});

let shuttingDown = false;

async function shutdown(
  signal: NodeJS.Signals,
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  app.log.info(
    { signal },
    "Shutdown signal received",
  );

  try {
    await app.close();

    app.log.info(
      "ESCT backend stopped cleanly",
    );
  } catch (error) {
    app.log.error(
      error,
      "Error during shutdown",
    );

    process.exitCode = 1;
  }
}

process.once(
  "SIGINT",
  () => {
    void shutdown("SIGINT");
  },
);

process.once(
  "SIGTERM",
  () => {
    void shutdown("SIGTERM");
  },
);

try {
  await app.listen({
    host: config.host,
    port: config.port,
  });

  app.log.info(
    {
      environment: config.nodeEnv,
      host: config.host,
      port: config.port,
    },
    "ESCT backend started",
  );
} catch (error) {
  app.log.error(
    error,
    "Failed to start ESCT backend",
  );

  process.exitCode = 1;
}
