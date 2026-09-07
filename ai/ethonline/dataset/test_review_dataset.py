#!/usr/bin/env python3
"""Focused tests for hash-bound PAI dataset review decisions."""

from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from review_dataset import (  # noqa: E402
    DECISION_FIELDS,
    DECISION_VERSION,
    apply_review_decisions,
    create_review_queue,
    load_review_decisions,
    record_sha256,
    write_adjudicated_corpus,
)
from validate_dataset import LocatedRecord  # noqa: E402


def located(example_id: str, split: str = "train") -> LocatedRecord:
    value = {
        "exampleId": example_id,
        "split": split,
        "metadata": {
            "reviewStatus": "draft",
            "containsPersonalData": False,
        },
        "target": {"issues": []},
    }
    return LocatedRecord(Path(f"{split}.jsonl"), 1, value)


def write_decisions(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=DECISION_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def decision_row(
    record: LocatedRecord,
    decision: str = "adjudicate",
    *,
    digest: str | None = None,
) -> dict[str, str]:
    return {
        "decisionVersion": DECISION_VERSION,
        "exampleId": record.example_id or "",
        "recordSha256": digest or record_sha256(record.value),
        "split": record.value["split"],
        "decision": decision,
        "reviewer": "Human Reviewer" if decision != "pending" else "",
        "reviewedAt": "2026-09-07T12:00:00+03:00" if decision != "pending" else "",
        "notes": "Incorrect target" if decision == "reject" else "",
    }


class ReviewDatasetTests(unittest.TestCase):
    def test_record_hash_is_independent_of_object_key_order(self) -> None:
        self.assertEqual(record_sha256({"b": 2, "a": 1}), record_sha256({"a": 1, "b": 2}))

    def test_create_queue_is_sorted_and_pending(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "review.csv"
            create_review_queue(
                [located("pai_v0_2_train_z_001"), located("pai_v0_2_train_a_001")],
                output,
            )
            with output.open(encoding="utf-8", newline="") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(
                [row["exampleId"] for row in rows],
                ["pai_v0_2_train_a_001", "pai_v0_2_train_z_001"],
            )
            self.assertTrue(all(row["decision"] == "pending" for row in rows))

    def test_create_queue_refuses_to_overwrite_existing_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "review.csv"
            output.write_text("human review in progress\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "already exists"):
                create_review_queue([located("pai_v0_2_train_a_001")], output)
            self.assertEqual(
                output.read_text(encoding="utf-8"),
                "human review in progress\n",
            )

    def test_load_rejects_naive_review_timestamp(self) -> None:
        record = located("pai_v0_2_train_a_001")
        row = decision_row(record)
        row["reviewedAt"] = "2026-09-07T12:00:00"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.csv"
            write_decisions(path, [row])
            with self.assertRaisesRegex(ValueError, "UTC offset"):
                load_review_decisions(path)

    def test_load_rejects_rejection_without_notes(self) -> None:
        record = located("pai_v0_2_train_a_001")
        row = decision_row(record, "reject")
        row["notes"] = ""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.csv"
            write_decisions(path, [row])
            with self.assertRaisesRegex(ValueError, "require notes"):
                load_review_decisions(path)

    def test_apply_rejects_pending_decisions(self) -> None:
        record = located("pai_v0_2_train_a_001")
        decision = decision_row(record, "pending")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.csv"
            write_decisions(path, [decision])
            loaded = load_review_decisions(path)
            with self.assertRaisesRegex(ValueError, "pending review decisions"):
                apply_review_decisions([record], loaded)

    def test_apply_rejects_stale_record_hash(self) -> None:
        record = located("pai_v0_2_train_a_001")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.csv"
            write_decisions(path, [decision_row(record, digest="0" * 64)])
            loaded = load_review_decisions(path)
            with self.assertRaisesRegex(ValueError, "stale decision"):
                apply_review_decisions([record], loaded)

    def test_apply_rejects_missing_decision(self) -> None:
        first = located("pai_v0_2_train_a_001")
        second = located("pai_v0_2_train_b_001")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.csv"
            write_decisions(path, [decision_row(first)])
            loaded = load_review_decisions(path)
            with self.assertRaisesRegex(ValueError, "missing review decisions"):
                apply_review_decisions([first, second], loaded)

    def test_apply_adjudicates_approved_and_excludes_rejected(self) -> None:
        approved = located("pai_v0_2_train_a_001")
        rejected = located("pai_v0_2_validation_b_001", "validation")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.csv"
            write_decisions(
                path,
                [decision_row(approved), decision_row(rejected, "reject")],
            )
            loaded = load_review_decisions(path)
            records, counts = apply_review_decisions([approved, rejected], loaded)
            self.assertEqual([record["exampleId"] for record in records], [approved.example_id])
            self.assertEqual(records[0]["metadata"]["reviewStatus"], "adjudicated")
            self.assertEqual(counts, {"adjudicate": 1, "reject": 1})
            self.assertEqual(approved.value["metadata"]["reviewStatus"], "draft")

    def test_write_corpus_records_manifest_and_refuses_overwrite(self) -> None:
        record = located("pai_v0_2_train_a_001").value
        record["metadata"]["reviewStatus"] = "adjudicated"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            decisions = root / "review.csv"
            decisions.write_text("review evidence\n", encoding="utf-8")
            output = root / "adjudicated"
            write_adjudicated_corpus(
                [record],
                decisions,
                {"adjudicate": 1},
                output,
            )
            manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["recordCount"], 1)
            self.assertEqual(manifest["reviewStatus"], "adjudicated")
            with self.assertRaisesRegex(ValueError, "not empty"):
                write_adjudicated_corpus(
                    [record],
                    decisions,
                    {"adjudicate": 1},
                    output,
                )


if __name__ == "__main__":
    unittest.main()
