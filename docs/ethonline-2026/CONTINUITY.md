# ETHOnline 2026 Continuity Boundary

## Purpose

PAI is participating in ETHOnline 2026 through the Continuity track.

PAI existed before the event. This document separates the pre-existing product and preparation from work created during ETHOnline. Repository history after the kickoff tag is the primary implementation record.

## Official development boundary

* Event branch: `ethonline-2026`

* Kickoff tag: `ethonline-2026-kickoff`

* Boundary commit: `f507a5d`

* Development start: September 4, 2026

Only work committed after `ethonline-2026-kickoff` may be represented as ETHOnline-created work.

## Pre-existing PAI product

The following existed before ETHOnline:

* Solidity smart contracts

* escrow and agreement funding

* milestone payments

* delivery and approval workflows

* dispute initiation

* evidence architecture

* arbitration logic

* refund and settlement logic

* Hardhat and Foundry development environments

* automated contract and application tests

* React and Vite frontend

* Node.js and TypeScript backend

* ethers.js integration

* SIWE authentication infrastructure

* Sepolia integration

* existing frontend and backend foundations

* a signed pilot

* previous customer discovery

* the chain-independent PAI architecture concept

These components must not be described as newly created during ETHOnline.

## Pre-event agreement-intelligence preparation

The following specifications and validation foundations also existed before the kickoff boundary:

* PAI Agreement Schema v0.2 candidate

* PAI Model Output Schema v0.2 candidate

* semantic issue-code registry v0.2 candidate

* annotation guide v0.2

* adversarial annotation fixtures

* training-example schema v0.2 candidate

* evaluation rubric v0.2

* adversarial evaluation fixtures

* agreement-intelligence architecture documentation

* deterministic schema-validation scripts

These materials define the intended behavior of the intelligence layer but do not constitute a completed trained model, production inference service, Telegram integration, or end-to-end hackathon feature.

## ETHOnline feature

The main ETHOnline feature is the PAI Telegram Agreement Agent.

The target flow is:

1. A user describes a deal through Telegram.

2. The PAI intelligence layer produces a structured Agreement Object.

3. Deterministic validation checks the output against the v0.2 schemas.

4. The Agreement Fuzzer identifies missing, contradictory, or exploitable terms.

5. The user reviews and confirms the agreement.

6. The counterparty accepts the agreement.

7. PAI Core manages funding, delivery, approval, dispute, and settlement.

8. An execution adapter performs the selected on-chain action.

Telegram is an interface. It is not the protocol itself.

The Agreement Object, validation rules, intelligence layer, and PAI Core must remain modular and chain-independent.

## Work to be created during ETHOnline

The planned event-created work includes:

* Telegram bot or Mini App integration

* an agreement-creation conversation flow

* clarification-question handling

* the frozen model prompt and output contract

* a versioned ETHOnline dataset

* an untouched-model baseline

* matched evaluation of baseline and tuned models

* local model tuning or another measurable model-improvement method

* an inference runner or service

* raw model-output recording

* deterministic schema validation

* deterministic agreement fuzzing

* human review and confirmation

* connection to the existing PAI agreement lifecycle

* one complete sponsor-backed settlement flow

* end-to-end tests

* reproducible setup documentation

* the final demo and evaluation report

Items that are not completed and demonstrated must not be claimed as completed integrations.

## Local-model work performed after kickoff

After the kickoff boundary:

* Ubuntu 24.04 under WSL2 was prepared for local model work.

* GPU-enabled PyTorch and Unsloth were installed.

* CUDA execution was verified on an NVIDIA RTX 4060 Laptop GPU.

* `unsloth/Qwen3-4B-Instruct-2507-bnb-4bit` was loaded successfully.

* The untouched model generated the smoke-test response `{"status":"ok"}`.

* repeated environment import and GPU checks passed.

This proves that the local environment can load and run the selected model. It is not yet a formal model-quality baseline and does not prove agreement-extraction accuracy.

## Safety and authority boundary

PAI follows this rule:

* AI advises.

* Humans confirm and decide.

* Deterministic software validates.

* The protocol executes.

The model must not have unilateral authority to:

* move funds

* accept an agreement

* approve delivery

* resolve a dispute

* act as the final arbitrator

* invent missing commercial terms

* convert deterministic calculations into unsupported extraction claims

## Scope discipline

The committed MVP is:

* Telegram

* local agreement intelligence

* the v0.2 Agreement Object

* deterministic validation

* agreement fuzzing

* human confirmation

* the existing PAI lifecycle

* one complete on-chain settlement path

Additional sponsor integrations are stretch work. They will only be included in the submission if they are implemented, tested, and visible in the end-to-end demonstration.

## Evidence and claim discipline

Hackathon work will be supported by:

* commits after `ethonline-2026-kickoff`

* source files on the `ethonline-2026` branch

* reproducible commands

* test and evaluation results

* raw model outputs where relevant

* comparison reports

* deployment or transaction evidence

* the final demonstration video

The final submission must explicitly distinguish:

1. what existed before ETHOnline;

2. what was prepared before ETHOnline;

3. what was implemented during ETHOnline; and

4. what remains planned or incomplete.
