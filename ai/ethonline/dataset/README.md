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
