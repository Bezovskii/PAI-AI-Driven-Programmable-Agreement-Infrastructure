import assert from "node:assert/strict";
import test from "node:test";

import type {
  PersistReviewedAgreementRequest,
  PersistReviewedAgreementResult,
} from "@pai/agreement-contract";

import type {
  AgreementStructuringResult,
} from "@pai/intelligence-contract";

import {
  createPaiClient,
  PaiApiError,
} from "../src/services/paiClient.js";

const TEST_SERVICE_TOKEN =
  "telegram-test-service-token-0000000000000000";

const intelligenceResponseFixture = {
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

const reviewedAgreementRequest = {
  terms: {
    title:
      "Frontend delivery",

    description:
      "Alex will build a frontend for 1000 USDC.",

    totalValue:
      "1000",

    settlementAsset:
      "USDC",

    deadline:
      "2026-09-30",

    approvalWindow:
      "3 days",

    milestones: [
      {
        amount:
          "1000",

        deliverable:
          "Frontend",

        acceptanceCriteria:
          "Client approval",

        deadline:
          "2026-09-30",
      },
    ],
  },

  client: {
    displayName:
      "Client",
  },

  contractor: {
    displayName:
      "Alex",
  },
} satisfies PersistReviewedAgreementRequest;

const reviewedAgreementResponse = {
  lifecycle: {
    reference: {
      agreementId:
        "agreement-1",

      agreementVersion:
        1,

      agreementHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },

    status:
      "AWAITING_ACCEPTANCE",

    acceptanceComplete:
      false,

    walletBindingComplete:
      false,

    parties: [
      {
        partyId:
          "party-client",

        role:
          "CLIENT",

        displayName:
          "Client",

        acceptedCurrentVersion:
          false,

        walletBound:
          false,

        walletAddress:
          null,
      },

      {
        partyId:
          "party-contractor",

        role:
          "CONTRACTOR",

        displayName:
          "Alex",

        acceptedCurrentVersion:
          false,

        walletBound:
          false,

        walletAddress:
          null,
      },
    ],
  },

  partyAccess: [
    {
      partyId:
        "party-client",

      role:
        "CLIENT",

      accessToken:
        "client-party-test-token",
    },

    {
      partyId:
        "party-contractor",

      role:
        "CONTRACTOR",

      accessToken:
        "contractor-party-test-token",
    },
  ],
} satisfies PersistReviewedAgreementResult;

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

        const headers =
          new Headers(
            init?.headers,
          );

        assert.equal(
          headers.get(
            "content-type",
          ),
          "application/json",
        );

        assert.equal(
          headers.get(
            "authorization",
          ),
          null,
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
            intelligenceResponseFixture,
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

        authoringServiceToken:
          TEST_SERVICE_TOKEN,

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
      intelligenceResponseFixture,
    );
  },
);

test(
  "PAI client persists reviewed agreement using Telegram service authorization",
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
          "http://127.0.0.1:3001/api/v1/agreements/reviewed",
        );

        assert.equal(
          init?.method,
          "POST",
        );

        const headers =
          new Headers(
            init?.headers,
          );

        assert.equal(
          headers.get(
            "content-type",
          ),
          "application/json",
        );

        assert.equal(
          headers.get(
            "authorization",
          ),
          `Bearer ${TEST_SERVICE_TOKEN}`,
        );

        assert.equal(
          init?.body,
          JSON.stringify(
            reviewedAgreementRequest,
          ),
        );

        return new Response(
          JSON.stringify(
            reviewedAgreementResponse,
          ),
          {
            status:
              201,

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
          "http://127.0.0.1:3001",

        authoringServiceToken:
          TEST_SERVICE_TOKEN,

        fetchImpl,
      });

    const result =
      await client
        .persistReviewedAgreement(
          reviewedAgreementRequest,
        );

    assert.deepEqual(
      result,
      reviewedAgreementResponse,
    );

    assert.equal(
      result.lifecycle.reference
        .agreementHash,
      reviewedAgreementResponse
        .lifecycle
        .reference
        .agreementHash,
    );
  },
);

test(
  "PAI client surfaces Intelligence non-success responses",
  async () => {
    const client =
      createPaiClient({
        baseUrl:
          "http://127.0.0.1:3001",

        authoringServiceToken:
          TEST_SERVICE_TOKEN,

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

test(
  "PAI client surfaces reviewed-agreement non-success responses",
  async () => {
    const client =
      createPaiClient({
        baseUrl:
          "http://127.0.0.1:3001",

        authoringServiceToken:
          TEST_SERVICE_TOKEN,

        fetchImpl:
          async () =>
            new Response(
              "authoring unavailable",
              {
                status:
                  503,
              },
            ),
      });

    await assert.rejects(
      () =>
        client.persistReviewedAgreement(
          reviewedAgreementRequest,
        ),

      (
        error: unknown,
      ) => {
        assert.ok(
          error instanceof
            PaiApiError,
        );

        assert.equal(
          error.status,
          503,
        );

        assert.equal(
          error.responseBody,
          "authoring unavailable",
        );

        return true;
      },
    );
  },
);
