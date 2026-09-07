#!/usr/bin/env python3
"""Create and apply hash-bound human review decisions for a PAI dataset."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Sequence

from validate_dataset import (
    LocatedRecord,
    build_validation_context,
    discover_dataset_files,
    load_records,
    validate_records,
)


DECISION_VERSION = "pai.dataset-review-decision.v0.1"
DECISION_FIELDS = (
    "decisionVersion",
    "exampleId",
    "recordSha256",
    "split",
    "decision",
    "reviewer",
    "reviewedAt",
    "notes",
)
ALLOWED_DECISIONS = {"pending", "adjudicate", "reject"}


@dataclass(frozen=True)
class ReviewDecision:
    example_id: str
    record_sha256: str
    split: str
    decision: str
    reviewer: str
    reviewed_at: str
    notes: str


def canonical_record_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def record_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_record_bytes(value)).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_validated_records(paths: Sequence[Path], repo_root: Path) -> list[LocatedRecord]:
    files = discover_dataset_files(paths)
    records = [record for path in files for record in load_records(path)]
    if not records:
        raise ValueError("no dataset records found")
    context = build_validation_context(repo_root)
    findings = validate_records(records, context)
    if findings:
        rendered = "\n".join(f"- {finding}" for finding in findings)
        raise ValueError(f"dataset validation failed:\n{rendered}")
    return records


def create_review_queue(records: Sequence[LocatedRecord], output: Path) -> None:
    if output.exists():
        raise ValueError(f"review queue already exists: {output}")

    seen_ids: set[str] = set()
    rows: list[dict[str, str]] = []
    for record in records:
        if not record.example_id or not isinstance(record.value, dict):
            raise ValueError(f"record without exampleId: {record.label}")
        if record.example_id in seen_ids:
            raise ValueError(f"duplicate exampleId: {record.example_id}")
        seen_ids.add(record.example_id)
        rows.append(
            {
                "decisionVersion": DECISION_VERSION,
                "exampleId": record.example_id,
                "recordSha256": record_sha256(record.value),
                "split": record.value["split"],
                "decision": "pending",
                "reviewer": "",
                "reviewedAt": "",
                "notes": "",
            }
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=DECISION_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda row: row["exampleId"]))


def _validate_review_timestamp(value: str, example_id: str) -> None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(
            f"{example_id}: reviewedAt must be an ISO 8601 timestamp"
        ) from error
    if parsed.tzinfo is None:
        raise ValueError(f"{example_id}: reviewedAt must include a UTC offset")


def load_review_decisions(path: Path) -> dict[str, ReviewDecision]:
    decisions: dict[str, ReviewDecision] = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames or ()) != DECISION_FIELDS:
            raise ValueError(
                "review decision columns must exactly match: " + ", ".join(DECISION_FIELDS)
            )
        for line_number, row in enumerate(reader, start=2):
            if row["decisionVersion"] != DECISION_VERSION:
                raise ValueError(
                    f"{path}:{line_number}: unsupported decisionVersion "
                    f"{row['decisionVersion']!r}"
                )
            example_id = row["exampleId"].strip()
            if not example_id:
                raise ValueError(f"{path}:{line_number}: exampleId is required")
            if example_id in decisions:
                raise ValueError(f"{path}:{line_number}: duplicate exampleId {example_id}")

            decision = row["decision"].strip()
            if decision not in ALLOWED_DECISIONS:
                raise ValueError(
                    f"{example_id}: decision must be one of {sorted(ALLOWED_DECISIONS)}"
                )
            reviewer = row["reviewer"].strip()
            reviewed_at = row["reviewedAt"].strip()
            notes = row["notes"].strip()
            if decision != "pending":
                if not reviewer:
                    raise ValueError(f"{example_id}: reviewer is required")
                if not reviewed_at:
                    raise ValueError(f"{example_id}: reviewedAt is required")
                _validate_review_timestamp(reviewed_at, example_id)
            if decision == "reject" and not notes:
                raise ValueError(f"{example_id}: rejected records require notes")

            decisions[example_id] = ReviewDecision(
                example_id=example_id,
                record_sha256=row["recordSha256"].strip(),
                split=row["split"].strip(),
                decision=decision,
                reviewer=reviewer,
                reviewed_at=reviewed_at,
                notes=notes,
            )
    if not decisions:
        raise ValueError("review decision file has no records")
    return decisions


def apply_review_decisions(
    records: Sequence[LocatedRecord],
    decisions: dict[str, ReviewDecision],
) -> tuple[list[dict[str, Any]], Counter[str]]:
    by_id = {record.example_id: record for record in records if record.example_id}
    missing = sorted(set(by_id) - set(decisions))
    extra = sorted(set(decisions) - set(by_id))
    if missing:
        raise ValueError("missing review decisions for: " + ", ".join(missing))
    if extra:
        raise ValueError("review decisions reference unknown records: " + ", ".join(extra))

    pending = sorted(
        example_id
        for example_id, decision in decisions.items()
        if decision.decision == "pending"
    )
    if pending:
        raise ValueError("pending review decisions remain for: " + ", ".join(pending))

    output: list[dict[str, Any]] = []
    decision_counts: Counter[str] = Counter()
    for example_id in sorted(by_id):
        record = by_id[example_id]
        decision = decisions[example_id]
        if not isinstance(record.value, dict):
            raise ValueError(f"record is not an object: {record.label}")
        if decision.record_sha256 != record_sha256(record.value):
            raise ValueError(f"{example_id}: stale decision; record SHA-256 does not match")
        if decision.split != record.value["split"]:
            raise ValueError(f"{example_id}: decision split does not match record split")

        decision_counts[decision.decision] += 1
        if decision.decision == "reject":
            continue
        approved = copy.deepcopy(record.value)
        approved["metadata"]["reviewStatus"] = "adjudicated"
        output.append(approved)
    return output, decision_counts


def write_adjudicated_corpus(
    records: Sequence[dict[str, Any]],
    decisions_path: Path,
    decision_counts: Counter[str],
    output_dir: Path,
) -> None:
    if output_dir.exists() and any(output_dir.iterdir()):
        raise ValueError(f"output directory is not empty: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    split_counts: Counter[str] = Counter()
    by_split: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        split = record["split"]
        split_counts[split] += 1
        by_split.setdefault(split, []).append(record)

    for split, split_records in sorted(by_split.items()):
        path = output_dir / f"{split}.jsonl"
        with path.open("w", encoding="utf-8", newline="\n") as handle:
            for record in sorted(split_records, key=lambda value: value["exampleId"]):
                handle.write(
                    json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
                    + "\n"
                )

    manifest = {
        "workflowVersion": DECISION_VERSION,
        "decisionFileSha256": file_sha256(decisions_path),
        "decisionCounts": dict(sorted(decision_counts.items())),
        "recordCount": len(records),
        "reviewStatus": "adjudicated",
        "splitCounts": dict(sorted(split_counts.items())),
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[3],
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser("create", help="create a pending CSV review queue")
    create.add_argument("paths", nargs="+", type=Path)
    create.add_argument("--output", required=True, type=Path)

    apply = subparsers.add_parser("apply", help="apply complete human review decisions")
    apply.add_argument("paths", nargs="+", type=Path)
    apply.add_argument("--decisions", required=True, type=Path)
    apply.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        records = load_validated_records(args.paths, args.repo_root.resolve())
        if args.command == "create":
            create_review_queue(records, args.output)
            print(f"Review queue: {args.output.resolve()}")
            print(f"Records: {len(records)}")
            return 0

        decisions = load_review_decisions(args.decisions)
        approved, counts = apply_review_decisions(records, decisions)
        write_adjudicated_corpus(
            approved,
            args.decisions,
            counts,
            args.output_dir,
        )
        print(f"Adjudicated corpus: {args.output_dir.resolve()}")
        print("Decisions: " + ", ".join(f"{key}={value}" for key, value in sorted(counts.items())))
        print(f"Records: {len(approved)}")
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
