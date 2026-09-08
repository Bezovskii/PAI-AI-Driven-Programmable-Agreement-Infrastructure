#!/usr/bin/env python3
"""Reproducible QLoRA training harness for the PAI Agreement Intelligence v0.3 contract.

Default execution is a dry run. No optimizer step occurs unless --train is supplied.
The training corpus and prompt/schema contract are guarded against the frozen input
commit 580d682aeac9d273b8ae386d45a9cd84104bee54.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import random
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

FROZEN_TRAINING_INPUT_COMMIT = "580d682aeac9d273b8ae386d45a9cd84104bee54"
DEFAULT_MODEL = "unsloth/Qwen3-4B-Instruct-2507-bnb-4bit"
DEFAULT_PROMPT = "ai/ethonline/prompts/agreement-extraction-v0.3.txt"
DEFAULT_MAX_SEQ_LENGTH = 6144
DEFAULT_SEED = 3407
DEFAULT_OUTPUT_DIR = Path("/home/asus/pai-ml/experiments/qwen3-4b-qlora-v0.1")

TRAIN_FILES = (
    "ai/ethonline/dataset/seed-v0.1-adjudicated/train.jsonl",
    "ai/ethonline/dataset/readiness-supplement-v0.1-adjudicated/train.jsonl",
)

FROZEN_GUARD_PATHS = (
    "ai/ethonline/prompts/agreement-extraction-v0.3.txt",
    "docs/ai/schema/pai-model-output-v0.2.schema.json",
    "docs/ai/schema/pai-agreement-v0.2.schema.json",
    "docs/ai/schema/pai-issue-codes-v0.2.json",
    "ai/ethonline/dataset/seed-v0.1-adjudicated",
    "ai/ethonline/dataset/readiness-supplement-v0.1-adjudicated",
)

LORA_TARGET_MODULES = (
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", action="store_true", help="Actually run optimizer steps")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--prompt", default=DEFAULT_PROMPT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--max-seq-length", type=int, default=DEFAULT_MAX_SEQ_LENGTH)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--epochs", type=float, default=6.0)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=16)
    parser.add_argument("--max-steps", type=int, default=-1)
    parser.add_argument("--render-example")
    return parser.parse_args()


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def git(repo_root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo_root), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=check,
    )


def git_value(repo_root: Path, *args: str) -> str:
    return git(repo_root, *args).stdout.strip()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_frozen_contract(repo_root: Path) -> None:
    ancestor = git(
        repo_root, "merge-base", "--is-ancestor",
        FROZEN_TRAINING_INPUT_COMMIT, "HEAD", check=False,
    )
    if ancestor.returncode != 0:
        raise SystemExit(
            "Current HEAD is not descended from frozen training input commit "
            f"{FROZEN_TRAINING_INPUT_COMMIT}"
        )
    diff = git(
        repo_root, "diff", "--quiet",
        FROZEN_TRAINING_INPUT_COMMIT, "--", *FROZEN_GUARD_PATHS,
        check=False,
    )
    if diff.returncode == 1:
        raise SystemExit(
            "Frozen training corpus or prompt/schema contract differs from "
            f"{FROZEN_TRAINING_INPUT_COMMIT}; refusing to continue."
        )
    if diff.returncode != 0:
        raise SystemExit(f"git diff guard failed: {diff.stderr.strip()}")


def load_training_rows(repo_root: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for relative in TRAIN_FILES:
        path = repo_root / relative
        with path.open("r", encoding="utf-8") as handle:
            rows.extend(json.loads(line) for line in handle if line.strip())
    if len(rows) != 19:
        raise SystemExit(f"Expected exactly 19 frozen train records, found {len(rows)}")
    ids = [row["exampleId"] for row in rows]
    if len(ids) != len(set(ids)):
        raise SystemExit("Duplicate example IDs in training input")
    if any(row.get("split") != "train" for row in rows):
        raise SystemExit("Non-train record found in supervised training input")
    if any(row["metadata"].get("reviewStatus") != "adjudicated" for row in rows):
        raise SystemExit("Non-adjudicated record found in supervised training input")
    if any(bool(row["metadata"].get("containsPersonalData")) for row in rows):
        raise SystemExit("Personal-data record found in supervised training input")
    return rows


def build_contract_text(repo_root: Path) -> tuple[str, dict[str, str]]:
    model_schema_path = repo_root / "docs/ai/schema/pai-model-output-v0.2.schema.json"
    agreement_schema_path = repo_root / "docs/ai/schema/pai-agreement-v0.2.schema.json"
    issue_registry_path = repo_root / "docs/ai/schema/pai-issue-codes-v0.2.json"
    model_schema = load_json(model_schema_path)
    agreement_schema = load_json(agreement_schema_path)
    issue_registry = load_json(issue_registry_path)
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
        "PAI_MODEL_OUTPUT_SCHEMA=" + compact_json(model_schema)
        + "\nPAI_AGREEMENT_SCHEMA=" + compact_json(agreement_schema)
        + "\nPAI_ISSUE_CODES=" + compact_json(issue_contract)
    )
    ids = {
        "agreementSchemaId": agreement_schema["$id"],
        "modelOutputSchemaId": model_schema["$id"],
        "issueRegistryVersion": issue_registry["registryVersion"],
    }
    return contract_text, ids


def build_user_content(contract_text: str, row: dict[str, Any]) -> str:
    return (
        contract_text
        + "\nTRUSTED_CONTEXT=" + compact_json(row["trustedContext"])
        + "\nSOURCE_TEXT=" + json.dumps(row["input"]["text"], ensure_ascii=False)
        + "\nReturn the PAI model-output JSON object now."
    )


@dataclass
class RenderedExample:
    example_id: str
    prompt_text: str
    completion_text: str
    input_ids: list[int]
    labels: list[int]
    prompt_tokens: int
    completion_tokens: int

    @property
    def total_tokens(self) -> int:
        return len(self.input_ids)


def render_examples(
    tokenizer: Any,
    prompt_contract: str,
    contract_text: str,
    rows: Sequence[dict[str, Any]],
    max_seq_length: int,
) -> list[RenderedExample]:
    rendered: list[RenderedExample] = []
    for row in rows:
        user_content = build_user_content(contract_text, row)
        messages = [
            {"role": "system", "content": prompt_contract},
            {"role": "user", "content": user_content},
        ]
        prompt_text = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True,
        )
        prompt_ids = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
        )["input_ids"]
        completion_text = compact_json(row["target"]) + tokenizer.eos_token
        completion_ids = tokenizer(
            completion_text, add_special_tokens=False,
        )["input_ids"]
        input_ids = list(prompt_ids) + list(completion_ids)
        if len(input_ids) > max_seq_length:
            raise SystemExit(
                f"{row['exampleId']} has {len(input_ids)} tokens, exceeding "
                f"--max-seq-length={max_seq_length}"
            )
        rendered.append(
            RenderedExample(
                example_id=row["exampleId"],
                prompt_text=prompt_text,
                completion_text=completion_text,
                input_ids=input_ids,
                labels=[-100] * len(prompt_ids) + list(completion_ids),
                prompt_tokens=len(prompt_ids),
                completion_tokens=len(completion_ids),
            )
        )
    return rendered


class TokenizedDataset:
    def __init__(self, examples: Sequence[RenderedExample]) -> None:
        self.examples = list(examples)

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> dict[str, list[int]]:
        item = self.examples[index]
        return {
            "input_ids": item.input_ids,
            "attention_mask": [1] * len(item.input_ids),
            "labels": item.labels,
        }


class CompletionOnlyCollator:
    def __init__(self, pad_token_id: int) -> None:
        self.pad_token_id = pad_token_id

    def __call__(self, features: Sequence[dict[str, list[int]]]) -> dict[str, Any]:
        import torch
        max_len = max(len(feature["input_ids"]) for feature in features)
        input_ids: list[list[int]] = []
        attention_mask: list[list[int]] = []
        labels: list[list[int]] = []
        for feature in features:
            pad = max_len - len(feature["input_ids"])
            input_ids.append(feature["input_ids"] + [self.pad_token_id] * pad)
            attention_mask.append(feature["attention_mask"] + [0] * pad)
            labels.append(feature["labels"] + [-100] * pad)
        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
        }


def package_version(name: str) -> str | None:
    try:
        from importlib.metadata import version
        return version(name)
    except Exception:
        return None


def print_dry_run(
    args: argparse.Namespace,
    repo_root: Path,
    rows: Sequence[dict[str, Any]],
    rendered: Sequence[RenderedExample],
    prompt_path: Path,
    contract_ids: dict[str, str],
) -> None:
    report = {
        "mode": "dry-run",
        "optimizerSteps": 0,
        "frozenTrainingInputCommit": FROZEN_TRAINING_INPUT_COMMIT,
        "git": {
            "commit": git_value(repo_root, "rev-parse", "HEAD"),
            "branch": git_value(repo_root, "branch", "--show-current"),
            "dirty": bool(git_value(repo_root, "status", "--porcelain")),
        },
        "model": args.model,
        "prompt": {
            "path": str(prompt_path.relative_to(repo_root)),
            "sha256": sha256_file(prompt_path),
        },
        "contracts": contract_ids,
        "dataset": {
            "records": len(rows),
            "files": list(TRAIN_FILES),
            "maxPromptTokens": max(x.prompt_tokens for x in rendered),
            "maxCompletionTokens": max(x.completion_tokens for x in rendered),
            "maxTotalTokens": max(x.total_tokens for x in rendered),
            "minTotalTokens": min(x.total_tokens for x in rendered),
        },
        "training": {
            "maxSeqLength": args.max_seq_length,
            "seed": args.seed,
            "epochs": args.epochs,
            "learningRate": args.learning_rate,
            "batchSize": args.batch_size,
            "gradientAccumulationSteps": args.gradient_accumulation_steps,
            "loraR": args.lora_r,
            "loraAlpha": args.lora_alpha,
            "loraTargetModules": list(LORA_TARGET_MODULES),
            "maxSteps": args.max_steps,
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    for example in rendered:
        print(
            f"{example.example_id} | prompt={example.prompt_tokens} | "
            f"completion={example.completion_tokens} | total={example.total_tokens}"
        )
    if args.render_example:
        match = next(
            (x for x in rendered if x.example_id == args.render_example), None
        )
        if match is None:
            raise SystemExit(f"Unknown --render-example: {args.render_example}")
        print("\n=== RENDERED PROMPT ===")
        print(match.prompt_text)
        print("\n=== COMPLETION ===")
        print(match.completion_text)


def run_training(
    args: argparse.Namespace,
    repo_root: Path,
    rows: Sequence[dict[str, Any]],
    prompt_contract: str,
    contract_text: str,
    prompt_path: Path,
    contract_ids: dict[str, str],
) -> int:
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    random.seed(args.seed)

    import torch
    from unsloth import FastLanguageModel
    from transformers import Trainer, TrainingArguments, set_seed

    if not torch.cuda.is_available():
        raise SystemExit("--train requires CUDA")
    if not torch.cuda.is_bf16_supported():
        raise SystemExit("This training configuration requires bfloat16 support")

    set_seed(args.seed)
    print(f"Loading base model: {args.model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,
        use_gradient_checkpointing="unsloth",
        random_state=args.seed,
        max_lora_rank=max(args.lora_r, 16),
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=list(LORA_TARGET_MODULES),
        lora_alpha=args.lora_alpha,
        lora_dropout=0.0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=args.seed,
        max_seq_length=args.max_seq_length,
        use_rslora=False,
    )
    model.config.use_cache = False
    model.config.pad_token_id = tokenizer.eos_token_id

    rendered = render_examples(
        tokenizer, prompt_contract, contract_text, rows, args.max_seq_length,
    )
    train_dataset = TokenizedDataset(rendered)
    collator = CompletionOnlyCollator(tokenizer.eos_token_id)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(args.output_dir / "trainer"),
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        learning_rate=args.learning_rate,
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        weight_decay=0.0,
        max_grad_norm=1.0,
        logging_strategy="steps",
        logging_steps=1,
        logging_first_step=True,
        save_strategy="no",
        report_to="none",
        seed=args.seed,
        data_seed=args.seed,
        bf16=True,
        fp16=False,
        gradient_checkpointing=False,
        remove_unused_columns=False,
        dataloader_num_workers=0,
        optim="adamw_torch_fused",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        data_collator=collator,
    )

    torch.cuda.reset_peak_memory_stats()
    result = trainer.train()

    final_adapter = args.output_dir / "final-adapter"
    model.save_pretrained(final_adapter)
    tokenizer.save_pretrained(final_adapter)

    metrics = dict(result.metrics)
    metrics["peakGpuMemoryAllocatedBytes"] = int(torch.cuda.max_memory_allocated())
    metrics["peakGpuMemoryReservedBytes"] = int(torch.cuda.max_memory_reserved())

    manifest = {
        "runVersion": "pai.qwen3-qlora.v0.1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "frozenTrainingInputCommit": FROZEN_TRAINING_INPUT_COMMIT,
        "git": {
            "commit": git_value(repo_root, "rev-parse", "HEAD"),
            "branch": git_value(repo_root, "branch", "--show-current"),
            "dirty": bool(git_value(repo_root, "status", "--porcelain")),
        },
        "model": {
            "base": args.model,
            "loadIn4Bit": True,
            "adapterPath": str(final_adapter),
        },
        "prompt": {
            "path": str(prompt_path.relative_to(repo_root)),
            "sha256": sha256_file(prompt_path),
        },
        "contracts": contract_ids,
        "dataset": {
            "records": len(rows),
            "files": [
                {"path": relative, "sha256": sha256_file(repo_root / relative)}
                for relative in TRAIN_FILES
            ],
            "maxPromptTokens": max(x.prompt_tokens for x in rendered),
            "maxCompletionTokens": max(x.completion_tokens for x in rendered),
            "maxTotalTokens": max(x.total_tokens for x in rendered),
        },
        "lora": {
            "r": args.lora_r,
            "alpha": args.lora_alpha,
            "dropout": 0.0,
            "targetModules": list(LORA_TARGET_MODULES),
            "useRsLoRA": False,
        },
        "training": {
            "maxSeqLength": args.max_seq_length,
            "seed": args.seed,
            "epochs": args.epochs,
            "maxSteps": args.max_steps,
            "learningRate": args.learning_rate,
            "batchSize": args.batch_size,
            "gradientAccumulationSteps": args.gradient_accumulation_steps,
            "completionOnlyLoss": True,
            "promptTokensMaskedWith": -100,
            "bf16": True,
            "optimizer": "adamw_torch_fused",
            "scheduler": "cosine",
            "warmupRatio": 0.1,
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
            "peft": package_version("peft"),
        },
        "metrics": metrics,
    }

    manifest_path = args.output_dir / "training-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(metrics, indent=2))
    print(f"Adapter: {final_adapter}")
    print(f"Manifest: {manifest_path}")
    return 0


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[3]
    assert_frozen_contract(repo_root)

    prompt_path = repo_root / args.prompt
    if not prompt_path.is_file():
        raise SystemExit(f"Prompt contract not found: {prompt_path}")

    prompt_contract = prompt_path.read_text(encoding="utf-8").strip()
    rows = load_training_rows(repo_root)
    contract_text, contract_ids = build_contract_text(repo_root)

    if args.train:
        return run_training(
            args, repo_root, rows, prompt_contract, contract_text,
            prompt_path, contract_ids,
        )

    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.model, local_files_only=True)
    rendered = render_examples(
        tokenizer, prompt_contract, contract_text, rows, args.max_seq_length,
    )
    print_dry_run(
        args, repo_root, rows, rendered, prompt_path, contract_ids,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
