import assert from "node:assert/strict";
import test from "node:test";

import {
  Interface,
} from "ethers";

import type {
  PreparedWalletTransaction,
  SettlementPreparationResult,
} from "@pai/settlement-contract";

import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  type ArcProvider,
} from "../src/arc-settlement/runtime.js";

import {
  ARC_SETTLEMENT_ADAPTER_IDENTITY,
  ArcSettlementAdapterError,
  createArcSettlementAdapter,
} from "../src/arc-settlement/adapter.js";

const ESCROW_ADDRESS =
  "0x1111111111111111111111111111111111111111";

const TRANSACTION_HASH =
  `0x${"ab".repeat(32)}`;

const TARGET = {
  paiAgreementId:
    "pai-agreement-1",

  contractAddress:
    ESCROW_ADDRESS,

  externalAgreementId:
    "42",
} as const;

const MILESTONE_TARGET = {
  ...TARGET,

  paiMilestoneId:
    "pai-milestone-1",

  externalMilestoneId:
    "7",
} as const;

const ESCROW_INTERFACE =
  new Interface([
    "function resolveMilestoneDispute(uint256 agreementId,uint256 milestoneId,bool releaseToContractor)",
  ]);

type ArcReceipt =
  Awaited<
    ReturnType<
      ArcProvider[
        "getTransactionReceipt"
      ]
    >
  >;

function createReceipt(
  status:
    number,
): NonNullable<ArcReceipt> {
  return {
    hash:
      TRANSACTION_HASH,

    blockNumber:
      777_888,

    status,
  } as unknown as NonNullable<ArcReceipt>;
}

function createProvider(
  receipt:
    ArcReceipt,
): ArcProvider {
  return {
    getNetwork:
      async () =>
        ({
          chainId:
            ARC_TESTNET_CHAIN_ID,
        }) as Awaited<
          ReturnType<
            ArcProvider[
              "getNetwork"
            ]
          >
        >,

    getBlockNumber:
      async () =>
        0,

    getCode:
      async () =>
        "0x",

    call:
      async () =>
        "0x",

    getTransactionReceipt:
      async () =>
        receipt,
  };
}

function requireTransaction(
  result:
    SettlementPreparationResult,
  index =
    0,
): PreparedWalletTransaction {
  const transaction =
    result.transactions[
      index
    ];

  assert.ok(
    transaction,
  );

  return transaction;
}

test(
  "exposes canonical Arc adapter identity",
  () => {
    assert.deepEqual(
      ARC_SETTLEMENT_ADAPTER_IDENTITY,
      {
        provider:
          "arc",

        chainId:
          5_042_002,

        agreementBindingMode:
          "external_required",
      },
    );
  },
);

test(
  "prepares ordered USDC approval and agreement funding transactions",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          null,
        ),
      );

    const result =
      await adapter
        .prepareFunding({
          target:
            TARGET,

          amount:
            "100000000",

          asset: {
            assetId:
              ARC_TESTNET_USDC_ADDRESS,

            symbol:
              "USDC",

            decimals:
              6,
          },
        });

    assert.equal(
      result.action,
      "fund",
    );

    assert.equal(
      result.transactions.length,
      2,
    );

    const approval =
      requireTransaction(
        result,
        0,
      );

    const funding =
      requireTransaction(
        result,
        1,
      );

    assert.equal(
      approval.purpose,
      "asset_approval",
    );

    assert.equal(
      funding.purpose,
      "agreement_funding",
    );

    assert.equal(
      approval.value,
      "0",
    );

    assert.equal(
      funding.value,
      "0",
    );
  },
);

test(
  "rejects non-Arc-USDC funding assets",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          null,
        ),
      );

    await assert.rejects(
      adapter.prepareFunding({
        target:
          TARGET,

        amount:
          "1000000",

        asset: {
          assetId:
            "0x2222222222222222222222222222222222222222",
        },
      }),

      ArcSettlementAdapterError,
    );
  },
);

test(
  "prepares canonical milestone release",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          null,
        ),
      );

    const result =
      await adapter
        .prepareMilestoneRelease({
          target:
            MILESTONE_TARGET,
        });

    assert.equal(
      result.action,
      "release_milestone",
    );

    assert.equal(
      requireTransaction(
        result,
      ).purpose,
      "milestone_release",
    );
  },
);

