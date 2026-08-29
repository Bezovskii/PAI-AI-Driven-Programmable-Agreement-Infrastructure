import type {
  FastifyInstance,
} from "fastify";

import {
  Type,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";

import type {
  ResolveSession,
} from "../auth/session.js";

import {
  SettlementBindingAccessError,
  SettlementBindingConflictError,
  SettlementBindingNotFoundError,
  type SettlementBindingOperations,
} from "./service.js";

/* =========================================================
   OPTIONS
   ========================================================= */

export interface SettlementBindingRouteOptions {
  readonly resolveSession:
    ResolveSession;

  readonly sessionCookieName:
    string;

  readonly operations:
    SettlementBindingOperations;
}

/* =========================================================
   SCHEMAS
   ========================================================= */

const AgreementParamsSchema =
  Type.Object(
    {
      id:
        Type.String({
          minLength: 1,
        }),
    },
    {
      additionalProperties:
        false,
    },
  );

const AgreementBindingParamsSchema =
  Type.Object(
    {
      id:
        Type.String({
          minLength: 1,
        }),

      bindingId:
        Type.String({
          minLength: 1,
        }),

      milestoneId:
        Type.String({
          minLength: 1,
        }),
    },
    {
      additionalProperties:
        false,
    },
  );

const CreateAgreementBindingBodySchema =
  Type.Object(
    {
      provider:
        Type.String({
          minLength: 1,
        }),

      chainId:
        Type.Integer({
          minimum: 1,
        }),

      contractAddress:
        Type.String({
          minLength: 1,
        }),

      externalAgreementId:
        Type.String({
          minLength: 1,
        }),
    },
    {
      additionalProperties:
        false,
    },
  );

const CreateMilestoneBindingBodySchema =
  Type.Object(
    {
      externalMilestoneId:
        Type.String({
          minLength: 1,
        }),
    },
    {
      additionalProperties:
        false,
    },
  );

/* =========================================================
   AUTHENTICATED ACTOR
   ========================================================= */

async function resolveActor(
  cookies:
    Record<
      string,
      string | undefined
    >,
  options:
    SettlementBindingRouteOptions,
): Promise<{
  readonly userId:
    string;

  readonly walletAddress:
    string;
} | null> {
  const rawToken =
    cookies[
      options.sessionCookieName
    ];

  if (
    !rawToken
  ) {
    return null;
  }

  const session =
    await options
      .resolveSession(
        rawToken,
      );

  if (
    !session
  ) {
    return null;
  }

  return {
    userId:
      session.userId,

    walletAddress:
      session.walletAddress,
  };
}

/* =========================================================
   DOMAIN ERROR MAPPING
   ========================================================= */

function sendDomainError(
  error:
    unknown,
  reply: {
    code(
      statusCode:
        403 | 404 | 409,
    ): {
      send(
        payload:
          object,
      ): unknown;
    };
  },
): unknown {
  if (
    error instanceof
    SettlementBindingAccessError
  ) {
    return reply
      .code(403)
      .send({
        error:
          "settlement_binding_forbidden",
      });
  }

  if (
    error instanceof
    SettlementBindingNotFoundError
  ) {
    return reply
      .code(404)
      .send({
        error:
          "settlement_binding_not_found",
      });
  }

  if (
    error instanceof
    SettlementBindingConflictError
  ) {
    return reply
      .code(409)
      .send({
        error:
          "settlement_binding_conflict",
      });
  }

  throw error;
}

/* =========================================================
   ROUTES

   These routes only persist/read external settlement mappings.
   They do not fund, release, dispute, refund, or arbitrate.
   ========================================================= */

export function registerSettlementBindingRoutes(
  app:
    FastifyInstance,
  options:
    SettlementBindingRouteOptions,
): void {
  const typedApp =
    app.withTypeProvider<
      TypeBoxTypeProvider
    >();

  /* -------------------------------------------------------
     CREATE AGREEMENT SETTLEMENT BINDING
     ------------------------------------------------------- */

  typedApp.post(
    "/api/v1/agreements/:id/settlement-bindings",
    {
      schema: {
        params:
          AgreementParamsSchema,

        body:
          CreateAgreementBindingBodySchema,
      },
    },

    async (
      request,
      reply,
    ) => {
      const actor =
        await resolveActor(
          request.cookies,
          options,
        );

      if (
        !actor
      ) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const binding =
          await options
            .operations
            .createAgreementBinding({
              actor,

              agreementId:
                request.params.id,

              provider:
                request.body.provider,

              chainId:
                request.body.chainId,

              contractAddress:
                request.body
                  .contractAddress,

              externalAgreementId:
                request.body
                  .externalAgreementId,
            });

        return reply
          .code(201)
          .send(
            binding,
          );
      } catch (error) {
        return sendDomainError(
          error,
          reply,
        );
      }
    },
  );

  /* -------------------------------------------------------
     READ AGREEMENT SETTLEMENT BINDINGS
     ------------------------------------------------------- */

  typedApp.get(
    "/api/v1/agreements/:id/settlement-bindings",
    {
      schema: {
        params:
          AgreementParamsSchema,
      },
    },

    async (
      request,
      reply,
    ) => {
      const actor =
        await resolveActor(
          request.cookies,
          options,
        );

      if (
        !actor
      ) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const bindings =
          await options
            .operations
            .getAgreementBindings({
              actor,

              agreementId:
                request.params.id,
            });

        return reply
          .code(200)
          .send({
            bindings,
          });
      } catch (error) {
        return sendDomainError(
          error,
          reply,
        );
      }
    },
  );

  /* -------------------------------------------------------
     CREATE MILESTONE SETTLEMENT BINDING
     ------------------------------------------------------- */

  typedApp.post(
    "/api/v1/agreements/:id/settlement-bindings/:bindingId/milestones/:milestoneId",
    {
      schema: {
        params:
          AgreementBindingParamsSchema,

        body:
          CreateMilestoneBindingBodySchema,
      },
    },

    async (
      request,
      reply,
    ) => {
      const actor =
        await resolveActor(
          request.cookies,
          options,
        );

      if (
        !actor
      ) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const binding =
          await options
            .operations
            .createMilestoneBinding({
              actor,

              agreementId:
                request.params.id,

              agreementSettlementBindingId:
                request.params
                  .bindingId,

              milestoneId:
                request.params
                  .milestoneId,

              externalMilestoneId:
                request.body
                  .externalMilestoneId,
            });

        return reply
          .code(201)
          .send(
            binding,
          );
      } catch (error) {
        return sendDomainError(
          error,
          reply,
        );
      }
    },
  );
}