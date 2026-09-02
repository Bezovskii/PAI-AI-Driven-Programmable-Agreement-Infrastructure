import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  currentDirectory,
  "pai-evaluation-adversarial-v0.2.json",
);
const rubricPath = path.resolve(
  currentDirectory,
  "../evaluation-rubric-v0.2.md",
);

const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const rubric = fs.readFileSync(rubricPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nearlyEqual(left, right, tolerance = 1e-9) {
  return Math.abs(left - right) <= tolerance;
}

function score(testCase) {
  if (!testCase.structuralValid) {
    return 0;
  }

  const metrics = testCase.metrics;
  const weights = fixtures.weights;
  const raw =
    metrics.factF1 * weights.factF1 +
    metrics.issueF1 * weights.issueF1 +
    metrics.issueEvidenceF1 * weights.issueEvidenceF1 +
    metrics.provenanceF1 * weights.provenanceF1 +
    metrics.groundingRate * weights.groundingRate +
    metrics.boundaryPoints * weights.boundaryPoints +
    metrics.contextPoints * weights.contextPoints;

  let cap = 100;
  for (const violation of testCase.violations) {
    assert(
      Object.hasOwn(fixtures.violationCaps, violation),
      `${testCase.id}: unknown violation ${violation}`,
    );
    cap = Math.min(cap, fixtures.violationCaps[violation]);
  }
  return Math.min(raw, cap);
}

function improvementEligible(testCase) {
  const [lowerBound] = testCase.confidenceInterval;
  return (
    testCase.deltaPoints >= 3 &&
    lowerBound > 0 &&
    !testCase.factRegressed &&
    !testCase.issueRegressed &&
    !testCase.provenanceRegressed &&
    !testCase.criticalViolationRateIncreased
  );
}

function leakageValid(testCase) {
  const splitsByGroup = new Map();
  for (const record of testCase.records) {
    if (!splitsByGroup.has(record.group)) {
      splitsByGroup.set(record.group, new Set());
    }
    splitsByGroup.get(record.group).add(record.split);
  }
  return [...splitsByGroup.values()].every((splits) => splits.size === 1);
}

const checks = [];

checks.push({
  name: "fixture_metadata_and_weights",
  run() {
    assert(
      fixtures.fixtureVersion === "pai.evaluation-fixtures.v0.2",
      "Unexpected fixtureVersion.",
    );
    assert(
      fixtures.rubricVersion === "pai.evaluation-rubric.v0.2",
      "Unexpected rubricVersion.",
    );
    const maximumScore =
      fixtures.weights.factF1 +
      fixtures.weights.issueF1 +
      fixtures.weights.issueEvidenceF1 +
      fixtures.weights.provenanceF1 +
      fixtures.weights.groundingRate +
      15 * fixtures.weights.boundaryPoints +
      5 * fixtures.weights.contextPoints;
    assert(maximumScore === 100, "Configured dimensions must total 100 points.");
    assert(
      fixtures.weights.boundaryPoints === 1 &&
        fixtures.weights.contextPoints === 1,
      "Point-valued dimensions must use multiplier 1.",
    );
  },
});

for (const testCase of fixtures.scoreCases) {
  checks.push({
    name: `score_${testCase.id}`,
    run() {
      for (const name of [
        "factF1",
        "issueF1",
        "issueEvidenceF1",
        "provenanceF1",
        "groundingRate",
      ]) {
        assert(
          testCase.metrics[name] >= 0 && testCase.metrics[name] <= 1,
          `${testCase.id}: ${name} must be in [0, 1].`,
        );
      }
      assert(
        testCase.metrics.boundaryPoints >= 0 &&
          testCase.metrics.boundaryPoints <= 15,
        `${testCase.id}: boundaryPoints must be in [0, 15].`,
      );
      assert(
        testCase.metrics.contextPoints >= 0 &&
          testCase.metrics.contextPoints <= 5,
        `${testCase.id}: contextPoints must be in [0, 5].`,
      );
      const received = score(testCase);
      assert(
        nearlyEqual(received, testCase.expectedScore),
        `${testCase.id}: expected ${testCase.expectedScore}, received ${received}.`,
      );
    },
  });
}

for (const testCase of fixtures.comparisonCases) {
  checks.push({
    name: `comparison_${testCase.id}`,
    run() {
      const received = improvementEligible(testCase);
      assert(
        received === testCase.expectedEligible,
        `${testCase.id}: expected ${testCase.expectedEligible}, received ${received}.`,
      );
    },
  });
}

for (const testCase of fixtures.leakageCases) {
  checks.push({
    name: `leakage_${testCase.id}`,
    run() {
      const received = leakageValid(testCase);
      assert(
        received === testCase.expectedValid,
        `${testCase.id}: expected ${testCase.expectedValid}, received ${received}.`,
      );
    },
  });
}

checks.push({
  name: "rubric_contains_red_team_rules",
  run() {
    for (const requiredText of [
      "### 8.6 Root-cause grouping and primary composite",
      "paired bootstrap resampling over leakage groups",
      "### 10.7 Operational metrics",
      "## 9. Critical violations and score caps",
    ]) {
      assert(rubric.includes(requiredText), `Rubric text is missing: ${requiredText}`);
    }
  },
});

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

console.log(`\n${passed}/${checks.length} evaluation-rubric checks passed.`);
if (passed !== checks.length) {
  process.exitCode = 1;
}
