import fs from "node:fs";

const registryPath = "docs/ai/schema/pai-issue-codes-v0.2.json";
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const expectedKinds = [
  "missing_term",
  "ambiguity",
  "contradiction",
  "unresolved_reference",
  "unsupported_term",
];

const requiredFixtureCodes = [
  "AMBIGUOUS_CURRENCY",
  "MISSING_DEADLINE",
  "AMBIGUOUS_REVISION_SCOPE",
  "CONTRADICTORY_DEADLINE",
  "UNRESOLVED_PRONOUN",
  "UNSUPPORTED_RECURRING_RETAINER",
];

const forbiddenCodeFragments = [
  "RISK",
  "ARITHMETIC",
  "PAYMENT_TOTAL",
  "PERCENT_TOTAL",
  "COMPILATION",
  "DEPLOYMENT",
  "READINESS",
  "ADAPTER_FAILURE",
  "EXECUTION_FAILURE",
  "PROVENANCE_INVALID",
];

function validateRegistry(candidate) {
  const errors = [];

  if (candidate?.registryVersion !== "pai.issue-codes.v0.2") {
    errors.push("registryVersion must equal pai.issue-codes.v0.2");
  }

  if (candidate?.targetSchemaVersion !== "pai.agreement.v0.2") {
    errors.push("targetSchemaVersion must equal pai.agreement.v0.2");
  }

  if (typeof candidate?.description !== "string" || candidate.description.length === 0) {
    errors.push("description must be a non-empty string");
  }

  if (!Array.isArray(candidate?.issueKinds)) {
    errors.push("issueKinds must be an array");
  }

  if (!Array.isArray(candidate?.codes) || candidate.codes.length === 0) {
    errors.push("codes must be a non-empty array");
  }

  if (!Array.isArray(candidate?.excludedResponsibilities)) {
    errors.push("excludedResponsibilities must be an array");
  }

  if (errors.length > 0) return errors;

  const kindNames = candidate.issueKinds.map((entry) => entry.kind);
  if (new Set(kindNames).size !== kindNames.length) {
    errors.push("issueKinds must not contain duplicates");
  }

  if (
    kindNames.length !== expectedKinds.length ||
    expectedKinds.some((kind) => !kindNames.includes(kind))
  ) {
    errors.push("issueKinds must contain exactly the five model issue kinds");
  }

  const kindMap = new Map();
  for (const entry of candidate.issueKinds) {
    if (typeof entry.description !== "string" || entry.description.length === 0) {
      errors.push(`issue kind ${entry.kind} needs a description`);
    }
    if (typeof entry.evidenceRequired !== "boolean") {
      errors.push(`issue kind ${entry.kind} needs evidenceRequired`);
    }
    kindMap.set(entry.kind, entry);
  }

  const codeNames = candidate.codes.map((entry) => entry.code);
  if (new Set(codeNames).size !== codeNames.length) {
    errors.push("codes must not contain duplicates");
  }

  for (const entry of candidate.codes) {
    if (
      typeof entry.code !== "string" ||
      !/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(entry.code)
    ) {
      errors.push(`invalid code format: ${entry.code}`);
    }

    if (forbiddenCodeFragments.some((fragment) => entry.code.includes(fragment))) {
      errors.push(`deterministic-layer responsibility leaked into code: ${entry.code}`);
    }

    const kind = kindMap.get(entry.kind);
    if (!kind) {
      errors.push(`unknown kind for ${entry.code}: ${entry.kind}`);
    } else if (entry.evidenceRequired !== kind.evidenceRequired) {
      errors.push(`evidenceRequired mismatch for ${entry.code}`);
    }

    if (typeof entry.description !== "string" || entry.description.length === 0) {
      errors.push(`missing description for ${entry.code}`);
    }

    if (!Array.isArray(entry.pathPrefixes) || entry.pathPrefixes.length === 0) {
      errors.push(`pathPrefixes required for ${entry.code}`);
    } else {
      if (new Set(entry.pathPrefixes).size !== entry.pathPrefixes.length) {
        errors.push(`duplicate pathPrefixes for ${entry.code}`);
      }
      for (const path of entry.pathPrefixes) {
        if (
          typeof path !== "string" ||
          !/^\/agreement(?:\/(?:[^~/]|~0|~1)+)*$/.test(path)
        ) {
          errors.push(`invalid agreement path prefix for ${entry.code}: ${path}`);
        }
      }
    }
  }

  for (const kind of expectedKinds) {
    if (!candidate.codes.some((entry) => entry.kind === kind)) {
      errors.push(`no codes defined for issue kind: ${kind}`);
    }
  }

  for (const code of requiredFixtureCodes) {
    if (!codeNames.includes(code)) {
      errors.push(`fixture code missing from registry: ${code}`);
    }
  }

  return errors;
}
const clone = (value) => JSON.parse(JSON.stringify(value));

