import { ethers } from "ethers";
import {
    useCallback,
    useEffect,
    useState,
} from "react";

import { useWeb3 } from "../../hooks/useWeb3.js";
import "./AdminPanel.css";

const ERC20_METADATA_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

function shortAddress(address) {
    if (!address || address === ethers.ZeroAddress) {
        return "None";
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

export default function AdminPanel() {
    const {
        account,
        provider,
        contract,
        owner,
        arbitrator,
        isPaused,
        isConnected,
        isCorrectNetwork,
        isOwner,
        executeTransaction,
        refreshProtocolState,
    } = useWeb3();

    const [pendingArbitrator, setPendingArbitrator] =
        useState(ethers.ZeroAddress);

    const [ethLiability, setEthLiability] =
        useState(0n);

    const [ethSolvent, setEthSolvent] =
        useState(false);

    const [newArbitrator, setNewArbitrator] =
        useState("");

    const [tokenAddress, setTokenAddress] =
        useState("");

    const [tokenInfo, setTokenInfo] =
        useState(null);

    const [isLoading, setIsLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [notice, setNotice] =
        useState("");

    const validateConnection = useCallback(() => {
        if (!isConnected || !contract || !provider) {
            throw new Error(
                "Connect your wallet first."
            );
        }

        if (!isCorrectNetwork) {
            throw new Error(
                "Switch your wallet to the expected network."
            );
        }
    }, [
        isConnected,
        contract,
        provider,
        isCorrectNetwork,
    ]);

    const validateOwner = useCallback(() => {
        validateConnection();

        if (!isOwner) {
            throw new Error(
                "The connected wallet is not the protocol owner."
            );
        }
    }, [
        validateConnection,
        isOwner,
    ]);

    const loadProtocolData = useCallback(
        async () => {
            if (!contract) {
                return;
            }

            const [
                pending,
                liability,
                solvent,
            ] = await Promise.all([
                contract.pendingArbitrator(),
                contract.totalEscrowedETH(),
                contract.isSolvent(
                    ethers.ZeroAddress
                ),
            ]);

            setPendingArbitrator(pending);
            setEthLiability(liability);
            setEthSolvent(Boolean(solvent));
        },
        [contract]
    );

    useEffect(() => {
        if (!contract) {
            return;
        }

        loadProtocolData().catch(
            (loadError) => {
                console.error(
                    "Admin protocol load failed:",
                    loadError
                );
            }
        );
    }, [
        contract,
        loadProtocolData,
    ]);

    async function runAdminAction({
        action,
        pendingMessage,
        submittedMessage,
        successMessage,
        afterSuccess,
    }) {
        try {
            setError("");
            setNotice("");
            setIsLoading(true);

            validateOwner();

            await executeTransaction({
                action,
                pendingMessage,
                submittedMessage,
                successMessage,
            });

            await refreshProtocolState();
            await loadProtocolData();

            if (afterSuccess) {
                await afterSuccess();
            }

            setNotice(successMessage);
        } catch (actionError) {
            console.error(actionError);

            setError(
                getErrorMessage(actionError)
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchTokenInformation(
        address
    ) {
        validateConnection();

        if (
            !ethers.isAddress(address) ||
            address === ethers.ZeroAddress
        ) {
            throw new Error(
                "Enter a valid ERC20 token contract address."
            );
        }

        const token = new ethers.Contract(
            address,
            ERC20_METADATA_ABI,
            provider
        );

        const [
            symbol,
            decimalsResult,
            approved,
            liability,
            solvent,
        ] = await Promise.all([
            token.symbol(),
            token.decimals(),
            contract.approvedToken(address),
            contract.totalEscrowedToken(address),
            contract.isSolvent(address),
        ]);

        const decimals = Number(
            decimalsResult
        );

        return {
            address,
            symbol,
            decimals,
            approved: Boolean(approved),
            liability,
            formattedLiability:
                `${ethers.formatUnits(
                    liability,
                    decimals
                )} ${symbol}`,
            solvent: Boolean(solvent),
        };
    }

    async function loadToken() {
        try {
            setError("");
            setNotice("");
            setTokenInfo(null);
            setIsLoading(true);

            const info =
                await fetchTokenInformation(
                    tokenAddress.trim()
                );

            setTokenInfo(info);

            setNotice(
                `${info.symbol} protocol information loaded.`
            );
        } catch (loadError) {
            console.error(loadError);

            setError(
                getErrorMessage(loadError)
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function refreshCurrentToken() {
        if (!tokenAddress) {
            return;
        }

        const info =
            await fetchTokenInformation(
                tokenAddress.trim()
            );

        setTokenInfo(info);
    }

    function approveToken() {
        const address =
            tokenAddress.trim();

        runAdminAction({
            action: () =>
                contract.setTokenApproval(
                    address,
                    true
                ),

            pendingMessage:
                "Confirm token approval in your wallet.",

            submittedMessage:
                "Token approval transaction submitted.",

            successMessage:
                "Token approved for new payments.",

            afterSuccess:
                refreshCurrentToken,
        });
    }

    function disableToken() {
        const address =
            tokenAddress.trim();

        runAdminAction({
            action: () =>
                contract.setTokenApproval(
                    address,
                    false
                ),

            pendingMessage:
                "Confirm token removal in your wallet.",

            submittedMessage:
                "Token removal transaction submitted.",

            successMessage:
                "Token disabled for new payments.",

            afterSuccess:
                refreshCurrentToken,
        });
    }

    function pausePayments() {
        runAdminAction({
            action: () =>
                contract.pauseNewPayments(),

            pendingMessage:
                "Confirm the emergency pause in your wallet.",

            submittedMessage:
                "Pause transaction submitted.",

            successMessage:
                "Creation of new payments is paused.",
        });
    }

    function unpausePayments() {
        runAdminAction({
            action: () =>
                contract.unpauseNewPayments(),

            pendingMessage:
                "Confirm protocol unpause in your wallet.",

            submittedMessage:
                "Unpause transaction submitted.",

            successMessage:
                "Creation of new payments is active.",
        });
    }

    function proposeNewArbitrator() {
        const address =
            newArbitrator.trim();

        if (!ethers.isAddress(address)) {
            setError(
                "Enter a valid new arbitrator address."
            );

            return;
        }

        if (address === ethers.ZeroAddress) {
            setError(
                "The zero address cannot become arbitrator."
            );

            return;
        }

        if (
            address.toLowerCase() ===
            arbitrator.toLowerCase()
        ) {
            setError(
                "This wallet is already the current arbitrator."
            );

            return;
        }

        runAdminAction({
            action: () =>
                contract.proposeArbitrator(
                    address
                ),

            pendingMessage:
                "Confirm the arbitrator proposal in your wallet.",

            submittedMessage:
                "Arbitrator proposal submitted.",

            successMessage:
                "Pending arbitrator updated.",

            afterSuccess: async () => {
                setNewArbitrator("");
            },
        });
    }

    function cancelArbitratorTransfer() {
        runAdminAction({
            action: () =>
                contract.cancelArbitratorTransfer(),

            pendingMessage:
                "Confirm cancellation in your wallet.",

            submittedMessage:
                "Cancellation transaction submitted.",

            successMessage:
                "Pending arbitrator transfer cancelled.",
        });
    }

    return (
        <section className="adminPanel">
            <div className="adminPanelHeader">
                <div>
                    <span className="eyebrow">
                        Protocol control
                    </span>

                    <h2>
                        Administration console
                    </h2>

                    <p>
                        Manage payment availability,
                        approved assets, protocol liabilities,
                        and arbitrator authority.
                    </p>
                </div>

                <div
                    className={
                        isOwner
                            ? "adminAuthority verified"
                            : "adminAuthority restricted"
                    }
                >
                    <span>
                        Connected authority
                    </span>

                    <strong>
                        {isOwner
                            ? "Owner verified"
                            : "Restricted"}
                    </strong>

                    <small>
                        {shortAddress(
                            isOwner
                                ? account
                                : owner
                        )}
                    </small>
                </div>
            </div>

            {!isOwner && (
                <div className="adminAccessWarning">
                    Connect the protocol owner wallet
                    to use administrative controls.
                </div>
            )}

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

            <div className="adminStatusGrid">
                <article>
                    <span>
                        Payment creation
                    </span>

                    <strong>
                        {isPaused
                            ? "Paused"
                            : "Active"}
                    </strong>

                    <small>
                        Existing escrow exits remain
                        available while paused.
                    </small>
                </article>

                <article>
                    <span>
                        ETH liability
                    </span>

                    <strong>
                        {ethers.formatEther(
                            ethLiability
                        )} ETH
                    </strong>

                    <small>
                        Total ETH currently recorded
                        in escrow.
                    </small>
                </article>

                <article>
                    <span>
                        ETH solvency
                    </span>

                    <strong
                        className={
                            ethSolvent
                                ? "solventText"
                                : "insolventText"
                        }
                    >
                        {ethSolvent
                            ? "Solvent"
                            : "Warning"}
                    </strong>

                    <small>
                        Contract balance compared with
                        recorded ETH liability.
                    </small>
                </article>
            </div>

            <div className="adminSection">
                <div className="adminSectionHeading">
                    <div>
                        <span className="eyebrow">
                            Emergency control
                        </span>

                        <h3>
                            New payment availability
                        </h3>

                        <p>
                            Pausing blocks new direct and
                            escrow payments without blocking
                            existing exits.
                        </p>
                    </div>
                </div>

                <div className="adminActionRow">
                    <button
                        type="button"
                        className="danger"
                        onClick={pausePayments}
                        disabled={
                            isLoading ||
                            !isOwner ||
                            isPaused
                        }
                    >
                        Pause new payments
                    </button>

                    <button
                        type="button"
                        className="primary"
                        onClick={unpausePayments}
                        disabled={
                            isLoading ||
                            !isOwner ||
                            !isPaused
                        }
                    >
                        Unpause new payments
                    </button>
                </div>
            </div>

            <div className="adminSection">
                <div className="adminSectionHeading">
                    <div>
                        <span className="eyebrow">
                            Asset governance
                        </span>

                        <h3>
                            ERC20 token management
                        </h3>

                        <p>
                            Approving a token allows new
                            payments. Disabling it does not
                            remove existing escrow liabilities.
                        </p>
                    </div>
                </div>

                <div className="adminInputAction">
                    <div>
                        <label htmlFor="admin-token-address">
                            Token contract
                        </label>

                        <input
                            id="admin-token-address"
                            type="text"
                            autoComplete="off"
                            placeholder="0x ERC20 token address"
                            value={tokenAddress}
                            onChange={(event) => {
                                setTokenAddress(
                                    event.target.value
                                );

                                setTokenInfo(null);
                            }}
                        />
                    </div>

                    <button
                        type="button"
                        className="secondary"
                        onClick={loadToken}
                        disabled={
                            isLoading ||
                            !isConnected ||
                            !isCorrectNetwork
                        }
                    >
                        Load token
                    </button>
                </div>

                {tokenInfo && (
                    <div className="adminTokenCard">
                        <div>
                            <span>Token</span>

                            <strong>
                                {tokenInfo.symbol}
                            </strong>

                            <small>
                                {shortAddress(
                                    tokenInfo.address
                                )}
                            </small>
                        </div>

                        <div>
                            <span>
                                Approval status
                            </span>

                            <strong>
                                {tokenInfo.approved
                                    ? "Approved"
                                    : "Disabled"}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Escrow liability
                            </span>

                            <strong>
                                {
                                    tokenInfo
                                        .formattedLiability
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Solvency
                            </span>

                            <strong
                                className={
                                    tokenInfo.solvent
                                        ? "solventText"
                                        : "insolventText"
                                }
                            >
                                {tokenInfo.solvent
                                    ? "Solvent"
                                    : "Warning"}
                            </strong>
                        </div>
                    </div>
                )}

                <div className="adminActionRow">
                    <button
                        type="button"
                        className="primary"
                        onClick={approveToken}
                        disabled={
                            isLoading ||
                            !isOwner ||
                            !ethers.isAddress(
                                tokenAddress.trim()
                            )
                        }
                    >
                        Approve token
                    </button>

                    <button
                        type="button"
                        className="danger"
                        onClick={disableToken}
                        disabled={
                            isLoading ||
                            !isOwner ||
                            !ethers.isAddress(
                                tokenAddress.trim()
                            )
                        }
                    >
                        Disable token
                    </button>
                </div>
            </div>

            <div className="adminSection">
                <div className="adminSectionHeading">
                    <div>
                        <span className="eyebrow">
                            Dispute authority
                        </span>

                        <h3>
                            Arbitrator transfer
                        </h3>

                        <p>
                            The proposed wallet must accept
                            the role before the current
                            arbitrator changes.
                        </p>
                    </div>
                </div>

                <div className="adminAuthorityGrid">
                    <article>
                        <span>
                            Current arbitrator
                        </span>

                        <strong>
                            {shortAddress(
                                arbitrator
                            )}
                        </strong>
                    </article>

                    <article>
                        <span>
                            Pending arbitrator
                        </span>

                        <strong>
                            {shortAddress(
                                pendingArbitrator
                            )}
                        </strong>
                    </article>
                </div>

                <div className="adminInputAction">
                    <div>
                        <label htmlFor="new-arbitrator">
                            New arbitrator wallet
                        </label>

                        <input
                            id="new-arbitrator"
                            type="text"
                            autoComplete="off"
                            placeholder="0x new arbitrator address"
                            value={newArbitrator}
                            onChange={(event) =>
                                setNewArbitrator(
                                    event.target.value
                                )
                            }
                        />
                    </div>

                    <button
                        type="button"
                        className="primary"
                        onClick={
                            proposeNewArbitrator
                        }
                        disabled={
                            isLoading ||
                            !isOwner ||
                            !ethers.isAddress(
                                newArbitrator.trim()
                            )
                        }
                    >
                        Propose arbitrator
                    </button>
                </div>

                <div className="adminActionRow">
                    <button
                        type="button"
                        className="danger"
                        onClick={
                            cancelArbitratorTransfer
                        }
                        disabled={
                            isLoading ||
                            !isOwner ||
                            pendingArbitrator ===
                            ethers.ZeroAddress
                        }
                    >
                        Cancel pending transfer
                    </button>
                </div>
            </div>
        </section>
    );
}