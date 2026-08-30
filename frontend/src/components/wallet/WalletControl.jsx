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
                    <span
                        className="walletButtonDot"
                        aria-hidden="true"
                    />

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
                className={[
                    "walletIdentityCard",
                    !isCorrectNetwork
                        ? "wrongNetwork"
                        : "",
                    isAuthenticatedWalletConnected
                        ? "authenticated"
                        : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
                title={
                    isCorrectNetwork
                        ? `${account} Ã¢â‚¬â€ ${getNetworkName(chainId)}`
                        : `${account} Ã¢â‚¬â€ Wrong network`
                }
            >
                <span
                    className="walletConnectionDot"
                    aria-hidden="true"
                />

                <div className="walletIdentity">
                    <strong>
                        {shortAddress(account)}
                    </strong>

                    <small>
                        <span>
                            {isCorrectNetwork
                                ? getNetworkName(chainId)
                                : `Chain ${chainId} / Expected ${expectedChainId}`}
                        </span>

                        {isAuthenticatedWalletConnected && (
                            <>
                                <span
                                    className="walletMetaDivider"
                                    aria-hidden="true"
                                >
                                    /
                                </span>

                                <span className="walletAuthenticatedLabel">
                                    Authenticated
                                </span>
                            </>
                        )}
                    </small>
                </div>
            </div>

            {isCheckingSession && (
                <span className="walletInlineStatus">
                    Checking session...
                </span>
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
                            : "Sign in to PAI"}
                    </button>
                )}

            {!isCorrectNetwork &&
                !isCheckingSession && (
                    <span className="walletInlineStatus warning">
                        Wrong network
                    </span>
                )}

            {isAuthenticatedWalletConnected && (
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
            )}

            {authenticatedElsewhere && (
                <>
                    <span className="walletInlineStatus warning">
                        Session{" "}
                        {shortAddress(
                            authenticatedWallet
                        )}
                    </span>

                    <button
                        type="button"
                        className="walletLogoutButton"
                        onClick={handleLogout}
                        disabled={isAuthenticating}
                    >
                        Logout session
                    </button>
                </>
            )}

            {authStatus === "error" &&
                authError && (
                    <span
                        className="walletInlineStatus error"
                        role="alert"
                        title={authError}
                    >
                        {authError}
                    </span>
                )}
        </div>
    );
}
