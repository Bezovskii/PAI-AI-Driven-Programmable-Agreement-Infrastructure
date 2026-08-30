import assert from "node:assert/strict";
import test from "node:test";

import type {
  PrismaClient,
} from "../src/generated/prisma/client.js";

import {
  AgreementAccessError,
  AgreementConflictError,
} from "../src/agreements/routes.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

const CLIENT_WALLET =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const CONTRACTOR_WALLET =
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

const CLIENT_WALLET_NORMALIZED =
  CLIENT_WALLET.toLowerCase();

const CONTRACTOR_WALLET_NORMALIZED =
  CONTRACTOR_WALLET.toLowerCase();

const CLIENT_ACTOR = {
  userId:
    "user-client",

  walletAddress:
    CLIENT_WALLET,
};

const CONTRACTOR_ACTOR = {
  userId:
    "user-contractor",

  walletAddress:
    CONTRACTOR_WALLET,
};

function asPrismaClient(
  value: unknown,
): PrismaClient {
  return value as PrismaClient;
}

/* =========================================================
   CREATE
   ========================================================= */

test(
  "PAI creates a DRAFT with CLIENT and CONTRACTOR parties",
  async () => {
    let capturedData:
      unknown;

    const prisma =
      asPrismaClient({
        agreement: {
          create:
            async (
              args: {
                data:
                  unknown;
              },
            ) => {
              capturedData =
                args.data;

              return {
                id:
                  "agreement-1",

                status:
                  "DRAFT",
              };
            },
        },
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .createAgreement({
          actor:
            CLIENT_ACTOR,

          contractorWalletAddress:
            CONTRACTOR_WALLET,

          title:
            "Website delivery",

          metadataUri:
            "ipfs://agreement",

          termsHash:
            "0xterms",
        });

    assert.deepEqual(
      result,
      {
        id:
          "agreement-1",

        status:
          "DRAFT",
      },
    );

    assert.deepEqual(
      capturedData,
      {
        createdByUserId:
          "user-client",

        status:
          "DRAFT",

        title:
          "Website delivery",

        metadataUri:
          "ipfs://agreement",

        termsHash:
          "0xterms",

        parties: {
          create: [
            {
              walletAddress:
                CLIENT_WALLET_NORMALIZED,

              role:
                "CLIENT",
            },

            {
              walletAddress:
                CONTRACTOR_WALLET_NORMALIZED,

              role:
                "CONTRACTOR",
            },
          ],
        },
      },
    );
  },
);

test(
  "PAI rejects an agreement where client and contractor use the same wallet",
  async () => {
    let databaseCalled =
      false;

    const prisma =
      asPrismaClient({
        agreement: {
          create:
            async () => {
              databaseCalled =
                true;

              return {
                id:
                  "unexpected",

                status:
                  "DRAFT",
              };
            },
        },
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    await assert.rejects(
      () =>
        operations
          .createAgreement({
            actor:
              CLIENT_ACTOR,

            contractorWalletAddress:
              CLIENT_WALLET
                .toLowerCase(),
          }),

      AgreementConflictError,
    );

    assert.equal(
      databaseCalled,
      false,
    );
  },
);

/* =========================================================
   ADD MILESTONE
   ========================================================= */

test(
  "CLIENT adds next PENDING milestone while agreement is DRAFT",
  async () => {
    let capturedMilestone:
      unknown;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "DRAFT",

            parties: [
              {
                role:
                  "CLIENT",
              },
            ],
          }),
      },

      milestone: {
        aggregate:
          async () => ({
            _max: {
              position:
                2,
            },
          }),

        create:
          async (
            args: {
              data:
                unknown;
            },
          ) => {
            capturedMilestone =
              args.data;

            return {
              id:
                "milestone-3",

              agreementId:
                "agreement-1",

              position:
                3,

              status:
                "PENDING",
            };
          },
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .addMilestone({
          actor:
            CLIENT_ACTOR,

          agreementId:
            "agreement-1",

          title:
            "Final delivery",

          specificationUri:
            "ipfs://milestone-3",

          amount:
            "500",

          asset:
            "USDC",
        });

    assert.deepEqual(
      result,
      {
        id:
          "milestone-3",

        agreementId:
          "agreement-1",

        position:
          3,

        status:
          "PENDING",
      },
    );

    assert.deepEqual(
      capturedMilestone,
      {
        agreementId:
          "agreement-1",

        position:
          3,

        status:
          "PENDING",

        title:
          "Final delivery",

        specificationUri:
          "ipfs://milestone-3",

        amount:
          "500",

        asset:
          "USDC",
      },
    );
  },
);

test(
  "CONTRACTOR cannot add milestones",
  async () => {
    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "DRAFT",

            parties: [
              {
                role:
                  "CONTRACTOR",
              },
            ],
          }),
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    await assert.rejects(
      () =>
        operations
          .addMilestone({
            actor:
              CONTRACTOR_ACTOR,

            agreementId:
              "agreement-1",
          }),

      AgreementAccessError,
    );
  },
);

