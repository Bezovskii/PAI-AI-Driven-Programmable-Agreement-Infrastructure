import {
    useMemo,
    useState,
} from "react";

import {
    redeemWalletBindingHandoff,
} from "../../api/walletBindingHandoff.js";

import {
    useWeb3,
} from "../../hooks/useWeb3.js";

function readRequiredSearchParam(
    searchParams,
    name
) {
    const value =
        searchParams.get(name);

    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        return "";
    }

    return value.trim();
}

function shortValue(value) {
    if (
        typeof value !== "string" ||
        value.length <= 14
    ) {
        return value || "-";
    }

    return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default function WalletBindingHandoffPage() {
    const {
        account,
        expectedChainId,

        isConnected,
        isConnecting,
        isCorrectNetwork,

        authStatus,
        isAuthenticating,
        isAuthenticatedWalletConnected,

        connectWallet,
        authenticate,
    } = useWeb3();

    const handoff =
        useMemo(
            () => {
                const searchParams =
                    new URLSearchParams(
                        window.location.search
                    );

                return {
                    agreementId:
                        readRequiredSearchParam(
                            searchParams,
                            "agreementId"
                        ),

                    partyId:
                        readRequiredSearchParam(
                            searchParams,
                            "partyId"
                        ),

                    handoffId:
                        readRequiredSearchParam(
                            searchParams,
                            "handoffId"
                        ),
                };
            },
            []
        );

    const [
        redeemStatus,
        setRedeemStatus,
    ] = useState("idle");

    const [
        redeemError,
        setRedeemError,
    ] = useState("");

    const [
        result,
        setResult,
    ] = useState(null);

    const hasCompleteHandoff =
        Boolean(
            handoff.agreementId &&
            handoff.partyId &&
            handoff.handoffId
        );

    const handleConnect =
        async () => {
            setRedeemError("");

            await connectWallet();
        };

    const handleAuthenticate =
        async () => {
            setRedeemError("");

            try {
                await authenticate();
            } catch {
                // Web3Context owns the detailed SIWE error state.
            }
        };

    const handleRedeem =
        async () => {
            if (!hasCompleteHandoff) {
                setRedeemError(
                    "This wallet-binding link is incomplete. Return to Telegram and request a fresh link."
                );

                return;
            }

            if (!isAuthenticatedWalletConnected) {
                setRedeemError(
                    "Sign in to PAI with the connected wallet before binding it."
                );

                return;
            }

            try {
                setRedeemStatus(
                    "redeeming"
                );

                setRedeemError("");

                const redeemed =
                    await redeemWalletBindingHandoff({
                        agreementId:
                            handoff.agreementId,

                        partyId:
                            handoff.partyId,

                        handoffId:
                            handoff.handoffId,
                    });

                setResult(
                    redeemed
                );

                setRedeemStatus(
                    "success"
                );

                window.history.replaceState(
                    window.history.state,
                    "",
                    window.location.pathname
                );
            } catch (error) {
                setRedeemStatus(
                    "error"
                );

                setRedeemError(
                    error?.message ||
                    "Unable to bind this wallet."
                );
            }
        };

    if (!hasCompleteHandoff) {
        return (
            <div className="rolePage">
                <div className="pageHeading">
                    <div>
                        <span className="eyebrow">
                            Agreement / Wallet binding
                        </span>

                        <h1>
                            Invalid wallet-binding link
                        </h1>

                        <p>
                            This link is missing its agreement,
                            party, or one-time handoff identifier.
                            Return to Telegram and generate a fresh
                            Connect Wallet link.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rolePage">
            <div className="pageHeading">
                <div>
                    <span className="eyebrow">
                        Agreement / Wallet binding
                    </span>

                    <h1>
                        Connect your wallet
                    </h1>

                    <p>
                        Authenticate the wallet you want bound to
                        this agreement. PAI Core remains the
                        authority for the resulting lifecycle state.
                    </p>
                </div>
            </div>

            <section className="dashboardProtocolCard">
                <div className="dashboardCardHeader">
                    <div>
                        <span className="eyebrow">
                            Canonical agreement
                        </span>

                        <h2>
                            Wallet-binding handoff
                        </h2>
                    </div>

                    <span className="statusPill active">
                        ONE-TIME
                    </span>
                </div>

                <div className="sessionGrid">
                    <div>
                        <span>Agreement</span>

                        <strong className="mono">
                            {shortValue(
                                handoff.agreementId
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>Party</span>

                        <strong className="mono">
                            {shortValue(
                                handoff.partyId
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>Connected wallet</span>

                        <strong className="mono">
                            {shortValue(
                                account
                            )}
                        </strong>
                    </div>
                </div>
            </section>

            {!isConnected && (
                <section className="dashboardProtocolCard">
                    <h2>
                        1. Connect wallet
                    </h2>

                    <p>
                        Choose the wallet that should represent
                        this party in the agreement.
                    </p>

                    <button
                        type="button"
                        className="walletButton"
                        onClick={handleConnect}
                        disabled={isConnecting}
                    >
                        {isConnecting
                            ? "Connecting..."
                            : "Connect wallet"}
                    </button>
                </section>
            )}

            {isConnected &&
                !isCorrectNetwork && (
                    <section className="dashboardProtocolCard">
                        <h2>
                            Switch network
                        </h2>

                        <p>
                            Switch the connected wallet to chain{" "}
                            {expectedChainId} using the wallet
                            control above before continuing.
                        </p>
                    </section>
                )}

            {isConnected &&
                isCorrectNetwork &&
                authStatus === "checking" && (
                    <section className="dashboardProtocolCard">
                        <h2>
                            Checking PAI session
                        </h2>

                        <p>
                            Restoring the existing browser
                            authentication session.
                        </p>
                    </section>
                )}

            {isConnected &&
                isCorrectNetwork &&
                authStatus !== "checking" &&
                !isAuthenticatedWalletConnected &&
                redeemStatus !== "success" && (
                    <section className="dashboardProtocolCard">
                        <h2>
                            2. Sign in to PAI
                        </h2>

                        <p>
                            Sign the SIWE authentication message.
                            This proves control of the connected
                            wallet; Telegram does not authenticate
                            the wallet.
                        </p>

                        <button
                            type="button"
                            className="walletAuthButton"
                            onClick={handleAuthenticate}
                            disabled={isAuthenticating}
                        >
                            {isAuthenticating
                                ? "Signing in..."
                                : "Sign in with connected wallet"}
                        </button>
                    </section>
                )}

            {isAuthenticatedWalletConnected &&
                redeemStatus !== "success" && (
                    <section className="dashboardProtocolCard">
                        <h2>
                            3. Bind wallet
                        </h2>

                        <p>
                            Redeem the one-time handoff. The wallet
                            address comes from your authenticated
                            SIWE session, not from this request.
                        </p>

                        <button
                            type="button"
                            className="walletAuthButton"
                            onClick={handleRedeem}
                            disabled={
                                redeemStatus ===
                                "redeeming"
                            }
                        >
                            {redeemStatus === "redeeming"
                                ? "Binding wallet..."
                                : "Bind this wallet"}
                        </button>
                    </section>
                )}

            {redeemError && (
                <section
                    className="dashboardProtocolCard"
                    role="alert"
                >
                    <h2>
                        Wallet binding failed
                    </h2>

                    <p>
                        {redeemError}
                    </p>

                    <p>
                        If the handoff expired or was already used,
                        return to Telegram and generate a fresh
                        Connect Wallet link.
                    </p>
                </section>
            )}

            {redeemStatus === "success" &&
                result && (
                    <section className="dashboardProtocolCard">
                        <div className="dashboardCardHeader">
                            <div>
                                <span className="eyebrow">
                                    Core confirmed
                                </span>

                                <h2>
                                    Wallet bound
                                </h2>
                            </div>

                            <span className="statusPill active">
                                SUCCESS
                            </span>
                        </div>

                        <div className="sessionGrid">
                            <div>
                                <span>Wallet</span>

                                <strong className="mono">
                                    {shortValue(
                                        result.walletAddress
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Lifecycle</span>

                                <strong>
                                    {result.lifecycle?.status ||
                                        "-"}
                                </strong>
                            </div>

                            <div>
                                <span>Wallet binding</span>

                                <strong>
                                    {result.lifecycle
                                        ?.walletBindingComplete
                                        ? "Complete"
                                        : "Waiting for other party"}
                                </strong>
                            </div>
                        </div>

                        <p>
                            {result.lifecycle
                                ?.walletBindingComplete
                                ? "Both agreement parties are wallet-bound. Continue with the backend-authorized funding flow."
                                : "This wallet is bound. The other agreement party must bind their wallet before funding becomes available."}
                        </p>
                    </section>
                )}
        </div>
    );
}