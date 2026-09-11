async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function requireNonEmptyString(
    value,
    name
) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw new Error(
            `${name} is required.`
        );
    }

    return value.trim();
}

export async function redeemWalletBindingHandoff({
    agreementId,
    partyId,
    handoffId,
}) {
    const resolvedAgreementId =
        requireNonEmptyString(
            agreementId,
            "agreementId"
        );

    const resolvedPartyId =
        requireNonEmptyString(
            partyId,
            "partyId"
        );

    const resolvedHandoffId =
        requireNonEmptyString(
            handoffId,
            "handoffId"
        );

    const endpoint =
        `/api/v1/agreements/${encodeURIComponent(
            resolvedAgreementId
        )}/parties/${encodeURIComponent(
            resolvedPartyId
        )}/wallet-binding-handoffs/redeem`;

    const response =
        await fetch(
            endpoint,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                credentials:
                    "include",

                body:
                    JSON.stringify({
                        handoffId:
                            resolvedHandoffId,
                    }),
            }
        );

    const payload =
        await readJson(
            response
        );

    if (!response.ok) {
        const message =
            payload?.message ||
            payload?.error ||
            "Unable to bind this wallet to the agreement.";

        const error =
            new Error(
                message
            );

        error.status =
            response.status;

        throw error;
    }

    return payload;
}