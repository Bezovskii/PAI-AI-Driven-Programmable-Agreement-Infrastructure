import Fastify, {
  type FastifyServerOptions,
} from "fastify";

import {
  Type,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";

export type ReadinessProbe =
  () => Promise<boolean>;

export interface BuildAppOptions {
  readonly logger?:
    FastifyServerOptions["logger"];

  readonly readinessProbe:
    ReadinessProbe;
}

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
) {
  const app =
    Fastify({
      logger:
        options.logger ??
        false,
    }).withTypeProvider<TypeBoxTypeProvider>();

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

  return app;
}
