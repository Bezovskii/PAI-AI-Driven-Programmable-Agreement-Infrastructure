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

const resolvedContractABI = Array.isArray(contractABI)
    ? contractABI
    : contractABI?.abi;

if (!Array.isArray(resolvedContractABI)) {
    throw new Error(
        "The ESCT contract ABI is invalid. Expected an ABI array."
    );
}

function getExpectedChainId() {
    const configured = Number(
        import.meta.env.VITE_CHAIN_ID
    );

    return (
        Number.isInteger(configured) &&
        configured > 0
    )
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

    if (
        error?.code === "UNKNOWN_ERROR" &&
        error?.error?.message
    ) {
        return error.error.message;
    }

    return (
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "An unexpected wallet error occurred."
    );
}

export function Web3Provider({ children }) {
    const [provider, setProvider] =
        useState(null);

    const [signer, setSigner] =
        useState(null);

    const [contract, setContract] =
        useState(null);

    const [account, setAccount] =
        useState("");

    const [chainId, setChainId] =
        useState(null);

    const [owner, setOwner] =
        useState("");

    const [arbitrator, setArbitrator] =
        useState("");

    const [isPaused, setIsPaused] =
        useState(false);

    const [isConnecting, setIsConnecting] =
        useState(false);

    const [transaction, setTransaction] =
        useState({
            status: "idle",
            message: "",
            hash: "",
            error: "",
        });

    const expectedChainId =
        getExpectedChainId();

    const clearProtocolState =
        useCallback(() => {
            setContract(null);
            setOwner("");
            setArbitrator("");
            setIsPaused(false);
        }, []);

    const resetConnection =
        useCallback(() => {
            setProvider(null);
            setSigner(null);
            setAccount("");
            setChainId(null);

            clearProtocolState();
        }, [clearProtocolState]);

    const loadProtocolState =
        useCallback(async (appContract) => {
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
            setArbitrator(
                protocolArbitrator
            );
            setIsPaused(Boolean(paused));
        }, []);

    const initializeConnection =
        useCallback(
            async (
                requestAccess = false
            ) => {
                if (
                    typeof window ===
                    "undefined" ||
                    !window.ethereum
                ) {
                    throw new Error(
                        "No injected wallet was found. Install MetaMask or another compatible wallet."
                    );
                }

                const browserProvider =
                    new ethers.BrowserProvider(
                        window.ethereum
                    );

                let accounts;

                if (requestAccess) {
                    try {
                        await browserProvider.send(
                            "wallet_requestPermissions",
                            [
                                {
                                    eth_accounts: {},
                                },
                            ]
                        );
                    } catch (permissionError) {
                        const permissionCode =
                            permissionError?.code ??
                            permissionError?.error?.code ??
                            permissionError?.info?.error?.code;

                        if (
                            permissionCode === 4001 ||
                            permissionError?.code ===
                                "ACTION_REJECTED"
                        ) {
                            throw permissionError;
                        }

                        console.warn(
                            "Wallet permission prompt unavailable. Falling back to standard connection.",
                            permissionError
                        );
                    }

                    accounts =
                        await browserProvider.send(
                            "eth_requestAccounts",
                            []
                        );
                } else {
                    accounts =
                        await browserProvider.send(
                            "eth_accounts",
                            []
                        );
                }

                if (!accounts.length) {
                    resetConnection();

                    return false;
                }

                const network =
                    await browserProvider.getNetwork();

                const detectedChainId =
                    Number(network.chainId);

                const selectedAccount =
                    ethers.getAddress(accounts[0]);

                const walletSigner =
                    await browserProvider.getSigner(
                        selectedAccount
                    );

                const walletAccount =
                    await walletSigner.getAddress();

                setProvider(
                    browserProvider
                );

                setSigner(walletSigner);

                setAccount(walletAccount);

                setChainId(
                    detectedChainId
                );

                if (
                    detectedChainId !==
                    expectedChainId
                ) {
                    clearProtocolState();

                    return true;
                }

                const deployedCode =
                    await browserProvider.getCode(
                        contractAddress
                    );

                if (
                    !deployedCode ||
                    deployedCode === "0x"
                ) {
                    clearProtocolState();

                    throw new Error(
                        `No ESCT contract was found at ${contractAddress} on chain ${detectedChainId}. Make sure the local Hardhat node is running and deploy the contract again.`
                    );
                }

                const appContract =
                    new ethers.Contract(
                        contractAddress,
                        resolvedContractABI,
                        walletSigner
                    );

                await loadProtocolState(
                    appContract
                );

                setContract(appContract);

                return true;
            },
            [
                clearProtocolState,
                expectedChainId,
                loadProtocolState,
                resetConnection,
            ]
        );

    const connectWallet =
        useCallback(async () => {
            try {
                setIsConnecting(true);

                setTransaction({
                    status: "connecting",
                    message:
                        "Connecting wallet...",
                    hash: "",
                    error: "",
                });

                const connected =
                    await initializeConnection(
                        true
                    );

                if (!connected) {
                    throw new Error(
                        "No wallet account was selected."
                    );
                }

                setTransaction({
                    status: "success",
                    message:
                        "Wallet connected successfully.",
                    hash: "",
                    error: "",
                });
            } catch (error) {
                const message =
                    getErrorMessage(error);

                console.error(
                    "Wallet connection failed:",
                    error
                );

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
                await loadProtocolState(
                    contract
                );
            } catch (error) {
                console.error(
                    "Unable to refresh protocol state:",
                    error
                );

                const message =
                    getErrorMessage(error);

                setTransaction({
                    status: "error",
                    message,
                    hash: "",
                    error: message,
                });
            }
        }, [
            contract,
            loadProtocolState,
        ]);

    const executeTransaction =
        useCallback(
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
                    if (
                        typeof action !==
                        "function"
                    ) {
                        throw new Error(
                            "Transaction action is unavailable."
                        );
                    }

                    setTransaction({
                        status:
                            "awaiting-signature",
                        message:
                            pendingMessage,
                        hash: "",
                        error: "",
                    });

                    const tx =
                        await action();

                    setTransaction({
                        status: "pending",
                        message:
                            submittedMessage,
                        hash: tx.hash,
                        error: "",
                    });

                    const receipt =
                        await tx.wait();

                    setTransaction({
                        status: "success",
                        message:
                            successMessage,
                        hash:
                            receipt.hash ||
                            tx.hash,
                        error: "",
                    });

                    await refreshProtocolState();

                    return receipt;
                } catch (error) {
                    const message =
                        getErrorMessage(error);

                    console.error(
                        "Transaction failed:",
                        error
                    );

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

    const clearTransaction =
        useCallback(() => {
            setTransaction({
                status: "idle",
                message: "",
                hash: "",
                error: "",
            });
        }, []);

    useEffect(() => {
        if (
            typeof window ===
            "undefined" ||
            !window.ethereum
        ) {
            return undefined;
        }

        const handleAccountsChanged =
            (accounts) => {
                /*
                 * Do not silently connect ESCT just
                 * because MetaMask already knows
                 * about an authorized account.
                 *
                 * Account changes are only handled
                 * after the user has explicitly
                 * connected during this ESCT session.
                 */
                if (!account || !signer) {
                    return;
                }

                if (!accounts.length) {
                    resetConnection();

                    setTransaction({
                        status: "idle",
                        message: "",
                        hash: "",
                        error: "",
                    });

                    return;
                }

                initializeConnection(
                    false
                ).catch((error) => {
                    const message =
                        getErrorMessage(
                            error
                        );

                    console.error(
                        "Account refresh failed:",
                        error
                    );

                    setTransaction({
                        status: "error",
                        message,
                        hash: "",
                        error: message,
                    });
                });
            };

        const handleChainChanged = () => {
            /*
             * Same rule for networks:
             * no automatic ESCT session until
             * Connect wallet has been pressed.
             */
            if (!account || !signer) {
                return;
            }

            initializeConnection(
                false
            ).catch((error) => {
                const message =
                    getErrorMessage(error);

                console.error(
                    "Network refresh failed:",
                    error
                );

                setTransaction({
                    status: "error",
                    message,
                    hash: "",
                    error: message,
                });
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
    }, [
        account,
        signer,
        initializeConnection,
        resetConnection,
    ]);

    const normalizedAccount =
        account.toLowerCase();

    const isConnected = Boolean(
        account && signer
    );

    const isCorrectNetwork =
        chainId === expectedChainId;

    const isProtocolReady = Boolean(
        isConnected &&
        isCorrectNetwork &&
        contract
    );

    const isOwner = Boolean(
        isProtocolReady &&
        normalizedAccount &&
        owner &&
        normalizedAccount ===
        owner.toLowerCase()
    );

    const isArbitrator = Boolean(
        isProtocolReady &&
        normalizedAccount &&
        arbitrator &&
        normalizedAccount ===
        arbitrator.toLowerCase()
    );

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
            isProtocolReady,
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
            isProtocolReady,
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
        <Web3Context.Provider
            value={value}
        >
            {children}
        </Web3Context.Provider>
    );
}


