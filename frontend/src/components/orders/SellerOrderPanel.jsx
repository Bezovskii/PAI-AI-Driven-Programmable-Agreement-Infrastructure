import { ethers } from "ethers";
import { useState } from "react";

import { useWeb3 } from "../../hooks/useWeb3.js";

const ERC20_METADATA_ABI = [
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
];

const ORDER_STATUS = [
    "In Escrow",
    "Disputed",
    "Completed",
    "Refunded",
];

const PAYMENT_TYPE = [
    "Direct",
    "Escrow",
];

function shortAddress(address) {
    if (!address) {
        return "-";
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

function buildLifecycle(order) {
    if (!order) {
        return [];
    }

    /*
     * Direct payments do not enter escrow.
     */
    if (order.paymentType === 0) {
        return [
            {
                label: "Created",
                state: "done",
                detail: "Order created",
            },
            {
                label: "Direct payment",
                state: "done",
                detail: "Funds sent directly",
            },
            {
                label: "Completed",
                state: "current success",
                detail: "Transaction completed",
            },
        ];
    }

    /*
     * Escrow status:
     * 0 = In Escrow
     * 1 = Disputed
     * 2 = Completed
     * 3 = Refunded
     */

    if (order.status === 0) {
        return [
            {
                label: "Created",
                state: "done",
                detail: "Order created",
            },
            {
                label: "In Escrow",
                state: "current",
                detail: "Funds protected",
            },
            {
                label: "Outcome",
                state: "pending",
                detail: "Release, dispute or refund",
            },
        ];
    }

    if (order.status === 1) {
        return [
            {
                label: "Created",
                state: "done",
                detail: "Order created",
            },
            {
                label: "In Escrow",
                state: "done",
                detail: "Funds protected",
            },
            {
                label: "Disputed",
                state: "current dispute",
                detail: "Awaiting arbitration",
            },
            {
                label: "Resolution",
                state: "pending",
                detail: "Arbitrator decision",
            },
        ];
    }

    if (order.status === 2) {
        return [
            {
                label: "Created",
                state: "done",
                detail: "Order created",
            },
            {
                label: "In Escrow",
                state: "done",
                detail: "Funds protected",
            },
            {
                label: "Completed",
                state: "current success",
                detail: "Escrow settled",
            },
        ];
    }

    if (order.status === 3) {
        return [
            {
                label: "Created",
                state: "done",
                detail: "Order created",
            },
            {
                label: "In Escrow",
                state: "done",
                detail: "Funds protected",
            },
            {
                label: "Refunded",
                state: "current refund",
                detail: "Funds returned",
            },
        ];
    }

    return [];
}

/*
 * We intentionally reuse the same lifecycle classes
 * used by BuyerOrderPanel so Buyer and Seller see
 * exactly the same protocol-state language.
 */
function OrderLifecycle({ order }) {
    const steps = buildLifecycle(order);

    return (
        <div className="buyerOrderLifecycle">
            <div className="buyerLifecycleHeader">
                <div>
                    <span>
                        ORDER LIFECYCLE
                    </span>

                    <strong>
                        On-chain status
                    </strong>
                </div>

                <small>
                    {order.paymentType === 1
                        ? "ESCROW FLOW"
                        : "DIRECT FLOW"}
                </small>
            </div>

            <div
                className="buyerLifecycleTrack"
                style={{
                    "--lifecycle-columns":
                        steps.length,
                }}
            >
                {steps.map(
                    (step, index) => (
                        <div
                            key={`${step.label}-${index}`}
                            className={`buyerLifecycleStep ${step.state}`}
                        >
                            <div className="buyerLifecycleMarker">
                                <span>
                                    {step.state.includes(
                                        "done"
                                    )
                                        ? "✓"
                                        : step.state.includes(
                                            "current"
                                        )
                                            ? "●"
                                            : ""}
                                </span>
                            </div>

                            {index <
                                steps.length - 1 && (
                                    <div className="buyerLifecycleLine" />
                                )}

                            <div className="buyerLifecycleText">
                                <strong>
                                    {step.label}
                                </strong>

                                <small>
                                    {step.detail}
                                </small>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

export default function SellerOrderPanel() {
    const {
        account,
        provider,
        contract,
        isConnected,
        isCorrectNetwork,
        executeTransaction,
    } = useWeb3();

    const [orderId, setOrderId] =
        useState("");

    const [order, setOrder] =
        useState(null);

    const [isLoading, setIsLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [notice, setNotice] =
        useState("");

    function validateConnection() {
        if (
            !isConnected ||
            !contract ||
            !provider
        ) {
            throw new Error(
                "Connect your wallet first."
            );
        }

        if (!isCorrectNetwork) {
            throw new Error(
                "Switch your wallet to the expected network."
            );
        }
    }

    function validateOrderId() {
        const parsedOrderId =
            Number(orderId);

        if (
            !Number.isInteger(
                parsedOrderId
            ) ||
            parsedOrderId <= 0
        ) {
            throw new Error(
                "Enter a valid order ID greater than zero."
            );
        }

        return parsedOrderId;
    }

    async function getAssetMetadata(
        tokenAddress
    ) {
        if (
            tokenAddress.toLowerCase() ===
            ethers.ZeroAddress.toLowerCase()
        ) {
            return {
                symbol: "ETH",
                decimals: 18,
            };
        }

        const tokenContract =
            new ethers.Contract(
                tokenAddress,
                ERC20_METADATA_ABI,
                provider
            );

        const [
            symbol,
            decimalsResult,
        ] = await Promise.all([
            tokenContract.symbol(),
            tokenContract.decimals(),
        ]);

        return {
            symbol,
            decimals:
                Number(decimalsResult),
        };
    }

    async function fetchOrder() {
        validateConnection();

        const parsedOrderId =
            validateOrderId();

        const result =
            await contract.orderById(
                parsedOrderId
            );

        const exists =
            Boolean(result[7]);

        if (!exists) {
            throw new Error(
                `Order #${parsedOrderId} does not exist.`
            );
        }

        const tokenAddress =
            result[3];

        const metadata =
            await getAssetMetadata(
                tokenAddress
            );

        const parsedOrder = {
            id: result[0].toString(),

            buyer: result[1],

            seller: result[2],

            token: tokenAddress,

            amount: result[4],

            formattedAmount:
                `${ethers.formatUnits(
                    result[4],
                    metadata.decimals
                )} ${metadata.symbol}`,

            assetSymbol:
                metadata.symbol,

            paymentType:
                Number(result[5]),

            status:
                Number(result[6]),

            exists,
        };

        setOrder(parsedOrder);

        return parsedOrder;
    }

    async function loadOrder() {
        try {
            setError("");
            setNotice("");
            setOrder(null);
            setIsLoading(true);

            const loadedOrder =
                await fetchOrder();

            setNotice(
                `Order #${loadedOrder.id} loaded successfully.`
            );
        } catch (loadError) {
            console.error(loadError);

            setOrder(null);

            setError(
                getErrorMessage(
                    loadError
                )
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function runOrderAction({
        action,
        pendingMessage,
        submittedMessage,
        successMessage,
    }) {
        try {
            setError("");
            setNotice("");
            setIsLoading(true);

            validateConnection();

            if (!order) {
                throw new Error(
                    "Load an order first."
                );
            }

            await executeTransaction({
                action,
                pendingMessage,
                submittedMessage,
                successMessage,
            });

            await fetchOrder();

            setNotice(
                successMessage
            );
        } catch (actionError) {
            console.error(actionError);

            setError(
                getErrorMessage(
                    actionError
                )
            );
        } finally {
            setIsLoading(false);
        }
    }

    const normalizedAccount =
        account?.toLowerCase() || "";

    const isSeller = Boolean(
        order &&
        normalizedAccount &&
        normalizedAccount ===
        order.seller.toLowerCase()
    );

    const isBuyer = Boolean(
        order &&
        normalizedAccount &&
        normalizedAccount ===
        order.buyer.toLowerCase()
    );

    const isEscrowOrder =
        order?.paymentType === 1;

    const isInEscrow =
        order?.status === 0;

    const canRefund =
        isSeller &&
        isEscrowOrder &&
        isInEscrow;

    const canOpenDispute =
        (isSeller || isBuyer) &&
        isEscrowOrder &&
        isInEscrow;

    let orderRole =
        "Not a participant";

    if (isSeller) {
        orderRole = "Seller";
    } else if (isBuyer) {
        orderRole = "Buyer";
    }

    return (
        <section className="sellerOrderPanel">
            <div className="sellerOrderHeader">
                <div>
                    <span className="eyebrow">
                        Seller / Order management
                    </span>

                    <h2>
                        Find an incoming order
                    </h2>

                    <p>
                        Load an on-chain Order ID,
                        verify your seller role and
                        inspect the current escrow
                        lifecycle.
                    </p>
                </div>
            </div>

            <div className="sellerOrderSearch">
                <div>
                    <label
                        htmlFor="seller-order-id"
                    >
                        Order ID
                    </label>

                    <input
                        id="seller-order-id"
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder="Example: 1"
                        value={orderId}
                        onChange={(event) =>
                            setOrderId(
                                event.target
                                    .value
                            )
                        }
                        onKeyDown={(event) => {
                            if (
                                event.key ===
                                "Enter"
                            ) {
                                loadOrder();
                            }
                        }}
                    />
                </div>

                <button
                    type="button"
                    className="primary"
                    onClick={loadOrder}
                    disabled={
                        isLoading ||
                        !isConnected ||
                        !isCorrectNetwork
                    }
                >
                    {isLoading
                        ? "Loading..."
                        : "Find order"}
                </button>
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

            {!order && !error && (
                <div className="emptyState">
                    No order loaded. Enter an
                    Order ID to inspect the
                    transaction and seller
                    permissions.
                </div>
            )}

            {order && (
                <div className="sellerOrderCard">
                    <div className="sellerOrderTop">
                        <div>
                            <span>
                                ORDER
                            </span>

                            <h3>
                                #{order.id}
                            </h3>
                        </div>

                        <span
                            className={`badge ${[
                                    "escrow",
                                    "disputed",
                                    "completed",
                                    "refunded",
                                ][
                                order.status
                                ] || ""
                                }`}
                        >
                            {ORDER_STATUS[
                                order.status
                            ] || "Unknown"}
                        </span>
                    </div>

                    <OrderLifecycle
                        order={order}
                    />

                    <div className="sellerOrderDetails">
                        <div>
                            <span>
                                Buyer
                            </span>

                            <strong
                                className="mono"
                                title={
                                    order.buyer
                                }
                            >
                                {shortAddress(
                                    order.buyer
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Seller
                            </span>

                            <strong
                                className="mono"
                                title={
                                    order.seller
                                }
                            >
                                {shortAddress(
                                    order.seller
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Amount
                            </span>

                            <strong>
                                {
                                    order.formattedAmount
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Asset
                            </span>

                            <strong>
                                {
                                    order.assetSymbol
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Protection
                            </span>

                            <strong>
                                {PAYMENT_TYPE[
                                    order.paymentType
                                ] || "Unknown"}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Connected role
                            </span>

                            <strong>
                                {orderRole}
                            </strong>
                        </div>
                    </div>

                    {!isSeller && (
                        <div className="sellerAccessWarning">
                            The connected wallet is
                            not the seller for this
                            order. Seller-only
                            actions are unavailable.
                        </div>
                    )}

                    {isSeller &&
                        order.status === 1 && (
                            <div className="sellerAccessNotice">
                                This order is
                                disputed. Escrow is
                                awaiting protocol
                                arbitration.
                            </div>
                        )}

                    {isSeller &&
                        order.status === 2 && (
                            <div className="sellerAccessNotice">
                                This transaction is
                                completed. The escrow
                                is no longer active.
                            </div>
                        )}

                    {isSeller &&
                        order.status === 3 && (
                            <div className="sellerAccessNotice">
                                This order has been
                                refunded. The escrow
                                is no longer active.
                            </div>
                        )}

                    {isSeller &&
                        !isEscrowOrder && (
                            <div className="sellerAccessNotice">
                                This was a direct
                                payment and therefore
                                has no active escrow
                                controls.
                            </div>
                        )}

                    <div className="sellerOrderActions">
                        {canRefund && (
                            <button
                                type="button"
                                className="secondary"
                                disabled={
                                    isLoading
                                }
                                onClick={() =>
                                    runOrderAction({
                                        action: () =>
                                            contract.refund(
                                                Number(
                                                    order.id
                                                )
                                            ),

                                        pendingMessage:
                                            "Confirm the refund in your wallet.",

                                        submittedMessage:
                                            `Refund for Order #${order.id} submitted.`,

                                        successMessage:
                                            `Order #${order.id} refunded successfully.`,
                                    })
                                }
                            >
                                Refund buyer
                            </button>
                        )}

                        {canOpenDispute && (
                            <button
                                type="button"
                                className="danger"
                                disabled={
                                    isLoading
                                }
                                onClick={() =>
                                    runOrderAction({
                                        action: () =>
                                            contract.openDispute(
                                                Number(
                                                    order.id
                                                )
                                            ),

                                        pendingMessage:
                                            "Confirm the dispute in your wallet.",

                                        submittedMessage:
                                            `Dispute for Order #${order.id} submitted.`,

                                        successMessage:
                                            `Dispute opened for Order #${order.id}.`,
                                    })
                                }
                            >
                                Open dispute
                            </button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}