import type {
  FastifyInstance,
} from "fastify";

import {
  Type,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";

import type {
  AcceptAgreementVersionRequest,
  AcceptAgreementVersionResult,
  PersistReviewedAgreementRequest,
  PersistReviewedAgreementResult,
  ReviseCanonicalAgreementRequest,
  ReviseCanonicalAgreementResult,
  BindAgreementPartyWalletRequest,
  BindAgreementPartyWalletResult,
  AgreementAcceptanceView,
  AgreementLifecycleView,
  CanonicalAgreementReviewView,
  GetAgreementLifecycleRequest,
  GetCanonicalAgreementReviewRequest,
} from "@pai/agreement-contract";
import type {
  ResolveSession,
  ResolvedSession,
} from "../auth/session.js";

import type {
  ResolveServicePrincipal,
} from "../auth/service.js";

/* =========================================================
   PAI HTTP DOMAIN TYPES
   ========================================================= */

export interface AgreementAuthorActor {
  readonly userId: string;
}

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
    readonly walletAddress: string | null;
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

export interface MilestoneReviewInput {
  readonly actor:
    AgreementRouteActor;

  readonly agreementId:
    string;

  readonly milestoneId:
    string;
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
  readonly requestMilestoneRevision:
    (
      input:
        MilestoneReviewInput,
    ) => Promise<MilestoneRouteResult>;

  readonly approveMilestone:
    (
      input:
        MilestoneReviewInput,
    ) => Promise<MilestoneRouteResult>;
}

export interface CanonicalAgreementRouteOperations {
  readonly persistReviewedAgreement:
    (
      input:
        PersistReviewedAgreementRequest & {
          readonly actor:
            AgreementAuthorActor;
        },
    ) => Promise<PersistReviewedAgreementResult>;

  readonly acceptAgreementVersion:
    (
      input:
        AcceptAgreementVersionRequest & {
          readonly partyAccessToken:
            string;
        },
    ) => Promise<AcceptAgreementVersionResult>;

  readonly reviseCanonicalAgreement:
    (
      input:
        ReviseCanonicalAgreementRequest & {
          readonly actor:
            AgreementAuthorActor;
        },
    ) => Promise<ReviseCanonicalAgreementResult>;

  readonly bindAgreementPartyWallet:
    (
      input:
        BindAgreementPartyWalletRequest & {
          readonly actor:
            AgreementRouteActor;

          readonly partyAccessToken:
            string;
        },
    ) => Promise<BindAgreementPartyWalletResult>;

  readonly getCanonicalAgreementReview:
    (
      input:
        GetCanonicalAgreementReviewRequest & {
          readonly partyAccessToken:
            string;
        },
    ) => Promise<CanonicalAgreementReviewView>;

  readonly getCanonicalAgreementLifecycle:
    (
      input:
        GetAgreementLifecycleRequest,
    ) => Promise<AgreementLifecycleView>;

  readonly listCanonicalAgreementAcceptances:
    (
      input:
        GetAgreementLifecycleRequest,
    ) => Promise<
      readonly AgreementAcceptanceView[]
    >;
}
export interface AgreementRouteOptions {
  readonly resolveSession:
    ResolveSession;

  readonly sessionCookieName:
    string;

  readonly resolveServicePrincipal?:
    ResolveServicePrincipal;

  readonly operations:
    AgreementRouteOperations &
    Partial<CanonicalAgreementRouteOperations>;
}

function requireCanonicalAgreementOperation<T>(
  operation:
    T | undefined,

  name:
    keyof CanonicalAgreementRouteOperations,
): T {
  if (
    operation ===
    undefined
  ) {
    throw new Error(
      `Canonical agreement operation "${name}" is not configured.`,
    );
  }

  return operation;
}

function toCanonicalLifecycleResponse(
  lifecycle:
    AgreementLifecycleView,
) {
  return {
    reference: {
      agreementId:
        lifecycle.reference
          .agreementId,

      agreementVersion:
        lifecycle.reference
          .agreementVersion,

      agreementHash:
        lifecycle.reference
          .agreementHash,
    },

    status:
      lifecycle.status,

    acceptanceComplete:
      lifecycle.acceptanceComplete,

    walletBindingComplete:
      lifecycle.walletBindingComplete,

    parties:
      lifecycle.parties.map(
        (
          party,
        ) => ({
          partyId:
            party.partyId,

          role:
            party.role,

          ...(
            party.displayName !==
            undefined
              ? {
                  displayName:
                    party.displayName,
                }
              : {}
          ),

          acceptedCurrentVersion:
            party
              .acceptedCurrentVersion,

          walletBound:
            party.walletBound,

          walletAddress:
            party.walletAddress,
        }),
      ),
  };
}
function toCanonicalReviewResponse(
  review:
    CanonicalAgreementReviewView,
) {
  return {
    reference: {
      agreementId:
        review.reference
          .agreementId,

      agreementVersion:
        review.reference
          .agreementVersion,

      agreementHash:
        review.reference
          .agreementHash,
    },

    terms: {
      title:
        review.terms.title,

      description:
        review.terms.description,

      totalValue:
        review.terms.totalValue,

      settlementAsset:
        review.terms
          .settlementAsset,

      deadline:
        review.terms.deadline,

      approvalWindow:
        review.terms
          .approvalWindow,

      milestones:
        review.terms
          .milestones
          .map(
            (
              milestone,
            ) => ({
              amount:
                milestone.amount,

              deliverable:
                milestone
                  .deliverable,

              acceptanceCriteria:
                milestone
                  .acceptanceCriteria,

              deadline:
                milestone.deadline,
            }),
          ),
    },

    party: {
      partyId:
        review.party.partyId,

      role:
        review.party.role,

      ...(
        review.party
          .displayName !==
        undefined
          ? {
              displayName:
                review.party
                  .displayName,
            }
          : {}
      ),

      acceptedCurrentVersion:
        review.party
          .acceptedCurrentVersion,
    },

    status:
      review.status,

    acceptanceComplete:
      review.acceptanceComplete,
  };
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
        Type.Union([
          Type.String(),
          Type.Null(),
        ]),

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

const CanonicalNullableStringSchema =
  Type.Union([
    Type.Null(),
    Type.String(),
  ]);

const CanonicalAgreementHashSchema =
  Type.String({
    pattern:
      "^0x[0-9a-f]{64}$",
  });

const CanonicalPartyRoleSchema =
  Type.Union([
    Type.Literal(
      "CLIENT",
    ),

    Type.Literal(
      "CONTRACTOR",
    ),
  ]);

const CanonicalLifecycleStatusSchema =
  Type.Union([
    Type.Literal(
      "AWAITING_ACCEPTANCE",
    ),

    Type.Literal(
      "ACCEPTED",
    ),

    Type.Literal(
      "READY_TO_FUND",
    ),
  ]);

const CanonicalMilestoneSchema =
  Type.Object(
    {
      amount:
        CanonicalNullableStringSchema,

      deliverable:
        CanonicalNullableStringSchema,

      acceptanceCriteria:
        CanonicalNullableStringSchema,

      deadline:
        CanonicalNullableStringSchema,
    },
    {
      additionalProperties:
        false,
    },
  );

const CanonicalAgreementTermsSchema =
  Type.Object(
    {
      title:
        CanonicalNullableStringSchema,

      description:
        Type.String(),

      totalValue:
        CanonicalNullableStringSchema,

      settlementAsset:
        CanonicalNullableStringSchema,

      deadline:
        CanonicalNullableStringSchema,

      approvalWindow:
        CanonicalNullableStringSchema,

      milestones:
        Type.Array(
          CanonicalMilestoneSchema,
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const CanonicalVersionReferenceSchema =
  Type.Object(
    {
      agreementId:
        Type.String(),

      agreementVersion:
        Type.Integer({
          minimum:
            1,
        }),

      agreementHash:
        CanonicalAgreementHashSchema,
    },
    {
      additionalProperties:
        false,
    },
  );

const CanonicalLifecyclePartySchema =
  Type.Object(
    {
      partyId:
        Type.String(),

      role:
        CanonicalPartyRoleSchema,

      displayName:
        Type.Optional(
          Type.Union([
            Type.String(),
            Type.Null(),
          ]),
        ),

      acceptedCurrentVersion:
        Type.Boolean(),

      walletBound:
        Type.Boolean(),

      walletAddress:
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

const CanonicalLifecycleSchema =
  Type.Object(
    {
      reference:
        CanonicalVersionReferenceSchema,

      status:
        CanonicalLifecycleStatusSchema,

      acceptanceComplete:
        Type.Boolean(),

      walletBindingComplete:
        Type.Boolean(),

      parties:
        Type.Array(
          CanonicalLifecyclePartySchema,
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const CanonicalAgreementReviewPartySchema =
  Type.Object(
    {
      partyId:
        Type.String(),

      role:
        CanonicalPartyRoleSchema,

      displayName:
        Type.Optional(
          Type.Union([
            Type.String(),
            Type.Null(),
          ]),
        ),

      acceptedCurrentVersion:
        Type.Boolean(),
    },
    {
      additionalProperties:
        false,
    },
  );

const CanonicalAgreementReviewResultSchema =
  Type.Object(
    {
      reference:
        CanonicalVersionReferenceSchema,

      terms:
        CanonicalAgreementTermsSchema,

      party:
        CanonicalAgreementReviewPartySchema,

      status:
        CanonicalLifecycleStatusSchema,

      acceptanceComplete:
        Type.Boolean(),
    },
    {
      additionalProperties:
        false,
    },
  );

const PersistReviewedAgreementBodySchema =
  Type.Object(
    {
      terms:
        CanonicalAgreementTermsSchema,

      client:
        Type.Object(
          {
            displayName:
              Type.Optional(
                Type.String(),
              ),
          },
          {
            additionalProperties:
              false,
          },
        ),

      contractor:
        Type.Object(
          {
            displayName:
              Type.Optional(
                Type.String(),
              ),
          },
          {
            additionalProperties:
              false,
          },
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const PartyAccessCredentialSchema =
  Type.Object(
    {
      partyId:
        Type.String(),

      role:
        CanonicalPartyRoleSchema,

      accessToken:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const PersistReviewedAgreementResultSchema =
  Type.Object(
    {
      lifecycle:
        CanonicalLifecycleSchema,

      partyAccess:
        Type.Array(
          PartyAccessCredentialSchema,
        ),
    },
    {
      additionalProperties:
        false,
    },
  );

const AcceptCanonicalAgreementBodySchema =
  Type.Object(
    {
      agreementId:
        Type.String(),

      agreementVersion:
        Type.Integer({
          minimum:
            1,
        }),

      agreementHash:
        CanonicalAgreementHashSchema,

      partyId:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const AgreementAcceptanceSchema =
  Type.Object(
    {
      partyId:
        Type.String(),

      role:
        CanonicalPartyRoleSchema,

      agreementVersion:
        Type.Integer({
          minimum:
            1,
        }),

      agreementHash:
        CanonicalAgreementHashSchema,

      acceptedAt:
        Type.String(),

      current:
        Type.Boolean(),
    },
    {
      additionalProperties:
        false,
    },
  );

const AcceptCanonicalAgreementResultSchema =
  Type.Object(
    {
      acceptance:
        AgreementAcceptanceSchema,

      lifecycle:
        CanonicalLifecycleSchema,
    },
    {
      additionalProperties:
        false,
    },
  );

const ReviseCanonicalAgreementBodySchema =
  Type.Object(
    {
      expected:
        CanonicalVersionReferenceSchema,

      terms:
        CanonicalAgreementTermsSchema,
    },
    {
      additionalProperties:
        false,
    },
  );

const ReviseCanonicalAgreementResultSchema =
  Type.Object(
    {
      previous:
        CanonicalVersionReferenceSchema,

      current:
        CanonicalVersionReferenceSchema,

      lifecycle:
        CanonicalLifecycleSchema,
    },
    {
      additionalProperties:
        false,
    },
  );

const CanonicalPartyParamsSchema =
  Type.Object(
    {
      id:
        Type.String(),

      partyId:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const BindCanonicalWalletBodySchema =
  Type.Object(
    {
      agreementId:
        Type.String(),

      partyId:
        Type.String(),
    },
    {
      additionalProperties:
        false,
    },
  );

const BindCanonicalWalletResultSchema =
  Type.Object(
    {
      partyId:
        Type.String(),

      role:
        CanonicalPartyRoleSchema,

      walletAddress:
        Type.String(),

      lifecycle:
        CanonicalLifecycleSchema,
    },
    {
      additionalProperties:
        false,
    },
  );

const PartyTokenHeadersSchema =
  Type.Object({
    "x-pai-party-token":
      Type.Optional(
        Type.String(),
      ),
  });

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

async function resolveCanonicalAuthor(
  request: {
    readonly cookies:
      Record<string, string | undefined>;

    readonly headers: {
      readonly authorization?:
        string | undefined;
    };
  },

  options:
    AgreementRouteOptions,
): Promise<AgreementAuthorActor | null> {
  const session =
    await resolveActor(
      request,
      options,
    );

  if (session) {
    return {
      userId:
        session.userId,
    };
  }

  if (
    !options.resolveServicePrincipal
  ) {
    return null;
  }

  return options
    .resolveServicePrincipal(
      request.headers.authorization,
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

  /* =========================================================
     CANONICAL AGREEMENT ACCEPTANCE LIFECYCLE
     ========================================================= */

  typedApp.post(
    "/api/v1/agreements/reviewed",
    {
      schema: {
        body:
          PersistReviewedAgreementBodySchema,

        response: {
          201:
            PersistReviewedAgreementResultSchema,

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
      const actor =
        await resolveCanonicalAuthor(
          request,
          options,
        );

      if (!actor) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        const result =
          await requireCanonicalAgreementOperation(
            options.operations.persistReviewedAgreement,
            "persistReviewedAgreement",
          )({
              actor,

              terms:
                request.body.terms,

              client:
                request.body.client,

              contractor:
                request.body
                  .contractor,
            });

        return reply
          .code(201)
          .send(
            {
              lifecycle:
                toCanonicalLifecycleResponse(
                  result.lifecycle,
                ),

              partyAccess:
                result.partyAccess.map(
                  (
                    entry,
                  ) => ({
                    partyId:
                      entry.partyId,

                    role:
                      entry.role,

                    accessToken:
                      entry.accessToken,
                  }),
                ),
            },
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
    "/api/v1/agreements/:id/revisions",
    {
      schema: {
        params:
          IdParamsSchema,

        body:
          ReviseCanonicalAgreementBodySchema,

        response: {
          201:
            ReviseCanonicalAgreementResultSchema,

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
      const actor =
        await resolveCanonicalAuthor(
          request,
          options,
        );

      if (!actor) {
        return reply
          .code(401)
          .send({
            error:
              "unauthenticated",
          });
      }

      try {
        if (
          request.body.expected
            .agreementId !==
          request.params.id
        ) {
          throw new AgreementConflictError(
            "Agreement path does not match expected canonical tuple.",
          );
        }

        const result =
          await requireCanonicalAgreementOperation(
            options.operations.reviseCanonicalAgreement,
            "reviseCanonicalAgreement",
          )({
              actor,

              expected:
                request.body.expected,

              terms:
                request.body.terms,
            });

        return reply
          .code(201)
          .send(
            {
              previous: {
                agreementId:
                  result.previous
                    .agreementId,

                agreementVersion:
                  result.previous
                    .agreementVersion,

                agreementHash:
                  result.previous
                    .agreementHash,
              },

              current: {
                agreementId:
                  result.current
                    .agreementId,

                agreementVersion:
                  result.current
                    .agreementVersion,

                agreementHash:
                  result.current
                    .agreementHash,
              },

              lifecycle:
                toCanonicalLifecycleResponse(
                  result.lifecycle,
                ),
            },
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
    "/api/v1/agreements/:id/acceptances",
    {
      schema: {
        params:
          IdParamsSchema,

        headers:
          PartyTokenHeadersSchema,

        body:
          AcceptCanonicalAgreementBodySchema,

        response: {
          200:
            AcceptCanonicalAgreementResultSchema,

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
      try {
        if (
          request.body.agreementId !==
          request.params.id
        ) {
          throw new AgreementConflictError(
            "Agreement path does not match acceptance tuple.",
          );
        }

        const result =
          await requireCanonicalAgreementOperation(
            options.operations.acceptAgreementVersion,
            "acceptAgreementVersion",
          )({
              agreementId:
                request.body
                  .agreementId,

              agreementVersion:
                request.body
                  .agreementVersion,

              agreementHash:
                request.body
                  .agreementHash,

              partyId:
                request.body.partyId,

              partyAccessToken:
                request.headers[
                  "x-pai-party-token"
                ] ??
                "",
            });

        return reply
          .code(200)
          .send(
            {
              acceptance: {
                partyId:
                  result.acceptance
                    .partyId,

                role:
                  result.acceptance
                    .role,

                agreementVersion:
                  result.acceptance
                    .agreementVersion,

                agreementHash:
                  result.acceptance
                    .agreementHash,

                acceptedAt:
                  result.acceptance
                    .acceptedAt,

                current:
                  result.acceptance
                    .current,
              },

              lifecycle:
                toCanonicalLifecycleResponse(
                  result.lifecycle,
                ),
            },
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
    "/api/v1/agreements/:id/review",
    {
      schema: {
        params:
          IdParamsSchema,

        headers:
          PartyTokenHeadersSchema,

        response: {
          200:
            CanonicalAgreementReviewResultSchema,

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
      try {
        const review =
          await requireCanonicalAgreementOperation(
            options.operations.getCanonicalAgreementReview,
            "getCanonicalAgreementReview",
          )({
              agreementId:
                request.params.id,

              partyAccessToken:
                request.headers[
                  "x-pai-party-token"
                ] ??
                "",
            });

        return reply
          .code(200)
          .send(
            toCanonicalReviewResponse(
              review,
            ),
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
    "/api/v1/agreements/:id/lifecycle",
    {
      schema: {
        params:
          IdParamsSchema,

        response: {
          200:
            CanonicalLifecycleSchema,

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
      try {
        const lifecycle =
          await requireCanonicalAgreementOperation(
            options.operations.getCanonicalAgreementLifecycle,
            "getCanonicalAgreementLifecycle",
          )({
              agreementId:
                request.params.id,
            });

        return reply
          .code(200)
          .send(
            toCanonicalLifecycleResponse(
              lifecycle,
            ),
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
    "/api/v1/agreements/:id/parties/:partyId/wallet-binding",
    {
      schema: {
        params:
          CanonicalPartyParamsSchema,

        headers:
          PartyTokenHeadersSchema,

        body:
          BindCanonicalWalletBodySchema,

        response: {
          200:
            BindCanonicalWalletResultSchema,

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
        if (
          request.body.agreementId !==
            request.params.id ||
          request.body.partyId !==
            request.params.partyId
        ) {
          throw new AgreementConflictError(
            "Wallet-binding path does not match canonical party reference.",
          );
        }

        const result =
          await requireCanonicalAgreementOperation(
            options.operations.bindAgreementPartyWallet,
            "bindAgreementPartyWallet",
          )({
              agreementId:
                request.body
                  .agreementId,

              partyId:
                request.body.partyId,

              partyAccessToken:
                request.headers[
                  "x-pai-party-token"
                ] ??
                "",

              actor: {
                userId:
                  session.userId,

                walletAddress:
                  session.walletAddress,
              },
            });

        return reply
          .code(200)
          .send(
            {
              partyId:
                result.partyId,

              role:
                result.role,

              walletAddress:
                result.walletAddress,

              lifecycle:
                toCanonicalLifecycleResponse(
                  result.lifecycle,
                ),
            },
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
  typedApp.post(
    "/api/v1/agreements/:id/milestones/:milestoneId/request-revision",
    {
      schema: {
        params:
          MilestoneParamsSchema,

        response: {
          200:
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
            .requestMilestoneRevision({
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
            });

        return reply
          .code(200)
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
    "/api/v1/agreements/:id/milestones/:milestoneId/approve",
    {
      schema: {
        params:
          MilestoneParamsSchema,

        response: {
          200:
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
            .approveMilestone({
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
            });

        return reply
          .code(200)
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
}
