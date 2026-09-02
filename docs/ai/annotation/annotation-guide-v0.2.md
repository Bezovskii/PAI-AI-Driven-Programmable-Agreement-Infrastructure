# PAI Agreement Annotation Guide v0.2

Status: Candidate specification

Target model-output version: `pai.agreement.v0.2`

Target agreement schema: `urn:pai:schema:agreement:v0.2`

Target issue registry: `pai.issue-codes.v0.2`

## 1. Purpose

This guide defines how a human annotator or supervised model converts source deal language into a PAI model output containing:

- structured agreement facts;
- semantic issues; and
- exact-quote provenance.

The goal is faithful extraction, not contract drafting. The output may be incomplete. It must never become more specific than the source permits.

## 2. Normative language

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are normative requirements.

When this guide conflicts with the JSON Schemas, the schemas control structure and this guide controls annotation semantics. A conflict between them is a specification defect and MUST be reported rather than silently worked around.

## 3. System boundary

The Agreement Model performs semantic extraction only.

It MAY:

- copy explicit facts;
- perform approved lossless normalization;
- connect uniquely resolvable references;
- identify registered semantic issues; and
- cite exact source quotes.

It MUST NOT perform:

- arithmetic or payment-total calculations;
- percentage-sum validation;
- risk scoring or policy recommendations;
- provenance offset calculation or quote verification;
- blockchain registry resolution not supplied by the source or trusted context;
- token atomic-unit conversion;
- contract compilation or deployment-readiness analysis;
- execution-router or chain-adapter diagnostics;
- legal advice, legal classification, or invented dispute rules; or
- autonomous approval, arbitration, fund movement, or contract execution.

Those responsibilities belong to deterministic validation, policy, resolution, user-confirmation, and execution layers.

## 4. Output contract

Every annotation MUST produce exactly one object with:

```json
{
  "schemaVersion": "pai.agreement.v0.2",
  "agreement": {},
  "issues": [],
  "provenance": []
}
```

The complete `agreement` object MUST satisfy `pai-agreement-v0.2.schema.json`. Missing information is represented with schema-approved `null` values, empty arrays, `unknown`, or `unspecified`, plus issues where required by this guide. Annotators MUST NOT omit required structural fields.

## 5. Annotation decision ladder

For every candidate fact, apply these steps in order:

1. **Explicit extraction** — Is the fact directly stated?
2. **Approved normalization** — Can the same meaning be represented canonically without adding information?
3. **Unique reference resolution** — Does the source identify exactly one existing entity?
4. **Direct implication** — Is the fact unavoidable from the wording rather than merely likely?
5. **Issue selection** — If the value is incomplete, unclear, conflicting, unresolved, or unrepresentable, add the narrowest registered issue.
6. **Safe absence** — Leave the value null, empty, unknown, or unspecified when the source does not justify a value.

If two competent annotators could reasonably choose materially different values, do not choose one silently. Preserve the uncertainty and annotate an issue.

## 6. Extraction, normalization, inference, and invention

### 6.1 Extraction

Extraction preserves a fact stated in the source.

Source: `The total is 4,500 USD.`

Allowed: `amount: "4500"`, `currency.code: "USD"`.

### 6.2 Approved normalization

Approved normalization changes form but not meaning. Allowed examples include:

- removing thousands separators: `4,500` → `"4500"`;
- writing decimal money as strings: `25.50` → `"25.50"`;
- normalizing an explicit fraction: `half` → `sharePercent: "50"`;
- normalizing an explicit date with an unambiguous year: `September 15, 2026` → `2026-09-15`;
- normalizing an explicit duration: `within two weeks` → `P14D`;
- assigning canonical local IDs in source order; and
- mapping clearly synonymous event wording to a schema enum, such as `after delivery` → `milestone_delivered` when the referenced milestone is unique.

Normalization MUST NOT resolve an ambiguity. `$` MUST NOT become `USD` without source or trusted context. `USDC` MUST NOT receive a network or asset identifier unless the source or trusted context uniquely supplies it.

### 6.3 Direct implication

A direct implication is permitted only when denying it would contradict the ordinary meaning of the source.

Source: `I will design the logo.`

