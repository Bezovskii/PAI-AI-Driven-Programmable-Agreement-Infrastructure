import { ethers } from "ethers";

import {
    esctSettlementContractAddress,
} from "./esctSettlementContractAddress.js";

import legacyAgreementEscrowABI from "./legacyAgreementEscrowABI.json";

function resolveAbi(source, label) {
    const abi =
        Array.isArray(source)
            ? source
            : source?.abi;

    if (!Array.isArray(abi)) {
        throw new Error(
            `Invalid ESCT ${label} ABI. Expected an ABI array.`
        );
    }

    return abi;
}

const legacySettlementTransportABI =
    resolveAbi(
        legacyAgreementEscrowABI,
        "agreement settlement"
    );

function hasDeployedCode(code) {
    return Boolean(
        code &&
        code !== "0x"
    );
}

function requireEsctUintId(
    value,
    label
) {
    const normalized =
        String(
            value ?? ""
        ).trim();

    if (
        !/^\d+$/.test(
            normalized
        )
    ) {
        throw new Error(
            `Invalid ESCT ${label}. Expected an external numeric settlement ID.`
        );
    }

    return BigInt(
        normalized
    );
}

/**
 * Temporary compatibility transport for the legacy mixed
 * AgreementEscrow deployment.
 *
 * PAI agreement operations and ESCT settlement operations
 * use separate higher-level clients even though they currently
 * share this deployed transport.
 *
 * The transport can later be replaced without changing the
 * PAI agreement workspace.
 */
export async function createEsctAgreementTransport({
    provider,
    signer,
    chainId,
}) {
    if (!provider) {
        throw new Error(
            "A provider is required to connect to the agreement transport."
        );
    }

    if (!signer) {
        throw new Error(
            "A wallet signer is required to connect to the agreement transport."
        );
    }

    const deployedCode =
        await provider.getCode(
            esctSettlementContractAddress
        );

    if (!hasDeployedCode(deployedCode)) {
        return {
            agreementContract: null,
            address:
                esctSettlementContractAddress,
            chainId,
        };
    }

    return {
        agreementContract:
            new ethers.Contract(
                esctSettlementContractAddress,
                legacySettlementTransportABI,
                signer
            ),

        address:
            esctSettlementContractAddress,

        chainId,
    };
}


/**
 * ESCT settlement surface used by PAI agreements.
 *
 * ESCT owns:
 * - escrow funding
 * - financial release
 * - disputes
 * - arbitration / settlement
 *
 * The legacy AgreementEscrow transport is intentionally hidden
 * behind this boundary.
 */
export function createEsctAgreementSettlementClient(
    contract
) {
    if (!contract) {
        return null;
    }

    return {
        fundAgreementETH(
            externalAgreementId,
            overrides
        ) {
            return contract.fundAgreementETH(
                requireEsctUintId(
                    externalAgreementId,
                    "agreement ID"
                ),
                overrides
            );
        },

        releaseMilestone(
            externalAgreementId,
            externalMilestoneId
        ) {
            return contract.approveMilestone(
                requireEsctUintId(
                    externalAgreementId,
                    "agreement ID"
                ),
                requireEsctUintId(
                    externalMilestoneId,
                    "milestone ID"
                )
            );
        },

        openMilestoneDispute(
            externalAgreementId,
            externalMilestoneId
        ) {
            return contract.openMilestoneDispute(
                requireEsctUintId(
                    externalAgreementId,
                    "agreement ID"
                ),
                requireEsctUintId(
                    externalMilestoneId,
                    "milestone ID"
                )
            );
        },
    };
}