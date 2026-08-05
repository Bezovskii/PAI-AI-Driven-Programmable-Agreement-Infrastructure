import { ethers } from "ethers";
import { useState } from "react";

import { contractAddress } from "../../contract/contractAddress.js";
import { useWeb3 } from "../../hooks/useWeb3.js";

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
];

function errorMessage(error) {
    return (
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "The transaction could not be completed."
    );
}

export default function BuyerPaymentPanel() {
    const {
        account,
        signer,
        contract,
        isConnected,
        isCorrectNetwork,
        isPaused,
        executeTransaction,
    } = useWeb3();

    const [asset, setAsset] = useState("ETH");
    const [paymentType, setPaymentType] = useState("ESCROW");

    const [seller, setSeller] = useState("");
    const [amount, setAmount] = useState("");
    const [tokenAddress, setTokenAddress] = useState("");

    const [createdOrderId, setCreatedOrderId] = useState("");
    const [formError, setFormError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    function validateBaseFields() {
        if (!isConnected || !contract || !signer) {
            throw new Error("Connect your wallet first.");
        }

        if (!isCorrectNetwork) {
            throw new Error("Switch to the expected network first.");
        }

        if (isPaused) {
            throw new Error(
                "New payments are currently paused by the protocol administrator."
            );
        }

        if (!ethers.isAddress(seller)) {
            throw new Error("Enter a valid seller wallet address.");
        }

        if (seller.toLowerCase() === account.toLowerCase()) {
            throw new Error(
                "Buyer and seller must use different wallet addresses."
            );
        }

        if (!amount || Number(amount) <= 0) {
            throw new Error("Enter an amount greater than zero.");
        }
    }

    async function getTokenDetails() {
        if (!ethers.isAddress(tokenAddress)) {
            throw new Error("Enter a valid ERC20 token address.");
        }

        const token = new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            signer
        );

        const [decimals, symbol] = await Promise.all([
            token.decimals(),
            token.symbol(),
        ]);

        return {
            token,
            decimals: Number(decimals),
            symbol,
            parsedAmount: ethers.parseUnits(
                amount,
                Number(decimals)
            ),
        };
    }

    async function approveToken() {
        try {
            setFormError("");
            setIsSubmitting(true);
            validateBaseFields();

            if (asset !== "ERC20") {
                throw new Error(
                    "Select ERC20 before approving a token."
                );
            }

            const {
                token,
                symbol,
                parsedAmount,
            } = await getTokenDetails();

            await executeTransaction({
                action: () =>
                    token.approve(
                        contractAddress,
                        parsedAmount
                    ),
                pendingMessage: `Approve ${symbol} spending in your wallet.`,
                submittedMessage: `${symbol} approval submitted.`,
                successMessage: `${symbol} approval confirmed.`,
            });
        } catch (error) {
            setFormError(errorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    async function createPayment() {
        try {
            setFormError("");
            setCreatedOrderId("");
            setIsSubmitting(true);

            validateBaseFields();

            if (asset === "ETH") {
                const value = ethers.parseEther(amount);

                await executeTransaction({
                    action: () =>
                        paymentType === "DIRECT"
                            ? contract.createDirectPayment(
                                seller,
                                { value }
                            )
                            : contract.createEscrowPayment(
                                seller,
                                { value }
                            ),
                    pendingMessage:
                        paymentType === "DIRECT"
                            ? "Confirm the direct ETH payment."
                            : "Confirm the ETH escrow payment.",
                    submittedMessage:
                        paymentType === "DIRECT"
                            ? "Direct ETH payment submitted."
                            : "ETH escrow submitted.",
                    successMessage:
                        paymentType === "DIRECT"
                            ? "Direct ETH payment confirmed."
                            : "ETH escrow created successfully.",
                });
            } else {
                const { parsedAmount, symbol } =
                    await getTokenDetails();

                await executeTransaction({
                    action: () =>
                        paymentType === "DIRECT"
                            ? contract.createERC20DirectPayment(
                                seller,
                                tokenAddress,
                                parsedAmount
                            )
                            : contract.createERC20EscrowPayment(
                                seller,
                                tokenAddress,
                                parsedAmount
                            ),
                    pendingMessage:
                        paymentType === "DIRECT"
                            ? `Confirm the direct ${symbol} payment.`
                            : `Confirm the ${symbol} escrow payment.`,
                    submittedMessage:
                        paymentType === "DIRECT"
                            ? `Direct ${symbol} payment submitted.`
                            : `${symbol} escrow submitted.`,
                    successMessage:
                        paymentType === "DIRECT"
                            ? `Direct ${symbol} payment confirmed.`
                            : `${symbol} escrow created successfully.`,
                });
            }

            const nextOrderId =
                await contract.nextOrderId();

            setCreatedOrderId(
                (nextOrderId - 1n).toString()
            );
        } catch (error) {
            setFormError(errorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <section className="buyerPaymentPanel">
            <div className="buyerPaymentHeader">
                <div>
                    <span className="eyebrow">
                        New transaction
                    </span>
                    <h2>Create a payment</h2>
                    <p>
                        Direct payments are released immediately.
                        Escrow payments remain protected until
                        confirmation, refund, or dispute resolution.
                    </p>
                </div>

                <span
                    className={
                        isPaused
                            ? "protocolState paused"
                            : "protocolState active"
                    }
                >
                    {isPaused
                        ? "New payments paused"
                        : "Payments active"}
                </span>
            </div>

            <div className="paymentChoiceGrid">
                <div>
                    <label>Asset</label>

                    <div className="segmentedControl">
                        <button
                            type="button"
                            className={
                                asset === "ETH" ? "active" : ""
                            }
                            onClick={() => setAsset("ETH")}
                        >
                            ETH
                        </button>

                        <button
                            type="button"
                            className={
                                asset === "ERC20" ? "active" : ""
                            }
                            onClick={() => setAsset("ERC20")}
                        >
                            ERC20
                        </button>
                    </div>
                </div>

                <div>
                    <label>Protection</label>

                    <div className="segmentedControl">
                        <button
                            type="button"
                            className={
                                paymentType === "DIRECT"
                                    ? "active"
                                    : ""
                            }
                            onClick={() =>
                                setPaymentType("DIRECT")
                            }
                        >
                            Direct
                        </button>

                        <button
                            type="button"
                            className={
                                paymentType === "ESCROW"
                                    ? "active"
                                    : ""
                            }
                            onClick={() =>
                                setPaymentType("ESCROW")
                            }
                        >
                            Escrow
                        </button>
                    </div>
                </div>
            </div>

            <div className="paymentFormGrid">
                <div className="fullField">
                    <label htmlFor="seller">
                        Seller wallet
                    </label>

                    <input
                        id="seller"
                        type="text"
                        placeholder="0x..."
                        value={seller}
                        onChange={(event) =>
                            setSeller(event.target.value.trim())
                        }
                    />
                </div>

                {asset === "ERC20" && (
                    <div className="fullField">
                        <label htmlFor="tokenAddress">
                            Token contract
                        </label>

                        <input
                            id="tokenAddress"
                            type="text"
                            placeholder="0x ERC20 token address"
                            value={tokenAddress}
                            onChange={(event) =>
                                setTokenAddress(
                                    event.target.value.trim()
                                )
                            }
                        />
                    </div>
                )}

                <div className="fullField">
                    <label htmlFor="amount">
                        {asset === "ETH"
                            ? "ETH amount"
                            : "Token amount"}
                    </label>

                    <input
                        id="amount"
                        type="number"
                        min="0"
                        step="any"
                        placeholder={
                            asset === "ETH" ? "0.01" : "100"
                        }
                        value={amount}
                        onChange={(event) =>
                            setAmount(event.target.value)
                        }
                    />
                </div>
            </div>

            <div className="paymentSummary">
                <div>
                    <span>Payment method</span>
                    <strong>
                        {paymentType === "ESCROW"
                            ? "Protected escrow"
                            : "Immediate direct payment"}
                    </strong>
                </div>

                <div>
                    <span>Asset</span>
                    <strong>{asset}</strong>
                </div>

                <div>
                    <span>Connected buyer</span>
                    <strong>
                        {account
                            ? `${account.slice(0, 6)}...${account.slice(-4)}`
                            : "Wallet not connected"}
                    </strong>
                </div>
            </div>

            {formError && (
                <div className="paymentFormError">
                    {formError}
                </div>
            )}

            {createdOrderId && (
                <div className="createdOrderNotice">
                    Payment created successfully. Order #
                    {createdOrderId}
                </div>
            )}

            <div className="paymentActions">
                {asset === "ERC20" && (
                    <button
                        type="button"
                        className="secondary"
                        onClick={approveToken}
                        disabled={isSubmitting}
                    >
                        Approve token
                    </button>
                )}

                <button
                    type="button"
                    className="primary"
                    onClick={createPayment}
                    disabled={
                        isSubmitting ||
                        !isConnected ||
                        !isCorrectNetwork ||
                        isPaused
                    }
                >
                    {isSubmitting
                        ? "Processing..."
                        : paymentType === "ESCROW"
                            ? "Create escrow"
                            : "Send direct payment"}
                </button>
            </div>
        </section>
    );
}