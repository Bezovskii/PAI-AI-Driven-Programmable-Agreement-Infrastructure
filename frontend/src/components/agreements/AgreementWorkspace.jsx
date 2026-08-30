import {
    useCallback,
    useMemo,
    useState,
} from "react";

import { ethers } from "ethers";

import {
    paiAgreementApi,
} from "../../agreements/paiAgreementApi.js";

import {
    createEsctSettlementClient,
} from "../../settlement/esctSettlementAdapter.js";

import {
    findPaiSettlementBinding,
    getExternalAgreementId,
    getExternalMilestoneId,
    paiSettlementBindingApi,
} from "../../settlement/paiSettlementBindingApi.js";

import {
    useWeb3,
} from "../../hooks/useWeb3.js";

import "./AgreementWorkspace.css";


function errorMessage(
    error,
    fallback
) {
    return (
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        fallback
    );
}


function partyForRole(
    agreement,
    role
) {
    return (
        agreement?.parties?.find(
            (party) =>
                party.role === role
        ) || null
    );
}


function normalizeAddress(
    value
) {
    return (
        typeof value === "string"
            ? value.toLowerCase()
            : ""
    );
}


function calculateEthFundingValue(
    agreement
) {
    const milestones =
        agreement?.milestones || [];

    if (
        milestones.length === 0
    ) {
        throw new Error(
            "Agreement has no milestones to fund."
        );
    }

    let total =
        0n;

    for (
        const milestone
        of milestones
    ) {
        const asset =
            milestone.asset
                ?.trim()
                .toUpperCase();

        if (
            asset !== "ETH"
        ) {
            throw new Error(
                "Current ESCT funding adapter supports ETH milestones only."
            );
        }

        if (
            !milestone.amount
        ) {
            throw new Error(
                `Milestone ${milestone.position} has no funding amount.`
            );
        }

        total +=
            ethers.parseEther(
                milestone.amount
            );
    }

    if (
        total <= 0n
    ) {
        throw new Error(
            "Agreement funding amount must be greater than zero."
        );
    }

    return total;
}


