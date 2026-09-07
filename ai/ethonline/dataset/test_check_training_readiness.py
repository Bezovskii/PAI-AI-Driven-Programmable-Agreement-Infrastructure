#!/usr/bin/env python3
"""Focused tests for the PAI training-readiness gate."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_training_readiness import assess_training_readiness  # noqa: E402
from build_seed_corpus import build_records  # noqa: E402
from validate_dataset import LocatedRecord  # noqa: E402


ISSUE_KINDS = {
    "missing_term",
    "ambiguity",
    "contradiction",
    "unresolved_reference",
    "unsupported_term",
}


def record(
    example_id: str,
    split: str,
    group_id: str,
    *,
    status: str = "adjudicated",
    contains_personal_data: bool = False,
    issue_kind: str | None = None,
) -> LocatedRecord:
    issues = [] if issue_kind is None else [{"kind": issue_kind}]
    value = {
        "exampleId": example_id,
        "split": split,
        "metadata": {
            "reviewStatus": status,
            "containsPersonalData": contains_personal_data,
            "leakageGroupId": group_id,
        },
        "target": {"issues": issues},
    }
    return LocatedRecord(Path(f"{split}.jsonl"), 1, value)


def passing_records() -> list[LocatedRecord]:
    records = [
        record("pai_v0_2_train_clean_001", "train", "train_clean"),
        record("pai_v0_2_validation_clean_001", "validation", "validation_clean"),
        record("pai_v0_2_challenge_clean_001", "challenge", "challenge_clean"),
    ]
    records.extend(
        record(
            f"pai_v0_2_train_issue_{index:03d}",
            "train",
            f"train_issue_{index:03d}",
            issue_kind=kind,
        )
        for index, kind in enumerate(sorted(ISSUE_KINDS), start=1)
    )
    return records


class TrainingReadinessTests(unittest.TestCase):
    def test_accepts_minimum_adjudicated_corpus(self) -> None:
        self.assertEqual(assess_training_readiness(passing_records(), ISSUE_KINDS), [])

    def test_rejects_non_adjudicated_record(self) -> None:
        records = passing_records()
        records[0].value["metadata"]["reviewStatus"] = "reviewed"
        failures = assess_training_readiness(records, ISSUE_KINDS)
        self.assertTrue(any("requires 'adjudicated'" in failure for failure in failures))

    def test_rejects_personal_data(self) -> None:
        records = passing_records()
        records[0].value["metadata"]["containsPersonalData"] = True
        failures = assess_training_readiness(records, ISSUE_KINDS)
        self.assertTrue(any("containsPersonalData" in failure for failure in failures))

    def test_rejects_missing_held_out_split(self) -> None:
        records = [record for record in passing_records() if record.value["split"] != "challenge"]
        failures = assess_training_readiness(records, ISSUE_KINDS)
        self.assertIn("required split 'challenge' has no records", failures)

    def test_rejects_missing_train_issue_kind(self) -> None:
        records = [
            record
            for record in passing_records()
            if not any(
                issue.get("kind") == "unsupported_term"
                for issue in record.value["target"]["issues"]
            )
        ]
        failures = assess_training_readiness(records, ISSUE_KINDS)
        self.assertIn(
            "train split does not cover registered issue kinds: unsupported_term",
            failures,
        )

    def test_rejects_leakage_group_crossing_splits(self) -> None:
        records = passing_records()
        records[1].value["metadata"]["leakageGroupId"] = "train_clean"
        failures = assess_training_readiness(records, ISSUE_KINDS)
        self.assertTrue(any("crosses managed splits" in failure for failure in failures))

    def test_rejects_draft_seed_corpus(self) -> None:
        records = [
            LocatedRecord(Path("seed.jsonl"), index, value)
            for index, value in enumerate(build_records(), start=1)
        ]
        failures = assess_training_readiness(records, ISSUE_KINDS)
        self.assertTrue(any("requires 'adjudicated'" in failure for failure in failures))
        self.assertTrue(any("registered issue kinds" in failure for failure in failures))


if __name__ == "__main__":
    unittest.main()
