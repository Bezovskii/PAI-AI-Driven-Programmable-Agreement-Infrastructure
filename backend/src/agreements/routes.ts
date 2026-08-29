import type {
  FastifyInstance,
} from "fastify";

import {
  Type,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";

import type {
  ResolveSession,
  ResolvedSession,
} from "../auth/session.js";

/* =========================================================
   PAI HTTP DOMAIN TYPES
   ========================================================= */

export interface AgreementRouteActor {
  readonly userId: string;
  readonly walletAddress: string;
}

export interface AgreementRouteResult {
  readonly id: string;
  readonly status: string;
}

export interface MilestoneRouteResult {
  readonly id: string;
  readonly agreementId: string;
  readonly position: number;
  readonly status: string;
}

export interface EvidenceRouteResult {
  readonly id: string;
  readonly milestoneId: string;
  readonly uri: string;
  readonly hash: string | null;
}

export interface AgreementView {
  readonly id: string;
  readonly status: string;
  readonly title: string | null;
  readonly metadataUri: string | null;
  readonly termsHash: string | null;
  readonly termsVersion: number;

  readonly parties: Array<{
    readonly id: string;
    readonly walletAddress: string;
    readonly role: string;
  }>;

  readonly milestones: Array<{
    readonly id: string;
    readonly position: number;
    readonly title: string | null;
    readonly specificationUri: string | null;
    readonly amount: string | null;
    readonly asset: string | null;
    readonly status: string;

    readonly evidence: Array<{
      readonly id: string;
      readonly uri: string;
      readonly hash: string | null;
      readonly description: string | null;
    }>;
  }>;
}

/* =========================================================
   PAI AGREEMENT OPERATIONS
   ========================================================= */

export interface CreateAgreementInput {
  readonly actor:
    AgreementRouteActor;

  readonly contractorWalletAddress:
    string;

  readonly title?:
    string | undefined;

  readonly metadataUri?:
    string | undefined;

  readonly termsHash?:
    string | undefined;
}

export interface AddMilestoneInput {
  readonly actor:
    AgreementRouteActor;

  readonly agreementId:
    string;

  readonly title?:
    string | undefined;

  readonly specificationUri?:
    string | undefined;

  readonly amount?:
    string | undefined;

  readonly asset?:
    string | undefined;
}

export interface AgreementActionInput {
  readonly actor:
    AgreementRouteActor;

  readonly agreementId:
    string;
}

export interface SubmitEvidenceInput {
  readonly actor:
    AgreementRouteActor;

  readonly agreementId:
    string;

  readonly milestoneId:
    string;

  readonly uri:
    string;

  readonly hash?:
    string | undefined;

  readonly description?:
    string | undefined;
}

export interface AgreementRouteOperations {
  readonly createAgreement:
    (
      input:
        CreateAgreementInput,
    ) => Promise<AgreementRouteResult>;

  readonly getAgreement:
    (
      input:
        AgreementActionInput,
    ) => Promise<AgreementView | null>;

  readonly addMilestone:
    (
      input:
        AddMilestoneInput,
    ) => Promise<MilestoneRouteResult>;

  readonly proposeAgreement:
    (
      input:
        AgreementActionInput,
    ) => Promise<AgreementRouteResult>;

  readonly acceptAgreement:
    (
      input:
        AgreementActionInput,
    ) => Promise<AgreementRouteResult>;

  readonly submitEvidence:
    (
      input:
        SubmitEvidenceInput,
    ) => Promise<EvidenceRouteResult>;
}

export interface AgreementRouteOptions {
  readonly resolveSession:
    ResolveSession;

  readonly sessionCookieName:
    string;

  readonly operations:
    AgreementRouteOperations;
}

/* =========================================================
   DOMAIN ERRORS
   ========================================================= */

export class AgreementNotFoundError
  extends Error {
  constructor() {
    super(
      "Agreement not found.",
    );

    this.name =
      "AgreementNotFoundError";
  }
}

export class AgreementAccessError
  extends Error {
  constructor(
    message =
      "Agreement action is not permitted.",
  ) {
    super(message);

    this.name =
      "AgreementAccessError";
  }
}

export class AgreementConflictError
  extends Error {
  constructor(
    message =
      "Agreement action conflicts with the current state.",
  ) {
    super(message);

    this.name =
      "AgreementConflictError";
  }
}

/* =========================================================
   HTTP SCHEMAS
   ========================================================= */

const IdParamsSchema =
  Type.Object(
    {
      id:
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

const MilestoneParamsSchema =
  Type.Object(
    {
      id:
        Type.String({
          minLength: 1,
          maxLength: 128,
        }),

      milestoneId:
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

const CreateAgreementBodySchema =
  Type.Object(
    {
      contractorWalletAddress:
        Type.String({
          minLength: 1,
          maxLength: 128,
        }),

      title:
        Type.Optional(
          Type.String({
            maxLength: 300,
          }),
        ),

      metadataUri:
        Type.Optional(
          Type.String({
            maxLength: 4096,
          }),
        ),

      termsHash:
        Type.Optional(
          Type.String({
            maxLength: 256,
          }),
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const AddMilestoneBodySchema =
  Type.Object(
    {
      title:
        Type.Optional(
          Type.String({
            maxLength: 300,
          }),
        ),

      specificationUri:
        Type.Optional(
          Type.String({
            maxLength: 4096,
          }),
        ),

      amount:
        Type.Optional(
          Type.String({
            maxLength: 128,
          }),
        ),

      asset:
        Type.Optional(
          Type.String({
            maxLength: 128,
          }),
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const SubmitEvidenceBodySchema =
  Type.Object(
    {
      uri:
        Type.String({
          minLength: 1,
          maxLength: 4096,
        }),

      hash:
        Type.Optional(
          Type.String({
            maxLength: 256,
          }),
        ),

      description:
        Type.Optional(
          Type.String({
            maxLength: 4000,
          }),
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const AgreementResultSchema =
  Type.Object(
    {
      id:
        Type.String(),

      status:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const MilestoneResultSchema =
  Type.Object(
    {
      id:
        Type.String(),

      agreementId:
        Type.String(),

      position:
        Type.Integer({
          minimum: 1,
        }),

      status:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const EvidenceResultSchema =
  Type.Object(
    {
      id:
        Type.String(),

      milestoneId:
        Type.String(),

      uri:
        Type.String(),

      hash:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),
    },
    {
      additionalProperties:
        false,
    },
  );

const EvidenceViewSchema =
  Type.Object(
    {
      id:
        Type.String(),

      uri:
        Type.String(),

      hash:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

      description:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),
    },
    {
      additionalProperties:
        false,
    },
  );

const MilestoneViewSchema =
  Type.Object(
    {
      id:
        Type.String(),

      position:
        Type.Integer(),

      title:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

      specificationUri:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

      amount:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

      asset:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

      status:
        Type.String(),

      evidence:
        Type.Array(
          EvidenceViewSchema,
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const PartyViewSchema =
  Type.Object(
    {
      id:
        Type.String(),

      walletAddress:
        Type.String(),

      role:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const AgreementViewSchema =
  Type.Object(
    {
      id:
        Type.String(),

      status:
        Type.String(),

      title:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

      metadataUri:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

      termsHash:
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

      termsVersion:
        Type.Integer(),

      parties:
        Type.Array(
          PartyViewSchema,
        ),

      milestones:
        Type.Array(
          MilestoneViewSchema,
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const UnauthenticatedSchema =
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

const NotFoundSchema =
  Type.Object(
    {
      error:
        Type.Literal(
          "agreement_not_found",
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const ForbiddenSchema =
  Type.Object(
    {
      error:
        Type.Literal(
          "agreement_action_forbidden",
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const ConflictSchema =
  Type.Object(
    {
      error:
        Type.Literal(
          "agreement_state_conflict",
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

/* =========================================================
   SESSION RESOLUTION
   ========================================================= */

async function resolveActor(
  request: {
    readonly cookies:
      Record<string, string | undefined>;
  },

  options:
    AgreementRouteOptions,
): Promise<ResolvedSession | null> {
  const rawToken =
    request.cookies[
      options.sessionCookieName
    ];

  if (!rawToken) {
    return null;
  }

  return options.resolveSession(
    rawToken,
  );
}

/* =========================================================
   DOMAIN ERROR MAPPING
   ========================================================= */

function sendDomainError(
  error: unknown,
  reply: any,
): void {
  if (
    error instanceof
    AgreementNotFoundError
  ) {
    reply
      .code(404)
      .send({
        error:
          "agreement_not_found",
      });

    return;
  }

  if (
    error instanceof
    AgreementAccessError
  ) {
    reply
      .code(403)
      .send({
        error:
          "agreement_action_forbidden",
      });

    return;
  }

  if (
    error instanceof
    AgreementConflictError
  ) {
    reply
      .code(409)
      .send({
        error:
          "agreement_state_conflict",
      });

    return;
  }

  throw error;
}

/* =========================================================
   ROUTES
   ========================================================= */

export function registerAgreementRoutes(
  app:
    FastifyInstance,

  options:
    AgreementRouteOptions,
): void {
  const typedApp =
    app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/api/v1/agreements",
    {
      schema: {
        body:
          CreateAgreementBodySchema,

        response: {
          201:
            AgreementResultSchema,

          401:
            UnauthenticatedSchema,

          403:
            ForbiddenSchema,

          409:
            ConflictSchema,
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      const session =
        await resolveActor(
          request,
          options,
        );

      if (!session) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const created =
          await options.operations
            .createAgreement({
              actor: {
                userId:
                  session.userId,

                walletAddress:
                  session.walletAddress,
              },

              contractorWalletAddress:
                request.body
                  .contractorWalletAddress,

              title:
                request.body.title,

              metadataUri:
                request.body.metadataUri,

              termsHash:
                request.body.termsHash,
            });

        return reply
          .code(201)
          .send(
            created,
          );
      } catch (error) {
        return sendDomainError(
          error,
          reply,
        );
      }
    },
  );

  typedApp.get(
    "/api/v1/agreements/:id",
    {
      schema: {
        params:
          IdParamsSchema,

        response: {
          200:
            AgreementViewSchema,

          401:
            UnauthenticatedSchema,

          403:
            ForbiddenSchema,

          404:
            NotFoundSchema,
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      const session =
        await resolveActor(
          request,
          options,
        );

      if (!session) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const agreement =
          await options.operations
            .getAgreement({
              actor: {
                userId:
                  session.userId,

                walletAddress:
                  session.walletAddress,
              },

              agreementId:
                request.params.id,
            });

        if (!agreement) {
          return reply
            .code(404)
            .send({
              error:
                "agreement_not_found",
            });
        }

        return reply
          .code(200)
          .send(
            agreement,
          );
      } catch (error) {
        return sendDomainError(
          error,
          reply,
        );
      }
    },
  );

  typedApp.post(
    "/api/v1/agreements/:id/milestones",
    {
      schema: {
        params:
          IdParamsSchema,

        body:
          AddMilestoneBodySchema,

        response: {
          201:
            MilestoneResultSchema,

          401:
            UnauthenticatedSchema,

          403:
            ForbiddenSchema,

          404:
            NotFoundSchema,

          409:
            ConflictSchema,
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      const session =
        await resolveActor(
          request,
          options,
        );

      if (!session) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const milestone =
          await options.operations
            .addMilestone({
              actor: {
                userId:
                  session.userId,

                walletAddress:
                  session.walletAddress,
              },

              agreementId:
                request.params.id,

              title:
                request.body.title,

              specificationUri:
                request.body
                  .specificationUri,

              amount:
                request.body.amount,

              asset:
                request.body.asset,
            });

        return reply
          .code(201)
          .send(
            milestone,
          );
      } catch (error) {
        return sendDomainError(
          error,
          reply,
        );
      }
    },
  );

  typedApp.post(
    "/api/v1/agreements/:id/propose",
    {
      schema: {
        params:
          IdParamsSchema,

        response: {
          200:
            AgreementResultSchema,

          401:
            UnauthenticatedSchema,

          403:
            ForbiddenSchema,

          404:
            NotFoundSchema,

          409:
            ConflictSchema,
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      const session =
        await resolveActor(
          request,
          options,
        );

      if (!session) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const result =
          await options.operations
            .proposeAgreement({
              actor: {
                userId:
                  session.userId,

                walletAddress:
                  session.walletAddress,
              },

              agreementId:
                request.params.id,
            });

        return reply
          .code(200)
          .send(
            result,
          );
      } catch (error) {
        return sendDomainError(
          error,
          reply,
        );
      }
    },
  );

  typedApp.post(
    "/api/v1/agreements/:id/accept",
    {
      schema: {
        params:
          IdParamsSchema,

        response: {
          200:
            AgreementResultSchema,

          401:
            UnauthenticatedSchema,

          403:
            ForbiddenSchema,

          404:
            NotFoundSchema,

          409:
            ConflictSchema,
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      const session =
        await resolveActor(
          request,
          options,
        );

      if (!session) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const result =
          await options.operations
            .acceptAgreement({
              actor: {
                userId:
                  session.userId,

                walletAddress:
                  session.walletAddress,
              },

              agreementId:
                request.params.id,
            });

        return reply
          .code(200)
          .send(
            result,
          );
      } catch (error) {
        return sendDomainError(
          error,
          reply,
        );
      }
    },
  );

  typedApp.post(
    "/api/v1/agreements/:id/milestones/:milestoneId/evidence",
    {
      schema: {
        params:
          MilestoneParamsSchema,

        body:
          SubmitEvidenceBodySchema,

        response: {
          201:
            EvidenceResultSchema,

          401:
            UnauthenticatedSchema,

          403:
            ForbiddenSchema,

          404:
            NotFoundSchema,

          409:
            ConflictSchema,
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      const session =
        await resolveActor(
          request,
          options,
        );

      if (!session) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const evidence =
          await options.operations
            .submitEvidence({
              actor: {
                userId:
                  session.userId,

                walletAddress:
                  session.walletAddress,
              },

              agreementId:
                request.params.id,

              milestoneId:
                request.params
                  .milestoneId,

              uri:
                request.body.uri,

              hash:
                request.body.hash,

              description:
                request.body
                  .description,
            });

        return reply
          .code(201)
          .send(
            evidence,
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