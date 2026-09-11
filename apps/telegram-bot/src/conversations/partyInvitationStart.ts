import type {
  ClaimedPartySession,
  PartyInvitationSessionStore,
} from "./partyInvitationSession.js";

export type PartyInvitationStartResult =
  | {
      readonly status:
        "claimed";

      readonly session:
        ClaimedPartySession;
    }
  | {
      readonly status:
        "already_claimed";

      readonly session:
        ClaimedPartySession;
    }
  | {
      readonly status:
        "invalid_invitation";
    }
  | {
      readonly status:
        "claimed_by_another_user";
    }
  | {
      readonly status:
        "conflicting_party";
    };

export function claimPartyInvitationFromStart(
  invitations:
    PartyInvitationSessionStore,

  telegramUserId:
    number,

  rawStartPayload:
    string,
): PartyInvitationStartResult | null {
  const invitationHandle =
    rawStartPayload.trim();

  if (!invitationHandle) {
    return null;
  }

  return invitations.claim(
    telegramUserId,
    invitationHandle,
  );
}

export function formatPartyInvitationStartResult(
  result:
    PartyInvitationStartResult,
): string {
  switch (
    result.status
  ) {
    case "claimed":
      return [
        `You joined PAI agreement ${result.session.agreementId}.`,
        "",
        `Your role: ${result.session.role}`,
        "",
        "This Telegram account is now linked to this party invitation.",
      ].join("\n");

    case "already_claimed":
      return [
        `You already joined PAI agreement ${result.session.agreementId}.`,
        "",
        `Your role: ${result.session.role}`,
      ].join("\n");

    case "invalid_invitation":
      return [
        "This PAI invitation is invalid or no longer available.",
        "Ask the agreement creator for the current invitation.",
      ].join("\n");

    case "claimed_by_another_user":
      return [
        "This PAI invitation has already been claimed by another Telegram account.",
        "Ask the agreement creator if you need a new invitation.",
      ].join("\n");

    case "conflicting_party":
      return [
        "This Telegram account is already linked to the other party in this agreement.",
        "Use the Telegram account intended for this invitation.",
      ].join("\n");
  }
}