/* =========================================================
   PROPOSE
   ========================================================= */

test(
  "CLIENT advances DRAFT agreement to PROPOSED when a milestone exists",
  async () => {
    let updateWhere:
      unknown;

    let updateData:
      unknown;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "DRAFT",

            parties: [
              {
                role:
                  "CLIENT",
              },
            ],

            milestones: [
              {
                id:
                  "milestone-1",
              },
            ],
          }),

        updateMany:
          async (
            args: {
              where:
                unknown;

              data:
                unknown;
            },
          ) => {
            updateWhere =
              args.where;

            updateData =
              args.data;

            return {
              count:
                1,
            };
          },
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .proposeAgreement({
          actor:
            CLIENT_ACTOR,

          agreementId:
            "agreement-1",
        });

    assert.deepEqual(
      result,
      {
        id:
          "agreement-1",

        status:
          "PROPOSED",
      },
    );

    assert.deepEqual(
      updateWhere,
      {
        id:
          "agreement-1",

        status:
          "DRAFT",
      },
    );

    assert.deepEqual(
      updateData,
      {
        status:
          "PROPOSED",
      },
    );
  },
);

test(
  "PAI does not allow proposal without a milestone",
  async () => {
    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "DRAFT",

            parties: [
              {
                role:
                  "CLIENT",
              },
            ],

            milestones:
              [],
          }),
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    await assert.rejects(
      () =>
        operations
          .proposeAgreement({
            actor:
              CLIENT_ACTOR,

            agreementId:
              "agreement-1",
          }),

      AgreementConflictError,
    );
  },
);

/* =========================================================
   ACCEPT
   ========================================================= */

test(
  "CONTRACTOR accepts PROPOSED agreement and records terms acceptance",
  async () => {
    let acceptanceData:
      unknown;

    let agreementUpdateData:
      unknown;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "PROPOSED",

            termsVersion:
              1,

            termsHash:
              "0xterms",

            parties: [
              {
                id:
                  "party-contractor",

                role:
                  "CONTRACTOR",
              },
            ],
          }),

        updateMany:
          async (
            args: {
              data:
                unknown;
            },
          ) => {
            agreementUpdateData =
              args.data;

            return {
              count:
                1,
            };
          },
      },

      agreementAcceptance: {
        findFirst:
          async () =>
            null,

        create:
          async (
            args: {
              data:
                unknown;
            },
          ) => {
            acceptanceData =
              args.data;

            return {
              id:
                "acceptance-1",
            };
          },
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .acceptAgreement({
          actor:
            CONTRACTOR_ACTOR,

          agreementId:
            "agreement-1",
        });

    assert.deepEqual(
      result,
      {
        id:
          "agreement-1",

        status:
          "ACCEPTED",
      },
    );

    assert.deepEqual(
      agreementUpdateData,
      {
        status:
          "ACCEPTED",
      },
    );

    assert.deepEqual(
      acceptanceData,
      {
        agreementId:
          "agreement-1",

        partyId:
          "party-contractor",

        termsVersion:
          1,

        termsHash:
          "0xterms",
      },
    );
  },
);

/* =========================================================
   EVIDENCE / IN PROGRESS
   ========================================================= */

