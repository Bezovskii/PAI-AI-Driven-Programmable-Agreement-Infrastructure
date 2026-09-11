import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgreementStructuringResult,
} from "@pai/intelligence-contract";

import {
  processAgreementDraftMessage,
} from "../src/conversations/agreementConversation.js";

import {
  createAgreementDraftSessionStore,
} from "../src/conversations/agreementSession.js";

import type {
  PaiClient,
} from "../src/services/paiClient.js";

const readyResult = {
  status:
    "ready_for_review",

  agreement: {
    title:
      "Frontend delivery",

    description:
      "Alex will build the frontend for 1000 USDC.",

    totalValue:
      "1000",

    settlementAsset:
      "USDC",

    deadline:
      "2026-09-30",

    approvalWindow:
      "3 days",

    milestones: [
      {
        amount:
          "1000",

        deliverable:
          "Frontend",

        acceptanceCriteria:
          "Client approves the delivered frontend.",

        deadline:
          "2026-09-30",
      },
    ],
  },

  questions:
    [],

  risks:
    [],
} satisfies AgreementStructuringResult;

test(
  "ready_for_review preserves Intelligence terms for explicit canonical persistence",
  async () => {
    const sessions =
      createAgreementDraftSessionStore();

    sessions.start(
      42,
    );

    const client: PaiClient = {
      async structureAgreement() {
        return readyResult;
      },

      async persistReviewedAgreement() {
        throw new Error(
          "persistReviewedAgreement must not run during Intelligence review.",
        );
      },
    };

    const result =
      await processAgreementDraftMessage({
        userId:
          42,

        message:
          "Alex will build the frontend for 1000 USDC.",

        paiClient:
          client,

        sessions,
      });

    assert.equal(
      result.status,
      "ready_for_review",
    );

    assert.deepEqual(
      result.reviewedTerms,
      readyResult.agreement,
    );

    assert.equal(
      sessions.has(
        42,
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        result.reviewedTerms ?? {},
        "agreementHash",
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        result.reviewedTerms ?? {},
        "agreementVersion",
      ),
      false,
    );
  },
);
