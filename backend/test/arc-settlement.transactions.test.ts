import assert from "node:assert/strict";
import test from "node:test";

import {
  Interface,
} from "ethers";

import {
  ARC_TESTNET_USDC_ADDRESS,
} from "../src/arc-settlement/runtime.js";

import {
  ArcTransactionPreparationError,
  prepareAgreementFunding,
  prepareArcUsdcApproval,
  prepareMilestoneDispute,
  prepareMilestoneRefundResolution,
  prepareMilestoneRelease,
} from "../src/arc-settlement/transactions.js";

const ESCROW_ADDRESS =
  "0x1111111111111111111111111111111111111111";

const ERC20_INTERFACE =
  new Interface([
    "function approve(address spender,uint256 amount) returns (bool)",
  ]);

const ESCROW_INTERFACE =
  new Interface([
    "function fundAgreementERC20(uint256 agreementId)",
    "function approveMilestone(uint256 agreementId,uint256 milestoneId)",
    "function openMilestoneDispute(uint256 agreementId,uint256 milestoneId)",
    "function resolveMilestoneDispute(uint256 agreementId,uint256 milestoneId,bool releaseToContractor)",
  ]);

test(
  "prepares Arc USDC approval for the escrow contract",
  () => {
    const transaction =
      prepareArcUsdcApproval(
        ESCROW_ADDRESS,
        100_000_000n,
      );

    assert.equal(
      transaction.to,
      ARC_TESTNET_USDC_ADDRESS,
    );

    assert.equal(
      transaction.value,
      0n,
    );

    const decoded =
      ERC20_INTERFACE
        .decodeFunctionData(
          "approve",
          transaction.data,
        );

    assert.equal(
      decoded[0],
      ESCROW_ADDRESS,
    );

    assert.equal(
      decoded[1],
      100_000_000n,
    );
  },
);

test(
  "prepares ERC20 agreement funding",
  () => {
    const transaction =
      prepareAgreementFunding(
        ESCROW_ADDRESS,
        42n,
      );

    const decoded =
      ESCROW_INTERFACE
        .decodeFunctionData(
          "fundAgreementERC20",
          transaction.data,
        );

    assert.equal(
      decoded[0],
      42n,
    );
  },
);

test(
  "prepares normal milestone release",
  () => {
    const transaction =
      prepareMilestoneRelease(
        ESCROW_ADDRESS,
        42n,
        7n,
      );

    const decoded =
      ESCROW_INTERFACE
        .decodeFunctionData(
          "approveMilestone",
          transaction.data,
        );

    assert.equal(
      decoded[0],
      42n,
    );

    assert.equal(
      decoded[1],
      7n,
    );
  },
);

test(
  "prepares milestone dispute before refund resolution",
  () => {
    const transaction =
      prepareMilestoneDispute(
        ESCROW_ADDRESS,
        42n,
        7n,
      );

    const decoded =
      ESCROW_INTERFACE
        .decodeFunctionData(
          "openMilestoneDispute",
          transaction.data,
        );

    assert.equal(
      decoded[0],
      42n,
    );

    assert.equal(
      decoded[1],
      7n,
    );
  },
);

test(
  "prepares arbitrator refund resolution with release flag false",
  () => {
    const transaction =
      prepareMilestoneRefundResolution(
        ESCROW_ADDRESS,
        42n,
        7n,
      );

    const decoded =
      ESCROW_INTERFACE
        .decodeFunctionData(
          "resolveMilestoneDispute",
          transaction.data,
        );

    assert.equal(
      decoded[0],
      42n,
    );

    assert.equal(
      decoded[1],
      7n,
    );

    assert.equal(
      decoded[2],
      false,
    );
  },
);

test(
  "rejects invalid agreement identifiers",
  () => {
    assert.throws(
      () =>
        prepareAgreementFunding(
          ESCROW_ADDRESS,
          0n,
        ),

      ArcTransactionPreparationError,
    );
  },
);

test(
  "rejects invalid escrow addresses",
  () => {
    assert.throws(
      () =>
        prepareMilestoneRelease(
          "not-an-address",
          1n,
          1n,
        ),

      ArcTransactionPreparationError,
    );
  },
);