test(
  "CONTRACTOR submission moves milestone to SUBMITTED and agreement to IN_PROGRESS",
  async () => {
    let evidenceData:
      unknown;

    let milestoneUpdateData:
      unknown;

    let agreementUpdateData:
      unknown;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "ACCEPTED",

            parties: [
              {
                id:
                  "party-contractor",

                role:
                  "CONTRACTOR",
              },
            ],
          }),

        update:
          async (
            args: {
              data:
                unknown;
            },
          ) => {
            agreementUpdateData =
              args.data;

            return {
              id:
                "agreement-1",
            };
          },
      },

      milestone: {
        findFirst:
          async () => ({
            id:
              "milestone-1",

            status:
              "PENDING",
          }),

        update:
          async (
            args: {
              data:
                unknown;
            },
          ) => {
            milestoneUpdateData =
              args.data;

            return {
              id:
                "milestone-1",
            };
          },
      },

      evidence: {
        create:
          async (
            args: {
              data:
                unknown;
            },
          ) => {
            evidenceData =
              args.data;

            return {
              id:
                "evidence-1",

              milestoneId:
                "milestone-1",

              uri:
                "ipfs://evidence-1",

              hash:
                "0xevidence",
            };
          },
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .submitEvidence({
          actor:
            CONTRACTOR_ACTOR,

          agreementId:
            "agreement-1",

          milestoneId:
            "milestone-1",

          uri:
            "ipfs://evidence-1",

          hash:
            "0xevidence",

          description:
            "Completed delivery",
        });

    assert.deepEqual(
      result,
      {
        id:
          "evidence-1",

        milestoneId:
          "milestone-1",

        uri:
          "ipfs://evidence-1",

        hash:
          "0xevidence",
      },
    );

    assert.deepEqual(
      evidenceData,
      {
        milestoneId:
          "milestone-1",

        submittedByPartyId:
          "party-contractor",

        uri:
          "ipfs://evidence-1",

        hash:
          "0xevidence",

        description:
          "Completed delivery",
      },
    );

    assert.deepEqual(
      milestoneUpdateData,
      {
        status:
          "SUBMITTED",
      },
    );

    assert.deepEqual(
      agreementUpdateData,
      {
        status:
          "IN_PROGRESS",
      },
    );
  },
);
/* =========================================================
   MILESTONE REVIEW
   ========================================================= */

test(
  "CLIENT requests revision for SUBMITTED milestone",
  async () => {
    let updateArgs:
      unknown;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "IN_PROGRESS",

            parties: [
              {
                role:
                  "CLIENT",
              },
            ],
          }),
      },

      milestone: {
        findFirst:
          async () => ({
            id:
              "milestone-1",

            agreementId:
              "agreement-1",

            position:
              1,

            status:
              "SUBMITTED",
          }),

        updateMany:
          async (
            args: unknown,
          ) => {
            updateArgs =
              args;

            return {
              count:
                1,
            };
          },
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .requestMilestoneRevision({
          actor:
            CLIENT_ACTOR,

          agreementId:
            "agreement-1",

          milestoneId:
            "milestone-1",
        });

    assert.deepEqual(
      result,
      {
        id:
          "milestone-1",

        agreementId:
          "agreement-1",

        position:
          1,

        status:
          "REVISION_REQUESTED",
      },
    );

    assert.deepEqual(
      updateArgs,
      {
        where: {
          id:
            "milestone-1",

          agreementId:
            "agreement-1",

          status:
            "SUBMITTED",
        },

        data: {
          status:
            "REVISION_REQUESTED",
        },
      },
    );
  },
);

