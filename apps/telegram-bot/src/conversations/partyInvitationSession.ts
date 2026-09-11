import type {
  AgreementPartyRole,
} from "@pai/agreement-contract";

import type {
  PartyCredentialVault,
} from "./canonicalAgreementSession.js";

export interface ClaimedPartySession {
  readonly agreementId:
    string;

  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly invitationHandle:
    string;
}

export type ClaimPartyInvitationResult =
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

export interface PartyInvitationSessionStore {
  claim(
    telegramUserId: number,
    invitationHandle: string,
  ): ClaimPartyInvitationResult;

  get(
    telegramUserId: number,
    agreementId: string,
  ): ClaimedPartySession | undefined;
}

export function createPartyInvitationSessionStore(
  credentialVault:
    PartyCredentialVault,
): PartyInvitationSessionStore {
  const claimsByHandle =
    new Map<
      string,
      number
    >();

  const sessionsByUser =
    new Map<
      number,
      Map<
        string,
        ClaimedPartySession
      >
    >();

  return {
    claim(
      telegramUserId,
      invitationHandle,
    ): ClaimPartyInvitationResult {
      const credential =
        credentialVault.resolve(
          invitationHandle,
        );

      if (!credential) {
        return {
          status:
            "invalid_invitation",
        };
      }

      const existingClaimant =
        claimsByHandle.get(
          invitationHandle,
        );

      if (
        existingClaimant !==
          undefined &&
        existingClaimant !==
          telegramUserId
      ) {
        return {
          status:
            "claimed_by_another_user",
        };
      }

      const userSessions =
        sessionsByUser.get(
          telegramUserId,
        );

      const existingSession =
        userSessions?.get(
          credential.agreementId,
        );

      if (existingSession) {
        if (
          existingSession
            .invitationHandle ===
          invitationHandle
        ) {
          return {
            status:
              "already_claimed",

            session:
              existingSession,
          };
        }

        return {
          status:
            "conflicting_party",
        };
      }

      const session: ClaimedPartySession = {
        agreementId:
          credential.agreementId,

        partyId:
          credential.partyId,

        role:
          credential.role,

        invitationHandle,
      };

      claimsByHandle.set(
        invitationHandle,
        telegramUserId,
      );

      const nextUserSessions =
        userSessions ??
        new Map<
          string,
          ClaimedPartySession
        >();

      nextUserSessions.set(
        credential.agreementId,
        session,
      );

      sessionsByUser.set(
        telegramUserId,
        nextUserSessions,
      );

      return {
        status:
          "claimed",

        session,
      };
    },

    get(
      telegramUserId,
      agreementId,
    ) {
      return sessionsByUser
        .get(
          telegramUserId,
        )
        ?.get(
          agreementId,
        );
    },
  };
}
