#!/usr/bin/env python3
"""Build the deterministic PAI registry-coverage readiness supplement v0.2.

This builder creates DRAFT records only:
- coverage for every issue-registry code absent from the currently adjudicated
  train corpus, isolated when semantically valid;
- six independently designed multi-issue composition records plus any
  unavoidable identifier-dependency composition;
- four clean negatives reinforcing sparse issue selection.

No generated record is training-ready until separately human-adjudicated with
review_dataset.py. Existing adjudicated corpora are never modified.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

from build_seed_corpus import (
    absolute_deadline,
    acceptance,
    empty_agreement,
    fiat_asset,
    issue,
    milestone,
    party,
    provenance,
    record,
)

GENERATOR = "pai-registry-coverage-supplement-v0.2"
CORPUS_VERSION = "pai.readiness-supplement.v0.2"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "readiness-supplement-v0.2"
REGISTRY_PATH = Path("docs/ai/schema/pai-issue-codes-v0.2.json")
EVALUATOR_PATH = Path("docs/ai/annotation/fixtures/pai-annotation-adversarial-v0.2.json")
BASE_TRAIN = (
    Path("ai/ethonline/dataset/seed-v0.1-adjudicated/train.jsonl"),
    Path("ai/ethonline/dataset/readiness-supplement-v0.1-adjudicated/train.jsonl"),
)

PROVIDER = "Rhea"
CLIENT = "Leon"
WORK = "create a launch page"
AMOUNT = "1200"
CODE = "USD"
DATE = "2027-03-15"
CRITERIA = "the page matches the approved layout"


def money(amount: str, code: str | None, symbol: str | None = None) -> dict[str, Any]:
    return {"amount": amount, "currency": {"code": code, "symbol": symbol}}


def token_asset(symbol: str | None, network: str | None, asset: str | None) -> dict[str, Any]:
    return {"type": "token", "symbol": symbol, "networkId": network, "assetId": asset}


def pay(
    *,
    amount: dict[str, Any] | None,
    payer: str | None = "party_2",
    recipient: str | None = "party_1",
    trigger: str = "milestone_accepted",
    milestone_id: str | None = "milestone_1",
    amount_type: str = "fixed",
) -> dict[str, Any]:
    if trigger not in {"milestone_accepted", "milestone_delivered"}:
        milestone_id = None
    return {
        "id": "payment_1",
        "purpose": "release",
        "amountType": amount_type,
        "amount": amount,
        "sharePercent": None,
        "payerPartyId": payer,
        "recipientPartyId": recipient,
        "trigger": {"type": trigger, "milestoneId": milestone_id, "timing": None},
    }


def base_agreement() -> dict[str, Any]:
    value = empty_agreement()
    value["parties"] = [
        party("party_1", PROVIDER, ["provider", "payee"]),
        party("party_2", CLIENT, ["client", "payer"]),
    ]
    value["scope"] = {"summary": WORK, "deliverables": [WORK], "exclusions": []}
    value["pricing"] = {
        "total": money(AMOUNT, CODE),
        "settlementAsset": fiat_asset(CODE),
    }
    value["milestones"] = [
        milestone(
            WORK,
            [WORK],
            absolute_deadline(DATE),
            acceptance(True, "party_2", [CRITERIA]),
        )
    ]
    value["payments"] = [pay(amount=money(AMOUNT, CODE))]
    return value


def base_text(extra: str = "") -> str:
    text = (
        f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
        f"{CLIENT} will pay {PROVIDER} by bank transfer after {CLIENT} accepts delivery. "
        f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
    )
    return text if not extra else f"{text} {extra}"


def base_provenance() -> list[dict[str, str]]:
    return [
        provenance("/agreement/parties/0/displayName", PROVIDER),
        provenance("/agreement/parties/1/displayName", CLIENT),
        provenance("/agreement/scope/deliverables/0", WORK),
        provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
        provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
        provenance("/agreement/milestones/0/deadline/date", DATE),
    ]


def draft(
    slug: str,
    text: str,
    agreement: dict[str, Any],
    issues: list[dict[str, Any]],
    prov: list[dict[str, str]],
    phenomena: list[str],
    *,
    difficulty: str = "adversarial",
) -> dict[str, Any]:
    value = record(
        example_id=f"pai_v0_2_train_registry_{slug}_001",
        split="train",
        family=f"train_registry_{slug}",
        text=text,
        agreement=agreement,
        issues=issues,
        provenance_entries=prov,
        phenomena=phenomena,
        difficulty=difficulty,
    )
    value["metadata"]["generator"] = GENERATOR
    value["metadata"]["notes"] = [
        "Synthetic registry-coverage draft; requires separate human adjudication before training.",
        "Designed from the issue registry and schema, not from evaluator source templates.",
    ]
    return value


def single_issue_record(code: str) -> dict[str, Any]:
    a = base_agreement()
    text = base_text()
    prov = base_provenance()
    paths: list[str]
    evidence: list[str] = []
    kind: str
    slug = code.lower()

    # missing_term ----------------------------------------------------------
    if code == "MISSING_PARTY":
        kind = "missing_term"
        text = (
            f"An unnamed provider will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
            f"{CLIENT} will pay by bank transfer after accepting delivery. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["parties"] = [
            {
                "id": "party_1",
                "reference": "unknown",
                "displayName": None,
                "roles": ["provider"],
            },
            party("party_2", CLIENT, ["client", "payer"]),
        ]
        a["payments"] = [pay(amount=money(AMOUNT, CODE), payer="party_2", recipient=None)]
        a["milestones"][0]["acceptance"]["approverPartyId"] = "party_2"
        paths = ["/agreement/parties"]
        prov = [
            provenance("/agreement/parties/1/displayName", CLIENT),
            provenance("/agreement/scope/deliverables/0", WORK),
            provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "MISSING_SCOPE":
        kind = "missing_term"
        text = (
            f"{PROVIDER} will provide services for {CLIENT} for {AMOUNT} {CODE}. "
            f"{CLIENT} will pay after approval. Approval requires {CRITERIA}. "
            f"The engagement ends {DATE}. The agreement does not describe the work."
        )
        a["scope"] = {"summary": None, "deliverables": [], "exclusions": []}
        a["milestones"][0]["description"] = "provide services"
        a["milestones"][0]["deliverables"] = []
        paths = ["/agreement/scope"]
        prov = [
            provenance("/agreement/parties/0/displayName", PROVIDER),
            provenance("/agreement/parties/1/displayName", CLIENT),
            provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
            provenance("/agreement/milestones/0/description", "provide services"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "MISSING_DELIVERABLE":
        kind = "missing_term"
        summary = "provide launch consulting"
        text = (
            f"{PROVIDER} will {summary} for {CLIENT} for {AMOUNT} {CODE}. "
            f"{CLIENT} will pay after approval. Approval requires a completed consulting engagement. "
            f"The engagement ends {DATE}. No concrete deliverable is stated."
        )
        a["scope"] = {"summary": summary, "deliverables": [], "exclusions": []}
        a["milestones"][0]["description"] = "completed consulting engagement"
        a["milestones"][0]["deliverables"] = []
        a["milestones"][0]["acceptance"]["criteria"] = ["completed consulting engagement"]
        paths = ["/agreement/scope/deliverables", "/agreement/milestones/0/deliverables"]
        prov = [
            provenance("/agreement/parties/0/displayName", PROVIDER),
            provenance("/agreement/parties/1/displayName", CLIENT),
            provenance("/agreement/scope/summary", summary),
            provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
            provenance("/agreement/milestones/0/description", "completed consulting engagement"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", "completed consulting engagement"),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "MISSING_PRICE":
        kind = "missing_term"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT}. The fee will be denominated in USD, but no amount is stated. "
            f"{CLIENT} will pay after acceptance. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"]["total"] = None
        a["payments"][0]["amount"] = None
        a["payments"][0]["amountType"] = "unspecified"
        paths = ["/agreement/pricing/total", "/agreement/payments/0/amount"]
        prov = [
            provenance("/agreement/parties/0/displayName", PROVIDER),
            provenance("/agreement/parties/1/displayName", CLIENT),
            provenance("/agreement/scope/deliverables/0", WORK),
            provenance("/agreement/pricing/settlementAsset/symbol", "USD"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "MISSING_CURRENCY":
        kind = "missing_term"
        network = "eip155:8453"
        asset = "eip155:8453/erc20:0x0000000000000000000000000000000000000001"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for 1200, with no currency code or symbol attached to the amount. "
            f"Settlement uses USDC on {network} with asset identifier {asset}. "
            f"{CLIENT} pays after acceptance. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"] = {
            "total": money("1200", None, None),
            "settlementAsset": token_asset("USDC", network, asset),
        }
        a["payments"][0]["amount"] = money("1200", None, None)
        paths = ["/agreement/pricing/total/currency", "/agreement/payments/0/amount/currency"]
        prov = [
            provenance("/agreement/parties/0/displayName", PROVIDER),
            provenance("/agreement/parties/1/displayName", CLIENT),
            provenance("/agreement/scope/deliverables/0", WORK),
            provenance("/agreement/pricing/total/amount", "1200"),
            provenance("/agreement/pricing/settlementAsset/networkId", network),
            provenance("/agreement/pricing/settlementAsset/assetId", asset),
            provenance("/agreement/pricing/settlementAsset/symbol", "USDC"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "MISSING_SETTLEMENT_ASSET":
        kind = "missing_term"
        text = base_text("The agreement does not state the settlement asset or payment medium.")
        a["pricing"]["settlementAsset"] = None
        paths = ["/agreement/pricing/settlementAsset"]
    elif code == "MISSING_SETTLEMENT_NETWORK":
        kind = "missing_term"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} USD. "
            f"Settlement must use USDC, but no blockchain network is stated. "
            f"{CLIENT} pays after acceptance. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"]["settlementAsset"] = token_asset("USDC", None, None)
        paths = ["/agreement/pricing/settlementAsset/networkId"]
        prov = [
            provenance("/agreement/parties/0/displayName", PROVIDER),
            provenance("/agreement/parties/1/displayName", CLIENT),
            provenance("/agreement/scope/deliverables/0", WORK),
            provenance("/agreement/pricing/total/amount", f"{AMOUNT} USD"),
            provenance("/agreement/pricing/settlementAsset/symbol", "USDC"),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "MISSING_DEADLINE":
        kind = "missing_term"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
            f"{CLIENT} will pay after acceptance. Acceptance requires {CRITERIA}. No delivery deadline is stated."
        )
        a["milestones"][0]["deadline"] = None
        paths = ["/agreement/milestones/0/deadline"]
        prov = [x for x in prov if x["path"] != "/agreement/milestones/0/deadline/date"]
    elif code == "MISSING_PAYMENT_TRIGGER":
        kind = "missing_term"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
            f"{CLIENT} will pay {PROVIDER} {AMOUNT} {CODE} by bank transfer, but no payment timing or trigger is stated. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["payments"][0]["trigger"] = {"type": "unspecified", "milestoneId": None, "timing": None}
        paths = ["/agreement/payments/0/trigger"]
    elif code == "MISSING_ACCEPTANCE_AUTHORITY":
        kind = "missing_term"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
            f"Acceptance is required and requires {CRITERIA}, but the agreement does not say who may approve. "
            f"Payment follows acceptance. Delivery is due {DATE}."
        )
        a["milestones"][0]["acceptance"]["approverPartyId"] = None
        paths = ["/agreement/milestones/0/acceptance/approverPartyId"]

    # ambiguity -------------------------------------------------------------
    elif code == "AMBIGUOUS_PARTY":
        kind = "ambiguity"
        e = "Payment recipient is Sam"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
            f"The agreement lists Sam Lee and Sam Patel as payment contacts. {e}, without saying which Sam. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["parties"].extend([
            party("party_3", "Sam Lee", ["other"]),
            party("party_4", "Sam Patel", ["other"]),
        ])
        a["payments"][0]["recipientPartyId"] = None
        evidence = [e]
        paths = ["/agreement/parties"]
        prov += [
            provenance("/agreement/parties/2/displayName", "Sam Lee"),
            provenance("/agreement/parties/3/displayName", "Sam Patel"),
        ]
    elif code == "AMBIGUOUS_PARTY_ROLE":
        kind = "ambiguity"
        e = "The agreement does not identify which of Jordan and Casey is the provider and which is the client"
        text = (
            f"Jordan and Casey are the two parties to a 1200 USD launch-page agreement. {e}. "
            f"Payment is by bank transfer after acceptance. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["parties"] = [
            party("party_1", "Jordan", ["unknown"]),
            party("party_2", "Casey", ["unknown"]),
        ]
        a["payments"][0]["payerPartyId"] = None
        a["payments"][0]["recipientPartyId"] = None
        a["milestones"][0]["acceptance"]["approverPartyId"] = None
        evidence = [e]
        paths = ["/agreement/parties"]
        prov = [
            provenance("/agreement/parties/0/displayName", "Jordan"),
            provenance("/agreement/parties/1/displayName", "Casey"),
            provenance("/agreement/pricing/total/amount", "1200 USD"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "AMBIGUOUS_SCOPE":
        kind = "ambiguity"
        e = "The work is either a single launch page or a complete five-page website, with the choice left open"
        text = (
            f"{PROVIDER} will work for {CLIENT} for {AMOUNT} {CODE}. {e}. "
            f"{CLIENT} pays after acceptance. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["scope"] = {"summary": None, "deliverables": [], "exclusions": []}
        a["milestones"][0]["description"] = e
        a["milestones"][0]["deliverables"] = []
        evidence = [e]
        paths = ["/agreement/scope"]
        prov = [
            provenance("/agreement/parties/0/displayName", PROVIDER),
            provenance("/agreement/parties/1/displayName", CLIENT),
            provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
            provenance("/agreement/milestones/0/description", e),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "AMBIGUOUS_SETTLEMENT_ASSET":
        kind = "ambiguity"
        e = "Settlement will use either USDC or USDT"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} USD. {e} on eip155:8453, "
            f"and the agreement does not choose between them. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"]["settlementAsset"] = token_asset(None, "eip155:8453", None)
        evidence = [e]
        paths = ["/agreement/pricing/settlementAsset"]
        prov += [provenance("/agreement/pricing/settlementAsset/networkId", "eip155:8453")]
    elif code == "AMBIGUOUS_SETTLEMENT_NETWORK":
        kind = "ambiguity"
        e = "USDC may settle on either eip155:8453 or eip155:42161"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} USD. {e}, with no network selected. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"]["settlementAsset"] = token_asset("USDC", None, None)
        evidence = [e]
        paths = ["/agreement/pricing/settlementAsset/networkId"]
        prov += [provenance("/agreement/pricing/settlementAsset/symbol", "USDC")]
    elif code == "AMBIGUOUS_DEADLINE":
        kind = "ambiguity"
        e = "Delivery will be on either 2027-03-15 or 2027-03-16, with the final date left open"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
            f"{CLIENT} pays after acceptance. Acceptance requires {CRITERIA}. {e}."
        )
        a["milestones"][0]["deadline"] = None
        evidence = [e]
        paths = ["/agreement/milestones/0/deadline"]
        prov = [x for x in prov if x["path"] != "/agreement/milestones/0/deadline/date"]
    elif code == "AMBIGUOUS_PAYMENT_TRIGGER":
        kind = "ambiguity"
        e = "Payment is due after either delivery or acceptance, and the agreement leaves which trigger applies undecided"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. {e}. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["payments"][0]["trigger"] = {"type": "unspecified", "milestoneId": None, "timing": None}
        evidence = [e]
        paths = ["/agreement/payments/0/trigger"]
    elif code == "AMBIGUOUS_ACCEPTANCE_AUTHORITY":
        kind = "ambiguity"
        e = "Either Leon or Mara may give final approval, and the agreement does not choose between them"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. Mara is also an approver. "
            f"{e}. Acceptance requires {CRITERIA}. Payment follows acceptance. Delivery is due {DATE}."
        )
        a["parties"].append(party("party_3", "Mara", ["other"]))
        a["milestones"][0]["acceptance"]["approverPartyId"] = None
        evidence = [e]
        paths = ["/agreement/milestones/0/acceptance/approverPartyId"]
        prov += [provenance("/agreement/parties/2/displayName", "Mara")]
    elif code == "AMBIGUOUS_REVISION_SCOPE":
        kind = "ambiguity"
        e = "Two revision rounds are included, but the agreement does not say whether they apply to the whole agreement or only the launch-page milestone"
        text = base_text(e + ".")
        a["revisionTerms"] = [{
            "appliesTo": "unspecified",
            "milestoneId": None,
            "includedRounds": 2,
            "additionalRevisionPricing": None,
            "conditions": [],
        }]
        evidence = [e]
        paths = ["/agreement/revisionTerms/0"]
        prov += [provenance("/agreement/revisionTerms/0/includedRounds", "Two revision rounds")]

    # contradiction ---------------------------------------------------------
    elif code == "CONTRADICTORY_SCOPE":
        kind = "contradiction"
        q1 = "The scope is limited to one launch page."
        q2 = "The same engagement requires a complete five-page website."
        text = base_text(f"{q1} {q2}")
        a["scope"] = {"summary": None, "deliverables": [], "exclusions": []}
        a["milestones"][0]["description"] = f"{q1} {q2}"
        a["milestones"][0]["deliverables"] = []
        evidence = [q1, q2]
        paths = ["/agreement/scope"]
        prov = [x for x in prov if x["path"] != "/agreement/scope/deliverables/0"]
        prov += [provenance("/agreement/milestones/0/description", f"{q1} {q2}")]
    elif code == "CONTRADICTORY_PRICE":
        kind = "contradiction"
        q1 = "The fixed project fee is 1200 USD."
        q2 = "The same fixed project fee is 1500 USD."
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT}. {q1} {q2} "
            f"{CLIENT} pays after acceptance. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"]["total"] = None
        a["payments"][0]["amount"] = None
        a["payments"][0]["amountType"] = "unspecified"
        evidence = [q1, q2]
        paths = ["/agreement/pricing/total", "/agreement/payments/0/amount"]
        prov = [x for x in prov if x["path"] != "/agreement/pricing/total/amount"]
    elif code == "CONTRADICTORY_CURRENCY":
        kind = "contradiction"
        q1 = "The project fee is 1200 USD."
        q2 = "The same project fee is 1200 EUR."
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT}. {q1} {q2} "
            f"Payment follows acceptance. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"]["total"] = money("1200", None, None)
        a["pricing"]["settlementAsset"] = None
        a["payments"][0]["amount"] = money("1200", None, None)
        evidence = [q1, q2]
        paths = ["/agreement/pricing/total/currency", "/agreement/payments/0/amount/currency"]
        prov = [x for x in prov if x["path"] != "/agreement/pricing/total/amount"]
        prov += [provenance("/agreement/pricing/total/amount", "1200 USD")]
    elif code == "CONTRADICTORY_SETTLEMENT_ASSET":
        kind = "contradiction"
        q1 = "Settlement must use USDC on eip155:8453."
        q2 = "The same payment must instead use USDT on eip155:8453."
        text = base_text(f"{q1} {q2}")
        a["pricing"]["settlementAsset"] = token_asset(None, "eip155:8453", None)
        evidence = [q1, q2]
        paths = ["/agreement/pricing/settlementAsset"]
        prov += [provenance("/agreement/pricing/settlementAsset/networkId", "eip155:8453")]
    elif code == "CONTRADICTORY_SETTLEMENT_NETWORK":
        kind = "contradiction"
        q1 = "Settlement must use USDC on eip155:8453."
        q2 = "The same payment must use USDC on eip155:42161."
        text = base_text(f"{q1} {q2}")
        a["pricing"]["settlementAsset"] = token_asset("USDC", None, None)
        evidence = [q1, q2]
        paths = ["/agreement/pricing/settlementAsset/networkId"]
        prov += [provenance("/agreement/pricing/settlementAsset/symbol", "USDC")]
    elif code == "CONTRADICTORY_DEADLINE":
        kind = "contradiction"
        q1 = "Final delivery is due 2027-03-15."
        q2 = "The same final delivery is due 2027-03-20."
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
            f"{CLIENT} pays after acceptance. Acceptance requires {CRITERIA}. {q1} {q2}"
        )
        a["milestones"][0]["deadline"] = None
        evidence = [q1, q2]
        paths = ["/agreement/milestones/0/deadline"]
        prov = [x for x in prov if x["path"] != "/agreement/milestones/0/deadline/date"]
    elif code == "CONTRADICTORY_ACCEPTANCE_TERM":
        kind = "contradiction"
        q1 = "Leon must approve the delivery before payment."
        q2 = "The same agreement states that no approval is required."
        text = base_text(f"{q1} {q2}")
        a["milestones"][0]["acceptance"]["required"] = None
        evidence = [q1, q2]
        paths = ["/agreement/milestones/0/acceptance"]
    elif code == "CONTRADICTORY_REVISION_TERM":
        kind = "contradiction"
        q1 = "Two revision rounds are included."
        q2 = "The same agreement states that zero revision rounds are included."
        text = base_text(f"{q1} {q2}")
        a["revisionTerms"] = [{
            "appliesTo": "unspecified",
            "milestoneId": None,
            "includedRounds": None,
            "additionalRevisionPricing": None,
            "conditions": [],
        }]
        evidence = [q1, q2]
        paths = ["/agreement/revisionTerms/0"]

    # unresolved_reference --------------------------------------------------
    elif code == "UNRESOLVED_PARTY_REFERENCE":
        kind = "unresolved_reference"
        e = "the provider will receive payment"
        text = (
            f"Rhea and Mara are both named as providers for Leon's launch-page project. "
            f"The agreement says {e}, but does not identify which provider it means. "
            f"The fee is {AMOUNT} {CODE}. Leon pays after acceptance. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["parties"] = [
            party("party_1", "Rhea", ["provider"]),
            party("party_2", "Mara", ["provider"]),
            party("party_3", "Leon", ["client", "payer"]),
        ]
        a["payments"][0]["payerPartyId"] = "party_3"
        a["payments"][0]["recipientPartyId"] = None
        a["milestones"][0]["acceptance"]["approverPartyId"] = "party_3"
        evidence = [e]
        paths = ["/agreement/parties"]
        prov = [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Mara"),
            provenance("/agreement/parties/2/displayName", "Leon"),
            provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "UNRESOLVED_PRONOUN":
        kind = "unresolved_reference"
        e = "She will approve the final version"
        text = (
            f"Rhea will {WORK} for Leon for {AMOUNT} {CODE}. Mara reviews the draft with Rhea. "
            f"{e}, but the pronoun does not identify Rhea or Mara. Payment follows approval. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["parties"].append(party("party_3", "Mara", ["other"]))
        a["milestones"][0]["acceptance"]["approverPartyId"] = None
        evidence = [e]
        paths = ["/agreement"]
        prov += [provenance("/agreement/parties/2/displayName", "Mara")]
    elif code == "UNRESOLVED_MILESTONE_REFERENCE":
        kind = "unresolved_reference"
        e = "Payment is due when the milestone is accepted"
        text = (
            f"Rhea will deliver a wireframe and a launch page for Leon for 1200 USD. "
            f"The wireframe is due 2027-03-10 and the launch page is due 2027-03-15. "
            f"{e}, but the agreement does not identify which milestone. Both milestones require Leon's approval."
        )
        a["scope"] = {
            "summary": "deliver a wireframe and a launch page",
            "deliverables": ["wireframe", "launch page"],
            "exclusions": [],
        }
        a["milestones"] = [
            {
                "id": "milestone_1",
                "description": "wireframe",
                "deliverables": ["wireframe"],
                "deadline": absolute_deadline("2027-03-10"),
                "acceptance": acceptance(True, "party_2", ["Leon approves the wireframe"]),
            },
            {
                "id": "milestone_2",
                "description": "launch page",
                "deliverables": ["launch page"],
                "deadline": absolute_deadline("2027-03-15"),
                "acceptance": acceptance(True, "party_2", ["Leon approves the launch page"]),
            },
        ]
        a["payments"] = [pay(amount=money("1200", "USD"), milestone_id=None)]
        evidence = [e]
        paths = ["/agreement/milestones", "/agreement/payments/0/trigger/milestoneId"]
        prov = [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/scope/deliverables/0", "wireframe"),
            provenance("/agreement/scope/deliverables/1", "launch page"),
            provenance("/agreement/pricing/total/amount", "1200 USD"),
            provenance("/agreement/milestones/0/deadline/date", "2027-03-10"),
            provenance("/agreement/milestones/1/deadline/date", "2027-03-15"),
        ]
    elif code == "UNRESOLVED_PAYMENT_PARTY":
        kind = "unresolved_reference"
        e = "Either Leon or Mara will make the payment"
        text = (
            f"{PROVIDER} will {WORK} for Leon and Mara for {AMOUNT} {CODE}. "
            f"{e}, but the agreement does not identify which one. Payment follows acceptance. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["parties"] = [
            party("party_1", PROVIDER, ["provider", "payee"]),
            party("party_2", "Leon", ["client"]),
            party("party_3", "Mara", ["client"]),
        ]
        a["payments"][0]["payerPartyId"] = None
        a["milestones"][0]["acceptance"]["approverPartyId"] = None
        evidence = [e]
        paths = ["/agreement/payments/0/payerPartyId"]
        prov = [
            provenance("/agreement/parties/0/displayName", PROVIDER),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/parties/2/displayName", "Mara"),
            provenance("/agreement/scope/deliverables/0", WORK),
            provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ]
    elif code == "UNRESOLVED_SETTLEMENT_ASSET":
        kind = "unresolved_reference"
        e = "USDC"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} USD. Settlement uses {e} on eip155:8453, "
            f"but no token contract or CAIP-19 asset identifier is stated. Acceptance requires {CRITERIA}. "
            f"Delivery is due {DATE}."
        )
        a["pricing"]["settlementAsset"] = token_asset("USDC", "eip155:8453", None)
        evidence = [e]
        paths = ["/agreement/pricing/settlementAsset/assetId"]
        prov += [
            provenance("/agreement/pricing/settlementAsset/symbol", "USDC"),
            provenance("/agreement/pricing/settlementAsset/networkId", "eip155:8453"),
        ]
    elif code == "UNRESOLVED_SETTLEMENT_NETWORK":
        kind = "unresolved_reference"
        e = "Base"
        text = (
            f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} USD. Settlement uses USDC on {e}, "
            f"but no canonical CAIP-2 network identifier is stated. Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"]["settlementAsset"] = token_asset("USDC", None, None)
        evidence = [e]
        paths = ["/agreement/pricing/settlementAsset/networkId"]
        prov += [provenance("/agreement/pricing/settlementAsset/symbol", "USDC")]

    # unsupported_term ------------------------------------------------------
    elif code == "UNSUPPORTED_RECURRING_RETAINER":
        kind = "unsupported_term"
        e = "Leon will pay Rhea 500 USD every month for six months"
        text = (
            f"Rhea will provide ongoing launch support for Leon. {e}. "
            f"Each monthly payment is due after that month's support period. Acceptance requires {CRITERIA}."
        )
        a["scope"] = {
            "summary": "provide ongoing launch support",
            "deliverables": ["ongoing launch support"],
            "exclusions": [],
        }
        a["pricing"]["total"] = None
        a["payments"] = []
        a["milestones"][0]["description"] = "ongoing launch support"
        a["milestones"][0]["deliverables"] = ["ongoing launch support"]
        a["milestones"][0]["deadline"] = None
        evidence = [e]
        paths = ["/agreement/payments"]
        prov = [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/scope/deliverables/0", "ongoing launch support"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
        ]
    elif code == "UNSUPPORTED_DYNAMIC_PRICING":
        kind = "unsupported_term"
        e = "The final fee equals 8% of Leon's verified advertising spend"
        text = (
            f"Rhea will manage one advertising campaign for Leon. {e}. Payment is due after campaign acceptance. "
            f"Acceptance requires {CRITERIA}. The campaign ends {DATE}."
        )
        a["scope"] = {
            "summary": "manage one advertising campaign",
            "deliverables": ["manage one advertising campaign"],
            "exclusions": [],
        }
        a["pricing"]["total"] = None
        a["payments"] = []
        a["milestones"][0]["description"] = "manage one advertising campaign"
        a["milestones"][0]["deliverables"] = ["manage one advertising campaign"]
        evidence = [e]
        paths = ["/agreement/pricing", "/agreement/payments"]
        prov = [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/scope/deliverables/0", "manage one advertising campaign"),
            provenance("/agreement/milestones/0/deadline/date", DATE),
            provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
        ]
    elif code == "UNSUPPORTED_CONDITIONAL_LOGIC":
        kind = "unsupported_term"
        e = "If Leon chooses the premium launch, Rhea must also build an analytics dashboard; otherwise that dashboard is omitted"
        text = base_text(e + ".")
        evidence = [e]
        paths = ["/agreement"]
    elif code == "UNSUPPORTED_MULTICURRENCY_TOTAL":
        kind = "unsupported_term"
        e = "The total price is 500 USD plus 300 EUR"
        text = (
            f"Rhea will {WORK} for Leon. {e}. Payment is due after acceptance. "
            f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
        )
        a["pricing"]["total"] = None
        a["pricing"]["settlementAsset"] = None
        a["payments"] = []
        evidence = [e]
        paths = ["/agreement/pricing/total"]
        prov = [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/scope/deliverables/0", WORK),
            provenance("/agreement/milestones/0/deadline/date", DATE),
            provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
        ]
    else:
        raise ValueError(f"no single-issue builder for {code}")

    return draft(
        slug,
        text,
        a,
        [issue(kind, code, paths, evidence)],
        prov,
        [kind],
    )


def multi_records() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    # 1) missing price + ambiguous deadline
    e = "Delivery will be on either 2027-04-10 or 2027-04-11, with the final date undecided"
    text = (
        f"Rhea will create a launch checklist for Leon. The fee will be paid in USD, but no amount is stated. "
        f"{e}. Leon pays after acceptance. Acceptance requires all checklist sections completed."
    )
    a = base_agreement()
    a["scope"] = {"summary": "create a launch checklist", "deliverables": ["launch checklist"], "exclusions": []}
    a["pricing"]["total"] = None
    a["payments"][0]["amount"] = None
    a["payments"][0]["amountType"] = "unspecified"
    a["milestones"][0]["description"] = "launch checklist"
    a["milestones"][0]["deliverables"] = ["launch checklist"]
    a["milestones"][0]["deadline"] = None
    a["milestones"][0]["acceptance"]["criteria"] = ["all checklist sections completed"]
    rows.append(draft(
        "multi_missing_price_ambiguous_deadline",
        text,
        a,
        [
            issue("missing_term", "MISSING_PRICE", ["/agreement/pricing/total"], []),
            issue("ambiguity", "AMBIGUOUS_DEADLINE", ["/agreement/milestones/0/deadline"], [e]),
        ],
        [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/scope/deliverables/0", "launch checklist"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", "all checklist sections completed"),
        ],
        ["missing_term", "ambiguity"],
    ))

    # 2) missing scope + missing acceptance authority
    text = (
        "Rhea will provide services for Leon for 900 USD. Approval is required before payment and requires a signed completion note, "
        "but no approving party is identified. Delivery is due 2027-04-20. The agreement does not describe the services."
    )
    a = base_agreement()
    a["scope"] = {"summary": None, "deliverables": [], "exclusions": []}
    a["pricing"] = {"total": money("900", "USD"), "settlementAsset": fiat_asset("USD")}
    a["payments"][0]["amount"] = money("900", "USD")
    a["milestones"][0]["description"] = "service engagement"
    a["milestones"][0]["deliverables"] = []
    a["milestones"][0]["deadline"] = absolute_deadline("2027-04-20")
    a["milestones"][0]["acceptance"] = acceptance(True, None, ["signed completion note"])
    rows.append(draft(
        "multi_missing_scope_acceptance_authority",
        text,
        a,
        [
            issue("missing_term", "MISSING_SCOPE", ["/agreement/scope"], []),
            issue("missing_term", "MISSING_ACCEPTANCE_AUTHORITY", ["/agreement/milestones/0/acceptance/approverPartyId"], []),
        ],
        [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/pricing/total/amount", "900 USD"),
            provenance("/agreement/milestones/0/acceptance/criteria/0", "signed completion note"),
            provenance("/agreement/milestones/0/deadline/date", "2027-04-20"),
        ],
        ["missing_term"],
    ))

    # 3) ambiguous settlement asset + unresolved payment party
    e1 = "Settlement may use either USDC or USDT on eip155:8453"
    e2 = "Either Leon or Mara will make the payment"
    text = (
        f"Rhea will {WORK} for Leon and Mara for 1200 USD. {e1}. {e2}, and the payer is not identified. "
        f"Acceptance requires {CRITERIA}. Delivery is due {DATE}."
    )
    a = base_agreement()
    a["parties"] = [
        party("party_1", "Rhea", ["provider", "payee"]),
        party("party_2", "Leon", ["client"]),
        party("party_3", "Mara", ["client"]),
    ]
    a["pricing"]["settlementAsset"] = None
    a["payments"][0]["payerPartyId"] = None
    a["milestones"][0]["acceptance"]["approverPartyId"] = None
    rows.append(draft(
        "multi_ambiguous_asset_unresolved_payment_party",
        text,
        a,
        [
            issue("ambiguity", "AMBIGUOUS_SETTLEMENT_ASSET", ["/agreement/pricing/settlementAsset"], [e1]),
            issue("unresolved_reference", "UNRESOLVED_PAYMENT_PARTY", ["/agreement/payments/0/payerPartyId"], [e2]),
        ],
        [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/parties/2/displayName", "Mara"),
            provenance("/agreement/scope/deliverables/0", WORK),
            provenance("/agreement/pricing/total/amount", "1200 USD"),
            provenance("/agreement/milestones/0/deadline/date", DATE),
        ],
        ["ambiguity", "unresolved_reference"],
    ))

    # 4) contradictory scope + missing currency
    q1 = "The work is limited to a single landing page."
    q2 = "The same agreement requires a complete six-page site."
    network = "eip155:8453"
    asset = "eip155:8453/erc20:0x0000000000000000000000000000000000000002"
    text = (
        f"Rhea will work for Leon for 1400 with no currency code or symbol. {q1} {q2} "
        f"Settlement uses USDC on {network} with asset identifier {asset}. "
        "Leon pays after acceptance. Delivery is due 2027-04-25."
    )
    a = base_agreement()
    a["scope"] = {"summary": None, "deliverables": [], "exclusions": []}
    a["pricing"] = {"total": money("1400", None, None), "settlementAsset": token_asset("USDC", network, asset)}
    a["payments"][0]["amount"] = money("1400", None, None)
    a["milestones"][0]["description"] = "web work"
    a["milestones"][0]["deliverables"] = []
    a["milestones"][0]["deadline"] = absolute_deadline("2027-04-25")
    rows.append(draft(
        "multi_contradictory_scope_missing_currency",
        text,
        a,
        [
            issue("contradiction", "CONTRADICTORY_SCOPE", ["/agreement/scope"], [q1, q2]),
            issue("missing_term", "MISSING_CURRENCY", ["/agreement/pricing/total/currency", "/agreement/payments/0/amount/currency"], []),
        ],
        [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/pricing/total/amount", "1400"),
            provenance("/agreement/pricing/settlementAsset/networkId", network),
            provenance("/agreement/pricing/settlementAsset/assetId", asset),
            provenance("/agreement/milestones/0/deadline/date", "2027-04-25"),
        ],
        ["contradiction", "missing_term"],
    ))

    # 5) unsupported conditional logic + unresolved milestone reference
    e1 = "If Leon selects the premium option, Rhea must add a performance report; otherwise the report is omitted"
    e2 = "The final bonus is paid when the milestone is accepted"
    text = (
        f"Rhea will deliver a launch page and a copy deck for Leon for 1800 USD. {e1}. "
        f"The launch page is due 2027-05-01 and the copy deck is due 2027-05-03. "
        f"{e2}, but the agreement does not identify which milestone. Both require Leon's approval."
    )
    a = base_agreement()
    a["scope"] = {"summary": "deliver a launch page and a copy deck", "deliverables": ["launch page", "copy deck"], "exclusions": []}
    a["pricing"] = {"total": money("1800", "USD"), "settlementAsset": fiat_asset("USD")}
    a["milestones"] = [
        {
            "id": "milestone_1",
            "description": "launch page",
            "deliverables": ["launch page"],
            "deadline": absolute_deadline("2027-05-01"),
            "acceptance": acceptance(True, "party_2", ["Leon approves the launch page"]),
        },
        {
            "id": "milestone_2",
            "description": "copy deck",
            "deliverables": ["copy deck"],
            "deadline": absolute_deadline("2027-05-03"),
            "acceptance": acceptance(True, "party_2", ["Leon approves the copy deck"]),
        },
    ]
    a["payments"] = [pay(amount=money("1800", "USD"), milestone_id=None)]
    rows.append(draft(
        "multi_unsupported_conditional_unresolved_milestone",
        text,
        a,
        [
            issue("unsupported_term", "UNSUPPORTED_CONDITIONAL_LOGIC", ["/agreement"], [e1]),
            issue("unresolved_reference", "UNRESOLVED_MILESTONE_REFERENCE", ["/agreement/milestones", "/agreement/payments/0/trigger/milestoneId"], [e2]),
        ],
        [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/scope/deliverables/0", "launch page"),
            provenance("/agreement/scope/deliverables/1", "copy deck"),
            provenance("/agreement/pricing/total/amount", "1800 USD"),
            provenance("/agreement/milestones/0/deadline/date", "2027-05-01"),
            provenance("/agreement/milestones/1/deadline/date", "2027-05-03"),
        ],
        ["unsupported_term", "unresolved_reference"],
    ))

    # 6) missing deliverable + ambiguous acceptance authority + unresolved asset
    e1 = "Either Leon or Mara may approve, and the agreement does not choose between them"
    e2 = "USDC"
    text = (
        f"Rhea will provide launch consulting for Leon for 1000 USD. No concrete deliverable is stated. "
        f"{e1}. Settlement uses {e2} on eip155:8453, but no token contract or CAIP-19 identifier is stated. "
        "The consulting engagement ends 2027-05-10."
    )
    a = base_agreement()
    a["parties"].append(party("party_3", "Mara", ["other"]))
    a["scope"] = {"summary": "provide launch consulting", "deliverables": [], "exclusions": []}
    a["pricing"] = {"total": money("1000", "USD"), "settlementAsset": token_asset("USDC", "eip155:8453", None)}
    a["payments"][0]["amount"] = money("1000", "USD")
    a["milestones"][0]["description"] = "launch consulting engagement"
    a["milestones"][0]["deliverables"] = []
    a["milestones"][0]["deadline"] = absolute_deadline("2027-05-10")
    a["milestones"][0]["acceptance"] = acceptance(True, None, ["consulting engagement completed"])
    rows.append(draft(
        "multi_missing_deliverable_ambiguous_authority_unresolved_asset",
        text,
        a,
        [
            issue("missing_term", "MISSING_DELIVERABLE", ["/agreement/scope/deliverables", "/agreement/milestones/0/deliverables"], []),
            issue("ambiguity", "AMBIGUOUS_ACCEPTANCE_AUTHORITY", ["/agreement/milestones/0/acceptance/approverPartyId"], [e1]),
            issue("unresolved_reference", "UNRESOLVED_SETTLEMENT_ASSET", ["/agreement/pricing/settlementAsset/assetId"], [e2]),
        ],
        [
            provenance("/agreement/parties/0/displayName", "Rhea"),
            provenance("/agreement/parties/1/displayName", "Leon"),
            provenance("/agreement/parties/2/displayName", "Mara"),
            provenance("/agreement/scope/summary", "provide launch consulting"),
            provenance("/agreement/pricing/total/amount", "1000 USD"),
            provenance("/agreement/pricing/settlementAsset/symbol", "USDC"),
            provenance("/agreement/pricing/settlementAsset/networkId", "eip155:8453"),
            provenance("/agreement/milestones/0/deadline/date", "2027-05-10"),
        ],
        ["missing_term", "ambiguity", "unresolved_reference"],
    ))

    return rows


def clean_records() -> list[dict[str, Any]]:
    specs = [
        ("Nika", "Oren", "prepare a product launch brief", "950", "USD", "2027-05-15", "the brief covers audience, channels, budget, and timeline"),
        ("Dara", "Mila", "design a two-page event flyer", "700", "EUR", "2027-05-18", "both pages match the approved copy and print dimensions"),
        ("Soren", "Ayla", "produce a three-minute demo video", "1600", "USD", "2027-05-22", "the final video includes captions and approved product footage"),
        ("Lena", "Kian", "create a customer interview summary", "850", "EUR", "2027-05-25", "the summary covers all eight completed interviews"),
    ]
    rows: list[dict[str, Any]] = []
    for index, (provider, client, work, amount, code, date, criteria) in enumerate(specs, 1):
        text = (
            f"{provider} will {work} for {client} for {amount} {code}. "
            f"{client} will pay {provider} by bank transfer after {client} accepts delivery. "
            f"Acceptance requires {criteria}. Delivery is due {date}."
        )
        a = empty_agreement()
        a["parties"] = [
            party("party_1", provider, ["provider", "payee"]),
            party("party_2", client, ["client", "payer"]),
        ]
        a["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        a["pricing"] = {"total": money(amount, code), "settlementAsset": fiat_asset(code)}
        a["milestones"] = [
            milestone(work, [work], absolute_deadline(date), acceptance(True, "party_2", [criteria]))
        ]
        a["payments"] = [pay(amount=money(amount, code))]
        rows.append(draft(
            f"clean_{index:03d}",
            text,
            a,
            [],
            [
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/total/amount", f"{amount} {code}"),
                provenance("/agreement/milestones/0/acceptance/criteria/0", criteria),
                provenance("/agreement/milestones/0/deadline/date", date),
            ],
            ["other"],
            difficulty="basic",
        ))
    return rows



def apply_semantic_repairs(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Tighten source grounding after semantic audit without approving any row."""
    by_id = {row["exampleId"]: row for row in rows}

    def get(slug: str) -> dict[str, Any]:
        return by_id[f"pai_v0_2_train_registry_{slug}_001"]

    def add(slug: str, sentence: str) -> None:
        row = get(slug)
        if sentence not in row["input"]["text"]:
            row["input"]["text"] = row["input"]["text"].rstrip() + " " + sentence

    # Missing-term isolation: explicitly ground non-focal payment/acceptance facts.
    row = get("missing_scope")
    row["input"]["text"] = (
        f"{PROVIDER} will provide services for {CLIENT} for {AMOUNT} {CODE}. "
        f"{CLIENT} will pay {PROVIDER} after {CLIENT} approves the engagement. "
        f"{CLIENT} will approve when the engagement is complete. "
        f"The engagement ends {DATE}. The agreement does not describe the work."
    )
    row["target"]["agreement"]["milestones"][0]["acceptance"]["criteria"] = ["the engagement is complete"]
    row["target"]["provenance"] = [
        provenance("/agreement/parties/0/displayName", PROVIDER),
        provenance("/agreement/parties/1/displayName", CLIENT),
        provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
        provenance("/agreement/milestones/0/acceptance/criteria/0", "the engagement is complete"),
        provenance("/agreement/milestones/0/deadline/date", DATE),
    ]

    add("missing_deliverable", f"{CLIENT} is the approving party and will pay {PROVIDER} after approval.")
    add("missing_price", f"{CLIENT} is the approving party and will pay {PROVIDER} after approval.")
    add("missing_currency", f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.")

    row = get("missing_settlement_asset")
    row["input"]["text"] = row["input"]["text"].replace(
        f"{CLIENT} will pay {PROVIDER} by bank transfer after {CLIENT} accepts delivery.",
        f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.",
    )

    add("missing_settlement_network", f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.")
    add("missing_deadline", f"{CLIENT} will pay {PROVIDER} by bank transfer after {CLIENT} accepts delivery.")
    add("missing_payment_trigger", f"{CLIENT} is the acceptance authority.")
    add("missing_acceptance_authority", f"{CLIENT} will pay {PROVIDER} after acceptance.")

    # Ambiguity isolation.
    row = get("ambiguous_party")
    e = "Either Sam Lee or Sam Patel may be the payment recipient, and the agreement leaves the choice open"
    row["input"]["text"] = (
        f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
        f"{CLIENT} will make the payment. {e}. "
        f"Payment is due after {CLIENT} accepts delivery. "
        f"{CLIENT} will approve delivery when {CRITERIA}. Delivery is due {DATE}."
    )
    row["target"]["issues"][0]["evidence"] = [e]
    row["target"]["agreement"]["parties"][0]["roles"] = ["provider"]
    row["target"]["provenance"] = [
        provenance("/agreement/parties/0/displayName", PROVIDER),
        provenance("/agreement/parties/1/displayName", CLIENT),
        provenance("/agreement/parties/2/displayName", "Sam Lee"),
        provenance("/agreement/parties/3/displayName", "Sam Patel"),
        provenance("/agreement/scope/deliverables/0", WORK),
        provenance("/agreement/pricing/total/amount", f"{AMOUNT} {CODE}"),
        provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
        provenance("/agreement/milestones/0/deadline/date", DATE),
    ]

    row = get("ambiguous_party_role")
    e = (
        "Mara is named as the project contact, but the agreement does not say whether "
        "Mara is acting as an additional service provider or as the client's representative"
    )
    row["input"]["text"] = (
        f"{PROVIDER} will {WORK} for {CLIENT} for {AMOUNT} {CODE}. "
        f"{CLIENT} will pay {PROVIDER} by bank transfer after {CLIENT} accepts delivery. "
        f"Acceptance requires {CRITERIA}. Delivery is due {DATE}. {e}."
    )
    row["target"]["issues"][0]["evidence"] = [e]
    row["target"]["agreement"]["parties"] = [
        party("party_1", PROVIDER, ["provider", "payee"]),
        party("party_2", CLIENT, ["client", "payer"]),
        party("party_3", "Mara", ["unknown"]),
    ]
    row["target"]["agreement"]["payments"][0]["payerPartyId"] = "party_2"
    row["target"]["agreement"]["payments"][0]["recipientPartyId"] = "party_1"
    row["target"]["agreement"]["milestones"][0]["acceptance"]["approverPartyId"] = "party_2"
    row["target"]["provenance"] = base_provenance() + [
        provenance("/agreement/parties/2/displayName", "Mara")
    ]

    add("ambiguous_scope", f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.")
    add("ambiguous_settlement_asset", f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.")
    add("ambiguous_settlement_network", f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.")
    add("ambiguous_deadline", f"{CLIENT} will pay {PROVIDER} by bank transfer after {CLIENT} accepts delivery.")
    add("ambiguous_payment_trigger", f"{CLIENT} will make the payment to {PROVIDER}. {CLIENT} is the acceptance authority.")
    add("ambiguous_acceptance_authority", f"{CLIENT} will make the payment to {PROVIDER} after acceptance.")

    # Contradictions: ground independent fields and remove accidental fiat-medium conflicts.
    add("contradictory_currency", f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.")
    add("contradictory_deadline", f"{CLIENT} will pay {PROVIDER} by bank transfer after {CLIENT} accepts delivery.")
    add("contradictory_price", f"{CLIENT} will pay {PROVIDER} by bank transfer after {CLIENT} accepts delivery.")
    for slug in ("contradictory_settlement_asset", "contradictory_settlement_network"):
        row = get(slug)
        row["input"]["text"] = row["input"]["text"].replace(
            f"{CLIENT} will pay {PROVIDER} by bank transfer after {CLIENT} accepts delivery.",
            f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.",
        )

    # Unresolved-reference isolation and canonical-identifier dependency.
    add("unresolved_milestone_reference", f"{CLIENT} will make the payment to {PROVIDER} by bank transfer.")
    add("unresolved_party_reference", f"{CLIENT} will make the payment by bank transfer after {CLIENT} accepts delivery.")

    row = get("unresolved_payment_party")
    old = "Either Leon or Mara will make the payment"
    new = f"Either {CLIENT} or Mara will pay {PROVIDER}"
    row["input"]["text"] = row["input"]["text"].replace(old, new)
    row["input"]["text"] += f" {CLIENT} is the acceptance authority."
    row["target"]["issues"][0]["evidence"] = [new]
    row["target"]["agreement"]["milestones"][0]["acceptance"]["approverPartyId"] = "party_2"

    add("unresolved_pronoun", f"{CLIENT} will make the payment to {PROVIDER} after approval.")
    add("unresolved_settlement_asset", f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.")
    add("unresolved_settlement_network", f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.")
    row = get("unresolved_settlement_network")
    if not any(x["code"] == "UNRESOLVED_SETTLEMENT_ASSET" for x in row["target"]["issues"]):
        row["target"]["issues"].append(
            issue(
                "unresolved_reference",
                "UNRESOLVED_SETTLEMENT_ASSET",
                ["/agreement/pricing/settlementAsset/assetId"],
                ["USDC"],
            )
        )

    # Unsupported terms: preserve representable sub-terms instead of silently dropping them.
    row = get("unsupported_dynamic_pricing")
    criterion = "the campaign matches the approved brief"
    row["input"]["text"] = (
        f"Rhea will manage one advertising campaign for Leon. "
        f"The final fee equals 8% of Leon's verified advertising spend. "
        f"Leon will pay Rhea by bank transfer after Leon accepts the campaign. "
        f"Leon accepts the campaign when {criterion}. The campaign ends {DATE}."
    )
    row["target"]["agreement"]["milestones"][0]["acceptance"] = acceptance(True, "party_2", [criterion])
    row["target"]["agreement"]["payments"] = [
        pay(
            amount=None,
            amount_type="unspecified",
            payer="party_2",
            recipient="party_1",
            trigger="milestone_accepted",
        )
    ]
    row["target"]["provenance"] = [
        provenance("/agreement/parties/0/displayName", "Rhea"),
        provenance("/agreement/parties/1/displayName", "Leon"),
        provenance("/agreement/scope/deliverables/0", "manage one advertising campaign"),
        provenance("/agreement/milestones/0/deadline/date", DATE),
        provenance("/agreement/milestones/0/acceptance/criteria/0", criterion),
    ]

    row = get("unsupported_multicurrency_total")
    row["input"]["text"] = (
        f"Rhea will {WORK} for Leon. The total price is 500 USD plus 300 EUR. "
        f"Leon will pay Rhea after Leon accepts delivery. Acceptance requires {CRITERIA}. "
        f"Delivery is due {DATE}."
    )
    row["target"]["agreement"]["payments"] = [
        pay(
            amount=None,
            amount_type="unspecified",
            payer="party_2",
            recipient="party_1",
            trigger="milestone_accepted",
        )
    ]

    row = get("unsupported_recurring_retainer")
    criterion = "the agreed support log for that month is delivered"
    row["input"]["text"] = (
        f"Rhea will provide ongoing launch support for Leon. "
        f"Leon will pay Rhea 500 USD every month for six months. "
        f"Each monthly payment is due after that month's support period. "
        f"Leon accepts each month's support when {criterion}."
    )
    row["target"]["agreement"]["milestones"][0]["acceptance"] = acceptance(True, "party_2", [criterion])
    row["target"]["provenance"] = [
        provenance("/agreement/parties/0/displayName", "Rhea"),
        provenance("/agreement/parties/1/displayName", "Leon"),
        provenance("/agreement/scope/deliverables/0", "ongoing launch support"),
        provenance("/agreement/milestones/0/acceptance/criteria/0", criterion),
    ]

    # Batch 7 semantic repairs
    row = get("missing_settlement_network")
    row["target"]["provenance"].append(
        provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA)
    )

    # Multi-issue compositions: ground every non-focal default.
    row = get("multi_ambiguous_asset_unresolved_payment_party")
    old = "Either Leon or Mara will make the payment"
    new = "Either Leon or Mara will pay Rhea after acceptance"
    row["input"]["text"] = row["input"]["text"].replace(old, new)
    row["input"]["text"] += " Leon is the acceptance authority."
    for item in row["target"]["issues"]:
        if item["code"] == "UNRESOLVED_PAYMENT_PARTY":
            item["evidence"] = [new]
    row["target"]["agreement"]["milestones"][0]["acceptance"]["approverPartyId"] = "party_2"
    row["target"]["agreement"]["pricing"]["settlementAsset"] = token_asset(
        None, "eip155:8453", None
    )
    row["target"]["provenance"].extend([
        provenance("/agreement/pricing/settlementAsset/networkId", "eip155:8453"),
        provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
    ])

    add(
        "multi_contradictory_scope_missing_currency",
        f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery. Acceptance requires {CRITERIA}.",
    )
    row = get("multi_contradictory_scope_missing_currency")
    row["target"]["agreement"]["milestones"][0]["description"] = (
        "The work is limited to a single landing page. "
        "The same agreement requires a complete six-page site."
    )
    row["target"]["provenance"].extend([
        provenance(
            "/agreement/milestones/0/description",
            "The work is limited to a single landing page. "
            "The same agreement requires a complete six-page site.",
        ),
        provenance("/agreement/pricing/settlementAsset/symbol", "USDC"),
        provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
    ])

    row = get("multi_missing_deliverable_ambiguous_authority_unresolved_asset")
    row["input"]["text"] += (
        f" {CLIENT} will pay {PROVIDER} after acceptance. "
        "Acceptance requires the consulting engagement is complete."
    )
    row["target"]["agreement"]["milestones"][0]["description"] = "consulting engagement"
    row["target"]["agreement"]["milestones"][0]["acceptance"]["criteria"] = [
        "the consulting engagement is complete"
    ]
    row["target"]["provenance"].extend([
        provenance("/agreement/milestones/0/description", "consulting engagement"),
        provenance(
            "/agreement/milestones/0/acceptance/criteria/0",
            "the consulting engagement is complete",
        ),
    ])

    add(
        "multi_missing_price_ambiguous_deadline",
        f"{CLIENT} will pay {PROVIDER} after {CLIENT} accepts delivery.",
    )
    row = get("multi_missing_price_ambiguous_deadline")
    row["target"]["provenance"].append(
        provenance("/agreement/pricing/settlementAsset/symbol", "USD")
    )
    add(
        "multi_missing_scope_acceptance_authority",
        f"{CLIENT} will pay {PROVIDER} after approval.",
    )

    row = get("multi_unsupported_conditional_unresolved_milestone")
    old = "The final bonus is paid when the milestone is accepted"
    new = "Leon will pay Rhea the 1800 USD project fee when the milestone is accepted"
    row["input"]["text"] = row["input"]["text"].replace(old, new)
    for item in row["target"]["issues"]:
        if item["code"] == "UNRESOLVED_MILESTONE_REFERENCE":
            item["evidence"] = [new]

    # Batch 8 semantic repairs
    row = get("multi_missing_scope_acceptance_authority")
    row["target"]["agreement"]["milestones"][0]["description"] = "provide services"
    row["target"]["provenance"].extend([
        provenance("/agreement/milestones/0/description", "provide services"),
        provenance("/agreement/pricing/settlementAsset/symbol", "USD"),
    ])

    row = get("multi_unsupported_conditional_unresolved_milestone")
    shared_approval = "Leon's approval"
    row["target"]["agreement"]["milestones"][0]["acceptance"]["criteria"] = [shared_approval]
    row["target"]["agreement"]["milestones"][1]["acceptance"]["criteria"] = [shared_approval]
    row["target"]["provenance"].extend([
        provenance("/agreement/milestones/0/acceptance/criteria/0", shared_approval),
        provenance("/agreement/milestones/1/acceptance/criteria/0", shared_approval),
        provenance("/agreement/pricing/settlementAsset/symbol", "USD"),
    ])

    row = get("unresolved_milestone_reference")
    old = "Payment is due when the milestone is accepted"
    new = "Leon will pay Rhea 1200 USD when the milestone is accepted"
    assert old in row["input"]["text"], "UNRESOLVED_MILESTONE_SOURCE_GUARD_FAILED"
    row["input"]["text"] = row["input"]["text"].replace(old, new, 1)
    for item in row["target"]["issues"]:
        if item["code"] == "UNRESOLVED_MILESTONE_REFERENCE":
            item["evidence"] = [new]
    row["target"]["agreement"]["milestones"][0]["acceptance"]["criteria"] = [shared_approval]
    row["target"]["agreement"]["milestones"][1]["acceptance"]["criteria"] = [shared_approval]
    row["target"]["provenance"].extend([
        provenance("/agreement/milestones/0/acceptance/criteria/0", shared_approval),
        provenance("/agreement/milestones/1/acceptance/criteria/0", shared_approval),
        provenance("/agreement/pricing/settlementAsset/symbol", "USD"),
    ])

    row = get("unresolved_party_reference")
    old_scope = "Rhea and Mara are both named as providers for Leon's launch-page project."
    new_scope = "Rhea and Mara are both named as providers who will create a launch page for Leon."
    old_accept = "Leon pays after acceptance."
    new_accept = "Leon will pay after Leon accepts delivery."
    assert old_scope in row["input"]["text"], "UNRESOLVED_PARTY_SCOPE_GUARD_FAILED"
    assert old_accept in row["input"]["text"], "UNRESOLVED_PARTY_ACCEPT_GUARD_FAILED"
    row["input"]["text"] = row["input"]["text"].replace(old_scope, new_scope, 1)
    row["input"]["text"] = row["input"]["text"].replace(old_accept, new_accept, 1)
    row["target"]["provenance"].extend([
        provenance("/agreement/scope/deliverables/0", WORK),
        provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
        provenance("/agreement/pricing/settlementAsset/symbol", CODE),
    ])

    row = get("unresolved_payment_party")
    expected_payment = f"Either {CLIENT} or Mara will pay {PROVIDER}"
    expected_authority = f"{CLIENT} is the acceptance authority."
    assert expected_payment in row["input"]["text"], "UNRESOLVED_PAYMENT_SOURCE_GUARD_FAILED"
    assert expected_authority in row["input"]["text"], "UNRESOLVED_PAYMENT_AUTHORITY_SOURCE_GUARD_FAILED"
    payment_issue = next(
        item for item in row["target"]["issues"]
        if item["code"] == "UNRESOLVED_PAYMENT_PARTY"

    )
    assert payment_issue["evidence"] == [expected_payment], "UNRESOLVED_PAYMENT_EVIDENCE_GUARD_FAILED"
    assert (
        row["target"]["agreement"]["milestones"][0]["acceptance"]["approverPartyId"] == "party_2"
    ), "UNRESOLVED_PAYMENT_APPROVER_GUARD_FAILED"
    row["target"]["provenance"].extend([
        provenance("/agreement/milestones/0/acceptance/criteria/0", CRITERIA),
        provenance("/agreement/pricing/settlementAsset/symbol", CODE),
    ])

    # Final 7 semantic repairs
    # Preserve explicit fiat provenance on otherwise-correct records.
    row = get("unresolved_pronoun")
    assert row["target"]["agreement"]["pricing"]["settlementAsset"] == fiat_asset("USD"), "UNRESOLVED_PRONOUN_SETTLEMENT_GUARD_FAILED"
    assert not any(
        p["path"] == "/agreement/pricing/settlementAsset/symbol"
        for p in row["target"]["provenance"]
    ), "UNRESOLVED_PRONOUN_SETTLEMENT_PROVENANCE_ALREADY_PRESENT"
    row["target"]["provenance"].append(
        provenance("/agreement/pricing/settlementAsset/symbol", "USD")
    )

    row = get("unsupported_conditional_logic")
    assert row["target"]["agreement"]["pricing"]["settlementAsset"] == fiat_asset("USD"), "CONDITIONAL_SETTLEMENT_GUARD_FAILED"
    assert not any(
        p["path"] == "/agreement/pricing/settlementAsset/symbol"
        for p in row["target"]["provenance"]
    ), "CONDITIONAL_SETTLEMENT_PROVENANCE_ALREADY_PRESENT"
    row["target"]["provenance"].append(
        provenance("/agreement/pricing/settlementAsset/symbol", "USD")
    )

    # Dynamic pricing source states no currency; do not invent a fiat settlement asset.
    row = get("unsupported_dynamic_pricing")
    assert row["target"]["agreement"]["pricing"]["total"] is None, "DYNAMIC_TOTAL_GUARD_FAILED"
    assert row["target"]["agreement"]["pricing"]["settlementAsset"] == fiat_asset("USD"), "DYNAMIC_INVENTED_USD_GUARD_FAILED"
    assert len(row["target"]["agreement"]["payments"]) == 1, "DYNAMIC_PAYMENT_COUNT_GUARD_FAILED"
    payment = row["target"]["agreement"]["payments"][0]
    assert payment["amount"] is None and payment["amountType"] == "unspecified", "DYNAMIC_PAYMENT_AMOUNT_GUARD_FAILED"
    assert payment["payerPartyId"] == "party_2" and payment["recipientPartyId"] == "party_1", "DYNAMIC_PAYMENT_PARTIES_GUARD_FAILED"
    assert payment["trigger"]["type"] == "milestone_accepted" and payment["trigger"]["milestoneId"] == "milestone_1", "DYNAMIC_PAYMENT_TRIGGER_GUARD_FAILED"
    row["target"]["agreement"]["pricing"]["settlementAsset"] = None

    row = get("unsupported_recurring_retainer")
    assert row["target"]["agreement"]["pricing"]["settlementAsset"] == fiat_asset("USD"), "RECURRING_SETTLEMENT_GUARD_FAILED"
    assert row["target"]["agreement"]["payments"] == [], "RECURRING_PAYMENTS_GUARD_FAILED"
    assert not any(
        p["path"] == "/agreement/pricing/settlementAsset/symbol"
        for p in row["target"]["provenance"]
    ), "RECURRING_SETTLEMENT_PROVENANCE_ALREADY_PRESENT"
    row["target"]["provenance"].append(
        provenance("/agreement/pricing/settlementAsset/symbol", "USD")
    )

    # Batch 6 missing_scope provenance repair
    row = get("missing_scope")
    assert row["target"]["agreement"]["scope"] == {
        "summary": None,
        "deliverables": [],
        "exclusions": [],
    }, "MISSING_SCOPE_SCOPE_GUARD_FAILED"
    assert (
        row["target"]["agreement"]["milestones"][0]["description"] == "provide services"
    ), "MISSING_SCOPE_DESCRIPTION_GUARD_FAILED"
    assert "provide services" in row["input"]["text"], "MISSING_SCOPE_SOURCE_GROUNDING_GUARD_FAILED"
    assert not any(
        p["path"] == "/agreement/milestones/0/description"
        for p in row["target"]["provenance"]
    ), "MISSING_SCOPE_DESCRIPTION_PROVENANCE_ALREADY_PRESENT"
    row["target"]["provenance"].append(
        provenance("/agreement/milestones/0/description", "provide services")
    )

    return sorted(rows, key=lambda value: value["exampleId"])


def normalized(text: str) -> str:
    value = unicodedata.normalize("NFKC", text)
    return re.sub(r"\s+", " ", value).strip().casefold()


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def build_records(repo_root: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    registry = json.loads((repo_root / REGISTRY_PATH).read_text(encoding="utf-8"))
    registry_by_code = {entry["code"]: entry for entry in registry["codes"]}

    base_rows = [row for relative in BASE_TRAIN for row in load_jsonl(repo_root / relative)]
    seen = {
        item["code"]
        for row in base_rows
        for item in row["target"]["issues"]
    }
    expected_unseen = set(registry_by_code) - seen

    singles = [single_issue_record(code) for code in sorted(expected_unseen)]
    multis = multi_records()
    cleans = clean_records()
    rows = sorted(singles + multis + cleans, key=lambda row: row["exampleId"])
    rows = apply_semantic_repairs(rows)

    single_codes = {row["target"]["issues"][0]["code"] for row in singles}
    if single_codes != expected_unseen:
        raise ValueError(
            f"single coverage mismatch missing={sorted(expected_unseen-single_codes)} "
            f"extra={sorted(single_codes-expected_unseen)}"
        )
    if len(singles) != 37 or len(multis) != 6 or len(cleans) != 4 or len(rows) != 47:
        raise ValueError(
            f"unexpected record counts singles={len(singles)} multis={len(multis)} "
            f"clean={len(cleans)} total={len(rows)}"
        )

    ids = [row["exampleId"] for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate generated exampleId")

    for row in rows:
        if row["split"] != "train":
            raise ValueError(f"{row['exampleId']}: non-train split")
        if row["metadata"]["reviewStatus"] != "draft":
            raise ValueError(f"{row['exampleId']}: generated record is not draft")
        for item in row["target"]["issues"]:
            definition = registry_by_code[item["code"]]
            if item["kind"] != definition["kind"]:
                raise ValueError(f"{row['exampleId']}: kind mismatch for {item['code']}")
            if definition["evidenceRequired"] and not item["evidence"]:
                raise ValueError(f"{row['exampleId']}: missing evidence for {item['code']}")
            for quote in item["evidence"]:
                if quote not in row["input"]["text"]:
                    raise ValueError(f"{row['exampleId']}: issue evidence absent: {quote!r}")
        for item in row["target"]["provenance"]:
            if item["quote"] not in row["input"]["text"]:
                raise ValueError(f"{row['exampleId']}: provenance absent: {item['quote']!r}")

    collisions: list[str] = []
    evaluator = repo_root / EVALUATOR_PATH
    if evaluator.is_file():
        dev = json.loads(evaluator.read_text(encoding="utf-8"))
        dev_texts = {
            normalized(case["source"])
            for case in dev.get("cases", [])
            if isinstance(case.get("source"), str)
        }
        collisions = [
            row["exampleId"]
            for row in rows
            if normalized(row["input"]["text"]) in dev_texts
        ]
        if collisions:
            raise ValueError("exact evaluator text collision: " + ", ".join(collisions))

    issue_counts = Counter(
        item["code"]
        for row in rows
        for item in row["target"]["issues"]
    )
    cardinality = Counter(len(row["target"]["issues"]) for row in rows)
    report = {
        "baseAdjudicatedTrainRecords": len(base_rows),
        "registryCodeCount": len(registry_by_code),
        "baseSeenIssueCodes": len(seen),
        "baseUnrepresentedIssueCodes": len(expected_unseen),
        "singleIssueRecords": sum(len(row["target"]["issues"]) == 1 for row in rows),
        "multiIssueRecords": sum(len(row["target"]["issues"]) > 1 for row in rows),
        "cleanRecords": sum(len(row["target"]["issues"]) == 0 for row in rows),
        "generatedRecords": len(rows),
        "issueCardinality": dict(sorted(cardinality.items())),
        "generatedIssueCounts": dict(sorted(issue_counts.items())),
        "exactEvaluatorTextCollisions": len(collisions),
    }
    return rows, report


def render(repo_root: Path) -> dict[str, str]:
    rows, report = build_records(repo_root)
    jsonl = "".join(
        json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
        for row in rows
    )
    manifest = {
        "corpusVersion": CORPUS_VERSION,
        "generator": GENERATOR,
        "recordVersion": "pai.training-example.v0.2",
        "reviewStatus": "draft",
        "recordCount": len(rows),
        "splitCounts": {"train": len(rows)},
        "purpose": (
            "Draft registry-code coverage, sparse issue selection, and multi-issue "
            "composition examples for PAI Agreement Intelligence."
        ),
        "designRules": [
            "Every previously unrepresented registry code is covered; codes are isolated when semantically valid, while unavoidable identifier dependencies remain composed.",
            "Six independently designed multi-issue drafts teach composition across issue kinds, plus any unavoidable identifier-dependency composition.",
            "Four complete clean negatives reinforce sparse issue selection.",
            "Existing adjudicated corpora remain unchanged.",
            "Generated rows remain draft and cannot enter training before hash-bound human adjudication.",
            "Evaluator fixture text is not used as a training template; exact normalized source collisions are rejected.",
        ],
        "selfCheck": report,
    }
    return {
        "train.jsonl": jsonl,
        "manifest.json": json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    }


def write_or_check(repo_root: Path, output_dir: Path, check: bool) -> int:
    outputs = render(repo_root)
    mismatches: list[str] = []
    for name, content in outputs.items():
        path = output_dir / name
        if check:
            if not path.is_file() or path.read_text(encoding="utf-8") != content:
                mismatches.append(str(path))
        else:
            output_dir.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")

    if mismatches:
        for path in mismatches:
            print(f"OUT OF DATE: {path}")
        return 1

    _, report = build_records(repo_root)
    print("Registry coverage supplement " + ("verified" if check else "generated"))
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[3],
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
    )
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    try:
        return write_or_check(args.repo_root.resolve(), args.output_dir.resolve(), args.check)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
