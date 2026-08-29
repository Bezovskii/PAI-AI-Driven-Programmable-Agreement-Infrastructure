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
        await readJson(
            response
        );

    if (!response.ok) {
        throw new Error(
            payload?.message ||
            payload?.error ||
            fallbackMessage
        );
    }

    return payload;
}

async function request(
    path,
    {
        method = "GET",
        body,
        fallbackMessage,
    } = {}
) {
    const options = {
        method,

        credentials:
            "include",
    };

    if (body !== undefined) {
        options.headers = {
            "Content-Type":
                "application/json",
        };

        options.body =
            JSON.stringify(
                body
            );
    }

    const response =
        await fetch(
            path,
            options
        );

    return requireSuccess(
        response,
        fallbackMessage ||
        "PAI settlement-binding request failed."
    );
}


/* =========================================================
                    AGREEMENT BINDINGS
   ========================================================= */

export async function getPaiSettlementBindings(
    agreementId
) {
    const payload =
        await request(
            `/api/v1/agreements/${encodeURIComponent(
                agreementId
            )}/settlement-bindings`,
            {
                fallbackMessage:
                    "Unable to load settlement bindings.",
            }
        );

    return Array.isArray(
        payload?.bindings
    )
        ? payload.bindings
        : [];
}


export function createPaiSettlementBinding(
    agreementId,
    {
        provider,
        chainId,
        contractAddress,
        externalAgreementId,
    }
) {
    return request(
        `/api/v1/agreements/${encodeURIComponent(
            agreementId
        )}/settlement-bindings`,
        {
            method:
                "POST",

            body: {
                provider,
                chainId,
                contractAddress,
                externalAgreementId,
            },

            fallbackMessage:
                "Unable to create settlement binding.",
        }
    );
}


/* =========================================================
                    MILESTONE BINDINGS
   ========================================================= */

export function createPaiMilestoneSettlementBinding(
    agreementId,
    agreementSettlementBindingId,
    milestoneId,
    {
        externalMilestoneId,
    }
) {
    return request(
        `/api/v1/agreements/${encodeURIComponent(
            agreementId
        )}/settlement-bindings/${encodeURIComponent(
            agreementSettlementBindingId
        )}/milestones/${encodeURIComponent(
            milestoneId
        )}`,
        {
            method:
                "POST",

            body: {
                externalMilestoneId,
            },

            fallbackMessage:
                "Unable to create milestone settlement binding.",
        }
    );
}


/* =========================================================
                    SAFE ID RESOLUTION

   PAI IDs remain PAI IDs.
   External IDs are returned only from persisted bindings.
   No PAI UUID is ever converted into an ESCT numeric ID.
   ========================================================= */

export function findPaiSettlementBinding(
    bindings,
    {
        provider,
        chainId,
        contractAddress,
    } = {}
) {
    if (
        !Array.isArray(bindings)
    ) {
        return null;
    }

    const normalizedProvider =
        provider
            ?.trim()
            .toLowerCase();

    const normalizedContractAddress =
        contractAddress
            ?.trim()
            .toLowerCase();

    return (
        bindings.find(
            (binding) => {
                if (
                    normalizedProvider &&
                    binding?.provider
                        ?.toLowerCase() !==
                        normalizedProvider
                ) {
                    return false;
                }

                if (
                    chainId !== undefined &&
                    Number(
                        binding?.chainId
                    ) !==
                        Number(chainId)
                ) {
                    return false;
                }

                if (
                    normalizedContractAddress &&
                    binding?.contractAddress
                        ?.toLowerCase() !==
                        normalizedContractAddress
                ) {
                    return false;
                }

                return true;
            }
        ) || null
    );
}


export function getExternalAgreementId(
    binding
) {
    const value =
        binding
            ?.externalAgreementId;

    if (
        typeof value !==
            "string" ||
        value.trim() ===
            ""
    ) {
        return null;
    }

    return value;
}


export function getExternalMilestoneId(
    binding,
    paiMilestoneId
) {
    const milestoneBindings =
        binding
            ?.milestoneBindings;

    if (
        !Array.isArray(
            milestoneBindings
        )
    ) {
        return null;
    }

    const paiId =
        String(
            paiMilestoneId
        );

    const mapping =
        milestoneBindings.find(
            (item) =>
                String(
                    item?.milestoneId
                ) ===
                paiId
        );

    const value =
        mapping
            ?.externalMilestoneId;

    if (
        typeof value !==
            "string" ||
        value.trim() ===
            ""
    ) {
        return null;
    }

    return value;
}


export const paiSettlementBindingApi = {
    getAgreementBindings:
        getPaiSettlementBindings,

    createAgreementBinding:
        createPaiSettlementBinding,

    createMilestoneBinding:
        createPaiMilestoneSettlementBinding,
};