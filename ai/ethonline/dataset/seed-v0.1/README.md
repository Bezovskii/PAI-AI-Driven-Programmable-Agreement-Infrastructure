# PAI Seed Corpus v0.1

This is a deterministic synthetic seed corpus for validating the supervised-data pipeline.

- 16 train records
- 4 validation records
- 4 challenge records
- semantic template families are isolated by split
- every record targets `pai.training-example.v0.2`
- every record is marked `draft`

The 16 existing adversarial annotation fixtures are regression evidence and are excluded from this
corpus. Validation and challenge records must never be consumed by training.

This seed is intentionally too small and too synthetic to justify a production-quality fine-tune.
It must pass schema, semantic, provenance, and leakage checks before the corpus is expanded and
human-adjudicated.

Regenerate the machine-produced files:

```bash
python ai/ethonline/dataset/build_seed_corpus.py
```

Check that committed outputs are reproducible:

```bash
python ai/ethonline/dataset/build_seed_corpus.py --check
```

Validate the complete corpus:

```bash
python ai/ethonline/dataset/validate_dataset.py ai/ethonline/dataset/seed-v0.1
```
