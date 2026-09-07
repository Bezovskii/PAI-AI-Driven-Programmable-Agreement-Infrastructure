# PAI Arc Settlement Subgraph

Indexes verifiable on-chain settlement and execution history for PAI on Arc Testnet.

## Architecture boundary

PAI Core remains the semantic source of truth.

This subgraph does not own:

- agreement terms or versions
- agreement hashes
- canonical CLIENT / CONTRACTOR identity
- canonical PAI acceptance
- wallet binding
- READY_TO_FUND lifecycle state

AgreementAccepted here means AgreementEscrow contract-level acceptance only.

The Graph indexes blockchain execution facts.

## Network

- Network: Arc Testnet
- Chain ID: 5042002
- Graph network: arc-testnet
- AgreementEscrow: 0x7c97e321fB02446EA9aB14b6734Ad38D186b8CEa
- Arc USDC: 0x3600000000000000000000000000000000000000
- Start block: 60776781

## Indexed entities

- Agreement: on-chain agreement execution projection
- Milestone: on-chain milestone execution projection
- SettlementEvent: append-only transaction/block event history

## V1 lifecycle events

- AgreementCreated
- MilestoneAdded
- AgreementAccepted
- AgreementFunded
- MilestoneSubmitted
- MilestoneReleased
- MilestoneRefunded
- MilestoneDisputeOpened
- MilestoneDisputeResolved
- AgreementCompleted

Administrative and arbitrator-management events are intentionally excluded from V1.

## Studio deployment

- Slug: pai-arc-settlement
- Version: 0.1.0
- Deployment: QmbNzbA36uteZKkCzHkLcEFzsdioZ3tPxrZ8457SCyW3K1

Never commit or document the Studio deploy key.

## Verified Arc happy path

CREATE -> AgreementEscrow ACCEPT -> FUND -> SUBMIT -> RELEASE -> COMPLETED

Live verification:

- Agreement ID 1: COMPLETED
- Total funded: 1000000 USDC base units
- Milestone ID 1: RELEASED
- Milestone amount: 1000000 USDC base units
- Evidence URI and evidence hash indexed
- Transaction, block, log-index and timestamp context indexed
- _meta.hasIndexingErrors = false

This history proves what happened on-chain. It does not replace canonical PAI semantic state.
