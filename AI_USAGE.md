# AI Usage Disclosure

PAI uses AI in two distinct ways:

1. AI-assisted software development.
2. AI as part of the PAI product architecture.

## AI-Assisted Development

During ETHOnline 2026, AI tools including ChatGPT/OpenAI tooling assisted with:

- architecture and technical planning
- debugging and error analysis
- test planning and review
- Solidity, TypeScript and React development assistance
- local development and deployment commands
- documentation
- integration planning

AI-assisted output was reviewed, tested and integrated under human direction.

The founder made the product, architecture, scope and final integration decisions.

AI tools did not autonomously approve agreements, bind wallets, authorize settlement or release funds.

## AI Inside PAI

PAI also contains an AI layer for interpreting natural-language agreements.

The ETHOnline AI work included:

- Qwen3 4B Instruct
- QLoRA fine-tuning
- local inference
- structured Agreement Object extraction
- strict JSON output
- schema validation
- source provenance

The preserved final inference successfully extracted parties, roles, deliverable, amount, deadline, acceptance authority and payment trigger.

## Submitted Runtime Status

Model training and local inference were completed and verified during ETHOnline 2026.

However, the submitted Telegram runtime still used the existing backend Intelligence stub.

The submitted Telegram bot did not yet directly invoke the locally fine-tuned Qwen model.

Telegram itself successfully supported agreement creation, free-text input, backend communication and multi-turn clarification accumulation.

This distinction is documented so the repository does not overstate what was live in the submitted build.

## Why PAI Does Not Trust the LLM

PAI deliberately does not treat model output as authoritative.

In the final preserved inference, the model normalized `$1,000` as USD even though the source text itself only established the `$` symbol.

The model also failed to report several semantic weaknesses.

PAI therefore separates AI interpretation from deterministic validation, human consent and protocol execution.

The intended architecture is:

```text
Natural language
        |
        v
AI interpretation
        |
        v
Agreement Object + provenance
        |
        v
Deterministic Agreement Stress Test
        |
        v
Human clarification and review
        |
        v
Canonical agreement
        |
        v
Exact dual-party acceptance
        |
        v
Wallet binding
        |
        v
READY_TO_FUND
        |
        v
Execution adapter
```

At the ETHOnline submission point, the deterministic Agreement Stress Test was not yet fully integrated into the live Telegram runtime.

## Human and Protocol Control

AI cannot bypass the PAI lifecycle.

Both parties must accept the exact same agreement ID, version and hash. Wallet binding is separate, and the agreement reaches `READY_TO_FUND` only after the required acceptance and wallet-binding conditions are satisfied.

During ETHOnline 2026:

- Arc provided settlement execution proof.
- The Graph indexed settlement history and execution proof.
- Uniswap routing was explored as an optional pre-settlement conversion layer.

AI does not directly authorize these blockchain transactions.

## Principle

> AI interprets.
> Deterministic systems verify.
> Humans consent.
> Protocols execute.
