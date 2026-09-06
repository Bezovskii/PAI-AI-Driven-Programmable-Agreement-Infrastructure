import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgreementStructuringResult,
} from "@pai/intelligence-contract";

import {
  createPaiClient,
  PaiApiError,
} from "../src/services/paiClient.js";

const responseFixture = {
  status:
    "needs_clarification",

  agreement: {
    title:
      null,

    description:
      "Alex will build a frontend for 1000 USDC.",

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
    "Please confirm the milestone details.",
  ],

  risks: [
    {
      code:
        "missing_acceptance",

      severity:
        "medium",

      message:
        "Acceptance criteria are not specified.",
    },
  ],
} satisfies AgreementStructuringResult;

test(
  "PAI client posts StructureAgreementInput to the Intelligence endpoint",
  async () => {
    const fetchImpl =
      async (
        input: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> => {
        assert.equal(
          String(
            input,
          ),
          "http://127.0.0.1:3001/api/v1/intelligence/agreements/structure",
        );

        assert.equal(
          init?.method,
          "POST",
        );

        assert.equal(
          new Headers(
            init?.headers,
          ).get(
            "content-type",
          ),
          "application/json",
        );

        assert.equal(
          init?.body,
          JSON.stringify({
            text:
              "Alex will build a frontend for 1000 USDC.",
          }),
        );

        return new Response(
          JSON.stringify(
            responseFixture,
          ),
          {
            status:
              200,

            headers: {
              "content-type":
                "application/json",
            },
          },
        );
      };

    const client =
      createPaiClient({
        baseUrl:
          "http://127.0.0.1:3001/",

        fetchImpl,
      });

    const result =
      await client
        .structureAgreement({
          text:
            "Alex will build a frontend for 1000 USDC.",
        });

    assert.deepEqual(
      result,
      responseFixture,
    );
  },
);

test(
  "PAI client surfaces non-success responses",
  async () => {
    const client =
      createPaiClient({
        baseUrl:
          "http://127.0.0.1:3001",

        fetchImpl:
          async () =>
            new Response(
              "upstream failure",
              {
                status:
                  502,
              },
            ),
      });

    await assert.rejects(
      () =>
        client.structureAgreement({
          text:
            "Test agreement",
        }),

      (
        error: unknown,
      ) => {
        assert.ok(
          error instanceof
            PaiApiError,
        );

        assert.equal(
          error.status,
          502,
        );

        assert.equal(
          error.responseBody,
          "upstream failure",
        );

        return true;
      },
    );
  },
);