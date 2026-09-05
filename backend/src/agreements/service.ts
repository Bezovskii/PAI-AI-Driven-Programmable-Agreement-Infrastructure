import type {
  PrismaClient,
} from "../generated/prisma/client.js";

import {
  AgreementAccessError,
  AgreementConflictError,
  AgreementNotFoundError,
  type AgreementRouteOperations,
  type AgreementView,
  type MilestoneReviewInput,
  type MilestoneRouteResult,
} from "./routes.js";

/* =========================================================
   WALLET HELPERS
   ========================================================= */

function normalizeWalletAddress(
  value: string,
): string {
  const walletAddress =
    value.trim();

  if (
    !/^0x[a-fA-F0-9]{40}$/.test(
      walletAddress,
    )
  ) {
    throw new AgreementConflictError(
      "Invalid wallet address.",
    );
  }

  return walletAddress.toLowerCase();
}

function sameWallet(
  left: string,
  right: string,
): boolean {
  return (
    left.toLowerCase() ===
    right.toLowerCase()
  );
}

/* =========================================================
   PAI AGREEMENT OPERATIONS

   PAI owns:
   - agreement terms
   - parties
   - milestones
   - acceptance
   - evidence
   - lifecycle

   ESCT settlement logic does NOT belong here.
   ========================================================= */

