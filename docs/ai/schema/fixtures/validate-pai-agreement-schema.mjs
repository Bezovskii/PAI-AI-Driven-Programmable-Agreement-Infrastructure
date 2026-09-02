import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schemaPath = "docs/ai/schema/pai-agreement-v0.1.schema.json";
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const parties = () => [
  {
    id: "party_1",
    reference: "speaker",
    displayName: null,
    roles: ["provider", "payee"],
  },
  {
    id: "party_2",
    reference: "counterparty",
    displayName: null,
    roles: ["client", "payer"],
  },
];

const acceptance = (required = null) => ({
  required,
  approverPartyId: null,
  criteria: [],
});

const noDisputeTerms = () => ({
  enabled: null,
  resolver: null,
  initiationConditions: [],
  evidenceWindow: null,
  resolutionOptions: [],
});

const baseAgreement = () => ({
  parties: [],
  scope: { summary: null, deliverables: [], exclusions: [] },
  pricing: { total: null, settlementAsset: null },
  milestones: [],
  payments: [],
  revisionTerms: [],
  evidenceTerms: [],
  disputeTerms: noDisputeTerms(),
});

const dollar4500 = () => ({
  amount: "4500",
  currency: { code: null, symbol: "$" },
});

const usd4500 = () => ({
  amount: "4500",
  currency: { code: "USD", symbol: "$" },
});

const milestone = (id, description) => ({
  id,
  description,
  deliverables: [description],
  deadline: null,
  acceptance: acceptance(),
});

const trigger = (type, milestoneId = null, timing = null) => ({
  type,
  milestoneId,
  timing,
});

const payment = ({
  id,
  purpose = "release",
  amountType,
  amount = null,
  sharePercent = null,
  payerPartyId = "party_2",
  recipientPartyId = "party_1",
  paymentTrigger,
}) => ({
  id,
  purpose,
  amountType,
  amount,
  sharePercent,
  payerPartyId,
  recipientPartyId,
  trigger: paymentTrigger,
});

const cases = [];

cases.push({
  id: "01_incomplete_but_representable",
  expectedValid: true,
  raw: "Build me a website.",
  agreement: {
    ...baseAgreement(),
    scope: {
      summary: "Build a website",
      deliverables: ["Website"],
      exclusions: [],
    },
  },
});

cases.push({
  id: "02_ambiguous_currency_symbol",
  expectedValid: true,
  raw: "I'll build an ecommerce website for $4,500.",
  agreement: {
    ...baseAgreement(),
    parties: parties(),
    scope: {
      summary: "Build an ecommerce website",
      deliverables: ["Ecommerce website"],
      exclusions: [],
    },
    pricing: { total: dollar4500(), settlementAsset: null },
    milestones: [milestone("milestone_1", "Ecommerce website")],
    payments: [
      payment({
        id: "payment_1",
        amountType: "percentage",
        sharePercent: "100",
        paymentTrigger: trigger("milestone_delivered", "milestone_1"),
      }),
    ],
  },
});

cases.push({
  id: "03_funding_deposit_and_remainder",
  expectedValid: true,
  raw: "The client funds $4,500 upfront. Release 20% at acceptance, 30% after design approval, and the remainder after deployment.",
  agreement: {
    ...baseAgreement(),
    parties: parties(),
    scope: {
      summary: "Design and deploy a website",
      deliverables: ["Website design", "Deployed website"],
      exclusions: [],
    },
    pricing: { total: usd4500(), settlementAsset: null },
    milestones: [
      {
        ...milestone("milestone_1", "Website design"),
        acceptance: {
          required: true,
          approverPartyId: null,
          criteria: [],
        },
      },
      milestone("milestone_2", "Deployed website"),
    ],
    payments: [
      payment({
        id: "payment_1",
        purpose: "funding",
        amountType: "fixed",
        amount: usd4500(),
        recipientPartyId: null,
        paymentTrigger: trigger("upfront"),
      }),
      payment({
        id: "payment_2",
        amountType: "percentage",
        sharePercent: "20",
        paymentTrigger: trigger("agreement_accepted"),
      }),
      payment({
        id: "payment_3",
        amountType: "percentage",
        sharePercent: "30",
        paymentTrigger: trigger("milestone_accepted", "milestone_1"),
      }),
      payment({
        id: "payment_4",
        amountType: "remainder",
        paymentTrigger: trigger("milestone_delivered", "milestone_2"),
      }),
    ],
  },
});