Allowed: the speaker is a `provider`; `Logo design` is a deliverable.

Source: `I need a logo.`

Not automatically allowed: the speaker is the payer, the counterparty is the provider, or a payment exists.

### 6.4 Forbidden invention

Forbidden invention adds a reasonable-sounding term that the parties did not state or unavoidably imply. Examples:

- assuming the client is the approver;
- inventing a seven-day review window;
- treating recommended screenshots as agreed evidence;
- assuming `$` means USD;
- selecting Base because USDC on Base is common;
- calculating `2250` from half of `4500`;
- inventing exclusions such as SEO, hosting, or taxes;
- adding standard refund, arbitration, governing-law, or late-fee terms; and
- assigning wallet addresses from names or conversational roles.

Forbidden invention is an annotation error, not an `unsupported_term` issue.

## 7. Issue-kind decision rules

Use only codes registered in `pai-issue-codes-v0.2.json`.

| Kind | Use when | Do not use when |
|---|---|---|
| `missing_term` | A needed term is absent from the source. | The source contains unclear or conflicting wording. |
| `ambiguity` | One source expression supports multiple materially different interpretations. | A reference exists but cannot be linked uniquely; use `unresolved_reference`. |
| `contradiction` | Two or more explicit statements cannot all be true as written. | Detecting the conflict requires arithmetic or external facts. |
| `unresolved_reference` | A stated reference cannot be linked safely to one entity or identifier. | The referenced term was never stated; use `missing_term`. |
| `unsupported_term` | The source explicitly states a term that v0.2 cannot represent without material loss. | The schema can represent it with null/unspecified plus another issue. |

### 7.1 Precedence

Apply the narrowest cause:

1. explicit conflicting statements → `contradiction`;
2. explicit but unresolvable reference → `unresolved_reference`;
3. explicit expression with multiple readings → `ambiguity`;
4. explicit but structurally unrepresentable term → `unsupported_term`;
5. absent needed term → `missing_term`.

Do not emit multiple issues for the same path and same underlying defect unless each issue identifies a genuinely independent problem.

### 7.2 Materiality

An uncertainty is material when different interpretations could change a party, obligation, deliverable, amount, currency, settlement asset or network, deadline, trigger, acceptance, revision, evidence, dispute, or resolution term.

Stylistic uncertainty is not an issue.

### 7.3 v0.2 completeness profile

All v0.2 dataset annotations use the **executable-agreement candidate** profile. Under this profile, emit missing-term issues only under the following conditions:

| Code | Emit when |
|---|---|
| `MISSING_PARTY` | An obligation exists but a party required to assign that obligation is not stated. Do not assume every agreement must contain exactly two parties. |
| `MISSING_SCOPE` | No work, goods, service, or exchange subject is stated. |
| `MISSING_DELIVERABLE` | Performance is expected but no output is explicit or directly implied. |
| `MISSING_PRICE` | The source describes a paid exchange but gives neither a total nor any payment amount/share. Do not use it for a clearly gratuitous agreement. |
| `MISSING_CURRENCY` | A monetary amount is stated with neither a currency code nor a symbol. |
| `MISSING_SETTLEMENT_ASSET` | Executable settlement is expected but no settlement asset has been selected. This may coexist with a stated pricing currency. |
| `MISSING_SETTLEMENT_NETWORK` | A blockchain asset is selected but no settlement network is stated. Do not use it for fiat settlement. |
| `MISSING_DEADLINE` | A delivery or milestone obligation exists but no applicable deadline is stated. |
| `MISSING_PAYMENT_TRIGGER` | A payment obligation exists but its trigger or timing is absent. |
| `MISSING_ACCEPTANCE_CRITERIA` | Acceptance is explicitly required but no criteria are stated. |
| `MISSING_ACCEPTANCE_AUTHORITY` | Acceptance is explicitly required but no approver is stated. |

Do not emit a missing-term issue merely because a nullable schema field is null. The condition in this table must apply.

### 7.4 Ambiguity versus unresolved reference

Use `ambiguity` when the meaning of a source expression has multiple material readings. Use `unresolved_reference` when the meaning is clear enough, but its target cannot be linked uniquely.

