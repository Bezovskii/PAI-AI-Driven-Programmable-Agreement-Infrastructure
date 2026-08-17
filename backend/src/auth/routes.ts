import type {
  FastifyInstance,
} from "fastify";

import {
  Type,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";

import {
  InvalidWalletAddressError,
  type IssueAuthNonce,
} from "./nonce.js";

import {
  type IssueSession,
  type ResolveSession,
  type RevokeSession,
} from "./session.js";

import {
  InvalidSiweAuthenticationError,
  type VerifySiwe,
} from "./verify.js";

export interface SiwePublicConfig {
  readonly domain: string;
  readonly uri: string;
  readonly chainId: number;
}

export interface SessionCookieConfig {
  readonly name: string;
  readonly secure: boolean;
  readonly maxAgeSeconds: number;
}

export interface AuthRouteOptions {
  readonly issueNonce:
  IssueAuthNonce;

  readonly verifySiwe?:
  VerifySiwe;

  readonly issueSession?:
  IssueSession;

  readonly resolveSession?:
  ResolveSession;

  readonly revokeSession?:
  RevokeSession;

  readonly sessionCookie?:
  SessionCookieConfig;

  readonly siwe:
  SiwePublicConfig;
}

const ValidationErrorResponseSchema =
  Type.Object(
    {
      statusCode:
        Type.Integer(),

      error:
        Type.String(),

      message:
        Type.String(),
    },
    {
      additionalProperties:
        true,
    },
  );

const NonceRequestSchema =
  Type.Object(
    {
      walletAddress:
        Type.String({
          minLength: 1,
          maxLength: 128,
        }),
    },
    {
      additionalProperties:
        false,
    },
  );

const NonceResponseSchema =
  Type.Object(
    {
      walletAddress:
        Type.String(),

      nonce:
        Type.String(),

      expiresAt:
        Type.String(),

      domain:
        Type.String(),

      uri:
        Type.String(),

      version:
        Type.Literal("1"),

      chainId:
        Type.Integer({
          minimum: 1,
        }),
    },
    {
      additionalProperties:
        false,
    },
  );

const InvalidWalletResponseSchema =
  Type.Object(
    {
      error:
        Type.Literal(
          "invalid_wallet_address",
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const NonceBadRequestResponseSchema =
  Type.Union([
    InvalidWalletResponseSchema,
    ValidationErrorResponseSchema,
  ]);

const VerifyRequestSchema =
  Type.Object(
    {
      message:
        Type.String({
          minLength: 1,
          maxLength: 8192,
        }),

      signature:
        Type.String({
          minLength: 1,
          maxLength: 2048,
        }),
    },
    {
      additionalProperties:
        false,
    },
  );

const VerifyResponseSchema =
  Type.Object(
    {
      authenticated:
        Type.Literal(true),

      walletAddress:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const SiweAuthenticationFailureSchema =
  Type.Object(
    {
      error:
        Type.Literal(
          "invalid_siwe_authentication",
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const SessionResponseSchema =
  Type.Object(
    {
      authenticated:
        Type.Literal(true),

      walletAddress:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const SessionAuthenticationFailureSchema =
  Type.Object(
    {
      error:
        Type.Literal(
          "unauthenticated",
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const LogoutResponseSchema =
  Type.Object(
    {
      loggedOut:
        Type.Literal(true),
    },
    {
      additionalProperties:
        false,
    },
  );

export function registerAuthRoutes(
  app: FastifyInstance,
  options: AuthRouteOptions,
): void {
  const typedApp =
    app.withTypeProvider<TypeBoxTypeProvider>();

  /* =======================================================
     NONCE
     ======================================================= */

  typedApp.post(
    "/api/v1/auth/nonce",
    {
      schema: {
        body:
          NonceRequestSchema,

        response: {
          200:
            NonceResponseSchema,

          400:
            NonceBadRequestResponseSchema,
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      try {
        const issued =
          await options.issueNonce(
            request.body
              .walletAddress,
          );

        return reply
          .code(200)
          .send({
            walletAddress:
              issued.walletAddress,

            nonce:
              issued.nonce,

            expiresAt:
              issued.expiresAt
                .toISOString(),

            domain:
              options.siwe.domain,

            uri:
              options.siwe.uri,

            version:
              "1" as const,

            chainId:
              options.siwe.chainId,
          });
      } catch (error) {
        if (
          error instanceof
          InvalidWalletAddressError
        ) {
          return reply
            .code(400)
            .send({
              error:
                "invalid_wallet_address",
            });
        }

        throw error;
      }
    },
  );

  const verifySiwe =
    options.verifySiwe;

  const issueSession =
    options.issueSession;

  const resolveSession =
    options.resolveSession;

  const revokeSession =
    options.revokeSession;

  const sessionCookie =
    options.sessionCookie;

  if (
    issueSession &&
    !sessionCookie
  ) {
    throw new Error(
      "issueSession requires sessionCookie.",
    );
  }

  if (
    (
      resolveSession ||
      revokeSession
    ) &&
    !sessionCookie
  ) {
    throw new Error(
      "Session lifecycle requires sessionCookie.",
    );
  }

  /* =======================================================
     SIWE VERIFY + SESSION ISSUANCE
     ======================================================= */

  if (verifySiwe) {
    typedApp.post(
      "/api/v1/auth/verify",
      {
        schema: {
          body:
            VerifyRequestSchema,

          response: {
            200:
              VerifyResponseSchema,

            400:
              ValidationErrorResponseSchema,

            401:
              SiweAuthenticationFailureSchema,
          },
        },
      },
      async (
        request,
        reply,
      ) => {
        try {
          const verified =
            await verifySiwe({
              message:
                request.body.message,

              signature:
                request.body.signature,
            });

          if (
            issueSession &&
            sessionCookie
          ) {
            const session =
              await issueSession(
                verified.walletAddress,
              );

            reply.setCookie(
              sessionCookie.name,
              session.token,
              {
                httpOnly:
                  true,

                secure:
                  sessionCookie.secure,

                sameSite:
                  "lax",

                path:
                  "/",

                maxAge:
                  sessionCookie
                    .maxAgeSeconds,

                expires:
                  session.expiresAt,
              },
            );
          }

          return reply
            .code(200)
            .send({
              authenticated:
                true as const,

              walletAddress:
                verified.walletAddress,
            });
        } catch (error) {
          if (
            error instanceof
            InvalidSiweAuthenticationError
          ) {
            return reply
              .code(401)
              .send({
                error:
                  "invalid_siwe_authentication",
              });
          }

          throw error;
        }
      },
    );
  }

  /* =======================================================
     SESSION RESTORE
     ======================================================= */

  if (
    resolveSession &&
    sessionCookie
  ) {
    typedApp.get(
      "/api/v1/auth/session",
      {
        schema: {
          response: {
            200:
              SessionResponseSchema,

            401:
              SessionAuthenticationFailureSchema,
          },
        },
      },
      async (
        request,
        reply,
      ) => {
        const rawToken =
          request.cookies[
          sessionCookie.name
          ];

        if (!rawToken) {
          return reply
            .code(401)
            .send({
              error:
                "unauthenticated",
            });
        }

        const session =
          await resolveSession(
            rawToken,
          );

        if (!session) {
          return reply
            .code(401)
            .send({
              error:
                "unauthenticated",
            });
        }

        return reply
          .code(200)
          .send({
            authenticated:
              true as const,

            walletAddress:
              session.walletAddress,
          });
      },
    );
  }

  /* =======================================================
     LOGOUT / SESSION REVOCATION
     ======================================================= */

  if (
    revokeSession &&
    sessionCookie
  ) {
    typedApp.post(
      "/api/v1/auth/logout",
      {
        schema: {
          response: {
            200:
              LogoutResponseSchema,
          },
        },
      },
      async (
        request,
        reply,
      ) => {
        const rawToken =
          request.cookies[
          sessionCookie.name
          ];

        if (rawToken) {
          await revokeSession(
            rawToken,
          );
        }

        reply.clearCookie(
          sessionCookie.name,
          {
            path:
              "/",

            secure:
              sessionCookie.secure,

            sameSite:
              "lax",
          },
        );

        return reply
          .code(200)
          .send({
            loggedOut:
              true as const,
          });
      },
    );
  }
}