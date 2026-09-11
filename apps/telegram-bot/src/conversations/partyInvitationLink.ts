import type {
  AgreementPartyRole,
} from "@pai/agreement-contract";

import type {
  SafePartySessionReference,
} from "./canonicalAgreementSession.js";

const TELEGRAM_BOT_USERNAME_PATTERN =
  /^[A-Za-z0-9_]{5,32}$/;

const TELEGRAM_START_PARAMETER_PATTERN =
  /^[A-Za-z0-9_-]{1,64}$/;

export interface PartyInvitationDeepLink {
  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly url:
    string;
}

export function buildPartyInvitationDeepLinks(
  rawBotUsername:
    string,

  parties:
    readonly SafePartySessionReference[],
): readonly PartyInvitationDeepLink[] {
  const botUsername =
    rawBotUsername
      .trim()
      .replace(
        /^@/,
        "",
      );

  if (
    !TELEGRAM_BOT_USERNAME_PATTERN.test(
      botUsername,
    )
  ) {
    throw new Error(
      "Telegram bot username is invalid.",
    );
  }

  return parties.map(
    (
      party,
    ): PartyInvitationDeepLink => {
      const invitationHandle =
        party.invitationHandle.trim();

      if (
        !TELEGRAM_START_PARAMETER_PATTERN.test(
          invitationHandle,
        )
      ) {
        throw new Error(
          "Telegram invitation handle is invalid.",
        );
      }

      return {
        partyId:
          party.partyId,

        role:
          party.role,

        url:
          `https://t.me/${botUsername}?start=${invitationHandle}`,
      };
    },
  );
}

export function formatPartyInvitationDeepLinks(
  links:
    readonly PartyInvitationDeepLink[],
): string {
  return links
    .map(
      (link) =>
        [
          `${link.role} invitation:`,
          link.url,
        ].join("\n"),
    )
    .join("\n\n");
}
