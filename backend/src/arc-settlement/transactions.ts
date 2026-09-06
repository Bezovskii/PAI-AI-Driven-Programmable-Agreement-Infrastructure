import {
  Interface,
  getAddress,
} from "ethers";

import {
  ARC_TESTNET_USDC_ADDRESS,
} from "./runtime.js";

const ERC20_INTERFACE =
  new Interface([
    "function approve(address spender,uint256 amount) returns (bool)",
  ]);

const AGREEMENT_ESCROW_INTERFACE =
  new Interface([
    "function fundAgreementERC20(uint256 agreementId)",
    "function approveMilestone(uint256 agreementId,uint256 milestoneId)",
    "function openMilestoneDispute(uint256 agreementId,uint256 milestoneId)",
    "function resolveMilestoneDispute(uint256 agreementId,uint256 milestoneId,bool releaseToContractor)",
  ]);

export interface ArcPreparedTransaction {
  readonly to:
    string;

  readonly data:
    string;

  readonly value:
    0n;
}

export class ArcTransactionPreparationError
  extends Error {
  constructor(
    message:
      string,
  ) {
    super(
      message,
    );

    this.name =
      "ArcTransactionPreparationError";
  }
}

function normalizeAddress(
  value:
    string,
  field:
    string,
): string {
  try {
    return getAddress(
      value,
    );
  } catch {
    throw new ArcTransactionPreparationError(
      `${field} must be a valid EVM address.`,
    );
  }
}

function requirePositiveId(
  value:
    bigint,
  field:
    string,
): bigint {
  if (
    value <=
    0n
  ) {
    throw new ArcTransactionPreparationError(
      `${field} must be greater than zero.`,
    );
  }

  return value;
}

function preparedTransaction(
  to:
    string,
  data:
    string,
): ArcPreparedTransaction {
  return {
    to,
    data,
    value:
      0n,
  };
}

/*
 * CLIENT transaction.
 *
 * Arc USDC must approve the AgreementEscrow contract
 * before fundAgreementERC20 can pull the exact escrow amount.
 */
export function prepareArcUsdcApproval(
  escrowAddress:
    string,
  amount:
    bigint,
): ArcPreparedTransaction {
  if (
    amount <=
    0n
  ) {
    throw new ArcTransactionPreparationError(
      "USDC approval amount must be greater than zero.",
    );
  }

  const escrow =
    normalizeAddress(
      escrowAddress,
      "escrowAddress",
    );

  return preparedTransaction(
    ARC_TESTNET_USDC_ADDRESS,

    ERC20_INTERFACE
      .encodeFunctionData(
        "approve",
        [
          escrow,
          amount,
        ],
      ),
  );
}

/*
 * CLIENT transaction.
 *
 * The AgreementEscrow contract determines the amount from
 * agreement.totalAmount and pulls that exact ERC20 amount.
 */
export function prepareAgreementFunding(
  escrowAddress:
    string,
  agreementId:
    bigint,
): ArcPreparedTransaction {
  const escrow =
    normalizeAddress(
      escrowAddress,
      "escrowAddress",
    );

  const id =
    requirePositiveId(
      agreementId,
      "agreementId",
    );

  return preparedTransaction(
    escrow,

    AGREEMENT_ESCROW_INTERFACE
      .encodeFunctionData(
        "fundAgreementERC20",
        [
          id,
        ],
      ),
  );
}

/*
 * CLIENT transaction.
 *
 * Normal non-disputed milestone release.
 */
export function prepareMilestoneRelease(
  escrowAddress:
    string,
  agreementId:
    bigint,
  milestoneId:
    bigint,
): ArcPreparedTransaction {
  const escrow =
    normalizeAddress(
      escrowAddress,
      "escrowAddress",
    );

  const agreement =
    requirePositiveId(
      agreementId,
      "agreementId",
    );

  const milestone =
    requirePositiveId(
      milestoneId,
      "milestoneId",
    );

  return preparedTransaction(
    escrow,

    AGREEMENT_ESCROW_INTERFACE
      .encodeFunctionData(
        "approveMilestone",
        [
          agreement,
          milestone,
        ],
      ),
  );
}

/*
 * CLIENT or CONTRACTOR transaction.
 *
 * A refund cannot occur until a submitted milestone
 * has entered Disputed state.
 */
export function prepareMilestoneDispute(
  escrowAddress:
    string,
  agreementId:
    bigint,
  milestoneId:
    bigint,
): ArcPreparedTransaction {
  const escrow =
    normalizeAddress(
      escrowAddress,
      "escrowAddress",
    );

  const agreement =
    requirePositiveId(
      agreementId,
      "agreementId",
    );

  const milestone =
    requirePositiveId(
      milestoneId,
      "milestoneId",
    );

  return preparedTransaction(
    escrow,

    AGREEMENT_ESCROW_INTERFACE
      .encodeFunctionData(
        "openMilestoneDispute",
        [
          agreement,
          milestone,
        ],
      ),
  );
}

/*
 * ARBITRATOR transaction.
 *
 * AgreementEscrow has no generic refundMilestone().
 * The truthful refund path is arbitration resolution
 * with releaseToContractor = false.
 */
export function prepareMilestoneRefundResolution(
  escrowAddress:
    string,
  agreementId:
    bigint,
  milestoneId:
    bigint,
): ArcPreparedTransaction {
  const escrow =
    normalizeAddress(
      escrowAddress,
      "escrowAddress",
    );

  const agreement =
    requirePositiveId(
      agreementId,
      "agreementId",
    );

  const milestone =
    requirePositiveId(
      milestoneId,
      "milestoneId",
    );

  return preparedTransaction(
    escrow,

    AGREEMENT_ESCROW_INTERFACE
      .encodeFunctionData(
        "resolveMilestoneDispute",
        [
          agreement,
          milestone,
          false,
        ],
      ),
  );
}
