import type {
  PrismaClient,
} from "../generated/prisma/client.js";

/* =========================================================
   ERRORS
   ========================================================= */

export class SettlementBindingNotFoundError
  extends Error {
  constructor(
    message =
      "Settlement binding resource not found.",
  ) {
    super(
      message,
    );

    this.name =
      "SettlementBindingNotFoundError";
  }
}

export class SettlementBindingAccessError
  extends Error {
  constructor(
    message =
      "Settlement binding action is not allowed.",
  ) {
    super(
      message,
    );

    this.name =
      "SettlementBindingAccessError";
  }
}

export class SettlementBindingConflictError
  extends Error {
  constructor(
    message =
      "Settlement binding conflicts with existing state.",
  ) {
    super(
      message,
    );

    this.name =
      "SettlementBindingConflictError";
  }
}

/* =========================================================
   PUBLIC TYPES
   ========================================================= */

export interface SettlementBindingActor {
  readonly userId:
    string;

  readonly walletAddress:
    string;
}

export interface MilestoneSettlementBindingView {
  readonly id:
    string;

  readonly milestoneId:
    string;

  readonly externalMilestoneId:
    string;

  readonly createdAt:
    Date;
}

export interface AgreementSettlementBindingView {
  readonly id:
    string;

  readonly agreementId:
    string;

  readonly provider:
    string;

  readonly chainId:
    number;

  readonly contractAddress:
    string;

  readonly externalAgreementId:
    string;

  readonly createdAt:
    Date;

  readonly updatedAt:
    Date;

  readonly milestoneBindings:
    readonly MilestoneSettlementBindingView[];
}

export interface CreateAgreementSettlementBindingInput {
  readonly actor:
    SettlementBindingActor;

  readonly agreementId:
    string;

  readonly provider:
    string;

  readonly chainId:
    number;

  readonly contractAddress:
    string;

  readonly externalAgreementId:
    string;
}

export interface GetAgreementSettlementBindingsInput {
  readonly actor:
    SettlementBindingActor;

  readonly agreementId:
    string;
}

export interface CreateMilestoneSettlementBindingInput {
  readonly actor:
    SettlementBindingActor;

  readonly agreementId:
    string;

  readonly agreementSettlementBindingId:
    string;

  readonly milestoneId:
    string;

  readonly externalMilestoneId:
    string;
}

export interface SettlementBindingOperations {
  createAgreementBinding(
    input:
      CreateAgreementSettlementBindingInput,
  ):
    Promise<AgreementSettlementBindingView>;

  getAgreementBindings(
    input:
      GetAgreementSettlementBindingsInput,
  ):
    Promise<
      readonly AgreementSettlementBindingView[]
    >;

  createMilestoneBinding(
    input:
      CreateMilestoneSettlementBindingInput,
  ):
    Promise<MilestoneSettlementBindingView>;
}

/* =========================================================
   NORMALIZATION
   ========================================================= */

function normalizeWalletAddress(
  value:
    string,
): string {
  const walletAddress =
    value.trim();

  if (
    !/^0x[a-fA-F0-9]{40}$/.test(
      walletAddress,
    )
  ) {
    throw new SettlementBindingConflictError(
      "Invalid wallet address.",
    );
  }

  return walletAddress.toLowerCase();
}

function normalizeRequiredText(
  value:
    string,
  field:
    string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length ===
    0
  ) {
    throw new SettlementBindingConflictError(
      `${field} is required.`,
    );
  }

  return normalized;
}

function normalizeProvider(
  value:
    string,
): string {
  return normalizeRequiredText(
    value,
    "provider",
  ).toLowerCase();
}

function normalizeChainId(
  value:
    number,
): number {
  if (
    !Number.isSafeInteger(
      value,
    ) ||
    value <=
      0
  ) {
    throw new SettlementBindingConflictError(
      "chainId must be a positive safe integer.",
    );
  }

  return value;
}

function normalizeContractAddress(
  value:
    string,
): string {
  const normalized =
    normalizeRequiredText(
      value,
      "contractAddress",
    );

  if (
    /^0x[a-fA-F0-9]{40}$/.test(
      normalized,
    )
  ) {
    return normalized.toLowerCase();
  }

  return normalized;
}

