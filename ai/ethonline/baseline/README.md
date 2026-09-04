# PAI ETHOnline untouched-model baseline

This runner evaluates the untouched `unsloth/Qwen3-4B-Instruct-2507-bnb-4bit` model against the frozen PAI v0.2 adversarial annotation cases.

It records:

- the Git commit and runtime versions;
- the frozen prompt and generation configuration;
- raw model responses;
- strict JSON and recoverable JSON parse rates;
- PAI Model Output Schema validity;
- focused semantic assertions from the annotation fixtures; and
- GPU memory usage.

The baseline is evidence, not a claim that the untouched model is production-ready.

## Environment

```bash
source ~/pai-ml/unsloth_env/bin/activate
uv pip install -r ai/ethonline/baseline/requirements.txt
export HF_HOME=~/pai-ml/hf-cache
```

## Two-case smoke run

```bash
python ai/ethonline/baseline/run_baseline.py \
  --max-cases 2 \
  --output ai/ethonline/baseline/results/untouched-smoke.json
```

## Full frozen baseline

```bash
python ai/ethonline/baseline/run_baseline.py \
  --output ai/ethonline/baseline/results/untouched-qwen3-4b.json
```

The full run uses all 16 adversarial cases. Baseline and future tuned-model comparisons must use the same prompt, cases, generation configuration, and scorer version.
