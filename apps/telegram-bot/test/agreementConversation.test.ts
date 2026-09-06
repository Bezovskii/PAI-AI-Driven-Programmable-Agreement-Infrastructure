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

function createClient(
  result:
    AgreementStructuringResult,
  requests:
    string[],
): PaiClient {
  return {
    async structureAgreement(
      input,
    ) {
      requests.push(
        input.text,
      );

      return result;
    },
  };
}

test(
  "needs_clarification exposes questions, risks, and preserves draft context",
  async () => {
    const sessions =
      createAgreementDraftSessionStore();

    sessions.start(
      42,
    );

    const requests:
      string[] = [];

    const result = {
      status:
        "needs_clarification",

      agreement: {
        title:
          null,

        description:
          "Alex will build a frontend.",

        totalValue:
          null,

        settlementAsset:
          null,

        deadline:
          null,

        approvalWindow:
          null,

        milestones:
          [],
      },

      questions: [
        "What is the payment amount?",
        "What is the deadline?",
      ],

      risks: [
        {
          code:
            "missing_terms",

          severity:
            "high",

          message:
            "Important terms are missing.",
        },
      ],
    } satisfies AgreementStructuringResult;

    const first =
      await processAgreementDraftMessage({
        userId:
          42,

        message:
          "Alex will build a frontend.",

        paiClient:
          createClient(
            result,
            requests,
          ),

        sessions,
      });

    assert.equal(
      first.status,
      "needs_clarification",
    );

    assert.match(
      first.message,
      /What is the payment amount\?/,
    );

    assert.match(
      first.message,
      /HIGH: Important terms are missing\./,
    );

    assert.equal(
      sessions.has(
        42,
      ),
      true,
    );

    const preview =
      sessions.preview(
        42,
        "Payment is 1000 USDC.",
      );

    assert.match(
      preview,
      /Alex will build a frontend\./,
    );

    assert.match(
      preview,
      /Additional clarification 1:/,
    );

    assert.match(
      preview,
      /Payment is 1000 USDC\./,
    );

    assert.equal(
      requests[0],
      "Alex will build a frontend.",
    );
  },
);

test(
  "ready_for_review renders review state and closes the clarification session",
  async () => {
    const sessions =
      createAgreementDraftSessionStore();

    sessions.start(
      77,
    );

    const requests:
      string[] = [];

    const result = {
      status:
        "ready_for_review",

      agreement: {
        title:
          "Frontend delivery",

        description:
          "Alex will build a frontend for 1000 USDC.",

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
              "Client approval",

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

    const output =
      await processAgreementDraftMessage({
        userId:
          77,

        message:
          "Alex will build a frontend for 1000 USDC.",

        paiClient:
          createClient(
            result,
            requests,
          ),

        sessions,
      });

    assert.equal(
      output.status,
      "ready_for_review",
    );

    assert.match(
      output.message,
      /Agreement is ready for review\./,
    );

    assert.match(
      output.message,
      /Title: Frontend delivery/,
    );

    assert.match(
      output.message,
      /Value: 1000 USDC/,
    );

    assert.equal(
      sessions.has(
        77,
      ),
      false,
    );
  },
);

test(
  "failed Intelligence request does not commit the pending user message",
  async () => {
    const sessions =
      createAgreementDraftSessionStore();

    sessions.start(
      91,
    );

    const client:
      PaiClient = {
        async structureAgreement() {
          throw new Error(
            "network unavailable",
          );
        },
      };

    await assert.rejects(
      () =>
        processAgreementDraftMessage({
          userId:
            91,

          message:
            "Initial draft",

          paiClient:
            client,

          sessions,
        }),
      /network unavailable/,
    );

    assert.equal(
      sessions.preview(
        91,
        "Retry draft",
      ),
      "Retry draft",
    );
  },
);