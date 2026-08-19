# ESCT Protocol

**Programmable agreement infrastructure for milestone-based Web3 work.**

ESCT Protocol lets two parties create a digital agreement, define milestone-based work, explicitly accept the terms, fund escrow, submit delivery evidence, release payments, and resolve disputes through a deterministic on-chain lifecycle.

Payments are a capability inside the agreement system — not the entire product.

---

## What ESCT solves

Digital work often depends on fragmented trust:

- agreements live in documents or chat threads
- payments happen somewhere else
- delivery evidence is difficult to verify
- milestone state is ambiguous
- disputes depend on manual interpretation
- reputation is disconnected from execution history

ESCT brings the agreement lifecycle and financial settlement into one programmable system.

---

## Agreement lifecycle

```text
Create Agreement
      |
      v
Define Milestones
      |
      v
Contractor Accepts
      |
      v
Client Funds Escrow
      |
      v
Contractor Delivers + Evidence
      |
      v
Client Approves / Disputes
      |
      v
Release / Arbitration / Refund
      |
      v
Agreement Completed
```

---

## Current Agreement V1

The current product focus is `contracts/AgreementEscrow.sol`.

Agreement V1 supports:

- agreement creation
- client and contractor roles
- milestone definitions
- explicit contractor acceptance
- ETH escrow funding
- ERC20-aware architecture
- delivery submission
- evidence URI
- evidence commitment / proof hash
- milestone approval and release
- disputes
- arbitration
- refunds and dispute resolution
- deterministic agreement completion

### Agreement states

```text
Proposed
Accepted
Active
Completed
Cancelled
```

### Milestone states

```text
Pending
Submitted
Disputed
Released
Refunded
```

---

## Architecture

ESCT uses a hybrid architecture with a strict trust boundary:

> **Blockchain is the financial source of truth.**

The backend provides application services but does not override blockchain financial state and never holds user private keys.

```text
ESCT Protocol
|
|-- contracts/
|   |-- AgreementEscrow.sol
|   |-- multiPayment.sol
|   `-- mocks/
|
|-- backend/
|   |-- Fastify
|   |-- TypeScript
|   |-- Prisma
|   |-- PostgreSQL
|   `-- SIWE authentication
|
|-- frontend/
|   |-- React
|   |-- Vite
|   |-- Ethers.js
|   `-- MetaMask
|
|-- docs/
|   |-- architecture/
|   |-- adr/
|   `-- backend/
|
|-- test/
`-- test-foundry/
```

### Blockchain responsibilities

The protocol contracts own financial truth and state transitions:

- agreement identity
- participant wallet addresses
- payment asset
- milestone amounts
- escrow custody
- agreement acceptance
- funding
- milestone state
- evidence commitment hash
- milestone release and refund
- dispute state
- arbitration result
- protocol authorization
- escrow liabilities

### Backend responsibilities

The backend handles application-layer services:

- wallet-authenticated sessions
- rich agreement metadata
- delivery metadata and private files
- GitHub references
- human-readable evidence
- comments
- notifications
- search
- preferences
- indexes and projections
- application history

Financial transactions remain wallet-signed.

---

## Wallet authentication

ESCT uses **SIWE — Sign-In with Ethereum**.

```text
Wallet connects
   |
Request nonce
   |
Sign EIP-4361 message
   |
Backend verifies signature
   |
Wallet-bound session created
   |
HttpOnly session cookie
```

Current auth endpoints:

```text
POST /api/v1/auth/nonce
POST /api/v1/auth/verify
GET  /api/v1/auth/session
POST /api/v1/auth/logout
```

The backend never receives or stores user private keys.

---

## Security and testing

ESCT is built around explicit state machines, protocol invariants, adversarial testing, and failure analysis.

The wider project includes 120+ tests across contract, backend, boundary, fault, and invariant work, including:

- Hardhat unit tests
- Agreement lifecycle tests
- Agreement dispute tests
- ERC20 tests
- adversarial tests
- state-transition tests
- Foundry boundary tests
- Foundry fault tests
- invariant tests
- reentrancy scenarios
- fee-on-transfer token scenarios
- rejecting receiver scenarios
- backend authentication lifecycle tests

Security work also includes:

- Slither analysis and triage
- protocol invariants
- threat model
- failure model
- system-boundary documentation
- production-readiness analysis

Key architecture documents:

```text
docs/architecture/00-system-boundary.md
docs/architecture/01-source-of-truth.md
docs/architecture/02-protocol-invariants.md
docs/architecture/03-state-machines.md
docs/architecture/04-failure-model.md
docs/architecture/05-threat-model.md
docs/architecture/08-production-readiness-gate.md
```

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

---

## Local development

Run the stack in separate terminals.

### 1. PostgreSQL

```powershell
cd backend
docker compose up -d postgres
docker compose ps
```

### 2. Local Ethereum network

From the repository root:

```powershell
npx.cmd hardhat node
```

```text
RPC: http://localhost:8545
Chain ID: 31337
```

### 3. Deploy contracts

```powershell
npx.cmd hardhat run scripts/deploy.js --network localhost
npx.cmd hardhat run scripts/deployAgreement.js --network localhost
```

A fresh Hardhat node requires fresh deployments.

### 4. Backend

```powershell
cd backend
npx.cmd prisma migrate deploy
npm.cmd run dev
```

```text
http://127.0.0.1:3001
```

### 5. Frontend

```powershell
cd frontend
npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

Use `localhost`, not `127.0.0.1`, because the current local SIWE configuration binds the authentication domain to `localhost:5173`.

---

## Deterministic demo flow

The current demo demonstrates the complete two-party agreement lifecycle:

```text
Client creates agreement
        |
Adds milestone
        |
Contractor accepts
        |
Client funds escrow
        |
Contractor submits delivery evidence
        |
Client approves milestone
        |
Funds are released
        |
Agreement completes
```

Expected final state:

```text
Agreement: Completed
Milestone: Released
Remaining escrow: 0
```

---

## Legacy payment engine

`contracts/multiPayment.sol` is retained as part of the project's technical evolution.

It includes earlier work on:

- ETH direct payments
- ETH escrow
- ERC20 direct payments
- ERC20 escrow
- confirmation
- refunds
- disputes
- arbitration

ESCT has since evolved from a payment/escrow engine into programmable agreement infrastructure.

---

## Product direction

ESCT is initially focused on:

- Web3 freelancers
- crypto-native clients
- agencies
- DAO contributors
- milestone-based service work

Future layers may include reputation, company/team workflows, private evidence infrastructure, APIs/SDKs, interoperability, and broader agreement integrations.

Those layers are roadmap work. Agreement V1 is the current product foundation.

---

## Project status

ESCT is under active development.

The current repository contains:

- working Agreement V1 contracts
- hybrid backend architecture
- SIWE wallet authentication
- PostgreSQL application layer
- working React frontend
- milestone lifecycle UI
- delivery evidence handling
- dispute and arbitration paths
- extensive contract and backend testing
- architecture and security documentation

---

## License

MIT License.

Copyright (c) 2026 Behzad Khoshian
