import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import {
  createDeterministicAgreementStructurer,
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
