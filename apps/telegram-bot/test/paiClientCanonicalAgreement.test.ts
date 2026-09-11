import assert from "node:assert/strict";
import test from "node:test";

import {
  createPaiClient,
  PaiApiError,
} from "../src/services/paiClient.js";

const TEST_SERVICE_TOKEN =
  "telegram-test-service-token-0000000000000000";

const TEST_PARTY_TOKEN =
  "dummy-client-party-token-000000000000000000";

const acceptanceRequest = {
  agreementId:
    "agreement-1",

  agreementVersion:
    1,

  agreementHash:
    "canonical-hash-v1",

  partyId:
    "party-client",
};

const acceptanceResult = {
  acceptance: {
    partyId:
      "party-client",

    role:
      "CLIENT" as const,

    agreementVersion:
      1,

    agreementHash:
      "canonical-hash-v1",

    acceptedAt:
      "2026-09-09T08:00:00.000Z",

    current:
      true,
  },

  lifecycle: {
    reference: {
      agreementId:
        "agreement-1",

      agreementVersion:
        1,

      agreementHash:
        "canonical-hash-v1",
    },

    status:
      "AWAITING_ACCEPTANCE" as const,

    acceptanceComplete:
      false,

    walletBindingComplete:
      false,

    parties: [
      {
        partyId:
          "party-client",

        role:
          "CLIENT" as const,

        acceptedCurrentVersion:
          true,

        walletBound:
          false,

        walletAddress:
          null,
      },
      {
        partyId:
          "party-contractor",

        role:
          "CONTRACTOR" as const,

        acceptedCurrentVersion:
          false,

        walletBound:
          false,

        walletAddress:
          null,
      },
    ],
  },
};

const lifecycleResult = {
  reference: {
    agreementId:
      "agreement-1",

    agreementVersion:
      1,

    agreementHash:
      "canonical-hash-v1",
  },

  status:
    "ACCEPTED" as const,

  acceptanceComplete:
    true,

  walletBindingComplete:
    false,

  parties: [
    {
      partyId:
        "party-client",

      role:
        "CLIENT" as const,

      acceptedCurrentVersion:
        true,

      walletBound:
        false,

      walletAddress:
        null,
    },
    {
      partyId:
        "party-contractor",

      role:
        "CONTRACTOR" as const,

      acceptedCurrentVersion:
        true,

      walletBound:
        false,

      walletAddress:
        null,
    },
  ],
};

test(
  "PAI client submits the exact canonical acceptance tuple with party-token auth only",
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
                acceptanceResult,
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
      await client.acceptAgreementVersion(
        acceptanceRequest,
        TEST_PARTY_TOKEN,
      );

    assert.equal(
      String(
        capturedInput,
      ),
      "http://127.0.0.1:3001/api/v1/agreements/agreement-1/acceptances",
    );

    assert.equal(
      capturedInit?.method,
      "POST",
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

    assert.equal(
      headers.get(
        "content-type",
      ),
      "application/json",
    );

    assert.deepEqual(
      JSON.parse(
        String(
          capturedInit?.body,
        ),
      ),
      acceptanceRequest,
    );

    assert.deepEqual(
      result,
      acceptanceResult,
    );
  },
);

test(
  "PAI client reads authoritative canonical lifecycle without service or party auth",
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
                lifecycleResult,
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
      await client.getAgreementLifecycle({
        agreementId:
          "agreement-1",
      });

    assert.equal(
      String(
        capturedInput,
      ),
      "http://127.0.0.1:3001/api/v1/agreements/agreement-1/lifecycle",
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
        "authorization",
      ),
      null,
    );

    assert.equal(
      headers.get(
        "x-pai-party-token",
      ),
      null,
    );

    assert.deepEqual(
      result,
      lifecycleResult,
    );
  },
);

test(
  "PAI client surfaces canonical acceptance non-success responses",
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
              "canonical tuple conflict",
              {
                status:
                  409,
              },
            ),
      });

    await assert.rejects(
      () =>
        client.acceptAgreementVersion(
          acceptanceRequest,
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
          409,
        );

        assert.equal(
          error.responseBody,
          "canonical tuple conflict",
        );

        return true;
      },
    );
  },
);

test(
  "PAI client surfaces canonical lifecycle non-success responses",
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
              "agreement missing",
              {
                status:
                  404,
              },
            ),
      });

    await assert.rejects(
      () =>
        client.getAgreementLifecycle({
          agreementId:
            "agreement-missing",
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
          404,
        );

        assert.equal(
          error.responseBody,
          "agreement missing",
        );

        return true;
      },
    );
  },
);
