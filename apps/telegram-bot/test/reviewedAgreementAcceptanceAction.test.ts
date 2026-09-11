import assert from "node:assert/strict";
import test from "node:test";

import {
  createReviewedAgreementAcceptanceActionStore,
} from "../src/conversations/reviewedAgreementAcceptanceAction.js";

test(
  "reviewed acceptance action binds Telegram identity and exact reviewed canonical tuple",
  () => {
    const store =
      createReviewedAgreementAcceptanceActionStore({
        generateHandle:
          () =>
            "opaque-review-action",
      });

    const actionHandle =
      store.create({
        telegramUserId:
          101,

        invitationHandle:
          "opaque-party-invitation",

        agreementId:
          "agreement-1",

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          "canonical-hash-v3",
      });

    assert.equal(
      actionHandle,
      "opaque-review-action",
    );

    assert.deepEqual(
      store.resolve(
        actionHandle,
      ),
      {
        telegramUserId:
          101,

        invitationHandle:
          "opaque-party-invitation",

        agreementId:
          "agreement-1",

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          "canonical-hash-v3",
      },
    );

    const serialized =
      JSON.stringify(
        store.resolve(
          actionHandle,
        ),
      );

    assert.equal(
      serialized.includes(
        "dummy-party-access-token",
      ),
      false,
    );
  },
);

test(
  "reviewed acceptance action handle retries collisions without changing reviewed consent",
  () => {
    const handles = [
      "same-action",
      "same-action",
      "second-action",
    ];

    const store =
      createReviewedAgreementAcceptanceActionStore({
        generateHandle:
          () => {
            const next =
              handles.shift();

            if (!next) {
              throw new Error(
                "No test handle available.",
              );
            }

            return next;
          },
      });

    const first =
      store.create({
        telegramUserId:
          101,

        invitationHandle:
          "invite-client",

        agreementId:
          "agreement-1",

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          "hash-v3",
      });

    const second =
      store.create({
        telegramUserId:
          202,

        invitationHandle:
          "invite-contractor",

        agreementId:
          "agreement-1",

        partyId:
          "party-contractor",

        role:
          "CONTRACTOR",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          "hash-v3",
      });

    assert.equal(
      first,
      "same-action",
    );

    assert.equal(
      second,
      "second-action",
    );

    assert.equal(
      store.resolve(
        second,
      )?.telegramUserId,
      202,
    );

    assert.equal(
      store.resolve(
        second,
      )?.expectedAgreementVersion,
      3,
    );
  },
);

test(
  "reviewed acceptance action can be invalidated after use or stale review",
  () => {
    const store =
      createReviewedAgreementAcceptanceActionStore({
        generateHandle:
          () =>
            "delete-action",
      });

    const actionHandle =
      store.create({
        telegramUserId:
          101,

        invitationHandle:
          "invite-client",

        agreementId:
          "agreement-1",

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          4,

        expectedAgreementHash:
          "hash-v4",
      });

    assert.ok(
      store.resolve(
        actionHandle,
      ),
    );

    store.delete(
      actionHandle,
    );

    assert.equal(
      store.resolve(
        actionHandle,
      ),
      undefined,
    );
  },
);