cases.push({
  id: "04_absolute_deadline_with_timezone",
  expectedValid: true,
  raw: "Deliver by September 15, 2026 at 17:00 Europe/Istanbul time.",
  agreement: {
    ...baseAgreement(),
    parties: parties(),
    scope: {
      summary: "Deliver the project",
      deliverables: ["Completed project"],
      exclusions: [],
    },
    milestones: [
      {
        ...milestone("milestone_1", "Completed project"),
        deadline: {
          type: "absolute_date",
          date: "2026-09-15",
          time: "17:00",
          timezone: "Europe/Istanbul",
          duration: null,
          relativeTo: null,
        },
      },
    ],
  },
});

cases.push({
  id: "05_relative_deadline",
  expectedValid: true,
  raw: "Deliver within two weeks after the agreement is accepted.",
  agreement: {
    ...baseAgreement(),
    parties: parties(),
    scope: {
      summary: "Deliver the project",
      deliverables: ["Completed project"],
      exclusions: [],
    },
    milestones: [
      {
        ...milestone("milestone_1", "Completed project"),
        deadline: {
          type: "relative",
          date: null,
          time: null,
          timezone: null,
          duration: "P14D",
          relativeTo: "agreement_accepted",
        },
      },
    ],
  },
});

cases.push({
  id: "06_usdc_on_base",
  expectedValid: true,
  raw: "The price is 4,500 USD, settled in USDC on Base.",
  agreement: {
    ...baseAgreement(),
    parties: parties(),
    scope: {
      summary: "Provide the agreed service",
      deliverables: ["Agreed service"],
      exclusions: [],
    },
    pricing: {
      total: usd4500(),
      settlementAsset: {
        type: "token",
        symbol: "USDC",
        chainId: 8453,
        contractAddress: null,
      },
    },
  },
});

cases.push({
  id: "07_revision_and_evidence_terms",
  expectedValid: true,
  raw: "Two design revisions are included. The provider must submit the deployment URL as evidence.",
  agreement: {
    ...baseAgreement(),
    parties: parties(),
    scope: {
      summary: "Design and deploy a website",
      deliverables: ["Website design", "Deployed website"],
      exclusions: [],
    },
    milestones: [
      milestone("milestone_1", "Website design"),
      milestone("milestone_2", "Deployed website"),
    ],
    revisionTerms: [
      {
        appliesTo: "milestone",
        milestoneId: "milestone_1",
        includedRounds: 2,
        additionalRevisionPricing: null,
        conditions: [],
      },
    ],
    evidenceTerms: [
      {
        id: "evidence_1",
        milestoneId: "milestone_2",
        requiredFromPartyId: "party_1",
        description: "Deployment URL",
      },
    ],
  },
});

cases.push({
  id: "08_multiple_recipients",
  expectedValid: true,
  raw: "After delivery, pay 70% to the agency and 30% to the designer.",
  agreement: {
    ...baseAgreement(),
    parties: [
      {
        id: "party_1",
        reference: "named",
        displayName: "Agency",
        roles: ["provider", "payee"],
      },
      {
        id: "party_2",
        reference: "counterparty",
        displayName: null,
        roles: ["client", "payer"],
      },
      {
        id: "party_3",
        reference: "named",
        displayName: "Designer",
        roles: ["provider", "payee"],
      },
    ],
    scope: {
      summary: "Deliver the project",
      deliverables: ["Completed project"],
      exclusions: [],
    },
    milestones: [milestone("milestone_1", "Completed project")],
    payments: [
      payment({
        id: "payment_1",
        amountType: "percentage",
        sharePercent: "70",
        recipientPartyId: "party_1",
        paymentTrigger: trigger("milestone_delivered", "milestone_1"),
      }),
      payment({
        id: "payment_2",
        amountType: "percentage",
        sharePercent: "30",
        recipientPartyId: "party_3",
        paymentTrigger: trigger("milestone_delivered", "milestone_1"),
      }),
    ],
  },
});

