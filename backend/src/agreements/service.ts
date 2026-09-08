import type {
  PrismaClient,
} from "../generated/prisma/client.js";

import {
  AgreementAccessError,
  AgreementConflictError,
  AgreementNotFoundError,
  type AgreementRouteOperations,
  type CanonicalAgreementRouteOperations,
  type AgreementView,
  type MilestoneReviewInput,
  type MilestoneRouteResult,
} from "./routes.js";
import {
  computeCanonicalAgreementHash,
  deriveCanonicalLifecycleStatus,
  generatePartyAccessToken,
  hashPartyAccessToken,
  normalizeCanonicalAgreementTerms,
  serializeCanonicalAgreementTerms,
  verifyPartyAccessToken,
} from "./canonical.js";

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
): AgreementRouteOperations & CanonicalAgreementRouteOperations {
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

    persistReviewedAgreement:
      async (
        input,
      ) => {
        const terms =
          normalizeCanonicalAgreementTerms(
            input.terms,
          );

        const agreementHash =
          computeCanonicalAgreementHash(
            terms,
          );

        const canonicalTerms =
          JSON.parse(
            serializeCanonicalAgreementTerms(
              terms,
            ),
          );

        const clientAccessToken =
          generatePartyAccessToken();

        const contractorAccessToken =
          generatePartyAccessToken();

        const clientAccessCredentialHash =
          hashPartyAccessToken(
            clientAccessToken,
          );

        const contractorAccessCredentialHash =
          hashPartyAccessToken(
            contractorAccessToken,
          );

        return prisma.$transaction(
          async (
            transaction,
          ) => {
            const agreement =
              await transaction
                .agreement
                .create({
                  data: {
                    createdByUserId:
                      input.actor.userId,

                    title:
                      terms.title,

                    termsHash:
                      agreementHash,

                    termsVersion:
                      1,

                    status:
                      "AWAITING_ACCEPTANCE",

                    revisions: {
                      create: {
                        agreementVersion:
                          1,

                        agreementHash,

                        canonicalTerms,
                      },
                    },

                    parties: {
                      create: [
                        {
                          role:
                            "CLIENT",

                          displayName:
                            input.client
                              .displayName ??
                            null,

                          walletAddress:
                            null,

                          accessCredentialHash:
                            clientAccessCredentialHash,
                        },

                        {
                          role:
                            "CONTRACTOR",

                          displayName:
                            input.contractor
                              .displayName ??
                            null,

                          walletAddress:
                            null,

                          accessCredentialHash:
                            contractorAccessCredentialHash,
                        },
                      ],
                    },
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
                      select: {
                        id:
                          true,

                        role:
                          true,

                        displayName:
                          true,

                        walletAddress:
                          true,
                      },
                    },
                  },
                });

            const clientParty =
              agreement.parties.find(
                (party) =>
                  party.role ===
                  "CLIENT",
              );

            const contractorParty =
              agreement.parties.find(
                (party) =>
                  party.role ===
                  "CONTRACTOR",
              );

            if (
              !clientParty ||
              !contractorParty ||
              agreement.termsHash ===
                null
            ) {
              throw new AgreementConflictError(
                "Canonical agreement parties or hash were not persisted correctly.",
              );
            }

            return {
              lifecycle: {
                reference: {
                  agreementId:
                    agreement.id,

                  agreementVersion:
                    agreement
                      .termsVersion,

                  agreementHash:
                    agreement
                      .termsHash,
                },

                status:
                  "AWAITING_ACCEPTANCE",

                acceptanceComplete:
                  false,

                walletBindingComplete:
                  false,

                parties: [
                  {
                    partyId:
                      clientParty.id,

                    role:
                      "CLIENT",

                    displayName:
                      clientParty
                        .displayName,

                    acceptedCurrentVersion:
                      false,

                    walletBound:
                      false,

                    walletAddress:
                      null,
                  },

                  {
                    partyId:
                      contractorParty.id,

                    role:
                      "CONTRACTOR",

                    displayName:
                      contractorParty
                        .displayName,

                    acceptedCurrentVersion:
                      false,

                    walletBound:
                      false,

                    walletAddress:
                      null,
                  },
                ],
              },

              partyAccess: [
                {
                  partyId:
                    clientParty.id,

                  role:
                    "CLIENT",

                  accessToken:
                    clientAccessToken,
                },

                {
                  partyId:
                    contractorParty.id,

                  role:
                    "CONTRACTOR",

                  accessToken:
                    contractorAccessToken,
                },
              ],
            };
          },
        );
      },

    acceptAgreementVersion:
      async (
        input,
      ) => {
        return prisma.$transaction(
          async (
            transaction,
          ) => {
            await transaction
              .$queryRaw<
                Array<{
                  readonly id:
                    string;
                }>
              >`
                SELECT "id"
                FROM "Agreement"
                WHERE "id" = ${input.agreementId}
                FOR UPDATE
              `;

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
                      select: {
                        id:
                          true,

                        role:
                          true,

                        displayName:
                          true,

                        walletAddress:
                          true,

                        accessCredentialHash:
                          true,
                      },
                    },
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            const party =
              agreement.parties.find(
                (candidate) =>
                  candidate.id ===
                  input.partyId,
              );

            if (
              !party ||
              !party
                .accessCredentialHash ||
              !verifyPartyAccessToken(
                input.partyAccessToken,
                party
                  .accessCredentialHash,
              )
            ) {
              throw new AgreementAccessError(
                "Party credential does not authorize this agreement party.",
              );
            }

            if (
              input.agreementVersion !==
              agreement.termsVersion
            ) {
              throw new AgreementConflictError(
                "Agreement version is stale.",
              );
            }

            if (
              agreement.termsHash ===
                null ||
              input.agreementHash !==
                agreement.termsHash
            ) {
              throw new AgreementConflictError(
                "Agreement hash is stale.",
              );
            }

            const clientParty =
              agreement.parties.find(
                (candidate) =>
                  candidate.role ===
                  "CLIENT",
              );

            const contractorParty =
              agreement.parties.find(
                (candidate) =>
                  candidate.role ===
                  "CONTRACTOR",
              );

            if (
              !clientParty ||
              !contractorParty
            ) {
              throw new AgreementConflictError(
                "Canonical agreement parties are incomplete.",
              );
            }

            const acceptance =
              await transaction
                .agreementAcceptance
                .upsert({
                  where: {
                    agreementId_partyId_termsVersion:
                      {
                        agreementId:
                          agreement.id,

                        partyId:
                          party.id,

                        termsVersion:
                          agreement
                            .termsVersion,
                      },
                  },

                  update: {},

                  create: {
                    agreementId:
                      agreement.id,

                    partyId:
                      party.id,

                    termsVersion:
                      agreement
                        .termsVersion,

                    termsHash:
                      agreement
                        .termsHash,
                  },

                  select: {
                    partyId:
                      true,

                    termsVersion:
                      true,

                    termsHash:
                      true,

                    acceptedAt:
                      true,
                  },
                });

            if (
              acceptance.termsHash !==
              agreement.termsHash
            ) {
              throw new AgreementConflictError(
                "Stored acceptance does not match the current canonical hash.",
              );
            }

            const currentAcceptances =
              await transaction
                .agreementAcceptance
                .findMany({
                  where: {
                    agreementId:
                      agreement.id,

                    termsVersion:
                      agreement
                        .termsVersion,

                    termsHash:
                      agreement
                        .termsHash,
                  },

                  select: {
                    partyId:
                      true,
                  },
                });

            const acceptedPartyIds =
              new Set(
                currentAcceptances.map(
                  (entry) =>
                    entry.partyId,
                ),
              );

            const lifecycleStatus =
              deriveCanonicalLifecycleStatus([
                {
                  role:
                    "CLIENT",

                  acceptedCurrentVersion:
                    acceptedPartyIds.has(
                      clientParty.id,
                    ),

                  walletAddress:
                    clientParty
                      .walletAddress,
                },

                {
                  role:
                    "CONTRACTOR",

                  acceptedCurrentVersion:
                    acceptedPartyIds.has(
                      contractorParty.id,
                    ),

                  walletAddress:
                    contractorParty
                      .walletAddress,
                },
              ]);

            if (
              agreement.status !==
              lifecycleStatus
            ) {
              const update =
                await transaction
                  .agreement
                  .updateMany({
                    where: {
                      id:
                        agreement.id,

                      termsVersion:
                        agreement
                          .termsVersion,

                      termsHash:
                        agreement
                          .termsHash,
                    },

                    data: {
                      status:
                        lifecycleStatus,
                    },
                  });

              if (
                update.count !==
                1
              ) {
                throw new AgreementConflictError(
                  "Agreement state changed during acceptance.",
                );
              }
            }

            const acceptanceComplete =
              acceptedPartyIds.has(
                clientParty.id,
              ) &&
              acceptedPartyIds.has(
                contractorParty.id,
              );

            const walletBindingComplete =
              clientParty
                .walletAddress !==
                null &&
              contractorParty
                .walletAddress !==
                null;

            return {
              acceptance: {
                partyId:
                  party.id,

                role:
                  party.role,

                agreementVersion:
                  agreement.termsVersion,

                agreementHash:
                  agreement.termsHash,

                acceptedAt:
                  acceptance
                    .acceptedAt
                    .toISOString(),

                current:
                  true,
              },

              lifecycle: {
                reference: {
                  agreementId:
                    agreement.id,

                  agreementVersion:
                    agreement
                      .termsVersion,

                  agreementHash:
                    agreement
                      .termsHash,
                },

                status:
                  lifecycleStatus,

                acceptanceComplete,

                walletBindingComplete,

                parties: [
                  {
                    partyId:
                      clientParty.id,

                    role:
                      "CLIENT",

                    displayName:
                      clientParty
                        .displayName,

                    acceptedCurrentVersion:
                      acceptedPartyIds.has(
                        clientParty.id,
                      ),

                    walletBound:
                      clientParty
                        .walletAddress !==
                        null,

                    walletAddress:
                      clientParty
                        .walletAddress,
                  },

                  {
                    partyId:
                      contractorParty.id,

                    role:
                      "CONTRACTOR",

                    displayName:
                      contractorParty
                        .displayName,

                    acceptedCurrentVersion:
                      acceptedPartyIds.has(
                        contractorParty.id,
                      ),

                    walletBound:
                      contractorParty
                        .walletAddress !==
                        null,

                    walletAddress:
                      contractorParty
                        .walletAddress,
                  },
                ],
              },
            };
          },
        );
      },

    reviseCanonicalAgreement:
      async (
        input,
      ) => {
        return prisma.$transaction(
          async (
            transaction,
          ) => {
            await transaction
              .$queryRaw<
                Array<{
                  readonly id:
                    string;
                }>
              >`
                SELECT "id"
                FROM "Agreement"
                WHERE "id" = ${input.expected.agreementId}
                FOR UPDATE
              `;

            const agreement =
              await transaction
                .agreement
                .findUnique({
                  where: {
                    id:
                      input.expected
                        .agreementId,
                  },

                  select: {
                    id:
                      true,

                    createdByUserId:
                      true,

                    status:
                      true,

                    termsVersion:
                      true,

                    termsHash:
                      true,

                    parties: {
                      select: {
                        id:
                          true,

                        role:
                          true,

                        displayName:
                          true,

                        walletAddress:
                          true,
                      },
                    },
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            if (
              agreement.createdByUserId !==
              input.actor.userId
            ) {
              throw new AgreementAccessError(
                "Only the authenticated agreement creator may revise canonical terms.",
              );
            }

            if (
              agreement.termsHash ===
              null ||
              input.expected
                .agreementId !==
                agreement.id ||
              input.expected
                .agreementVersion !==
                agreement.termsVersion ||
              input.expected
                .agreementHash !==
                agreement.termsHash
            ) {
              throw new AgreementConflictError(
                "Expected agreement tuple is stale.",
              );
            }

            const currentRevision =
              await transaction
                .agreementRevision
                .findUnique({
                  where: {
                    agreementId_agreementVersion:
                      {
                        agreementId:
                          agreement.id,

                        agreementVersion:
                          agreement
                            .termsVersion,
                      },
                  },

                  select: {
                    agreementHash:
                      true,
                  },
                });

            if (
              !currentRevision ||
              currentRevision
                .agreementHash !==
                agreement.termsHash
            ) {
              throw new AgreementConflictError(
                "Agreement is not backed by the current canonical revision.",
              );
            }

            if (
              agreement.status ===
              "READY_TO_FUND"
            ) {
              throw new AgreementConflictError(
                "READY_TO_FUND agreements cannot be revised.",
              );
            }

            const terms =
              normalizeCanonicalAgreementTerms(
                input.terms,
              );

            const agreementHash =
              computeCanonicalAgreementHash(
                terms,
              );

            const canonicalTerms =
              JSON.parse(
                serializeCanonicalAgreementTerms(
                  terms,
                ),
              );

            const nextVersion =
              agreement.termsVersion +
              1;

            const previous = {
              agreementId:
                agreement.id,

              agreementVersion:
                agreement.termsVersion,

              agreementHash:
                agreement.termsHash,
            };

            const update =
              await transaction
                .agreement
                .updateMany({
                  where: {
                    id:
                      agreement.id,

                    termsVersion:
                      agreement
                        .termsVersion,

                    termsHash:
                      agreement
                        .termsHash,
                  },

                  data: {
                    title:
                      terms.title,

                    termsVersion:
                      nextVersion,

                    termsHash:
                      agreementHash,

                    status:
                      "AWAITING_ACCEPTANCE",
                  },
                });

            if (
              update.count !==
              1
            ) {
              throw new AgreementConflictError(
                "Agreement state changed during revision.",
              );
            }

            await transaction
              .agreementRevision
              .create({
                data: {
                  agreementId:
                    agreement.id,

                  agreementVersion:
                    nextVersion,

                  agreementHash,

                  canonicalTerms,
                },
              });

            const clientParty =
              agreement.parties.find(
                (party) =>
                  party.role ===
                  "CLIENT",
              );

            const contractorParty =
              agreement.parties.find(
                (party) =>
                  party.role ===
                  "CONTRACTOR",
              );

            if (
              !clientParty ||
              !contractorParty
            ) {
              throw new AgreementConflictError(
                "Canonical agreement parties are incomplete.",
              );
            }

            const walletBindingComplete =
              clientParty
                .walletAddress !==
                null &&
              contractorParty
                .walletAddress !==
                null;

            const current = {
              agreementId:
                agreement.id,

              agreementVersion:
                nextVersion,

              agreementHash,
            };

            return {
              previous,

              current,

              lifecycle: {
                reference:
                  current,

                status:
                  "AWAITING_ACCEPTANCE",

                acceptanceComplete:
                  false,

                walletBindingComplete,

                parties: [
                  {
                    partyId:
                      clientParty.id,

                    role:
                      "CLIENT",

                    displayName:
                      clientParty
                        .displayName,

                    acceptedCurrentVersion:
                      false,

                    walletBound:
                      clientParty
                        .walletAddress !==
                        null,

                    walletAddress:
                      clientParty
                        .walletAddress,
                  },

                  {
                    partyId:
                      contractorParty.id,

                    role:
                      "CONTRACTOR",

                    displayName:
                      contractorParty
                        .displayName,

                    acceptedCurrentVersion:
                      false,

                    walletBound:
                      contractorParty
                        .walletAddress !==
                        null,

                    walletAddress:
                      contractorParty
                        .walletAddress,
                  },
                ],
              },
            };
          },
        );
      },

    bindAgreementPartyWallet:
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
            await transaction
              .$queryRaw<
                Array<{
                  readonly id:
                    string;
                }>
              >`
                SELECT "id"
                FROM "Agreement"
                WHERE "id" = ${input.agreementId}
                FOR UPDATE
              `;

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
                      select: {
                        id:
                          true,

                        role:
                          true,

                        displayName:
                          true,

                        walletAddress:
                          true,

                        accessCredentialHash:
                          true,
                      },
                    },
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            if (
              agreement.termsHash ===
              null
            ) {
              throw new AgreementConflictError(
                "Agreement does not have a canonical hash.",
              );
            }

            const clientParty =
              agreement.parties.find(
                (candidate) =>
                  candidate.role ===
                  "CLIENT",
              );

            const contractorParty =
              agreement.parties.find(
                (candidate) =>
                  candidate.role ===
                  "CONTRACTOR",
              );

            if (
              !clientParty ||
              !contractorParty
            ) {
              throw new AgreementConflictError(
                "Canonical agreement parties are incomplete.",
              );
            }

            const party =
              agreement.parties.find(
                (candidate) =>
                  candidate.id ===
                  input.partyId,
              );

            if (
              !party ||
              !party
                .accessCredentialHash ||
              !verifyPartyAccessToken(
                input.partyAccessToken,
                party
                  .accessCredentialHash,
              )
            ) {
              throw new AgreementAccessError(
                "Party credential does not authorize this wallet binding.",
              );
            }

            const currentAcceptances =
              await transaction
                .agreementAcceptance
                .findMany({
                  where: {
                    agreementId:
                      agreement.id,

                    termsVersion:
                      agreement
                        .termsVersion,

                    termsHash:
                      agreement
                        .termsHash,
                  },

                  select: {
                    partyId:
                      true,
                  },
                });

            const acceptedPartyIds =
              new Set(
                currentAcceptances.map(
                  (entry) =>
                    entry.partyId,
                ),
              );

            const acceptanceComplete =
              acceptedPartyIds.has(
                clientParty.id,
              ) &&
              acceptedPartyIds.has(
                contractorParty.id,
              );

            if (!acceptanceComplete) {
              throw new AgreementConflictError(
                "Wallet binding requires both current agreement acceptances.",
              );
            }

            const otherParty =
              party.id ===
              clientParty.id
                ? contractorParty
                : clientParty;

            if (
              otherParty
                .walletAddress !==
                null &&
              sameWallet(
                otherParty
                  .walletAddress,
                actorWallet,
              )
            ) {
              throw new AgreementConflictError(
                "CLIENT and CONTRACTOR must bind different wallets.",
              );
            }

            if (
              party.walletAddress !==
              null &&
              !sameWallet(
                party.walletAddress,
                actorWallet,
              )
            ) {
              throw new AgreementConflictError(
                "Agreement party is already bound to a different wallet.",
              );
            }

            if (
              party.walletAddress ===
              null
            ) {
              const bind =
                await transaction
                  .agreementParty
                  .updateMany({
                    where: {
                      id:
                        party.id,

                      agreementId:
                        agreement.id,

                      walletAddress:
                        null,
                    },

                    data: {
                      walletAddress:
                        actorWallet,
                    },
                  });

              if (
                bind.count !==
                1
              ) {
                throw new AgreementConflictError(
                  "Agreement party wallet changed during binding.",
                );
              }
            }

            const clientWalletAddress =
              clientParty.id ===
              party.id
                ? actorWallet
                : clientParty
                    .walletAddress;

            const contractorWalletAddress =
              contractorParty.id ===
              party.id
                ? actorWallet
                : contractorParty
                    .walletAddress;

            const lifecycleStatus =
              deriveCanonicalLifecycleStatus([
                {
                  role:
                    "CLIENT",

                  acceptedCurrentVersion:
                    true,

                  walletAddress:
                    clientWalletAddress,
                },

                {
                  role:
                    "CONTRACTOR",

                  acceptedCurrentVersion:
                    true,

                  walletAddress:
                    contractorWalletAddress,
                },
              ]);

            if (
              agreement.status !==
              lifecycleStatus
            ) {
              const update =
                await transaction
                  .agreement
                  .updateMany({
                    where: {
                      id:
                        agreement.id,

                      termsVersion:
                        agreement
                          .termsVersion,

                      termsHash:
                        agreement
                          .termsHash,
                    },

                    data: {
                      status:
                        lifecycleStatus,
                    },
                  });

              if (
                update.count !==
                1
              ) {
                throw new AgreementConflictError(
                  "Agreement state changed during wallet binding.",
                );
              }
            }

            const walletBindingComplete =
              clientWalletAddress !==
                null &&
              contractorWalletAddress !==
                null;

            return {
              partyId:
                party.id,

              role:
                party.role,

              walletAddress:
                actorWallet,

              lifecycle: {
                reference: {
                  agreementId:
                    agreement.id,

                  agreementVersion:
                    agreement
                      .termsVersion,

                  agreementHash:
                    agreement
                      .termsHash,
                },

                status:
                  lifecycleStatus,

                acceptanceComplete:
                  true,

                walletBindingComplete,

                parties: [
                  {
                    partyId:
                      clientParty.id,

                    role:
                      "CLIENT",

                    displayName:
                      clientParty
                        .displayName,

                    acceptedCurrentVersion:
                      true,

                    walletBound:
                      clientWalletAddress !==
                      null,

                    walletAddress:
                      clientWalletAddress,
                  },

                  {
                    partyId:
                      contractorParty.id,

                    role:
                      "CONTRACTOR",

                    displayName:
                      contractorParty
                        .displayName,

                    acceptedCurrentVersion:
                      true,

                    walletBound:
                      contractorWalletAddress !==
                      null,

                    walletAddress:
                      contractorWalletAddress,
                  },
                ],
              },
            };
          },
        );
      },

    getCanonicalAgreementLifecycle:
      async (
        input,
      ) => {
        return prisma.$transaction(
          async (
            transaction,
          ) => {
            await transaction
              .$queryRaw<
                Array<{
                  readonly id:
                    string;
                }>
              >`
                SELECT "id"
                FROM "Agreement"
                WHERE "id" = ${input.agreementId}
                FOR SHARE
              `;

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
                      select: {
                        id:
                          true,

                        role:
                          true,

                        displayName:
                          true,

                        walletAddress:
                          true,
                      },
                    },
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            if (
              agreement.termsHash ===
              null
            ) {
              throw new AgreementConflictError(
                "Agreement does not have a canonical hash.",
              );
            }

            const currentRevision =
              await transaction
                .agreementRevision
                .findUnique({
                  where: {
                    agreementId_agreementVersion:
                      {
                        agreementId:
                          agreement.id,

                        agreementVersion:
                          agreement
                            .termsVersion,
                      },
                  },

                  select: {
                    agreementHash:
                      true,
                  },
                });

            if (
              !currentRevision ||
              currentRevision
                .agreementHash !==
                agreement.termsHash
            ) {
              throw new AgreementConflictError(
                "Agreement is not backed by the current canonical revision.",
              );
            }

            const clientParty =
              agreement.parties.find(
                (candidate) =>
                  candidate.role ===
                  "CLIENT",
              );

            const contractorParty =
              agreement.parties.find(
                (candidate) =>
                  candidate.role ===
                  "CONTRACTOR",
              );

            if (
              !clientParty ||
              !contractorParty
            ) {
              throw new AgreementConflictError(
                "Canonical agreement parties are incomplete.",
              );
            }

            const currentAcceptances =
              await transaction
                .agreementAcceptance
                .findMany({
                  where: {
                    agreementId:
                      agreement.id,

                    termsVersion:
                      agreement
                        .termsVersion,

                    termsHash:
                      agreement
                        .termsHash,
                  },

                  select: {
                    partyId:
                      true,
                  },
                });

            const acceptedPartyIds =
              new Set(
                currentAcceptances.map(
                  (entry) =>
                    entry.partyId,
                ),
              );

            const clientAccepted =
              acceptedPartyIds.has(
                clientParty.id,
              );

            const contractorAccepted =
              acceptedPartyIds.has(
                contractorParty.id,
              );

            const lifecycleStatus =
              deriveCanonicalLifecycleStatus([
                {
                  role:
                    "CLIENT",

                  acceptedCurrentVersion:
                    clientAccepted,

                  walletAddress:
                    clientParty
                      .walletAddress,
                },

                {
                  role:
                    "CONTRACTOR",

                  acceptedCurrentVersion:
                    contractorAccepted,

                  walletAddress:
                    contractorParty
                      .walletAddress,
                },
              ]);

            const acceptanceComplete =
              clientAccepted &&
              contractorAccepted;

            const walletBindingComplete =
              clientParty
                .walletAddress !==
                null &&
              contractorParty
                .walletAddress !==
                null;

            return {
              reference: {
                agreementId:
                  agreement.id,

                agreementVersion:
                  agreement
                    .termsVersion,

                agreementHash:
                  agreement
                    .termsHash,
              },

              status:
                lifecycleStatus,

              acceptanceComplete,

              walletBindingComplete,

              parties: [
                {
                  partyId:
                    clientParty.id,

                  role:
                    "CLIENT",

                  displayName:
                    clientParty
                      .displayName,

                  acceptedCurrentVersion:
                    clientAccepted,

                  walletBound:
                    clientParty
                      .walletAddress !==
                      null,

                  walletAddress:
                    clientParty
                      .walletAddress,
                },

                {
                  partyId:
                    contractorParty.id,

                  role:
                    "CONTRACTOR",

                  displayName:
                    contractorParty
                      .displayName,

                  acceptedCurrentVersion:
                    contractorAccepted,

                  walletBound:
                    contractorParty
                      .walletAddress !==
                      null,

                  walletAddress:
                    contractorParty
                      .walletAddress,
                },
              ],
            };
          },
        );
      },

    listCanonicalAgreementAcceptances:
      async (
        input,
      ) => {
        return prisma.$transaction(
          async (
            transaction,
          ) => {
            await transaction
              .$queryRaw<
                Array<{
                  readonly id:
                    string;
                }>
              >`
                SELECT "id"
                FROM "Agreement"
                WHERE "id" = ${input.agreementId}
                FOR SHARE
              `;

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

                    termsVersion:
                      true,

                    termsHash:
                      true,
                  },
                });

            if (!agreement) {
              throw new AgreementNotFoundError();
            }

            if (
              agreement.termsHash ===
              null
            ) {
              throw new AgreementConflictError(
                "Agreement does not have a canonical hash.",
              );
            }

            const currentRevision =
              await transaction
                .agreementRevision
                .findUnique({
                  where: {
                    agreementId_agreementVersion:
                      {
                        agreementId:
                          agreement.id,

                        agreementVersion:
                          agreement
                            .termsVersion,
                      },
                  },

                  select: {
                    agreementHash:
                      true,
                  },
                });

            if (
              !currentRevision ||
              currentRevision
                .agreementHash !==
                agreement.termsHash
            ) {
              throw new AgreementConflictError(
                "Agreement is not backed by the current canonical revision.",
              );
            }

            const acceptances =
              await transaction
                .agreementAcceptance
                .findMany({
                  where: {
                    agreementId:
                      agreement.id,
                  },

                  orderBy: [
                    {
                      termsVersion:
                        "asc",
                    },

                    {
                      acceptedAt:
                        "asc",
                    },
                  ],

                  select: {
                    partyId:
                      true,

                    termsVersion:
                      true,

                    termsHash:
                      true,

                    acceptedAt:
                      true,

                    party: {
                      select: {
                        role:
                          true,
                      },
                    },
                  },
                });

            return acceptances.map(
              (
                acceptance,
              ) => {
                if (
                  acceptance
                    .termsHash ===
                    null
                ) {
                  throw new AgreementConflictError(
                    "Canonical acceptance history contains an unhashed acceptance.",
                  );
                }

                return {
                  partyId:
                    acceptance
                      .partyId,

                  role:
                    acceptance
                      .party.role,

                  agreementVersion:
                    acceptance
                      .termsVersion,

                  agreementHash:
                    acceptance
                      .termsHash,

                  acceptedAt:
                    acceptance
                      .acceptedAt
                      .toISOString(),

                  current:
                    acceptance
                      .termsVersion ===
                      agreement
                        .termsVersion &&
                    acceptance
                      .termsHash ===
                      agreement
                        .termsHash,
                };
              },
            );
          },
        );
      },

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
              party.walletAddress !==
                null &&
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

                    revisions: {
                      take:
                        1,

                      select: {
                        id:
                          true,
                      },
                    },

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

            if (
              agreement.revisions.length >
              0
            ) {
              throw new AgreementConflictError(
                "Canonical agreements must use exact-tuple dual acceptance.",
              );
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