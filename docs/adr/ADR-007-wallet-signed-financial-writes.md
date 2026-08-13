# ADR-007: Financial Writes Remain Wallet-Signed Contract Transactions

Status: Accepted

## Decision

Backend API mutations are not substitutes for user-authorized financial contract transactions.

Funding, release, refund and other user-controlled financial actions remain wallet-signed and validated by smart contracts.

## Consequence

The backend coordinates and observes these operations but does not invent financial authority.
