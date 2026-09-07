import {
  Address,
  BigInt,
  Bytes
} from "@graphprotocol/graph-ts";

import {
  AgreementCreated as AgreementCreatedEvent,
  MilestoneAdded as MilestoneAddedEvent,
  AgreementAccepted as AgreementAcceptedEvent,
  AgreementFunded as AgreementFundedEvent,
  MilestoneSubmitted as MilestoneSubmittedEvent,
  MilestoneReleased as MilestoneReleasedEvent,
  MilestoneRefunded as MilestoneRefundedEvent,
  MilestoneDisputeOpened as MilestoneDisputeOpenedEvent,
  MilestoneDisputeResolved as MilestoneDisputeResolvedEvent,
  AgreementCompleted as AgreementCompletedEvent
} from "../generated/AgreementEscrow/AgreementEscrow";

import {
  Agreement,
  Milestone,
  SettlementEvent
} from "../generated/schema";

/*
 * PAI Core remains the semantic source of truth.
 *
 * This mapping indexes AgreementEscrow execution facts only.
 * In particular, AgreementAccepted here means escrow-contract
 * acceptance and MUST NOT be interpreted as canonical PAI acceptance.
 */

function agreementEntityId(
  escrowAddress: Address,
  agreementId: BigInt
): string {
  return escrowAddress.toHexString()
    + "-"
    + agreementId.toString();
}

function milestoneEntityId(
  escrowAddress: Address,
  agreementId: BigInt,
  milestoneId: BigInt
): string {
  return agreementEntityId(
    escrowAddress,
    agreementId
  )
    + "-"
    + milestoneId.toString();
}

function settlementEventEntityId(
  transactionHash: Bytes,
  logIndex: BigInt
): string {
  return transactionHash.toHexString()
    + "-"
    + logIndex.toString();
}

function newSettlementEvent(
  agreementId: BigInt,
  eventName: string,
  escrowAddress: Address,
  transactionHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  blockTimestamp: BigInt
): SettlementEvent {
  let settlementEvent = new SettlementEvent(
    settlementEventEntityId(
      transactionHash,
      logIndex
    )
  );

  settlementEvent.agreement = agreementEntityId(
    escrowAddress,
    agreementId
  );

  settlementEvent.eventName = eventName;

  settlementEvent.transactionHash = transactionHash;
  settlementEvent.logIndex = logIndex;
  settlementEvent.blockNumber = blockNumber;
  settlementEvent.blockTimestamp = blockTimestamp;

  return settlementEvent;
}

export function handleAgreementCreated(
  event: AgreementCreatedEvent
): void {
  let id = agreementEntityId(
    event.address,
    event.params.agreementId
  );

  let agreement = new Agreement(id);

  agreement.agreementId = event.params.agreementId;
  agreement.escrowAddress = event.address;

  agreement.clientAddress = event.params.client;
  agreement.contractorAddress = event.params.contractor;
  agreement.tokenAddress = event.params.token;

  agreement.metadataURI = event.params.metadataURI;

  agreement.executionStatus = "CREATED";
  agreement.totalFunded = BigInt.fromI32(0);

  agreement.createdAt = event.block.timestamp;
  agreement.createdBlock = event.block.number;
  agreement.createdTransaction = event.transaction.hash;

  agreement.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "AgreementCreated",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.actor = event.params.client;
  settlementEvent.token = event.params.token;

  settlementEvent.save();
}

export function handleMilestoneAdded(
  event: MilestoneAddedEvent
): void {
  let agreementId = agreementEntityId(
    event.address,
    event.params.agreementId
  );

  let agreement = Agreement.load(agreementId);

  if (agreement == null) {
    return;
  }

  let id = milestoneEntityId(
    event.address,
    event.params.agreementId,
    event.params.milestoneId
  );

  let milestone = new Milestone(id);

  milestone.agreement = agreement.id;
  milestone.milestoneId = event.params.milestoneId;

  milestone.amount = event.params.amount;
  milestone.metadataURI = event.params.metadataURI;

  milestone.executionStatus = "CREATED";

  milestone.createdAt = event.block.timestamp;
  milestone.createdBlock = event.block.number;
  milestone.createdTransaction = event.transaction.hash;

  milestone.lastUpdatedAt = event.block.timestamp;
  milestone.lastUpdatedBlock = event.block.number;
  milestone.lastUpdatedTransaction = event.transaction.hash;

  milestone.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "MilestoneAdded",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.milestone = milestone.id;
  settlementEvent.amount = event.params.amount;

  settlementEvent.save();
}

export function handleAgreementAccepted(
  event: AgreementAcceptedEvent
): void {
  let id = agreementEntityId(
    event.address,
    event.params.agreementId
  );

  let agreement = Agreement.load(id);

  if (agreement == null) {
    return;
  }

  agreement.executionStatus = "ESCROW_ACCEPTED";
  agreement.escrowAcceptedBy = event.params.contractor;
  agreement.escrowAcceptedAt = event.block.timestamp;

  agreement.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "AgreementAccepted",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.actor = event.params.contractor;

  settlementEvent.save();
}

