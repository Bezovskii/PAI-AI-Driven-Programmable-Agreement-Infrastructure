import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const agreementSchema = JSON.parse(
  fs.readFileSync("docs/ai/schema/pai-agreement-v0.1.schema.json", "utf8"),
);
const outputSchema = JSON.parse(
  fs.readFileSync("docs/ai/schema/pai-model-output-v0.1.schema.json", "utf8"),
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(agreementSchema);
const validate = ajv.compile(outputSchema);

const emptyAgreement = () => ({
  parties: [],
  scope: { summary: null, deliverables: [], exclusions: [] },
  pricing: { total: null, settlementAsset: null },
  milestones: [],
  payments: [],
  revisionTerms: [],
  evidenceTerms: [],
  disputeTerms: {
    enabled: null,
    resolver: null,
    initiationConditions: [],
    evidenceWindow: null,
    resolutionOptions: [],
  },
});

const validOutput = () => ({
  schemaVersion: "pai.agreement.v0.1",
  agreement: emptyAgreement(),
  issues: [],
  provenance: [],
});

const cases = [];

cases.push({
  id: "01_empty_partial_output",
  expectedValid: true,
  output: validOutput(),
});

const extractedDeal = validOutput();
extractedDeal.agreement.parties = [
  {
    id: "party_1",
    reference: "speaker",
    displayName: null,
    roles: ["provider", "payee"],
  },
  {
    id: "party_2",
    reference: "counterparty",
    displayName: null,
    roles: ["client", "payer"],
  },
];
extractedDeal.agreement.scope = {
  summary: "Build an ecommerce website",
  deliverables: ["Ecommerce website"],
  exclusions: [],
};
extractedDeal.agreement.pricing.total = {
  amount: "4500",
  currency: { code: null, symbol: "$" },
};
extractedDeal.issues = [
  {
    kind: "ambiguity",
    code: "AMBIGUOUS_CURRENCY",
    paths: ["/agreement/pricing/total/currency"],
    evidence: ["$4,500"],
  },
  {
    kind: "missing_term",
    code: "MISSING_DEADLINE",
    paths: ["/agreement/milestones"],
    evidence: [],
  },
];
extractedDeal.provenance = [
  {
    path: "/agreement/scope/summary",
    quote: "build an ecommerce website",
  },
  {
    path: "/agreement/pricing/total/amount",
    quote: "$4,500",
  },
];
cases.push({
  id: "02_extraction_issues_and_provenance",
  expectedValid: true,
  output: extractedDeal,
});

const allIssueKinds = validOutput();
allIssueKinds.issues = [
  {
    kind: "missing_term",
    code: "MISSING_DEADLINE",
    paths: ["/agreement/milestones"],
    evidence: [],
  },
  {
    kind: "ambiguity",
    code: "AMBIGUOUS_REVISION_SCOPE",
    paths: ["/agreement/revisionTerms/0"],
    evidence: ["Two revisions are included"],
  },
  {
    kind: "contradiction",
    code: "CONTRADICTORY_DEADLINE",
    paths: ["/agreement/milestones/0/deadline"],
    evidence: ["Delivery is due September 15", "Delivery is due September 20"],
  },
  {
    kind: "unresolved_reference",
    code: "UNRESOLVED_PRONOUN",
    paths: ["/agreement/parties"],
    evidence: ["when they approve it"],
  },
  {
    kind: "unsupported_term",
    code: "UNSUPPORTED_RECURRING_RETAINER",
    paths: ["/agreement"],
    evidence: ["$1,000 every month"],
  },
];
cases.push({
  id: "03_all_issue_kinds",
  expectedValid: true,
  output: allIssueKinds,
});

const repeatedPathProvenance = validOutput();
repeatedPathProvenance.provenance = [
  {
    path: "/agreement/scope/summary",
    quote: "design the website",
  },
  {
    path: "/agreement/scope/summary",
    quote: "and deploy it",
  },
];
cases.push({
  id: "04_multiple_quotes_for_one_path",
  expectedValid: true,
  output: repeatedPathProvenance,
});

const riskFlags = validOutput();
riskFlags.riskFlags = [];
cases.push({
  id: "05_reject_risk_flags",
  expectedValid: false,
  output: riskFlags,
});

const wrongVersion = validOutput();
wrongVersion.schemaVersion = "pai.agreement.v0.2";
cases.push({
  id: "06_reject_wrong_schema_version",
  expectedValid: false,
  output: wrongVersion,
});

const proseIssueCode = validOutput();
proseIssueCode.issues = [
  {
    kind: "ambiguity",
    code: "Currency might be unclear",
    paths: ["/agreement/pricing/total/currency"],
    evidence: ["$4,500"],
  },
];
cases.push({
  id: "07_reject_prose_issue_code",
  expectedValid: false,
  output: proseIssueCode,
});

const invalidIssueKind = validOutput();
invalidIssueKind.issues = [
  {
    kind: "risk",
    code: "HIGH_RISK_DEAL",
    paths: ["/agreement"],
    evidence: [],
  },
];
cases.push({
  id: "08_reject_risk_issue_kind",
  expectedValid: false,
  output: invalidIssueKind,
});

const externalPath = validOutput();
externalPath.issues = [
  {
    kind: "missing_term",
    code: "MISSING_TERM",
    paths: ["/riskFlags/0"],
    evidence: [],
  },
];
cases.push({
  id: "09_reject_path_outside_agreement",
  expectedValid: false,
  output: externalPath,
});

const emptyPaths = validOutput();
emptyPaths.issues = [
  {
    kind: "missing_term",
    code: "MISSING_TERM",
    paths: [],
    evidence: [],
  },
];
cases.push({
  id: "10_reject_issue_without_path",
  expectedValid: false,
  output: emptyPaths,
});

const hallucinatedOffsets = validOutput();
hallucinatedOffsets.provenance = [
  {
    path: "/agreement/scope/summary",
    quote: "build a website",
    startOffset: 0,
    endOffset: 15,
  },
];
cases.push({
  id: "11_reject_model_generated_offsets",
  expectedValid: false,
  output: hallucinatedOffsets,
});

const emptyQuote = validOutput();
emptyQuote.provenance = [
  {
    path: "/agreement/scope/summary",
    quote: "",
  },
];
cases.push({
  id: "12_reject_empty_provenance_quote",
  expectedValid: false,
  output: emptyQuote,
});

const malformedAgreement = validOutput();
malformedAgreement.agreement.pricing.total = {
  amount: 4500,
  currency: { code: "USD", symbol: "$" },
};
cases.push({
  id: "13_reject_invalid_nested_agreement",
  expectedValid: false,
  output: malformedAgreement,
});

const confidenceScore = validOutput();
confidenceScore.provenance = [
  {
    path: "/agreement/scope/summary",
    quote: "build a website",
    confidence: 0.92,
  },
];
cases.push({
  id: "14_reject_uncontracted_confidence_score",
  expectedValid: false,
  output: confidenceScore,
});

const emptyPointerSegment = validOutput();
emptyPointerSegment.provenance = [
  {
    path: "/agreement//scope",
    quote: "build a website",
  },
];
cases.push({
  id: "15_reject_empty_json_pointer_segment",
  expectedValid: false,
  output: emptyPointerSegment,
});

const duplicateIssues = validOutput();
const repeatedIssue = {
  kind: "missing_term",
  code: "MISSING_DEADLINE",
  paths: ["/agreement/milestones"],
  evidence: [],
};
duplicateIssues.issues = [repeatedIssue, { ...repeatedIssue }];
cases.push({
  id: "16_reject_duplicate_issues",
  expectedValid: false,
  output: duplicateIssues,
});

const duplicateProvenance = validOutput();
const repeatedProvenance = {
  path: "/agreement/scope/summary",
  quote: "build a website",
};
duplicateProvenance.provenance = [
  repeatedProvenance,
  { ...repeatedProvenance },
];
cases.push({
  id: "17_reject_duplicate_provenance",
  expectedValid: false,
  output: duplicateProvenance,
});

const unsupportedWithoutEvidence = validOutput();
unsupportedWithoutEvidence.issues = [
  {
    kind: "unsupported_term",
    code: "UNSUPPORTED_TERM",
    paths: ["/agreement"],
    evidence: [],
  },
];
cases.push({
  id: "18_require_evidence_for_non_missing_issue",
  expectedValid: false,
  output: unsupportedWithoutEvidence,
});

let failures = 0;

for (const testCase of cases) {
  const actualValid = validate(testCase.output);
  const passed = actualValid === testCase.expectedValid;

  if (!passed) failures += 1;

  console.log(
    `${passed ? "PASS" : "FAIL"} ${testCase.id} ` +
      `(expected ${testCase.expectedValid ? "valid" : "invalid"}, ` +
      `received ${actualValid ? "valid" : "invalid"})`,
  );

  if (!passed && validate.errors) {
    console.error(JSON.stringify(validate.errors, null, 2));
  }
}

console.log(`\n${cases.length - failures}/${cases.length} model-output cases passed.`);

if (failures > 0) {
  process.exitCode = 1;
}
