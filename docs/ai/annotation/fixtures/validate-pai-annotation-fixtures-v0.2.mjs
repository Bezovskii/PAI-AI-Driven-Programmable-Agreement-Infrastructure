import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  currentDirectory,
  "pai-annotation-adversarial-v0.2.json",
);
const registryPath = path.resolve(
  currentDirectory,
  "../../schema/pai-issue-codes-v0.2.json",
);
const guidePath = path.resolve(
  currentDirectory,
  "../annotation-guide-v0.2.md",
);

const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const guide = fs.readFileSync(guidePath, "utf8");

const requiredCaseIds = [
  "01_implicit_provider_unstated_payment_parties",
  "02_ambiguous_dollar_currency",
  "03_pricing_currency_without_settlement_asset",
  "04_usdc_without_network",
  "05_named_network_without_canonical_identifiers",
  "06_deposit_milestone_release_and_remainder",
  "07_arithmetic_inconsistency_is_deterministic",
  "08_ambiguous_pronoun_across_milestones",
  "09_approval_without_criteria_or_authority",
  "10_relative_deadline_with_unresolved_anchor",
  "11_explicit_conflicting_deadlines",
  "12_revision_rounds_with_unclear_scope",
  "13_recommended_evidence_is_not_agreed_evidence",
  "14_recurring_retainer_and_dynamic_price",
  "15_nonmonetary_exchange",
  "16_external_registry_fact_is_not_model_contradiction",
];

const pointerPattern = /^\/agreement(?:\/(?:[^~/]|~0|~1)+)*$/;
const codePattern = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const registryByCode = new Map(registry.codes.map((entry) => [entry.code, entry]));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function validateFixtureSet() {
  assert(
    fixtures.fixtureVersion === "pai.annotation-fixtures.v0.2",
    "Unexpected fixtureVersion.",
  );
  assert(
    fixtures.targetSchemaVersion === "pai.agreement.v0.2",
    "Unexpected targetSchemaVersion.",
  );
  assert(
    fixtures.assertionMode === "required_subset",
    "Fixtures must declare required_subset assertion mode.",
  );
  assert(Array.isArray(fixtures.cases), "cases must be an array.");
  assert(
    fixtures.cases.length === requiredCaseIds.length,
    `Expected ${requiredCaseIds.length} cases, received ${fixtures.cases.length}.`,
  );

  const ids = fixtures.cases.map((entry) => entry.id);
  assert(new Set(ids).size === ids.length, "Case IDs must be unique.");
  for (const id of requiredCaseIds) {
    assert(ids.includes(id), `Required case is missing: ${id}`);
  }

  for (const testCase of fixtures.cases) {
    validateCase(testCase);
  }

  for (const heading of [
    "### 7.3 v0.2 completeness profile",
    "### 7.4 Ambiguity versus unresolved reference",
    "## 28. Adversarial cases required before freeze",
  ]) {
    assert(guide.includes(heading), `Guide heading is missing: ${heading}`);
  }
}