export function handleAgreementFunded(
  event: AgreementFundedEvent
): void {
  let id = agreementEntityId(
    event.address,
    event.params.agreementId
  );

  let agreement = Agreement.load(id);

  if (agreement == null) {
    return;
  }

  agreement.totalFunded = agreement.totalFunded.plus(
    event.params.amount
  );

  agreement.executionStatus = "FUNDED";

  agreement.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "AgreementFunded",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.actor = event.params.client;
  settlementEvent.token = event.params.token;
  settlementEvent.amount = event.params.amount;

  settlementEvent.save();
}

export function handleMilestoneSubmitted(
  event: MilestoneSubmittedEvent
): void {
  let id = milestoneEntityId(
    event.address,
    event.params.agreementId,
    event.params.milestoneId
  );

  let milestone = Milestone.load(id);

  if (milestone == null) {
    return;
  }

  milestone.executionStatus = "SUBMITTED";

  milestone.evidenceURI = event.params.evidenceURI;
  milestone.evidenceHash = event.params.evidenceHash;

  milestone.lastUpdatedAt = event.block.timestamp;
  milestone.lastUpdatedBlock = event.block.number;
  milestone.lastUpdatedTransaction = event.transaction.hash;

  milestone.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "MilestoneSubmitted",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.milestone = milestone.id;
  settlementEvent.actor = event.params.contractor;
  settlementEvent.evidenceURI = event.params.evidenceURI;
  settlementEvent.evidenceHash = event.params.evidenceHash;

  settlementEvent.save();
}

export function handleMilestoneReleased(
  event: MilestoneReleasedEvent
): void {
  let id = milestoneEntityId(
    event.address,
    event.params.agreementId,
    event.params.milestoneId
  );

  let milestone = Milestone.load(id);

  if (milestone == null) {
    return;
  }

  milestone.executionStatus = "RELEASED";

  milestone.lastUpdatedAt = event.block.timestamp;
  milestone.lastUpdatedBlock = event.block.number;
  milestone.lastUpdatedTransaction = event.transaction.hash;

  milestone.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "MilestoneReleased",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.milestone = milestone.id;
  settlementEvent.actor = event.params.contractor;
  settlementEvent.recipient = event.params.contractor;
  settlementEvent.token = event.params.token;
  settlementEvent.amount = event.params.amount;

  settlementEvent.save();
}

export function handleMilestoneRefunded(
  event: MilestoneRefundedEvent
): void {
  let id = milestoneEntityId(
    event.address,
    event.params.agreementId,
    event.params.milestoneId
  );

  let milestone = Milestone.load(id);

  if (milestone == null) {
    return;
  }

  milestone.executionStatus = "REFUNDED";

  milestone.lastUpdatedAt = event.block.timestamp;
  milestone.lastUpdatedBlock = event.block.number;
  milestone.lastUpdatedTransaction = event.transaction.hash;

  milestone.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "MilestoneRefunded",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.milestone = milestone.id;
  settlementEvent.actor = event.params.client;
  settlementEvent.recipient = event.params.client;
  settlementEvent.token = event.params.token;
  settlementEvent.amount = event.params.amount;

  settlementEvent.save();
}

export function handleMilestoneDisputeOpened(
  event: MilestoneDisputeOpenedEvent
): void {
  let id = milestoneEntityId(
    event.address,
    event.params.agreementId,
    event.params.milestoneId
  );

  let milestone = Milestone.load(id);

  if (milestone == null) {
    return;
  }

  milestone.executionStatus = "DISPUTED";

  milestone.lastUpdatedAt = event.block.timestamp;
  milestone.lastUpdatedBlock = event.block.number;
  milestone.lastUpdatedTransaction = event.transaction.hash;

  milestone.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "MilestoneDisputeOpened",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.milestone = milestone.id;
  settlementEvent.actor = event.params.openedBy;

  settlementEvent.save();
}

export function handleMilestoneDisputeResolved(
  event: MilestoneDisputeResolvedEvent
): void {
  let id = milestoneEntityId(
    event.address,
    event.params.agreementId,
    event.params.milestoneId
  );

  let milestone = Milestone.load(id);

  if (milestone == null) {
    return;
  }

  milestone.executionStatus = event.params.releasedToContractor
    ? "RELEASED"
    : "REFUNDED";

  milestone.lastUpdatedAt = event.block.timestamp;
  milestone.lastUpdatedBlock = event.block.number;
  milestone.lastUpdatedTransaction = event.transaction.hash;

  milestone.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "MilestoneDisputeResolved",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.milestone = milestone.id;
  settlementEvent.actor = event.params.arbitrator;
  settlementEvent.recipient = event.params.recipient;
  settlementEvent.token = event.params.token;
  settlementEvent.amount = event.params.amount;
  settlementEvent.releasedToContractor =
    event.params.releasedToContractor;

  settlementEvent.save();
}

export function handleAgreementCompleted(
  event: AgreementCompletedEvent
): void {
  let id = agreementEntityId(
    event.address,
    event.params.agreementId
  );

  let agreement = Agreement.load(id);

  if (agreement == null) {
    return;
  }

  agreement.executionStatus = "COMPLETED";

  agreement.completedAt = event.block.timestamp;
  agreement.completedBlock = event.block.number;
  agreement.completedTransaction = event.transaction.hash;

  agreement.save();

  let settlementEvent = newSettlementEvent(
    event.params.agreementId,
    "AgreementCompleted",
    event.address,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  settlementEvent.save();
}