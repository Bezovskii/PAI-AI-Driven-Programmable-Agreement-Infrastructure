# PAI — Programmable Agreement Infrastructure

**AI-native programmable agreements for real-world digital work.**

PAI turns natural-language deals into structured, programmable workflows that can be accepted, funded, delivered, disputed, and settled on-chain.

> **AI advises. Human decides. Protocol executes.**

PAI is designed so the agreement model and intelligence layer remain **chain-independent**, while execution and settlement happen through modular adapters.

---

## Core lifecycle

```text
DEFINE → ACCEPT → FUND → DELIVER → SETTLE
```

Exception path:

```text
DISPUTE → EVIDENCE → ARBITRATION → RESOLUTION
```

PAI is built around explicit state transitions, wallet-signed financial actions, milestone-based execution, and deterministic settlement.

---

## Why PAI exists

Digital work still depends on fragmented trust:

- agreements live in documents, DMs, or chat threads
- payment is handled somewhere else
- milestones are often ambiguous
- delivery evidence is disconnected from payment
- disputes depend on manual interpretation
- blockchain users face unnecessary wallet, token, and network friction

PAI connects the agreement lifecycle to programmable execution.

The goal is not to make users think about smart contracts.

The goal is to let users define a real agreement in plain language and have PAI turn it into a structured, reviewable, fundable workflow.

---

## Architecture

```text
Natural Language
      ↓
PAI Intelligence
      ↓
Agreement Object
      ↓
Agreement Fuzzer / Stress Test
      ↓
Human Review + Acceptance
      ↓
PAI Core
      ↓
Execution Router
      ↓
Chain / Settlement Adapter
```

The critical architectural boundary is:

**PAI Core is not tied to a single blockchain.**

Ethereum, Arc, Hedera, Stellar, Solana, or future networks should be integrated through adapters rather than by rewriting the agreement model or intelligence layer.

---

## Agreement Object

PAI represents each agreement as structured data rather than only legal prose.

A simplified Agreement Object can contain:

```text
Agreement
├── id
├── parties[]
├── roles[]
├── totalValue
├── settlementAsset
├── milestones[]
│   ├── amount
│   ├── deadline
│   ├── deliverable
│   ├── acceptanceCriteria
│   ├── releaseConditions
│   └── disputeWindow
├── fundingConditions
├── disputeRules
├── arbitrationRules
├── evidenceReferences
└── metadata
```

The Agreement Object is intended to remain independent from the user interface and settlement chain.

---

## Agreement Fuzzer

PAI does not only ask whether an agreement is syntactically valid.

It asks:

> **How could either party abuse this agreement?**

The stress-test layer is designed to detect problems such as:

- undefined acceptance criteria
- contradictory deadlines
- indefinite approval periods
- missing dispute-resolution paths
- ambiguous partial delivery
- inconsistent payment and release conditions
- exploitable milestone states
- impossible state transitions

The AI can identify issues and recommend changes.

It does **not** get unilateral authority to move funds or make final arbitration decisions.

---

## Current product foundation

The repository already contains the existing PAI / ESCT technical foundation, including:

- Solidity smart contracts
- agreement creation
- milestone-based work
- explicit counterparty acceptance
- escrow funding
- delivery submission
- evidence references and proof commitments
- milestone approval and release
- disputes
- arbitration
- refunds and resolution
- deterministic agreement completion
- Fastify + TypeScript backend
- Prisma + PostgreSQL
- SIWE authentication
- React / Vite frontend
- Ethers.js integration
- Hardhat + Foundry testing
- security and architecture documentation

The backend provides application services while blockchain contracts remain the financial source of truth.

Private keys are never held by the backend.

---

## Existing agreement lifecycle

```text
Create Agreement
      ↓
Define Milestones
      ↓
Counterparty Accepts
      ↓
Client Funds Escrow
      ↓
Contractor Delivers + Evidence
      ↓
Client Approves / Disputes
      ↓
Release / Arbitration / Refund
      ↓
Agreement Completed
```

---

# ETHOnline 2026 — Continuity Track

PAI is participating in **ETHOnline 2026** as an existing project under the **Continuity / Ship a Feature** model.

This repository intentionally separates pre-existing PAI work from new ETHOnline work.

## Pre-existing before the official ETHOnline build window

The following existed before the official ETHOnline build start:

- PAI Core agreement lifecycle
- escrow and milestone logic
- dispute and arbitration flows
- settlement infrastructure
- backend and frontend foundations
- wallet authentication
- existing smart contracts and tests
- chain-independent PAI architecture work
- initial Telegram bot skeleton and agreement entry flow
- pre-existing AI / intelligence specifications and research