Examples:

- `$500` → `AMBIGUOUS_CURRENCY` because `$` has multiple currency meanings.
- `Alex approves it`, with two parties named Alex → `UNRESOLVED_PARTY_REFERENCE`.
- `Pay after it is approved`, with several possible deliverables → `UNRESOLVED_PRONOUN` or `UNRESOLVED_MILESTONE_REFERENCE` at the narrowest affected path.
- `Pay after approval or delivery` → `AMBIGUOUS_PAYMENT_TRIGGER` because the source states alternative trigger meanings.
- `USDC on Base`, with no trusted mapping to a canonical identifier → `UNRESOLVED_SETTLEMENT_NETWORK` or `UNRESOLVED_SETTLEMENT_ASSET`, not a missing-term issue, because the term is present.

When one missing statement causes a later identifier to be unresolved, report the root defect rather than cascading duplicate issues across every dependent path.

## 8. Issue evidence

Evidence rules are fixed by issue kind:

- `missing_term`: evidence MAY be empty because absence often has no quote.
- All other kinds: evidence MUST contain one or more exact, non-empty source quotes.

Contradictions SHOULD cite every conflicting statement necessary to demonstrate the conflict. Issue evidence MUST NOT contain paraphrases, explanations, calculated results, or text absent from the source.

Issue paths MUST point inside `/agreement`. Use the narrowest affected JSON Pointer. If the defect affects a collection rather than one known item, point to the collection.

## 9. Provenance

Provenance connects an extracted fact to the language that supports it.

Rules:

1. `quote` MUST be an exact contiguous substring of the source, preserving spelling and capitalization.
2. `path` MUST identify the supported agreement value or object inside `/agreement`.
3. Do not return character offsets. Deterministic code finds and verifies offsets.
4. Do not fabricate quotes, clean grammar, translate, or replace symbols inside quotes.
5. If one fact is supported by multiple non-contiguous passages, create separate provenance entries.
6. A quote may support multiple paths through separate entries.
7. Purely structural defaults and canonical IDs do not require provenance.
8. Every material non-null extracted fact SHOULD have provenance.

## 10. IDs and ordering

Assign IDs deterministically in first-mention order:

- `party_1`, `party_2`, ...
- `milestone_1`, `milestone_2`, ...
- `payment_1`, `payment_2`, ...
- `evidence_1`, `evidence_2`, ...

Do not reorder entities for perceived importance. Repeated mentions of the same uniquely identified entity MUST reuse its ID. Do not merge entities merely because they share a role.

## 11. Parties

### 11.1 References

Use:

- `speaker` for the source speaker or author;
- `counterparty` for the other conversational party when uniquely established;
- `named` for an explicitly named person or organization;
- `context` only for a party supplied by trusted external context; and
- `unknown` when no safer category applies.

### 11.2 Display names

Copy explicit names. Do not convert `I`, `you`, `client`, or `designer` into invented names. Use `null` when no display name is stated.

### 11.3 Roles

Assign a role only when explicit or unavoidable from the described action:

- performs the work → `provider`;
- receives the work → `client`;
- owes or sends a payment → `payer`;
- receives a payment → `payee`;
- acquires goods → `buyer`;
- supplies goods → `seller`.

Do not infer payer/payee merely from speaker/counterparty status. If multiple materially different roles remain possible, use `unknown` where necessary and emit `AMBIGUOUS_PARTY_ROLE`.

Price wording alone does not always establish payment direction. From `I will build the site for $4,500`, assigning `provider` to the speaker is safe, but assigning payer/payee IDs is not safe unless the source or trusted context establishes who pays whom. From `You will pay me $4,500`, payer and payee are explicit.

## 12. Scope, deliverables, and exclusions

`scope.summary` is a concise faithful normalization, not marketing copy or an expanded statement of work.

`deliverables` MAY include:

- explicitly named outputs; and
- outputs directly implied by an explicit commitment to create or deliver them.

`exclusions` MUST contain only explicit exclusions. Never infer exclusions from industry norms, omissions, price, or feasibility.

