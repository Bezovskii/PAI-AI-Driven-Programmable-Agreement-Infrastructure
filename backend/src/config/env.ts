import "dotenv/config";

export type NodeEnvironment =
  | "development"
  | "test"
  | "production";

export interface AppConfig {
  readonly nodeEnv:
    NodeEnvironment;

  readonly host:
    string;

  readonly port:
    number;

  readonly databaseUrl:
    string;

  readonly siweDomain:
    string;

  readonly siweUri:
    string;

  readonly chainId:
    number;
}

const VALID_NODE_ENVIRONMENTS =
  new Set<NodeEnvironment>([
    "development",
    "test",
    "production",
  ]);

function parseNodeEnvironment(
  value: string | undefined,
): NodeEnvironment {
  const candidate =
    value ?? "development";

  if (
    !VALID_NODE_ENVIRONMENTS.has(
      candidate as NodeEnvironment,
    )
  ) {
    throw new Error(
      [
        "Invalid NODE_ENV.",
        "Expected one of:",
        "development, test, production.",
        `Received: ${candidate}`,
      ].join(" "),
    );
  }

  return candidate as NodeEnvironment;
}

function parseHost(
  value: string | undefined,
): string {
  const host =
    value?.trim() ||
    "127.0.0.1";

  if (host.length === 0) {
    throw new Error(
      "HOST must not be empty.",
    );
  }

  return host;
}

function parsePort(
  value: string | undefined,
): number {
  const raw =
    value ?? "3001";

  const port =
    Number(raw);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      `PORT must be an integer between 1 and 65535. Received: ${raw}`,
    );
  }

  return port;
}

function parseDatabaseUrl(
  value: string | undefined,
): string {
  if (!value?.trim()) {
    throw new Error(
      "DATABASE_URL is required.",
    );
  }

  let parsed: URL;

  try {
    parsed =
      new URL(value);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid URL.",
    );
  }

  if (
    parsed.protocol !==
      "postgresql:" &&
    parsed.protocol !==
      "postgres:"
  ) {
    throw new Error(
      "DATABASE_URL must use the postgresql:// or postgres:// protocol.",
    );
  }

  return value;
}

function parseSiweDomain(
  value: string | undefined,
): string {
  const domain =
    value?.trim();

  if (!domain) {
    throw new Error(
      "SIWE_DOMAIN is required.",
    );
  }

  if (
    domain.includes("://") ||
    domain.includes("/") ||
    /\s/.test(domain)
  ) {
    throw new Error(
      "SIWE_DOMAIN must be an authority such as localhost:5173 or app.example.com.",
    );
  }

  return domain;
}

function parseSiweUri(
  value: string | undefined,
): string {
  const uri =
    value?.trim();

  if (!uri) {
    throw new Error(
      "SIWE_URI is required.",
    );
  }

  let parsed: URL;

  try {
    parsed =
      new URL(uri);
  } catch {
    throw new Error(
      "SIWE_URI must be a valid URL.",
    );
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error(
      "SIWE_URI must use http:// or https://.",
    );
  }

  return uri;
}

function parseChainId(
  value: string | undefined,
): number {
  if (!value?.trim()) {
    throw new Error(
      "CHAIN_ID is required.",
    );
  }

  const chainId =
    Number(value);

  if (
    !Number.isSafeInteger(
      chainId,
    ) ||
    chainId < 1
  ) {
    throw new Error(
      `CHAIN_ID must be a positive safe integer. Received: ${value}`,
    );
  }

  return chainId;
}

export function loadEnv(
  env: NodeJS.ProcessEnv =
    process.env,
): Readonly<AppConfig> {
  const config: AppConfig = {
    nodeEnv:
      parseNodeEnvironment(
        env.NODE_ENV,
      ),

    host:
      parseHost(
        env.HOST,
      ),

    port:
      parsePort(
        env.PORT,
      ),

    databaseUrl:
      parseDatabaseUrl(
        env.DATABASE_URL,
      ),

    siweDomain:
      parseSiweDomain(
        env.SIWE_DOMAIN,
      ),

    siweUri:
      parseSiweUri(
        env.SIWE_URI,
      ),

    chainId:
      parseChainId(
        env.CHAIN_ID,
      ),
  };

  return Object.freeze(
    config,
  );
}