These are **not** claimed as ETHOnline-built features.

## Planned ETHOnline Continuity feature

The main Continuity feature is the:

# PAI Telegram Agreement Agent

Target workflow:

```text
Telegram
    ↓
Natural-language agreement
    ↓
PAI Intelligence API
    ↓
Structured Agreement Object
    ↓
Agreement Fuzzer
    ↓
Clarification loop
    ↓
Human review
    ↓
Counterparty acceptance
    ↓
Funding
    ↓
Delivery
    ↓
Approval / Dispute
    ↓
Settlement
```

New ETHOnline functionality will be developed **after the official event start** and tracked through normal Git history.

Planned work includes:

- Telegram ↔ PAI Intelligence integration
- structured Agreement Object rendering in Telegram
- conversational clarification / Fuzzer workflow
- counterparty invitation and acceptance
- wallet and funding flow
- The Graph integration for live on-chain context used by the intelligence layer
- Uniswap integration for settlement-asset conversion where required
- Arc adapter for programmable USDC settlement

**The items above are planned Continuity work and should not be interpreted as completed until corresponding post-start commits exist.**

---

## Target ETHOnline integration architecture

```text
                    Telegram
                       ↓
                PAI Intelligence
                       ↑
                  The Graph
             live on-chain context
                       ↓
                Agreement Object
                       ↓
                Agreement Fuzzer
                       ↓
                  Human Review
                       ↓
                    PAI Core
                       ↓
             Funding / Execution
                  ↙         ↘
             Uniswap      direct asset
                  ↘         ↙
              Execution Router
                       ↓
                  Arc Adapter
                       ↓
              USDC Settlement
```

The integrations serve different responsibilities:

- **The Graph** → indexed on-chain context for AI reasoning
- **Uniswap** → asset conversion and funding liquidity
- **Arc** → programmable USDC settlement

The goal is one coherent product flow, not a collection of sponsor integrations.

---

## Telegram interface principle

Telegram is an interface — not the protocol.

```text
Telegram Bot / Mini App
        ↓
Telegram Service
        ↓
PAI Backend API
        ↓
Intelligence / Agreement Object / Fuzzer
        ↓
PAI Core
        ↓
Execution Router
        ↓
Settlement Infrastructure
```

Business logic, settlement authority, and financial truth do not belong inside Telegram handlers.

Users must explicitly authorize wallet transactions.

PAI never asks users for seed phrases or private keys.

---

## Technology

### Smart contracts

- Solidity
- Hardhat
- Foundry
- Ethers.js

### Backend

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- SIWE
- TypeBox
- ethers.js

### Frontend

- React
- Vite
- Ethers.js
- MetaMask

### Telegram feature

- Node.js
- TypeScript
- Telegram Bot API
- Telegram Mini App for wallet-dependent actions

---

## Security model

PAI is designed around explicit trust boundaries.

### Protocol / blockchain

Responsible for:

- agreement identity
- participant wallet addresses
- payment asset
- escrow custody
- milestone state
- release / refund rules
- dispute state
- settlement

### Backend

Responsible for:

- wallet-authenticated sessions
- metadata
- evidence references
- notifications
- indexes
- application history
- intelligence orchestration

### AI

Responsible for:

- agreement structuring
- ambiguity detection
- risk analysis
- stress testing
- recommendations

AI does **not** independently custody funds, sign transactions, or make final arbitration decisions.

---

## Local development

Run the stack in separate terminals.

### PostgreSQL

```powershell
cd backend
docker compose up -d postgres
docker compose ps
```

### Local Ethereum network

From the repository root:

```powershell
npx.cmd hardhat node
```

```text
RPC: http://localhost:8545
Chain ID: 31337
```

### Deploy contracts

```powershell
npx.cmd hardhat run scripts/deploy.js --network localhost
npx.cmd hardhat run scripts/deployAgreement.js --network localhost
```

### Backend

```powershell
cd backend
npx.cmd prisma migrate deploy
npm.cmd run dev
```

### Frontend

```powershell
cd frontend
npm.cmd run dev
```

---

## Continuity evidence

Pre-ETHOnline repository snapshots are tagged in Git.

Key tags:

```text
pre-ethonline-2026
pre-ethonline-ai-spec-2026
pre-ethonline-2026-final
```

The final pre-start snapshot explicitly includes the initial Telegram bot skeleton.

Post-start ETHOnline development should remain visible through incremental commits on the dedicated hackathon branch.

---

## License

MIT License.

Copyright (c) 2026 Behzad Khoshian