Use `MISSING_SCOPE` when no work or exchange scope is stated. Use `MISSING_DELIVERABLE` when no deliverable is stated or directly implied. These may coexist only when both defects independently apply.

## 13. Pricing and money

### 13.1 Decimal strings

Money amounts and percentages MUST be decimal strings, never JSON numbers. Preserve stated precision when useful, but remove formatting separators and currency decorations from `amount`.

### 13.2 Currency

Currency code and symbol are separate:

```json
{
  "amount": "4500",
  "currency": { "code": null, "symbol": "$" }
}
```

Use `AMBIGUOUS_CURRENCY` when a stated symbol has multiple materially possible codes. Use `MISSING_CURRENCY` only when an amount is stated with neither code nor symbol.

### 13.3 No arithmetic

Normalize `half` to `sharePercent: "50"`, but do not calculate a money amount. Do not determine whether payment percentages sum to 100. Do not compare totals by arithmetic. Those checks belong to deterministic validation.

## 14. Agreement value and settlement asset

`pricing.total` describes the economic agreement value. `pricing.settlementAsset` describes what is used to settle. They are not interchangeable.

Example: a deal may be priced at `4500 USD` and settled in `USDC` on Base.

### 14.1 Settlement fields

- `type`: use `native`, `token`, `fiat`, `other`, or `unknown` based on stated facts.
- `symbol`: copy or safely normalize the stated asset symbol.
- `networkId`: use a CAIP-2-compatible identifier only when uniquely supplied by source or trusted context.
- `assetId`: use a CAIP-19-compatible identifier only when uniquely supplied by source or trusted context.

Syntactic compatibility does not prove semantic correctness. The model MUST NOT derive an asset contract, issuer, mint, or network identifier from general knowledge.

Use the appropriate distinction:

- nothing states a settlement asset → `MISSING_SETTLEMENT_ASSET`;
- asset stated, blockchain network absent → `MISSING_SETTLEMENT_NETWORK`;
- several assets or networks are plausible → corresponding `AMBIGUOUS_*` code;
- wording names an asset/network but cannot map safely to one identifier → corresponding `UNRESOLVED_*` code;
- explicit asset or network statements conflict → corresponding `CONTRADICTORY_*` code.

Asset/network compatibility is checked deterministically. Do not create a semantic issue solely from external registry knowledge.

## 15. Milestones

Milestones represent work, delivery events, or other agreement events. Deposits and payment transfers are not milestones unless the source separately defines them as work/events.

Create a milestone when a payment trigger or deadline refers to a distinct work stage that must be represented. Its description and deliverables must remain source-grounded.

Do not manufacture a milestone solely to make the payment structure look tidy.

## 16. Payments

Payments are separate objects that may reference milestones.

### 16.1 Purpose

- `funding`: funds placed into the agreement or escrow;
- `release`: funds released after a condition;
- `direct`: direct payment not described as funding/release/refund;
- `refund`: funds returned;
- `unspecified`: source does not establish the purpose.

### 16.2 Amount type

- explicit fixed amount → `fixed`;
- explicit percentage or fraction → `percentage`;
- explicit remaining balance → `remainder`;
- otherwise → `unspecified`.

Do not calculate a fixed amount from a percentage or remainder.

### 16.3 Payer and recipient

Resolve party IDs only when the source or trusted context makes the direction unique. Otherwise use null and the appropriate ambiguity or unresolved-reference issue.

### 16.4 Triggers

Map event wording to the narrowest supported trigger type. A trigger referring to a milestone MUST use its ID only when uniquely resolvable.

Use `unspecified` plus `MISSING_PAYMENT_TRIGGER` when no trigger or timing is stated. Use `AMBIGUOUS_PAYMENT_TRIGGER` when wording supports multiple events. Use `UNRESOLVED_MILESTONE_REFERENCE` when the event is clear but the milestone reference is not.

## 17. Deadlines

Use `absolute_date` for a stated calendar date and `relative` for a duration anchored to an event.

For absolute deadlines:

- normalize the date only if year, month, and day are safely known;
- record time only when stated; and
- record timezone only when stated or supplied by trusted context.

For relative deadlines:

