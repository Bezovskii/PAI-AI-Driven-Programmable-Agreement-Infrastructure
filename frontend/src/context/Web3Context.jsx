import { ethers } from "ethers";
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { contractAddress } from "../contract/contractAddress.js";
import contractABI from "../contract/MultiPaymentABI.json";

export const Web3Context = createContext(null);

const DEFAULT_CHAIN_ID = 31337;

function getExpectedChainId() {
    const configured = Number(import.meta.env.VITE_CHAIN_ID);

    return Number.isInteger(configured) && configured > 0
        ? configured
        : DEFAULT_CHAIN_ID;
}

function getErrorMessage(error) {
    if (
        error?.code === 4001 ||
        error?.code === "ACTION_REJECTED"
    ) {
        return "Transaction rejected in wallet.";
    }

    return (
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "An unexpected wallet error occurred."
    );
}

export function Web3Provider({ children }) {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [contract, setContract] = useState(null);

    const [account, setAccount] = useState("");
    const [chainId, setChainId] = useState(null);
    const [owner, setOwner] = useState("");
    const [arbitrator, setArbitrator] = useState("");
    const [isPaused, setIsPaused] = useState(false);

    const [isConnecting, setIsConnecting] =
        useState(false);

    const [transaction, setTransaction] = useState({
        status: "idle",
        message: "",
        hash: "",
        error: "",
    });

    const expectedChainId = getExpectedChainId();

    const resetConnection = useCallback(() => {
        setProvider(null);
        setSigner(null);
        setContract(null);
        setAccount("");
        setChainId(null);
        setOwner("");
        setArbitrator("");
        setIsPaused(false);
    }, []);

    const loadProtocolState = useCallback(
        async (appContract) => {
            const [
                protocolOwner,
                protocolArbitrator,
                paused,
            ] = await Promise.all([
                appContract.owner(),
                appContract.arbitrator(),
                appContract.paused(),
            ]);

            setOwner(protocolOwner);
            setArbitrator(protocolArbitrator);
            setIsPaused(paused);
        },
        []
    );

    const initializeConnection = useCallback(
        async (requestAccess = false) => {
            if (!window.ethereum) {
                throw new Error(
                    "No injected wallet was found. Install MetaMask or another compatible wallet."
                );
            }

            const browserProvider =
                new ethers.BrowserProvider(window.ethereum);

            const accounts = requestAccess
                ? await browserProvider.send(
                    "eth_requestAccounts",
                    []
                )
                : await browserProvider.send(
                    "eth_accounts",
                    []
                );

            if (!accounts.length) {
                resetConnection();
                return false;
            }

            const network =
                await browserProvider.getNetwork();

            const walletSigner =
                await browserProvider.getSigner();

            const walletAccount =
                await walletSigner.getAddress();

            const appContract = new ethers.Contract(
                contractAddress,
                contractABI.abi,
                walletSigner
            );

            setProvider(browserProvider);
            setSigner(walletSigner);
            setContract(appContract);
            setAccount(walletAccount);
            setChainId(Number(network.chainId));

            await loadProtocolState(appContract);

            return true;
        },
        [loadProtocolState, resetConnection]
    );

    const connectWallet = useCallback(async () => {
        try {
            setIsConnecting(true);

            setTransaction({
                status: "connecting",
                message: "Connecting wallet...",
                hash: "",
                error: "",
            });

            const connected =
                await initializeConnection(true);

            if (!connected) {
                throw new Error(
                    "No wallet account was selected."
                );
            }

            setTransaction({
                status: "success",
                message: "Wallet connected successfully.",
                hash: "",
                error: "",
            });
        } catch (error) {
            const message = getErrorMessage(error);

            setTransaction({
                status: "error",
                message,
                hash: "",
                error: message,
            });
        } finally {
            setIsConnecting(false);
        }
    }, [initializeConnection]);

    const refreshProtocolState =
        useCallback(async () => {
            if (!contract) {
                return;
            }

            try {
                await loadProtocolState(contract);
            } catch (error) {
                console.error(
                    "Unable to refresh protocol state:",
                    error
                );
            }
        }, [contract, loadProtocolState]);

    const executeTransaction = useCallback(
        async ({
            action,
            pendingMessage =
            "Confirm the transaction in your wallet.",
            submittedMessage =
            "Transaction submitted.",
            successMessage =
            "Transaction confirmed.",
        }) => {
            try {
                setTransaction({
                    status: "awaiting-signature",
                    message: pendingMessage,
                    hash: "",
                    error: "",
                });

                const tx = await action();

                setTransaction({
                    status: "pending",
                    message: submittedMessage,
                    hash: tx.hash,
                    error: "",
                });

                const receipt = await tx.wait();

                setTransaction({
                    status: "success",
                    message: successMessage,
                    hash: receipt.hash,
                    error: "",
                });

                await refreshProtocolState();

                return receipt;
            } catch (error) {
                const message = getErrorMessage(error);

                setTransaction({
                    status: "error",
                    message,
                    hash: "",
                    error: message,
                });

                throw error;
            }
        },
        [refreshProtocolState]
    );

    const clearTransaction = useCallback(() => {
        setTransaction({
            status: "idle",
            message: "",
            hash: "",
            error: "",
        });
    }, []);

    useEffect(() => {
        initializeConnection(false).catch((error) => {
            console.error(
                "Silent wallet connection failed:",
                error
            );
        });
    }, [initializeConnection]);

    useEffect(() => {
        if (!window.ethereum) {
            return undefined;
        }

        const handleAccountsChanged = (accounts) => {
            if (!accounts.length) {
                resetConnection();
                return;
            }

            initializeConnection(false).catch((error) => {
                console.error(
                    "Account refresh failed:",
                    error
                );

                resetConnection();
            });
        };

        const handleChainChanged = () => {
            initializeConnection(false).catch((error) => {
                console.error(
                    "Network refresh failed:",
                    error
                );

                resetConnection();
            });
        };

        window.ethereum.on(
            "accountsChanged",
            handleAccountsChanged
        );

        window.ethereum.on(
            "chainChanged",
            handleChainChanged
        );

        return () => {
            window.ethereum.removeListener(
                "accountsChanged",
                handleAccountsChanged
            );

            window.ethereum.removeListener(
                "chainChanged",
                handleChainChanged
            );
        };
    }, [initializeConnection, resetConnection]);

    const normalizedAccount =
        account.toLowerCase();

    const isConnected = Boolean(
        account && signer && contract
    );

    const isOwner = Boolean(
        normalizedAccount &&
        owner &&
        normalizedAccount === owner.toLowerCase()
    );

    const isArbitrator = Boolean(
        normalizedAccount &&
        arbitrator &&
        normalizedAccount ===
        arbitrator.toLowerCase()
    );

    const isCorrectNetwork =
        chainId === expectedChainId;

    const value = useMemo(
        () => ({
            provider,
            signer,
            contract,

            account,
            chainId,
            expectedChainId,
            owner,
            arbitrator,
            isPaused,

            isConnected,
            isCorrectNetwork,
            isOwner,
            isArbitrator,
            isConnecting,

            transaction,

            connectWallet,
            executeTransaction,
            refreshProtocolState,
            clearTransaction,
        }),
        [
            provider,
            signer,
            contract,
            account,
            chainId,
            expectedChainId,
            owner,
            arbitrator,
            isPaused,
            isConnected,
            isCorrectNetwork,
            isOwner,
            isArbitrator,
            isConnecting,
            transaction,
            connectWallet,
            executeTransaction,
            refreshProtocolState,
            clearTransaction,
        ]
    );

    return (
        <Web3Context.Provider value={value}>
            {children}
        </Web3Context.Provider>
    );
}