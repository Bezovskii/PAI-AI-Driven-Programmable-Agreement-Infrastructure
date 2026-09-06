#!/usr/bin/env python3
"""Validate PAI v0.2 training/evaluation datasets and leakage boundaries."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource


TRAINING_SCHEMA = "docs/ai/schema/pai-training-example-v0.2.schema.json"
MODEL_OUTPUT_SCHEMA = "docs/ai/schema/pai-model-output-v0.2.schema.json"
AGREEMENT_SCHEMA = "docs/ai/schema/pai-agreement-v0.2.schema.json"
ISSUE_REGISTRY = "docs/ai/schema/pai-issue-codes-v0.2.json"
DATASET_METADATA_FILES = {"manifest.json"}


@dataclass(frozen=True)
class LocatedRecord:
    source: Path
    line: int | None
    value: Any

    @property
    def example_id(self) -> str | None:
        if isinstance(self.value, dict) and isinstance(self.value.get("exampleId"), str):
            return self.value["exampleId"]
        return None

    @property
    def label(self) -> str:
        location = f"{self.source}:{self.line}" if self.line is not None else str(self.source)
        return f"{location} [{self.example_id}]" if self.example_id else location


@dataclass(frozen=True)
class Finding:
    record: LocatedRecord
    message: str

    def __str__(self) -> str:
        return f"{self.record.label}: {self.message}"


@dataclass(frozen=True)
class ValidationContext:
    validator: Draft202012Validator
    issue_codes: dict[str, dict[str, Any]]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_validation_context(repo_root: Path) -> ValidationContext:
    agreement_schema = load_json(repo_root / AGREEMENT_SCHEMA)
    model_output_schema = load_json(repo_root / MODEL_OUTPUT_SCHEMA)
    training_schema = load_json(repo_root / TRAINING_SCHEMA)
    issue_registry = load_json(repo_root / ISSUE_REGISTRY)

    Draft202012Validator.check_schema(agreement_schema)
    Draft202012Validator.check_schema(model_output_schema)
    Draft202012Validator.check_schema(training_schema)

    registry = Registry().with_resources(
        [
            (
                schema["$id"],
                Resource.from_contents(schema),
            )
            for schema in (agreement_schema, model_output_schema)
        ]
    )
    validator = Draft202012Validator(
        training_schema,
        registry=registry,
        format_checker=FormatChecker(),
    )
    issue_codes = {entry["code"]: entry for entry in issue_registry["codes"]}
    return ValidationContext(validator=validator, issue_codes=issue_codes)


def discover_dataset_files(inputs: Sequence[Path]) -> list[Path]:
    discovered: set[Path] = set()
    for input_path in inputs:
        path = input_path.resolve()
        if path.is_dir():
            discovered.update(candidate for candidate in path.rglob("*.jsonl") if candidate.is_file())
            discovered.update(
                candidate
                for candidate in path.rglob("*.json")
                if candidate.is_file() and candidate.name not in DATASET_METADATA_FILES
            )
        elif path.is_file():
            discovered.add(path)
        else:
            raise ValueError(f"dataset path does not exist: {input_path}")
    return sorted(discovered)


def load_records(path: Path) -> list[LocatedRecord]:
    if path.suffix == ".jsonl":
        records: list[LocatedRecord] = []
        with path.open("r", encoding="utf-8") as handle:
            for line_number, raw_line in enumerate(handle, start=1):
                if not raw_line.strip():
                    continue
                try:
                    value = json.loads(raw_line)
                except json.JSONDecodeError as error:
                    raise ValueError(f"{path}:{line_number}: invalid JSON: {error}") from error
                records.append(LocatedRecord(path, line_number, value))
        return records

    value = load_json(path)
    if isinstance(value, list):
        return [LocatedRecord(path, index, record) for index, record in enumerate(value, start=1)]
    if isinstance(value, dict) and isinstance(value.get("records"), list):
        return [
            LocatedRecord(path, index, record)
            for index, record in enumerate(value["records"], start=1)
        ]
    return [LocatedRecord(path, None, value)]


def _json_path(parts: Iterable[Any]) -> str:
    rendered = "/".join(str(part).replace("~", "~0").replace("/", "~1") for part in parts)
    return f"/{rendered}" if rendered else "/"


def _path_matches_prefix(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(prefix + "/")


def _normalized_text_fingerprint(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    normalized = re.sub(r"\s+", " ", normalized).strip().casefold()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def validate_record(record: LocatedRecord, context: ValidationContext) -> list[Finding]:
    findings: list[Finding] = []
    errors = sorted(
        context.validator.iter_errors(record.value),
        key=lambda error: _json_path(error.absolute_path),
    )
    for error in errors:
        findings.append(
            Finding(record, f"schema {_json_path(error.absolute_path)}: {error.message}")
        )
    if errors or not isinstance(record.value, dict):
        return findings

    source_text = record.value["input"]["text"]
    target = record.value["target"]

    for index, entry in enumerate(target["provenance"]):
        quote = entry["quote"]
        if quote not in source_text:
            findings.append(
                Finding(
                    record,
                    f"provenance /target/provenance/{index}/quote is absent from input.text: {quote!r}",
                )
            )

    for index, issue in enumerate(target["issues"]):
        code = issue["code"]
        definition = context.issue_codes.get(code)
        if definition is None:
            findings.append(Finding(record, f"issue /target/issues/{index} uses unknown code {code}"))
            continue
        if issue["kind"] != definition["kind"]:
            findings.append(
                Finding(
                    record,
                    f"issue {code} kind {issue['kind']!r} does not match registry kind {definition['kind']!r}",
                )
            )
        if definition["evidenceRequired"] and not issue["evidence"]:
            findings.append(Finding(record, f"issue {code} requires non-empty evidence"))
        for quote in issue["evidence"]:
            if quote not in source_text:
                findings.append(
                    Finding(record, f"issue {code} evidence is absent from input.text: {quote!r}")
                )
        for path in issue["paths"]:
            if not any(
                _path_matches_prefix(path, prefix) for prefix in definition["pathPrefixes"]
            ):
                findings.append(
                    Finding(
                        record,
                        f"issue {code} path {path!r} is outside registry prefixes {definition['pathPrefixes']}",
                    )
                )
    return findings


def validate_records(
    records: Sequence[LocatedRecord], context: ValidationContext
) -> list[Finding]:
    findings: list[Finding] = []
    by_id: dict[str, LocatedRecord] = {}
    group_splits: dict[str, dict[str, LocatedRecord]] = defaultdict(dict)
    text_splits: dict[str, dict[str, LocatedRecord]] = defaultdict(dict)

    for record in records:
        findings.extend(validate_record(record, context))
        if not isinstance(record.value, dict):
            continue

        example_id = record.example_id
        if example_id:
            if example_id in by_id:
                findings.append(
                    Finding(record, f"duplicate exampleId; first seen at {by_id[example_id].label}")
                )
            else:
                by_id[example_id] = record

        split = record.value.get("split")
        metadata = record.value.get("metadata")
        input_value = record.value.get("input")
        if not isinstance(split, str) or not isinstance(metadata, dict):
            continue

        group_id = metadata.get("leakageGroupId")
        if isinstance(group_id, str):
            group_splits[group_id].setdefault(split, record)

        if isinstance(input_value, dict) and isinstance(input_value.get("text"), str):
            fingerprint = _normalized_text_fingerprint(input_value["text"])
            text_splits[fingerprint].setdefault(split, record)

    for group_id, splits in sorted(group_splits.items()):
        if len(splits) > 1:
            rendered = ", ".join(
                f"{split} at {record.label}" for split, record in sorted(splits.items())
            )
            findings.append(
                Finding(next(iter(splits.values())), f"leakageGroupId {group_id!r} crosses splits: {rendered}")
            )

    for splits in text_splits.values():
        if len(splits) > 1:
            rendered = ", ".join(
                f"{split} at {record.label}" for split, record in sorted(splits.items())
            )
            findings.append(
                Finding(
                    next(iter(splits.values())),
                    f"normalized input text crosses splits: {rendered}",
                )
            )

    for record in records:
        if not isinstance(record.value, dict) or not record.example_id:
            continue
        split = record.value.get("split")
        metadata = record.value.get("metadata")
        if not isinstance(metadata, dict):
            continue
        for parent_id in metadata.get("parentExampleIds", []):
            parent = by_id.get(parent_id)
            if parent is not None and parent.value.get("split") != split:
                findings.append(
                    Finding(
                        record,
                        f"parentExampleId {parent_id!r} crosses from {parent.value.get('split')!r} into {split!r}",
                    )
                )

    return findings


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="JSON/JSONL dataset files or directories")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[3],
        help="Repository root containing docs/ai/schema",
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
        findings = validate_records(records, context)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    counts = Counter(
        record.value.get("split", "<invalid>")
        if isinstance(record.value, dict)
        else "<invalid>"
        for record in records
    )
    print(f"Files: {len(files)}")
    print(f"Records: {len(records)}")
    print("Splits: " + ", ".join(f"{name}={count}" for name, count in sorted(counts.items())))
    if findings:
        for finding in findings:
            print(f"ERROR: {finding}", file=sys.stderr)
        print(f"Dataset validation failed with {len(findings)} finding(s).", file=sys.stderr)
        return 1

    print("Dataset validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
