#!/usr/bin/env python3
"""Persistent localhost runtime for PAI Agreement Intelligence.

Loads the frozen Qwen3 + PAI QLoRA adapter once at startup.
This runtime interprets agreement text only. It cannot accept
agreements, authorize lifecycle transitions, or move funds.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import random
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import torch
from unsloth import FastLanguageModel


RUNTIME_VERSION = "pai.intelligence-runtime.v0.1"

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8788

DEFAULT_REPO = Path(
    os.environ.get(
        "PAI_REPO_ROOT",
        "/mnt/d/github/PAI-ETHOnline-Intelligence",
    )
)

DEFAULT_ADAPTER = Path(
    os.environ.get(
        "PAI_INTELLIGENCE_ADAPTER",
        "/home/asus/pai-ml/experiments/"
        "qwen3-4b-qlora-v0.3/final-adapter",
    )
)

BASE_MODEL = "unsloth/Qwen3-4B-Instruct-2507-bnb-4bit"

EXPECTED_ADAPTER_SHA256 = (
    "82ec8dd4328eb87f2c23dc2caba962ab"
    "51c400a93a7165c7a72611aaca18df5d"
)

EXPECTED_PROMPT_SHA256 = (
    "8b169ee6690f55a0d7d093ce03df1b37"
    "a62517a6d771adf6f74227c468ffcf8a"
)

MAX_SEQ_LENGTH = 6144
MAX_NEW_TOKENS = 1024
SEED = 3407

_INFERENCE_LOCK = threading.Lock()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compact_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def load_json(path: Path) -> Any:
    return json.loads(
        path.read_text(encoding="utf-8")
    )


def import_baseline(repo_root: Path) -> Any:
    baseline_path = (
        repo_root
        / "ai/ethonline/baseline/run_baseline.py"
    )

    if not baseline_path.is_file():
        raise RuntimeError(
            f"Baseline helpers not found: {baseline_path}"
        )

    spec = importlib.util.spec_from_file_location(
        "pai_runtime_baseline_helpers",
        baseline_path,
    )

    if spec is None or spec.loader is None:
        raise RuntimeError(
            "Unable to import PAI validation helpers."
        )

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class IntelligenceRuntime:
    def __init__(
        self,
        repo_root: Path,
        adapter_path: Path,
    ) -> None:
        self.repo_root = repo_root
        self.adapter_path = adapter_path

        self.adapter_model_path = (
            adapter_path
            / "adapter_model.safetensors"
        )

        self.prompt_path = (
            repo_root
            / "ai/ethonline/prompts/"
            "agreement-extraction-v0.3.txt"
        )

        self.agreement_schema_path = (
            repo_root
            / "docs/ai/schema/"
            "pai-agreement-v0.2.schema.json"
        )

        self.model_schema_path = (
            repo_root
            / "docs/ai/schema/"
            "pai-model-output-v0.2.schema.json"
        )

        self.issue_registry_path = (
            repo_root
            / "docs/ai/schema/"
            "pai-issue-codes-v0.2.json"
        )

        self._verify_frozen_inputs()

        self.baseline = import_baseline(
            repo_root
        )

        self.prompt_contract = (
            self.prompt_path
            .read_text(encoding="utf-8")
            .strip()
        )

        self.agreement_schema = load_json(
            self.agreement_schema_path
        )

        self.model_schema = load_json(
            self.model_schema_path
        )

        self.issue_registry = load_json(
            self.issue_registry_path
        )

        self.validator = (
            self.baseline.make_validator(
                self.model_schema,
                self.agreement_schema,
            )
        )

        issue_contract = [
            {
                "code": entry["code"],
                "kind": entry["kind"],
                "pathPrefixes": (
                    entry["pathPrefixes"]
                ),
                "evidenceRequired": (
                    entry["evidenceRequired"]
                ),
            }
            for entry
            in self.issue_registry["codes"]
        ]

        self.contract_text = (
            "PAI_MODEL_OUTPUT_SCHEMA="
            + compact_json(
                self.model_schema
            )
            + "\nPAI_AGREEMENT_SCHEMA="
            + compact_json(
                self.agreement_schema
            )
            + "\nPAI_ISSUE_CODES="
            + compact_json(
                issue_contract
            )
        )

        self.model, self.tokenizer = (
            FastLanguageModel.from_pretrained(
                model_name=str(
                    adapter_path
                ),
                max_seq_length=(
                    MAX_SEQ_LENGTH
                ),
                dtype=None,
                load_in_4bit=True,
            )
        )

        FastLanguageModel.for_inference(
            self.model
        )

    def _verify_frozen_inputs(
        self,
    ) -> None:
        required = [
            self.adapter_model_path,
            self.prompt_path,
            self.agreement_schema_path,
            self.model_schema_path,
            self.issue_registry_path,
        ]

        missing = [
            str(path)
            for path in required
            if not path.is_file()
        ]

        if missing:
            raise RuntimeError(
                "Missing Intelligence runtime "
                "dependency: "
                + ", ".join(missing)
            )

        adapter_sha = sha256_file(
            self.adapter_model_path
        )

        if (
            adapter_sha
            != EXPECTED_ADAPTER_SHA256
        ):
            raise RuntimeError(
                "Frozen adapter SHA256 mismatch. "
                f"Expected "
                f"{EXPECTED_ADAPTER_SHA256}; "
                f"received {adapter_sha}."
            )

        prompt_sha = sha256_file(
            self.prompt_path
        )

        if (
            prompt_sha
            != EXPECTED_PROMPT_SHA256
        ):
            raise RuntimeError(
                "Frozen prompt SHA256 mismatch. "
                f"Expected "
                f"{EXPECTED_PROMPT_SHA256}; "
                f"received {prompt_sha}."
            )

    def health(
        self,
    ) -> dict[str, Any]:
        return {
            "status": "ok",
            "runtimeVersion": (
                RUNTIME_VERSION
            ),
            "model": BASE_MODEL,
            "adapterSha256": (
                EXPECTED_ADAPTER_SHA256
            ),
            "modelLoaded": True,
        }

    def structure(
        self,
        text: str,
    ) -> dict[str, Any]:
        normalized_text = text.strip()

        if not normalized_text:
            raise ValueError(
                "Agreement text must "
                "not be empty."
            )

        messages = [
            {
                "role": "system",
                "content": (
                    self.prompt_contract
                ),
            },
            {
                "role": "user",
                "content": (
                    self.contract_text
                    + "\nTRUSTED_CONTEXT="
                    + compact_json(
                        {"facts": []}
                    )
                    + "\nSOURCE_TEXT="
                    + json.dumps(
                        normalized_text,
                        ensure_ascii=False,
                    )
                    + "\nTOP_LEVEL_KEYS="
                    + compact_json(
                        [
                            "schemaVersion",
                            "agreement",
                            "issues",
                            "provenance",
                        ]
                    )
                    + "\nReturn exactly one PAI "
                    "model-output JSON object. "
                    "The root object must contain "
                    "only those four keys. "
                    "Schema helper names under "
                    "$defs are definitions, not "
                    "output properties."
                ),
            },
        ]

        inputs = (
            self.tokenizer
            .apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
                return_dict=True,
            )
            .to("cuda")
        )

        prompt_tokens = int(
            inputs[
                "input_ids"
            ].shape[-1]
        )

        if (
            prompt_tokens
            + MAX_NEW_TOKENS
            > MAX_SEQ_LENGTH
        ):
            raise RuntimeError(
                "Agreement prompt exceeds "
                "configured context."
            )

        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(
            SEED
        )

        started = time.perf_counter()

        # Serialize GPU generation.
        # The service stays loaded between requests.
        with _INFERENCE_LOCK:
            with torch.inference_mode():
                generated = (
                    self.model.generate(
                        input_ids=(
                            inputs[
                                "input_ids"
                            ]
                        ),
                        attention_mask=(
                            inputs[
                                "attention_mask"
                            ]
                        ),
                        max_new_tokens=(
                            MAX_NEW_TOKENS
                        ),
                        do_sample=False,
                        use_cache=True,
                        pad_token_id=(
                            self.tokenizer
                            .eos_token_id
                        ),
                    )
                )

            torch.cuda.synchronize()

        inference_seconds = (
            time.perf_counter()
            - started
        )

        output_ids = generated[
            0,
            inputs[
                "input_ids"
            ].shape[-1]:,
        ]

        output_tokens = int(
            output_ids.shape[-1]
        )

        raw_response = (
            self.tokenizer.decode(
                output_ids,
                skip_special_tokens=True,
            )
            .strip()
        )

        (
            parsed,
            strict_json,
            parse_error,
        ) = self.baseline.extract_json(
            raw_response
        )

        if parsed is None:
            message = (
                "Model returned invalid JSON"
            )

            if parse_error:
                message += (
                    f": {parse_error}"
                )

            raise RuntimeError(message)

        schema_errors = [
            {
                "path": (
                    "/"
                    + "/".join(
                        str(part)
                        for part
                        in error.absolute_path
                    )
                ),
                "message": error.message,
                "validator": (
                    error.validator
                ),
            }
            for error in sorted(
                self.validator
                .iter_errors(parsed),
                key=lambda item: (
                    "/".join(
                        str(part)
                        for part
                        in item.path
                    )
                ),
            )
        ]

        if schema_errors:
            raise RuntimeError(
                "Model output failed "
                "pai-model-output-v0.2 "
                "schema validation: "
                + json.dumps(
                    schema_errors,
                    ensure_ascii=False,
                )
            )

        return {
            "modelOutput": parsed,
            "rawModelOutput": (
                raw_response
            ),
            "meta": {
                "runtimeVersion": (
                    RUNTIME_VERSION
                ),
                "strictJson": (
                    strict_json
                ),
                "schemaValid": True,
                "promptTokens": (
                    prompt_tokens
                ),
                "outputTokens": (
                    output_tokens
                ),
                "inferenceSeconds": (
                    round(
                        inference_seconds,
                        6,
                    )
                ),
                "adapterSha256": (
                    EXPECTED_ADAPTER_SHA256
                ),
            },
        }


class RuntimeHttpServer(
    ThreadingHTTPServer
):
    runtime: IntelligenceRuntime


class Handler(
    BaseHTTPRequestHandler
):
    server: RuntimeHttpServer

    def log_message(
        self,
        format: str,
        *args: Any,
    ) -> None:
        print(
            "[pai-intelligence] "
            + format % args,
            flush=True,
        )

    def _send_json(
        self,
        status: int,
        payload: dict[str, Any],
    ) -> None:
        body = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json; "
            "charset=utf-8",
        )

        self.send_header(
            "Content-Length",
            str(len(body)),
        )

        self.end_headers()
        self.wfile.write(body)

    def do_GET(
        self,
    ) -> None:
        if self.path != "/health":
            self._send_json(
                HTTPStatus.NOT_FOUND,
                {
                    "error": {
                        "code": (
                            "NOT_FOUND"
                        ),
                        "message": (
                            "Route not found."
                        ),
                    }
                },
            )
            return

        self._send_json(
            HTTPStatus.OK,
            self.server.runtime.health(),
        )

    def do_POST(
        self,
    ) -> None:
        if self.path != "/structure":
            self._send_json(
                HTTPStatus.NOT_FOUND,
                {
                    "error": {
                        "code": (
                            "NOT_FOUND"
                        ),
                        "message": (
                            "Route not found."
                        ),
                    }
                },
            )
            return

        try:
            content_length = int(
                self.headers.get(
                    "Content-Length",
                    "0",
                )
            )

            if content_length <= 0:
                raise ValueError(
                    "Request body is required."
                )

            body = self.rfile.read(
                content_length
            )

            payload = json.loads(
                body.decode("utf-8")
            )

            if not isinstance(
                payload,
                dict,
            ):
                raise ValueError(
                    "Request body must "
                    "be a JSON object."
                )

            text = payload.get("text")

            if not isinstance(
                text,
                str,
            ):
                raise ValueError(
                    "Field 'text' must "
                    "be a string."
                )

            result = (
                self.server.runtime
                .structure(text)
            )

            self._send_json(
                HTTPStatus.OK,
                result,
            )

        except (
            ValueError,
            json.JSONDecodeError,
        ) as exc:
            self._send_json(
                HTTPStatus.BAD_REQUEST,
                {
                    "error": {
                        "code": (
                            "INVALID_REQUEST"
                        ),
                        "message": str(exc),
                    }
                },
            )

        except Exception as exc:
            # Fail closed.
            # Never invent a fallback agreement.
            print(
                "[pai-intelligence] "
                "inference failure: "
                + repr(exc),
                flush=True,
            )

            self._send_json(
                HTTPStatus.BAD_GATEWAY,
                {
                    "error": {
                        "code": (
                            "INTELLIGENCE_"
                            "RUNTIME_FAILURE"
                        ),
                        "message": str(exc),
                    }
                },
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
    )

    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
    )

    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
    )

    parser.add_argument(
        "--repo-root",
        type=Path,
        default=DEFAULT_REPO,
    )

    parser.add_argument(
        "--adapter",
        type=Path,
        default=DEFAULT_ADAPTER,
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not torch.cuda.is_available():
        raise SystemExit(
            "CUDA is required for the "
            "PAI Intelligence runtime."
        )

    random.seed(SEED)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(
        SEED
    )

    print(
        "[pai-intelligence] "
        "loading frozen model...",
        flush=True,
    )

    runtime = IntelligenceRuntime(
        repo_root=args.repo_root,
        adapter_path=args.adapter,
    )

    server = RuntimeHttpServer(
        (args.host, args.port),
        Handler,
    )

    server.runtime = runtime

    print(
        "[pai-intelligence] ready "
        f"http://{args.host}:"
        f"{args.port}",
        flush=True,
    )

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())