test(
  "CLIENT approves SUBMITTED milestone",
  async () => {
    let updateArgs:
      unknown;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "IN_PROGRESS",

            parties: [
              {
                role:
                  "CLIENT",
              },
            ],
          }),
      },

      milestone: {
        findFirst:
          async () => ({
            id:
              "milestone-1",

            agreementId:
              "agreement-1",

            position:
              1,

            status:
              "SUBMITTED",
          }),

        updateMany:
          async (
            args: unknown,
          ) => {
            updateArgs =
              args;

            return {
              count:
                1,
            };
          },
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .approveMilestone({
          actor:
            CLIENT_ACTOR,

          agreementId:
            "agreement-1",

          milestoneId:
            "milestone-1",
        });

    assert.deepEqual(
      result,
      {
        id:
          "milestone-1",

        agreementId:
          "agreement-1",

        position:
          1,

        status:
          "APPROVED",
      },
    );

    assert.deepEqual(
      updateArgs,
      {
        where: {
          id:
            "milestone-1",

          agreementId:
            "agreement-1",

          status:
            "SUBMITTED",
        },

        data: {
          status:
            "APPROVED",
        },
      },
    );
  },
);

test(
  "CONTRACTOR resubmits REVISION_REQUESTED milestone to SUBMITTED",
  async () => {
    let evidenceData:
      unknown;

    let milestoneUpdateArgs:
      unknown;

    let agreementUpdateCalled =
      false;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "IN_PROGRESS",

            parties: [
              {
                id:
                  "party-contractor",

                role:
                  "CONTRACTOR",
              },
            ],
          }),

        update:
          async () => {
            agreementUpdateCalled =
              true;

            return {};
          },
      },

      milestone: {
        findFirst:
          async () => ({
            id:
              "milestone-1",

            status:
              "REVISION_REQUESTED",
          }),

        update:
          async (
            args: unknown,
          ) => {
            milestoneUpdateArgs =
              args;

            return {};
          },
      },

      evidence: {
        create:
          async (
            args: {
              data:
                unknown;
            },
          ) => {
            evidenceData =
              args.data;

            return {
              id:
                "evidence-2",

              milestoneId:
                "milestone-1",

              uri:
                "ipfs://evidence-2",

              hash:
                "0xevidence2",
            };
          },
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    const result =
      await operations
        .submitEvidence({
          actor:
            CONTRACTOR_ACTOR,

          agreementId:
            "agreement-1",

          milestoneId:
            "milestone-1",

          uri:
            "ipfs://evidence-2",

          hash:
            "0xevidence2",

          description:
            "Revised delivery",
        });

    assert.deepEqual(
      result,
      {
        id:
          "evidence-2",

        milestoneId:
          "milestone-1",

        uri:
          "ipfs://evidence-2",

        hash:
          "0xevidence2",
      },
    );

    assert.deepEqual(
      evidenceData,
      {
        milestoneId:
          "milestone-1",

        submittedByPartyId:
          "party-contractor",

        uri:
          "ipfs://evidence-2",

        hash:
          "0xevidence2",

        description:
          "Revised delivery",
      },
    );

    assert.deepEqual(
      milestoneUpdateArgs,
      {
        where: {
          id:
            "milestone-1",
        },

        data: {
          status:
            "SUBMITTED",
        },
      },
    );

    assert.equal(
      agreementUpdateCalled,
      false,
      "IN_PROGRESS agreement must remain IN_PROGRESS on resubmission",
    );
  },
);

test(
  "CONTRACTOR cannot review a SUBMITTED milestone",
  async () => {
    let milestoneQueried =
      false;

    const transaction = {
      agreement: {
        findUnique:
          async () => ({
            id:
              "agreement-1",

            status:
              "IN_PROGRESS",

            parties: [
              {
                role:
                  "CONTRACTOR",
              },
            ],
          }),
      },

      milestone: {
        findFirst:
          async () => {
            milestoneQueried =
              true;

            return null;
          },
      },
    };

    const prisma =
      asPrismaClient({
        $transaction:
          async (
            work: (
              tx:
                typeof transaction,
            ) => Promise<unknown>,
          ) =>
            work(
              transaction,
            ),
      });

    const operations =
      createPrismaAgreementOperations(
        prisma,
      );

    await assert.rejects(
      operations
        .approveMilestone({
          actor:
            CONTRACTOR_ACTOR,

          agreementId:
            "agreement-1",

          milestoneId:
            "milestone-1",
        }),
      AgreementAccessError,
    );

    assert.equal(
      milestoneQueried,
      false,
      "milestone lookup must not occur before CLIENT authorization",
    );
  },
);