# ADR-003: ESCT Does Not Custody User Private Keys

Status: Accepted

## Decision

ESCT backend infrastructure will not request, transmit, store or recover user private keys or seed phrases.

Users sign financial transactions with their wallets.

## Consequence

Wallet authentication uses proof-of-wallet-control without transferring key custody to ESCT.