export function createPrismaAgreementOperations(
  prisma: PrismaClient,
): AgreementRouteOperations {
  const reviewSubmittedMilestone =
    async (
      input:
        MilestoneReviewInput,
      nextStatus:
        "REVISION_REQUESTED" |
        "APPROVED",
    ): Promise<MilestoneRouteResult> => {
      const actorWallet =
        normalizeWalletAddress(
          input.actor.walletAddress,
        );

      return prisma.$transaction(
        async (
          transaction,
        ) => {
          const agreement =
            await transaction
              .agreement
              .findUnique({
                where: {
                  id:
                    input.agreementId,
                },

                select: {
                  id:
                    true,

                  status:
                    true,

                  parties: {
                    where: {
                      walletAddress:
                        actorWallet,
                    },

                    select: {
                      role:
                        true,
                    },
                  },
                },
              });

          if (!agreement) {
            throw new AgreementNotFoundError();
          }

          const client =
            agreement.parties[0];

          if (
            !client ||
            client.role !==
              "CLIENT"
          ) {
            throw new AgreementAccessError(
              "Only the client may review milestone submissions.",
            );
          }

          if (
            agreement.status !==
            "IN_PROGRESS"
          ) {
            throw new AgreementConflictError(
              "Milestone submissions may only be reviewed while the agreement is in progress.",
            );
          }

          const milestone =
            await transaction
              .milestone
              .findFirst({
                where: {
                  id:
                    input.milestoneId,

                  agreementId:
                    agreement.id,
                },

                select: {
                  id:
                    true,

                  agreementId:
                    true,

                  position:
                    true,

                  status:
                    true,
                },
              });

          if (!milestone) {
            throw new AgreementNotFoundError();
          }

          if (
            milestone.status !==
            "SUBMITTED"
          ) {
            throw new AgreementConflictError(
              "Only a submitted milestone may be reviewed.",
            );
          }

          const update =
            await transaction
              .milestone
              .updateMany({
                where: {
                  id:
                    milestone.id,

                  agreementId:
                    agreement.id,

                  status:
                    "SUBMITTED",
                },

                data: {
                  status:
                    nextStatus,
                },
              });

          if (
            update.count !==
            1
          ) {
            throw new AgreementConflictError(
              "Milestone state changed before review completed.",
            );
          }

          return {
            id:
              milestone.id,

            agreementId:
              milestone.agreementId,

            position:
              milestone.position,

            status:
              nextStatus,
          };
        },
      );
    };

  return {
    /* =====================================================
       CREATE
       ===================================================== */

    createAgreement:
      async (
        input,
      ) => {
        const clientWallet =
          normalizeWalletAddress(
            input.actor.walletAddress,
          );

        const contractorWallet =
          normalizeWalletAddress(
            input.contractorWalletAddress,
          );

        if (
          sameWallet(
            clientWallet,
            contractorWallet,
          )
        ) {
          throw new AgreementConflictError(
            "Client and contractor must use different wallets.",
          );
        }

        const agreement =
          await prisma.agreement.create({
            data: {
              createdByUserId:
                input.actor.userId,

              status:
                "DRAFT",

              ...(
                input.title !==
                undefined
                  ? {
                      title:
                        input.title,
                    }
                  : {}
              ),

              ...(
                input.metadataUri !==
                undefined
                  ? {
                      metadataUri:
                        input.metadataUri,
                    }
                  : {}
              ),

              ...(
                input.termsHash !==
                undefined
                  ? {
                      termsHash:
                        input.termsHash,
                    }
                  : {}
              ),

              parties: {
                create: [
                  {
                    walletAddress:
                      clientWallet,

                    role:
                      "CLIENT",
                  },

                  {
                    walletAddress:
                      contractorWallet,

                    role:
                      "CONTRACTOR",
                  },
                ],
              },
            },

            select: {
              id:
                true,

              status:
                true,
            },
          });

        return {
          id:
            agreement.id,

          status:
            agreement.status,
        };
      },

    /* =====================================================
       READ
       ===================================================== */

    getAgreement:
      async (
        input,
      ): Promise<AgreementView | null> => {
        const actorWallet =
          normalizeWalletAddress(
            input.actor.walletAddress,
          );

        const agreement =
          await prisma.agreement.findUnique({
            where: {
              id:
                input.agreementId,
            },

            include: {
              parties: {
                orderBy: {
                  createdAt:
                    "asc",
                },
              },

              milestones: {
                orderBy: {
                  position:
                    "asc",
                },

                include: {
                  evidence: {
                    orderBy: {
                      createdAt:
                        "asc",
                    },
                  },
                },
              },
            },
          });

        if (!agreement) {
          return null;
        }

        const actorIsParty =
          agreement.parties.some(
            (
              party,
            ) =>
              sameWallet(
                party.walletAddress,
                actorWallet,
              ),
          );

        if (!actorIsParty) {
          throw new AgreementAccessError(
            "Only agreement parties may read an agreement.",
          );
        }

        return {
          id:
            agreement.id,

          status:
            agreement.status,

          title:
            agreement.title,

          metadataUri:
            agreement.metadataUri,

          termsHash:
            agreement.termsHash,

          termsVersion:
            agreement.termsVersion,

          parties:
            agreement.parties.map(
              (
                party,
              ) => ({
                id:
                  party.id,

                walletAddress:
                  party.walletAddress,

                role:
                  party.role,
              }),
            ),

          milestones:
            agreement.milestones.map(
              (
                milestone,
              ) => ({
                id:
                  milestone.id,

                position:
                  milestone.position,

                title:
                  milestone.title,

                specificationUri:
                  milestone.specificationUri,

                amount:
                  milestone.amount,

                asset:
                  milestone.asset,

                status:
                  milestone.status,

                evidence:
                  milestone.evidence.map(
                    (
                      evidence,
                    ) => ({
                      id:
                        evidence.id,

                      uri:
                        evidence.uri,

                      hash:
                        evidence.hash,

                      description:
                        evidence.description,
                    }),
                  ),
              }),
            ),
        };
      },

    /* =====================================================
       ADD MILESTONE
       ===================================================== */

    addMilestone:
      async (
        input,
      ) => {
        const actorWallet =
          normalizeWalletAddress(
            input.actor.walletAddress,
          );

        return prisma.$transaction(
          async (
            transaction,
          ) => {
            const agreement =
              await transaction
                .agreement
                .findUnique({
                  where: {
                    id:
                      input.agreementId,
                  },

                  select: {
                    id:
                      true,

                    status:
                      true,

                    parties: {
                      where: {
                        walletAddress:
                          actorWallet,
                      },

                      select: {
                        role:
                          true,
                      },
                    },
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            const actorParty =
              agreement.parties[0];

            if (
              !actorParty ||
              actorParty.role !==
                "CLIENT"
            ) {
              throw new AgreementAccessError(
                "Only the client may add milestones.",
              );
            }

            if (
              agreement.status !==
              "DRAFT"
            ) {
              throw new AgreementConflictError(
                "Milestones may only be added to a draft agreement.",
              );
            }

            const aggregate =
              await transaction
                .milestone
                .aggregate({
                  where: {
                    agreementId:
                      agreement.id,
                  },

                  _max: {
                    position:
                      true,
                  },
                });

            const position =
              (
                aggregate
                  ._max
                  .position ??
                0
              ) + 1;

            const milestone =
              await transaction
                .milestone
                .create({
                  data: {
                    agreementId:
                      agreement.id,

                    position,

                    status:
                      "PENDING",

                    ...(
                      input.title !==
                      undefined
                        ? {
                            title:
                              input.title,
                          }
                        : {}
                    ),

                    ...(
                      input.specificationUri !==
                      undefined
                        ? {
                            specificationUri:
                              input.specificationUri,
                          }
                        : {}
                    ),

                    ...(
                      input.amount !==
                      undefined
                        ? {
                            amount:
                              input.amount,
                          }
                        : {}
                    ),

                    ...(
                      input.asset !==
                      undefined
                        ? {
                            asset:
                              input.asset,
                          }
                        : {}
                    ),
                  },

                  select: {
                    id:
                      true,

                    agreementId:
                      true,

                    position:
                      true,

                    status:
                      true,
                  },
                });

            return {
              id:
                milestone.id,

              agreementId:
                milestone.agreementId,

              position:
                milestone.position,

              status:
                milestone.status,
            };
          },
        );
      },

    /* =====================================================
       PROPOSE
       ===================================================== */

    proposeAgreement:
      async (
        input,
      ) => {
        const actorWallet =
          normalizeWalletAddress(
            input.actor.walletAddress,
          );

        return prisma.$transaction(
          async (
            transaction,
          ) => {
            const agreement =
              await transaction
                .agreement
                .findUnique({
                  where: {
                    id:
                      input.agreementId,
                  },

                  select: {
                    id:
                      true,

                    status:
                      true,

                    parties: {
                      where: {
                        walletAddress:
                          actorWallet,
                      },

                      select: {
                        role:
                          true,
                      },
                    },

                    milestones: {
                      take:
                        1,

                      select: {
                        id:
                          true,
                      },
                    },
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            const actorParty =
              agreement.parties[0];

            if (
              !actorParty ||
              actorParty.role !==
                "CLIENT"
            ) {
              throw new AgreementAccessError(
                "Only the client may propose the agreement.",
              );
            }

            if (
              agreement.status !==
              "DRAFT"
            ) {
              throw new AgreementConflictError(
                "Only a draft agreement may be proposed.",
              );
            }

            if (
              agreement.milestones.length ===
              0
            ) {
              throw new AgreementConflictError(
                "At least one milestone is required before proposal.",
              );
            }

            const update =
              await transaction
                .agreement
                .updateMany({
                  where: {
                    id:
                      agreement.id,

                    status:
                      "DRAFT",
                  },

                  data: {
                    status:
                      "PROPOSED",
                  },
                });

            if (
              update.count !==
              1
            ) {
              throw new AgreementConflictError(
                "Agreement state changed before proposal.",
              );
            }

            return {
              id:
                agreement.id,

              status:
                "PROPOSED",
            };
          },
        );
      },

    /* =====================================================
       ACCEPT
       ===================================================== */

    acceptAgreement:
      async (
        input,
      ) => {
        const actorWallet =
          normalizeWalletAddress(
            input.actor.walletAddress,
          );

        return prisma.$transaction(
          async (
            transaction,
          ) => {
            const agreement =
              await transaction
                .agreement
                .findUnique({
                  where: {
                    id:
                      input.agreementId,
                  },

                  select: {
                    id:
                      true,

                    status:
                      true,

                    termsVersion:
                      true,

                    termsHash:
                      true,

                    parties: {
                      where: {
                        walletAddress:
                          actorWallet,
                      },

                      select: {
                        id:
                          true,

                        role:
                          true,
                      },
                    },
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            const contractor =
              agreement.parties[0];

            if (
              !contractor ||
              contractor.role !==
                "CONTRACTOR"
            ) {
              throw new AgreementAccessError(
                "Only the contractor may accept the agreement.",
              );
            }

            if (
              agreement.status !==
              "PROPOSED"
            ) {
              throw new AgreementConflictError(
                "Only a proposed agreement may be accepted.",
              );
            }

            const existingAcceptance =
              await transaction
                .agreementAcceptance
                .findFirst({
                  where: {
                    agreementId:
                      agreement.id,

                    partyId:
                      contractor.id,

                    termsVersion:
                      agreement.termsVersion,
                  },

                  select: {
                    id:
                      true,
                  },
                });

            if (existingAcceptance) {
              throw new AgreementConflictError(
                "This agreement version has already been accepted.",
              );
            }

            const update =
              await transaction
                .agreement
                .updateMany({
                  where: {
                    id:
                      agreement.id,

                    status:
                      "PROPOSED",
                  },

                  data: {
                    status:
                      "ACCEPTED",
                  },
                });

            if (
              update.count !==
              1
            ) {
              throw new AgreementConflictError(
                "Agreement state changed before acceptance.",
              );
            }

            await transaction
              .agreementAcceptance
              .create({
                data: {
                  agreementId:
                    agreement.id,

                  partyId:
                    contractor.id,

                  termsVersion:
                    agreement.termsVersion,

                  ...(
                    agreement.termsHash !==
                    null
                      ? {
                          termsHash:
                            agreement.termsHash,
                        }
                      : {}
                  ),
                },
              });

            return {
              id:
                agreement.id,

              status:
                "ACCEPTED",
            };
          },
        );
      },

    /* =====================================================
       SUBMIT EVIDENCE
       ===================================================== */

    submitEvidence:
      async (
        input,
      ) => {
        const actorWallet =
          normalizeWalletAddress(
            input.actor.walletAddress,
          );

        return prisma.$transaction(
          async (
            transaction,
          ) => {
            const agreement =
              await transaction
                .agreement
                .findUnique({
                  where: {
                    id:
                      input.agreementId,
                  },

                  select: {
                    id:
                      true,

                    status:
                      true,

                    parties: {
                      where: {
                        walletAddress:
                          actorWallet,
                      },

                      select: {
                        id:
                          true,

                        role:
                          true,
                      },
                    },
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            const contractor =
              agreement.parties[0];

            if (
              !contractor ||
              contractor.role !==
                "CONTRACTOR"
            ) {
              throw new AgreementAccessError(
                "Only the contractor may submit evidence.",
              );
            }

            if (
              agreement.status !==
                "ACCEPTED" &&
              agreement.status !==
                "IN_PROGRESS"
            ) {
              throw new AgreementConflictError(
                "Evidence may only be submitted after acceptance.",
              );
            }

            const milestone =
              await transaction
                .milestone
                .findFirst({
                  where: {
                    id:
                      input.milestoneId,

                    agreementId:
                      agreement.id,
                  },

                  select: {
                    id:
                      true,

                    status:
                      true,
                  },
                });

            if (!milestone) {
              throw new AgreementNotFoundError();
            }

            if (
              milestone.status !==
                "PENDING" &&
              milestone.status !==
                "REVISION_REQUESTED"
            ) {
              throw new AgreementConflictError(
                "Milestone is not ready for evidence submission.",
              );
            }

            const evidence =
              await transaction
                .evidence
                .create({
                  data: {
                    milestoneId:
                      milestone.id,

                    submittedByPartyId:
                      contractor.id,

                    uri:
                      input.uri,

                    ...(
                      input.hash !==
                      undefined
                        ? {
                            hash:
                              input.hash,
                          }
                        : {}
                    ),

                    ...(
                      input.description !==
                      undefined
                        ? {
                            description:
                              input.description,
                          }
                        : {}
                    ),
                  },

                  select: {
                    id:
                      true,

                    milestoneId:
                      true,

                    uri:
                      true,

                    hash:
                      true,
                  },
                });

            await transaction
              .milestone
              .update({
                where: {
                  id:
                    milestone.id,
                },

                data: {
                  status:
                    "SUBMITTED",
                },
              });

            if (
              agreement.status ===
              "ACCEPTED"
            ) {
              await transaction
                .agreement
                .update({
                  where: {
                    id:
                      agreement.id,
                  },

                  data: {
                    status:
                      "IN_PROGRESS",
                  },
                });
            }

            return {
              id:
                evidence.id,

              milestoneId:
                evidence.milestoneId,

              uri:
                evidence.uri,

              hash:
                evidence.hash,
            };
          },
        );
      },

    /* =====================================================
       REVIEW MILESTONE
       ===================================================== */

    requestMilestoneRevision:
      async (
        input,
      ) =>
        reviewSubmittedMilestone(
          input,
          "REVISION_REQUESTED",
        ),

    approveMilestone:
      async (
        input,
      ) =>
        reviewSubmittedMilestone(
          input,
          "APPROVED",
        ),
  };
}