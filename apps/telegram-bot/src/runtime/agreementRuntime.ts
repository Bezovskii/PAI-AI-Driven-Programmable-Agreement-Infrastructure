import {
  createAgreementFlowSessionStore,
  createPartyCredentialVault,
  type AgreementFlowSessionStore,
  type CreatePartyCredentialVaultOptions,
  type PartyCredentialVault,
} from "../conversations/canonicalAgreementSession.js";

import {
  createPartyInvitationSessionStore,
  type PartyInvitationSessionStore,
} from "../conversations/partyInvitationSession.js";

import {
  createReviewedAgreementAcceptanceActionStore,
  type ReviewedAgreementAcceptanceActionStore,
} from "../conversations/reviewedAgreementAcceptanceAction.js";

export interface CreateAgreementRuntimeOptions
  extends CreatePartyCredentialVaultOptions {
  readonly generateAcceptanceActionHandle?:
    () => string;
}

export interface AgreementRuntime {
  readonly flowSessions:
    AgreementFlowSessionStore;

  readonly credentialVault:
    PartyCredentialVault;

  readonly partyInvitationSessions:
    PartyInvitationSessionStore;

  readonly reviewedAcceptanceActions:
    ReviewedAgreementAcceptanceActionStore;
}

export function createAgreementRuntime(
  options:
    CreateAgreementRuntimeOptions = {},
): AgreementRuntime {
  const credentialVault =
    createPartyCredentialVault(
      options,
    );

  return {
    flowSessions:
      createAgreementFlowSessionStore(),

    credentialVault,

    partyInvitationSessions:
      createPartyInvitationSessionStore(
        credentialVault,
      ),

    reviewedAcceptanceActions:
      createReviewedAgreementAcceptanceActionStore(
        options.generateAcceptanceActionHandle
          ? {
              generateHandle:
                options.generateAcceptanceActionHandle,
            }
          : {},
      ),
  };
}
