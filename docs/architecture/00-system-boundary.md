# ESCT System Boundary

Status: Foundation V1
Branch: feature/production-foundation

## 1. Purpose

ESCT is a hybrid Web3 agreement and settlement system.

The system combines:

- blockchain-enforced financial state;
- off-chain application data;
- private and public delivery evidence;
- wallet-based user authorization;
- indexing and notification infrastructure;
- web and mobile clients.

The blockchain is not the application database.

The backend is not allowed to invent or override financial state.

## 2. Core Trust Boundary

ESCT separates the system into two major domains.

### On-chain trust domain

Responsible for:

- agreement identity;
- participant wallet addresses;
- payment asset;
- milestone monetary amounts;
- escrow custody;
- agreement acceptance;
- funding;
- milestone submission commitment;
- evidence commitment hash;
- milestone release;
- milestone refund;
- milestone dispute state;
- arbitration outcome;
- protocol-level authorization;
- recorded escrow liabilities.

The smart contracts are authoritative for these states.

### Off-chain application domain

Responsible for:

- user profiles;
- agreement titles and rich descriptions;
- private files;
- delivery files;
- GitHub references;
- demo links;
- human-readable delivery notes;
- comments and communication;
- notifications;
- search;
- application preferences;
- blockchain projections and indexes;
- audit presentation;
- operational metadata.

Off-chain systems may describe or index blockchain state.

They may not override blockchain financial state.

## 3. Primary Components

### Web Client

Responsibilities:

- render application state;
- request backend data;
- read blockchain state where appropriate;
- construct wallet transactions;
- request wallet signatures;
- present transaction results.

The web client is untrusted.

Client-side state must never authorize protected backend actions by itself.

### Mobile Client

Responsibilities are equivalent to the Web Client.

Business-critical authorization must not depend only on mobile UI logic.

### ESCT API

Responsible for:

- wallet-authenticated sessions;
- application authorization;
- agreement metadata;
- delivery metadata;
- controlled file access;
- evidence-manifest creation;
- GitHub-related application data;
- notifications;
- audit/application history.

The API never receives or stores user private keys.

### PostgreSQL

Responsible for persistent off-chain application data.

It may contain projections of blockchain state for fast reads.

Blockchain-derived database fields are caches/projections, not financial authority.

### Object Storage

Responsible for:

- delivery files;
- evidence files;
- attachments;
- generated delivery manifests where required.

Files are private by default unless explicitly designated public.

### Blockchain Indexer

Responsible for:

- reading finalized/relevant contract events;
- producing idempotent database projections;
- tracking block and transaction metadata;
- recovering from missed events;
- reconciling database projections with chain state.

Indexer failure must not affect smart-contract correctness.

### Background Worker

Responsible for asynchronous operations such as:

- file hashing;
- evidence-manifest processing;
- notifications;
- retries;
- external integration work.

Workers must use idempotent jobs where duplicate execution is possible.

### Ethereum RPC Provider

An external dependency used to communicate with the blockchain.

RPC availability must not be treated as blockchain truth itself.

### ESCT Smart Contracts

Responsible for financial and protocol-critical state transitions.

The contracts must remain correct even if:

- the frontend is malicious;
- the backend is unavailable;
- PostgreSQL contains stale data;
- the indexer misses events;
- notifications fail.

## 4. Private-Key Boundary

ESCT infrastructure must never request, transmit, log, persist, back up, or recover user private keys or wallet seed phrases.

Financial transactions are signed by the user's wallet.

Backend authentication may use signed messages but must never require transaction-signing keys to leave the wallet.

## 5. Financial Action Boundary

The following actions must ultimately be validated by smart-contract rules:

- fund;
- release;
- refund;
- dispute;
- resolve dispute;
- protocol administration affecting escrow behavior.

A backend database field must never be sufficient authorization to move escrowed value.

## 6. Delivery Evidence Boundary

The application may store complete evidence off-chain.

The blockchain stores a compact cryptographic commitment.

Example:

Contractor uploads delivery
-> ESCT stores private file
-> ESCT creates immutable delivery manifest
-> ESCT hashes the manifest
-> contractor submits the commitment on-chain
-> client reviews off-chain evidence
-> financial decision executes on-chain

The evidence commitment must make later tampering detectable.

## 7. Failure Assumption

Every non-contract component is assumed capable of temporary failure.

Examples:

- frontend crashes;
- API becomes unavailable;
- database becomes unavailable;
- object storage becomes unavailable;
- RPC becomes unavailable;
- worker crashes;
- indexer falls behind;
- external integration fails.

These failures may reduce availability.

They must not independently corrupt protocol financial state.

## 8. Production Principle

A feature is not production-ready merely because its happy path works.

Production readiness requires:

- explicit ownership of data;
- authorization rules;
- state-transition rules;
- failure behavior;
- tests;
- observability;
- recovery strategy;
- deployment procedure.

This document is normative for future ESCT architecture.