const cases = [
  {
    id: "01_registry_is_valid",
    expectedValid: true,
    registry,
  },
  {
    id: "02_reject_wrong_registry_version",
    expectedValid: false,
    registry: {
      ...clone(registry),
      registryVersion: "pai.issue-codes.v0.1",
    },
  },
  {
    id: "03_reject_wrong_target_schema",
    expectedValid: false,
    registry: {
      ...clone(registry),
      targetSchemaVersion: "pai.agreement.v0.1",
    },
  },
];

const duplicateCode = clone(registry);
duplicateCode.codes.push(clone(duplicateCode.codes[0]));
cases.push({
  id: "04_reject_duplicate_code",
  expectedValid: false,
  registry: duplicateCode,
});

const unknownKind = clone(registry);
unknownKind.codes[0].kind = "risk";
cases.push({
  id: "05_reject_unknown_kind",
  expectedValid: false,
  registry: unknownKind,
});

const evidenceMismatch = clone(registry);
evidenceMismatch.codes.find((entry) => entry.kind === "ambiguity").evidenceRequired =
  false;
cases.push({
  id: "06_reject_evidence_rule_mismatch",
  expectedValid: false,
  registry: evidenceMismatch,
});

const proseCode = clone(registry);
proseCode.codes[0].code = "Currency might be unclear";
cases.push({
  id: "07_reject_prose_code",
  expectedValid: false,
  registry: proseCode,
});

const outsidePath = clone(registry);
outsidePath.codes[0].pathPrefixes = ["/riskFlags"];
cases.push({
  id: "08_reject_path_outside_agreement",
  expectedValid: false,
  registry: outsidePath,
});

const emptyDescription = clone(registry);
emptyDescription.codes[0].description = "";
cases.push({
  id: "09_reject_empty_description",
  expectedValid: false,
  registry: emptyDescription,
});

const missingFixtureCode = clone(registry);
missingFixtureCode.codes = missingFixtureCode.codes.filter(
  (entry) => entry.code !== "AMBIGUOUS_CURRENCY",
);
cases.push({
  id: "10_reject_missing_fixture_code",
  expectedValid: false,
  registry: missingFixtureCode,
});

const deterministicLeak = clone(registry);
deterministicLeak.codes.push({
  code: "PAYMENT_TOTAL_MISMATCH",
  kind: "contradiction",
  description: "Calculated payment sum differs from total.",
  pathPrefixes: ["/agreement/payments"],
  evidenceRequired: true,
});
cases.push({
  id: "11_reject_deterministic_responsibility",
  expectedValid: false,
  registry: deterministicLeak,
});

const duplicateKind = clone(registry);
duplicateKind.issueKinds.push(clone(duplicateKind.issueKinds[0]));
cases.push({
  id: "12_reject_duplicate_issue_kind",
  expectedValid: false,
  registry: duplicateKind,
});

let failures = 0;

for (const testCase of cases) {
  const errors = validateRegistry(testCase.registry);
  const actualValid = errors.length === 0;
  const passed = actualValid === testCase.expectedValid;

  if (!passed) failures += 1;

  console.log(
    `${passed ? "PASS" : "FAIL"} ${testCase.id} ` +
      `(expected ${testCase.expectedValid ? "valid" : "invalid"}, ` +
      `received ${actualValid ? "valid" : "invalid"})`,
  );

  if (!passed) {
    console.error(JSON.stringify(errors, null, 2));
  }
}

console.log(
  `\n${cases.length - failures}/${cases.length} issue-code cases passed.`,
);

if (failures > 0) {
  process.exitCode = 1;
}
