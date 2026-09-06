export type SettlementStatus =
  | "pending"
  | "confirmed"
  | "failed";

export type SettlementAction =
  | "fund"
  | "release_milestone"
  | "open_milestone_dispute"
  | "resolve_milestone_dispute";

export type SettlementTransactionPurpose =
  | "asset_approval"
  | "agreement_funding"
  | "milestone_release"
  | "milestone_dispute_open"
  | "milestone_dispute_resolution";

export type SettlementAgreementBindingMode =
  | "external_required"
  | "adapter_created";

export type SettlementDisputeResolution =
  | "release_to_contractor"
  | "refund_to_client";

export interface SettlementAdapterIdentity {
  readonly provider:
    string;

  readonly chainId:
    number;

  readonly agreementBindingMode:
    SettlementAgreementBindingMode;
}

export interface AgreementSettlementTarget {
  readonly paiAgreementId:
    string;

  readonly contractAddress:
    string;

  readonly externalAgreementId:
    string;
}

export interface MilestoneSettlementTarget
  extends AgreementSettlementTarget {
  readonly paiMilestoneId:
    string;

  readonly externalMilestoneId:
    string;
}

export interface SettlementAsset {
  readonly assetId:
    string;

  readonly symbol?:
    string;

  readonly decimals?:
    number;
}

export interface PreparedEvmTransaction {
  readonly kind:
    "evm";

  readonly purpose:
    SettlementTransactionPurpose;

  readonly chainId:
    number;

  readonly to:
    string;

  readonly data:
    string;

  /**
   * Native value in the chain's smallest unit.
   * ERC20 calls normally use "0".
   */
  readonly value:
    string;
}

export type PreparedWalletTransaction =
  PreparedEvmTransaction;

export interface SettlementPreparationResult {
  readonly action:
    SettlementAction;

  readonly provider:
    string;

  readonly chainId:
    number;

  readonly paiAgreementId:
    string;

  readonly contractAddress:
    string;

  readonly externalAgreementId:
    string;

  readonly paiMilestoneId?:
    string;

  readonly externalMilestoneId?:
    string;

  /**
   * Execute in array order.
   * Each transaction has a purpose so an asset approval
   * cannot be confused with completion of agreement funding.
   */
  readonly transactions:
    readonly PreparedWalletTransaction[];
}

export interface PrepareFundingRequest {
  readonly target:
    AgreementSettlementTarget;

  /**
   * Amount in the settlement asset's smallest unit.
   */
  readonly amount:
    string;

  readonly asset:
    SettlementAsset;
}

export interface PrepareMilestoneReleaseRequest {
  readonly target:
    MilestoneSettlementTarget;
}

export interface PrepareMilestoneDisputeRequest {
  readonly target:
    MilestoneSettlementTarget;
}

export interface PrepareMilestoneDisputeResolutionRequest {
  readonly target:
    MilestoneSettlementTarget;

  /**
   * This represents the arbitrator's already-made decision.
   * The adapter does not make the arbitration decision.
   */
  readonly resolution:
    SettlementDisputeResolution;
}

export interface VerifySettlementTransactionRequest {
  readonly action:
    SettlementAction;

  readonly purpose:
    SettlementTransactionPurpose;

  readonly provider:
    string;

  readonly chainId:
    number;

  readonly paiAgreementId:
    string;

  readonly contractAddress:
    string;

  readonly externalAgreementId:
    string;

  readonly paiMilestoneId?:
    string;

  readonly externalMilestoneId?:
    string;

  readonly transactionHash:
    string;
}

interface SettlementResultBase {
  readonly action:
    SettlementAction;

  readonly purpose:
    SettlementTransactionPurpose;

  readonly provider:
    string;

  readonly chainId:
    number;

  readonly paiAgreementId:
    string;

  readonly contractAddress:
    string;

  readonly externalAgreementId:
    string;

  readonly paiMilestoneId?:
    string;

  readonly externalMilestoneId?:
    string;

  readonly transactionHash:
    string;
}

export interface PendingSettlementResult
  extends SettlementResultBase {
  readonly status:
    "pending";
}

export interface ConfirmedSettlementResult
  extends SettlementResultBase {
  readonly status:
    "confirmed";

  readonly blockNumber?:
    string;
}

export interface FailedSettlementResult
  extends SettlementResultBase {
  readonly status:
    "failed";

  readonly failureReason:
    string;
}

export type SettlementResult =
  | PendingSettlementResult
  | ConfirmedSettlementResult
  | FailedSettlementResult;

export interface SettlementAdapter {
  readonly identity:
    SettlementAdapterIdentity;

  prepareFunding(
    input:
      PrepareFundingRequest,
  ):
    Promise<SettlementPreparationResult>;

  prepareMilestoneRelease(
    input:
      PrepareMilestoneReleaseRequest,
  ):
    Promise<SettlementPreparationResult>;

  prepareMilestoneDispute(
    input:
      PrepareMilestoneDisputeRequest,
  ):
    Promise<SettlementPreparationResult>;

  prepareMilestoneDisputeResolution(
    input:
      PrepareMilestoneDisputeResolutionRequest,
  ):
    Promise<SettlementPreparationResult>;

  verifyTransaction(
    input:
      VerifySettlementTransactionRequest,
  ):
    Promise<SettlementResult>;
}
