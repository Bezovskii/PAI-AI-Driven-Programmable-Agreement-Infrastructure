#!/usr/bin/env python3
"""Build independent draft training examples needed by the PAI readiness gate."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from build_seed_corpus import (
    GENERATOR,
    acceptance,
    absolute_deadline,
    empty_agreement,
    fiat_asset,
    issue,
    milestone,
    party,
    payment,
    provenance,
    record,
)

DEFAULT_OUTPUT = Path(__file__).resolve().parent / "readiness-supplement-v0.1"


def money(amount: str, currency: str) -> dict[str, Any]:
    return {
        "amount": amount,
        "currency": {
            "code": currency,
            "symbol": None,
        },
    }


def contradictory_payment_trigger_record() -> dict[str, Any]:
    provider = "Talia"
    client = "Yusuf"
    work = "create a data migration script"
    price = "1800"
    currency = "USD"
    date = "2027-01-11"
    criteria = "successful migration of the provided test dataset"

    upfront_quote = "Yusuf must pay the full 1800 USD fee upfront."
    accepted_quote = (
        "The same 1800 USD payment is also stated to be due only after Yusuf "
        "accepts the completed script."
    )

    text = (
        "Talia will create a data migration script for Yusuf for 1800 USD. "
        f"{upfront_quote} {accepted_quote} "
        "Acceptance requires successful migration of the provided test dataset. "
        "Delivery is due 2027-01-11. Payment is by bank transfer."
    )

    agreement = empty_agreement()
    agreement["parties"] = [
        party("party_1", provider, ["provider", "payee"]),
        party("party_2", client, ["client", "payer"]),
    ]
    agreement["scope"] = {
        "summary": work,
        "deliverables": [work],
        "exclusions": [],
    }
    agreement["pricing"] = {
        "total": money(price, currency),
        "settlementAsset": fiat_asset(currency),
    }
    agreement["milestones"] = [
        milestone(
            work,
            [work],
            absolute_deadline(date),
            acceptance(True, "party_2", [criteria]),
        )
    ]

    # The source gives mutually incompatible triggers for the same payment.
    # Do not invent a winning trigger.
    agreement["payments"] = []

    return record(
        example_id="pai_v0_2_train_contradictory_payment_trigger_001",
        split="train",
        family="train_contradictory_payment_trigger",
        text=text,
        agreement=agreement,
        issues=[
            issue(
                "contradiction",
                "CONTRADICTORY_PAYMENT_TRIGGER",
                ["/agreement/payments"],
                [upfront_quote, accepted_quote],
            )
        ],
        provenance_entries=[
            provenance("/agreement/parties/0/displayName", provider),
            provenance("/agreement/parties/1/displayName", client),
            provenance("/agreement/scope/deliverables/0", work),
            provenance("/agreement/pricing/total/amount", "1800 USD"),
            provenance("/agreement/pricing/settlementAsset/symbol", currency),
            provenance("/agreement/milestones/0/deadline/date", date),
            provenance(
                "/agreement/milestones/0/acceptance/criteria/0",
                criteria,
            ),
        ],
        phenomena=[
            "pricing",
            "payment_schedule",
            "contradiction",
            "acceptance",
            "provenance",
        ],
        difficulty="adversarial",
    )


def unresolved_relative_deadline_record() -> dict[str, Any]:
    provider = "Nadia"
    client = "Rami"
    reviewer = "Selin"
    work = "prepare a security audit summary"
    price = "2100"
    currency = "EUR"
    criteria = "findings ranked by severity"

    client_approval = "Rami will approve the draft"
    reviewer_approval = "Selin will separately approve remediation"
    relative_deadline = "The final summary is due 5 days after approval"

    text = (
        "Nadia will prepare a security audit summary for Rami for 2100 EUR. "
        f"{client_approval}, and {reviewer_approval}. "
        f"{relative_deadline}, but the agreement does not say which approval "
        "starts that five-day period. "
        "Rami pays by bank transfer after accepting final delivery. "
        "Acceptance requires findings ranked by severity."
    )

    agreement = empty_agreement()
    agreement["parties"] = [
        party("party_1", provider, ["provider", "payee"]),
        party("party_2", client, ["client", "payer"]),
        party("party_3", reviewer, ["other"]),
    ]
    agreement["scope"] = {
        "summary": work,
        "deliverables": [work],
        "exclusions": [],
    }
    agreement["pricing"] = {
        "total": money(price, currency),
        "settlementAsset": fiat_asset(currency),
    }
    agreement["milestones"] = [
        milestone(
            work,
            [work],
            None,
            acceptance(True, "party_2", [criteria]),
        )
    ]
    agreement["payments"] = [
        payment(
            "payment_1",
            amount_type="fixed",
            amount=money(price, currency),
            share_percent=None,
            trigger_type="milestone_accepted",
        )
    ]

    return record(
        example_id="pai_v0_2_train_unresolved_relative_deadline_001",
        split="train",
        family="train_unresolved_relative_deadline",
        text=text,
        agreement=agreement,
        issues=[
            issue(
                "unresolved_reference",
                "UNRESOLVED_RELATIVE_DEADLINE_REFERENCE",
                ["/agreement/milestones/0/deadline"],
                [relative_deadline, client_approval, reviewer_approval],
            )
        ],
        provenance_entries=[
            provenance("/agreement/parties/0/displayName", provider),
            provenance("/agreement/parties/1/displayName", client),
            provenance("/agreement/parties/2/displayName", reviewer),
            provenance("/agreement/scope/deliverables/0", work),
            provenance("/agreement/pricing/total/amount", "2100 EUR"),
            provenance("/agreement/pricing/settlementAsset/symbol", currency),
            provenance(
                "/agreement/milestones/0/acceptance/criteria/0",
                criteria,
            ),
        ],
        phenomena=[
            "relative_deadline",
            "unresolved_reference",
            "acceptance",
            "payment_schedule",
            "provenance",
        ],
        difficulty="adversarial",
    )


def nonmonetary_exchange_record() -> dict[str, Any]:
    provider = "Eli"
    client = "Mira"
    work = "photograph Mira's product launch"
    date = "2027-01-20"
    criteria = "40 edited photographs and the original high-resolution files"

    exchange_quote = (
        "in exchange for Mira providing Eli with two days of studio access"
    )
    no_cash_quote = "No cash payment is owed."

    text = (
        "Eli will photograph Mira's product launch "
        f"{exchange_quote}. {no_cash_quote} "
        "The final photo set is due 2027-01-20. "
        "Acceptance requires 40 edited photographs and the original "
        "high-resolution files."
    )

    agreement = empty_agreement()
    agreement["parties"] = [
        party("party_1", provider, ["provider"]),
        party("party_2", client, ["client"]),
    ]
    agreement["scope"] = {
        "summary": work,
        "deliverables": [work],
        "exclusions": [],
    }
    agreement["pricing"] = {
        "total": None,
        "settlementAsset": None,
    }
    agreement["milestones"] = [
        milestone(
            work,
            [work],
            absolute_deadline(date),
            acceptance(True, "party_2", [criteria]),
        )
    ]
    agreement["payments"] = []

    return record(
        example_id="pai_v0_2_train_nonmonetary_exchange_001",
        split="train",
        family="train_nonmonetary_exchange",
        text=text,
        agreement=agreement,
        issues=[
            issue(
                "unsupported_term",
                "UNSUPPORTED_NONMONETARY_EXCHANGE",
                ["/agreement/pricing", "/agreement/scope"],
                [exchange_quote, no_cash_quote],
            )
        ],
        provenance_entries=[
            provenance("/agreement/parties/0/displayName", provider),
            provenance("/agreement/parties/1/displayName", client),
            provenance("/agreement/scope/deliverables/0", work),
            provenance("/agreement/milestones/0/deadline/date", date),
            provenance(
                "/agreement/milestones/0/acceptance/criteria/0",
                criteria,
            ),
        ],
        phenomena=[
            "pricing",
            "unsupported_term",
            "acceptance",
            "provenance",
        ],
        difficulty="adversarial",
    )


def build_records() -> list[dict[str, Any]]:
    return [
        contradictory_payment_trigger_record(),
        unresolved_relative_deadline_record(),
        nonmonetary_exchange_record(),
    ]


def render_outputs(records: list[dict[str, Any]]) -> dict[str, str]:
    records = sorted(records, key=lambda value: value["exampleId"])

    train_jsonl = "".join(
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
        for value in records
    )

    issue_counts = Counter(
        issue_value["code"]
        for value in records
        for issue_value in value["target"]["issues"]
    )
    family_counts = Counter(
        value["metadata"]["leakageGroupId"] for value in records
    )

    manifest = {
        "corpusVersion": "pai.readiness-supplement.v0.1",
        "generator": GENERATOR,
        "recordVersion": "pai.training-example.v0.2",
        "reviewStatus": "draft",
        "recordCount": len(records),
        "splitCounts": {"train": len(records)},
        "familyCounts": dict(sorted(family_counts.items())),
        "issueCounts": dict(sorted(issue_counts.items())),
        "purpose": (
            "Independent train coverage for issue kinds absent from seed-v0.1 train."
        ),
        "trainingExclusions": [
            "Not training-ready until separately human-adjudicated."
        ],
    }

    return {
        "train.jsonl": train_jsonl,
        "manifest.json": json.dumps(
            manifest,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
    }


def write_or_check(output_dir: Path, check: bool) -> int:
    outputs = render_outputs(build_records())
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

    action = "verified" if check else "generated"
    print(f"Readiness supplement {action}: {len(outputs)} files")
    print(f"Records: {len(build_records())}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
    )
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    return write_or_check(args.output_dir, args.check)


if __name__ == "__main__":
    raise SystemExit(main())
