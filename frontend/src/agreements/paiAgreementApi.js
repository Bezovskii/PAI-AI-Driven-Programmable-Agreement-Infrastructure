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
        "PAI agreement request failed."
    );
}


/* =========================================================
                         CREATE
   ========================================================= */

export function createPaiAgreement({
    contractorWalletAddress,
    title,
    metadataUri,
    termsHash,
}) {
    return request(
        "/api/v1/agreements",
        {
            method:
                "POST",

            body: {
                contractorWalletAddress,

                ...(
                    title !== undefined
                        ? {
                            title,
                        }
                        : {}
                ),

                ...(
                    metadataUri !== undefined
                        ? {
                            metadataUri,
                        }
                        : {}
                ),

                ...(
                    termsHash !== undefined
                        ? {
                            termsHash,
                        }
                        : {}
                ),
            },

            fallbackMessage:
                "Unable to create PAI agreement.",
        }
    );
}


/* =========================================================
                          READ
   ========================================================= */

export function getPaiAgreement(
    agreementId
) {
    return request(
        `/api/v1/agreements/${encodeURIComponent(
            agreementId
        )}`,
        {
            fallbackMessage:
                "Unable to load PAI agreement.",
        }
    );
}


/* =========================================================
                       ADD MILESTONE
   ========================================================= */

export function addPaiMilestone(
    agreementId,
    {
        title,
        specificationUri,
        amount,
        asset,
    }
) {
    return request(
        `/api/v1/agreements/${encodeURIComponent(
            agreementId
        )}/milestones`,
        {
            method:
                "POST",

            body: {
                ...(
                    title !== undefined
                        ? {
                            title,
                        }
                        : {}
                ),

                ...(
                    specificationUri !== undefined
                        ? {
                            specificationUri,
                        }
                        : {}
                ),

                ...(
                    amount !== undefined
                        ? {
                            amount,
                        }
                        : {}
                ),

                ...(
                    asset !== undefined
                        ? {
                            asset,
                        }
                        : {}
                ),
            },

            fallbackMessage:
                "Unable to add PAI milestone.",
        }
    );
}


/* =========================================================
                         PROPOSE
   ========================================================= */

export function proposePaiAgreement(
    agreementId
) {
    return request(
        `/api/v1/agreements/${encodeURIComponent(
            agreementId
        )}/propose`,
        {
            method:
                "POST",

            fallbackMessage:
                "Unable to propose PAI agreement.",
        }
    );
}


/* =========================================================
                          ACCEPT
   ========================================================= */

export function acceptPaiAgreement(
    agreementId
) {
    return request(
        `/api/v1/agreements/${encodeURIComponent(
            agreementId
        )}/accept`,
        {
            method:
                "POST",

            fallbackMessage:
                "Unable to accept PAI agreement.",
        }
    );
}


/* =========================================================
                         EVIDENCE
   ========================================================= */

export function submitPaiEvidence(
    agreementId,
    milestoneId,
    {
        uri,
        hash,
        description,
    }
) {
    return request(
        `/api/v1/agreements/${encodeURIComponent(
            agreementId
        )}/milestones/${encodeURIComponent(
            milestoneId
        )}/evidence`,
        {
            method:
                "POST",

            body: {
                uri,

                ...(
                    hash !== undefined
                        ? {
                            hash,
                        }
                        : {}
                ),

                ...(
                    description !== undefined
                        ? {
                            description,
                        }
                        : {}
                ),
            },

            fallbackMessage:
                "Unable to submit PAI milestone evidence.",
        }
    );
}


export const paiAgreementApi = {
    createAgreement:
        createPaiAgreement,

    getAgreement:
        getPaiAgreement,

    addMilestone:
        addPaiMilestone,

    proposeAgreement:
        proposePaiAgreement,

    acceptAgreement:
        acceptPaiAgreement,

    submitEvidence:
        submitPaiEvidence,
};