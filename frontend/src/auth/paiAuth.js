async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

async function requireSuccess(
    response,
    fallbackMessage
) {
    const payload =
        await readJson(response);

    if (!response.ok) {
        throw new Error(
            payload?.message ||
            payload?.error ||
            fallbackMessage
        );
    }

    return payload;
}

/* =========================================================
                         NONCE
   ========================================================= */

export async function requestAuthNonce(
    walletAddress
) {
    const response =
        await fetch(
            "/api/v1/auth/nonce",
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                credentials:
                    "include",

                body:
                    JSON.stringify({
                        walletAddress,
                    }),
            }
        );

    return requireSuccess(
        response,
        "Unable to request authentication nonce."
    );
}

/* =========================================================
                      SIWE MESSAGE
   ========================================================= */

export function buildSiweMessage({
    domain,
    walletAddress,
    uri,
    version,
    chainId,
    nonce,
    expiresAt,
}) {
    const issuedAt =
        new Date().toISOString();

    return [
        `${domain} wants you to sign in with your Ethereum account:`,
        walletAddress,
        "",
        "Sign in to PAI.",
        "",
        `URI: ${uri}`,
        `Version: ${version}`,
        `Chain ID: ${chainId}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
        `Expiration Time: ${expiresAt}`,
    ].join("\n");
}

/* =========================================================
                         VERIFY
   ========================================================= */

export async function verifySiweAuthentication({
    message,
    signature,
}) {
    const response =
        await fetch(
            "/api/v1/auth/verify",
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                credentials:
                    "include",

                body:
                    JSON.stringify({
                        message,
                        signature,
                    }),
            }
        );

    return requireSuccess(
        response,
        "PAI authentication failed."
    );
}

/* =========================================================
                     RESTORE SESSION
   ========================================================= */

export async function fetchCurrentSession() {
    const response =
        await fetch(
            "/api/v1/auth/session",
            {
                method:
                    "GET",

                credentials:
                    "include",
            }
        );

    if (
        response.status ===
        401
    ) {
        return null;
    }

    return requireSuccess(
        response,
        "Unable to restore PAI session."
    );
}

/* =========================================================
                         LOGOUT
   ========================================================= */

export async function logoutSession() {
    const response =
        await fetch(
            "/api/v1/auth/logout",
            {
                method:
                    "POST",

                credentials:
                    "include",
            }
        );

    return requireSuccess(
        response,
        "Unable to log out of PAI."
    );
}