export type AgreementStructuringStatus =
  | "needs_clarification"
  | "ready_for_review";

export type AgreementRiskSeverity =
  | "low"
  | "medium"
  | "high";

export interface StructureAgreementInput {
  readonly text:
    string;
}

export interface StructuredAgreementMilestone {
  readonly amount:
    string | null;

  readonly deliverable:
    string | null;

  readonly acceptanceCriteria:
    string | null;

  readonly deadline:
    string | null;
}

export interface StructuredAgreement {
  readonly title:
    string | null;

  readonly description:
    string;

  readonly totalValue:
    string | null;

  readonly settlementAsset:
    string | null;

  readonly deadline:
    string | null;

  readonly approvalWindow:
    string | null;

  readonly milestones:
    StructuredAgreementMilestone[];
}

export interface AgreementRisk {
  readonly code:
    string;

  readonly severity:
    AgreementRiskSeverity;

  readonly message:
    string;

  readonly field?:
    string | undefined;
}

export interface AgreementStructuringResult {
  readonly status:
    AgreementStructuringStatus;

  readonly agreement:
    StructuredAgreement;

  readonly questions:
    string[];

  readonly risks:
    AgreementRisk[];
}

export type StructureAgreement =
  (
    input:
      StructureAgreementInput,
  ) => Promise<AgreementStructuringResult>;
