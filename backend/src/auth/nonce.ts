import {
  getAddress,
} from "ethers";

import {
  generateNonce,
} from "siwe";

export const AUTH_NONCE_TTL_MS =
  5 * 60 * 1000;

export interface NewAuthNonceRecord {
  readonly walletAddress: string;
  readonly nonce: string;
  readonly expiresAt: Date;
}

export interface IssuedAuthNonce {
  readonly walletAddress: string;
  readonly nonce: string;
  readonly expiresAt: Date;
}

export type PersistAuthNonce =
  (
    record: NewAuthNonceRecord,
  ) => Promise<void>;

export type IssueAuthNonce =
  (
    walletAddress: string,
  ) => Promise<IssuedAuthNonce>;

export interface AuthNonceDependencies {
  readonly now?: () => Date;
  readonly generateNonce?: () => string;
}

export class InvalidWalletAddressError
  extends Error {
  constructor() {
    super(
      "Invalid Ethereum wallet address.",
    );

    this.name =
      "InvalidWalletAddressError";
  }
}

export function normalizeWalletAddress(
  value: string,
): string {
  try {
    return getAddress(
      value.trim(),
    );
  } catch {
    throw new InvalidWalletAddressError();
  }
}

export function createAuthNonceIssuer(
  persistAuthNonce: PersistAuthNonce,
  dependencies: AuthNonceDependencies = {},
): IssueAuthNonce {
  const now =
    dependencies.now ??
    (() => new Date());

  const createNonce =
    dependencies.generateNonce ??
    generateNonce;

  return async (
    rawWalletAddress: string,
  ): Promise<IssuedAuthNonce> => {
    const walletAddress =
      normalizeWalletAddress(
        rawWalletAddress,
      );

    const issuedAt =
      now();

    const expiresAt =
      new Date(
        issuedAt.getTime() +
          AUTH_NONCE_TTL_MS,
      );

    const nonce =
      createNonce();

    const record: NewAuthNonceRecord = {
      walletAddress,
      nonce,
      expiresAt,
    };

    await persistAuthNonce(
      record,
    );

    return {
      walletAddress,
      nonce,
      expiresAt,
    };
  };
}