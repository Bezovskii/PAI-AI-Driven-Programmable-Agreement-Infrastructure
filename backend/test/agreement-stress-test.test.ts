import assert from "node:assert/strict";
import test from "node:test";

import {
  runAgreementStressTestV1,
} from "../src/intelligence/agreement-stress-test.js";

import type {
  AgreementStructuringResult,
} from "../src/intelligence/types.js";

function makeModelResult(
  options?: {
    settlementAsset?: string | null;
    acceptanceCriteria?: string | null;
    totalValue?: string | null;
    deliverable?: string | null;
    deadline?: string | null;
  },
): AgreementStructuringResult {
  return {
    status:
      "ready_for_review",

    agreement: {
      title:
        null,

      description:
        "model-derived agreement",

      totalValue:
        options && "totalValue" in options
          ? options.totalValue ?? null
          : "1000",

      settlementAsset:
        options?.settlementAsset ?? "USD",

      deadline:
        options && "deadline" in options
          ? options.deadline ?? null
          : "2026-09-20",

      approvalWindow:
        null,

      milestones: [
        {
          amount:
            "1000",

          deliverable:
            options && "deliverable" in options
              ? options.deliverable ?? null
              : "build and deliver a responsive landing page",

          acceptanceCriteria:
            options?.acceptanceCriteria ??
            "Amir approves the completed work",

          deadline:
            options && "deadline" in options
              ? options.deadline ?? null
              : "2026-09-20",
        },
      ],
    },

    questions:
      [],

    risks:
      [],

    issues:
      [],

    provenance:
      [],
  };
}

function riskCodes(
  result:
    AgreementStructuringResult,
): string[] {
  return result.risks.map(
    (risk) =>
      risk.code,
  );
}

test(
  "source-grounded stress test rejects neural USD normalization from bare dollar symbol",
  () => {
    const sourceText =
      "Amir hires Behzad to build and deliver a responsive landing page for $1,000. Delivery is due September 20, 2026. Payment should be released after Amir approves the completed work.";

    const result =
      runAgreementStressTestV1({
        sourceText,

        modelResult:
          makeModelResult({
            settlementAsset:
              "USD",

            acceptanceCriteria:
              "Amir approves the completed work",
          }),
      });

    assert.equal(
      result.status,
      "needs_clarification",
    );

    const codes =
      riskCodes(
        result,
      );

    assert.ok(
      codes.includes(
        "AMBIGUOUS_CURRENCY",
      ),
    );

    assert.ok(
      codes.includes(
        "MISSING_SETTLEMENT_ASSET",
      ),
    );

    assert.ok(
      codes.includes(
        "MISSING_ACCEPTANCE_CRITERIA",
      ),
    );

    assert.equal(
      codes.includes(
        "MISSING_SETTLEMENT_NETWORK",
      ),
      false,
    );
  },
);

test(
  "clarified USDC on Arc Testnet with objective criteria passes deterministic V1",
  () => {
    const sourceText =
      "Use USDC on Arc Testnet. The landing page must work on mobile and desktop, all links must work, the deployed URL must be accessible, and all source files must be delivered. Amir has 48 hours after delivery to approve it.";

    const result =
      runAgreementStressTestV1({
        sourceText,

        modelResult:
          makeModelResult({
            settlementAsset:
              "USDC",

            acceptanceCriteria:
              "The landing page must work on mobile and desktop, all links must work, the deployed URL must be accessible, and all source files must be delivered.",
          }),
      });

    assert.equal(
      result.status,
      "ready_for_review",
    );

    assert.deepEqual(
      result.risks,
      [],
    );

    assert.deepEqual(
      result.questions,
      [],
    );
  },
);

test(
  "USDC without an explicit network requires settlement network clarification",
  () => {
    const sourceText =
      "Use USDC for settlement. The deliverable must work on mobile and desktop.";

    const result =
      runAgreementStressTestV1({
        sourceText,

        modelResult:
          makeModelResult({
            settlementAsset:
              "USDC",

            acceptanceCriteria:
              "The deliverable must work on mobile and desktop.",
          }),
      });

    const codes =
      riskCodes(
        result,
      );

    assert.ok(
      codes.includes(
        "MISSING_SETTLEMENT_NETWORK",
      ),
    );

    assert.equal(
      codes.includes(
        "MISSING_SETTLEMENT_ASSET",
      ),
      false,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );
  },
);