/* =========================================================
   VIEW MAPPERS
   ========================================================= */

interface MilestoneBindingRecord {
  readonly id:
    string;

  readonly milestoneId:
    string;

  readonly externalMilestoneId:
    string;

  readonly createdAt:
    Date;
}

interface AgreementBindingRecord {
  readonly id:
    string;

  readonly agreementId:
    string;

  readonly provider:
    string;

  readonly chainId:
    number;

  readonly contractAddress:
    string;

  readonly externalAgreementId:
    string;

  readonly createdAt:
    Date;

  readonly updatedAt:
    Date;

  readonly milestoneBindings:
    readonly MilestoneBindingRecord[];
}

function toMilestoneBindingView(
  record:
    MilestoneBindingRecord,
): MilestoneSettlementBindingView {
  return {
    id:
      record.id,

    milestoneId:
      record.milestoneId,

    externalMilestoneId:
      record.externalMilestoneId,

    createdAt:
      record.createdAt,
  };
}

function toAgreementBindingView(
  record:
    AgreementBindingRecord,
): AgreementSettlementBindingView {
  return {
    id:
      record.id,

    agreementId:
      record.agreementId,

    provider:
      record.provider,

    chainId:
      record.chainId,

    contractAddress:
      record.contractAddress,

    externalAgreementId:
      record.externalAgreementId,

    createdAt:
      record.createdAt,

    updatedAt:
      record.updatedAt,

    milestoneBindings:
      record.milestoneBindings.map(
        toMilestoneBindingView,
      ),
  };
}

/* =========================================================
   AGREEMENT ACCESS

   Reading:
   - any PAI agreement party

   Creating/changing mappings:
   - CLIENT only

   The service stores external settlement references only.
   It does not perform settlement actions.
   ========================================================= */

async function requireAgreementParty(
  prisma:
    PrismaClient,
  input: {
    readonly agreementId:
      string;

    readonly walletAddress:
      string;
  },
): Promise<{
  readonly role:
    "CLIENT" | "CONTRACTOR";
}> {
  const walletAddress =
    normalizeWalletAddress(
      input.walletAddress,
    );

  const agreement =
    await prisma
      .agreement
      .findUnique({
        where: {
          id:
            input.agreementId,
        },

        select: {
          id:
            true,

          parties: {
            where: {
              walletAddress,
            },

            select: {
              role:
                true,
            },
          },
        },
      });

  if (
    !agreement
  ) {
    throw new SettlementBindingNotFoundError(
      "Agreement not found.",
    );
  }

  const party =
    agreement.parties[0];

  if (
    !party
  ) {
    throw new SettlementBindingAccessError(
      "Actor is not a party to this agreement.",
    );
  }

  return party;
}

async function requireAgreementClient(
  prisma:
    PrismaClient,
  input: {
    readonly agreementId:
      string;

    readonly walletAddress:
      string;
  },
): Promise<void> {
  const party =
    await requireAgreementParty(
      prisma,
      input,
    );

  if (
    party.role !==
    "CLIENT"
  ) {
    throw new SettlementBindingAccessError(
      "Only the CLIENT may create settlement mappings.",
    );
  }
}

/* =========================================================
   PRISMA OPERATIONS
   ========================================================= */

