#!/usr/bin/env python3
"""Focused tests for the deterministic seed corpus builder."""

from __future__ import annotations

import sys
import unittest
from collections import Counter, defaultdict
from pathlib import Path


DATASET_DIR = Path(__file__).resolve().parent
REPO_ROOT = DATASET_DIR.parents[2]
sys.path.insert(0, str(DATASET_DIR))

from build_seed_corpus import build_records  # noqa: E402
from validate_dataset import (  # noqa: E402
    LocatedRecord,
    build_validation_context,
    validate_records,
)


class SeedCorpusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.records = build_records()

    def test_expected_split_counts(self) -> None:
        self.assertEqual(Counter(record["split"] for record in self.records), {"train": 16, "validation": 4, "challenge": 4})

    def test_example_ids_are_unique(self) -> None:
        ids = [record["exampleId"] for record in self.records]
        self.assertEqual(len(ids), len(set(ids)))

    def test_families_do_not_cross_splits(self) -> None:
        family_splits: dict[str, set[str]] = defaultdict(set)
        for record in self.records:
            family_splits[record["metadata"]["leakageGroupId"]].add(record["split"])
        self.assertTrue(all(len(splits) == 1 for splits in family_splits.values()))

    def test_all_records_are_explicitly_draft(self) -> None:
        self.assertTrue(all(record["metadata"]["reviewStatus"] == "draft" for record in self.records))

    def test_validation_and_challenge_have_no_train_parents(self) -> None:
        held_out = [record for record in self.records if record["split"] != "train"]
        self.assertTrue(all(not record["metadata"]["parentExampleIds"] for record in held_out))

    def test_schema_semantics_and_leakage_validation(self) -> None:
        context = build_validation_context(REPO_ROOT)
        located = [LocatedRecord(Path("generated-seed.jsonl"), index, record) for index, record in enumerate(self.records, 1)]
        self.assertEqual(validate_records(located, context), [])

    def test_issue_seed_coverage(self) -> None:
        codes = Counter(
            issue["code"]
            for record in self.records
            for issue in record["target"]["issues"]
        )
        self.assertEqual(
            codes,
            {
                "AMBIGUOUS_CURRENCY": 4,
                "MISSING_ACCEPTANCE_CRITERIA": 6,
                "CONTRADICTORY_DEADLINE": 2,
                "UNRESOLVED_PRONOUN": 2,
                "UNSUPPORTED_DYNAMIC_PRICING": 2,
                "UNSUPPORTED_RECURRING_RETAINER": 2,
            },
        )


if __name__ == "__main__":
    unittest.main()
