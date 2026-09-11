import assert from "node:assert/strict";
import test from "node:test";

import {
  createPartyCredentialVault,
} from "../src/conversations/canonicalAgreementSession.js";

import {
  createPartyInvitationSessionStore,
} from "../src/conversations/partyInvitationSession.js";

function createFixture() {
  let index =
    0;

  const handles = [
    "opaque-client-handle",
    "opaque-contractor-handle",
  ];

  const credentialVault =
    createPartyCredentialVault({
      generateHandle:
        () =>
          handles[
            index++
          ] ??
          "unexpected-handle",
    });

  const client =
    credentialVault.store(
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

  const contractor =
    credentialVault.store(
      "agreement-1",
      {
        partyId:
          "party-contractor",

        role:
          "CONTRACTOR",

        accessToken:
          "dummy-contractor-party-token",
      },
    );

  return {
    credentialVault,
    client,
    contractor,
  };
}

test(
  "party invitation binds an opaque handle to one Telegram user",
  () => {
    const {
      credentialVault,
      client,
    } =
      createFixture();

    const sessions =
      createPartyInvitationSessionStore(
        credentialVault,
      );

    const result =
      sessions.claim(
        101,
        client.invitationHandle,
      );

    assert.deepEqual(
      result,
      {
        status:
          "claimed",

        session: {
          agreementId:
            "agreement-1",

          partyId:
            "party-client",

          role:
            "CLIENT",

          invitationHandle:
            "opaque-client-handle",
        },
      },
    );

    const serialized =
      JSON.stringify(
        result,
      );

    assert.equal(
      serialized.includes(
        "dummy-client-party-token",
      ),
      false,
    );
  },
);

test(
  "same Telegram user may claim the same invitation idempotently",
  () => {
    const {
      credentialVault,
      client,
    } =
      createFixture();

    const sessions =
      createPartyInvitationSessionStore(
        credentialVault,
      );

    const first =
      sessions.claim(
        101,
        client.invitationHandle,
      );

    const second =
      sessions.claim(
        101,
        client.invitationHandle,
      );

    assert.equal(
      first.status,
      "claimed",
    );

    assert.equal(
      second.status,
      "already_claimed",
    );
  },
);

test(
  "invitation already claimed by another Telegram user is rejected",
  () => {
    const {
      credentialVault,
      client,
    } =
      createFixture();

    const sessions =
      createPartyInvitationSessionStore(
        credentialVault,
      );

    sessions.claim(
      101,
      client.invitationHandle,
    );

    const result =
      sessions.claim(
        202,
        client.invitationHandle,
      );

    assert.deepEqual(
      result,
      {
        status:
          "claimed_by_another_user",
      },
    );
  },
);

test(
  "one Telegram user cannot silently claim both parties in one agreement",
  () => {
    const {
      credentialVault,
      client,
      contractor,
    } =
      createFixture();

    const sessions =
      createPartyInvitationSessionStore(
        credentialVault,
      );

    sessions.claim(
      101,
      client.invitationHandle,
    );

    const result =
      sessions.claim(
        101,
        contractor.invitationHandle,
      );

    assert.deepEqual(
      result,
      {
        status:
          "conflicting_party",
      },
    );

    assert.deepEqual(
      sessions.get(
        101,
        "agreement-1",
      ),
      {
        agreementId:
          "agreement-1",

        partyId:
          "party-client",

        role:
          "CLIENT",

        invitationHandle:
          "opaque-client-handle",
      },
    );
  },
);

test(
  "unknown invitation handle is rejected",
  () => {
    const {
      credentialVault,
    } =
      createFixture();

    const sessions =
      createPartyInvitationSessionStore(
        credentialVault,
      );

    assert.deepEqual(
      sessions.claim(
        101,
        "not-a-real-invitation",
      ),
      {
        status:
          "invalid_invitation",
      },
    );
  },
);
