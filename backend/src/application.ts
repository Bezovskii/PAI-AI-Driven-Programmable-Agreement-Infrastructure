import cookie from "@fastify/cookie";

import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

import {
  Type,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";

import {
  registerAuthRoutes,
  type AuthRouteOptions,
} from "./auth/routes.js";

import {
  registerAgreementRoutes,
  type AgreementRouteOptions,
} from "./agreements/routes.js";

import {
  registerSettlementBindingRoutes,
  type SettlementBindingRouteOptions,
} from "./settlement-bindings/routes.js";

import {
  registerIntelligenceRoutes,
  type IntelligenceRouteOptions,
} from "./intelligence/routes.js";

export type ReadinessProbe =
  () => Promise<boolean>;

export interface BuildAppOptions {
  readonly logger?:
  FastifyServerOptions["logger"];

  readonly readinessProbe:
  ReadinessProbe;

  readonly auth?:
    AuthRouteOptions;

  readonly agreements?:
    AgreementRouteOptions;

  readonly settlementBindings?:
    SettlementBindingRouteOptions;


  readonly intelligence?:
    IntelligenceRouteOptions;}

const HealthResponseSchema =
  Type.Object(
    {
      status:
        Type.Literal("ok"),

      service:
        Type.Literal(
          "esct-backend",
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const ReadyResponseSchema =
  Type.Object(
    {
      status:
        Type.Literal("ready"),

      database:
        Type.Literal("ready"),
    },
    {
      additionalProperties:
        false,
    },
  );

const NotReadyResponseSchema =
  Type.Object(
    {
      status:
        Type.Literal(
          "not_ready",
        ),

      database:
        Type.Literal(
          "unavailable",
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

export function buildApp(
  options: BuildAppOptions,
  existingApp?: FastifyInstance,
) {
  const app =
    (
      existingApp ??
      Fastify({
        logger:
          options.logger ??
          false,
      })
    ).withTypeProvider<TypeBoxTypeProvider>();

  app.register(
    cookie,
  );

  app.get(
    "/healthz",
    {
      schema: {
        response: {
          200:
            HealthResponseSchema,
        },
      },
    },
    async () => {
      return {
        status:
          "ok" as const,

        service:
          "esct-backend" as const,
      };
    },
  );

  app.get(
    "/readyz",
    {
      schema: {
        response: {
          200:
            ReadyResponseSchema,

          503:
            NotReadyResponseSchema,
        },
      },
    },
    async (
      _request,
      reply,
    ) => {
      try {
        const ready =
          await options
            .readinessProbe();

        if (!ready) {
          return reply
            .code(503)
            .send({
              status:
                "not_ready",

              database:
                "unavailable",
            });
        }

        return reply
          .code(200)
          .send({
            status:
              "ready",

            database:
              "ready",
          });
      } catch {
        return reply
          .code(503)
          .send({
            status:
              "not_ready",

            database:
              "unavailable",
          });
      }
    },
  );

  if (options.auth) {
    registerAuthRoutes(
      app,
      options.auth,
    );
  }

  if (options.agreements) {
    registerAgreementRoutes(
      app,
      options.agreements,
    );
  }

  if (options.settlementBindings) {
    registerSettlementBindingRoutes(
      app,
      options.settlementBindings,
    );
  }

  if (options.intelligence) {
    registerIntelligenceRoutes(
      app,
      options.intelligence,
    );
  }

  return app;
}