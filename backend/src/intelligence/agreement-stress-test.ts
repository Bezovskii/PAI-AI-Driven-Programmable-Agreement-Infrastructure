import type {
  AgreementRisk,
  AgreementStructuringResult,
} from "./types.js";

/**
 * Agreement Stress Test — Deterministic V1
 *
 * Runs after neural extraction.
 *
 * The model interprets.
 * This layer deterministically challenges the result.
 *
 * Model issues remain separate in result.issues and cannot suppress
 * deterministic findings produced here.
 */

export interface AgreementStressTestFacts {
  readonly partyCount:
    number;
}

export interface AgreementStressTestInput {
  readonly sourceText:
    string;

  readonly modelResult:
    AgreementStructuringResult;

  readonly validatedFacts?:
    AgreementStressTestFacts;
}

const blockchainAssetPattern =
  /\b(?:USDC|USDT|DAI|ETH|WETH|WBTC|BTC|XLM)\b/i;

const settlementNetworkPattern =
  /\b(?:Arc(?:\s+Testnet)?|Ethereum(?:\s+Mainnet)?|Sepolia|Arbitrum|Optimism|Base|Polygon|Stellar|Solana)\b/i;

const explicitDollarCurrencyPattern =
  /\b(?:USD|US\s+dollars?|CAD|Canadian\s+dollars?|AUD|Australian\s+dollars?|NZD|New\s+Zealand\s+dollars?|SGD|Singapore\s+dollars?|HKD|Hong\s+Kong\s+dollars?)\b/i;

const explicitFiatSettlementPattern =
  /\b(?:pay|paid|payment|settle|settlement|use)\s+(?:(?:in|with)\s+)?(?:USD|EUR|GBP|TRY|CAD|AUD|NZD|SGD|HKD)\b/i;

const approvalPattern =
  /\b(?:approve|approves|approved|approval|accept|accepts|accepted|acceptance)\b/i;

const objectiveAcceptancePattern =
  /\b(?:all\s+links|accessible|source\s+files|passes?|without\s+errors?|meets?\s+(?:the\s+)?(?:criteria|requirements)|mobile\s+and\s+desktop|desktop\s+and\s+mobile)\b/i;

function addRisk(
  risks:
    AgreementRisk[],
  risk:
    AgreementRisk,
): void {
  if (
    risks.some(
      (existing) =>
        existing.code === risk.code &&
        existing.field === risk.field,
    )
  ) {
    return;
  }

  risks.push(
    risk,
  );
}

function addQuestion(
  questions:
    string[],
  question:
    string,
): void {
  if (
    !questions.includes(
      question,
    )
  ) {
    questions.push(
      question,
    );
  }
}

function hasExplicitSettlementAsset(
  sourceText:
    string,
): boolean {
  return (
    blockchainAssetPattern.test(
      sourceText,
    ) ||
    explicitFiatSettlementPattern.test(
      sourceText,
    )
  );
}

function hasMissingModelAcceptanceCriteria(
  modelResult:
    AgreementStructuringResult,
): boolean {
  return modelResult.agreement.milestones.some(
    (milestone) =>
      milestone.acceptanceCriteria === null ||
      milestone.acceptanceCriteria.trim().length === 0,
  );
}