- normalize the duration to ISO 8601 where unambiguous; and
- preserve the stated anchor in `relativeTo` or emit `UNRESOLVED_RELATIVE_DEADLINE_REFERENCE` if it cannot be safely identified.

Do not convert a relative deadline into a calendar date before the anchor event occurs. Do not assume timezone, business-day rules, inclusive counting, or current year.

## 18. Acceptance

If approval or acceptance is explicitly required, set `required: true`.

Do not infer the approving party from common practice. Do not invent acceptance criteria.

- criteria absent → empty `criteria` plus `MISSING_ACCEPTANCE_CRITERIA`;
- approving party absent → null `approverPartyId` plus `MISSING_ACCEPTANCE_AUTHORITY`;
- approving reference present but unclear → null plus `AMBIGUOUS_ACCEPTANCE_AUTHORITY` or `UNRESOLVED_PARTY_REFERENCE`, depending on the defect.

If the source is silent on whether acceptance is required, use `required: null`, not `false`.

## 19. Revision terms

Extract only stated revision rounds, pricing, scope, and conditions. If rounds are stated but their scope is unclear, use `appliesTo: "unspecified"` and `AMBIGUOUS_REVISION_SCOPE`.

Do not interpret `two revisions` as two design revisions, two project-wide revisions, or two revisions per milestone without support.

## 20. Evidence terms

`evidenceTerms` contains only evidence the parties explicitly require as part of the agreement.

Do not add evidence that PAI recommends, that would be prudent in a dispute, or that the protocol may later request. Recommended evidence belongs to a policy or risk layer after extraction.

## 21. Dispute terms

Extract only explicit dispute settings, resolver, initiation conditions, evidence window, and resolution options.

Do not:

- decide whether disputes should be enabled;
- invent a resolver or arbitration procedure;
- infer legal jurisdiction;
- generate judgment standards; or
- predict a dispute outcome.

Silence is represented with nulls and empty arrays, not industry defaults.

## 22. Contradictions and deterministic checks

A model-level contradiction must be visible directly in explicit language.

Allowed contradiction:

> `The deadline is September 10.`
>
> `Delivery is due September 15.`

Not a model contradiction:

> `Pay 60% first and 50% later.`

The second case requires arithmetic to establish a total over 100 and belongs to deterministic validation. The model may extract both percentages without issuing `CONTRADICTORY_PRICE` or another arithmetic-derived issue.

Likewise, asset/network mismatch based on an external chain registry is deterministic, not model-semantic, unless the source itself states incompatible facts explicitly.

## 23. Unsupported terms

Use an `UNSUPPORTED_*` code only when the source explicitly contains the term and v0.2 cannot preserve it without material loss:

- recurring retainers;
- dynamic or formula-based pricing;
- nested or compound conditional logic;
- simultaneous multicurrency totals; or
- nonmonetary exchange.

Extract any representable subfacts, leave unsafe fields null or unspecified, and cite the unsupported language. Never flatten a complex term into a misleading simpler term.

## 24. Trusted context

Trusted context is structured information explicitly provided to the annotation process, such as authenticated participant identity or a user-confirmed network selection.

Trusted context MUST:

- be distinguishable from the raw agreement text;
- be included in the example record or annotation metadata;
- be used only for fields it directly resolves; and
- never be replaced by model world knowledge.

Facts sourced only from trusted context SHOULD use `reference: "context"` where applicable and MUST NOT receive fabricated raw-text provenance.

## 25. Worked examples

### 25.1 Ambiguous currency and percentage payment

Source:

> I'll build the store for $4,500. Half after the design is approved.

Required behavior:

- extract amount `"4500"` and symbol `$`;
- leave currency code null and add `AMBIGUOUS_CURRENCY`;
- normalize `Half` to `sharePercent: "50"`;
- do not calculate `2250`;
- create a design milestone if needed by the trigger;
- set acceptance required;
- do not invent approver or criteria; and
- add missing/ambiguity issues at their narrowest paths.

### 25.2 Chain-neutral settlement

Source:

> Settle in USDC on Base.

Required behavior:

