import assert from "node:assert/strict";
import test from "node:test";

import {
  createPaiClient,
  PaiApiError,
} from "../src/services/paiClient.js";

const TEST_SERVICE_TOKEN =
  "telegram-test-service-token-0000000000000000";

const TEST_PARTY_TOKEN =
  "dummy-review-party-token-000000000000000000";

const canonicalReview = {
  reference: {
    agreementId:
      "agreement-review-1",

    agreementVersion:
      3,

    agreementHash:
      "canonical-review-hash-v3",
  },

  terms: {
    title:
      "Website delivery",

    description:
      "Contractor delivers the agreed website.",

    totalValue:
      "1000",

    settlementAsset:
      "USDC",

    deadline:
      "2026-09-20",

    approvalWindow:
      "3 days",

    milestones: [
      {
        amount:
          "1000",

        deliverable:
          "Production website",

        acceptanceCriteria:
          "Matches agreed specification",

        deadline:
          "2026-09-20",
      },
    ],
  },

  party: {
    partyId:
      "party-client",

    role:
      "CLIENT" as const,

    displayName:
      "Client",

    acceptedCurrentVersion:
      false,
  },

  status:
    "AWAITING_ACCEPTANCE" as const,

  acceptanceComplete:
    false,
};

test(
  "PAI client fetches exact canonical review using party-token auth only",
  async () => {
    let capturedInput:
      string | URL | Request | undefined;

    let capturedInit:
      RequestInit | undefined;

    const client =
      createPaiClient({
        baseUrl:
          "http://127.0.0.1:3001",

        authoringServiceToken:
          TEST_SERVICE_TOKEN,

        fetchImpl:
          async (
            input,
            init,
          ) => {
            capturedInput =
              input;

            capturedInit =
              init;

            return new Response(
              JSON.stringify(
                canonicalReview,
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
          },
      });

    const result =
      await client.getCanonicalAgreementReview(
        {
          agreementId:
            "agreement-review-1",
        },
        TEST_PARTY_TOKEN,
      );

    assert.equal(
      String(
        capturedInput,
      ),
      "http://127.0.0.1:3001/api/v1/agreements/agreement-review-1/review",
    );

    assert.equal(
      capturedInit?.method,
      "GET",
    );

    const headers =
      new Headers(
        capturedInit?.headers,
      );

    assert.equal(
      headers.get(
        "x-pai-party-token",
      ),
      TEST_PARTY_TOKEN,
    );

    assert.equal(
      headers.get(
        "authorization",
      ),
      null,
    );

    assert.deepEqual(
      result,
      canonicalReview,
    );
  },
);

test(
  "PAI client surfaces canonical review authorization failures",
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
              "party access denied",
              {
                status:
                  403,
              },
            ),
      });

    await assert.rejects(
      () =>
        client.getCanonicalAgreementReview(
          {
            agreementId:
              "agreement-review-1",
          },
          TEST_PARTY_TOKEN,
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
          403,
        );

        assert.equal(
          error.responseBody,
          "party access denied",
        );

        return true;
      },
    );
  },
);
