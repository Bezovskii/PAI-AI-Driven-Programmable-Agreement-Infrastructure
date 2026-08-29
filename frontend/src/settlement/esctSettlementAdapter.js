import { ethers } from "ethers";

import {
    contractAddress,
} from "../contract/contractAddress.js";

import contractABI from "../contract/MultiPaymentABI.json";

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

const paymentABI =
    resolveAbi(
        contractABI,
        "payment settlement"
    );

const agreementSettlementABI =
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
 * PAI -> ESCT settlement boundary.
 *
 * PAI owns agreements, milestones, evidence,
 * lifecycle, identity and application state.
 *
 * ESCT owns escrow, dispute, arbitration
 * and financial settlement contracts.
 */
export async function createEsctSettlementClients({
    provider,
    signer,
    chainId,
}) {
    if (!provider) {
        throw new Error(
            "A provider is required to connect to ESCT."
        );
    }

    if (!signer) {
        throw new Error(
            "A wallet signer is required to connect to ESCT."
        );
    }

    const [
        paymentCode,
        agreementSettlementCode,
    ] = await Promise.all([
        provider.getCode(
            contractAddress
        ),
        provider.getCode(
            agreementContractAddress
        ),
    ]);

    if (!hasDeployedCode(paymentCode)) {
        throw new Error(
            `ESCT settlement service is unavailable at ${contractAddress} on chain ${chainId}.`
        );
    }

    const paymentContract =
        new ethers.Contract(
            contractAddress,
            paymentABI,
            signer
        );

    const agreementContract =
        hasDeployedCode(
            agreementSettlementCode
        )
            ? new ethers.Contract(
                agreementContractAddress,
                agreementSettlementABI,
                signer
            )
            : null;

    return {
        paymentContract,
        agreementContract,

        capabilities: {
            payments: true,
            agreementSettlement:
                Boolean(
                    agreementContract
                ),
        },

        addresses: {
            payment:
                contractAddress,

            agreementSettlement:
                agreementContractAddress,
        },
    };
}