export default function AgreementWorkspace() {
    const {
        account,
        chainId,
        esctSettlementContract,
        executeTransaction,
    } = useWeb3();

    const [
        agreementIdInput,
        setAgreementIdInput,
    ] = useState("");

    const [
        agreement,
        setAgreement,
    ] = useState(null);

    const [
        settlementBindings,
        setSettlementBindings,
    ] = useState([]);

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        localError,
        setLocalError,
    ] = useState("");

    const [
        notice,
        setNotice,
    ] = useState("");

    const [
        contractorWalletAddress,
        setContractorWalletAddress,
    ] = useState("");

    const [
        agreementTitle,
        setAgreementTitle,
    ] = useState("");

    const [
        agreementMetadataUri,
        setAgreementMetadataUri,
    ] = useState("");

    const [
        agreementTermsHash,
        setAgreementTermsHash,
    ] = useState("");

    const [
        milestoneTitle,
        setMilestoneTitle,
    ] = useState("");

    const [
        milestoneSpecificationUri,
        setMilestoneSpecificationUri,
    ] = useState("");

    const [
        milestoneAmount,
        setMilestoneAmount,
    ] = useState("");

    const [
        milestoneAsset,
        setMilestoneAsset,
    ] = useState("ETH");

    const [
        evidenceByMilestone,
        setEvidenceByMilestone,
    ] = useState({});


    const esctSettlementClient =
        useMemo(
            () =>
                createEsctSettlementClient(
                    esctSettlementContract
                ),
            [
                esctSettlementContract,
            ]
        );


    const settlementContractAddress =
        useMemo(
            () => {
                const value =
                    esctSettlementContract?.target ||
                    esctSettlementContract?.address;

                return (
                    typeof value === "string"
                        ? value
                        : ""
                );
            },
            [
                esctSettlementContract,
            ]
        );


    const settlementBinding =
        useMemo(
            () =>
                findPaiSettlementBinding(
                    settlementBindings,
                    {
                        provider:
                            "esct",

                        chainId,

                        contractAddress:
                            settlementContractAddress ||
                            undefined,
                    }
                ),
            [
                settlementBindings,
                chainId,
                settlementContractAddress,
            ]
        );


    const externalAgreementId =
        getExternalAgreementId(
            settlementBinding
        );


    const clientParty =
        partyForRole(
            agreement,
            "CLIENT"
        );

    const contractorParty =
        partyForRole(
            agreement,
            "CONTRACTOR"
        );


    const normalizedAccount =
        normalizeAddress(
            account
        );

    const isClient =
        Boolean(
            normalizedAccount &&
            normalizeAddress(
                clientParty?.walletAddress
            ) ===
                normalizedAccount
        );

    const isContractor =
        Boolean(
            normalizedAccount &&
            normalizeAddress(
                contractorParty?.walletAddress
            ) ===
                normalizedAccount
        );


    const settlementReady =
        Boolean(
            esctSettlementClient &&
            settlementBinding &&
            externalAgreementId
        );


    const loadAgreement =
        useCallback(
            async (
                requestedAgreementId
            ) => {
                const agreementId =
                    String(
                        requestedAgreementId || ""
                    ).trim();

                if (
                    !agreementId
                ) {
                    throw new Error(
                        "Enter a PAI agreement ID."
                    );
                }

                setLoading(true);
                setLocalError("");
                setNotice("");

                try {
                    const [
                        loadedAgreement,
                        loadedBindings,
                    ] =
                        await Promise.all([
                            paiAgreementApi
                                .getAgreement(
                                    agreementId
                                ),

                            paiSettlementBindingApi
                                .getAgreementBindings(
                                    agreementId
                                ),
                        ]);

                    setAgreement(
                        loadedAgreement
                    );

                    setSettlementBindings(
                        loadedBindings
                    );

                    setAgreementIdInput(
                        agreementId
                    );
                } finally {
                    setLoading(false);
                }
            },
            []
        );


    async function handleLoadAgreement(
        event
    ) {
        event.preventDefault();

        try {
            await loadAgreement(
                agreementIdInput
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to load PAI agreement."
                )
            );
        }
    }


    async function handleCreateAgreement(
        event
    ) {
        event.preventDefault();

        setLocalError("");
        setNotice("");

        const contractor =
            contractorWalletAddress.trim();

        if (
            !ethers.isAddress(
                contractor
            )
        ) {
            setLocalError(
                "Enter a valid contractor wallet address."
            );

            return;
        }

        try {
            setLoading(true);

            const result =
                await paiAgreementApi
                    .createAgreement({
                        contractorWalletAddress:
                            contractor,

                        title:
                            agreementTitle.trim() ||
                            undefined,

                        metadataUri:
                            agreementMetadataUri.trim() ||
                            undefined,

                        termsHash:
                            agreementTermsHash.trim() ||
                            undefined,
                    });

            setContractorWalletAddress("");
            setAgreementTitle("");
            setAgreementMetadataUri("");
            setAgreementTermsHash("");

            setNotice(
                "PAI agreement created."
            );

            await loadAgreement(
                result.id
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to create PAI agreement."
                )
            );
        } finally {
            setLoading(false);
        }
    }


    async function handleAddMilestone(
        event
    ) {
        event.preventDefault();

        if (
            !agreement
        ) {
            return;
        }

        setLocalError("");
        setNotice("");

        try {
            setLoading(true);

            await paiAgreementApi
                .addMilestone(
                    agreement.id,
                    {
                        title:
                            milestoneTitle.trim() ||
                            undefined,

                        specificationUri:
                            milestoneSpecificationUri.trim() ||
                            undefined,

                        amount:
                            milestoneAmount.trim() ||
                            undefined,

                        asset:
                            milestoneAsset.trim() ||
                            undefined,
                    }
                );

            setMilestoneTitle("");
            setMilestoneSpecificationUri("");
            setMilestoneAmount("");

            await loadAgreement(
                agreement.id
            );

            setNotice(
                "PAI milestone added."
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to add PAI milestone."
                )
            );
        } finally {
            setLoading(false);
        }
    }


    async function handleProposeAgreement() {
        if (
            !agreement
        ) {
            return;
        }

        try {
            setLoading(true);
            setLocalError("");

            await paiAgreementApi
                .proposeAgreement(
                    agreement.id
                );

            await loadAgreement(
                agreement.id
            );

            setNotice(
                "Agreement proposed."
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to propose agreement."
                )
            );
        } finally {
            setLoading(false);
        }
    }


    async function handleAcceptAgreement() {
        if (
            !agreement
        ) {
            return;
        }

        try {
            setLoading(true);
            setLocalError("");

            await paiAgreementApi
                .acceptAgreement(
                    agreement.id
                );

            await loadAgreement(
                agreement.id
            );

            setNotice(
                "Agreement accepted in PAI."
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to accept agreement."
                )
            );
        } finally {
            setLoading(false);
        }
    }


    function updateEvidence(
        milestoneId,
        field,
        value
    ) {
        setEvidenceByMilestone(
            (current) => ({
                ...current,

                [milestoneId]: {
                    ...(current[
                        milestoneId
                    ] || {}),

                    [field]:
                        value,
                },
            })
        );
    }


    async function handleSubmitEvidence(
        milestone
    ) {
        const evidence =
            evidenceByMilestone[
                milestone.id
            ] || {};

        const uri =
            evidence.uri?.trim() ||
            "";

        const hash =
            evidence.hash?.trim() ||
            "";

        if (
            !uri
        ) {
            setLocalError(
                "Evidence URI is required."
            );

            return;
        }

        try {
            setLoading(true);
            setLocalError("");

            await paiAgreementApi
                .submitEvidence(
                    agreement.id,
                    milestone.id,
                    {
                        uri,

                        hash:
                            hash ||
                            undefined,
                    }
                );

            setEvidenceByMilestone(
                (current) => ({
                    ...current,

                    [milestone.id]: {
                        uri:
                            "",

                        hash:
                            "",
                    },
                })
            );

            await loadAgreement(
                agreement.id
            );

            setNotice(
                "Evidence submitted to PAI."
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to submit milestone evidence."
                )
            );
        } finally {
            setLoading(false);
        }
    }


    function requireSettlementContext(
        milestone
    ) {
        if (
            !esctSettlementClient
        ) {
            throw new Error(
                "ESCT settlement transport is not connected."
            );
        }

        if (
            !settlementBinding
        ) {
            throw new Error(
                "This PAI agreement has no ESCT settlement binding for the connected chain and contract."
            );
        }

        if (
            !externalAgreementId
        ) {
            throw new Error(
                "Settlement binding has no external agreement ID."
            );
        }

        if (
            !milestone
        ) {
            return {
                externalAgreementId,
            };
        }

        const externalMilestoneId =
            getExternalMilestoneId(
                settlementBinding,
                milestone.id
            );

        if (
            !externalMilestoneId
        ) {
            throw new Error(
                `Milestone ${milestone.position} has no external settlement mapping.`
            );
        }

        return {
            externalAgreementId,
            externalMilestoneId,
        };
    }


    async function handleFundAgreement() {
        if (
            !agreement
        ) {
            return;
        }

        try {
            const {
                externalAgreementId:
                    boundAgreementId,
            } =
                requireSettlementContext();

            const value =
                calculateEthFundingValue(
                    agreement
                );

            setLocalError("");

            await executeTransaction({
                action: () =>
                    esctSettlementClient
                        .fundAgreementETH(
                            boundAgreementId,
                            {
                                value,
                            }
                        ),

                pendingMessage:
                    `Confirm ${ethers.formatEther(
                        value
                    )} ETH settlement funding.`,

                submittedMessage:
                    "Funding ESCT settlement...",

                successMessage:
                    "Settlement funded.",
            });

            setNotice(
                "ESCT settlement funded."
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to fund settlement."
                )
            );
        }
    }


    async function handleReleaseMilestone(
        milestone
    ) {
        try {
            const {
                externalAgreementId:
                    boundAgreementId,

                externalMilestoneId:
                    boundMilestoneId,
            } =
                requireSettlementContext(
                    milestone
                );

            setLocalError("");

            await executeTransaction({
                action: () =>
                    esctSettlementClient
                        .releaseMilestone(
                            boundAgreementId,
                            boundMilestoneId
                        ),

                pendingMessage:
                    `Confirm release for Milestone ${milestone.position}.`,

                submittedMessage:
                    "Releasing ESCT milestone...",

                successMessage:
                    "Settlement milestone released.",
            });

            setNotice(
                "ESCT milestone released."
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to release settlement milestone."
                )
            );
        }
    }


    async function handleOpenDispute(
        milestone
    ) {
        try {
            const {
                externalAgreementId:
                    boundAgreementId,

                externalMilestoneId:
                    boundMilestoneId,
            } =
                requireSettlementContext(
                    milestone
                );

            setLocalError("");

            await executeTransaction({
                action: () =>
                    esctSettlementClient
                        .openMilestoneDispute(
                            boundAgreementId,
                            boundMilestoneId
                        ),

                pendingMessage:
                    `Confirm settlement dispute for Milestone ${milestone.position}.`,

                submittedMessage:
                    "Opening ESCT dispute...",

                successMessage:
                    "Settlement dispute opened.",
            });

            setNotice(
                "ESCT dispute opened."
            );
        } catch (error) {
            setLocalError(
                errorMessage(
                    error,
                    "Unable to open settlement dispute."
                )
            );
        }
    }


    return (
        <div className="rolePage agreementPage">
            <div className="pageHeading">
                <div>
                    <span className="eyebrow">
                        PAI / Programmable Agreements
                    </span>

                    <h1>
                        Agreement workspace
                    </h1>

                    <p>
                        PAI owns agreement terms,
                        milestones, acceptance,
                        evidence and lifecycle.
                        ESCT is used only through an
                        explicit settlement binding.
                    </p>
                </div>
            </div>

            {localError && (
                <div className="agreementError">
                    {localError}
                </div>
            )}

            {notice && (
                <div className="agreementAcceptedNotice">
                    {notice}
                </div>
            )}

            <section className="agreementCard">
                <h2>
                    Open PAI agreement
                </h2>

                <form
                    onSubmit={
                        handleLoadAgreement
                    }
                >
                    <input
                        type="text"
                        value={
                            agreementIdInput
                        }
                        onChange={
                            (event) =>
                                setAgreementIdInput(
                                    event.target.value
                                )
                        }
                        placeholder="PAI agreement ID"
                    />

                    <button
                        type="submit"
                        className="agreementPrimaryButton"
                        disabled={
                            loading
                        }
                    >
                        Load Agreement
                    </button>
                </form>
            </section>

            <section className="agreementCard">
                <h2>
                    Create agreement
                </h2>

                <form
                    onSubmit={
                        handleCreateAgreement
                    }
                >
                    <input
                        type="text"
                        value={
                            contractorWalletAddress
                        }
                        onChange={
                            (event) =>
                                setAgreementMetadataUri(
                                    event.target.value
                                )
                        }
                        placeholder="Metadata URI"
                    />

                    <input
                        type="text"
                        value={
                            agreementTermsHash
                        }
                        onChange={
                            (event) =>
                                setAgreementTermsHash(
                                    event.target.value
                                )
                        }
                        placeholder="Terms hash"
                    />

                    <button
                        type="submit"
                        className="agreementPrimaryButton"
                        disabled={
                            loading
                        }
                    >
                        Create PAI Agreement
                    </button>
                </form>
            </section>

            {agreement && (
                <>
                    <section className="agreementCard">
                        <span className="eyebrow">
                            PAI Agreement
                        </span>

                        <h2>
                            {agreement.title ||
                                "Untitled agreement"}
                        </h2>

                        <p className="mono">
                            {agreement.id}
                        </p>

                        <p>
                            Status:{" "}
                            <strong>
                                {agreement.status}
                            </strong>
                        </p>

                        <p>
                            Client:{" "}
                            <span className="mono">
                                {clientParty
                                    ?.walletAddress ||
                                    "-"}
                            </span>
                        </p>

                        <p>
                            Contractor:{" "}
                            <span className="mono">
                                {contractorParty
                                    ?.walletAddress ||
                                    "-"}
                            </span>
                        </p>

                        <p>
                            Settlement:{" "}
                            <strong>
                                {settlementReady
                                    ? `linked as ${externalAgreementId}`
                                    : "not linked for this chain"}
                            </strong>
                        </p>

                        {isClient &&
                            agreement.status ===
                                "DRAFT" && (
                                <button
                                    type="button"
                                    className="agreementPrimaryButton"
                                    disabled={
                                        loading
                                    }
                                    onClick={
                                        handleProposeAgreement
                                    }
                                >
                                    Propose Agreement
                                </button>
                            )}

                        {isContractor &&
                            agreement.status ===
                                "PROPOSED" && (
                                <button
                                    type="button"
                                    className="agreementPrimaryButton"
                                    disabled={
                                        loading
                                    }
                                    onClick={
                                        handleAcceptAgreement
                                    }
                                >
                                    Accept Agreement
                                </button>
                            )}

                        {isClient &&
                            agreement.status ===
                                "ACCEPTED" && (
                                <button
                                    type="button"
                                    className="agreementPrimaryButton"
                                    disabled={
                                        loading ||
                                        !settlementReady
                                    }
                                    onClick={
                                        handleFundAgreement
                                    }
                                >
                                    Fund Linked ESCT Settlement
                                </button>
                            )}
                    </section>

                    {isClient &&
                        agreement.status ===
                            "DRAFT" && (
                            <section className="agreementCard">
                                <h2>
                                    Add milestone
                                </h2>

                                <form
                                    onSubmit={
                                        handleAddMilestone
                                    }
                                >
                                    <input
                                        value={
                                            milestoneTitle
                                        }
                                        onChange={
                                            (event) =>
                                                setMilestoneTitle(
                                                    event.target.value
                                                )
                                        }
                                        placeholder="Milestone title"
                                    />

                                    <input
                                        value={
                                            milestoneSpecificationUri
                                        }
                                        onChange={
                                            (event) =>
                                                setMilestoneSpecificationUri(
                                                    event.target.value
                                                )
                                        }
                                        placeholder="Specification URI"
                                    />

                                    <input
                                        value={
                                            milestoneAmount
                                        }
                                        onChange={
                                            (event) =>
                                                setMilestoneAmount(
                                                    event.target.value
                                                )
                                        }
                                        placeholder="Amount"
                                    />

                                    <input
                                        value={
                                            milestoneAsset
                                        }
                                        onChange={
                                            (event) =>
                                                setMilestoneAsset(
                                                    event.target.value
                                                )
                                        }
                                        placeholder="Asset, e.g. ETH"
                                    />

                                    <button
                                        type="submit"
                                        className="agreementPrimaryButton"
                                        disabled={
                                            loading
                                        }
                                    >
                                        Add PAI Milestone
                                    </button>
                                </form>
                            </section>
                        )}

                    <section className="agreementCard">
                        <h2>
                            Milestones
                        </h2>

                        {agreement.milestones
                            ?.length ===
                        0 ? (
                            <p>
                                No milestones yet.
                            </p>
                        ) : (
                            agreement.milestones
                                ?.map(
                                    (
                                        milestone
                                    ) => {
                                        const externalMilestoneId =
                                            getExternalMilestoneId(
                                                settlementBinding,
                                                milestone.id
                                            );

                                        return (
                                            <div
                                                key={
                                                    milestone.id
                                                }
                                                className="agreementMilestoneCard"
                                            >
                                                <h3>
                                                    Milestone{" "}
                                                    {milestone.position}
                                                    {milestone.title
                                                        ? ` — ${milestone.title}`
                                                        : ""}
                                                </h3>

                                                <p>
                                                    PAI status:{" "}
                                                    <strong>
                                                        {milestone.status}
                                                    </strong>
                                                </p>

                                                <p>
                                                    Amount:{" "}
                                                    {milestone.amount ||
                                                        "-"}{" "}
                                                    {milestone.asset ||
                                                        ""}
                                                </p>

                                                <p>
                                                    Settlement ID:{" "}
                                                    <span className="mono">
                                                        {externalMilestoneId ||
                                                            "not linked"}
                                                    </span>
                                                </p>

                                                {isContractor &&
                                                    (
                                                        agreement.status ===
                                                            "ACCEPTED" ||
                                                        agreement.status ===
                                                            "IN_PROGRESS"
                                                    ) &&
                                                    (
                                                        milestone.status ===
                                                            "PENDING" ||
                                                        milestone.status ===
                                                            "REVISION_REQUESTED"
                                                    ) && (
                                                        <div>
                                                            <input
                                                                value={
                                                                    evidenceByMilestone[
                                                                        milestone.id
                                                                    ]?.uri ||
                                                                    ""
                                                                }
                                                                onChange={
                                                                    (event) =>
                                                                        updateEvidence(
                                                                            milestone.id,
                                                                            "uri",
                                                                            event.target.value
                                                                        )
                                                                }
                                                                placeholder="Evidence URI"
                                                            />

                                                            <input
                                                                value={
                                                                    evidenceByMilestone[
                                                                        milestone.id
                                                                    ]?.hash ||
                                                                    ""
                                                                }
                                                                onChange={
                                                                    (event) =>
                                                                        updateEvidence(
                                                                            milestone.id,
                                                                            "hash",
                                                                            event.target.value
                                                                        )
                                                                }
                                                                placeholder="Evidence hash"
                                                            />

                                                            <button
                                                                type="button"
                                                                className="agreementPrimaryButton"
                                                                disabled={
                                                                    loading
                                                                }
                                                                onClick={
                                                                    () =>
                                                                        handleSubmitEvidence(
                                                                            milestone
                                                                        )
                                                                }
                                                            >
                                                                Submit Evidence to PAI
                                                            </button>
                                                        </div>
                                                    )}

                                                {isClient &&
                                                    milestone.status ===
                                                        "SUBMITTED" && (
                                                        <div>
                                                            <button
                                                                type="button"
                                                                className="agreementPrimaryButton"
                                                                disabled={
                                                                    loading ||
                                                                    !settlementReady ||
                                                                    !externalMilestoneId
                                                                }
                                                                onClick={
                                                                    () =>
                                                                        handleReleaseMilestone(
                                                                            milestone
                                                                        )
                                                                }
                                                            >
                                                                Release Linked Settlement
                                                            </button>

                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    loading ||
                                                                    !settlementReady ||
                                                                    !externalMilestoneId
                                                                }
                                                                onClick={
                                                                    () =>
                                                                        handleOpenDispute(
                                                                            milestone
                                                                        )
                                                                }
                                                            >
                                                                Open ESCT Dispute
                                                            </button>
                                                        </div>
                                                    )}

                                                {milestone.evidence
                                                    ?.map(
                                                        (
                                                            evidence
                                                        ) => (
                                                            <div
                                                                key={
                                                                    evidence.id
                                                                }
                                                            >
                                                                <span className="mono">
                                                                    {evidence.uri}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                            </div>
                                        );
                                    }
                                )
                        )}
                    </section>
                </>
            )}
        </div>
    );
}