export function createPrismaSettlementBindingOperations(
  prisma:
    PrismaClient,
): SettlementBindingOperations {
  return {
    /* =====================================================
       CREATE AGREEMENT BINDING
       ===================================================== */

    createAgreementBinding:
      async (
        input,
      ) => {
        await requireAgreementClient(
          prisma,
          {
            agreementId:
              input.agreementId,

            walletAddress:
              input.actor.walletAddress,
          },
        );

        const provider =
          normalizeProvider(
            input.provider,
          );

        const chainId =
          normalizeChainId(
            input.chainId,
          );

        const contractAddress =
          normalizeContractAddress(
            input.contractAddress,
          );

        const externalAgreementId =
          normalizeRequiredText(
            input.externalAgreementId,
            "externalAgreementId",
          );

        const existingBinding =
          await prisma
            .agreementSettlementBinding
            .findFirst({
              where: {
                OR: [
                  {
                    agreementId:
                      input.agreementId,

                    provider,
                  },

                  {
                    provider,

                    chainId,

                    contractAddress,

                    externalAgreementId,
                  },
                ],
              },

              select: {
                id:
                  true,
              },
            });

        if (
          existingBinding
        ) {
          throw new SettlementBindingConflictError(
            "Settlement binding already exists.",
          );
        }

        const binding =
          await prisma
            .agreementSettlementBinding
            .create({
              data: {
                agreementId:
                  input.agreementId,

                provider,

                chainId,

                contractAddress,

                externalAgreementId,
              },

              include: {
                milestoneBindings: {
                  orderBy: {
                    createdAt:
                      "asc",
                  },
                },
              },
            });

        return toAgreementBindingView(
          binding,
        );
      },

    /* =====================================================
       READ AGREEMENT BINDINGS
       ===================================================== */

    getAgreementBindings:
      async (
        input,
      ) => {
        await requireAgreementParty(
          prisma,
          {
            agreementId:
              input.agreementId,

            walletAddress:
              input.actor.walletAddress,
          },
        );

        const bindings =
          await prisma
            .agreementSettlementBinding
            .findMany({
              where: {
                agreementId:
                  input.agreementId,
              },

              orderBy: {
                createdAt:
                  "asc",
              },

              include: {
                milestoneBindings: {
                  orderBy: {
                    createdAt:
                      "asc",
                  },
                },
              },
            });

        return bindings.map(
          toAgreementBindingView,
        );
      },

    /* =====================================================
       CREATE MILESTONE BINDING

       Important integrity rule:
       the milestone must belong to the same PAI agreement
       as the parent agreement settlement binding.
       ===================================================== */

    createMilestoneBinding:
      async (
        input,
      ) => {
        await requireAgreementClient(
          prisma,
          {
            agreementId:
              input.agreementId,

            walletAddress:
              input.actor.walletAddress,
          },
        );

        const externalMilestoneId =
          normalizeRequiredText(
            input.externalMilestoneId,
            "externalMilestoneId",
          );

        const agreementBinding =
          await prisma
            .agreementSettlementBinding
            .findFirst({
              where: {
                id:
                  input
                    .agreementSettlementBindingId,

                agreementId:
                  input.agreementId,
              },

              select: {
                id:
                  true,
              },
            });

        if (
          !agreementBinding
        ) {
          throw new SettlementBindingNotFoundError(
            "Agreement settlement binding not found.",
          );
        }

        const milestone =
          await prisma
            .milestone
            .findUnique({
              where: {
                id:
                  input.milestoneId,
              },

              select: {
                id:
                  true,

                agreementId:
                  true,
              },
            });

        if (
          !milestone
        ) {
          throw new SettlementBindingNotFoundError(
            "Milestone not found.",
          );
        }

        if (
          milestone.agreementId !==
          input.agreementId
        ) {
          throw new SettlementBindingConflictError(
            "Milestone does not belong to the settlement binding agreement.",
          );
        }

        const existingBinding =
          await prisma
            .milestoneSettlementBinding
            .findFirst({
              where: {
                agreementSettlementBindingId:
                  agreementBinding.id,

                OR: [
                  {
                    milestoneId:
                      input.milestoneId,
                  },

                  {
                    externalMilestoneId,
                  },
                ],
              },

              select: {
                id:
                  true,
              },
            });

        if (
          existingBinding
        ) {
          throw new SettlementBindingConflictError(
            "Milestone settlement binding already exists.",
          );
        }

        const binding =
          await prisma
            .milestoneSettlementBinding
            .create({
              data: {
                agreementSettlementBindingId:
                  agreementBinding.id,

                milestoneId:
                  input.milestoneId,

                externalMilestoneId,
              },
            });

        return toMilestoneBindingView(
          binding,
        );
      },
  };
}