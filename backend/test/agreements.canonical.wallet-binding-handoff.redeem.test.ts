import assert from "node:assert/strict";
import {
  createHash,
} from "node:crypto";
import test from "node:test";

import type {
  PrismaClient,
} from "../src/generated/prisma/client.js";

import {
  AgreementAccessError,
  AgreementConflictError,
} from "../src/agreements/routes.js";

import {
  computeCanonicalAgreementHash,
} from "../src/agreements/canonical.js";

import {
  createPrismaAgreementOperations,
} from "../src/agreements/service.js";

const AGREEMENT_ID =
  "agreement-handoff-redeem";

const OTHER_AGREEMENT_ID =
  "agreement-other";

const CLIENT_PARTY_ID =
  "party-client";

const CONTRACTOR_PARTY_ID =
  "party-contractor";

const OTHER_PARTY_ID =
  "party-other";

const CLIENT_WALLET =
  "0x1111111111111111111111111111111111111111";

const CONTRACTOR_WALLET =
  "0x2222222222222222222222222222222222222222";

const ATTACKER_WALLET =
  "0x3333333333333333333333333333333333333333";

const HANDOFF_SECRET =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const CANONICAL_TERMS = {
  title:
    "Canonical redemption agreement",

  description:
    "Test agreement for wallet-binding handoff redemption.",

  totalValue:
    "1000",

  settlementAsset:
    "USDC",

  deadline:
    null,

  approvalWindow:
    null,

  milestones: [
    {
      amount:
        "1000",

      deliverable:
        "Deliver the agreed work.",

      acceptanceCriteria:
        "Client confirms delivery.",

      deadline:
        null,
    },
  ],
};

const AGREEMENT_HASH =
  computeCanonicalAgreementHash(
    CANONICAL_TERMS,
  );

function sha256(
  value:
    string,
): string {
  return createHash("sha256")
    .update(
      value,
      "utf8",
    )
    .digest("hex");
}

function asPrismaClient(
  value:
    unknown,
): PrismaClient {
  return value as PrismaClient;
}

interface FixtureOptions {
  readonly agreementVersion?:
    number;

  readonly agreementHash?:
    string;

  readonly revisionHash?:
    string;

  readonly canonicalTerms?:
    typeof CANONICAL_TERMS;

  readonly acceptedPartyIds?:
    readonly string[];

  readonly clientWalletAddress?:
    string | null;

  readonly contractorWalletAddress?:
    string | null;

  readonly handoffAgreementId?:
    string;

  readonly handoffAgreementVersion?:
    number;

  readonly handoffAgreementHash?:
    string;

  readonly handoffPartyId?:
    string;

  readonly handoffRole?:
    "CLIENT" |
    "CONTRACTOR";

  readonly expiresAt?:
    Date;

  readonly consumedAt?:
    Date | null;

  readonly forceConsumeConflict?:
    boolean;
}

