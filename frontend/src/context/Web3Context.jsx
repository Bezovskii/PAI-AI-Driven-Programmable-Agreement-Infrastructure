import { ethers } from "ethers";
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    createEsctAgreementTransport,
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
                       ESCT SETTLEMENT STATE
       ===================================================== */

    const [
        esctSettlementContract,
        setEsctSettlementContract,
    ] = useState(null);

    const [
        esctSettlementOwner,
        setEsctSettlementOwner,
    ] = useState("");

    const [
        esctSettlementArbitrator,
        setEsctSettlementArbitrator,
    ] = useState("");

    const [
        isEsctSettlementPaused,
        setIsEsctSettlementPaused,
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
                     CLEAR ESCT SETTLEMENT
       ===================================================== */

    const clearEsctSettlementState =
        useCallback(() => {
            setEsctSettlementContract(null);
            setEsctSettlementOwner("");
            setEsctSettlementArbitrator("");
            setIsEsctSettlementPaused(false);
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

            clearEsctSettlementState();
        }, [
            clearEsctSettlementState,
        ]);


    /* =====================================================
                   LOAD ESCT SETTLEMENT STATE
       ===================================================== */

    const loadEsctSettlementState =
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

                setEsctSettlementOwner(
                    protocolOwner
                );

                setEsctSettlementArbitrator(
                    protocolArbitrator
                );

                setIsEsctSettlementPaused(
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
                            clearEsctSettlementState();

                    return true;
                }
                /* =========================================
                   LEGACY AGREEMENT TRANSPORT
                   ========================================= */

                const {
                    agreementContract:
                        loadedEsctSettlementContract,
                    address:
                        esctSettlementTransportAddress,
                } =
                    await createEsctAgreementTransport({
                        provider:
                            browserProvider,

                        signer:
                            walletSigner,

                        chainId:
                            detectedChainId,
                    });

                if (!loadedEsctSettlementContract) {
                    clearEsctSettlementState();

                    console.warn(
                        `ESCT settlement transport is unavailable at ${esctSettlementTransportAddress} on chain ${detectedChainId}.`
                    );

                    return true;
                }

                await loadEsctSettlementState(
                    loadedEsctSettlementContract
                );

                setEsctSettlementContract(
                    loadedEsctSettlementContract
                );

                return true;
            },
            [
                clearEsctSettlementState,
                expectedChainId,
                loadEsctSettlementState,
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
                  REFRESH ESCT SETTLEMENT STATE
       ===================================================== */

    const refreshEsctSettlementState =
        useCallback(
            async () => {
                if (
                    !esctSettlementContract
                ) {
                    return;
                }

                try {
                    await loadEsctSettlementState(
                        esctSettlementContract
                    );
                } catch (error) {
                    console.error(
                        "Unable to refresh ESCT settlement state:",
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
                esctSettlementContract,
                loadEsctSettlementState,
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

                    await refreshEsctSettlementState();

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
                refreshEsctSettlementState,
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
                       AGREEMENT ROLES
       ===================================================== */

    const isEsctSettlementReady =
        Boolean(
            isConnected &&
            isCorrectNetwork &&
            esctSettlementContract
        );

    const isEsctSettlementOwner =
        Boolean(
            isEsctSettlementReady &&
            normalizedAccount &&
            esctSettlementOwner &&
            normalizedAccount ===
            esctSettlementOwner.toLowerCase()
        );

    const isEsctSettlementArbitrator =
        Boolean(
            isEsctSettlementReady &&
            normalizedAccount &&
            esctSettlementArbitrator &&
            normalizedAccount ===
            esctSettlementArbitrator.toLowerCase()
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


                /* ESCT settlement integration */

                esctSettlementContract,

                esctSettlementOwner,
                esctSettlementArbitrator,
                isEsctSettlementPaused,

                isEsctSettlementReady,
                isEsctSettlementOwner,
                isEsctSettlementArbitrator,

                /* Transactions */

                transaction,

                executeTransaction,

                refreshEsctSettlementState,

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




                esctSettlementContract,

                esctSettlementOwner,
                esctSettlementArbitrator,
                isEsctSettlementPaused,

                isEsctSettlementReady,
                isEsctSettlementOwner,
                isEsctSettlementArbitrator,

                transaction,

                executeTransaction,

                refreshEsctSettlementState,

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