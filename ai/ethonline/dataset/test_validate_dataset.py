#!/usr/bin/env python3
"""Focused tests for the PAI dataset integrity validator."""

from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from validate_dataset import (  # noqa: E402
    LocatedRecord,
    build_validation_context,
    discover_dataset_files,
    validate_records,
)


REPO_ROOT = Path(__file__).resolve().parents[3]


def empty_agreement() -> dict:
    return {
        "parties": [],
        "scope": {"summary": None, "deliverables": [], "exclusions": []},
        "pricing": {"total": None, "settlementAsset": None},
        "milestones": [],
        "payments": [],
        "revisionTerms": [],
        "evidenceTerms": [],
        "disputeTerms": {
            "enabled": None,
            "resolver": None,
            "initiationConditions": [],
            "evidenceWindow": None,
            "resolutionOptions": [],
        },
    }


def example(
    example_id: str = "pai_v0_2_train_basic_001",
    split: str = "train",
    group_id: str = "basic_001",
    text: str = "Build a website.",
) -> dict:
    return {
        "recordVersion": "pai.training-example.v0.2",
        "exampleId": example_id,
        "task": "agreement_extraction",
        "split": split,
        "input": {"text": text, "language": "en", "format": "plain_text"},
        "trustedContext": {"facts": []},
        "target": {
            "schemaVersion": "pai.agreement.v0.2",
            "agreement": empty_agreement(),
            "issues": [],
            "provenance": [],
        },
        "metadata": {
            "difficulty": "basic",
            "phenomena": ["scope"],
            "origin": "hand_authored_fixture",
            "generator": None,
            "parentExampleIds": [],
            "reviewStatus": "reviewed",
            "leakageGroupId": group_id,
            "sourceLicense": None,
            "containsPersonalData": False,
            "notes": [],
        },
    }


def located(value: dict, line: int = 1) -> LocatedRecord:
    return LocatedRecord(Path("test.jsonl"), line, value)


class DatasetValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.context = build_validation_context(REPO_ROOT)

    def messages(self, *values: dict) -> list[str]:
        return [
            finding.message
            for finding in validate_records(
                [located(value, index) for index, value in enumerate(values, start=1)],
                self.context,
            )
        ]

    def test_accepts_minimal_valid_record(self) -> None:
        self.assertEqual(self.messages(example()), [])

    def test_rejects_fabricated_provenance_quote(self) -> None:
        value = example()
        value["target"]["provenance"] = [
            {"path": "/agreement/scope/summary", "quote": "Build a mobile app"}
        ]
        self.assertTrue(any("provenance" in message and "absent" in message for message in self.messages(value)))

    def test_rejects_issue_kind_mismatch(self) -> None:
        value = example(text="Build a website or mobile app.")
        value["target"]["issues"] = [
            {
                "kind": "contradiction",
                "code": "AMBIGUOUS_SCOPE",
                "paths": ["/agreement/scope"],
                "evidence": ["website or mobile app"],
            }
        ]
        self.assertTrue(any("does not match registry kind" in message for message in self.messages(value)))

    def test_rejects_issue_path_outside_registry_prefix(self) -> None:
        value = example(text="Build a website or mobile app.")
        value["target"]["issues"] = [
            {
                "kind": "ambiguity",
                "code": "AMBIGUOUS_SCOPE",
                "paths": ["/agreement/pricing"],
                "evidence": ["website or mobile app"],
            }
        ]
        self.assertTrue(any("outside registry prefixes" in message for message in self.messages(value)))

    def test_rejects_leakage_group_crossing_splits(self) -> None:
        train = example()
        test = example("pai_v0_2_test_basic_001", "test", "basic_001", "Create a website.")
        self.assertTrue(any("leakageGroupId" in message and "crosses splits" in message for message in self.messages(train, test)))

    def test_rejects_normalized_input_crossing_splits(self) -> None:
        train = example(text="Build a website.")
        test = example("pai_v0_2_test_other_001", "test", "other_001", "  BUILD   A WEBSITE. ")
        self.assertTrue(any("normalized input text crosses splits" in message for message in self.messages(train, test)))

    def test_rejects_duplicate_example_id(self) -> None:
        first = example(text="Build a website.")
        second = copy.deepcopy(first)
        second["input"]["text"] = "Build a landing page."
        self.assertTrue(any("duplicate exampleId" in message for message in self.messages(first, second)))

    def test_directory_discovery_ignores_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "manifest.json").write_text(
                json.dumps({"corpusVersion": "pai.seed-corpus.v0.1"}),
                encoding="utf-8",
            )
            records = root / "train.jsonl"
            records.write_text(json.dumps(example()) + "\n", encoding="utf-8")
            self.assertEqual(discover_dataset_files([root]), [records.resolve()])


if __name__ == "__main__":
    unittest.main()
