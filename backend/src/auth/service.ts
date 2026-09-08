import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

export interface ServicePrincipal {
  readonly userId: string;
}

export type EnsureServicePrincipal =
  (
    userId: string,
  ) => Promise<void>;

export type ResolveServicePrincipal =
  (
    authorizationHeader:
      string | undefined,
  ) => Promise<ServicePrincipal | null>;

export interface ServicePrincipalResolverConfig {
  readonly token: string;
  readonly userId: string;
}

function hashToken(
  token: string,
): Buffer {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest();
}

function extractBearerToken(
  authorizationHeader:
    string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match =
    /^Bearer ([^\s]+)$/.exec(
      authorizationHeader,
    );

  return match?.[1] ?? null;
}

export function createServicePrincipalResolver(
  config:
    ServicePrincipalResolverConfig,

  ensureServicePrincipal:
    EnsureServicePrincipal,
): ResolveServicePrincipal {
  if (
    config.token.length <
    32
  ) {
    throw new Error(
      "Service authentication token must contain at least 32 characters.",
    );
  }

  if (!config.userId.trim()) {
    throw new Error(
      "Service principal user ID must not be empty.",
    );
  }

  const expectedTokenHash =
    hashToken(
      config.token,
    );

  return async (
    authorizationHeader:
      string | undefined,
  ): Promise<ServicePrincipal | null> => {
    const candidateToken =
      extractBearerToken(
        authorizationHeader,
      );

    if (!candidateToken) {
      return null;
    }

    const candidateTokenHash =
      hashToken(
        candidateToken,
      );

    if (
      candidateTokenHash.length !==
      expectedTokenHash.length ||
      !timingSafeEqual(
        candidateTokenHash,
        expectedTokenHash,
      )
    ) {
      return null;
    }

    await ensureServicePrincipal(
      config.userId,
    );

    return {
      userId:
        config.userId,
    };
  };
}
