export interface AgreementDraftSessionStore {
  start(
    userId: number,
  ): void;

  has(
    userId: number,
  ): boolean;

  preview(
    userId: number,
    message: string,
  ): string;

  commit(
    userId: number,
    message: string,
  ): void;

  clear(
    userId: number,
  ): void;
}

function requireMessage(
  message: string,
): string {
  const trimmed =
    message.trim();

  if (!trimmed) {
    throw new Error(
      "Agreement message must not be empty.",
    );
  }

  return trimmed;
}

function composeDraft(
  parts: readonly string[],
): string {
  return parts
    .map(
      (
        part,
        index,
      ) =>
        index === 0
          ? part
          : [
              `Additional clarification ${index}:`,
              part,
            ].join("\n"),
    )
    .join("\n\n");
}

export function createAgreementDraftSessionStore():
  AgreementDraftSessionStore {
  const sessions =
    new Map<
      number,
      string[]
    >();

  return {
    start(
      userId: number,
    ): void {
      sessions.set(
        userId,
        [],
      );
    },

    has(
      userId: number,
    ): boolean {
      return sessions.has(
        userId,
      );
    },

    preview(
      userId: number,
      message: string,
    ): string {
      const existing =
        sessions.get(
          userId,
        );

      if (!existing) {
        throw new Error(
          "Agreement session is not active.",
        );
      }

      return composeDraft([
        ...existing,
        requireMessage(
          message,
        ),
      ]);
    },

    commit(
      userId: number,
      message: string,
    ): void {
      const existing =
        sessions.get(
          userId,
        );

      if (!existing) {
        throw new Error(
          "Agreement session is not active.",
        );
      }

      existing.push(
        requireMessage(
          message,
        ),
      );
    },

    clear(
      userId: number,
    ): void {
      sessions.delete(
        userId,
      );
    },
  };
}