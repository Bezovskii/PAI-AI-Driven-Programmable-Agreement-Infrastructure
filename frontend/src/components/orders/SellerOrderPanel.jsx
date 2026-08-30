import { ethers } from "ethers";
import { useState } from "react";

import { useWeb3 } from "../../hooks/useWeb3.js";

const ERC20_METADATA_ABI = [
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
];

const ORDER_STATUS = [
    "In Escrow",
    "Disputed",
    "Completed",
    "Refunded",
];

const PAYMENT_TYPE = [
    "Direct",
    "Escrow",
];

const AGREEMENT_STATUS = [
    "Proposed",
    "Accepted",
    "Active",
    "Completed",
    "Cancelled",
];

const MILESTONE_STATUS = [
    "Pending",
    "Submitted",
    "Disputed",
    "Released",
    "Refunded",
];

function shortAddress(address) {
    if (!address) {
        return "-";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getErrorMessage(error) {
    if (
        error?.code === 4001 ||
        error?.code === "ACTION_REJECTED"
    ) {
        return "Transaction rejected in the wallet.";
    }

    return (
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "The operation could not be completed."
    );
}

function makeEvidenceHash(value) {
    const trimmed = value.trim();

    if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
        return trimmed;
    }

    return ethers.keccak256(
        ethers.toUtf8Bytes(trimmed)
    );
}

export default function SellerOrderPanel() {
    const {
        account,
        provider,
        contract,
        agreementContract,
        isAgreementReady,
        isConnected,
        isCorrectNetwork,
        executeTransaction,
    } = useWeb3();

    // =========================================================
    // LEGACY / ONE-OFF ORDER STATE
    // =========================================================

    const [orderId, setOrderId] = useState("");
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    // =========================================================
    // AGREEMENT / CONTRACTOR STATE
    // =========================================================

    const [agreementId, setAgreementId] =
        useState("");

    const [agreement, setAgreement] =
        useState(null);

    const [milestones, setMilestones] =
        useState([]);

    const [agreementAsset, setAgreementAsset] =
        useState({
            symbol: "ETH",
            decimals: 18,
        });

    const [agreementLoading, setAgreementLoading] =
        useState(false);

    const [agreementError, setAgreementError] =
        useState("");

    const [agreementNotice, setAgreementNotice] =
        useState("");

    const [evidenceByMilestone, setEvidenceByMilestone] =
        useState({});

    // =========================================================
    // SHARED HELPERS
    // =========================================================

    function validateConnection() {
        if (!isConnected || !provider) {
            throw new Error("Connect your wallet first.");
        }

        if (!isCorrectNetwork) {
            throw new Error(
                "Switch your wallet to the expected network."
            );
        }
    }

    async function getAssetMetadata(tokenAddress) {
        if (
            tokenAddress.toLowerCase() ===
            ethers.ZeroAddress.toLowerCase()
        ) {
            return {
                symbol: "ETH",
                decimals: 18,
            };
        }

        const tokenContract =
            new ethers.Contract(
                tokenAddress,
                ERC20_METADATA_ABI,
                provider
            );

        const [symbol, decimalsResult] =
            await Promise.all([
                tokenContract.symbol(),
                tokenContract.decimals(),
            ]);

        return {
            symbol,
            decimals: Number(decimalsResult),
        };
    }

    // =========================================================
    // AGREEMENT / CONTRACTOR LOGIC
    // =========================================================

    function validateAgreementId() {
        const parsedAgreementId =
            Number(agreementId);

        if (
            !Number.isInteger(parsedAgreementId) ||
            parsedAgreementId <= 0
        ) {
            throw new Error(
                "Enter a valid Agreement ID greater than zero."
            );
        }

        return parsedAgreementId;
    }

    async function loadAgreement(
        explicitId = null
    ) {
        try {
            setAgreementError("");
            setAgreementNotice("");
            setAgreementLoading(true);

            validateConnection();

            if (
                !agreementContract ||
                !isAgreementReady
            ) {
                throw new Error(
                    "Agreement V1 contract is not ready."
                );
            }

            const parsedAgreementId =
                explicitId !== null
                    ? Number(explicitId)
                    : validateAgreementId();

            if (
                !Number.isInteger(
                    parsedAgreementId
                ) ||
                parsedAgreementId <= 0
            ) {
                throw new Error(
                    "Enter a valid Agreement ID greater than zero."
                );
            }

            const raw =
                await agreementContract
                    .agreementById(
                        parsedAgreementId
                    );

            if (!raw.exists) {
                throw new Error(
                    `Agreement #${parsedAgreementId} does not exist.`
                );
            }

            const metadata =
                await getAssetMetadata(
                    raw.token
                );

            const milestoneCount =
                Number(raw.milestoneCount);

            const loadedMilestones =
                await Promise.all(
                    Array.from(
                        {
                            length:
                                milestoneCount,
                        },
                        (_, index) =>
                            agreementContract
                                .milestoneById(
                                    parsedAgreementId,
                                    index + 1
                                )
                    )
                );

            setAgreementAsset(metadata);

            setAgreement({
                id: raw.id,
                client: raw.client,
                contractor:
                    raw.contractor,
                token: raw.token,
                totalAmount:
                    raw.totalAmount,
                remainingEscrow:
                    raw.remainingEscrow,
                status:
                    Number(raw.status),
                metadataURI:
                    raw.metadataURI,
                milestoneCount,
                exists: raw.exists,
            });

            setMilestones(
                loadedMilestones.map(
                    (item) => ({
                        id: item.id,
                        amount:
                            item.amount,
                        status:
                            Number(
                                item.status
                            ),
                        metadataURI:
                            item.metadataURI,
                        evidenceURI:
                            item.evidenceURI,
                        evidenceHash:
                            item.evidenceHash,
                        exists:
                            item.exists,
                    })
                )
            );

            setAgreementId(
                parsedAgreementId.toString()
            );

            setAgreementNotice(
                `Agreement #${parsedAgreementId} loaded.`
            );
        } catch (loadError) {
            console.error(loadError);

            setAgreement(null);
            setMilestones([]);

            setAgreementError(
                getErrorMessage(loadError)
            );
        } finally {
            setAgreementLoading(false);
        }
    }

    async function runAgreementAction({
        action,
        pendingMessage,
        submittedMessage,
        successMessage,
    }) {
        try {
            setAgreementError("");
            setAgreementNotice("");
            setAgreementLoading(true);

            validateConnection();

            if (
                !agreementContract ||
                !isAgreementReady
            ) {
                throw new Error(
                    "Agreement V1 contract is not ready."
                );
            }

            if (!agreement) {
                throw new Error(
                    "Load an Agreement first."
                );
            }

            await executeTransaction({
                action,
                pendingMessage,
                submittedMessage,
                successMessage,
            });

            await loadAgreement(
                Number(
                    agreement.id
                        .toString()
                )
            );

            setAgreementNotice(
                successMessage
            );
        } catch (actionError) {
            console.error(actionError);

            setAgreementError(
                getErrorMessage(actionError)
            );
        } finally {
            setAgreementLoading(false);
        }
    }

    function updateEvidenceField(
        milestoneId,
        field,
        value
    ) {
        const key =
            milestoneId.toString();

        setEvidenceByMilestone(
            (current) => ({
                ...current,
                [key]: {
                    ...(current[key] || {}),
                    [field]: value,
                },
            })
        );
    }

    async function submitMilestone(
        milestone
    ) {
        const key =
            milestone.id.toString();

        const entry =
            evidenceByMilestone[key] ||
            {};

        const evidenceURI =
            entry.uri?.trim() || "";

        const evidenceProof =
            entry.proof?.trim() || "";

        if (!evidenceURI) {
            setAgreementError(
                "Enter an evidence URI before submitting the milestone."
            );

            return;
        }

        if (!evidenceProof) {
            setAgreementError(
                "Enter an evidence hash or proof text before submitting the milestone."
            );

            return;
        }

        const evidenceHash =
            makeEvidenceHash(
                evidenceProof
            );

        await runAgreementAction({
            action: () =>
                agreementContract
                    .submitMilestone(
                        agreement.id,
                        milestone.id,
                        evidenceURI,
                        evidenceHash
                    ),

            pendingMessage:
                `Confirm delivery of Milestone #${milestone.id.toString()}.`,

            submittedMessage:
                `Submitting Milestone #${milestone.id.toString()} evidence on-chain...`,

            successMessage:
                `Milestone #${milestone.id.toString()} delivered successfully.`,
        });

        setEvidenceByMilestone(
            (current) => ({
                ...current,
                [key]: {
                    uri: "",
                    proof: "",
                },
            })
        );
    }

    const normalizedAccount =
        account?.toLowerCase() || "";

    const isAgreementContractor =
        Boolean(
            agreement &&
            normalizedAccount &&
            normalizedAccount ===
            agreement.contractor
                .toLowerCase()
        );

    const isAgreementClient =
        Boolean(
            agreement &&
            normalizedAccount &&
            normalizedAccount ===
            agreement.client
                .toLowerCase()
        );

    const agreementStatusText =
        agreement
            ? AGREEMENT_STATUS[
            agreement.status
            ] || "Unknown"
            : "-";

    // =========================================================
    // LEGACY / ONE-OFF ORDER LOGIC
    // =========================================================

    function validateOrderId() {
        const parsedOrderId =
            Number(orderId);

        if (
            !Number.isInteger(parsedOrderId) ||
            parsedOrderId <= 0
        ) {
            throw new Error(
                "Enter a valid order ID greater than zero."
            );
        }

        return parsedOrderId;
    }

    async function loadOrder() {
        try {
            setError("");
            setNotice("");
            setIsLoading(true);

            validateConnection();

            if (!contract) {
                throw new Error(
                    "Payment contract is not ready."
                );
            }

            const parsedOrderId =
                validateOrderId();

            const result =
                await contract.orderById(
                    parsedOrderId
                );

            const exists =
                Boolean(result[7]);

            if (!exists) {
                throw new Error(
                    `Order #${parsedOrderId} does not exist.`
                );
            }

            const tokenAddress =
                result[3];

            const metadata =
                await getAssetMetadata(
                    tokenAddress
                );

            const parsedOrder = {
                id:
                    result[0].toString(),
                buyer:
                    result[1],
                seller:
                    result[2],
                token:
                    tokenAddress,
                amount:
                    result[4],
                formattedAmount:
                    `${ethers.formatUnits(
                        result[4],
                        metadata.decimals
                    )} ${metadata.symbol}`,
                assetSymbol:
                    metadata.symbol,
                paymentType:
                    Number(result[5]),
                status:
                    Number(result[6]),
                exists,
            };

            setOrder(parsedOrder);

            setNotice(
                `Order #${parsedOrder.id} loaded successfully.`
            );
        } catch (loadError) {
            console.error(loadError);

            setOrder(null);

            setError(
                getErrorMessage(loadError)
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function runOrderAction({
        action,
        pendingMessage,
        submittedMessage,
        successMessage,
    }) {
        try {
            setError("");
            setNotice("");
            setIsLoading(true);

            validateConnection();

            if (!order) {
                throw new Error(
                    "Load an order first."
                );
            }

            await executeTransaction({
                action,
                pendingMessage,
                submittedMessage,
                successMessage,
            });

            await loadOrder();

            setNotice(
                successMessage
            );
        } catch (actionError) {
            console.error(actionError);

            setError(
                getErrorMessage(actionError)
            );
        } finally {
            setIsLoading(false);
        }
    }

    const isSeller = Boolean(
        order &&
        normalizedAccount &&
        normalizedAccount ===
        order.seller.toLowerCase()
    );

    const isBuyer = Boolean(
        order &&
        normalizedAccount &&
        normalizedAccount ===
        order.buyer.toLowerCase()
    );

    const isEscrowOrder =
        order?.paymentType === 1;

    const isInEscrow =
        order?.status === 0;

    const canRefund =
        isSeller &&
        isEscrowOrder &&
        isInEscrow;

    const canOpenDispute =
        (isSeller || isBuyer) &&
        isEscrowOrder &&
        isInEscrow;

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="rolePage">
            <div className="pageHeading">
                <div>
                    <span className="eyebrow">
                        Seller / Contractor
                    </span>

                    <h1>
                        Seller workspace
                    </h1>

                    <p>
                        Manage one-off escrow
                        orders and execute
                        programmable Agreement
                        milestones from the same
                        workspace.
                    </p>
                </div>
            </div>

            {/* =================================================
                AGREEMENT WORK
            ================================================= */}

            <section className="sellerOrderPanel">
                <div className="sellerOrderHeader">
                    <div>
                        <span className="eyebrow">
                            Programmable Agreements
                        </span>

                        <h2>
                            Agreement work & milestone delivery
                        </h2>

                        <p>
                            Load an Agreement where
                            your connected wallet is
                            the contractor. Accept the
                            terms, then deliver each
                            funded milestone with
                            verifiable evidence.
                        </p>
                    </div>
                </div>

                <div className="sellerOrderSearch">
                    <div>
                        <label htmlFor="seller-agreement-id">
                            Agreement ID
                        </label>

                        <input
                            id="seller-agreement-id"
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            placeholder="Example: 1"
                            value={
                                agreementId
                            }
                            onChange={(
                                event
                            ) =>
                                setAgreementId(
                                    event.target
                                        .value
                                )
                            }
                            onKeyDown={(
                                event
                            ) => {
                                if (
                                    event.key ===
                                    "Enter"
                                ) {
                                    loadAgreement();
                                }
                            }}
                        />
                    </div>

                    <button
                        type="button"
                        className="primary"
                        onClick={() =>
                            loadAgreement()
                        }
                        disabled={
                            agreementLoading ||
                            !isConnected ||
                            !isCorrectNetwork ||
                            !isAgreementReady
                        }
                    >
                        {agreementLoading
                            ? "Loading..."
                            : "Find Agreement"}
                    </button>
                </div>

                {agreementError && (
                    <div className="paymentFormError">
                        {agreementError}
                    </div>
                )}

                {agreementNotice && (
                    <div className="createdOrderNotice">
                        {agreementNotice}
                    </div>
                )}

                {!agreement && (
                    <div className="emptyState">
                        No Agreement loaded.
                        Enter an Agreement ID
                        to view contractor work.
                    </div>
                )}

                {agreement && (
                    <div className="sellerOrderCard">
                        <div className="sellerOrderTop">
                            <div>
                                <span>
                                    Agreement
                                </span>

                                <h3>
                                    #
                                    {agreement.id.toString()}
                                </h3>
                            </div>

                            <span
                                className={`badge ${agreement.status ===
                                        2
                                        ? "escrow"
                                        : agreement.status ===
                                            3
                                            ? "completed"
                                            : agreement.status ===
                                                4
                                                ? "refunded"
                                                : ""
                                    }`}
                            >
                                {
                                    agreementStatusText
                                }
                            </span>
                        </div>

                        <div className="sellerOrderDetails">
                            <div>
                                <span>
                                    Client
                                </span>

                                <strong>
                                    {shortAddress(
                                        agreement.client
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Contractor
                                </span>

                                <strong>
                                    {shortAddress(
                                        agreement.contractor
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Total
                                </span>

                                <strong>
                                    {ethers.formatUnits(
                                        agreement.totalAmount,
                                        agreementAsset.decimals
                                    )}{" "}
                                    {
                                        agreementAsset.symbol
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Remaining escrow
                                </span>

                                <strong>
                                    {ethers.formatUnits(
                                        agreement.remainingEscrow,
                                        agreementAsset.decimals
                                    )}{" "}
                                    {
                                        agreementAsset.symbol
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Milestones
                                </span>

                                <strong>
                                    {
                                        agreement.milestoneCount
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Your Agreement role
                                </span>

                                <strong>
                                    {isAgreementContractor
                                        ? "Contractor"
                                        : isAgreementClient
                                            ? "Client"
                                            : "Not a participant"}
                                </strong>
                            </div>
                        </div>

                        {!isAgreementContractor && (
                            <div className="sellerAccessWarning">
                                The connected wallet
                                is not the contractor
                                for this Agreement.
                                Contractor actions are
                                unavailable.
                            </div>
                        )}

                        {isAgreementContractor &&
                            agreement.status ===
                            0 && (
                                <div className="sellerOrderActions">
                                    <button
                                        type="button"
                                        className="primary"
                                        disabled={
                                            agreementLoading ||
                                            milestones.length ===
                                            0
                                        }
                                        onClick={() =>
                                            runAgreementAction(
                                                {
                                                    action: () =>
                                                        agreementContract.acceptAgreement(
                                                            agreement.id
                                                        ),
                                                    pendingMessage:
                                                        "Confirm Agreement acceptance in your wallet.",
                                                    submittedMessage:
                                                        "Accepting Agreement on-chain...",
                                                    successMessage:
                                                        `Agreement #${agreement.id.toString()} accepted.`,
                                                }
                                            )
                                        }
                                    >
                                        Accept Agreement
                                    </button>
                                </div>
                            )}

                        {isAgreementContractor &&
                            agreement.status ===
                            1 && (
                                <div className="sellerAccessNotice">
                                    Agreement accepted.
                                    Waiting for the
                                    client to fund the
                                    full escrow before
                                    milestone execution
                                    begins.
                                </div>
                            )}

                        {isAgreementContractor &&
                            agreement.status ===
                            2 && (
                                <>
                                    <div className="sellerAccessNotice">
                                        Agreement is
                                        funded and
                                        active. Pending
                                        milestones can
                                        now be delivered.
                                    </div>

                                    <div className="sellerAgreementMilestones">
                                        {milestones.map(
                                            (
                                                milestone
                                            ) => {
                                                const key =
                                                    milestone.id.toString();

                                                const evidence =
                                                    evidenceByMilestone[
                                                    key
                                                    ] ||
                                                    {};

                                                return (
                                                    <div
                                                        className="sellerOrderCard"
                                                        key={
                                                            key
                                                        }
                                                    >
                                                        <div className="sellerOrderTop">
                                                            <div>
                                                                <span>
                                                                    Milestone
                                                                </span>

                                                                <h3>
                                                                    #
                                                                    {
                                                                        key
                                                                    }
                                                                </h3>
                                                            </div>

                                                            <span
                                                                className={`badge ${milestone.status ===
                                                                        0
                                                                        ? "escrow"
                                                                        : milestone.status ===
                                                                            2
                                                                            ? "disputed"
                                                                            : milestone.status ===
                                                                                3
                                                                                ? "completed"
                                                                                : milestone.status ===
                                                                                    4
                                                                                    ? "refunded"
                                                                                    : ""
                                                                    }`}
                                                            >
                                                                {MILESTONE_STATUS[
                                                                    milestone
                                                                        .status
                                                                ] ||
                                                                    "Unknown"}
                                                            </span>
                                                        </div>

                                                        <div className="sellerOrderDetails">
                                                            <div>
                                                                <span>
                                                                    Amount
                                                                </span>

                                                                <strong>
                                                                    {ethers.formatUnits(
                                                                        milestone.amount,
                                                                        agreementAsset.decimals
                                                                    )}{" "}
                                                                    {
                                                                        agreementAsset.symbol
                                                                    }
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>
                                                                    Specification
                                                                </span>

                                                                <strong>
                                                                    {milestone.metadataURI ||
                                                                        "No URI"}
                                                                </strong>
                                                            </div>
                                                        </div>

                                                        {milestone.status ===
                                                            0 && (
                                                                <>
                                                                    <div className="sellerOrderSearch">
                                                                        <div>
                                                                            <label
                                                                                htmlFor={`evidence-uri-${key}`}
                                                                            >
                                                                                Delivery / evidence URI
                                                                            </label>

                                                                            <input
                                                                                id={`evidence-uri-${key}`}
                                                                                type="text"
                                                                                placeholder="ipfs://... or https://..."
                                                                                value={
                                                                                    evidence.uri ||
                                                                                    ""
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updateEvidenceField(
                                                                                        milestone.id,
                                                                                        "uri",
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                    )
                                                                                }
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="sellerOrderSearch">
                                                                        <div>
                                                                            <label
                                                                                htmlFor={`evidence-proof-${key}`}
                                                                            >
                                                                                Evidence hash or proof text
                                                                            </label>

                                                                            <input
                                                                                id={`evidence-proof-${key}`}
                                                                                type="text"
                                                                                placeholder="0x bytes32, commit hash, checksum, or proof text"
                                                                                value={
                                                                                    evidence.proof ||
                                                                                    ""
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updateEvidenceField(
                                                                                        milestone.id,
                                                                                        "proof",
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                    )
                                                                                }
                                                                            />
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            className="primary"
                                                                            disabled={
                                                                                agreementLoading
                                                                            }
                                                                            onClick={() =>
                                                                                submitMilestone(
                                                                                    milestone
                                                                                )
                                                                            }
                                                                        >
                                                                            Deliver Milestone
                                                                        </button>
                                                                    </div>

                                                                    <div className="sellerAccessNotice">
                                                                        The evidence URI
                                                                        is stored with
                                                                        the milestone.
                                                                        If the second
                                                                        field is not
                                                                        already a
                                                                        bytes32 hash,
                                                                        PAI hashes the
                                                                        entered proof
                                                                        text locally
                                                                        before sending
                                                                        the transaction.
                                                                    </div>
                                                                </>
                                                            )}

                                                        {milestone.status ===
                                                            1 && (
                                                                <div className="createdOrderNotice">
                                                                    Delivered.
                                                                    Waiting for
                                                                    client approval
                                                                    or dispute.
                                                                </div>
                                                            )}

                                                        {milestone.status ===
                                                            2 && (
                                                                <div className="sellerAccessWarning">
                                                                    This milestone
                                                                    is disputed and
                                                                    awaits
                                                                    arbitration.
                                                                </div>
                                                            )}

                                                        {milestone.status ===
                                                            3 && (
                                                                <div className="createdOrderNotice">
                                                                    Milestone
                                                                    released to
                                                                    contractor.
                                                                </div>
                                                            )}

                                                        {milestone.status ===
                                                            4 && (
                                                                <div className="sellerAccessNotice">
                                                                    Milestone
                                                                    refunded to
                                                                    client.
                                                                </div>
                                                            )}

                                                        {milestone.evidenceURI && (
                                                            <div className="sellerAccessNotice">
                                                                Submitted
                                                                evidence:{" "}
                                                                {
                                                                    milestone.evidenceURI
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                </>
                            )}

                        {isAgreementContractor &&
                            agreement.status ===
                            3 && (
                                <div className="createdOrderNotice">
                                    Agreement completed.
                                    All escrow liability
                                    for this Agreement
                                    has been resolved.
                                </div>
                            )}

                        {isAgreementContractor &&
                            agreement.status ===
                            4 && (
                                <div className="sellerAccessNotice">
                                    Agreement cancelled.
                                </div>
                            )}
                    </div>
                )}
            </section>

            {/* =================================================
                ONE-OFF PAYMENT ORDERS
            ================================================= */}

            <section className="sellerOrderPanel">
                <div className="sellerOrderHeader">
                    <div>
                        <span className="eyebrow">
                            One-off payments
                        </span>

                        <h2>
                            Find an incoming order
                        </h2>

                        <p>
                            Enter an order ID to
                            verify whether your
                            connected wallet is
                            recorded as the seller.
                        </p>
                    </div>
                </div>

                <div className="sellerOrderSearch">
                    <div>
                        <label htmlFor="seller-order-id">
                            Order ID
                        </label>

                        <input
                            id="seller-order-id"
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            placeholder="Example: 1"
                            value={orderId}
                            onChange={(event) =>
                                setOrderId(
                                    event.target
                                        .value
                                )
                            }
                        />
                    </div>

                    <button
                        type="button"
                        className="primary"
                        onClick={loadOrder}
                        disabled={
                            isLoading ||
                            !isConnected ||
                            !isCorrectNetwork
                        }
                    >
                        {isLoading
                            ? "Loading..."
                            : "Find order"}
                    </button>
                </div>

                {error && (
                    <div className="paymentFormError">
                        {error}
                    </div>
                )}

                {notice && (
                    <div className="createdOrderNotice">
                        {notice}
                    </div>
                )}

                {!order && (
                    <div className="emptyState">
                        No order loaded.
                        Enter an order ID
                        to view its details.
                    </div>
                )}

                {order && (
                    <div className="sellerOrderCard">
                        <div className="sellerOrderTop">
                            <div>
                                <span>
                                    Order
                                </span>

                                <h3>
                                    #{order.id}
                                </h3>
                            </div>

                            <span
                                className={`badge ${[
                                        "escrow",
                                        "disputed",
                                        "completed",
                                        "refunded",
                                    ][
                                    order
                                        .status
                                    ] || ""
                                    }`}
                            >
                                {ORDER_STATUS[
                                    order.status
                                ] ||
                                    "Unknown"}
                            </span>
                        </div>

                        <div className="sellerOrderDetails">
                            <div>
                                <span>
                                    Buyer
                                </span>

                                <strong>
                                    {shortAddress(
                                        order.buyer
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Seller
                                </span>

                                <strong>
                                    {shortAddress(
                                        order.seller
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Amount
                                </span>

                                <strong>
                                    {
                                        order.formattedAmount
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Asset
                                </span>

                                <strong>
                                    {
                                        order.assetSymbol
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Payment type
                                </span>

                                <strong>
                                    {PAYMENT_TYPE[
                                        order
                                            .paymentType
                                    ] ||
                                        "Unknown"}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Your order role
                                </span>

                                <strong>
                                    {isSeller
                                        ? "Seller"
                                        : isBuyer
                                            ? "Buyer"
                                            : "Not a participant"}
                                </strong>
                            </div>
                        </div>

                        {!isSeller && (
                            <div className="sellerAccessWarning">
                                The connected wallet
                                is not the seller for
                                this order. Seller
                                actions are
                                unavailable.
                            </div>
                        )}

                        {isSeller &&
                            (!isEscrowOrder ||
                                !isInEscrow) && (
                                <div className="sellerAccessNotice">
                                    This order has no
                                    currently available
                                    seller action.
                                </div>
                            )}

                        <div className="sellerOrderActions">
                            {canRefund && (
                                <button
                                    type="button"
                                    className="secondary"
                                    disabled={
                                        isLoading
                                    }
                                    onClick={() =>
                                        runOrderAction(
                                            {
                                                action: () =>
                                                    contract.refund(
                                                        Number(
                                                            order.id
                                                        )
                                                    ),
                                                pendingMessage:
                                                    "Confirm the refund in your wallet.",
                                                submittedMessage:
                                                    `Refund for Order #${order.id} submitted.`,
                                                successMessage:
                                                    `Order #${order.id} refunded successfully.`,
                                            }
                                        )
                                    }
                                >
                                    Refund buyer
                                </button>
                            )}

                            {canOpenDispute && (
                                <button
                                    type="button"
                                    className="danger"
                                    disabled={
                                        isLoading
                                    }
                                    onClick={() =>
                                        runOrderAction(
                                            {
                                                action: () =>
                                                    contract.openDispute(
                                                        Number(
                                                            order.id
                                                        )
                                                    ),
                                                pendingMessage:
                                                    "Confirm the dispute in your wallet.",
                                                submittedMessage:
                                                    `Dispute for Order #${order.id} submitted.`,
                                                successMessage:
                                                    `Dispute opened for Order #${order.id}.`,
                                            }
                                        )
                                    }
                                >
                                    Open dispute
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
