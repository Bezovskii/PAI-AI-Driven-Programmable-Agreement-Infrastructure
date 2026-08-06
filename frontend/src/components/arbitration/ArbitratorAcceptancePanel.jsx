import { ethers } from "ethers";
import {
    useCallback,
    useEffect,
    useState,
} from "react";

import { useWeb3 } from "../../hooks/useWeb3.js";

function shortAddress(address) {
    if (
        !address ||
        address === ethers.ZeroAddress
    ) {
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

export default function ArbitratorAcceptancePanel() {
    const {
        account,
        contract,
        arbitrator,
        isConnected,
        isCorrectNetwork,
        executeTransaction,
        refreshProtocolState,
    } = useWeb3();

    const [
        pendingArbitrator,
        setPendingArbitrator,
    ] = useState(ethers.ZeroAddress);

    const [
        isLoading,
        setIsLoading,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const [
        notice,
        setNotice,
    ] = useState("");

    const loadPendingArbitrator =
        useCallback(async () => {
            if (!contract) {
                setPendingArbitrator(
                    ethers.ZeroAddress
                );

                return;
            }

            const pending =
                await contract.pendingArbitrator();

            setPendingArbitrator(pending);
        }, [contract]);

    useEffect(() => {
        loadPendingArbitrator().catch(
            (loadError) => {
                console.error(
                    "Pending arbitrator load failed:",
                    loadError
                );
            }
        );
    }, [loadPendingArbitrator]);

    const isPendingArbitrator =
        Boolean(
            account &&
            pendingArbitrator !==
            ethers.ZeroAddress &&
            account.toLowerCase() ===
            pendingArbitrator.toLowerCase()
        );

    async function acceptRole() {
        try {
            setError("");
            setNotice("");
            setIsLoading(true);

            if (!isConnected || !contract) {
                throw new Error(
                    "Connect your wallet first."
                );
            }

            if (!isCorrectNetwork) {
                throw new Error(
                    "Switch your wallet to the expected network."
                );
            }

            if (
                pendingArbitrator ===
                ethers.ZeroAddress
            ) {
                throw new Error(
                    "There is no pending arbitrator transfer."
                );
            }

            if (!isPendingArbitrator) {
                throw new Error(
                    "The connected wallet is not the pending arbitrator."
                );
            }

            await executeTransaction({
                action: () =>
                    contract.acceptArbitratorRole(),

                pendingMessage:
                    "Confirm acceptance of the arbitrator role in your wallet.",

                submittedMessage:
                    "Arbitrator acceptance transaction submitted.",

                successMessage:
                    "Arbitrator role accepted successfully.",
            });

            await refreshProtocolState();
            await loadPendingArbitrator();

            setNotice(
                "You are now the current protocol arbitrator."
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

    return (
        <section className="adminSection">
            <div className="adminSectionHeading">
                <div>
                    <span className="eyebrow">
                        Two-step authority transfer
                    </span>

                    <h3>
                        Arbitrator role acceptance
                    </h3>

                    <p>
                        The protocol owner proposes a new
                        arbitrator. The proposed wallet must
                        explicitly accept the role before the
                        authority changes.
                    </p>
                </div>
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

            <div className="adminAuthorityGrid">
                <article>
                    <span>
                        Current arbitrator
                    </span>

                    <strong>
                        {shortAddress(arbitrator)}
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

            {!isConnected && (
                <div className="sellerAccessWarning">
                    Connect a wallet to check whether it
                    has been proposed as the new
                    arbitrator.
                </div>
            )}

            {isConnected &&
                pendingArbitrator ===
                ethers.ZeroAddress && (
                    <div className="sellerAccessNotice">
                        There is currently no pending
                        arbitrator transfer.
                    </div>
                )}

            {isConnected &&
                pendingArbitrator !==
                ethers.ZeroAddress &&
                !isPendingArbitrator && (
                    <div className="sellerAccessWarning">
                        The connected wallet does not match
                        the pending arbitrator address.
                    </div>
                )}

            {isPendingArbitrator && (
                <div className="resolutionWarning">
                    This wallet has been proposed as the
                    new protocol arbitrator. Accepting the
                    role grants authority to resolve
                    disputed escrow orders.
                </div>
            )}

            <div className="adminActionRow">
                <button
                    type="button"
                    className="primary"
                    onClick={acceptRole}
                    disabled={
                        isLoading ||
                        !isPendingArbitrator ||
                        !isCorrectNetwork
                    }
                >
                    {isLoading
                        ? "Accepting..."
                        : "Accept arbitrator role"}
                </button>
            </div>
        </section>
    );
}