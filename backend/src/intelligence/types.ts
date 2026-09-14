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
    string;
}

export interface AgreementModelIssue {
  readonly kind:
    string;

  readonly code:
    string;

  readonly paths:
    string[];

  readonly evidence:
    string;
}

export interface AgreementProvenance {
  readonly path:
    string;

  readonly quote:
    string;
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

  /**
   * Exact semantic issues emitted by the validated model.
   *
   * Optional for backwards compatibility with the original
   * Phase 2A Intelligence API contract.
   */
  readonly issues?:
    AgreementModelIssue[];

  /**
   * Exact source quotes emitted by the validated model.
   *
   * Optional for backwards compatibility with the original
   * Phase 2A Intelligence API contract.
   */
  readonly provenance?:
    AgreementProvenance[];
}

export type StructureAgreement =
  (
    input:
      StructureAgreementInput,
  ) => Promise<AgreementStructuringResult>;
