import {
  createHash,
  randomBytes,
} from "node:crypto";

export const SESSION_TOKEN_BYTES =
  32;

export interface PersistSessionInput {
  readonly walletAddress: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
}

export interface PersistSessionResult {
  readonly userId: string;
}

export type PersistAuthenticatedSession =
  (
    input: PersistSessionInput,
  ) => Promise<PersistSessionResult>;

export interface IssuedSession {
  readonly userId: string;
  readonly walletAddress: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export type IssueSession =
  (
    walletAddress: string,
  ) => Promise<IssuedSession>;

export interface SessionIssuerConfig {
  readonly ttlSeconds: number;
}

export interface SessionIssuerDependencies {
  readonly now?: () => Date;
  readonly generateToken?: () => string;
}

export function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest(
      "hex",
    );
}

export function generateSessionToken():
string {
  return randomBytes(
    SESSION_TOKEN_BYTES,
  ).toString(
    "base64url",
  );
}

export function createSessionIssuer(
  persistSession:
    PersistAuthenticatedSession,

  config:
    SessionIssuerConfig,

  dependencies:
    SessionIssuerDependencies = {},
): IssueSession {
  if (
    !Number.isSafeInteger(
      config.ttlSeconds,
    ) ||
    config.ttlSeconds < 1
  ) {
    throw new Error(
      "Session TTL must be a positive safe integer.",
    );
  }

  const now =
    dependencies.now ??
    (() => new Date());

  const generateToken =
    dependencies.generateToken ??
    generateSessionToken;

  return async (
    walletAddress: string,
  ): Promise<IssuedSession> => {
    const createdAt =
      now();

    const token =
      generateToken();

    const tokenHash =
      hashSessionToken(
        token,
      );

    const expiresAt =
      new Date(
        createdAt.getTime() +
          config.ttlSeconds *
            1000,
      );

    const persisted =
      await persistSession({
        walletAddress,
        tokenHash,
        expiresAt,
        lastUsedAt:
          createdAt,
      });

    return {
      userId:
        persisted.userId,

      walletAddress,

      token,

      expiresAt,
    };
  };
}