function createFixture(
  options:
    FixtureOptions = {},
) {
  const agreementVersion =
    options.agreementVersion ??
    3;

  const agreementHash =
    options.agreementHash ??
    AGREEMENT_HASH;

  const state = {
    agreement: {
      id:
        AGREEMENT_ID,

      status:
        "ACCEPTED",

      termsVersion:
        agreementVersion,

      termsHash:
        agreementHash,

      parties: [
        {
          id:
            CLIENT_PARTY_ID,

          role:
            "CLIENT",

          displayName:
            "Client",

          walletAddress:
            options.clientWalletAddress ??
            null,

          accessCredentialHash:
            null,
        },

        {
          id:
            CONTRACTOR_PARTY_ID,

          role:
            "CONTRACTOR",

          displayName:
            "Contractor",

          walletAddress:
            options.contractorWalletAddress ??
            null,

          accessCredentialHash:
            null,
        },
      ],
    },

    revision: {
      agreementHash:
        options.revisionHash ??
        agreementHash,

      canonicalTerms:
        options.canonicalTerms ??
        CANONICAL_TERMS,
    },

    acceptedPartyIds:
      Array.from(
        options.acceptedPartyIds ??
        [
          CLIENT_PARTY_ID,
          CONTRACTOR_PARTY_ID,
        ],
      ),

    handoff: {
      id:
        "handoff-row-1",

      secretHash:
        sha256(
          HANDOFF_SECRET,
        ),

      agreementId:
        options.handoffAgreementId ??
        AGREEMENT_ID,

      agreementVersion:
        options.handoffAgreementVersion ??
        agreementVersion,

      agreementHash:
        options.handoffAgreementHash ??
        agreementHash,

      partyId:
        options.handoffPartyId ??
        CLIENT_PARTY_ID,

      role:
        options.handoffRole ??
        "CLIENT",

      expiresAt:
        options.expiresAt ??
        new Date(
          Date.now() +
          5 * 60 * 1000,
        ),

      consumedAt:
        options.consumedAt ??
        null,

      createdAt:
        new Date(),
    },
  };

  const buildTransaction =
    (
      transactionState:
        typeof state,
    ) => ({
      $queryRaw:
        async () => [
          {
            id:
              "locked",
          },
        ],

      agreement: {
        findUnique:
          async () => ({
            ...transactionState
              .agreement,

            parties:
              transactionState
                .agreement
                .parties
                .map(
                  (party) => ({
                    ...party,
                  }),
                ),
          }),

        updateMany:
          async (
            args:
              any,
          ) => {
            const matches =
              args.where.id ===
                transactionState
                  .agreement.id &&
              args.where.termsVersion ===
                transactionState
                  .agreement
                  .termsVersion &&
              args.where.termsHash ===
                transactionState
                  .agreement
                  .termsHash;

            if (!matches) {
              return {
                count:
                  0,
              };
            }

            transactionState
              .agreement
              .status =
                args.data.status;

            return {
              count:
                1,
            };
          },
      },

      agreementRevision: {
        findUnique:
          async (
            args:
              any,
          ) => {
            const reference =
              args.where
                .agreementId_agreementVersion;

            if (
              reference.agreementId !==
                transactionState
                  .agreement.id ||
              reference.agreementVersion !==
                transactionState
                  .agreement
                  .termsVersion
            ) {
              return null;
            }

            return {
              agreementHash:
                transactionState
                  .revision
                  .agreementHash,

              canonicalTerms:
                transactionState
                  .revision
                  .canonicalTerms,
            };
          },
      },

      agreementAcceptance: {
        findMany:
          async () =>
            transactionState
              .acceptedPartyIds
              .map(
                (
                  partyId,
                ) => ({
                  partyId,
                }),
              ),
      },

      agreementParty: {
        updateMany:
          async (
            args:
              any,
          ) => {
            const party =
              transactionState
                .agreement
                .parties
                .find(
                  (candidate) =>
                    candidate.id ===
                    args.where.id,
                );

            if (
              !party ||
              args.where.agreementId !==
                transactionState
                  .agreement.id ||
              party.walletAddress !==
                null
            ) {
              return {
                count:
                  0,
              };
            }

            party.walletAddress =
              args.data.walletAddress;

            return {
              count:
                1,
            };
          },
      },

      walletBindingHandoff: {
        findUnique:
          async (
            args:
              any,
          ) => {
            if (
              args.where.secretHash !==
              undefined
            ) {
              if (
                args.where.secretHash !==
                transactionState
                  .handoff
                  .secretHash
              ) {
                return null;
              }
            }
            else if (
              args.where.id !==
              undefined
            ) {
              if (
                args.where.id !==
                transactionState
                  .handoff.id
              ) {
                return null;
              }
            }
            else {
              return null;
            }

            return {
              ...transactionState
                .handoff,
            };
          },

        updateMany:
          async (
            args:
              any,
          ) => {
            if (
              options
                .forceConsumeConflict
            ) {
              return {
                count:
                  0,
              };
            }

            if (
              args.where.id !==
                transactionState
                  .handoff.id ||
              transactionState
                .handoff
                .consumedAt !==
                null
            ) {
              return {
                count:
                  0,
              };
            }

            transactionState
              .handoff
              .consumedAt =
                args.data.consumedAt;

            return {
              count:
                1,
            };
          },
      },
    });

  const prisma =
    asPrismaClient({
      $transaction:
        async (
          work:
            (
              transaction:
                ReturnType<
                  typeof buildTransaction
                >,
            ) => Promise<any>,
        ) => {
          const transactionState =
            structuredClone(
              state,
            );

          try {
            const result =
              await work(
                buildTransaction(
                  transactionState,
                ),
              );

            state.agreement =
              transactionState
                .agreement;

            state.revision =
              transactionState
                .revision;

            state.acceptedPartyIds =
              transactionState
                .acceptedPartyIds;

            state.handoff =
              transactionState
                .handoff;

            return result;
          }
          catch (error) {
            throw error;
          }
        },
    });

  return {
    state,

    operations:
      createPrismaAgreementOperations(
        prisma,
      ),
  };
}

test(
  "SIWE actor wallet redeems valid CLIENT handoff and consumes it",
  async () => {
    const fixture =
      createFixture();

    const result =
      await fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        });

    assert.equal(
      result.walletAddress,
      CLIENT_WALLET,
    );

    assert.equal(
      result.partyId,
      CLIENT_PARTY_ID,
    );

    assert.equal(
      result.role,
      "CLIENT",
    );

    assert.equal(
      result.lifecycle.status,
      "ACCEPTED",
    );

    assert.equal(
      result.lifecycle
        .walletBindingComplete,
      false,
    );

    assert.equal(
      fixture.state
        .agreement
        .parties[0]
        ?.walletAddress,
      CLIENT_WALLET,
    );

    assert.ok(
      fixture.state
        .handoff
        .consumedAt instanceof Date,
    );
  },
);

