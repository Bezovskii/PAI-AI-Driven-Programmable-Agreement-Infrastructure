import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const schemaDirectory = path.resolve(currentDirectory, "..");

const agreementSchema = JSON.parse(
  fs.readFileSync(path.join(schemaDirectory, "pai-agreement-v0.2.schema.json"), "utf8"),
);
const modelOutputSchema = JSON.parse(
  fs.readFileSync(path.join(schemaDirectory, "pai-model-output-v0.2.schema.json"), "utf8"),
);
const trainingExampleSchema = JSON.parse(
  fs.readFileSync(path.join(schemaDirectory, "pai-training-example-v0.2.schema.json"), "utf8"),
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(agreementSchema);
ajv.addSchema(modelOutputSchema);
const validateSchema = ajv.compile(trainingExampleSchema);

function emptyAgreement() {
  return {
    parties: [],
    scope: {
      summary: null,
      deliverables: [],
      exclusions: [],
    },
    pricing: {
      total: null,
      settlementAsset: null,
    },
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
  };
}

function baseExample() {
  return {
    recordVersion: "pai.training-example.v0.2",
    exampleId: "pai_v0_2_fixture_basic_001",
    task: "agreement_extraction",
    split: "fixture",
    input: {
      text: "Build a website.",
      language: "en",
      format: "plain_text",
    },
    trustedContext: {
      facts: [],
    },
    target: {
      schemaVersion: "pai.agreement.v0.2",
      agreement: emptyAgreement(),
      issues: [],
      provenance: [],
    },
    metadata: {
      difficulty: "basic",
      phenomena: ["scope"],
      origin: "hand_authored_fixture",
      generator: null,
      parentExampleIds: [],
      reviewStatus: "reviewed",
      leakageGroupId: "fixture_basic_001",
      sourceLicense: null,
      containsPersonalData: false,
      notes: [],
    },
  };
}

function clone(value) {
  return structuredClone(value);
}

function validateRecord(record) {
  const structural = validateSchema(record);
  if (!structural) {
    return {
      valid: false,
      errors: validateSchema.errors,
    };
  }

  for (const entry of record.target.provenance) {
    if (!record.input.text.includes(entry.quote)) {
      return {
        valid: false,
        errors: [
          {
            keyword: "exactSourceQuote",
            message: "provenance quote must occur exactly in input.text",
            params: { quote: entry.quote },
          },
        ],
      };
    }
  }

  for (const issue of record.target.issues) {
    for (const quote of issue.evidence) {
      if (!record.input.text.includes(quote)) {
        return {
          valid: false,
          errors: [
            {
              keyword: "exactSourceEvidence",
              message: "issue evidence must occur exactly in input.text",
              params: { quote },
            },
          ],
        };
      }
    }
  }

  return { valid: true, errors: [] };
}

const cases = [
  {
    name: "basic_fixture_record",
    expected: true,
    value: baseExample(),
  },
  {
    name: "trusted_network_context",
    expected: true,
    value: (() => {
      const value = baseExample();
      value.exampleId = "pai_v0_2_fixture_context_001";
      value.trustedContext.facts.push({
        kind: "confirmed_settlement_network",
        path: "/agreement/pricing/settlementAsset/networkId",
        value: "eip155:8453",
        source: "user_confirmed",
      });
      value.metadata.phenomena = ["settlement_network"];
      value.metadata.leakageGroupId = "fixture_context_001";
      return value;
    })(),
  },
  {
    name: "reference_datetime_context",
    expected: true,
    value: (() => {
      const value = baseExample();
      value.exampleId = "pai_v0_2_fixture_datetime_001";
      value.trustedContext.facts.push({
        kind: "reference_datetime",
        path: null,
        value: "2026-09-04T09:00:00+03:00",
        source: "fixture_assumption",
      });
      value.metadata.leakageGroupId = "fixture_datetime_001";
      return value;
    })(),
  },
  {
    name: "multilingual_input",
    expected: true,
    value: (() => {
      const value = baseExample();
      value.exampleId = "pai_v0_2_fixture_fa_001";
      value.input = {
        text: "یک وب‌سایت طراحی کن.",
        language: "fa",
        format: "plain_text",
      };
      value.metadata.phenomena = ["scope", "multilingual"];
      value.metadata.leakageGroupId = "fixture_fa_001";
      return value;
    })(),
  },
  {
    name: "exact_provenance_quote",
    expected: true,
    value: (() => {
      const value = baseExample();
      value.target.agreement.scope.summary = "Build a website";
      value.target.provenance.push({
        path: "/agreement/scope/summary",
        quote: "Build a website",
      });
      value.metadata.phenomena = ["scope", "provenance"];
      return value;
    })(),
  },
  {
    name: "synthetic_record_with_lineage",
    expected: true,
    value: (() => {
      const value = baseExample();
      value.exampleId = "pai_v0_2_fixture_synthetic_001";
      value.metadata.origin = "synthetic";
      value.metadata.generator = "generator-profile-v0.2";
      value.metadata.parentExampleIds = ["pai_v0_2_fixture_basic_001"];
      value.metadata.leakageGroupId = "fixture_basic_001";
      return value;
    })(),
  },
  {
    name: "reject_wrong_record_version",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.recordVersion = "pai.training-example.v0.1";
      return value;
    })(),
  },
  {
    name: "reject_wrong_task",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.task = "risk_scoring";
      return value;
    })(),
  },
  {
    name: "reject_unknown_split",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.split = "development";
      return value;
    })(),
  },
  {
    name: "reject_empty_input",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.input.text = "";
      return value;
    })(),
  },
  {
    name: "reject_invalid_language_tag",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.input.language = "english language";
      return value;
    })(),
  },
  {
    name: "reject_context_path_outside_agreement",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.trustedContext.facts.push({
        kind: "confirmed_currency",
        path: "/metadata/currency",
        value: "USD",
        source: "user_confirmed",
      });
      return value;
    })(),
  },
  {
    name: "reject_datetime_with_agreement_path",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.trustedContext.facts.push({
        kind: "reference_datetime",
        path: "/agreement/milestones/0/deadline",
        value: "2026-09-04T09:00:00+03:00",
        source: "fixture_assumption",
      });
      return value;
    })(),
  },
  {
    name: "reject_wrong_target_version",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.target.schemaVersion = "pai.agreement.v0.1";
      return value;
    })(),
  },
  {
    name: "reject_risk_flags_in_target",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.target.riskFlags = [];
      return value;
    })(),
  },
  {
    name: "reject_provenance_absent_from_input",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.target.provenance.push({
        path: "/agreement/scope/summary",
        quote: "Create an ecommerce platform",
      });
      return value;
    })(),
  },
  {
    name: "reject_issue_evidence_absent_from_input",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.target.issues.push({
        kind: "ambiguity",
        code: "AMBIGUOUS_SCOPE",
        paths: ["/agreement/scope"],
        evidence: ["unclear mobile application"],
      });
      return value;
    })(),
  },
  {
    name: "reject_duplicate_phenomena",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.metadata.phenomena = ["scope", "scope"];
      return value;
    })(),
  },
  {
    name: "reject_missing_leakage_group",
    expected: false,
    value: (() => {
      const value = baseExample();
      delete value.metadata.leakageGroupId;
      return value;
    })(),
  },
  {
    name: "reject_synthetic_record_without_generator",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.metadata.origin = "synthetic";
      value.metadata.generator = null;
      return value;
    })(),
  },
  {
    name: "reject_uncontracted_confidence",
    expected: false,
    value: (() => {
      const value = baseExample();
      value.metadata.confidence = 0.95;
      return value;
    })(),
  },
];

let passed = 0;
for (const [index, testCase] of cases.entries()) {
  const result = validateRecord(clone(testCase.value));
  const received = result.valid;
  if (received === testCase.expected) {
    passed += 1;
    console.log(
      `PASS ${String(index + 1).padStart(2, "0")}_${testCase.name} ` +
        `(expected ${testCase.expected ? "valid" : "invalid"}, ` +
        `received ${received ? "valid" : "invalid"})`,
    );
  } else {
    console.error(
      `FAIL ${String(index + 1).padStart(2, "0")}_${testCase.name} ` +
        `(expected ${testCase.expected ? "valid" : "invalid"}, ` +
        `received ${received ? "valid" : "invalid"})`,
    );
    console.error(JSON.stringify(result.errors, null, 2));
  }
}

console.log(`\n${passed}/${cases.length} training-example schema cases passed.`);
if (passed !== cases.length) {
  process.exitCode = 1;
}