test(
  "prepares canonical milestone dispute opening",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          null,
        ),
      );

    const result =
      await adapter
        .prepareMilestoneDispute({
          target:
            MILESTONE_TARGET,
        });

    assert.equal(
      result.action,
      "open_milestone_dispute",
    );

    assert.equal(
      requireTransaction(
        result,
      ).purpose,
      "milestone_dispute_open",
    );
  },
);

test(
  "maps release-to-contractor arbitration decision to true",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          null,
        ),
      );

    const result =
      await adapter
        .prepareMilestoneDisputeResolution({
          target:
            MILESTONE_TARGET,

          resolution:
            "release_to_contractor",
        });

    const transaction =
      requireTransaction(
        result,
      );

    const decoded =
      ESCROW_INTERFACE
        .decodeFunctionData(
          "resolveMilestoneDispute",
          transaction.data,
        );

    assert.equal(
      decoded[2],
      true,
    );
  },
);

test(
  "maps refund-to-client arbitration decision to false",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          null,
        ),
      );

    const result =
      await adapter
        .prepareMilestoneDisputeResolution({
          target:
            MILESTONE_TARGET,

          resolution:
            "refund_to_client",
        });

    const transaction =
      requireTransaction(
        result,
      );

    const decoded =
      ESCROW_INTERFACE
        .decodeFunctionData(
          "resolveMilestoneDispute",
          transaction.data,
        );

    assert.equal(
      decoded[2],
      false,
    );
  },
);

test(
  "normalizes a missing receipt as pending",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          null,
        ),
      );

    const result =
      await adapter
        .verifyTransaction({
          action:
            "fund",

          purpose:
            "agreement_funding",

          provider:
            "arc",

          chainId:
            5_042_002,

          paiAgreementId:
            TARGET.paiAgreementId,

          contractAddress:
            TARGET.contractAddress,

          externalAgreementId:
            TARGET.externalAgreementId,

          transactionHash:
            TRANSACTION_HASH,
        });

    assert.equal(
      result.status,
      "pending",
    );

    assert.equal(
      result.purpose,
      "agreement_funding",
    );
  },
);

test(
  "normalizes a successful receipt as confirmed",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          createReceipt(
            1,
          ),
        ),
      );

    const result =
      await adapter
        .verifyTransaction({
          action:
            "release_milestone",

          purpose:
            "milestone_release",

          provider:
            "arc",

          chainId:
            5_042_002,

          paiAgreementId:
            TARGET.paiAgreementId,

          contractAddress:
            TARGET.contractAddress,

          externalAgreementId:
            TARGET.externalAgreementId,

          paiMilestoneId:
            MILESTONE_TARGET.paiMilestoneId,

          externalMilestoneId:
            MILESTONE_TARGET.externalMilestoneId,

          transactionHash:
            TRANSACTION_HASH,
        });

    assert.equal(
      result.status,
      "confirmed",
    );

    if (
      result.status ===
      "confirmed"
    ) {
      assert.equal(
        result.blockNumber,
        "777888",
      );
    }
  },
);

test(
  "normalizes a reverted receipt as failed",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          createReceipt(
            0,
          ),
        ),
      );

    const result =
      await adapter
        .verifyTransaction({
          action:
            "resolve_milestone_dispute",

          purpose:
            "milestone_dispute_resolution",

          provider:
            "arc",

          chainId:
            5_042_002,

          paiAgreementId:
            TARGET.paiAgreementId,

          contractAddress:
            TARGET.contractAddress,

          externalAgreementId:
            TARGET.externalAgreementId,

          paiMilestoneId:
            MILESTONE_TARGET.paiMilestoneId,

          externalMilestoneId:
            MILESTONE_TARGET.externalMilestoneId,

          transactionHash:
            TRANSACTION_HASH,
        });

    assert.equal(
      result.status,
      "failed",
    );

    if (
      result.status ===
      "failed"
    ) {
      assert.match(
        result.failureReason,
        /reverted/i,
      );
    }
  },
);

test(
  "does not confuse asset approval with milestone or funding purposes",
  async () => {
    const adapter =
      createArcSettlementAdapter(
        createProvider(
          null,
        ),
      );

    await assert.rejects(
      adapter.verifyTransaction({
        action:
          "fund",

        purpose:
          "milestone_release",

        provider:
          "arc",

        chainId:
          5_042_002,

        paiAgreementId:
          TARGET.paiAgreementId,

        contractAddress:
          TARGET.contractAddress,

        externalAgreementId:
          TARGET.externalAgreementId,

        transactionHash:
          TRANSACTION_HASH,
      }),

      ArcSettlementAdapterError,
    );
  },
);