export function runAgreementStressTestV1(
  input:
    AgreementStressTestInput,
): AgreementStructuringResult {
  const sourceText =
    input.sourceText.trim();

  const modelResult =
    input.modelResult;

  const deterministicRisks:
    AgreementRisk[] = [];

  const questions =
    [
      ...modelResult.questions,
    ];

  const hasDollarSymbol =
    sourceText.includes(
      "$",
    );

  const hasExplicitDollarCurrency =
    explicitDollarCurrencyPattern.test(
      sourceText,
    );

  if (
    hasDollarSymbol &&
    !hasExplicitDollarCurrency
  ) {
    addRisk(
      deterministicRisks,
      {
        code:
          "AMBIGUOUS_CURRENCY",

        severity:
          "high",

        message:
          "The source uses '$' without uniquely identifying which dollar-denominated currency is intended.",

        field:
          "pricing.total.currency",
      },
    );

    addQuestion(
      questions,
      "Which currency does '$' mean here (for example USD, CAD, or AUD)?",
    );
  }

  const hasExplicitAsset =
    hasExplicitSettlementAsset(
      sourceText,
    );

  if (!hasExplicitAsset) {
    addRisk(
      deterministicRisks,
      {
        code:
          "MISSING_SETTLEMENT_ASSET",

        severity:
          "high",

        message:
          "The source does not explicitly state the asset that should be used for settlement.",

        field:
          "pricing.settlementAsset",
      },
    );

    addQuestion(
      questions,
      "Which asset should be used for settlement?",
    );
  }

  const hasBlockchainAsset =
    blockchainAssetPattern.test(
      sourceText,
    );

  const hasSettlementNetwork =
    settlementNetworkPattern.test(
      sourceText,
    );

  if (
    hasBlockchainAsset &&
    !hasSettlementNetwork
  ) {
    addRisk(
      deterministicRisks,
      {
        code:
          "MISSING_SETTLEMENT_NETWORK",

        severity:
          "high",

        message:
          "A blockchain settlement asset is stated, but its settlement network is not.",

        field:
          "pricing.settlementAsset.networkId",
      },
    );

    addQuestion(
      questions,
      "Which blockchain network should be used for settlement?",
    );
  }

  const approvalIsRequired =
    approvalPattern.test(
      sourceText,
    );

  const hasObjectiveAcceptanceCriteria =
    objectiveAcceptancePattern.test(
      sourceText,
    );

  const modelAcceptanceMissing =
    hasMissingModelAcceptanceCriteria(
      modelResult,
    );

  if (
    approvalIsRequired &&
    (
      !hasObjectiveAcceptanceCriteria ||
      modelAcceptanceMissing
    )
  ) {
    addRisk(
      deterministicRisks,
      {
        code:
          "MISSING_ACCEPTANCE_CRITERIA",

        severity:
          "high",

        message:
          "Acceptance is required, but the source does not provide sufficiently objective acceptance criteria.",

        field:
          "milestones.acceptance.criteria",
      },
    );

    addQuestion(
      questions,
      "What objective conditions must be satisfied before the work is accepted?",
    );
  }

  const partyCount =
    input.validatedFacts?.partyCount;

  if (
    partyCount !== undefined &&
    partyCount < 2
  ) {
    addRisk(
      deterministicRisks,
      {
        code:
          "MISSING_PARTY",

        severity:
          "high",

        message:
          "The agreement does not identify enough parties to represent both sides of the agreement.",

        field:
          "parties",
      },
    );

    addQuestion(
      questions,
      "Who are the required parties to this agreement?",
    );
  }

  const totalValue =
    modelResult.agreement.totalValue;

  if (
    totalValue === null ||
    totalValue.trim().length === 0
  ) {
    addRisk(
      deterministicRisks,
      {
        code:
          "MISSING_PRICE",

        severity:
          "high",

        message:
          "The agreement does not contain a price.",

        field:
          "pricing.total.amount",
      },
    );

    addQuestion(
      questions,
      "What is the agreed price?",
    );
  }

  const milestones =
    modelResult.agreement.milestones;

  const hasDeliverable =
    milestones.some(
      (milestone) =>
        milestone.deliverable !== null &&
        milestone.deliverable.trim().length > 0,
    );

  if (!hasDeliverable) {
    addRisk(
      deterministicRisks,
      {
        code:
          "MISSING_DELIVERABLE",

        severity:
          "high",

        message:
          "The agreement does not contain a concrete deliverable.",

        field:
          "milestones.deliverable",
      },
    );

    addQuestion(
      questions,
      "What exactly must be delivered?",
    );
  }

  const agreementDeadline =
    modelResult.agreement.deadline;

  const hasAgreementDeadline =
    agreementDeadline !== null &&
    agreementDeadline.trim().length > 0;

  const hasMilestoneDeadline =
    milestones.some(
      (milestone) =>
        milestone.deadline !== null &&
        milestone.deadline.trim().length > 0,
    );

  if (
    !hasAgreementDeadline &&
    !hasMilestoneDeadline
  ) {
    addRisk(
      deterministicRisks,
      {
        code:
          "MISSING_DEADLINE",

        severity:
          "high",

        message:
          "The agreement does not contain a delivery deadline.",

        field:
          "milestones.deadline",
      },
    );

    addQuestion(
      questions,
      "What is the delivery deadline?",
    );
  }

  const risks =
    [
      ...modelResult.risks,
      ...deterministicRisks,
    ];

  const modelIssues =
    modelResult.issues ?? [];

  const needsClarification =
    modelResult.status === "needs_clarification" ||
    modelIssues.length > 0 ||
    deterministicRisks.length > 0;

  return {
    ...modelResult,

    status:
      needsClarification
        ? "needs_clarification"
        : "ready_for_review",

    questions,

    risks,
  };
}