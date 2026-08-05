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

export default function SellerOrderPanel() {
    const {
        account,
        provider,
        contract,
        isConnected,
        isCorrectNetwork,
        executeTransaction,
    } = useWeb3();

    const [orderId, setOrderId] = useState("");
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    function validateConnection() {
        if (!isConnected || !contract || !provider) {
            throw new Error("Connect your wallet first.");
        }

        if (!isCorrectNetwork) {
            throw new Error(
                "Switch your wallet to the expected network."
            );
        }
    }

    function validateOrderId() {
        const parsedOrderId = Number(orderId);

        if (
            !Number.isInteger(parsedOrderId) ||
            parsedOrderId <= 0
        ) {
            throw new Error(
                "Enter a valid order ID greater than zero."
            );
        }

        return parsedOrderId;
    }

    async function getAssetMetadata(tokenAddress) {
        if (
            tokenAddress.toLowerCase() ===
            ethers.ZeroAddress.toLowerCase()
        ) {
            return {
                symbol: "ETH",
                decimals: 18,
            };
        }

        const tokenContract = new ethers.Contract(
            tokenAddress,
            ERC20_METADATA_ABI,
            provider
        );

        const [symbol, decimalsResult] =
            await Promise.all([
                tokenContract.symbol(),
                tokenContract.decimals(),
            ]);

        return {
            symbol,
            decimals: Number(decimalsResult),
        };
    }

    async function loadOrder() {
        try {
            setError("");
            setNotice("");
            setIsLoading(true);

            validateConnection();

            const parsedOrderId = validateOrderId();
            const result =
                await contract.orderById(parsedOrderId);

            const exists = Boolean(result[7]);

            if (!exists) {
                throw new Error(
                    `Order #${parsedOrderId} does not exist.`
                );
            }

            const tokenAddress = result[3];
            const metadata =
                await getAssetMetadata(tokenAddress);

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
                assetSymbol: metadata.symbol,
                paymentType: Number(result[5]),
                status: Number(result[6]),
                exists,
            };

            setOrder(parsedOrder);
            setNotice(
                `Order #${parsedOrder.id} loaded successfully.`
            );
        } catch (loadError) {
            console.error(loadError);
            setOrder(null);
            setError(getErrorMessage(loadError));
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
                throw new Error("Load an order first.");
            }

            await executeTransaction({
                action,
                pendingMessage,
                submittedMessage,
                successMessage,
            });

            await loadOrder();
            setNotice(successMessage);
        } catch (actionError) {
            console.error(actionError);
            setError(getErrorMessage(actionError));
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

    return (
        <section className="sellerOrderPanel">
            <div className="sellerOrderHeader">
                <div>
                    <span className="eyebrow">
                        Seller order management
                    </span>

                    <h2>Find an incoming order</h2>

                    <p>
                        Enter an order ID to verify whether
                        your connected wallet is recorded as
                        the seller.
                    </p>
                </div>
            </div>

            <div className="sellerOrderSearch">
                <div>
                    <label htmlFor="seller-order-id">
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
                            setOrderId(event.target.value)
                        }
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

            {!order && (
                <div className="emptyState">
                    No order loaded. Enter an order ID
                    to view its details.
                </div>
            )}

            {order && (
                <div className="sellerOrderCard">
                    <div className="sellerOrderTop">
                        <div>
                            <span>Order</span>
                            <h3>#{order.id}</h3>
                        </div>

                        <span
                            className={`badge ${[
                                    "escrow",
                                    "disputed",
                                    "completed",
                                    "refunded",
                                ][order.status] || ""
                                }`}
                        >
                            {ORDER_STATUS[order.status] ||
                                "Unknown"}
                        </span>
                    </div>

                    <div className="sellerOrderDetails">
                        <div>
                            <span>Buyer</span>
                            <strong>
                                {shortAddress(order.buyer)}
                            </strong>
                        </div>

                        <div>
                            <span>Seller</span>
                            <strong>
                                {shortAddress(order.seller)}
                            </strong>
                        </div>

                        <div>
                            <span>Amount</span>
                            <strong>
                                {order.formattedAmount}
                            </strong>
                        </div>

                        <div>
                            <span>Asset</span>
                            <strong>
                                {order.assetSymbol}
                            </strong>
                        </div>

                        <div>
                            <span>Payment type</span>
                            <strong>
                                {PAYMENT_TYPE[
                                    order.paymentType
                                ] || "Unknown"}
                            </strong>
                        </div>

                        <div>
                            <span>Your order role</span>
                            <strong>
                                {isSeller
                                    ? "Seller"
                                    : isBuyer
                                        ? "Buyer"
                                        : "Not a participant"}
                            </strong>
                        </div>
                    </div>

                    {!isSeller && (
                        <div className="sellerAccessWarning">
                            The connected wallet is not the
                            seller for this order. Seller actions
                            are unavailable.
                        </div>
                    )}

                    {isSeller &&
                        (!isEscrowOrder || !isInEscrow) && (
                            <div className="sellerAccessNotice">
                                This order has no currently
                                available seller action.
                            </div>
                        )}

                    <div className="sellerOrderActions">
                        {canRefund && (
                            <button
                                type="button"
                                className="secondary"
                                disabled={isLoading}
                                onClick={() =>
                                    runOrderAction({
                                        action: () =>
                                            contract.refund(
                                                Number(order.id)
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
                                disabled={isLoading}
                                onClick={() =>
                                    runOrderAction({
                                        action: () =>
                                            contract.openDispute(
                                                Number(order.id)
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