cases.push({
  id: "09_dispute_refund",
  expectedValid: true,
  raw: "A Kleros arbitrator may order a full refund. Evidence must be submitted within three days.",
  agreement: {
    ...baseAgreement(),
    parties: parties(),
    scope: {
      summary: "Provide the agreed service",
      deliverables: ["Agreed service"],
      exclusions: [],
    },
    payments: [
      payment({
        id: "payment_1",
        purpose: "refund",
        amountType: "percentage",
        sharePercent: "100",
        payerPartyId: null,
        recipientPartyId: "party_2",
        paymentTrigger: trigger("dispute_resolved"),
      }),
    ],
    disputeTerms: {
      enabled: true,
      resolver: "Kleros arbitrator",
      initiationConditions: [],
      evidenceWindow: "P3D",
      resolutionOptions: ["Full refund"],
    },
  },
});

cases.push({
  id: "10_semantic_contradiction_structurally_valid",
  expectedValid: true,
  raw: "The total is $4,500. Pay $2,500 after design and $2,500 after deployment.",
  agreement: {
    ...baseAgreement(),
    parties: parties(),
    scope: {
      summary: "Design and deploy a website",
      deliverables: ["Website design", "Deployed website"],
      exclusions: [],
    },
    pricing: { total: dollar4500(), settlementAsset: null },
    milestones: [
      milestone("milestone_1", "Website design"),
      milestone("milestone_2", "Deployed website"),
    ],
    payments: [
      payment({
        id: "payment_1",
        amountType: "fixed",
        amount: {
          amount: "2500",
          currency: { code: null, symbol: "$" },
        },
        paymentTrigger: trigger("milestone_delivered", "milestone_1"),
      }),
      payment({
        id: "payment_2",
        amountType: "fixed",
        amount: {
          amount: "2500",
          currency: { code: null, symbol: "$" },
        },
        paymentTrigger: trigger("milestone_delivered", "milestone_2"),
      }),
    ],
  },
});

const invalidExtraProperty = baseAgreement();
invalidExtraProperty.riskFlags = [];
cases.push({
  id: "11_reject_risk_flags",
  expectedValid: false,
  agreement: invalidExtraProperty,
});

const invalidNumericMoney = baseAgreement();
invalidNumericMoney.pricing.total = {
  amount: 4500,
  currency: { code: "USD", symbol: "$" },
};
cases.push({
  id: "12_reject_numeric_money",
  expectedValid: false,
  agreement: invalidNumericMoney,
});

const invalidPartyId = baseAgreement();
invalidPartyId.parties = [
  {
    id: "alice",
    reference: "named",
    displayName: "Alice",
    roles: ["provider"],
  },
];
cases.push({
  id: "13_reject_noncanonical_party_id",
  expectedValid: false,
  agreement: invalidPartyId,
});

const invalidMissingTriggerTiming = baseAgreement();
invalidMissingTriggerTiming.payments = [
  {
    id: "payment_1",
    purpose: "release",
    amountType: "percentage",
    amount: null,
    sharePercent: "100",
    payerPartyId: null,
    recipientPartyId: null,
    trigger: {
      type: "milestone_delivered",
      milestoneId: "milestone_1",
    },
  },
];
cases.push({
  id: "14_reject_incomplete_trigger",
  expectedValid: false,
  agreement: invalidMissingTriggerTiming,
});

let failures = 0;

for (const testCase of cases) {
  const actualValid = validate(testCase.agreement);
  const passed = actualValid === testCase.expectedValid;

  if (!passed) failures += 1;

  console.log(
    `${passed ? "PASS" : "FAIL"} ${testCase.id} ` +
      `(expected ${testCase.expectedValid ? "valid" : "invalid"}, ` +
      `received ${actualValid ? "valid" : "invalid"})`,
  );

  if (!passed && validate.errors) {
    console.error(JSON.stringify(validate.errors, null, 2));
  }
}

console.log(`\n${cases.length - failures}/${cases.length} schema cases passed.`);

if (failures > 0) {
  process.exitCode = 1;
}
