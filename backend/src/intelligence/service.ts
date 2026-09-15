import type {
  IntelligenceRuntimeClient,
} from "./runtime-client.js";

import {
  runAgreementStressTestV1,
} from "./agreement-stress-test.js";

import type {
  AgreementModelIssue,
  AgreementProvenance,
  AgreementStructuringResult,
  StructuredAgreementMilestone,
  StructureAgreement,
} from "./types.js";

function isRecord(
  value:
    unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asRecord(
  value:
    unknown,
): Record<string, unknown> | null {
  return (
    isRecord(value)
      ? value
      : null
  );
}

function asString(
  value:
    unknown,
): string | null {
  return (
    typeof value === "string"
      ? value
      : null
  );
}

function asArray(
  value:
    unknown,
): unknown[] {
  return (
    Array.isArray(value)
      ? value
      : []
  );
}

function readIssues(
  modelOutput:
    Record<string, unknown>,
): AgreementModelIssue[] {
  return asArray(
    modelOutput.issues,
  ).map(
    (value) => {
      const issue =
        asRecord(value);

      if (!issue) {
        throw new Error(
          "Validated model issue is malformed.",
        );
      }

      const kind =
        asString(issue.kind);

      const code =
        asString(issue.code);

      const evidence =
        asString(issue.evidence);

      const paths =
        asArray(issue.paths)
          .map(asString);

      if (
        !kind ||
        !code ||
        evidence === null ||
        paths.some(
          (path) =>
            path === null,
        )
      ) {
        throw new Error(
          "Validated model issue is malformed.",
        );
      }

      return {
        kind,
        code,
        paths:
          paths as string[],
        evidence,
      };
    },
  );
}

function readProvenance(
  modelOutput:
    Record<string, unknown>,
): AgreementProvenance[] {
  return asArray(
    modelOutput.provenance,
  ).map(
    (value) => {
      const entry =
        asRecord(value);

      if (!entry) {
        throw new Error(
          "Validated model provenance is malformed.",
        );
      }

      const path =
        asString(entry.path);

      const quote =
        asString(entry.quote);

      if (
        !path ||
        quote === null
      ) {
        throw new Error(
          "Validated model provenance is malformed.",
        );
      }

      return {
        path,
        quote,
      };
    },
  );
}

function findPaymentAmount(
  payments:
    unknown[],
  milestoneId:
    string | null,
): string | null {
  if (!milestoneId) {
    return null;
  }

  for (const value of payments) {
    const payment =
      asRecord(value);

    if (!payment) {
      continue;
    }

    const trigger =
      asRecord(
        payment.trigger,
      );

    if (
      asString(
        trigger?.milestoneId,
      ) !== milestoneId
    ) {
      continue;
    }

    const amount =
      asRecord(
        payment.amount,
      );

    const amountValue =
      asString(
        amount?.amount,
      );

    if (amountValue) {
      return amountValue;
    }
  }

  return null;
}

function readMilestones(
  agreement:
    Record<string, unknown>,
): StructuredAgreementMilestone[] {
  const payments =
    asArray(
      agreement.payments,
    );

  return asArray(
    agreement.milestones,
  ).map(
    (value) => {
      const milestone =
        asRecord(value);

      if (!milestone) {
        throw new Error(
          "Validated model milestone is malformed.",
        );
      }

      const milestoneId =
        asString(
          milestone.id,
        );

      const deliverables =
        asArray(
          milestone.deliverables,
        )
          .map(asString)
          .filter(
            (
              item,
            ): item is string =>
              item !== null,
          );

      const description =
        asString(
          milestone.description,
        );

      const acceptance =
        asRecord(
          milestone.acceptance,
        );

      const criteria =
        asArray(
          acceptance?.criteria,
        )
          .map(asString)
          .filter(
            (
              item,
            ): item is string =>
              item !== null,
          );

      const deadline =
        asRecord(
          milestone.deadline,
        );

      return {
        amount:
          findPaymentAmount(
            payments,
            milestoneId,
          ),

        deliverable:
          deliverables[0] ??
          description,

        acceptanceCriteria:
          criteria.length === 1
            ? (
                criteria[0] ??
                null
              )
            : null,

        deadline:
          asString(
            deadline?.date,
          ),
      };
    },
  );
}

function readSettlementAsset(
  pricing:
    Record<string, unknown> | null,
): string | null {
  if (!pricing) {
    return null;
  }

  const settlementAsset =
    asRecord(
      pricing.settlementAsset,
    );

  const total =
    asRecord(
      pricing.total,
    );

  const currency =
    asRecord(
      total?.currency,
    );

  return (
    asString(
      settlementAsset?.symbol,
    ) ??
    asString(
      settlementAsset?.assetId,
    ) ??
    asString(
      currency?.code,
    ) ??
    asString(
      currency?.symbol,
    )
  );
}

function readDeadline(
  agreement:
    Record<string, unknown>,
): string | null {
  for (
    const value
    of asArray(
      agreement.milestones,
    )
  ) {
    const milestone =
      asRecord(value);

    const deadline =
      asRecord(
        milestone?.deadline,
      );

    const date =
      asString(
        deadline?.date,
      );

    if (date) {
      return date;
    }
  }

  return null;
}

/**
 * Phase 2A contract stub retained for focused tests and explicit
 * fallback-free dependency injection. Production server wiring uses
 * createModelBackedAgreementStructurer().
 */
export function createDeterministicAgreementStructurer():
  StructureAgreement {
  return async (
    input,
  ) => {
    return {
      status:
        "needs_clarification",

      agreement: {
        title:
          null,

        description:
          input.text,

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
        "Please confirm the payment amount, settlement asset, milestones, deadlines, and acceptance criteria.",
      ],

      risks:
        [],
    };
  };
}

export function createModelBackedAgreementStructurer(
  runtime:
    IntelligenceRuntimeClient,
): StructureAgreement {
  return async (
    input,
  ) => {
    const runtimeResult =
      await runtime.structure(
        input.text,
      );

    if (
      !isRecord(
        runtimeResult.modelOutput,
      )
    ) {
      throw new Error(
        "Validated PAI model output is not an object.",
      );
    }

    const modelOutput =
      runtimeResult.modelOutput;

    const agreement =
      asRecord(
        modelOutput.agreement,
      );

    if (!agreement) {
      throw new Error(
        "Validated PAI model output is missing agreement.",
      );
    }

    const pricing =
      asRecord(
        agreement.pricing,
      );

    const total =
      asRecord(
        pricing?.total,
      );

    const scope =
      asRecord(
        agreement.scope,
      );

    const issues =
      readIssues(
        modelOutput,
      );

    const provenance =
      readProvenance(
        modelOutput,
      );

    const modelResult:
      AgreementStructuringResult = {
      status:
        issues.length > 0
          ? "needs_clarification"
          : "ready_for_review",

      agreement: {
        // The model schema does not contain a contract title.
        // Do not synthesize one from scope or party names.
        title:
          null,

        // Preserve the user's exact natural-language source.
        description:
          input.text,

        totalValue:
          asString(
            total?.amount,
          ),

        settlementAsset:
          readSettlementAsset(
            pricing,
          ),

        deadline:
          readDeadline(
            agreement,
          ),

        // No equivalent field exists in pai.agreement.v0.2.
        approvalWindow:
          null,

        milestones:
          readMilestones(
            agreement,
          ),
      },

      // Questions belong to the later clarification / Stress Test
      // layer. Do not invent them from issue codes here.
      questions:
        [],

      // Model issues are not AgreementRisk objects because the
      // model does not emit severity/message. Preserve them below
      // rather than manufacturing risk metadata.
      risks:
        [],

      issues,

      provenance,
    };

    return runAgreementStressTestV1({
      sourceText:
        input.text,

      modelResult,

      validatedFacts: {
        partyCount:
          asArray(
            agreement.parties,
          ).length,
      },
    });
  };
}