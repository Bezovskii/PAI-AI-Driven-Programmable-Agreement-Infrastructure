import { ethers } from "ethers";
import { useState } from "react";

import { useWeb3 } from "../../hooks/useWeb3.js";
import "./BuyerOrderPanel.css";

const ERC20_METADATA_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
];

const ORDER_STATUS = [
    "In Escrow",
    "Disputed",
    "Completed",
    "Refunded",
];

function shortAddress(address) {
    if (!address) return "-";

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

export default function BuyerOrderPanel() {
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
        if (!isConnected || !provider || !contract) {
            throw new Error("Connect your wallet first.");
        }

        if (!isCorrectNetwork) {
            throw new Error(
                "Switch to the expected network first."
            );
        }
    }

    function parseOrderId() {
        const parsed = Number(orderId);

        if (
            !Number.isInteger(parsed) ||
            parsed <= 0
        ) {
            throw new Error(
                "Enter a valid Order ID."
            );
        }

        return parsed;
    }

    async function getTokenMetadata(tokenAddress) {
        if (
            tokenAddress.toLowerCase() ===
            ethers.ZeroAddress.toLowerCase()
        ) {
            return {
                symbol: "ETH",
                decimals: 18,
            };
        }

        const token = new ethers.Contract(
            tokenAddress,
            ERC20_METADATA_ABI,
            provider
        );

        const [symbol, decimals] =
            await Promise.all([
                token.symbol(),
                token.decimals(),
            ]);

        return {
            symbol,
            decimals: Number(decimals),
        };
    }

    async function fetchOrder(showNotice = true) {
        validateConnection();

        const parsedOrderId = parseOrderId();

        const result =
            await contract.orderById(
                parsedOrderId
            );

        if (!Boolean(result[7])) {
            throw new Error(
                `Order #${parsedOrderId} does not exist.`
            );
        }

        const metadata =
            await getTokenMetadata(
                result[3]
            );

        const parsedOrder = {
            id: result[0].toString(),
            buyer: result[1],
            seller: result[2],

            amount: `${ethers.formatUnits(
                result[4],
                metadata.decimals
            )} ${metadata.symbol}`,

            paymentType:
                Number(result[5]),

            status:
                Number(result[6]),
        };

        setOrder(parsedOrder);

        if (showNotice) {
            setNotice(
                `Order #${parsedOrder.id} loaded.`
            );
        }

        return parsedOrder;
    }

    async function loadOrder() {
        try {
            setError("");
            setNotice("");
            setOrder(null);
            setIsLoading(true);

            await fetchOrder(true);
        } catch (loadError) {
            setError(
                getErrorMessage(loadError)
            );
        } finally {
            setIsLoading(false);
        }
    }

    const isBuyer = Boolean(
        order &&
        account &&
        account.toLowerCase() ===
        order.buyer.toLowerCase()
    );

    const canManage =
        isBuyer &&
        order?.paymentType === 1 &&
        order?.status === 0;

    async function confirmReceipt() {
        try {
            setError("");
            setNotice("");
            setIsLoading(true);

            if (!canManage) {
                throw new Error(
                    "This order cannot be confirmed by the connected wallet."
                );
            }

            await executeTransaction({
                action: () =>
                    contract.confirmReceipt(
                        Number(order.id)
                    ),

                pendingMessage:
                    "Confirm release to seller.",

                submittedMessage:
                    `Order #${order.id} confirmation submitted.`,

                successMessage:
                    `Order #${order.id} completed.`,
            });

            await fetchOrder(false);

            setNotice(
                `Order #${order.id} completed. Funds released to seller.`
            );
        } catch (actionError) {
            setError(
                getErrorMessage(actionError)
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function openDispute() {
        try {
            setError("");
            setNotice("");
            setIsLoading(true);

            if (!canManage) {
                throw new Error(
                    "This order cannot be disputed by the connected wallet."
                );
            }

            await executeTransaction({
                action: () =>
                    contract.openDispute(
                        Number(order.id)
                    ),

                pendingMessage:
                    "Confirm opening dispute.",

                submittedMessage:
                    `Order #${order.id} dispute submitted.`,

                successMessage:
                    `Order #${order.id} is now disputed.`,
            });

            await fetchOrder(false);

            setNotice(
                `Order #${order.id} is now disputed.`
            );
        } catch (actionError) {
            setError(
                getErrorMessage(actionError)
            );
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <section className="buyerOrderPanel">
            <div className="buyerOrderHeading">
                <div>
                    <span className="buyerOrderEyebrow">
                        Existing transaction
                    </span>

                    <h2>
                        Find your order
                    </h2>

                    <p>
                        Enter the Order ID generated
                        when the payment was created.
                    </p>
                </div>
            </div>

            <div className="buyerOrderLookup">
                <div className="buyerOrderInput">
                    <label htmlFor="buyer-order-id">
                        Order ID
                    </label>

                    <input
                        id="buyer-order-id"
                        type="number"
                        min="1"
                        placeholder="Example: 2"
                        value={orderId}
                        onChange={(event) =>
                            setOrderId(
                                event.target.value
                            )
                        }
                    />
                </div>

                <button
                    type="button"
                    className="buyerOrderLoadButton"
                    onClick={loadOrder}
                    disabled={
                        isLoading ||
                        !isConnected ||
                        !isCorrectNetwork
                    }
                >
                    {isLoading
                        ? "Loading..."
                        : "Load order"}
                </button>
            </div>

            {error && (
                <div className="buyerOrderError">
                    {error}
                </div>
            )}

            {notice && (
                <div className="buyerOrderNotice">
                    {notice}
                </div>
            )}

            {order && (
                <div className="buyerLoadedOrder">
                    <div className="buyerLoadedOrderTop">
                        <div>
                            <span>
                                ORDER
                            </span>

                            <h3>
                                #{order.id}
                            </h3>
                        </div>

                        <span
                            className={`buyerOrderStatus status-${order.status}`}
                        >
                            {ORDER_STATUS[
                                order.status
                            ] || "Unknown"}
                        </span>
                    </div>

                    <div className="buyerOrderData">
                        <div>
                            <span>Seller</span>

                            <strong>
                                {shortAddress(
                                    order.seller
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>Amount</span>

                            <strong>
                                {order.amount}
                            </strong>
                        </div>

                        <div>
                            <span>Buyer</span>

                            <strong>
                                {shortAddress(
                                    order.buyer
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>Type</span>

                            <strong>
                                {order.paymentType ===
                                    1
                                    ? "Escrow"
                                    : "Direct"}
                            </strong>
                        </div>
                    </div>

                    {!isBuyer && (
                        <div className="buyerOrderWarning">
                            Connected wallet is not
                            the buyer of this order.
                        </div>
                    )}

                    {order.status === 0 &&
                        isBuyer && (
                            <div className="buyerOrderActions">
                                <button
                                    type="button"
                                    className="buyerConfirmButton"
                                    onClick={
                                        confirmReceipt
                                    }
                                    disabled={
                                        isLoading
                                    }
                                >
                                    Confirm & release
                                </button>

                                <button
                                    type="button"
                                    className="buyerDisputeButton"
                                    onClick={
                                        openDispute
                                    }
                                    disabled={
                                        isLoading
                                    }
                                >
                                    Open dispute
                                </button>
                            </div>
                        )}
                </div>
            )}
        </section>
    );
}