test(
  "explicit USD source does not produce ambiguous currency",
  () => {
    const sourceText =
      "Amir will pay Behzad 1000 USD. Payment will use USD. The work must meet the documented requirements.";

    const result =
      runAgreementStressTestV1({
        sourceText,

        modelResult:
          makeModelResult({
            settlementAsset:
              "USD",

            acceptanceCriteria:
              "The work must meet the documented requirements.",
          }),
      });

    const codes =
      riskCodes(
        result,
      );

    assert.equal(
      codes.includes(
        "AMBIGUOUS_CURRENCY",
      ),
      false,
    );
  },
);
test(
  "missing extracted price produces MISSING_PRICE",
  () => {
    const sourceText =
      "Amir hires Behzad to build a landing page by September 20, 2026.";

    const modelResult =
      makeModelResult({
        totalValue:
          null,
      });

    const result =
      runAgreementStressTestV1({
        sourceText,
        modelResult,
      });

    assert.ok(
      riskCodes(
        result,
      ).includes(
        "MISSING_PRICE",
      ),
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );
  },
);

test(
  "missing deliverable produces MISSING_DELIVERABLE",
  () => {
    const sourceText =
      "Amir will pay Behzad 1000 USD by September 20, 2026.";

    const modelResult =
      makeModelResult({
        deliverable:
          null,
      });

    const result =
      runAgreementStressTestV1({
        sourceText,
        modelResult,
      });

    assert.ok(
      riskCodes(
        result,
      ).includes(
        "MISSING_DELIVERABLE",
      ),
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );
  },
);

test(
  "missing agreement and milestone deadline produces MISSING_DEADLINE",
  () => {
    const sourceText =
      "Amir hires Behzad to build a landing page for 1000 USD.";

    const modelResult =
      makeModelResult({
        deadline:
          null,
      });

    const result =
      runAgreementStressTestV1({
        sourceText,
        modelResult,
      });

    assert.ok(
      riskCodes(
        result,
      ).includes(
        "MISSING_DEADLINE",
      ),
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );
  },
);

test(
  "validated agreement with only one party produces MISSING_PARTY",
  () => {
    const sourceText =
      "Build and deliver a landing page for 1000 USD by September 20, 2026.";

    const result =
      runAgreementStressTestV1({
        sourceText,

        modelResult:
          makeModelResult(),

        validatedFacts: {
          partyCount:
            1,
        },
      });

    assert.ok(
      riskCodes(
        result,
      ).includes(
        "MISSING_PARTY",
      ),
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );
  },
);

test(
  "validated agreement with two parties does not produce MISSING_PARTY",
  () => {
    const sourceText =
      "Amir hires Behzad to build a landing page for 1000 USD by September 20, 2026.";

    const result =
      runAgreementStressTestV1({
        sourceText,

        modelResult:
          makeModelResult(),

        validatedFacts: {
          partyCount:
            2,
        },
      });

    assert.equal(
      riskCodes(
        result,
      ).includes(
        "MISSING_PARTY",
      ),
      false,
    );
  },
);

test(
  "acceptance criteria are not required when source does not require acceptance",
  () => {
    const sourceText =
      "Amir hires Behzad to build and deliver a landing page for 1000 USD. Payment will use USD. Delivery is due September 20, 2026.";

    const result =
      runAgreementStressTestV1({
        sourceText,

        modelResult:
          makeModelResult({
            settlementAsset:
              "USD",

            acceptanceCriteria:
              "",
          }),
      });

    const codes =
      riskCodes(
        result,
      );

    assert.equal(
      codes.includes(
        "MISSING_ACCEPTANCE_CRITERIA",
      ),
      false,
    );

    assert.equal(
      result.status,
      "ready_for_review",
    );
  },
);

test(
  "must approve is not objective acceptance criteria",
  () => {
    const sourceText =
      "Amir hires Behzad to build and deliver a landing page for 1000 USD. Payment will use USD. Delivery is due September 20, 2026. Amir must approve the completed work.";

    const result =
      runAgreementStressTestV1({
        sourceText,

        modelResult:
          makeModelResult({
            settlementAsset:
              "USD",

            acceptanceCriteria:
              "Amir must approve the completed work.",
          }),
      });

    const codes =
      riskCodes(
        result,
      );

    assert.ok(
      codes.includes(
        "MISSING_ACCEPTANCE_CRITERIA",
      ),
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );
  },
);

test(
  "model issues remain visible but do not independently block deterministic readiness",
  () => {
    const sourceText =
      "Amir hires Behzad to build and deliver a landing page for 1000 USD. Payment will use USD. Delivery is due September 20, 2026.";

    const modelResult:
      AgreementStructuringResult = {
        ...makeModelResult({
          settlementAsset:
            "USD",
        }),

        status:
          "needs_clarification",

        issues: [
          {
            kind:
              "ambiguity",

            code:
              "MODEL_ONLY_WARNING",

            paths: [
              "/agreement/scope",
            ],

            evidence:
              "landing page",
          },
        ],
      };

    const result =
      runAgreementStressTestV1({
        sourceText,
        modelResult,
      });

    assert.equal(
      result.status,
      "ready_for_review",
    );

    assert.deepEqual(
      result.risks,
      [],
    );

    assert.equal(
      result.issues?.length,
      1,
    );

    assert.equal(
      result.issues?.[0]?.code,
      "MODEL_ONLY_WARNING",
    );
  },
);