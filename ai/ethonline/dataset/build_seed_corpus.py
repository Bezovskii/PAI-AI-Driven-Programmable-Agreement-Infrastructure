#!/usr/bin/env python3
"""Build the deterministic PAI agreement-extraction seed corpus v0.1."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


GENERATOR = "pai-seed-corpus-v0.1"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "seed-v0.1"


def empty_agreement() -> dict[str, Any]:
    return {
        "parties": [],
        "scope": {"summary": None, "deliverables": [], "exclusions": []},
        "pricing": {"total": None, "settlementAsset": None},
        "milestones": [],
        "payments": [],
        "revisionTerms": [],
        "evidenceTerms": [],
        "disputeTerms": {
            "enabled": None,
            "resolver": None,
            "initiationConditions": [],
            "evidenceWindow": None,
            "resolutionOptions": [],
        },
    }


def party(party_id: str, name: str, roles: list[str]) -> dict[str, Any]:
    return {"id": party_id, "reference": "named", "displayName": name, "roles": roles}


def money(amount: str, code: str | None, symbol: str | None = None) -> dict[str, Any]:
    return {"amount": amount, "currency": {"code": code, "symbol": symbol}}


def fiat_asset(symbol: str | None) -> dict[str, Any]:
    return {"type": "fiat", "symbol": symbol, "networkId": None, "assetId": None}


def absolute_deadline(date: str) -> dict[str, Any]:
    return {
        "type": "absolute_date",
        "date": date,
        "time": None,
        "timezone": None,
        "duration": None,
        "relativeTo": None,
    }


def acceptance(required: bool | None, approver: str | None, criteria: list[str]) -> dict[str, Any]:
    return {"required": required, "approverPartyId": approver, "criteria": criteria}


def milestone(
    description: str,
    deliverables: list[str],
    deadline: dict[str, Any] | None,
    acceptance_value: dict[str, Any],
) -> dict[str, Any]:
    return {
        "id": "milestone_1",
        "description": description,
        "deliverables": deliverables,
        "deadline": deadline,
        "acceptance": acceptance_value,
    }


def payment(
    payment_id: str,
    *,
    amount_type: str,
    amount: dict[str, Any] | None,
    share_percent: str | None,
    trigger_type: str,
) -> dict[str, Any]:
    return {
        "id": payment_id,
        "purpose": "release",
        "amountType": amount_type,
        "amount": amount,
        "sharePercent": share_percent,
        "payerPartyId": "party_2",
        "recipientPartyId": "party_1",
        "trigger": {
            "type": trigger_type,
            "milestoneId": "milestone_1" if trigger_type.startswith("milestone_") else None,
            "timing": None,
        },
    }


def issue(kind: str, code: str, paths: list[str], evidence: list[str]) -> dict[str, Any]:
    return {"kind": kind, "code": code, "paths": paths, "evidence": evidence}


def provenance(path: str, quote: str) -> dict[str, str]:
    return {"path": path, "quote": quote}


def record(
    *,
    example_id: str,
    split: str,
    family: str,
    text: str,
    agreement: dict[str, Any],
    issues: list[dict[str, Any]],
    provenance_entries: list[dict[str, str]],
    phenomena: list[str],
    difficulty: str,
) -> dict[str, Any]:
    return {
        "recordVersion": "pai.training-example.v0.2",
        "exampleId": example_id,
        "task": "agreement_extraction",
        "split": split,
        "input": {"text": text, "language": "en", "format": "plain_text"},
        "trustedContext": {"facts": []},
        "target": {
            "schemaVersion": "pai.agreement.v0.2",
            "agreement": agreement,
            "issues": issues,
            "provenance": provenance_entries,
        },
        "metadata": {
            "difficulty": difficulty,
            "phenomena": phenomena,
            "origin": "synthetic",
            "generator": GENERATOR,
            "parentExampleIds": [],
            "reviewStatus": "draft",
            "leakageGroupId": family,
            "sourceLicense": "CC0-1.0",
            "containsPersonalData": False,
            "notes": ["Synthetic seed record; requires human adjudication before production training."],
        },
    }


def complete_flat_fee_records() -> Iterable[dict[str, Any]]:
    rows = [
        ("Maya", "Theo", "create a five-page website", "1500", "USD", "2026-10-20", "all five pages, mobile responsiveness, and no broken links"),
        ("Nila", "Owen", "design a restaurant menu", "800", "EUR", "2026-10-24", "print-ready PDF files and editable source files"),
        ("Arman", "Clara", "produce a two-minute product video", "2200", "USD", "2026-11-02", "1080p delivery, approved captions, and licensed music"),
        ("Sara", "Emre", "translate the user guide into Turkish", "650", "EUR", "2026-11-06", "all sections translated and terminology matching the glossary"),
    ]
    for index, (provider, client, work, amount, code, date, criteria) in enumerate(rows, 1):
        text = (
            f"{provider} will {work} for {client} for {amount} {code}, paid by bank transfer "
            f"after {client} accepts delivery. Acceptance requires {criteria}. Delivery date is {date}."
        )
        agreement = empty_agreement()
        agreement["parties"] = [
            party("party_1", provider, ["provider", "payee"]),
            party("party_2", client, ["client", "payer"]),
        ]
        agreement["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        agreement["pricing"] = {
            "total": money(amount, code),
            "settlementAsset": fiat_asset(code),
        }
        agreement["milestones"] = [
            milestone(work, [work], absolute_deadline(date), acceptance(True, "party_2", [criteria]))
        ]
        agreement["payments"] = [
            payment(
                "payment_1",
                amount_type="fixed",
                amount=money(amount, code),
                share_percent=None,
                trigger_type="milestone_accepted",
            )
        ]
        yield record(
            example_id=f"pai_v0_2_train_complete_flat_{index:03d}",
            split="train",
            family="train_complete_flat_fee",
            text=text,
            agreement=agreement,
            issues=[],
            provenance_entries=[
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/total/amount", f"{amount} {code}"),
                provenance("/agreement/milestones/0/acceptance/criteria/0", criteria),
                provenance("/agreement/milestones/0/deadline/date", date),
            ],
            phenomena=["party_resolution", "scope", "pricing", "absolute_deadline", "acceptance", "payment_schedule", "provenance"],
            difficulty="basic",
        )


def milestone_schedule_records() -> Iterable[dict[str, Any]]:
    rows = [
        ("Iris", "Rowan", "produce a brand guide", "2000", "EUR", "30", "70", "2026-11-01", "logo files, color codes, and typography rules"),
        ("Deniz", "Layla", "build an analytics dashboard", "3000", "USD", "25", "75", "2026-11-08", "five agreed metrics and CSV export"),
        ("Kian", "Marta", "prepare an investor deck", "1200", "EUR", "40", "60", "2026-11-12", "twelve approved slides and editable source files"),
        ("Rana", "Victor", "develop a booking prototype", "4500", "USD", "20", "80", "2026-11-19", "working search, booking, and cancellation flows"),
    ]
    for index, (provider, client, work, amount, code, upfront, final, date, criteria) in enumerate(rows, 1):
        text = (
            f"{provider} will {work} for {client} for {amount} {code}. {client} pays {upfront}% upfront "
            f"and {final}% after accepting the final delivery. Acceptance requires {criteria}. "
            f"Final delivery is due {date}. Payment is by bank transfer."
        )
        agreement = empty_agreement()
        agreement["parties"] = [
            party("party_1", provider, ["provider", "payee"]),
            party("party_2", client, ["client", "payer"]),
        ]
        agreement["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        agreement["pricing"] = {"total": money(amount, code), "settlementAsset": fiat_asset(code)}
        agreement["milestones"] = [
            milestone(work, [work], absolute_deadline(date), acceptance(True, "party_2", [criteria]))
        ]
        agreement["payments"] = [
            payment("payment_1", amount_type="percentage", amount=None, share_percent=upfront, trigger_type="upfront"),
            payment("payment_2", amount_type="percentage", amount=None, share_percent=final, trigger_type="milestone_accepted"),
        ]
        yield record(
            example_id=f"pai_v0_2_train_milestone_schedule_{index:03d}",
            split="train",
            family="train_milestone_schedule",
            text=text,
            agreement=agreement,
            issues=[],
            provenance_entries=[
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/total/amount", f"{amount} {code}"),
                provenance("/agreement/payments/0/sharePercent", f"{upfront}% upfront"),
                provenance("/agreement/payments/1/sharePercent", f"{final}% after accepting"),
                provenance("/agreement/milestones/0/acceptance/criteria/0", criteria),
                provenance("/agreement/milestones/0/deadline/date", date),
            ],
            phenomena=["party_resolution", "scope", "pricing", "milestone", "payment_schedule", "absolute_deadline", "acceptance", "provenance"],
            difficulty="intermediate",
        )


def ambiguous_currency_records() -> Iterable[dict[str, Any]]:
    rows = [
        ("Nora", "Omar", "design a product page", "1200", "2026-10-10", "a responsive page matching the supplied mockup"),
        ("Elif", "Jon", "edit a launch video", "900", "2026-10-18", "a final 4K video with approved subtitles"),
        ("Pavel", "Dara", "write an API integration guide", "700", "2026-10-22", "working examples for all documented endpoints"),
        ("Sina", "Alice", "create a mobile onboarding flow", "1800", "2026-10-30", "six approved screens and a clickable prototype"),
    ]
    for index, (provider, client, work, amount, date, criteria) in enumerate(rows, 1):
        amount_quote = f"${amount}"
        text = (
            f"{provider} will {work} for {client} for {amount_quote}, paid by bank transfer after {client} "
            f"accepts delivery. Acceptance requires {criteria}. Delivery is due {date}."
        )
        agreement = empty_agreement()
        agreement["parties"] = [party("party_1", provider, ["provider", "payee"]), party("party_2", client, ["client", "payer"])]
        agreement["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        agreement["pricing"] = {"total": money(amount, None, "$"), "settlementAsset": fiat_asset("$")}
        agreement["milestones"] = [milestone(work, [work], absolute_deadline(date), acceptance(True, "party_2", [criteria]))]
        agreement["payments"] = [payment("payment_1", amount_type="fixed", amount=money(amount, None, "$"), share_percent=None, trigger_type="milestone_accepted")]
        yield record(
            example_id=f"pai_v0_2_train_ambiguous_currency_{index:03d}",
            split="train",
            family="train_ambiguous_currency",
            text=text,
            agreement=agreement,
            issues=[issue("ambiguity", "AMBIGUOUS_CURRENCY", ["/agreement/pricing/total/currency", "/agreement/payments/0/amount/currency"], [amount_quote])],
            provenance_entries=[
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/total/amount", amount_quote),
                provenance("/agreement/pricing/total/currency/symbol", amount_quote),
                provenance("/agreement/milestones/0/acceptance/criteria/0", criteria),
                provenance("/agreement/milestones/0/deadline/date", date),
            ],
            phenomena=["currency", "ambiguity", "pricing", "provenance"],
            difficulty="intermediate",
        )


def missing_acceptance_records() -> Iterable[dict[str, Any]]:
    rows = [
        ("Ava", "Liam", "deliver a logo package", "900", "USD", "2026-10-15"),
        ("Eren", "Mira", "deliver the inventory spreadsheet", "500", "EUR", "2026-10-19"),
        ("Tara", "Noah", "deliver the podcast edit", "750", "USD", "2026-10-26"),
        ("Bora", "Nina", "deliver the architectural renders", "2400", "EUR", "2026-11-04"),
    ]
    for index, (provider, client, work, amount, code, date) in enumerate(rows, 1):
        text = (
            f"{provider} will {work} to {client} for {amount} {code} by {date}. {client}'s approval is "
            "required before payment. Payment is by bank transfer."
        )
        agreement = empty_agreement()
        agreement["parties"] = [party("party_1", provider, ["provider", "payee"]), party("party_2", client, ["client", "payer"])]
        agreement["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        agreement["pricing"] = {"total": money(amount, code), "settlementAsset": fiat_asset(code)}
        agreement["milestones"] = [milestone(work, [work], absolute_deadline(date), acceptance(True, "party_2", []))]
        agreement["payments"] = [payment("payment_1", amount_type="fixed", amount=money(amount, code), share_percent=None, trigger_type="milestone_accepted")]
        yield record(
            example_id=f"pai_v0_2_train_missing_acceptance_{index:03d}",
            split="train",
            family="train_missing_acceptance_criteria",
            text=text,
            agreement=agreement,
            issues=[issue("missing_term", "MISSING_ACCEPTANCE_CRITERIA", ["/agreement/milestones/0/acceptance/criteria"], [])],
            provenance_entries=[
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/total/amount", f"{amount} {code}"),
                provenance("/agreement/milestones/0/deadline/date", date),
                provenance("/agreement/milestones/0/acceptance/required", "approval is required"),
            ],
            phenomena=["acceptance", "missing_term", "payment_schedule", "provenance"],
            difficulty="intermediate",
        )


def contradictory_deadline_records() -> Iterable[dict[str, Any]]:
    rows = [
        ("Zoe", "Amir", "deliver the research brief", "1000", "USD", "2026-11-10", "2026-11-12", "coverage of all five competitors"),
        ("Cem", "Lara", "deliver the packaging designs", "1600", "EUR", "2026-11-18", "2026-11-21", "three print-ready packaging concepts"),
    ]
    for index, (provider, client, work, amount, code, first_date, second_date, criteria) in enumerate(rows, 1):
        first_quote = f"Deadline is {first_date}."
        second_quote = f"The same final delivery is due {second_date}."
        text = (
            f"{provider} will {work} for {client} for {amount} {code}, paid by bank transfer after approval. "
            f"Acceptance requires {criteria}. {first_quote} {second_quote}"
        )
        agreement = empty_agreement()
        agreement["parties"] = [party("party_1", provider, ["provider", "payee"]), party("party_2", client, ["client", "payer"])]
        agreement["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        agreement["pricing"] = {"total": money(amount, code), "settlementAsset": fiat_asset(code)}
        agreement["milestones"] = [milestone(work, [work], None, acceptance(True, "party_2", [criteria]))]
        agreement["payments"] = [payment("payment_1", amount_type="fixed", amount=money(amount, code), share_percent=None, trigger_type="milestone_accepted")]
        yield record(
            example_id=f"pai_v0_2_validation_contradictory_deadline_{index:03d}",
            split="validation",
            family="validation_contradictory_deadline",
            text=text,
            agreement=agreement,
            issues=[issue("contradiction", "CONTRADICTORY_DEADLINE", ["/agreement/milestones/0/deadline"], [first_quote, second_quote])],
            provenance_entries=[
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/total/amount", f"{amount} {code}"),
                provenance("/agreement/milestones/0/acceptance/criteria/0", criteria),
            ],
            phenomena=["absolute_deadline", "contradiction", "provenance"],
            difficulty="adversarial",
        )


def unresolved_pronoun_records() -> Iterable[dict[str, Any]]:
    rows = [
        ("Ava", "Ben", "Chris", "build a landing page", "1000", "USD", "2026-12-01"),
        ("Mina", "Oren", "Dalia", "prepare a tax summary", "850", "EUR", "2026-12-05"),
    ]
    for index, (client, provider, reviewer, work, amount, code, date) in enumerate(rows, 1):
        text = (
            f"{client} hires {provider} to {work} for {amount} {code}. {reviewer} will review the work. "
            f"He must approve it before payment. Delivery is due {date}. Payment is by bank transfer."
        )
        agreement = empty_agreement()
        agreement["parties"] = [
            party("party_1", provider, ["provider", "payee"]),
            party("party_2", client, ["client", "payer"]),
            party("party_3", reviewer, ["other"]),
        ]
        agreement["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        agreement["pricing"] = {"total": money(amount, code), "settlementAsset": fiat_asset(code)}
        agreement["milestones"] = [milestone(work, [work], absolute_deadline(date), acceptance(True, None, []))]
        agreement["payments"] = [payment("payment_1", amount_type="fixed", amount=money(amount, code), share_percent=None, trigger_type="milestone_accepted")]
        yield record(
            example_id=f"pai_v0_2_validation_unresolved_pronoun_{index:03d}",
            split="validation",
            family="validation_unresolved_pronoun",
            text=text,
            agreement=agreement,
            issues=[
                issue("unresolved_reference", "UNRESOLVED_PRONOUN", ["/agreement/milestones/0/acceptance/approverPartyId"], ["He"]),
                issue("missing_term", "MISSING_ACCEPTANCE_CRITERIA", ["/agreement/milestones/0/acceptance/criteria"], []),
            ],
            provenance_entries=[
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/parties/2/displayName", reviewer),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/total/amount", f"{amount} {code}"),
                provenance("/agreement/milestones/0/deadline/date", date),
            ],
            phenomena=["party_resolution", "acceptance", "unresolved_reference", "missing_term", "provenance"],
            difficulty="adversarial",
        )


def dynamic_pricing_records() -> Iterable[dict[str, Any]]:
    rows = [
        ("Mina", "Leo", "run one advertising campaign", "8", "2026-12-10", "campaign report lists verified ad spend"),
        ("Ozan", "Rita", "manage one affiliate launch", "12", "2026-12-14", "final report lists verified affiliate revenue"),
    ]
    for index, (provider, client, work, percent, date, criteria) in enumerate(rows, 1):
        formula_quote = f"Final fee equals {percent}% of the campaign's total verified ad spend" if index == 1 else f"Final fee equals {percent}% of verified affiliate revenue"
        text = (
            f"{provider} will {work} for {client}. {formula_quote}, paid in USD by bank transfer after completion. "
            f"The work ends {date}. Acceptance requires that the {criteria}."
        )
        agreement = empty_agreement()
        agreement["parties"] = [party("party_1", provider, ["provider", "payee"]), party("party_2", client, ["client", "payer"])]
        agreement["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        agreement["pricing"] = {"total": None, "settlementAsset": fiat_asset("USD")}
        agreement["milestones"] = [milestone(work, [work], absolute_deadline(date), acceptance(True, "party_2", [criteria]))]
        agreement["payments"] = [payment("payment_1", amount_type="percentage", amount=None, share_percent=percent, trigger_type="milestone_accepted")]
        yield record(
            example_id=f"pai_v0_2_challenge_dynamic_pricing_{index:03d}",
            split="challenge",
            family="challenge_dynamic_pricing",
            text=text,
            agreement=agreement,
            issues=[issue("unsupported_term", "UNSUPPORTED_DYNAMIC_PRICING", ["/agreement/pricing", "/agreement/payments/0"], [formula_quote])],
            provenance_entries=[
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/settlementAsset/symbol", "USD"),
                provenance("/agreement/payments/0/sharePercent", f"{percent}%"),
                provenance("/agreement/milestones/0/deadline/date", date),
                provenance("/agreement/milestones/0/acceptance/criteria/0", criteria),
            ],
            phenomena=["pricing", "unsupported_term", "payment_schedule", "provenance"],
            difficulty="adversarial",
        )


def recurring_retainer_records() -> Iterable[dict[str, Any]]:
    rows = [
        ("Uma", "Noah", "provide weekly community management", "600", "USD", "every month"),
        ("Kara", "Eli", "provide ongoing bookkeeping support", "450", "EUR", "on the first day of every month"),
    ]
    for index, (provider, client, work, amount, code, recurrence) in enumerate(rows, 1):
        recurrence_quote = f"{client} pays {amount} {code} {recurrence}"
        text = (
            f"{provider} will {work} for {client}. {recurrence_quote} by bank transfer. "
            "Either party may cancel with 30 days notice."
        )
        agreement = empty_agreement()
        agreement["parties"] = [party("party_1", provider, ["provider", "payee"]), party("party_2", client, ["client", "payer"])]
        agreement["scope"] = {"summary": work, "deliverables": [work], "exclusions": []}
        agreement["pricing"] = {"total": None, "settlementAsset": fiat_asset(code)}
        agreement["payments"] = [payment("payment_1", amount_type="fixed", amount=money(amount, code), share_percent=None, trigger_type="date_reached")]
        yield record(
            example_id=f"pai_v0_2_challenge_recurring_retainer_{index:03d}",
            split="challenge",
            family="challenge_recurring_retainer",
            text=text,
            agreement=agreement,
            issues=[issue("unsupported_term", "UNSUPPORTED_RECURRING_RETAINER", ["/agreement/payments/0"], [recurrence_quote])],
            provenance_entries=[
                provenance("/agreement/parties/0/displayName", provider),
                provenance("/agreement/parties/1/displayName", client),
                provenance("/agreement/scope/deliverables/0", work),
                provenance("/agreement/pricing/settlementAsset/symbol", code),
                provenance("/agreement/payments/0/amount", f"{amount} {code}"),
            ],
            phenomena=["pricing", "payment_schedule", "unsupported_term", "provenance"],
            difficulty="adversarial",
        )


def build_records() -> list[dict[str, Any]]:
    builders = [
        complete_flat_fee_records,
        milestone_schedule_records,
        ambiguous_currency_records,
        missing_acceptance_records,
        contradictory_deadline_records,
        unresolved_pronoun_records,
        dynamic_pricing_records,
        recurring_retainer_records,
    ]
    return [value for builder in builders for value in builder()]


def render_outputs(records: list[dict[str, Any]]) -> dict[str, str]:
    outputs: dict[str, str] = {}
    for split in ("train", "validation", "challenge"):
        split_records = [record for record in records if record["split"] == split]
        outputs[f"{split}.jsonl"] = "".join(
            json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
            for record in split_records
        )
    family_counts = Counter(record["metadata"]["leakageGroupId"] for record in records)
    issue_counts = Counter(
        issue_value["code"]
        for record_value in records
        for issue_value in record_value["target"]["issues"]
    )
    manifest = {
        "corpusVersion": "pai.seed-corpus.v0.1",
        "generator": GENERATOR,
        "recordVersion": "pai.training-example.v0.2",
        "reviewStatus": "draft",
        "recordCount": len(records),
        "splitCounts": dict(sorted(Counter(record["split"] for record in records).items())),
        "familyCounts": dict(sorted(family_counts.items())),
        "issueCounts": dict(sorted(issue_counts.items())),
        "trainingExclusions": [
            "validation",
            "challenge",
            "docs/ai/annotation/fixtures/pai-annotation-adversarial-v0.2.json",
        ],
    }
    outputs["manifest.json"] = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    return outputs


def write_or_check(output_dir: Path, outputs: dict[str, str], check: bool) -> int:
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
    print(f"Seed corpus {action}: {len(outputs)} files")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    return write_or_check(args.output_dir, render_outputs(build_records()), args.check)


if __name__ == "__main__":
    raise SystemExit(main())