function validateCase(testCase) {
  const prefix = testCase.id;
  assert(
    typeof testCase.source === "string" && testCase.source.trim().length > 0,
    `${prefix}: source must be non-empty.`,
  );
  assert(testCase.expected, `${prefix}: expected object is required.`);
  assert(
    testCase.expected.values &&
      !Array.isArray(testCase.expected.values) &&
      typeof testCase.expected.values === "object",
    `${prefix}: expected.values must be an object.`,
  );
  assert(
    Array.isArray(testCase.expected.issues),
    `${prefix}: expected.issues must be an array.`,
  );
  assert(
    Array.isArray(testCase.expected.provenance),
    `${prefix}: expected.provenance must be an array.`,
  );
  assert(
    Array.isArray(testCase.expected.forbiddenIssueCodes),
    `${prefix}: forbiddenIssueCodes must be an array.`,
  );

  for (const pointer of Object.keys(testCase.expected.values)) {
    assert(pointerPattern.test(pointer), `${prefix}: invalid value path ${pointer}`);
  }

  const issueKeys = new Set();
  const expectedCodes = new Set();
  for (const issue of testCase.expected.issues) {
    assert(codePattern.test(issue.code), `${prefix}: malformed issue code ${issue.code}`);
    const registered = registryByCode.get(issue.code);
    assert(registered, `${prefix}: unregistered issue code ${issue.code}`);
    assert(
      issue.kind === registered.kind,
      `${prefix}: ${issue.code} must use kind ${registered.kind}.`,
    );
    assert(
      Array.isArray(issue.paths) && issue.paths.length > 0,
      `${prefix}: ${issue.code} must include paths.`,
    );
    for (const pointer of issue.paths) {
      assert(pointerPattern.test(pointer), `${prefix}: invalid issue path ${pointer}`);
    }
    assert(
      Array.isArray(issue.evidence),
      `${prefix}: ${issue.code} evidence must be an array.`,
    );
    if (registered.evidenceRequired) {
      assert(
        issue.evidence.length > 0,
        `${prefix}: ${issue.code} requires evidence.`,
      );
    }
    for (const quote of issue.evidence) {
      assert(
        typeof quote === "string" && quote.length > 0,
        `${prefix}: issue evidence must be non-empty.`,
      );
      assert(
        testCase.source.includes(quote),
        `${prefix}: issue evidence is not an exact source substring: ${quote}`,
      );
    }

    const issueKey = stable(issue);
    assert(!issueKeys.has(issueKey), `${prefix}: duplicate issue ${issue.code}`);
    issueKeys.add(issueKey);
    expectedCodes.add(issue.code);
  }

  const provenanceKeys = new Set();
  for (const entry of testCase.expected.provenance) {
    assert(pointerPattern.test(entry.path), `${prefix}: invalid provenance path ${entry.path}`);
    assert(
      typeof entry.quote === "string" && entry.quote.length > 0,
      `${prefix}: provenance quote must be non-empty.`,
    );
    assert(
      testCase.source.includes(entry.quote),
      `${prefix}: provenance is not an exact source substring: ${entry.quote}`,
    );
    const provenanceKey = `${entry.path}\u0000${entry.quote}`;
    assert(
      !provenanceKeys.has(provenanceKey),
      `${prefix}: duplicate provenance entry for ${entry.path}`,
    );
    provenanceKeys.add(provenanceKey);
  }

  for (const code of testCase.expected.forbiddenIssueCodes) {
    assert(registryByCode.has(code), `${prefix}: forbidden code is unregistered: ${code}`);
    assert(
      !expectedCodes.has(code),
      `${prefix}: ${code} cannot be both expected and forbidden.`,
    );
  }
}

const checks = [
  {
    name: "fixture_set_is_valid",
    run: validateFixtureSet,
  },
  {
    name: "all_issue_codes_are_registered",
    run() {
      for (const testCase of fixtures.cases) {
        for (const issue of testCase.expected.issues) {
          assert(registryByCode.has(issue.code), `Unregistered issue code: ${issue.code}`);
        }
      }
    },
  },
  {
    name: "all_evidence_is_exact",
    run() {
      for (const testCase of fixtures.cases) {
        for (const issue of testCase.expected.issues) {
          for (const quote of issue.evidence) {
            assert(testCase.source.includes(quote), `${testCase.id}: ${quote}`);
          }
        }
      }
    },
  },
  {
    name: "all_provenance_is_exact",
    run() {
      for (const testCase of fixtures.cases) {
        for (const entry of testCase.expected.provenance) {
          assert(testCase.source.includes(entry.quote), `${testCase.id}: ${entry.quote}`);
        }
      }
    },
  },
  {
    name: "arithmetic_case_forbids_model_contradiction",
    run() {
      const testCase = fixtures.cases.find((entry) => entry.id.startsWith("07_"));
      assert(testCase, "Arithmetic fixture is missing.");
      assert(
        testCase.expected.forbiddenIssueCodes.includes("CONTRADICTORY_PRICE"),
        "Arithmetic fixture must forbid CONTRADICTORY_PRICE.",
      );
    },
  },
  {
    name: "recommended_evidence_remains_empty",
    run() {
      const testCase = fixtures.cases.find((entry) => entry.id.startsWith("13_"));
      assert(testCase, "Recommended-evidence fixture is missing.");
      assert(
        Array.isArray(testCase.expected.values["/agreement/evidenceTerms"]) &&
          testCase.expected.values["/agreement/evidenceTerms"].length === 0,
        "Recommended evidence must not become an agreement evidence term.",
      );
    },
  },
  {
    name: "external_registry_case_forbids_contradiction",
    run() {
      const testCase = fixtures.cases.find((entry) => entry.id.startsWith("16_"));
      assert(testCase, "External-registry fixture is missing.");
      assert(
        testCase.expected.forbiddenIssueCodes.includes(
          "CONTRADICTORY_SETTLEMENT_NETWORK",
        ),
        "External registry mismatch must not become a model contradiction.",
      );
    },
  },
];

let passed = 0;
for (const [index, check] of checks.entries()) {
  try {
    check.run();
    passed += 1;
    console.log(`PASS ${String(index + 1).padStart(2, "0")}_${check.name}`);
  } catch (error) {
    console.error(`FAIL ${String(index + 1).padStart(2, "0")}_${check.name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

console.log(`\n${passed}/${checks.length} annotation-fixture checks passed.`);
if (passed !== checks.length) {
  process.exitCode = 1;
}
