import { useWeb3 } from "../../hooks/useWeb3.js";
import "./WalletControl.css";

function shortAddress(address) {
    if (!address) {
        return "";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getNetworkName(chainId) {
    const networks = {
        1: "Ethereum Mainnet",
        11155111: "Sepolia Testnet",
        31337: "Hardhat Local",
    };

    return networks[chainId] || `Chain ${chainId}`;
}

export default function WalletControl() {
    const {
        account,
        chainId,
        expectedChainId,

        isConnected,
        isConnecting,
        isCorrectNetwork,

        connectWallet,

        authStatus,
        authenticatedWallet,
        authError,
        isAuthenticating,

        isAuthenticated,
        isAuthenticatedWalletConnected,

        authenticate,
        logout,
    } = useWeb3();

    if (!isConnected) {
        return (
            <div className="walletControl">
                <button
                    type="button"
                    className="walletButton"
                    onClick={connectWallet}
                    disabled={isConnecting}
                >
                    {isConnecting
                        ? "Connecting..."
                        : "Connect wallet"}
                </button>
            </div>
        );
    }

    const isCheckingSession =
        authStatus === "checking";

    const authenticatedElsewhere =
        Boolean(
            isAuthenticated &&
            authenticatedWallet &&
            !isAuthenticatedWalletConnected
        );

    const handleAuthenticate =
        async () => {
            try {
                await authenticate();
            } catch {
                // Web3Context owns authentication errors.
            }
        };

    const handleLogout =
        async () => {
            try {
                await logout();
            } catch {
                // Web3Context owns logout errors.
            }
        };

    return (
        <div className="walletControl">
            <div
                className={
                    isCorrectNetwork
                        ? "connectedWallet"
                        : "connectedWallet wrongNetwork"
                }
                title={
                    isCorrectNetwork
                        ? `${account} — ${getNetworkName(chainId)}`
                        : `${account} — Wrong network`
                }
            >
                <span
                    className="walletConnectionDot"
                    aria-hidden="true"
                />

                <div className="connectedWalletIdentity">
                    <strong>
                        {shortAddress(account)}
                    </strong>

                    <small>
                        {isCorrectNetwork
                            ? getNetworkName(chainId)
                            : `Chain ${chainId} · Expected ${expectedChainId}`}
                    </small>
                </div>
            </div>

            {isCheckingSession && (
                <div className="walletAuthStatus">
                    Checking ESCT session...
                </div>
            )}

            {!isCorrectNetwork &&
                !isCheckingSession && (
                    <div className="walletAuthStatus walletAuthWarning">
                        Switch to chain{" "}
                        {expectedChainId} to sign in.
                    </div>
                )}

            {isCorrectNetwork &&
                !isCheckingSession &&
                !isAuthenticated && (
                    <button
                        type="button"
                        className="walletAuthButton"
                        onClick={handleAuthenticate}
                        disabled={isAuthenticating}
                    >
                        {isAuthenticating
                            ? "Signing in..."
                            : "Sign in to ESCT"}
                    </button>
                )}

            {isAuthenticatedWalletConnected && (
                <div className="walletAuthenticatedRow">
                    <div
                        className="walletAuthStatus walletAuthSuccess"
                        title={authenticatedWallet}
                    >
                        <span
                            className="walletAuthDot"
                            aria-hidden="true"
                        />

                        <div>
                            <strong>
                                Authenticated
                            </strong>

                            <small>
                                {shortAddress(
                                    authenticatedWallet
                                )}
                            </small>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="walletLogoutButton"
                        onClick={handleLogout}
                        disabled={isAuthenticating}
                    >
                        {isAuthenticating
                            ? "Logging out..."
                            : "Logout"}
                    </button>
                </div>
            )}

            {authenticatedElsewhere && (
                <div className="walletAuthenticatedRow">
                    <div className="walletAuthStatus walletAuthWarning">
                        <div>
                            <strong>
                                Different session wallet
                            </strong>

                            <small>
                                ESCT session:{" "}
                                {shortAddress(
                                    authenticatedWallet
                                )}
                            </small>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="walletLogoutButton"
                        onClick={handleLogout}
                        disabled={isAuthenticating}
                    >
                        Logout session
                    </button>
                </div>
            )}

            {authStatus === "error" &&
                authError && (
                    <div
                        className="walletAuthStatus walletAuthError"
                        role="alert"
                    >
                        {authError}
                    </div>
                )}
        </div>
    );
}