import {
  SiweMessage,
} from "siwe";

import {
  normalizeWalletAddress,
} from "./nonce.js";

export interface StoredAuthNonce {
  readonly id: string;
  readonly walletAddress: string;
  readonly nonce: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

export type FindAuthNonce =
  (
    nonce: string,
  ) => Promise<StoredAuthNonce | null>;

export interface ConsumeAuthNonceInput {
  readonly id: string;
  readonly consumedAt: Date;
}

export type ConsumeAuthNonce =
  (
    input: ConsumeAuthNonceInput,
  ) => Promise<boolean>;

export interface SiweVerificationConfig {
  readonly domain: string;
  readonly uri: string;
  readonly chainId: number;
}

export interface VerifySiweInput {
  readonly message: string;
  readonly signature: string;
}

export interface VerifiedSiweAuthentication {
  readonly walletAddress: string;
  readonly nonce: string;
}

export type VerifySiwe =
  (
    input: VerifySiweInput,
  ) => Promise<VerifiedSiweAuthentication>;

export interface SiweVerifierDependencies {
  readonly now?: () => Date;
}

export type InvalidSiweReason =
  | "invalid_message"
  | "nonce_not_found"
  | "nonce_consumed"
  | "nonce_expired"
  | "wallet_mismatch"
  | "domain_mismatch"
  | "uri_mismatch"
  | "version_mismatch"
  | "chain_id_mismatch"
  | "invalid_signature"
  | "nonce_race";

export class InvalidSiweAuthenticationError
  extends Error {
  readonly reason:
    InvalidSiweReason;

  constructor(
    reason: InvalidSiweReason,
  ) {
    super(
      "SIWE authentication failed.",
    );

    this.name =
      "InvalidSiweAuthenticationError";

    this.reason =
      reason;
  }
}

function fail(
  reason: InvalidSiweReason,
): never {
  throw new InvalidSiweAuthenticationError(
    reason,
  );
}

export function createSiweVerifier(
  findAuthNonce: FindAuthNonce,
  consumeAuthNonce: ConsumeAuthNonce,
  config: SiweVerificationConfig,
  dependencies: SiweVerifierDependencies = {},
): VerifySiwe {
  const now =
    dependencies.now ??
    (() => new Date());

  return async (
    input: VerifySiweInput,
  ): Promise<VerifiedSiweAuthentication> => {
    let siwe: SiweMessage;

    try {
      siwe =
        new SiweMessage(
          input.message,
        );
    } catch {
      return fail(
        "invalid_message",
      );
    }

    const verificationTime =
      now();

    const storedNonce =
      await findAuthNonce(
        siwe.nonce,
      );

    if (!storedNonce) {
      return fail(
        "nonce_not_found",
      );
    }

    if (
      storedNonce.consumedAt !==
      null
    ) {
      return fail(
        "nonce_consumed",
      );
    }

    if (
      storedNonce.expiresAt
        .getTime() <=
      verificationTime.getTime()
    ) {
      return fail(
        "nonce_expired",
      );
    }

    let messageAddress:
      string;

    let storedAddress:
      string;

    try {
      messageAddress =
        normalizeWalletAddress(
          siwe.address,
        );

      storedAddress =
        normalizeWalletAddress(
          storedNonce
            .walletAddress,
        );
    } catch {
      return fail(
        "wallet_mismatch",
      );
    }

    if (
      messageAddress !==
      storedAddress
    ) {
      return fail(
        "wallet_mismatch",
      );
    }

    if (
      siwe.domain !==
      config.domain
    ) {
      return fail(
        "domain_mismatch",
      );
    }

    if (
      siwe.uri !==
      config.uri
    ) {
      return fail(
        "uri_mismatch",
      );
    }

    if (
      siwe.version !==
      "1"
    ) {
      return fail(
        "version_mismatch",
      );
    }

    if (
      Number(siwe.chainId) !==
      config.chainId
    ) {
      return fail(
        "chain_id_mismatch",
      );
    }

    try {
      const verification =
        await siwe.verify({
          signature:
            input.signature,

          domain:
            config.domain,

          nonce:
            storedNonce.nonce,

          time:
            verificationTime
              .toISOString(),
        });

      if (
        !verification.success
      ) {
        return fail(
          "invalid_signature",
        );
      }
    } catch {
      return fail(
        "invalid_signature",
      );
    }

    const consumed =
      await consumeAuthNonce({
        id:
          storedNonce.id,

        consumedAt:
          verificationTime,
      });

    if (!consumed) {
      return fail(
        "nonce_race",
      );
    }

    return {
      walletAddress:
        storedAddress,

      nonce:
        storedNonce.nonce,
    };
  };
}