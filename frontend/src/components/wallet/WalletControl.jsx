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
    } = useWeb3();

    if (!isConnected) {
        return (
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
        );
    }

    return (
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
    );
}