test(
  "redeem ignores any caller-supplied walletAddress and uses authenticated actor wallet only",
  async () => {
    const fixture =
      createFixture();

    const request =
      {
        agreementId:
          AGREEMENT_ID,

        partyId:
          CLIENT_PARTY_ID,

        handoffId:
          HANDOFF_SECRET,

        walletAddress:
          ATTACKER_WALLET,

        actor: {
          userId:
            "user-client",

          walletAddress:
            CLIENT_WALLET,
        },
      } as any;

    const result =
      await fixture.operations
        .redeemWalletBindingHandoff(
          request,
        );

    assert.equal(
      result.walletAddress,
      CLIENT_WALLET,
    );

    assert.equal(
      fixture.state
        .agreement
        .parties[0]
        ?.walletAddress,
      CLIENT_WALLET,
    );

    assert.notEqual(
      fixture.state
        .agreement
        .parties[0]
        ?.walletAddress,
      ATTACKER_WALLET,
    );
  },
);

test(
  "second party redemption transitions lifecycle to READY_TO_FUND",
  async () => {
    const fixture =
      createFixture({
        clientWalletAddress:
          CLIENT_WALLET,

        handoffPartyId:
          CONTRACTOR_PARTY_ID,

        handoffRole:
          "CONTRACTOR",
      });

    const result =
      await fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CONTRACTOR_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-contractor",

            walletAddress:
              CONTRACTOR_WALLET,
          },
        });

    assert.equal(
      result.lifecycle.status,
      "READY_TO_FUND",
    );

    assert.equal(
      result.lifecycle
        .walletBindingComplete,
      true,
    );

    assert.equal(
      fixture.state
        .agreement
        .status,
      "READY_TO_FUND",
    );
  },
);

test(
  "consumed handoff cannot be redeemed again",
  async () => {
    const fixture =
      createFixture({
        consumedAt:
          new Date(),
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .agreement
        .parties[0]
        ?.walletAddress,
      null,
    );
  },
);

test(
  "expired handoff is rejected without wallet binding",
  async () => {
    const fixture =
      createFixture({
        expiresAt:
          new Date(
            Date.now() -
            1000,
          ),
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );

    assert.equal(
      fixture.state
        .agreement
        .parties[0]
        ?.walletAddress,
      null,
    );
  },
);

test(
  "wrong opaque handoff secret is rejected",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );
  },
);

test(
  "handoff cannot be redeemed through the wrong agreement route",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            OTHER_AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );
  },
);

test(
  "handoff cannot be redeemed through the wrong party route",
  async () => {
    const fixture =
      createFixture();

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            OTHER_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementAccessError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );
  },
);

test(
  "stale agreement version handoff is rejected even when current version is fully accepted",
  async () => {
    const fixture =
      createFixture({
        agreementVersion:
          4,

        handoffAgreementVersion:
          3,
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );
  },
);

test(
  "stale agreement hash handoff is rejected",
  async () => {
    const staleHash =
      "0x" +
      "aa".repeat(32);

    const fixture =
      createFixture({
        handoffAgreementHash:
          staleHash,
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );
  },
);

test(
  "previous-revision handoff remains invalid after a newer revision is fully accepted",
  async () => {
    const currentTerms = {
      ...CANONICAL_TERMS,

      description:
        "Version four canonical terms.",
    };

    const currentHash =
      computeCanonicalAgreementHash(
        currentTerms,
      );

    const fixture =
      createFixture({
        agreementVersion:
          4,

        agreementHash:
          currentHash,

        revisionHash:
          currentHash,

        canonicalTerms:
          currentTerms,

        handoffAgreementVersion:
          3,

        handoffAgreementHash:
          AGREEMENT_HASH,

        acceptedPartyIds: [
          CLIENT_PARTY_ID,
          CONTRACTOR_PARTY_ID,
        ],
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );
  },
);

test(
  "redemption rechecks both current acceptances",
  async () => {
    const fixture =
      createFixture({
        acceptedPartyIds: [
          CLIENT_PARTY_ID,
        ],
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );
  },
);

test(
  "redemption rechecks current canonical revision contents",
  async () => {
    const fixture =
      createFixture({
        canonicalTerms: {
          ...CANONICAL_TERMS,

          description:
            "Tampered canonical revision.",
        },
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );
  },
);

test(
  "failed canonical wallet bind leaves handoff unconsumed",
  async () => {
    const fixture =
      createFixture({
        contractorWalletAddress:
          CLIENT_WALLET,
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );

    assert.equal(
      fixture.state
        .agreement
        .parties[0]
        ?.walletAddress,
      null,
    );
  },
);

test(
  "consume conflict rolls wallet binding back with the transaction",
  async () => {
    const fixture =
      createFixture({
        forceConsumeConflict:
          true,
      });

    await assert.rejects(
      fixture.operations
        .redeemWalletBindingHandoff({
          agreementId:
            AGREEMENT_ID,

          partyId:
            CLIENT_PARTY_ID,

          handoffId:
            HANDOFF_SECRET,

          actor: {
            userId:
              "user-client",

            walletAddress:
              CLIENT_WALLET,
          },
        }),

      AgreementConflictError,
    );

    assert.equal(
      fixture.state
        .handoff
        .consumedAt,
      null,
    );

    assert.equal(
      fixture.state
        .agreement
        .parties[0]
        ?.walletAddress,
      null,
    );

    assert.equal(
      fixture.state
        .agreement
        .status,
      "ACCEPTED",
    );
  },
);
