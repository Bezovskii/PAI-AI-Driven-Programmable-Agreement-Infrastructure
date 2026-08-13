import Fastify, {
  type FastifyServerOptions,
} from "fastify";

import {
  Type,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";

export interface BuildAppOptions {
  readonly logger?: FastifyServerOptions["logger"];
}

const HealthResponseSchema =
  Type.Object(
    {
      status: Type.Literal("ok"),
      service: Type.Literal(
        "esct-backend",
      ),
    },
    {
      additionalProperties: false,
    },
  );

export function buildApp(
  options: BuildAppOptions = {},
) {
  const app = Fastify({
    logger: options.logger ?? false,
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.get(
    "/healthz",
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => {
      return {
        status: "ok" as const,
        service: "esct-backend" as const,
      };
    },
  );

  return app;
}
