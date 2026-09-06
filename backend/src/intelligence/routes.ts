import type {
  FastifyInstance,
} from "fastify";

import {
  Type,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";

import type {
  StructureAgreement,
} from "./types.js";

export interface IntelligenceRouteOptions {
  readonly structureAgreement:
    StructureAgreement;
}

const NullableStringSchema =
  Type.Union([
    Type.String(),
    Type.Null(),
  ]);

const StructureAgreementRequestSchema =
  Type.Object(
    {
      text:
        Type.String({
          minLength: 1,
          maxLength: 12_000,
          pattern: "\\S",
        }),
    },
    {
      additionalProperties:
        false,
    },
  );

const StructuredMilestoneSchema =
  Type.Object(
    {
      amount:
        NullableStringSchema,

      deliverable:
        NullableStringSchema,

      acceptanceCriteria:
        NullableStringSchema,

      deadline:
        NullableStringSchema,
    },
    {
      additionalProperties:
        false,
    },
  );

const AgreementRiskSchema =
  Type.Object(
    {
      code:
        Type.String(),

      severity:
        Type.Union([
          Type.Literal("low"),
          Type.Literal("medium"),
          Type.Literal("high"),
        ]),

      message:
        Type.String(),

      field:
        Type.Optional(
          Type.String(),
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const StructureAgreementResponseSchema =
  Type.Object(
    {
      status:
        Type.Union([
          Type.Literal(
            "needs_clarification",
          ),

          Type.Literal(
            "ready_for_review",
          ),
        ]),

      agreement:
        Type.Object(
          {
            title:
              NullableStringSchema,

            description:
              Type.String(),

            totalValue:
              NullableStringSchema,

            settlementAsset:
              NullableStringSchema,

            deadline:
              NullableStringSchema,

            approvalWindow:
              NullableStringSchema,

            milestones:
              Type.Array(
                StructuredMilestoneSchema,
              ),
          },
          {
            additionalProperties:
              false,
          },
        ),

      questions:
        Type.Array(
          Type.String(),
        ),

      risks:
        Type.Array(
          AgreementRiskSchema,
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

export function registerIntelligenceRoutes(
  app:
    FastifyInstance,

  options:
    IntelligenceRouteOptions,
): void {
  const typedApp =
    app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/api/v1/intelligence/agreements/structure",
    {
      schema: {
        body:
          StructureAgreementRequestSchema,

        response: {
          200:
            StructureAgreementResponseSchema,
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      const result =
        await options
          .structureAgreement({
            text:
              request.body.text,
          });

      return reply
        .code(200)
        .send(
          result,
        );
    },
  );
}
