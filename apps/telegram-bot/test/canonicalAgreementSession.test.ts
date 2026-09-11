import assert from "node:assert/strict";
import test from "node:test";

import type {
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

import {
  createAgreementFlowSessionStore,
  createPartyCredentialVault,
} from "../src/conversations/canonicalAgreementSession.js";

const terms = {
  title:
    "Frontend delivery",

  description:
    "Alex will build a frontend.",

  totalValue:
    "1000",

  settlementAsset:
    "USDC",

  deadline:
    "2026-09-30",

  approvalWindow:
    "3 days",

  milestones:
    [],
} satisfies CanonicalAgreementTerms;

test(
  "agreement flow session retains pending reviewed terms",
  () => {
    const sessions =
      createAgreementFlowSessionStore();

    sessions.setPendingReview(
      42,
      terms,
    );

    assert.deepEqual(
      sessions.getPendingReview(
        42,
      ),
      terms,
    );

    sessions.clearPendingReview(
      42,
    );

    assert.equal(
      sessions.getPendingReview(
        42,
      ),
      undefined,
    );
  },
);

test(
  "party credential vault exposes only an opaque invitation reference",
  () => {
    const vault =
      createPartyCredentialVault({
        generateHandle:
          () =>
            "invite-client-opaque",
      });

    const safeReference =
      vault.store(
        "agreement-1",
        {
          partyId:
            "party-client",

          role:
            "CLIENT",

          accessToken:
            "dummy-client-party-token",
        },
      );

    assert.deepEqual(
      safeReference,
      {
        partyId:
          "party-client",

        role:
          "CLIENT",

        invitationHandle:
          "invite-client-opaque",
      },
    );

    assert.equal(
      Object.hasOwn(
        safeReference,
        "accessToken",
      ),
      false,
    );

    assert.deepEqual(
      vault.resolve(
        "invite-client-opaque",
      ),
      {
        agreementId:
          "agreement-1",

        partyId:
          "party-client",

        role:
          "CLIENT",

        accessToken:
          "dummy-client-party-token",
      },
    );
  },
);

test(
  "canonical Telegram session contains safe party references only",
  () => {
    const sessions =
      createAgreementFlowSessionStore();

    sessions.setCanonicalAgreement(
      42,
      {
        reference: {
          agreementId:
            "agreement-1",

          agreementVersion:
            1,

          agreementHash:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },

        parties: [
          {
            partyId:
              "party-client",

            role:
              "CLIENT",

            invitationHandle:
              "invite-client-opaque",
          },

          {
            partyId:
              "party-contractor",

            role:
              "CONTRACTOR",

            invitationHandle:
              "invite-contractor-opaque",
          },
        ],
      },
    );

    const session =
      sessions.getCanonicalAgreement(
        42,
      );

    assert.ok(
      session,
    );

    const serialized =
      JSON.stringify(
        session,
      );

    assert.equal(
      serialized.includes(
        "accessToken",
      ),
      false,
    );

    assert.equal(
      serialized.includes(
        "party-token",
      ),
      false,
    );
  },
);
