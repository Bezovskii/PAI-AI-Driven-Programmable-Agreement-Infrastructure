#!/usr/bin/env python3
"""Run and score the untouched PAI agreement-extraction baseline."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import platform
import random
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource


RUNNER_VERSION = "pai.untouched-baseline.v0.1"
DEFAULT_MODEL = "unsloth/Qwen3-4B-Instruct-2507-bnb-4bit"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--max-cases", type=int, default=0)
    parser.add_argument("--case", action="append", dest="case_ids")
    parser.add_argument("--max-seq-length", type=int, default=8192)
    parser.add_argument("--max-new-tokens", type=int, default=1024)
    parser.add_argument("--seed", type=int, default=3407)
    parser.add_argument(
        "--output",
        default="ai/ethonline/baseline/results/untouched-qwen3-4b.json",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def git_value(repo_root: Path, *args: str) -> str | None:
    completed = subprocess.run(
        ["git", *args],
        cwd=repo_root,
        check=False,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip() if completed.returncode == 0 else None


def package_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def json_pointer(document: Any, pointer: str) -> Any:
    if pointer == "":
        return document
    current = document
    for raw_segment in pointer.lstrip("/").split("/"):
        segment = raw_segment.replace("~1", "/").replace("~0", "~")
        if isinstance(current, list):
            current = current[int(segment)]
        elif isinstance(current, dict):
            current = current[segment]
        else:
            raise KeyError(pointer)
    return current


def extract_json(raw: str) -> tuple[Any | None, bool, str | None]:
    stripped = raw.strip()
    try:
        return json.loads(stripped), True, None
    except json.JSONDecodeError as strict_error:
        decoder = json.JSONDecoder()
        for index, character in enumerate(stripped):
            if character != "{":
                continue
            try:
                parsed, _ = decoder.raw_decode(stripped[index:])
                return parsed, False, str(strict_error)
            except json.JSONDecodeError:
                continue
        return None, False, str(strict_error)


def make_validator(model_schema: dict[str, Any], agreement_schema: dict[str, Any]):
    resource = Resource.from_contents(agreement_schema)
    registry = Registry().with_resource(agreement_schema["$id"], resource)
    Draft202012Validator.check_schema(model_schema)
    return Draft202012Validator(model_schema, registry=registry)


def normalized_list(value: Any) -> list[Any]:
    return sorted(value) if isinstance(value, list) else []


def issue_matches(actual: dict[str, Any], expected: dict[str, Any]) -> bool:
    return (
        actual.get("kind") == expected.get("kind")
        and actual.get("code") == expected.get("code")
        and normalized_list(actual.get("paths"))
        == normalized_list(expected.get("paths"))
        and normalized_list(actual.get("evidence"))
        == normalized_list(expected.get("evidence"))
    )


def score_semantics(output: Any, expected: dict[str, Any]) -> dict[str, Any]:
    assertions: list[dict[str, Any]] = []
    if not isinstance(output, dict):
        return {"passed": 0, "total": 0, "ratio": 0.0, "assertions": assertions}

    for pointer, expected_value in expected.get("values", {}).items():
        try:
            actual_value = json_pointer(output, pointer)
            passed = actual_value == expected_value
        except (KeyError, IndexError, TypeError, ValueError):
            actual_value = None
            passed = False
        assertions.append(
            {
                "type": "value",
                "pointer": pointer,
                "passed": passed,
                "expected": expected_value,
                "actual": actual_value,
            }
        )

    actual_issues = output.get("issues", []) if isinstance(output.get("issues"), list) else []
    for expected_issue in expected.get("issues", []):
        passed = any(
            isinstance(actual_issue, dict) and issue_matches(actual_issue, expected_issue)
            for actual_issue in actual_issues
        )
        assertions.append(
            {
                "type": "issue",
                "code": expected_issue.get("code"),
                "passed": passed,
                "expected": expected_issue,
            }
        )

    actual_provenance = (
        output.get("provenance", []) if isinstance(output.get("provenance"), list) else []
    )
    for expected_entry in expected.get("provenance", []):
        passed = any(
            isinstance(actual_entry, dict)
            and actual_entry.get("path") == expected_entry.get("path")
            and actual_entry.get("quote") == expected_entry.get("quote")
            for actual_entry in actual_provenance
        )
        assertions.append(
            {
                "type": "provenance",
                "path": expected_entry.get("path"),
                "passed": passed,
                "expected": expected_entry,
            }
        )

    emitted_codes = {
        issue.get("code") for issue in actual_issues if isinstance(issue, dict)
    }
    for forbidden_code in expected.get("forbiddenIssueCodes", []):
        assertions.append(
            {
                "type": "forbidden_issue",
                "code": forbidden_code,
                "passed": forbidden_code not in emitted_codes,
            }
        )

    passed_count = sum(1 for assertion in assertions if assertion["passed"])
    total_count = len(assertions)
    return {
        "passed": passed_count,
        "total": total_count,
        "ratio": round(passed_count / total_count, 6) if total_count else 0.0,
        "assertions": assertions,
    }


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[3]
    prompt_path = repo_root / "ai/ethonline/prompts/agreement-extraction-v0.2.txt"
    fixtures_path = repo_root / "docs/ai/annotation/fixtures/pai-annotation-adversarial-v0.2.json"
    agreement_schema_path = repo_root / "docs/ai/schema/pai-agreement-v0.2.schema.json"
    model_schema_path = repo_root / "docs/ai/schema/pai-model-output-v0.2.schema.json"
    issue_registry_path = repo_root / "docs/ai/schema/pai-issue-codes-v0.2.json"
    output_path = repo_root / args.output

    prompt_contract = prompt_path.read_text(encoding="utf-8").strip()
    fixtures = load_json(fixtures_path)
    agreement_schema = load_json(agreement_schema_path)
    model_schema = load_json(model_schema_path)
    issue_registry = load_json(issue_registry_path)
    validator = make_validator(model_schema, agreement_schema)

    cases = fixtures["cases"]
    if args.case_ids:
        selected = set(args.case_ids)
        cases = [case for case in cases if case["id"] in selected]
        missing = selected.difference(case["id"] for case in cases)
        if missing:
            raise SystemExit(f"Unknown case IDs: {sorted(missing)}")
    if args.max_cases > 0:
        cases = cases[: args.max_cases]
    if not cases:
        raise SystemExit("No baseline cases selected")

    issue_contract = [
        {
            "code": entry["code"],
            "kind": entry["kind"],
            "pathPrefixes": entry["pathPrefixes"],
            "evidenceRequired": entry["evidenceRequired"],
        }
        for entry in issue_registry["codes"]
    ]
    contract_text = (
        "PAI_MODEL_OUTPUT_SCHEMA="
        + compact_json(model_schema)
        + "\nPAI_AGREEMENT_SCHEMA="
        + compact_json(agreement_schema)
        + "\nPAI_ISSUE_CODES="
        + compact_json(issue_contract)
    )

    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    random.seed(args.seed)

    import torch
    from unsloth import FastLanguageModel

    torch.manual_seed(args.seed)
    torch.cuda.manual_seed_all(args.seed)
    if not torch.cuda.is_available():
        raise SystemExit("CUDA is required for this baseline")

    print(f"Loading untouched model: {args.model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)

    results: list[dict[str, Any]] = []
    for position, case in enumerate(cases, start=1):
        trusted_context = case.get("deterministicContext", {})
        user_content = (
            contract_text
            + "\nTRUSTED_CONTEXT="
            + compact_json(trusted_context)
            + "\nSOURCE_TEXT="
            + json.dumps(case["source"], ensure_ascii=False)
            + "\nReturn the PAI model-output JSON object now."
        )
        messages = [
            {"role": "system", "content": prompt_contract},
            {"role": "user", "content": user_content},
        ]
        input_ids = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
        ).to("cuda")
        prompt_tokens = int(input_ids.shape[-1])
        if prompt_tokens + args.max_new_tokens > args.max_seq_length:
            raise RuntimeError(
                f"Case {case['id']} exceeds context: {prompt_tokens} + "
                f"{args.max_new_tokens} > {args.max_seq_length}"
            )

        print(f"[{position}/{len(cases)}] {case['id']} ({prompt_tokens} prompt tokens)")
        with torch.inference_mode():
            generated = model.generate(
                input_ids=input_ids,
                max_new_tokens=args.max_new_tokens,
                do_sample=False,
                use_cache=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        raw_response = tokenizer.decode(
            generated[0, input_ids.shape[-1] :],
            skip_special_tokens=True,
        ).strip()
        parsed, strict_json, parse_error = extract_json(raw_response)

        schema_errors: list[dict[str, Any]] = []
        if parsed is not None:
            for error in sorted(
                validator.iter_errors(parsed),
                key=lambda item: "/".join(str(part) for part in item.path),
            ):
                schema_errors.append(
                    {
                        "path": "/" + "/".join(str(part) for part in error.absolute_path),
                        "message": error.message,
                        "validator": error.validator,
                    }
                )

        semantics = score_semantics(parsed, case["expected"])
        results.append(
            {
                "caseId": case["id"],
                "source": case["source"],
                "promptTokens": prompt_tokens,
                "rawResponse": raw_response,
                "strictJson": strict_json,
                "jsonParsed": parsed is not None,
                "parseError": parse_error,
                "parsedOutput": parsed,
                "schemaValid": parsed is not None and not schema_errors,
                "schemaErrors": schema_errors,
                "semanticScore": semantics,
            }
        )

    case_count = len(results)
    semantic_passed = sum(item["semanticScore"]["passed"] for item in results)
    semantic_total = sum(item["semanticScore"]["total"] for item in results)
    summary = {
        "caseCount": case_count,
        "strictJsonCount": sum(item["strictJson"] for item in results),
        "jsonParsedCount": sum(item["jsonParsed"] for item in results),
        "schemaValidCount": sum(item["schemaValid"] for item in results),
        "semanticAssertionsPassed": semantic_passed,
        "semanticAssertionsTotal": semantic_total,
        "semanticAssertionRatio": (
            round(semantic_passed / semantic_total, 6) if semantic_total else 0.0
        ),
    }
    report = {
        "runnerVersion": RUNNER_VERSION,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "git": {
            "commit": git_value(repo_root, "rev-parse", "HEAD"),
            "branch": git_value(repo_root, "branch", "--show-current"),
            "dirty": bool(git_value(repo_root, "status", "--porcelain")),
        },
        "model": {
            "name": args.model,
            "untouched": True,
            "loadIn4Bit": True,
        },
        "generation": {
            "maxSeqLength": args.max_seq_length,
            "maxNewTokens": args.max_new_tokens,
            "seed": args.seed,
            "doSample": False,
        },
        "contracts": {
            "prompt": str(prompt_path.relative_to(repo_root)),
            "fixtureVersion": fixtures["fixtureVersion"],
            "agreementSchemaId": agreement_schema["$id"],
            "modelOutputSchemaId": model_schema["$id"],
            "issueRegistryVersion": issue_registry["registryVersion"],
        },
        "environment": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "torch": torch.__version__,
            "cudaRuntime": torch.version.cuda,
            "gpu": torch.cuda.get_device_name(0),
            "gpuMemoryBytes": torch.cuda.get_device_properties(0).total_memory,
            "unsloth": package_version("unsloth"),
            "transformers": package_version("transformers"),
            "jsonschema": package_version("jsonschema"),
        },
        "summary": summary,
        "results": results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2))
    print(f"Report: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
