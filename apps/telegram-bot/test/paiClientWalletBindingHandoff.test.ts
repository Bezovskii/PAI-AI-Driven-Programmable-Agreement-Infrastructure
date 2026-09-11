import assert from "node:assert/strict";
import test from "node:test";

import {
  createPaiClient,
  PaiApiError,
} from "../src/services/paiClient.js";

const TEST_SERVICE_TOKEN =
  "telegram-test-service-token-0000000000000000";

const TEST_PARTY_TOKEN =
  "dummy-wallet-handoff-party-token-0000000000000000";

test(
  "PAI client creates wallet-binding handoff with party-token auth and no body",
  async () => {
    let capturedUrl =
      "";

    let capturedInit:
      RequestInit | undefined;

    const client =
      createPaiClient({
        baseUrl:
          "https://pai.example",

        authoringServiceToken:
          TEST_SERVICE_TOKEN,

        fetchImpl:
          async (
            input,
            init,
          ) => {
            capturedUrl =
              String(
                input,
              );

            capturedInit =
              init;

            return new Response(
              JSON.stringify({
                handoffId:
                  "opaque-wallet-handoff-id",

                expiresAt:
                  "2026-09-11T00:15:00.000Z",
              }),
              {
                status:
                  201,

                headers: {
                  "content-type":
                    "application/json",
                },
              },
            );
          },
      });

    const result =
      await client
        .createWalletBindingHandoff({
          agreementId:
            "agreement/1",

          partyId:
            "party/client",

          partyAccessToken:
            TEST_PARTY_TOKEN,
        });

    assert.equal(
      capturedUrl,
      "https://pai.example/api/v1/agreements/agreement%2F1/parties/party%2Fclient/wallet-binding-handoffs",
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
      headers.has(
        "authorization",
      ),
      false,
    );

    assert.equal(
      headers.has(
        "content-type",
      ),
      false,
    );

    assert.equal(
      capturedInit?.body,
      undefined,
    );

    const serializedRequest =
      JSON.stringify({
        url:
          capturedUrl,

        method:
          capturedInit?.method,

        headers:
          Object.fromEntries(
            headers.entries(),
          ),

        body:
          capturedInit?.body ??
          null,
      });

    assert.equal(
      serializedRequest.includes(
        TEST_SERVICE_TOKEN,
      ),
      false,
    );

    assert.deepEqual(
      result,
      {
        handoffId:
          "opaque-wallet-handoff-id",

        expiresAt:
          "2026-09-11T00:15:00.000Z",
      },
    );
  },
);

test(
  "PAI client safely surfaces rejected wallet-binding handoff creation",
  async () => {
    const client =
      createPaiClient({
        baseUrl:
          "https://pai.example",

        authoringServiceToken:
          TEST_SERVICE_TOKEN,

        fetchImpl:
          async (
            _input,
            init,
          ) => {
            const headers =
              new Headers(
                init?.headers,
              );

            assert.equal(
              init?.method,
              "POST",
            );

            assert.equal(
              init?.body,
              undefined,
            );

            assert.equal(
              headers.get(
                "x-pai-party-token",
              ),
              TEST_PARTY_TOKEN,
            );

            assert.equal(
              headers.has(
                "authorization",
              ),
              false,
            );

            return new Response(
              "both current agreement acceptances are required",
              {
                status:
                  409,
              },
            );
          },
      });

    await assert.rejects(
      () =>
        client
          .createWalletBindingHandoff({
            agreementId:
              "agreement-1",

            partyId:
              "party-client",

            partyAccessToken:
              TEST_PARTY_TOKEN,
          }),

      (
        error:
          unknown,
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
          "both current agreement acceptances are required",
        );

        return true;
      },
    );
  },
);
