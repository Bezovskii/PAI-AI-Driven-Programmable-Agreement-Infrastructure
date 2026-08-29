import { ethers } from "ethers";

import {
    agreementContractAddress,
} from "../contract/agreementContractAddress.js";

import agreementABI from "../contract/AgreementEscrowABI.json";

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

const agreementTransportABI =
    resolveAbi(
        agreementABI,
        "agreement settlement"
    );

function hasDeployedCode(code) {
    return Boolean(
        code &&
        code !== "0x"
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
            agreementContractAddress
        );

    if (!hasDeployedCode(deployedCode)) {
        return {
            agreementContract: null,
            address:
                agreementContractAddress,
            chainId,
        };
    }

    return {
        agreementContract:
            new ethers.Contract(
                agreementContractAddress,
                agreementTransportABI,
                signer
            ),

        address:
            agreementContractAddress,

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
            agreementId,
            overrides
        ) {
            return contract.fundAgreementETH(
                agreementId,
                overrides
            );
        },

        releaseMilestone(
            agreementId,
            milestoneId
        ) {
            return contract.approveMilestone(
                agreementId,
                milestoneId
            );
        },

        openMilestoneDispute(
            agreementId,
            milestoneId
        ) {
            return contract.openMilestoneDispute(
                agreementId,
                milestoneId
            );
        },
    };
}