# PAI Agreement Dataset Tooling

This directory contains deterministic tooling for preparing PAI agreement-extraction datasets.

`validate_dataset.py` validates JSON or JSONL records against the versioned PAI v0.2 training,
model-output, and agreement schemas. It also enforces exact source quotes, issue-registry kind and
path constraints, unique example IDs, parent split isolation, leakage-group isolation, and
normalized-input isolation across dataset splits.

Validate one or more files or directories:

```bash
python ai/ethonline/dataset/validate_dataset.py path/to/train.jsonl path/to/validation.jsonl
```

Before any training run, apply the separate readiness gate:

```bash
python ai/ethonline/dataset/check_training_readiness.py path/to/corpus
```

The readiness gate requires adjudicated records, no personal data, train/validation/challenge
splits, both clean and issue-bearing training examples, and training coverage of every registered
issue kind. It is a minimum safety gate, not evidence that a corpus is sufficiently large,
representative, or production-ready. The draft seed corpus is expected to fail this gate.

Human review decisions are stored separately from deterministic draft sources. Create a hash-bound
CSV queue:

```bash
python ai/ethonline/dataset/review_dataset.py create path/to/draft-corpus \
  --output path/to/review-decisions.csv
```

For every row, a human reviewer must replace `pending` with `adjudicate` or `reject`, identify the
reviewer, and add a timezone-qualified ISO 8601 `reviewedAt` timestamp. Rejections also require
notes. Queue creation refuses to overwrite an existing decision file. The reviewer value is a
declared identity for audit purposes; this file format does not cryptographically authenticate the
reviewer. Applying the completed decisions creates a new derived corpus; it never edits draft inputs:

```bash
python ai/ethonline/dataset/review_dataset.py apply path/to/draft-corpus \
  --decisions path/to/review-decisions.csv \
  --output-dir path/to/adjudicated-corpus
```

Application fails if decisions are missing, pending, stale relative to the SHA-256-bound source
record, or reference the wrong split. Rejected records are excluded from the derived corpus.

Run the focused tests:

```bash
python -m unittest ai/ethonline/dataset/test_validate_dataset.py
```

The existing 16 adversarial annotation fixtures are regression cases. They are not supervised
training examples and must not be copied into generated train, validation, test, or challenge
splits.

`seed-v0.1/` is a deterministic 24-record pipeline seed. It is family-isolated across train,
validation, and challenge splits, but every record is deliberately marked `draft`. It is not large
or independently reviewed enough to justify a production fine-tune.

Regenerate, verify, and validate the seed:

```bash
python ai/ethonline/dataset/build_seed_corpus.py
python ai/ethonline/dataset/build_seed_corpus.py --check
python ai/ethonline/dataset/validate_dataset.py ai/ethonline/dataset/seed-v0.1
```
