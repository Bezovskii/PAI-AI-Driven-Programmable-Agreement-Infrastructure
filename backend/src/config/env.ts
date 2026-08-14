import "dotenv/config";

export type NodeEnvironment =
  | "development"
  | "test"
  | "production";

export interface AppConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
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
    value?.trim() || "127.0.0.1";

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
    parsed = new URL(value);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid URL.",
    );
  }

  if (
    parsed.protocol !== "postgresql:" &&
    parsed.protocol !== "postgres:"
  ) {
    throw new Error(
      "DATABASE_URL must use the postgresql:// or postgres:// protocol.",
    );
  }

  return value;
}

export function loadEnv(
  env: NodeJS.ProcessEnv = process.env,
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
  };

  return Object.freeze(config);
}
