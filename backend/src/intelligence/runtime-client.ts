export interface IntelligenceRuntimeMeta {
  readonly runtimeVersion:
    string;

  readonly strictJson:
    boolean;

  readonly schemaValid:
    boolean;

  readonly promptTokens:
    number;

  readonly outputTokens:
    number;

  readonly inferenceSeconds:
    number;

  readonly adapterSha256:
    string;
}

export interface IntelligenceRuntimeResponse {
  readonly modelOutput:
    unknown;

  readonly rawModelOutput:
    string;

  readonly meta:
    IntelligenceRuntimeMeta;
}

export interface IntelligenceRuntimeClient {
  readonly structure:
    (
      text:
        string,
    ) => Promise<IntelligenceRuntimeResponse>;
}

export interface IntelligenceRuntimeClientOptions {
  readonly baseUrl:
    string;

  readonly timeoutMs?:
    number;
}

export class IntelligenceRuntimeError extends Error {
  readonly statusCode:
    number | undefined;

  constructor(
    message:
      string,
    statusCode?:
      number,
  ) {
    super(message);

    this.name =
      "IntelligenceRuntimeError";

    this.statusCode =
      statusCode;
  }
}

function isRecord(
  value:
    unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readErrorMessage(
  value:
    unknown,
): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const error =
    value.error;

  if (!isRecord(error)) {
    return null;
  }

  const message =
    error.message;

  return (
    typeof message === "string"
      ? message
      : null
  );
}

function assertLoopbackRuntimeUrl(
  value:
    string,
): URL {
  let url:
    URL;

  try {
    url =
      new URL(value);
  } catch {
    throw new Error(
      "PAI Intelligence runtime URL must be a valid URL.",
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "PAI Intelligence runtime URL must use http:// or https://.",
    );
  }

  const allowedHosts =
    new Set([
      "127.0.0.1",
      "localhost",
      "[::1]",
    ]);

  if (
    !allowedHosts.has(
      url.hostname,
    )
  ) {
    throw new Error(
      "PAI Intelligence runtime must use a loopback host.",
    );
  }

  return url;
}

function parseRuntimeResponse(
  value:
    unknown,
): IntelligenceRuntimeResponse {
  if (!isRecord(value)) {
    throw new IntelligenceRuntimeError(
      "PAI Intelligence runtime returned a non-object response.",
    );
  }

  const rawModelOutput =
    value.rawModelOutput;

  const meta =
    value.meta;

  if (
    typeof rawModelOutput !== "string" ||
    !isRecord(meta)
  ) {
    throw new IntelligenceRuntimeError(
      "PAI Intelligence runtime response is malformed.",
    );
  }

  const runtimeVersion =
    meta.runtimeVersion;

  const strictJson =
    meta.strictJson;

  const schemaValid =
    meta.schemaValid;

  const promptTokens =
    meta.promptTokens;

  const outputTokens =
    meta.outputTokens;

  const inferenceSeconds =
    meta.inferenceSeconds;

  const adapterSha256 =
    meta.adapterSha256;

  if (
    typeof runtimeVersion !== "string" ||
    typeof strictJson !== "boolean" ||
    schemaValid !== true ||
    typeof promptTokens !== "number" ||
    typeof outputTokens !== "number" ||
    typeof inferenceSeconds !== "number" ||
    typeof adapterSha256 !== "string"
  ) {
    throw new IntelligenceRuntimeError(
      "PAI Intelligence runtime validation metadata is malformed.",
    );
  }

  return {
    modelOutput:
      value.modelOutput,

    rawModelOutput,

    meta: {
      runtimeVersion,
      strictJson,
      schemaValid,
      promptTokens,
      outputTokens,
      inferenceSeconds,
      adapterSha256,
    },
  };
}

export function createIntelligenceRuntimeClient(
  options:
    IntelligenceRuntimeClientOptions,
): IntelligenceRuntimeClient {
  const baseUrl =
    assertLoopbackRuntimeUrl(
      options.baseUrl,
    );

  const timeoutMs =
    options.timeoutMs ??
    90_000;

  if (
    !Number.isSafeInteger(
      timeoutMs,
    ) ||
    timeoutMs < 1
  ) {
    throw new Error(
      "PAI Intelligence runtime timeout must be a positive integer.",
    );
  }

  return {
    structure:
      async (
        text,
      ) => {
        const controller =
          new AbortController();

        const timeout =
          setTimeout(
            () => {
              controller.abort();
            },
            timeoutMs,
          );

        try {
          let response:
            Response;

          try {
            response =
              await fetch(
                new URL(
                  "/structure",
                  baseUrl,
                ),
                {
                  method:
                    "POST",

                  headers: {
                    "content-type":
                      "application/json",
                  },

                  body:
                    JSON.stringify({
                      text,
                    }),

                  signal:
                    controller.signal,
                },
              );
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : String(error);

            throw new IntelligenceRuntimeError(
              "PAI Intelligence runtime request failed: " +
              message,
            );
          }

          let payload:
            unknown;

          try {
            payload =
              await response.json();
          } catch {
            throw new IntelligenceRuntimeError(
              "PAI Intelligence runtime returned invalid JSON.",
              response.status,
            );
          }

          if (!response.ok) {
            throw new IntelligenceRuntimeError(
              readErrorMessage(
                payload,
              ) ??
              (
                "PAI Intelligence runtime failed with HTTP " +
                response.status
              ),
              response.status,
            );
          }

          return parseRuntimeResponse(
            payload,
          );
        } finally {
          clearTimeout(
            timeout,
          );
        }
      },
  };
}