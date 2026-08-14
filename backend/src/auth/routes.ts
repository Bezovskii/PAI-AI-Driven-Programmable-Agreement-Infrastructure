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

export interface SiwePublicConfig {
  readonly domain: string;
  readonly uri: string;
  readonly chainId: number;
}

export interface AuthRouteOptions {
  readonly issueNonce:
    IssueAuthNonce;

  readonly siwe:
    SiwePublicConfig;
}

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

const BadRequestResponseSchema =
  Type.Union([
    InvalidWalletResponseSchema,
    ValidationErrorResponseSchema,
  ]);

export function registerAuthRoutes(
  app: FastifyInstance,
  options: AuthRouteOptions,
): void {
  const typedApp =
    app.withTypeProvider<TypeBoxTypeProvider>();

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
            BadRequestResponseSchema,
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
}