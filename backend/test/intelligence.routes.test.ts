import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import {
  createDeterministicAgreementStructurer,
  createModelBackedAgreementStructurer,
} from "../src/intelligence/service.js";

import type {
  StructureAgreement,
} from "../src/intelligence/types.js";

test(
  "agreement structuring route forwards natural-language input to intelligence service",
  async (t) => {
    let capturedText:
      string | null =
        null;

    const structureAgreement:
      StructureAgreement =
        async (
          input,
        ) => {
          capturedText =
            input.text;

          return {
            status:
              "ready_for_review",

            agreement: {
              title:
                "Frontend build",

              description:
                input.text,

              totalValue:
                "1000",

              settlementAsset:
                "USDC",

              deadline:
                null,

              approvalWindow:
                null,

              milestones:
                [],
            },

            questions:
              [],

            risks:
              [],
          };
        };

    const app =
      buildApp({
        readinessProbe:
          async () =>
            true,

        intelligence: {
          structureAgreement,
        },
      });

    t.after(
      async () => {
        await app.close();
      },
    );

    const text =
      "Raif will build my frontend for 1000 USDC.";

    const response =
      await app.inject({
        method:
          "POST",

        url:
          "/api/v1/intelligence/agreements/structure",

        payload: {
          text,
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      capturedText,
      text,
    );

    assert.deepEqual(
      response.json(),
      {
        status:
          "ready_for_review",

        agreement: {
          title:
            "Frontend build",

          description:
            text,

          totalValue:
            "1000",

          settlementAsset:
            "USDC",

          deadline:
            null,

          approvalWindow:
            null,

          milestones:
            [],
        },

        questions:
          [],

        risks:
          [],
      },
    );
  },
);

test(
  "deterministic structurer preserves source text without inventing agreement terms",
  async () => {
    const structureAgreement =
      createDeterministicAgreementStructurer();

    const text =
      "Raif will build my frontend for 1000 USDC in two milestones.";

    const result =
      await structureAgreement({
        text,
      });

    assert.deepEqual(
      result,
      {
        status:
          "needs_clarification",

        agreement: {
          title:
            null,

          description:
            text,

          totalValue:
            null,

          settlementAsset:
            null,

          deadline:
            null,

          approvalWindow:
            null,

          milestones:
            [],
        },

        questions: [
          "Please confirm the payment amount, settlement asset, milestones, deadlines, and acceptance criteria.",
        ],

        risks:
          [],
      },
    );
  },
);

test(
  "agreement structuring route rejects whitespace-only text",
  async (t) => {
    const app =
      buildApp({
        readinessProbe:
          async () =>
            true,

        intelligence: {
          structureAgreement:
            createDeterministicAgreementStructurer(),
        },
      });

    t.after(
      async () => {
        await app.close();
      },
    );

    const response =
      await app.inject({
        method:
          "POST",

        url:
          "/api/v1/intelligence/agreements/structure",

        payload: {
          text:
            "   ",
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );
  },
);

test(
  "model-backed structurer preserves validated model facts and provenance without fabricating risks",
  async () => {
    const text =
      "Amir hires Behzad to build and deliver a responsive landing page for $1,000. Delivery is due September 20, 2026. Payment should be released after Amir approves the completed work.";

    const structureAgreement =
      createModelBackedAgreementStructurer({
        structure:
          async (
            receivedText,
          ) => {
            assert.equal(
              receivedText,
              text,
            );

            return {
              modelOutput: {
                schemaVersion:
                  "pai.model-output.v0.2",

                agreement: {
                  schemaVersion:
                    "pai.agreement.v0.2",

                  parties: [
                    {
                      id:
                        "party_1",
                      reference:
                        "named",
                      displayName:
                        "Amir",
                      roles: [
                        "payer",
                        "client",
                      ],
                    },
                    {
                      id:
                        "party_2",
                      reference:
                        "named",
                      displayName:
                        "Behzad",
                      roles: [
                        "provider",
                        "payee",
                      ],
                    },
                  ],

                  scope: {
                    summary:
                      "Build and deliver a responsive landing page",

                    deliverables: [
                      "build and deliver a responsive landing page",
                    ],

                    exclusions:
                      [],
                  },

                  pricing: {
                    total: {
                      amount:
                        "1000",

                      currency: {
                        code:
                          "USD",
                        symbol:
                          "$",
                      },
                    },

                    settlementAsset: {
                      type:
                        "fiat",
                      symbol:
                        "$",
                      networkId:
                        null,
                      assetId:
                        null,
                    },
                  },

                  milestones: [
                    {
                      id:
                        "milestone_1",

                      description:
                        "build and deliver a responsive landing page",

                      deliverables: [
                        "build and deliver a responsive landing page",
                      ],

                      deadline: {
                        type:
                          "absolute_date",
                        date:
                          "2026-09-20",
                        time:
                          null,
                        timezone:
                          null,
                        duration:
                          null,
                        relativeTo:
                          null,
                      },

                      acceptance: {
                        required:
                          true,

                        approverPartyId:
                          "party_1",

                        criteria: [
                          "Amir approves the completed work",
                        ],
                      },
                    },
                  ],

                  payments: [
                    {
                      id:
                        "payment_1",

                      purpose:
                        "release",

                      amountType:
                        "fixed",

                      amount: {
                        amount:
                          "1000",

                        currency: {
                          code:
                            "USD",
                          symbol:
                            "$",
                        },
                      },

                      sharePercent:
                        null,

                      payerPartyId:
                        "party_1",

                      recipientPartyId:
                        "party_2",

                      trigger: {
                        type:
                          "milestone_accepted",

                        milestoneId:
                          "milestone_1",

                        timing:
                          null,
                      },
                    },
                  ],

                  revisionTerms:
                    [],

                  evidenceTerms:
                    [],

                  disputeTerms: {
                    enabled:
                      null,
                    resolver:
                      null,
                    initiationConditions:
                      [],
                    evidenceWindow:
                      null,
                    resolutionOptions:
                      [],
                  },
                },

                issues:
                  [],

                provenance: [
                  {
                    path:
                      "/agreement/parties/0/displayName",
                    quote:
                      "Amir",
                  },
                  {
                    path:
                      "/agreement/parties/1/displayName",
                    quote:
                      "Behzad",
                  },
                  {
                    path:
                      "/agreement/scope/deliverables/0",
                    quote:
                      "build and deliver a responsive landing page",
                  },
                  {
                    path:
                      "/agreement/pricing/total/amount",
                    quote:
                      "$1,000",
                  },
                  {
                    path:
                      "/agreement/milestones/0/deadline/date",
                    quote:
                      "September 20, 2026",
                  },
                  {
                    path:
                      "/agreement/milestones/0/acceptance/criteria/0",
                    quote:
                      "Amir approves the completed work",
                  },
                ],
              },

              rawModelOutput:
                "{}",

              meta: {
                runtimeVersion:
                  "pai.intelligence-runtime.v0.1",

                strictJson:
                  true,

                schemaValid:
                  true,

                promptTokens:
                  5000,

                outputTokens:
                  500,

                inferenceSeconds:
                  38,

                adapterSha256:
                  "82ec8dd4328eb87f2c23dc2caba962ab51c400a93a7165c7a72611aaca18df5d",
              },
            };
          },
      });

    const result =
      await structureAgreement({
        text,
      });

    assert.equal(
      result.status,
      "ready_for_review",
    );

    assert.deepEqual(
      result.agreement,
      {
        title:
          null,

        description:
          text,

        totalValue:
          "1000",

        settlementAsset:
          "$",

        deadline:
          "2026-09-20",

        approvalWindow:
          null,

        milestones: [
          {
            amount:
              "1000",

            deliverable:
              "build and deliver a responsive landing page",

            acceptanceCriteria:
              "Amir approves the completed work",

            deadline:
              "2026-09-20",
          },
        ],
      },
    );

    assert.deepEqual(
      result.questions,
      [],
    );

    assert.deepEqual(
      result.risks,
      [],
    );

    assert.deepEqual(
      result.issues,
      [],
    );

    assert.deepEqual(
      result.provenance,
      [
        {
          path:
            "/agreement/parties/0/displayName",
          quote:
            "Amir",
        },
        {
          path:
            "/agreement/parties/1/displayName",
          quote:
            "Behzad",
        },
        {
          path:
            "/agreement/scope/deliverables/0",
          quote:
            "build and deliver a responsive landing page",
        },
        {
          path:
            "/agreement/pricing/total/amount",
          quote:
            "$1,000",
        },
        {
          path:
            "/agreement/milestones/0/deadline/date",
          quote:
            "September 20, 2026",
        },
        {
          path:
            "/agreement/milestones/0/acceptance/criteria/0",
          quote:
            "Amir approves the completed work",
        },
      ],
    );
  },
);