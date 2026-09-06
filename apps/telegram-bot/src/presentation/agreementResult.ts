import type {
  AgreementRisk,
  AgreementStructuringResult,
  StructuredAgreementMilestone,
} from "@pai/intelligence-contract";

function renderRisks(
  risks: readonly AgreementRisk[],
): string[] {
  if (risks.length === 0) {
    return [];
  }

  return [
    "",
    "Risks:",
    ...risks.map(
      (
        risk,
        index,
      ) => {
        const field =
          risk.field
            ? ` [${risk.field}]`
            : "";

        return `${index + 1}. ${risk.severity.toUpperCase()}${field}: ${risk.message}`;
      },
    ),
  ];
}

function renderMilestone(
  milestone: StructuredAgreementMilestone,
  index: number,
): string {
  const details = [
    milestone.deliverable
      ? `deliverable: ${milestone.deliverable}`
      : null,

    milestone.amount
      ? `amount: ${milestone.amount}`
      : null,

    milestone.acceptanceCriteria
      ? `acceptance: ${milestone.acceptanceCriteria}`
      : null,

    milestone.deadline
      ? `deadline: ${milestone.deadline}`
      : null,
  ].filter(
    (
      value,
    ): value is string =>
      value !== null,
  );

  return `${index + 1}. ${details.join(" | ") || "Milestone details pending"}`;
}

export function formatAgreementStructuringResult(
  result: AgreementStructuringResult,
): string {
  const lines: string[] = [];

  if (
    result.status ===
    "needs_clarification"
  ) {
    lines.push(
      "PAI needs a few clarifications before the agreement is ready for review.",
      "",
      `Draft: ${result.agreement.description}`,
    );

    if (
      result.questions.length >
      0
    ) {
      lines.push(
        "",
        "Please answer:",
        ...result.questions.map(
          (
            question,
            index,
          ) =>
            `${index + 1}. ${question}`,
        ),
      );
    }
  } else {
    lines.push(
      "Agreement is ready for review.",
      "",
    );

    if (result.agreement.title) {
      lines.push(
        `Title: ${result.agreement.title}`,
      );
    }

    lines.push(
      `Description: ${result.agreement.description}`,
    );

    if (
      result.agreement.totalValue ||
      result.agreement.settlementAsset
    ) {
      lines.push(
        `Value: ${
          result.agreement.totalValue ??
          "Not specified"
        } ${
          result.agreement.settlementAsset ??
          ""
        }`.trim(),
      );
    }

    if (result.agreement.deadline) {
      lines.push(
        `Deadline: ${result.agreement.deadline}`,
      );
    }

    if (
      result.agreement.approvalWindow
    ) {
      lines.push(
        `Approval window: ${result.agreement.approvalWindow}`,
      );
    }

    if (
      result.agreement.milestones.length >
      0
    ) {
      lines.push(
        "",
        "Milestones:",
        ...result.agreement.milestones.map(
          renderMilestone,
        ),
      );
    }
  }

  lines.push(
    ...renderRisks(
      result.risks,
    ),
  );

  return lines.join(
    "\n",
  );
}