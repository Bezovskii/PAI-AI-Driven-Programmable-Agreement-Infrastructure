# PAI Agreement Intelligence

Status: Pre-implementation specification workspace

Current specification family: v0.2 candidate

## Purpose

PAI Agreement Intelligence converts natural-language deal terms into a structured, source-grounded agreement representation. It does not execute agreements, move funds, make legal decisions, or replace deterministic validation.

The core rule is:

> AI advises. Humans confirm and decide. The protocol executes.

## Architecture

The chain-neutral architecture is documented in:

- [`architecture/agreement-intelligence-v0.2.md`](architecture/agreement-intelligence-v0.2.md)

High-level flow:

```text
Natural-language agreement
→ Agreement Model
→ PAIModelOutput
→ JSON Schema validation
→ Deterministic validation and resolution
→ Human clarification and confirmation
→ Executable Agreement
→ Execution Router
→ Chain adapter
```

## Current v0.2 specification set

| Artifact | Purpose | Status |
|---|---|---|
| [`schema/pai-agreement-v0.2.schema.json`](schema/pai-agreement-v0.2.schema.json) | Chain-neutral extracted agreement facts | Candidate |
| [`schema/pai-model-output-v0.2.schema.json`](schema/pai-model-output-v0.2.schema.json) | Root model response with agreement, issues, and provenance | Candidate |
| [`schema/pai-issue-codes-v0.2.json`](schema/pai-issue-codes-v0.2.json) | Stable semantic issue taxonomy | Candidate |
| [`schema/pai-training-example-v0.2.schema.json`](schema/pai-training-example-v0.2.schema.json) | One versioned training/evaluation record | Candidate |
| [`annotation/annotation-guide-v0.2.md`](annotation/annotation-guide-v0.2.md) | Extraction, normalization, inference, and non-invention rules | Candidate |
| [`evaluation/evaluation-rubric-v0.2.md`](evaluation/evaluation-rubric-v0.2.md) | Baseline/tuned-model scoring and safety gates | Candidate |

The v0.1 files remain historical compatibility artifacts. New dataset work MUST target v0.2 unless a later version is explicitly approved.

## Validation commands

Run the complete v0.2 specification suite:

```powershell
npm.cmd run validate:ai-schema-v0.2
npm.cmd run validate:ai-model-output-v0.2
npm.cmd run validate:ai-issue-codes-v0.2
npm.cmd run validate:ai-annotation-v0.2
npm.cmd run validate:ai-training-example-v0.2
npm.cmd run validate:ai-evaluation-v0.2
```

These checks validate schemas, issue-registry integrity, exact quote grounding, annotation boundaries, training-record structure, score caps, comparison rules, and leakage-group isolation.

Passing the specification suite does not prove that a model is accurate or production-ready. It proves only that the versioned contracts and their fixtures are mechanically consistent.

## Model responsibilities

The Agreement Model MAY:

- extract explicit agreement facts;
- perform approved lossless normalization;
- resolve uniquely grounded references;
- identify registered semantic issues; and
- return exact source quotes as provenance.

It MUST NOT:

- calculate payment amounts or totals;
- validate percentage sums;
- score risk;
- invent acceptance, revision, evidence, dispute, or exclusion terms;
- resolve blockchain identifiers from unsupported model knowledge;
- infer wallet addresses;
- generate provenance offsets;
- determine compilation or deployment readiness;
- make arbitration or legal decisions; or
- control funds or execution.

## Chain neutrality

Agreement value and settlement asset are separate concepts. The model may extract a stated pricing currency and a stated settlement asset, but canonical network and asset resolution belongs to deterministic infrastructure unless trusted context explicitly supplies those identifiers.

PAI Core remains independent of Ethereum, Stellar, Solana, or future chains. Execution details belong behind the Execution Router and chain adapters.

## Versioning

The following artifacts form one semantic contract:

- agreement schema;
- model-output schema;
- issue registry;
- annotation guide;
- training-example schema; and
- evaluation rubric.

A material change to one artifact requires review of the others. Dataset records MUST name their target versions. Existing labels MUST NOT be silently rewritten after a rule change.

## Repository and event boundary

PAI is an existing project. The repository contains a working product foundation created before ETHOnline, including smart contracts, frontend, backend/authentication, milestone payments, dispute/arbitration logic, settlement logic, tests, and Sepolia integration.

Pre-event AI preparation includes the v0.2 architecture and specification artifacts in this directory. These artifacts MUST be disclosed as pre-existing work under the event's Continuity rules.

The intended event build begins only after the official kickoff and includes:

- production of the versioned dataset;
- baseline-model benchmarking;
- training or adapter tuning;
- tuned-model benchmarking;
- inference-service implementation;
- deterministic validator/fuzzer implementation as selected for event scope;
- product integration; and
- the event demo and evaluation report.

No event-work claim should imply that the existing PAI product or these preparation specifications were created during the event.

## Current non-goals

This directory does not currently contain:

- a production training dataset;
- a trained PAI model;
- a fine-tuning pipeline;
- a model-serving service;
- benchmark results;
- a production deterministic Agreement Fuzzer;
- a deployment-ready multichain router; or
- proof of production readiness.

Do not create `dataset/train`, model weights, adapters, or benchmark-result claims as preparation artifacts if those are intended to be part of the event build.

## Next checkpoint

At official kickoff:

1. verify the preparation branch is clean and pushed;
2. tag the exact pre-event commit;
3. create the event branch from that commit;
4. record the Continuity disclosure;
5. generate the first versioned dataset records; and
6. benchmark the selected untuned baseline before training.
