import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPartyInvitationDeepLinks,
  formatPartyInvitationDeepLinks,
} from "../src/conversations/partyInvitationLink.js";

const safeParties = [
  {
    partyId:
      "party-client",

    role:
      "CLIENT" as const,

    invitationHandle:
      "opaque-client-handle",
  },
  {
    partyId:
      "party-contractor",

    role:
      "CONTRACTOR" as const,

    invitationHandle:
      "opaque-contractor-handle",
  },
];

test(
  "builds CLIENT and CONTRACTOR Telegram deep links from opaque handles only",
  () => {
    const links =
      buildPartyInvitationDeepLinks(
        "PAIAgreementsBot",
        safeParties,
      );

    assert.deepEqual(
      links,
      [
        {
          partyId:
            "party-client",

          role:
            "CLIENT",

          url:
            "https://t.me/PAIAgreementsBot?start=opaque-client-handle",
        },
        {
          partyId:
            "party-contractor",

          role:
            "CONTRACTOR",

          url:
            "https://t.me/PAIAgreementsBot?start=opaque-contractor-handle",
        },
      ],
    );

    const message =
      formatPartyInvitationDeepLinks(
        links,
      );

    assert.equal(
      message.includes(
        "CLIENT invitation:",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "CONTRACTOR invitation:",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
      false,
    );

    assert.equal(
      message.includes(
        "dummy-client-party-token",
      ),
      false,
    );
  },
);

test(
  "bot username may include Telegram at-prefix without affecting the link",
  () => {
    const links =
      buildPartyInvitationDeepLinks(
        "@PAIAgreementsBot",
        [
          safeParties[0],
        ],
      );

    assert.equal(
      links[0]?.url,
      "https://t.me/PAIAgreementsBot?start=opaque-client-handle",
    );
  },
);

test(
  "unsafe Telegram start parameters are rejected",
  () => {
    assert.throws(
      () =>
        buildPartyInvitationDeepLinks(
          "PAIAgreementsBot",
          [
            {
              partyId:
                "party-client",

              role:
                "CLIENT",

              invitationHandle:
                "handle?token=secret",
            },
          ],
        ),
      /invitation handle is invalid/,
    );
  },
);
