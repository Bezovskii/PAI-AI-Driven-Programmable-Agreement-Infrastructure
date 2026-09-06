import type {
  AgreementSettlementTarget,
  MilestoneSettlementTarget,
  PreparedWalletTransaction,
  PrepareFundingRequest,
  PrepareMilestoneDisputeRequest,
  PrepareMilestoneDisputeResolutionRequest,
  PrepareMilestoneReleaseRequest,
  SettlementAction,
  SettlementAdapter,
  SettlementAdapterIdentity,
  SettlementAsset,
  SettlementPreparationResult,
  SettlementResult,
  SettlementTransactionPurpose,
  VerifySettlementTransactionRequest,
} from "@pai/settlement-contract";

import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  ARC_USDC_DECIMALS,
  ArcTransactionFailedError,
  ArcTransactionNotFoundError,
  createArcProvider,
  type ArcProvider,
  verifyArcTransaction,
} from "./runtime.js";

import {
  type ArcPreparedTransaction,
  prepareAgreementFunding,
  prepareArcUsdcApproval,
  prepareMilestoneDispute,
  prepareMilestoneDisputeResolution,
  prepareMilestoneRelease,
} from "./transactions.js";

const ARC_CHAIN_ID =
  Number(
    ARC_TESTNET_CHAIN_ID,
  );

export const ARC_SETTLEMENT_ADAPTER_IDENTITY:
  SettlementAdapterIdentity = {
    provider:
      "arc",

    chainId:
      ARC_CHAIN_ID,

    agreementBindingMode:
      "external_required",
  };

export class ArcSettlementAdapterError
  extends Error {
  constructor(
    message:
      string,
  ) {
    super(
      message,
    );

    this.name =
      "ArcSettlementAdapterError";
  }
}

function parsePositiveInteger(
  value:
    string,
  field:
    string,
): bigint {
  if (
    !/^\d+$/.test(
      value,
    )
  ) {
    throw new ArcSettlementAdapterError(
      `${field} must be a positive integer string.`,
    );
  }

  const parsed =
    BigInt(
      value,
    );

  if (
    parsed <=
    0n
  ) {
    throw new ArcSettlementAdapterError(
      `${field} must be greater than zero.`,
    );
  }

  return parsed;
}

function requireArcUsdc(
  asset:
    SettlementAsset,
): void {
  if (
    asset.assetId.toLowerCase() !==
    ARC_TESTNET_USDC_ADDRESS.toLowerCase()
  ) {
    throw new ArcSettlementAdapterError(
      `Arc settlement currently requires USDC at ${ARC_TESTNET_USDC_ADDRESS}.`,
    );
  }

  if (
    asset.symbol !==
      undefined &&
    asset.symbol.toUpperCase() !==
      "USDC"
  ) {
    throw new ArcSettlementAdapterError(
      "Arc settlement asset symbol must be USDC.",
    );
  }

  if (
    asset.decimals !==
      undefined &&
    asset.decimals !==
      ARC_USDC_DECIMALS
  ) {
    throw new ArcSettlementAdapterError(
      `Arc USDC must use ${ARC_USDC_DECIMALS} decimals.`,
    );
  }
}

function toWalletTransaction(
  purpose:
    SettlementTransactionPurpose,
  transaction:
    ArcPreparedTransaction,
): PreparedWalletTransaction {
  return {
    kind:
      "evm",

    purpose,

    chainId:
      ARC_CHAIN_ID,

    to:
      transaction.to,

    data:
      transaction.data,

    value:
      transaction.value.toString(),
  };
}

function agreementPreparationResult(
  action:
    SettlementAction,
  target:
    AgreementSettlementTarget,
  transactions:
    readonly PreparedWalletTransaction[],
): SettlementPreparationResult {
  return {
    action,

    provider:
      ARC_SETTLEMENT_ADAPTER_IDENTITY.provider,

    chainId:
      ARC_CHAIN_ID,

    paiAgreementId:
      target.paiAgreementId,

    contractAddress:
      target.contractAddress,

    externalAgreementId:
      target.externalAgreementId,

    transactions,
  };
}

function milestonePreparationResult(
  action:
    SettlementAction,
  target:
    MilestoneSettlementTarget,
  transactions:
    readonly PreparedWalletTransaction[],
): SettlementPreparationResult {
  return {
    action,

    provider:
      ARC_SETTLEMENT_ADAPTER_IDENTITY.provider,

    chainId:
      ARC_CHAIN_ID,

    paiAgreementId:
      target.paiAgreementId,

    contractAddress:
      target.contractAddress,

    externalAgreementId:
      target.externalAgreementId,

    paiMilestoneId:
      target.paiMilestoneId,

    externalMilestoneId:
      target.externalMilestoneId,

    transactions,
  };
}

function requireVerificationMetadata(
  input:
    VerifySettlementTransactionRequest,
): void {
  if (
    input.provider !==
    ARC_SETTLEMENT_ADAPTER_IDENTITY.provider
  ) {
    throw new ArcSettlementAdapterError(
      `Expected settlement provider arc, received ${input.provider}.`,
    );
  }

  if (
    input.chainId !==
    ARC_CHAIN_ID
  ) {
    throw new ArcSettlementAdapterError(
      `Expected Arc chain ID ${ARC_CHAIN_ID}, received ${input.chainId}.`,
    );
  }

  let expectedPurpose:
    SettlementTransactionPurpose |
    readonly SettlementTransactionPurpose[];

  switch (
    input.action
  ) {
    case "fund":
      expectedPurpose = [
        "asset_approval",
        "agreement_funding",
      ];
      break;

    case "release_milestone":
      expectedPurpose =
        "milestone_release";
      break;

    case "open_milestone_dispute":
      expectedPurpose =
        "milestone_dispute_open";
      break;

    case "resolve_milestone_dispute":
      expectedPurpose =
        "milestone_dispute_resolution";
      break;
  }

  const validPurpose =
    Array.isArray(
      expectedPurpose,
    )
      ? expectedPurpose.includes(
          input.purpose,
        )
      : input.purpose ===
        expectedPurpose;

  if (
    !validPurpose
  ) {
    throw new ArcSettlementAdapterError(
      `Transaction purpose ${input.purpose} does not match settlement action ${input.action}.`,
    );
  }

  if (
    input.action !==
      "fund" &&
    (
      input.paiMilestoneId ===
        undefined ||
      input.externalMilestoneId ===
        undefined
    )
  ) {
    throw new ArcSettlementAdapterError(
      "Milestone settlement verification requires both PAI and external milestone IDs.",
    );
  }
}