- extract token symbol `USDC`;
- normalize Base to a network identifier only if the annotation context explicitly authorizes that mapping;
- do not invent the USDC contract address or asset identifier; and
- use `UNRESOLVED_SETTLEMENT_ASSET` if an identifier is required but the source/context cannot uniquely resolve it.

### 25.3 Relative deadline

Source:

> Deliver within two weeks after agreement acceptance.

Required behavior:

- use a relative deadline;
- normalize duration to `P14D`;
- preserve `agreement acceptance` as the anchor;
- do not create a calendar date.

### 25.4 Explicit evidence

Source:

> The developer must submit the deployment URL as proof of delivery.

Required behavior:

- create an evidence term for `Deployment URL`;
- link it to the party and milestone only if each is uniquely resolvable; and
- provide exact provenance.

### 25.5 Recommended evidence is not an agreement term

Source:

> Build and deploy the website.

Forbidden behavior:

- adding screenshots, commit history, a deployment URL, or client confirmation as evidence requirements.

### 25.6 Unsupported dynamic pricing

Source:

> The fee equals 5% of monthly sales and is recalculated each month.

Required behavior:

- add `UNSUPPORTED_DYNAMIC_PRICING` with the exact quote;
- extract safe surrounding facts if available; and
- do not calculate or substitute a fixed amount.

## 26. Annotation quality checklist

Before accepting an annotation, verify:

- [ ] The root uses `pai.agreement.v0.2`.
- [ ] The agreement validates against the v0.2 agreement schema.
- [ ] Every issue code exists in the v0.2 registry.
- [ ] Issue kind matches the registered code.
- [ ] Every non-missing issue has exact source evidence.
- [ ] All issue and provenance paths are valid `/agreement` JSON Pointers.
- [ ] Material extracted facts have exact-quote provenance.
- [ ] No source quote was corrected, translated, or invented.
- [ ] Money and percentages are decimal strings.
- [ ] No arithmetic-derived facts or issues were added.
- [ ] Agreement value and settlement asset remain separate.
- [ ] No network or asset identifier came from unsupported model knowledge.
- [ ] No acceptance, revision, evidence, dispute, or exclusion term was invented.
- [ ] IDs and arrays follow first-mention order.
- [ ] Missing information remains null, empty, unknown, or unspecified as allowed.
- [ ] No risk, legal, compilation, deployment, or execution judgment appears in the output.

## 27. Adjudication

When annotators disagree:

1. identify the exact source span and target path;
2. classify the disagreement as extraction, normalization, reference resolution, issue selection, or schema coverage;
3. apply the decision ladder and narrowest-cause rule;
4. prefer the less specific output when the source does not decide the question;
5. record the adjudication rationale outside the model output; and
6. escalate recurring disagreements into a guide clarification or versioned schema/registry change.

Do not resolve disagreement by majority vote alone. The final decision must cite a rule and source evidence.

## 28. Adversarial cases required before freeze

Before this guide is frozen, independent annotators MUST adjudicate at least these cases:

1. a one-sentence offer with implicit provider but unstated payer;
2. `$` pricing with no country context;
3. a stated pricing currency but no settlement asset;
4. USDC with no network;
5. USDC on a named network but no canonical asset identifier;
6. a deposit plus milestone releases and a remainder;
7. percentages whose sum is arithmetically inconsistent;
8. a vague pronoun referring to one of several milestones;
9. approval with no criteria or approver;
10. a relative deadline with an unresolved anchor;
11. two explicit conflicting deadlines;
12. revisions with unclear scope;
13. recommended evidence that was not agreed by the parties;
14. dynamic pricing and recurring-retainer language;
15. a nonmonetary exchange; and
16. explicit asset/network language that conflicts only after external registry lookup.

The expected result for each case MUST identify extracted fields, issue codes, issue paths, exact evidence, and exact provenance. Any disagreement that cannot be resolved from this guide blocks the freeze and requires a rule change.

## 29. Change control

This guide, the agreement schema, the model-output schema, and the issue registry form one versioned contract. A material semantic change requires a version review across all four artifacts.

Do not silently update dataset labels after a rule change. Record the affected examples and re-annotate them under the new version.

The v0.2 artifacts remain candidates until adversarial annotation fixtures demonstrate that independent annotators can apply these rules consistently.
