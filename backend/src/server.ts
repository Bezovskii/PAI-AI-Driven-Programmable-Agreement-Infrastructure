import {
  buildApp,
} from "./app.js";

import {
  createAuthNonceIssuer,
} from "./auth/nonce.js";

import {
  createSessionIssuer,
} from "./auth/session.js";

import {
  createSiweVerifier,
} from "./auth/verify.js";

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

/* =========================================================
   AUTH NONCE
   ========================================================= */

const issueAuthNonce =
  createAuthNonceIssuer(
    async (record) => {
      await prisma.authNonce.create({
        data: {
          walletAddress:
            record.walletAddress,

          nonce:
            record.nonce,

          expiresAt:
            record.expiresAt,
        },
      });
    },
  );

/* =========================================================
   SIWE VERIFICATION
   ========================================================= */

const verifySiwe =
  createSiweVerifier(
    async (nonce) => {
      return prisma.authNonce
        .findUnique({
          where: {
            nonce,
          },

          select: {
            id:
              true,

            walletAddress:
              true,

            nonce:
              true,

            expiresAt:
              true,

            consumedAt:
              true,
          },
        });
    },

    async (
      {
        id,
        consumedAt,
      },
    ) => {
      const result =
        await prisma.authNonce
          .updateMany({
            where: {
              id,

              consumedAt:
                null,

              expiresAt: {
                gt:
                  consumedAt,
              },
            },

            data: {
              consumedAt,
            },
          });

      return (
        result.count === 1
      );
    },

    {
      domain:
        config.siweDomain,

      uri:
        config.siweUri,

      chainId:
        config.chainId,
    },
  );

/* =========================================================
   SESSION ISSUANCE
   ========================================================= */

const issueSession =
  createSessionIssuer(
    async (
      {
        walletAddress,
        tokenHash,
        expiresAt,
        lastUsedAt,
      },
    ) => {
      return prisma.$transaction(
        async (transaction) => {
          /*
           * Upsert the authenticated wallet.
           *
           * Important:
           * We select BOTH wallet.id and wallet.userId
           * because the session must now be tied to
           * the exact wallet used during SIWE.
           */
          const wallet =
            await transaction
              .wallet
              .upsert({
                where: {
                  address:
                    walletAddress,
                },

                update: {},

                create: {
                  address:
                    walletAddress,

                  user: {
                    create: {},
                  },
                },

                select: {
                  id:
                    true,

                  userId:
                    true,
                },
              });

          /*
           * Store only the HASH of the opaque session token.
           *
           * The session is bound to:
           *   - the ESCT user
           *   - the exact authenticated wallet
           */
          await transaction
            .session
            .create({
              data: {
                userId:
                  wallet.userId,

                walletId:
                  wallet.id,

                tokenHash,

                expiresAt,

                lastUsedAt,
              },
            });

          return {
            userId:
              wallet.userId,
          };
        },
      );
    },

    {
      ttlSeconds:
        config
          .sessionTtlSeconds,
    },
  );

/* =========================================================
   APPLICATION
   ========================================================= */

const app =
  buildApp({
    logger: true,

    readinessProbe:
      async () =>
        isDatabaseReady(
          prisma,
        ),

    auth: {
      issueNonce:
        issueAuthNonce,

      verifySiwe,

      issueSession,

      sessionCookie: {
        name:
          config
            .sessionCookieName,

        secure:
          config.nodeEnv ===
          "production",

        maxAgeSeconds:
          config
            .sessionTtlSeconds,
      },

      siwe: {
        domain:
          config.siweDomain,

        uri:
          config.siweUri,

        chainId:
          config.chainId,
      },
    },
  });

/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

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

/* =========================================================
   START SERVER
   ========================================================= */

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