function verificationBase(
  input:
    VerifySettlementTransactionRequest,
) {
  return {
    action:
      input.action,

    purpose:
      input.purpose,

    provider:
      input.provider,

    chainId:
      input.chainId,

    paiAgreementId:
      input.paiAgreementId,

    contractAddress:
      input.contractAddress,

    externalAgreementId:
      input.externalAgreementId,

    ...(
      input.paiMilestoneId ===
        undefined
        ? {}
        : {
            paiMilestoneId:
              input.paiMilestoneId,
          }
    ),

    ...(
      input.externalMilestoneId ===
        undefined
        ? {}
        : {
            externalMilestoneId:
              input.externalMilestoneId,
          }
    ),

    transactionHash:
      input.transactionHash,
  };
}

export function createArcSettlementAdapter(
  provider:
    ArcProvider =
      createArcProvider(),
): SettlementAdapter {
  return {
    identity:
      ARC_SETTLEMENT_ADAPTER_IDENTITY,

    async prepareFunding(
      input:
        PrepareFundingRequest,
    ): Promise<SettlementPreparationResult> {
      requireArcUsdc(
        input.asset,
      );

      const amount =
        parsePositiveInteger(
          input.amount,
          "amount",
        );

      const agreementId =
        parsePositiveInteger(
          input.target.externalAgreementId,
          "externalAgreementId",
        );

      const approval =
        prepareArcUsdcApproval(
          input.target.contractAddress,
          amount,
        );

      const funding =
        prepareAgreementFunding(
          input.target.contractAddress,
          agreementId,
        );

      return agreementPreparationResult(
        "fund",
        input.target,
        [
          toWalletTransaction(
            "asset_approval",
            approval,
          ),

          toWalletTransaction(
            "agreement_funding",
            funding,
          ),
        ],
      );
    },

    async prepareMilestoneRelease(
      input:
        PrepareMilestoneReleaseRequest,
    ): Promise<SettlementPreparationResult> {
      const agreementId =
        parsePositiveInteger(
          input.target.externalAgreementId,
          "externalAgreementId",
        );

      const milestoneId =
        parsePositiveInteger(
          input.target.externalMilestoneId,
          "externalMilestoneId",
        );

      const transaction =
        prepareMilestoneRelease(
          input.target.contractAddress,
          agreementId,
          milestoneId,
        );

      return milestonePreparationResult(
        "release_milestone",
        input.target,
        [
          toWalletTransaction(
            "milestone_release",
            transaction,
          ),
        ],
      );
    },

    async prepareMilestoneDispute(
      input:
        PrepareMilestoneDisputeRequest,
    ): Promise<SettlementPreparationResult> {
      const agreementId =
        parsePositiveInteger(
          input.target.externalAgreementId,
          "externalAgreementId",
        );

      const milestoneId =
        parsePositiveInteger(
          input.target.externalMilestoneId,
          "externalMilestoneId",
        );

      const transaction =
        prepareMilestoneDispute(
          input.target.contractAddress,
          agreementId,
          milestoneId,
        );

      return milestonePreparationResult(
        "open_milestone_dispute",
        input.target,
        [
          toWalletTransaction(
            "milestone_dispute_open",
            transaction,
          ),
        ],
      );
    },

    async prepareMilestoneDisputeResolution(
      input:
        PrepareMilestoneDisputeResolutionRequest,
    ): Promise<SettlementPreparationResult> {
      const agreementId =
        parsePositiveInteger(
          input.target.externalAgreementId,
          "externalAgreementId",
        );

      const milestoneId =
        parsePositiveInteger(
          input.target.externalMilestoneId,
          "externalMilestoneId",
        );

      const releaseToContractor =
        input.resolution ===
        "release_to_contractor";

      const transaction =
        prepareMilestoneDisputeResolution(
          input.target.contractAddress,
          agreementId,
          milestoneId,
          releaseToContractor,
        );

      return milestonePreparationResult(
        "resolve_milestone_dispute",
        input.target,
        [
          toWalletTransaction(
            "milestone_dispute_resolution",
            transaction,
          ),
        ],
      );
    },

    async verifyTransaction(
      input:
        VerifySettlementTransactionRequest,
    ): Promise<SettlementResult> {
      requireVerificationMetadata(
        input,
      );

      const base =
        verificationBase(
          input,
        );

      try {
        const verification =
          await verifyArcTransaction(
            input.transactionHash,
            provider,
          );

        return {
          ...base,

          status:
            "confirmed",

          blockNumber:
            verification.blockNumber.toString(),
        };
      } catch (error) {
        if (
          error instanceof
          ArcTransactionNotFoundError
        ) {
          return {
            ...base,

            status:
              "pending",
          };
        }

        if (
          error instanceof
          ArcTransactionFailedError
        ) {
          return {
            ...base,

            status:
              "failed",

            failureReason:
              error.message,
          };
        }

        throw error;
      }
    },
  };
}
