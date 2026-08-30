import { ethers } from "ethers";
import { useState } from "react";

import { useWeb3 } from "../../hooks/useWeb3.js";

import "./AgreementWorkspace.css";

const ERC20_META_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
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

function statusClass(status) {
    switch (Number(status)) {
        case 0:
            return "proposed";

        case 1:
            return "accepted";

        case 2:
            return "active";

        case 3:
            return "completed";

        case 4:
            return "cancelled";

        default:
            return "";
    }
}


function getAgreementLifecycleStage(agreement, milestones) {
    if (!agreement) return -1;
    if (agreement.status === 3) return 4;

    if (agreement.status === 2) {
        const hasDelivery = milestones.some(
            (milestone) => milestone.status !== 0
        );
        return hasDelivery ? 3 : 2;
    }

    if (agreement.status === 1) return 1;
    if (agreement.status === 0) return 0;
    return -1;
}
export default function AgreementWorkspace() {
    const {
        provider,
        account,

        agreementContract,
        isAgreementReady,
        isAgreementPaused,

        executeTransaction,
    } = useWeb3();

    const [assetType, setAssetType] =
        useState("ETH");

    const [contractor, setContractor] =
        useState("");

    const [tokenAddress, setTokenAddress] =
        useState("");

    const [agreementMetadata, setAgreementMetadata] =
        useState("");

    const [agreementIdInput, setAgreementIdInput] =
        useState("");

    const [agreement, setAgreement] =
        useState(null);

    const [milestones, setMilestones] =
        useState([]);

    const [milestoneAmount, setMilestoneAmount] =
        useState("");

    const [
        milestoneMetadata,
        setMilestoneMetadata,
    ] = useState("");

    const [tokenMeta, setTokenMeta] =
        useState({
            symbol: "ETH",
            decimals: 18,
        });

    const [loading, setLoading] =
        useState(false);

    const [localError, setLocalError] =
        useState("");

    const lifecycleStage =
        getAgreementLifecycleStage(
            agreement,
            milestones
        );

    const normalizedAccount =
        account?.toLowerCase() || "";

    const isClient =
        Boolean(
            agreement &&
            normalizedAccount &&
            agreement.client.toLowerCase() ===
            normalizedAccount
        );

    const isContractor =
        Boolean(
            agreement &&
            normalizedAccount &&
            agreement.contractor.toLowerCase() ===
            normalizedAccount
        );

    async function resolveTokenMeta(token) {
        if (
            !token ||
            token === ethers.ZeroAddress
        ) {
            return {
                symbol: "ETH",
                decimals: 18,
            };
        }

        try {
            const tokenContract =
                new ethers.Contract(
                    token,
                    ERC20_META_ABI,
                    provider
                );

            const [
                symbol,
                decimals,
            ] = await Promise.all([
                tokenContract.symbol(),
                tokenContract.decimals(),
            ]);

            return {
                symbol,
                decimals: Number(decimals),
            };
        } catch (error) {
            console.warn(
                "Unable to load token metadata:",
                error
            );

            return {
                symbol: "TOKEN",
                decimals: 18,
            };
        }
    }

    function formatAmount(
        value,
        meta = tokenMeta
    ) {
        try {
            return ethers.formatUnits(
                value,
                meta.decimals
            );
        } catch {
            return value?.toString?.() || "-";
        }
    }

    async function loadAgreement(
        explicitId = null
    ) {
        if (
            !agreementContract ||
            !isAgreementReady
        ) {
            setLocalError(
                "Agreement V1 contract is not ready."
            );

            return;
        }

        const rawId =
            explicitId ??
            agreementIdInput;

        if (
            rawId === null ||
            rawId === undefined ||
            String(rawId).trim() === ""
        ) {
            setLocalError(
                "Enter an Agreement ID."
            );

            return;
        }

        try {
            setLoading(true);
            setLocalError("");

            const agreementId =
                BigInt(
                    String(rawId).trim()
                );

            const raw =
                await agreementContract
                    .agreementById(
                        agreementId
                    );

            if (!raw.exists) {
                throw new Error(
                    `Agreement #${agreementId} does not exist.`
                );
            }

            const meta =
                await resolveTokenMeta(
                    raw.token
                );

            const milestoneCount =
                Number(
                    raw.milestoneCount
                );

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
                                    agreementId,
                                    index + 1
                                )
                    )
                );

            setTokenMeta(meta);

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

                milestoneCount:
                    milestoneCount,

                exists:
                    raw.exists,
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

            setAgreementIdInput(
                agreementId.toString()
            );
        } catch (error) {
            console.error(
                "Load Agreement error:",
                error
            );

            setAgreement(null);

            setMilestones([]);

            setLocalError(
                error?.shortMessage ||
                error?.message ||
                "Unable to load agreement."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateAgreement(
        event
    ) {
        event.preventDefault();

        setLocalError("");

        if (!isAgreementReady) {
            setLocalError(
                "Connect your wallet to the Agreement V1 contract."
            );

            return;
        }

        if (
            !ethers.isAddress(
                contractor
            )
        ) {
            setLocalError(
                "Enter a valid contractor address."
            );

            return;
        }

        let paymentToken =
            ethers.ZeroAddress;

        if (assetType === "ERC20") {
            if (
                !ethers.isAddress(
                    tokenAddress
                ) ||
                tokenAddress ===
                ethers.ZeroAddress
            ) {
                setLocalError(
                    "Enter a valid ERC20 token address."
                );

                return;
            }

            paymentToken =
                ethers.getAddress(
                    tokenAddress
                );
        }

        try {
            const receipt =
                await executeTransaction({
                    action: () =>
                        agreementContract
                            .createAgreement(
                                ethers.getAddress(
                                    contractor
                                ),
                                paymentToken,
                                agreementMetadata.trim()
                            ),

                    pendingMessage:
                        "Confirm Agreement creation in your wallet.",

                    submittedMessage:
                        "Creating Agreement on-chain...",

                    successMessage:
                        "Agreement created.",
                });

            let createdId = null;

            for (
                const log of receipt.logs
            ) {
                try {
                    const parsed =
                        agreementContract
                            .interface
                            .parseLog(log);

                    if (
                        parsed?.name ===
                        "AgreementCreated"
                    ) {
                        createdId =
                            parsed.args
                                .agreementId ??
                            parsed.args[0];

                        break;
                    }
                } catch {
                    // Ignore unrelated logs.
                }
            }

            if (createdId === null) {
                const nextId =
                    await agreementContract
                        .nextAgreementId();

                createdId =
                    nextId - 1n;
            }

            setAgreementIdInput(
                createdId.toString()
            );

            setContractor("");

            setAgreementMetadata("");

            setTokenAddress("");

            await loadAgreement(
                createdId
            );
        } catch (error) {
            setLocalError(
                error?.shortMessage ||
                error?.reason ||
                error?.message ||
                "Agreement creation failed."
            );
        }
    }

    async function handleAddMilestone(
        event
    ) {
        event.preventDefault();

        if (!agreement) {
            return;
        }

        setLocalError("");

        try {
            let parsedAmount;

            if (
                agreement.token ===
                ethers.ZeroAddress
            ) {
                parsedAmount =
                    ethers.parseEther(
                        milestoneAmount
                    );
            } else {
                parsedAmount =
                    ethers.parseUnits(
                        milestoneAmount,
                        tokenMeta.decimals
                    );
            }

            if (parsedAmount <= 0n) {
                throw new Error(
                    "Milestone amount must be greater than zero."
                );
            }

            await executeTransaction({
                action: () =>
                    agreementContract
                        .addMilestone(
                            agreement.id,
                            parsedAmount,
                            milestoneMetadata.trim()
                        ),

                pendingMessage:
                    "Confirm milestone creation.",

                submittedMessage:
                    "Adding milestone on-chain...",

                successMessage:
                    "Milestone added.",
            });

            setMilestoneAmount("");

            setMilestoneMetadata("");

            await loadAgreement(
                agreement.id
            );
        } catch (error) {
            setLocalError(
                error?.shortMessage ||
                error?.reason ||
                error?.message ||
                "Unable to add milestone."
            );
        }
    }

    async function handleAcceptAgreement() {
        if (!agreement) {
            return;
        }

        setLocalError("");

        try {
            await executeTransaction({
                action: () =>
                    agreementContract
                        .acceptAgreement(
                            agreement.id
                        ),

                pendingMessage:
                    "Confirm Agreement acceptance.",

                submittedMessage:
                    "Accepting Agreement on-chain...",

                successMessage:
                    "Agreement accepted.",
            });

            await loadAgreement(
                agreement.id
            );
        } catch (error) {
            setLocalError(
                error?.shortMessage ||
                error?.reason ||
                error?.message ||
                "Unable to accept agreement."
            );
        }
    }


    async function handleFundAgreement() {
        if (!agreement) {
            return;
        }

        setLocalError("");

        if (!isClient) {
            setLocalError(
                "Only the Agreement client can fund this Agreement."
            );

            return;
        }

        if (agreement.status !== 1) {
            setLocalError(
                "Agreement must be Accepted before funding."
            );

            return;
        }

        if (
            agreement.token !==
            ethers.ZeroAddress
        ) {
            setLocalError(
                "This Agreement uses ERC20 funding."
            );

            return;
        }

        try {
            await executeTransaction({
                action: () =>
                    agreementContract
                        .fundAgreementETH(
                            agreement.id,
                            {
                                value:
                                    agreement.totalAmount,
                            }
                        ),

                pendingMessage:
                    `Confirm ${formatAmount(
                        agreement.totalAmount
                    )} ETH funding in your wallet.`,

                submittedMessage:
                    "Funding Agreement escrow...",

                successMessage:
                    "Agreement funded successfully.",
            });

            await loadAgreement(
                agreement.id
            );
        } catch (error) {
            setLocalError(
                error?.shortMessage ||
                error?.reason ||
                error?.message ||
                "Unable to fund Agreement."
            );
        }
    }


    async function handleApproveMilestone(
        milestone
    ) {
        if (!agreement) {
            return;
        }

        setLocalError("");

        if (!isClient) {
            setLocalError(
                "Only the Agreement client can approve a submitted milestone."
            );

            return;
        }

        if (
            agreement.status !== 2 ||
            milestone.status !== 1
        ) {
            setLocalError(
                "Only a Submitted milestone in an Active Agreement can be approved."
            );

            return;
        }

        try {
            await executeTransaction({
                action: () =>
                    agreementContract
                        .approveMilestone(
                            agreement.id,
                            milestone.id
                        ),

                pendingMessage:
                    `Confirm release of ${formatAmount(
                        milestone.amount
                    )} ${tokenMeta.symbol} for Milestone #${milestone.id.toString()}.`,

                submittedMessage:
                    `Releasing Milestone #${milestone.id.toString()}...`,

                successMessage:
                    `Milestone #${milestone.id.toString()} approved and released.`,
            });

            await loadAgreement(
                agreement.id
            );
        } catch (error) {
            setLocalError(
                error?.shortMessage ||
                error?.reason ||
                error?.message ||
                "Unable to approve milestone."
            );
        }
    }

    async function handleOpenMilestoneDispute(
        milestone
    ) {
        if (!agreement) {
            return;
        }

        setLocalError("");

        if (!isClient) {
            setLocalError(
                "Only the Agreement client can use this review control."
            );

            return;
        }

        if (
            agreement.status !== 2 ||
            milestone.status !== 1
        ) {
            setLocalError(
                "Only a Submitted milestone in an Active Agreement can be disputed."
            );

            return;
        }

        try {
            await executeTransaction({
                action: () =>
                    agreementContract
                        .openMilestoneDispute(
                            agreement.id,
                            milestone.id
                        ),

                pendingMessage:
                    `Confirm dispute for Milestone #${milestone.id.toString()}.`,

                submittedMessage:
                    `Opening dispute for Milestone #${milestone.id.toString()}...`,

                successMessage:
                    `Milestone #${milestone.id.toString()} is now disputed.`,
            });

            await loadAgreement(
                agreement.id
            );
        } catch (error) {
            setLocalError(
                error?.shortMessage ||
                error?.reason ||
                error?.message ||
                "Unable to open milestone dispute."
            );
        }
    }

    return (
        <div className="rolePage agreementPage">
            <div className="pageHeading">
                <div>
                    <span className="eyebrow">
                        Agreements / Programmable work
                    </span>

                    <h1>
                        Agreement workspace
                    </h1>

                    <p>
                        Create verifiable agreements,
                        define milestone value and let
                        the counterparty explicitly
                        accept the terms on-chain.
                    </p>
                </div>

                <span
                    className={`agreementProtocolStatus ${isAgreementPaused
                        ? "paused"
                        : ""
                        }`}
                >
                    <span className="healthDot" />

                    {isAgreementPaused
                        ? "AGREEMENTS PAUSED"
                        : "AGREEMENT V1 LIVE"}
                </span>
            </div>

            <section
                className="agreementLifecycle"
                aria-label="Agreement lifecycle"
            >
                {[
                    "Proposed",
                    "Accepted",
                    "Funded",
                    "Delivered",
                    "Completed",
                ].map((label, index) => {
                    const isComplete =
                        lifecycleStage >= index;
                    const isCurrent =
                        lifecycleStage === index;

                    return (
                        <div
                            className={[
                                "agreementLifecycleStep",
                                isComplete ? "complete" : "",
                                isCurrent ? "current" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            key={label}
                        >
                            <span
                                className="agreementLifecycleDot"
                                aria-hidden="true"
                            />
                            <span className="agreementLifecycleLabel">
                                {label}
                            </span>
                        </div>
                    );
                })}
            </section>

            {localError && (
                <div className="agreementError">
                    {localError}
                </div>
            )}

            <div className="agreementWorkspaceGrid">
                <section className="agreementPanel">
                    <div className="agreementPanelHeader">
                        <div>
                            <span className="eyebrow">
                                Client
                            </span>

                            <h2>
                                Create Agreement
                            </h2>
                        </div>

                        <span className="agreementStep">
                            01
                        </span>
                    </div>

                    <form
                        onSubmit={
                            handleCreateAgreement
                        }
                        className="agreementForm"
                    >
                        <label>
                            Contractor wallet

                            <input
                                type="text"
                                placeholder="0x..."
                                value={
                                    contractor
                                }
                                onChange={(
                                    event
                                ) =>
                                    setContractor(
                                        event.target
                                            .value
                                    )
                                }
                            />
                        </label>

                        <label>
                            Payment asset

                            <select
                                value={
                                    assetType
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAssetType(
                                        event.target
                                            .value
                                    )
                                }
                            >
                                <option value="ETH">
                                    ETH
                                </option>

                                <option value="ERC20">
                                    ERC20
                                </option>
                            </select>
                        </label>

                        {assetType ===
                            "ERC20" && (
                                <label>
                                    Approved token address

                                    <input
                                        type="text"
                                        placeholder="0x..."
                                        value={
                                            tokenAddress
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setTokenAddress(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                    />

                                    <small>
                                        Token must already
                                        be approved by the
                                        Agreement protocol
                                        owner.
                                    </small>
                                </label>
                            )}

                        <label>
                            Agreement terms / metadata

                            <input
                                type="text"
                                placeholder="ipfs://..."
                                value={
                                    agreementMetadata
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAgreementMetadata(
                                        event.target
                                            .value
                                    )
                                }
                            />
                        </label>

                        <button
                            type="submit"
                            className="agreementPrimaryButton"
                            disabled={
                                !isAgreementReady ||
                                isAgreementPaused
                            }
                        >
                            Create Agreement
                        </button>
                    </form>
                </section>

                <section className="agreementPanel">
                    <div className="agreementPanelHeader">
                        <div>
                            <span className="eyebrow">
                                On-chain record
                            </span>

                            <h2>
                                Load Agreement
                            </h2>
                        </div>

                        <span className="agreementStep">
                            02
                        </span>
                    </div>

                    <div className="agreementLoadRow">
                        <input
                            type="number"
                            min="1"
                            placeholder="Agreement ID"
                            value={
                                agreementIdInput
                            }
                            onChange={(
                                event
                            ) =>
                                setAgreementIdInput(
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

                        <button
                            type="button"
                            onClick={() =>
                                loadAgreement()
                            }
                            disabled={
                                loading ||
                                !isAgreementReady
                            }
                        >
                            {loading
                                ? "Loading..."
                                : "Load"}
                        </button>
                    </div>

                    {!agreement && (
                        <div className="agreementEmptyState">
                            <strong>
                                No Agreement loaded
                            </strong>

                            <p>
                                Create a new Agreement
                                or enter an existing
                                on-chain Agreement ID.
                            </p>
                        </div>
                    )}

                    {agreement && (
                        <div className="agreementSummary">
                            <div className="agreementIdentityRow">
                                <div>
                                    <span>
                                        Agreement
                                    </span>

                                    <strong className="mono">
                                        #
                                        {agreement.id.toString()}
                                    </strong>
                                </div>

                                <span
                                    className={`agreementStatus ${statusClass(
                                        agreement.status
                                    )}`}
                                >
                                    {
                                        AGREEMENT_STATUS[
                                        agreement
                                            .status
                                        ]
                                    }
                                </span>
                            </div>

                            <div className="agreementFacts">
                                <div>
                                    <span>
                                        Client
                                    </span>

                                    <strong className="mono">
                                        {shortAddress(
                                            agreement.client
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Contractor
                                    </span>

                                    <strong className="mono">
                                        {shortAddress(
                                            agreement.contractor
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Asset
                                    </span>

                                    <strong>
                                        {
                                            tokenMeta.symbol
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Total
                                    </span>

                                    <strong>
                                        {formatAmount(
                                            agreement.totalAmount
                                        )}{" "}
                                        {
                                            tokenMeta.symbol
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Remaining escrow
                                    </span>

                                    <strong>
                                        {formatAmount(
                                            agreement.remainingEscrow
                                        )}{" "}
                                        {
                                            tokenMeta.symbol
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
                                        Your role
                                    </span>

                                    <strong>
                                        {isClient
                                            ? "Client"
                                            : isContractor
                                                ? "Contractor"
                                                : "Observer"}
                                    </strong>
                                </div>
                            </div>

                            {agreement.metadataURI && (
                                <div className="agreementMetadata">
                                    <span>
                                        Agreement metadata
                                    </span>

                                    <code>
                                        {
                                            agreement.metadataURI
                                        }
                                    </code>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {agreement && (
                <section className="agreementMilestoneSection">
                    <div className="agreementSectionHeader">
                        <div>
                            <span className="eyebrow">
                                Agreement #
                                {agreement.id.toString()}
                            </span>

                            <h2>
                                Milestones
                            </h2>
                        </div>

                        <strong>
                            {
                                milestones.length
                            }{" "}
                            defined
                        </strong>
                    </div>

                    {isClient &&
                        agreement.status ===
                        0 && (
                            <form
                                className="agreementMilestoneForm"
                                onSubmit={
                                    handleAddMilestone
                                }
                            >
                                <label>
                                    Amount

                                    <div className="agreementAmountInput">
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            placeholder="0.00"
                                            value={
                                                milestoneAmount
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setMilestoneAmount(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                        />

                                        <span>
                                            {
                                                tokenMeta.symbol
                                            }
                                        </span>
                                    </div>
                                </label>

                                <label>
                                    Milestone specification URI

                                    <input
                                        type="text"
                                        placeholder="ipfs://milestone-specification"
                                        value={
                                            milestoneMetadata
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setMilestoneMetadata(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                    />
                                </label>

                                <button
                                    type="submit"
                                    className="agreementPrimaryButton"
                                >
                                    Add Milestone
                                </button>
                            </form>
                        )}

                    <div className="agreementMilestoneList">
                        {milestones.length ===
                            0 ? (
                            <div className="agreementEmptyState">
                                <strong>
                                    No milestones yet
                                </strong>

                                <p>
                                    The client must add
                                    at least one
                                    milestone before the
                                    contractor can
                                    accept.
                                </p>
                            </div>
                        ) : (
                            milestones.map(
                                (milestone) => (
                                    <article
                                        className="agreementMilestoneCard"
                                        key={milestone.id.toString()}
                                    >
                                        <div className="agreementMilestoneIndex">
                                            {String(
                                                milestone.id
                                            ).padStart(
                                                2,
                                                "0"
                                            )}
                                        </div>

                                        <div className="agreementMilestoneBody">
                                            <div className="agreementMilestoneHeading">
                                                <div>
                                                    <span>
                                                        Milestone{" "}
                                                        #
                                                        {milestone.id.toString()}
                                                    </span>

                                                    <strong>
                                                        {formatAmount(
                                                            milestone.amount
                                                        )}{" "}
                                                        {
                                                            tokenMeta.symbol
                                                        }
                                                    </strong>
                                                </div>

                                                <span
                                                    className={`milestoneStatus milestone-${milestone.status}`}
                                                >
                                                    {
                                                        MILESTONE_STATUS[
                                                        milestone
                                                            .status
                                                        ]
                                                    }
                                                </span>
                                            </div>

                                            <code>
                                                {milestone.metadataURI ||
                                                    "No metadata URI"}
                                            </code>

                                            {milestone.evidenceURI && (
                                                <div className="agreementMetadata">
                                                    <span>
                                                        Submitted evidence
                                                    </span>

                                                    <code>
                                                        {
                                                            milestone.evidenceURI
                                                        }
                                                    </code>
                                                </div>
                                            )}

                                            {milestone.evidenceHash &&
                                                milestone.evidenceHash !==
                                                ethers.ZeroHash && (
                                                    <div className="agreementMetadata">
                                                        <span>
                                                            Evidence hash
                                                        </span>

                                                        <code>
                                                            {
                                                                milestone.evidenceHash
                                                            }
                                                        </code>
                                                    </div>
                                                )}

                                            {isClient &&
                                                agreement.status ===
                                                2 &&
                                                milestone.status ===
                                                1 && (
                                                    <div className="agreementAcceptanceBox">
                                                        <div>
                                                            <span className="eyebrow">
                                                                Client review
                                                            </span>

                                                            <h3>
                                                                Review submitted milestone
                                                            </h3>

                                                            <p>
                                                                Approving releases only this
                                                                milestone amount to the
                                                                contractor. Opening a dispute
                                                                moves this milestone to
                                                                arbitration instead.
                                                            </p>
                                                        </div>

                                                        <div className="agreementMilestoneForm">
                                                            <button
                                                                type="button"
                                                                className="agreementPrimaryButton"
                                                                disabled={
                                                                    loading
                                                                }
                                                                onClick={() =>
                                                                    handleApproveMilestone(
                                                                        milestone
                                                                    )
                                                                }
                                                            >
                                                                Approve & Release{" "}
                                                                {formatAmount(
                                                                    milestone.amount
                                                                )}{" "}
                                                                {
                                                                    tokenMeta.symbol
                                                                }
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="agreementAcceptButton"
                                                                disabled={
                                                                    loading
                                                                }
                                                                onClick={() =>
                                                                    handleOpenMilestoneDispute(
                                                                        milestone
                                                                    )
                                                                }
                                                            >
                                                                Open Dispute
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                            {milestone.status ===
                                                2 && (
                                                    <div className="agreementWaitingNotice">
                                                        Milestone is disputed and
                                                        waiting for arbitration.
                                                    </div>
                                                )}

                                            {milestone.status ===
                                                3 && (
                                                    <div className="agreementAcceptedNotice">
                                                        Milestone approved and
                                                        released to the contractor.
                                                    </div>
                                                )}

                                            {milestone.status ===
                                                4 && (
                                                    <div className="agreementWaitingNotice">
                                                        Milestone refunded to the
                                                        client.
                                                    </div>
                                                )}
                                        </div>
                                    </article>
                                )
                            )
                        )}
                    </div>

                    {agreement.status ===
                        0 &&
                        isContractor && (
                            <div className="agreementAcceptanceBox">
                                <div>
                                    <span className="eyebrow">
                                        Counterparty
                                        approval
                                    </span>

                                    <h3>
                                        Accept Agreement
                                    </h3>

                                    <p>
                                        Acceptance locks
                                        the defined
                                        milestones and
                                        confirms these
                                        terms from your
                                        wallet.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="agreementAcceptButton"
                                    disabled={
                                        milestones.length ===
                                        0
                                    }
                                    onClick={
                                        handleAcceptAgreement
                                    }
                                >
                                    Accept Agreement
                                </button>
                            </div>
                        )}

                    {agreement.status ===
                        0 &&
                        !isContractor && (
                            <div className="agreementWaitingNotice">
                                Waiting for contractor{" "}
                                <strong className="mono">
                                    {shortAddress(
                                        agreement.contractor
                                    )}
                                </strong>{" "}
                                to accept the Agreement.
                            </div>
                        )}

                    {agreement.status ===
                        1 &&
                        isClient &&
                        agreement.token ===
                        ethers.ZeroAddress && (
                            <div className="agreementAcceptanceBox">
                                <div>
                                    <span className="eyebrow">
                                        Escrow funding
                                    </span>

                                    <h3>
                                        Fund Agreement
                                    </h3>

                                    <p>
                                        The contractor accepted
                                        the terms. Lock the full
                                        Agreement value in PAI
                                        escrow to activate the
                                        milestone lifecycle.
                                    </p>

                                    <p>
                                        Required funding:{" "}
                                        <strong>
                                            {formatAmount(
                                                agreement.totalAmount
                                            )}{" "}
                                            ETH
                                        </strong>
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="agreementPrimaryButton"
                                    disabled={
                                        isAgreementPaused
                                    }
                                    onClick={
                                        handleFundAgreement
                                    }
                                >
                                    Fund{" "}
                                    {formatAmount(
                                        agreement.totalAmount
                                    )}{" "}
                                    ETH
                                </button>
                            </div>
                        )}

                    {agreement.status ===
                        1 &&
                        isClient &&
                        agreement.token !==
                        ethers.ZeroAddress && (
                            <div className="agreementAcceptedNotice">
                                Agreement accepted. ERC20
                                funding controls are the next
                                step for this Agreement.
                            </div>
                        )}

                    {agreement.status ===
                        1 &&
                        !isClient && (
                            <div className="agreementAcceptedNotice">
                                Agreement accepted. Waiting
                                for the client{" "}
                                <strong className="mono">
                                    {shortAddress(
                                        agreement.client
                                    )}
                                </strong>{" "}
                                to fund the escrow.
                            </div>
                        )}

                    {agreement.status ===
                        2 &&
                        isClient && (
                            <div className="agreementAcceptedNotice">
                                Agreement funded and active.
                                Submitted milestones can be
                                approved for release or moved
                                into dispute from the milestone
                                cards above.
                            </div>
                        )}

                    {agreement.status ===
                        2 &&
                        isContractor && (
                            <div className="agreementAcceptedNotice">
                                Agreement funded and active.
                                Deliver milestone work from the
                                Seller workspace.
                            </div>
                        )}

                    {agreement.status ===
                        2 &&
                        !isClient &&
                        !isContractor && (
                            <div className="agreementAcceptedNotice">
                                Agreement funded and active.
                            </div>
                        )}

                    {agreement.status ===
                        3 && (
                            <div className="agreementAcceptedNotice">
                                Agreement completed. All
                                milestone escrow has been
                                resolved.
                            </div>
                        )}
                </section>
            )}
        </div>
    );
}
