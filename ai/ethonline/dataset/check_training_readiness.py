#!/usr/bin/env python3
"""Enforce minimum safety conditions before a PAI corpus can be used for training."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Sequence

from validate_dataset import (
    LocatedRecord,
    build_validation_context,
    discover_dataset_files,
    load_records,
    validate_records,
)


MANAGED_SPLITS = ("train", "validation", "challenge")
REQUIRED_REVIEW_STATUS = "adjudicated"


def assess_training_readiness(
    records: Sequence[LocatedRecord],
    issue_kinds: set[str],
) -> list[str]:
    """Return deterministic readiness failures.

    This gate establishes minimum data-governance and coverage conditions. It does
    not claim that a passing corpus is large, representative, or production-ready.
    """

    failures: list[str] = []
    split_counts: Counter[str] = Counter()
    group_splits: dict[str, set[str]] = defaultdict(set)
    train_issue_kinds: set[str] = set()
    clean_train_records = 0
    issue_train_records = 0

    for located in records:
        value = located.value
        if not isinstance(value, dict):
            continue

        split = value.get("split")
        if split not in MANAGED_SPLITS:
            continue
        split_counts[split] += 1

        metadata = value.get("metadata")
        target = value.get("target")
        if not isinstance(metadata, dict) or not isinstance(target, dict):
            continue

        status = metadata.get("reviewStatus")
        if status != REQUIRED_REVIEW_STATUS:
            failures.append(
                f"{located.label}: reviewStatus is {status!r}; "
                f"training readiness requires {REQUIRED_REVIEW_STATUS!r}"
            )

        if metadata.get("containsPersonalData") is not False:
            failures.append(
                f"{located.label}: containsPersonalData must be false before training"
            )

        group_id = metadata.get("leakageGroupId")
        if isinstance(group_id, str):
            group_splits[group_id].add(split)

        if split != "train":
            continue

        issues = target.get("issues")
        if not isinstance(issues, list):
            continue
        if issues:
            issue_train_records += 1
        else:
            clean_train_records += 1
        train_issue_kinds.update(
            issue["kind"]
            for issue in issues
            if isinstance(issue, dict) and isinstance(issue.get("kind"), str)
        )

    for split in MANAGED_SPLITS:
        if split_counts[split] == 0:
            failures.append(f"required split {split!r} has no records")

    if split_counts["train"] and clean_train_records == 0:
        failures.append("train split has no clean example with an empty issues array")
    if split_counts["train"] and issue_train_records == 0:
        failures.append("train split has no issue-bearing example")

    missing_kinds = sorted(issue_kinds - train_issue_kinds)
    if split_counts["train"] and missing_kinds:
        failures.append(
            "train split does not cover registered issue kinds: " + ", ".join(missing_kinds)
        )

    for group_id, splits in sorted(group_splits.items()):
        if len(splits) > 1:
            failures.append(
                f"leakageGroupId {group_id!r} crosses managed splits: "
                + ", ".join(sorted(splits))
            )

    return failures


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[3],
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        files = discover_dataset_files(args.paths)
        records = [record for path in files for record in load_records(path)]
        if not records:
            raise ValueError("no dataset records found")

        context = build_validation_context(args.repo_root.resolve())
        validation_findings = validate_records(records, context)
        issue_kinds = {definition["kind"] for definition in context.issue_codes.values()}
        readiness_failures = assess_training_readiness(records, issue_kinds)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    split_counts = Counter(
        record.value.get("split", "<invalid>")
        if isinstance(record.value, dict)
        else "<invalid>"
        for record in records
    )
    print(f"Files: {len(files)}")
    print(f"Records: {len(records)}")
    print("Splits: " + ", ".join(f"{name}={count}" for name, count in sorted(split_counts.items())))
    sys.stdout.flush()

    for finding in validation_findings:
        print(f"ERROR: {finding}", file=sys.stderr)
    for failure in readiness_failures:
        print(f"NOT READY: {failure}", file=sys.stderr)

    if validation_findings or readiness_failures:
        print(
            f"Training readiness failed: {len(validation_findings)} validation finding(s), "
            f"{len(readiness_failures)} readiness finding(s).",
            file=sys.stderr,
        )
        return 1

    print("Training readiness gate passed.")
    print("This is a minimum safety gate, not a production-readiness claim.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
