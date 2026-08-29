import { ethers } from "ethers";
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    createEsctSettlementClients,
} from "../settlement/esctSettlementAdapter.js";

import {
    buildSiweMessage,
    fetchCurrentSession,
    logoutSession,
    requestAuthNonce,
    verifySiweAuthentication,
} from "../auth/paiAuth.js";

// eslint-disable-next-line react-refresh/only-export-components
export const Web3Context =
    createContext(null);

const DEFAULT_CHAIN_ID = 31337;

/* =========================================================
                           HELPERS
   ========================================================= */

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

/* =========================================================
                         PROVIDER
   ========================================================= */

export function Web3Provider({
    children,
}) {
    /* =====================================================
                         WALLET STATE
       ===================================================== */

    const [provider, setProvider] =
        useState(null);

    const [signer, setSigner] =
        useState(null);

    const [account, setAccount] =
        useState("");

    const [chainId, setChainId] =
        useState(null);

    const [isConnecting, setIsConnecting] =
        useState(false);

    /* =====================================================
                         AUTH STATE
       ===================================================== */

    const [authStatus, setAuthStatus] =
        useState("checking");

    const [
        authenticatedWallet,
        setAuthenticatedWallet,
    ] = useState("");

    const [authError, setAuthError] =
        useState("");

    const [
        isAuthenticating,
        setIsAuthenticating,
    ] = useState(false);

    /* =====================================================
                      MULTIPAYMENT STATE
       ===================================================== */

    const [contract, setContract] =
        useState(null);

    const [owner, setOwner] =
        useState("");

    const [arbitrator, setArbitrator] =
        useState("");

    const [isPaused, setIsPaused] =
        useState(false);

    /* =====================================================
                       AGREEMENT STATE
       ===================================================== */

    const [
        agreementContract,
        setAgreementContract,
    ] = useState(null);

    const [
        agreementOwner,
        setAgreementOwner,
    ] = useState("");

    const [
        agreementArbitrator,
        setAgreementArbitrator,
    ] = useState("");

    const [
        isAgreementPaused,
        setIsAgreementPaused,
    ] = useState(false);

    /* =====================================================
                       TRANSACTION STATE
       ===================================================== */

    const [
        transaction,
        setTransaction,
    ] = useState({
        status: "idle",
        message: "",
        hash: "",
        error: "",
    });

    const expectedChainId =
        getExpectedChainId();

    /* =====================================================
                    CLEAR MULTIPAYMENT
       ===================================================== */

    const clearProtocolState =
        useCallback(() => {
            setContract(null);
            setOwner("");
            setArbitrator("");
            setIsPaused(false);
        }, []);

    /* =====================================================
                     CLEAR AGREEMENT
       ===================================================== */

    const clearAgreementState =
        useCallback(() => {
            setAgreementContract(null);
            setAgreementOwner("");
            setAgreementArbitrator("");
            setIsAgreementPaused(false);
        }, []);

    /* =====================================================
                   CLEAR AUTHENTICATION
       ===================================================== */

    const clearAuthentication =
        useCallback(() => {
            setAuthStatus(
                "unauthenticated"
            );

            setAuthenticatedWallet(
                ""
            );

            setAuthError(
                ""
            );
        }, []);

    /* =====================================================
                     RESET CONNECTION
       ===================================================== */

    const resetConnection =
        useCallback(() => {
            setProvider(null);
            setSigner(null);
            setAccount("");
            setChainId(null);

            clearProtocolState();
            clearAgreementState();
        }, [
            clearProtocolState,
            clearAgreementState,
        ]);

    /* =====================================================
                  LOAD MULTIPAYMENT STATE
       ===================================================== */

    const loadProtocolState =
        useCallback(
            async (
                appContract
            ) => {
                const [
                    protocolOwner,
                    protocolArbitrator,
                    paused,
                ] = await Promise.all([
                    appContract.owner(),
                    appContract.arbitrator(),
                    appContract.paused(),
                ]);

                setOwner(
                    protocolOwner
                );

                setArbitrator(
                    protocolArbitrator
                );

                setIsPaused(
                    Boolean(paused)
                );
            },
            []
        );

    /* =====================================================
                   LOAD AGREEMENT STATE
       ===================================================== */

    const loadAgreementState =
        useCallback(
            async (
                appContract
            ) => {
                const [
                    protocolOwner,
                    protocolArbitrator,
                    paused,
                ] = await Promise.all([
                    appContract.owner(),
                    appContract.arbitrator(),
                    appContract.paused(),
                ]);

                setAgreementOwner(
                    protocolOwner
                );

                setAgreementArbitrator(
                    protocolArbitrator
                );

                setIsAgreementPaused(
                    Boolean(paused)
                );
            },
            []
        );

    /* =====================================================
                     INITIALIZE WALLET
       ===================================================== */

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
                    } catch (
                    permissionError
                    ) {
                        const permissionCode =
                            permissionError?.code ??
                            permissionError
                                ?.error
                                ?.code ??
                            permissionError
                                ?.info
                                ?.error
                                ?.code;

                        if (
                            permissionCode ===
                            4001 ||
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
                    Number(
                        network.chainId
                    );

                const selectedAccount =
                    ethers.getAddress(
                        accounts[0]
                    );

                const walletSigner =
                    await browserProvider.getSigner(
                        selectedAccount
                    );

                const walletAccount =
                    await walletSigner.getAddress();

                setProvider(
                    browserProvider
                );

                setSigner(
                    walletSigner
                );

                setAccount(
                    walletAccount
                );

                setChainId(
                    detectedChainId
                );

                if (
                    detectedChainId !==
                    expectedChainId
                ) {
                    clearProtocolState();
                    clearAgreementState();

                    return true;
                }
                /* =========================================
                       ESCT SETTLEMENT ADAPTER
                   ========================================= */

                const {
                    paymentContract,
                    agreementContract:
                        settlementAgreementContract,
                    capabilities,
                    addresses,
                } =
                    await createEsctSettlementClients({
                        provider:
                            browserProvider,

                        signer:
                            walletSigner,

                        chainId:
                            detectedChainId,
                    });

                await loadProtocolState(
                    paymentContract
                );

                setContract(
                    paymentContract
                );

                if (
                    !capabilities
                        .agreementSettlement ||
                    !settlementAgreementContract
                ) {
                    clearAgreementState();

                    console.warn(
                        `ESCT agreement settlement is unavailable at ${addresses.agreementSettlement} on chain ${detectedChainId}.`
                    );

                    return true;
                }

                await loadAgreementState(
                    settlementAgreementContract
                );

                setAgreementContract(
                    settlementAgreementContract
                );

                return true;
            },
            [
                clearProtocolState,
                clearAgreementState,
                expectedChainId,
                loadProtocolState,
                loadAgreementState,
                resetConnection,
            ]
        );

    /* =====================================================
                       CONNECT WALLET
       ===================================================== */

    const connectWallet =
        useCallback(
            async () => {
                try {
                    setIsConnecting(
                        true
                    );

                    setTransaction({
                        status:
                            "connecting",

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
                        status:
                            "success",

                        message:
                            "Wallet connected successfully.",

                        hash: "",

                        error: "",
                    });
                } catch (error) {
                    const message =
                        getErrorMessage(
                            error
                        );

                    console.error(
                        "Wallet connection failed:",
                        error
                    );

                    setTransaction({
                        status:
                            "error",

                        message,

                        hash: "",

                        error:
                            message,
                    });
                } finally {
                    setIsConnecting(
                        false
                    );
                }
            },
            [
                initializeConnection,
            ]
        );

    /* =====================================================
                     RESTORE SESSION
       ===================================================== */

    const restoreSession =
        useCallback(
            async () => {
                try {
                    setAuthStatus(
                        "checking"
                    );

                    setAuthError(
                        ""
                    );

                    const session =
                        await fetchCurrentSession();

                    if (!session) {
                        clearAuthentication();

                        return null;
                    }

                    const walletAddress =
                        ethers.getAddress(
                            session.walletAddress
                        );

                    setAuthenticatedWallet(
                        walletAddress
                    );

                    setAuthStatus(
                        "authenticated"
                    );

                    setAuthError(
                        ""
                    );

                    return session;
                } catch (error) {
                    const message =
                        error?.message ||
                        "Unable to restore PAI session.";

                    console.error(
                        "PAI session restore failed:",
                        error
                    );

                    setAuthenticatedWallet(
                        ""
                    );

                    setAuthStatus(
                        "error"
                    );

                    setAuthError(
                        message
                    );

                    return null;
                }
            },
            [
                clearAuthentication,
            ]
        );

    /* =====================================================
                       AUTHENTICATE
       ===================================================== */

    const authenticate =
        useCallback(
            async () => {
                try {
                    if (
                        !account ||
                        !signer
                    ) {
                        throw new Error(
                            "Connect your wallet before signing in to PAI."
                        );
                    }

                    if (
                        chainId !==
                        expectedChainId
                    ) {
                        throw new Error(
                            `Switch to chain ${expectedChainId} before signing in to PAI.`
                        );
                    }

                    setIsAuthenticating(
                        true
                    );

                    setAuthStatus(
                        "authenticating"
                    );

                    setAuthError(
                        ""
                    );

                    const walletAddress =
                        ethers.getAddress(
                            account
                        );

                    const nonce =
                        await requestAuthNonce(
                            walletAddress
                        );

                    const nonceWallet =
                        ethers.getAddress(
                            nonce.walletAddress
                        );

                    if (
                        nonceWallet !==
                        walletAddress
                    ) {
                        throw new Error(
                            "Nonce wallet does not match the connected wallet."
                        );
                    }

                    if (
                        Number(
                            nonce.chainId
                        ) !==
                        chainId
                    ) {
                        throw new Error(
                            "SIWE chain does not match the connected network."
                        );
                    }

                    const message =
                        buildSiweMessage({
                            domain:
                                nonce.domain,

                            walletAddress,

                            uri:
                                nonce.uri,

                            version:
                                nonce.version,

                            chainId:
                                nonce.chainId,

                            nonce:
                                nonce.nonce,

                            expiresAt:
                                nonce.expiresAt,
                        });

                    const signature =
                        await signer.signMessage(
                            message
                        );

                    const verified =
                        await verifySiweAuthentication({
                            message,
                            signature,
                        });

                    const verifiedWallet =
                        ethers.getAddress(
                            verified.walletAddress
                        );

                    if (
                        verifiedWallet !==
                        walletAddress
                    ) {
                        throw new Error(
                            "Authenticated wallet does not match the connected wallet."
                        );
                    }

                    setAuthenticatedWallet(
                        verifiedWallet
                    );

                    setAuthStatus(
                        "authenticated"
                    );

                    setAuthError(
                        ""
                    );

                    return verified;
                } catch (error) {
                    const rejected =
                        error?.code === 4001 ||
                        error?.code ===
                        "ACTION_REJECTED";

                    const message =
                        rejected
                            ? "Sign-in request rejected in wallet."
                            : (
                                error?.message ||
                                "PAI authentication failed."
                            );

                    console.error(
                        "PAI authentication failed:",
                        error
                    );

                    setAuthenticatedWallet(
                        ""
                    );

                    setAuthStatus(
                        "error"
                    );

                    setAuthError(
                        message
                    );

                    throw error;
                } finally {
                    setIsAuthenticating(
                        false
                    );
                }
            },
            [
                account,
                signer,
                chainId,
                expectedChainId,
            ]
        );

    /* =====================================================
                          LOGOUT
       ===================================================== */

    const logout =
        useCallback(
            async () => {
                try {
                    setIsAuthenticating(
                        true
                    );

                    setAuthError(
                        ""
                    );

                    await logoutSession();

                    clearAuthentication();
                } catch (error) {
                    const message =
                        error?.message ||
                        "Unable to log out of PAI.";

                    console.error(
                        "PAI logout failed:",
                        error
                    );

                    setAuthStatus(
                        "error"
                    );

                    setAuthError(
                        message
                    );

                    throw error;
                } finally {
                    setIsAuthenticating(
                        false
                    );
                }
            },
            [
                clearAuthentication,
            ]
        );

    /* =====================================================
                  REFRESH AGREEMENT STATE
       ===================================================== */

    const refreshAgreementState =
        useCallback(
            async () => {
                if (
                    !agreementContract
                ) {
                    return;
                }

                try {
                    await loadAgreementState(
                        agreementContract
                    );
                } catch (error) {
                    console.error(
                        "Unable to refresh Agreement protocol state:",
                        error
                    );

                    const message =
                        getErrorMessage(
                            error
                        );

                    setTransaction({
                        status:
                            "error",

                        message,

                        hash: "",

                        error:
                            message,
                    });
                }
            },
            [
                agreementContract,
                loadAgreementState,
            ]
        );

    /* =====================================================
                  REFRESH ALL PROTOCOL STATE
       ===================================================== */

    const refreshProtocolState =
        useCallback(
            async () => {
                if (
                    !contract &&
                    !agreementContract
                ) {
                    return;
                }

                try {
                    const refreshTasks =
                        [];

                    if (contract) {
                        refreshTasks.push(
                            loadProtocolState(
                                contract
                            )
                        );
                    }

                    if (
                        agreementContract
                    ) {
                        refreshTasks.push(
                            loadAgreementState(
                                agreementContract
                            )
                        );
                    }

                    await Promise.all(
                        refreshTasks
                    );
                } catch (error) {
                    console.error(
                        "Unable to refresh protocol state:",
                        error
                    );

                    const message =
                        getErrorMessage(
                            error
                        );

                    setTransaction({
                        status:
                            "error",

                        message,

                        hash: "",

                        error:
                            message,
                    });
                }
            },
            [
                contract,
                agreementContract,
                loadProtocolState,
                loadAgreementState,
            ]
        );

    /* =====================================================
                    EXECUTE TRANSACTION
       ===================================================== */

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
                        status:
                            "pending",

                        message:
                            submittedMessage,

                        hash:
                            tx.hash,

                        error: "",
                    });

                    const receipt =
                        await tx.wait();

                    setTransaction({
                        status:
                            "success",

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
                        getErrorMessage(
                            error
                        );

                    console.error(
                        "Transaction failed:",
                        error
                    );

                    setTransaction({
                        status:
                            "error",

                        message,

                        hash: "",

                        error:
                            message,
                    });

                    throw error;
                }
            },
            [
                refreshProtocolState,
            ]
        );

    /* =====================================================
                    CLEAR TRANSACTION
       ===================================================== */

    const clearTransaction =
        useCallback(() => {
            setTransaction({
                status:
                    "idle",

                message: "",

                hash: "",

                error: "",
            });
        }, []);

    /* =====================================================
                 INITIAL SESSION RESTORE
       ===================================================== */

    useEffect(() => {
        let cancelled =
            false;

        void fetchCurrentSession()
            .then(
                (session) => {
                    if (cancelled) {
                        return;
                    }

                    if (!session) {
                        setAuthenticatedWallet(
                            ""
                        );

                        setAuthStatus(
                            "unauthenticated"
                        );

                        setAuthError(
                            ""
                        );

                        return;
                    }

                    const walletAddress =
                        ethers.getAddress(
                            session.walletAddress
                        );

                    setAuthenticatedWallet(
                        walletAddress
                    );

                    setAuthStatus(
                        "authenticated"
                    );

                    setAuthError(
                        ""
                    );
                }
            )
            .catch(
                (error) => {
                    if (cancelled) {
                        return;
                    }

                    const message =
                        error?.message ||
                        "Unable to restore PAI session.";

                    console.error(
                        "Initial PAI session restore failed:",
                        error
                    );

                    setAuthenticatedWallet(
                        ""
                    );

                    setAuthStatus(
                        "error"
                    );

                    setAuthError(
                        message
                    );
                }
            );

        return () => {
            cancelled =
                true;
        };
    }, []);

    /* =====================================================
                     WALLET LISTENERS
       ===================================================== */

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
                if (
                    !account ||
                    !signer
                ) {
                    return;
                }

                if (!accounts.length) {
                    resetConnection();

                    setTransaction({
                        status:
                            "idle",

                        message: "",

                        hash: "",

                        error: "",
                    });

                    return;
                }

                initializeConnection(
                    false
                ).catch(
                    (error) => {
                        const message =
                            getErrorMessage(
                                error
                            );

                        console.error(
                            "Account refresh failed:",
                            error
                        );

                        setTransaction({
                            status:
                                "error",

                            message,

                            hash: "",

                            error:
                                message,
                        });
                    }
                );
            };

        const handleChainChanged =
            () => {
                if (
                    !account ||
                    !signer
                ) {
                    return;
                }

                initializeConnection(
                    false
                ).catch(
                    (error) => {
                        const message =
                            getErrorMessage(
                                error
                            );

                        console.error(
                            "Network refresh failed:",
                            error
                        );

                        setTransaction({
                            status:
                                "error",

                            message,

                            hash: "",

                            error:
                                message,
                        });
                    }
                );
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

    /* =====================================================
                         ROLE STATE
       ===================================================== */

    const normalizedAccount =
        account.toLowerCase();

    const isConnected =
        Boolean(
            account &&
            signer
        );

    const isAuthenticated =
        authStatus ===
        "authenticated";

    const isAuthenticatedWalletConnected =
        Boolean(
            isAuthenticated &&
            account &&
            authenticatedWallet &&
            account.toLowerCase() ===
            authenticatedWallet.toLowerCase()
        );

    const isCorrectNetwork =
        chainId ===
        expectedChainId;

    /* =====================================================
                      MULTIPAYMENT ROLES
       ===================================================== */

    const isProtocolReady =
        Boolean(
            isConnected &&
            isCorrectNetwork &&
            contract
        );

    const isOwner =
        Boolean(
            isProtocolReady &&
            normalizedAccount &&
            owner &&
            normalizedAccount ===
            owner.toLowerCase()
        );

    const isArbitrator =
        Boolean(
            isProtocolReady &&
            normalizedAccount &&
            arbitrator &&
            normalizedAccount ===
            arbitrator.toLowerCase()
        );

    /* =====================================================
                       AGREEMENT ROLES
       ===================================================== */

    const isAgreementReady =
        Boolean(
            isConnected &&
            isCorrectNetwork &&
            agreementContract
        );

    const isAgreementOwner =
        Boolean(
            isAgreementReady &&
            normalizedAccount &&
            agreementOwner &&
            normalizedAccount ===
            agreementOwner.toLowerCase()
        );

    const isAgreementArbitrator =
        Boolean(
            isAgreementReady &&
            normalizedAccount &&
            agreementArbitrator &&
            normalizedAccount ===
            agreementArbitrator.toLowerCase()
        );

    /* =====================================================
                        CONTEXT VALUE
       ===================================================== */

    const value =
        useMemo(
            () => ({
                /* Wallet */

                provider,
                signer,

                account,
                chainId,
                expectedChainId,

                isConnected,
                isCorrectNetwork,
                isConnecting,

                connectWallet,

                /* Authentication */

                authStatus,
                authenticatedWallet,
                authError,
                isAuthenticating,

                isAuthenticated,
                isAuthenticatedWalletConnected,

                authenticate,
                restoreSession,
                logout,

                /* MultiPayment */

                contract,

                owner,
                arbitrator,
                isPaused,

                isProtocolReady,
                isOwner,
                isArbitrator,

                /* Agreement */

                agreementContract,

                agreementOwner,
                agreementArbitrator,
                isAgreementPaused,

                isAgreementReady,
                isAgreementOwner,
                isAgreementArbitrator,

                /* Transactions */

                transaction,

                executeTransaction,

                refreshProtocolState,
                refreshAgreementState,

                clearTransaction,
            }),
            [
                provider,
                signer,

                account,
                chainId,
                expectedChainId,

                isConnected,
                isCorrectNetwork,
                isConnecting,

                connectWallet,

                authStatus,
                authenticatedWallet,
                authError,
                isAuthenticating,

                isAuthenticated,
                isAuthenticatedWalletConnected,

                authenticate,
                restoreSession,
                logout,

                contract,

                owner,
                arbitrator,
                isPaused,

                isProtocolReady,
                isOwner,
                isArbitrator,

                agreementContract,

                agreementOwner,
                agreementArbitrator,
                isAgreementPaused,

                isAgreementReady,
                isAgreementOwner,
                isAgreementArbitrator,

                transaction,

                executeTransaction,

                refreshProtocolState,
                refreshAgreementState,

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