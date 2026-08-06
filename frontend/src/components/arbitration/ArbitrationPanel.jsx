import { useState } from "react";
import { ethers } from "ethers";

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

export default function ArbitrationPanel() {
  const {
    account,
    provider,
    contract,
    isConnected,
    isCorrectNetwork,
    isArbitrator,
    arbitrator,
    executeTransaction,
  } = useWeb3();

  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function validateAccess() {
    if (!isConnected || !contract || !provider) {
      throw new Error("Connect your wallet first.");
    }

    if (!isCorrectNetwork) {
      throw new Error(
        "Switch your wallet to the expected network."
      );
    }

    if (!isArbitrator) {
      throw new Error(
        "The connected wallet is not the current protocol arbitrator."
      );
    }
  }

  function parseOrderId() {
    const parsed = Number(orderId);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        "Enter a valid order ID greater than zero."
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

    const [symbol, decimals] = await Promise.all([
      token.symbol(),
      token.decimals(),
    ]);

    return {
      symbol,
      decimals: Number(decimals),
    };
  }

  async function fetchOrder(showSuccessNotice = true) {
    validateAccess();

    const id = parseOrderId();
    const result = await contract.orderById(id);

    if (!Boolean(result[7])) {
      throw new Error(`Order #${id} does not exist.`);
    }

    const metadata = await getTokenMetadata(result[3]);

    const parsedOrder = {
      id: result[0].toString(),
      buyer: result[1],
      seller: result[2],
      token: result[3],
      formattedAmount: `${ethers.formatUnits(
        result[4],
        metadata.decimals
      )} ${metadata.symbol}`,
      assetSymbol: metadata.symbol,
      paymentType: Number(result[5]),
      status: Number(result[6]),
    };

    setOrder(parsedOrder);

    if (showSuccessNotice) {
      setNotice(
        `Order #${parsedOrder.id} loaded successfully.`
      );
    }

    return parsedOrder;
  }

  async function loadOrder() {
    try {
      setError("");
      setNotice("");
      setIsLoading(true);

      await fetchOrder(true);
    } catch (loadError) {
      console.error(loadError);
      setOrder(null);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function resolveDispute(releaseToSeller) {
    try {
      setError("");
      setNotice("");
      setIsLoading(true);

      validateAccess();

      if (!order) {
        throw new Error(
          "Load a disputed order first."
        );
      }

      if (order.status !== 1) {
        throw new Error(
          "Only disputed orders can be resolved."
        );
      }

      const recipient = releaseToSeller
        ? "seller"
        : "buyer";

      await executeTransaction({
        action: () =>
          contract.resolveDispute(
            Number(order.id),
            releaseToSeller
          ),

        pendingMessage:
          `Confirm resolution in favor of the ${recipient}.`,

        submittedMessage:
          `Resolution for Order #${order.id} submitted.`,

        successMessage:
          `Order #${order.id} resolved in favor of the ${recipient}.`,
      });

      await fetchOrder(false);

      setNotice(
        `Order #${order.id} resolved in favor of the ${recipient}.`
      );
    } catch (actionError) {
      console.error(actionError);
      setError(getErrorMessage(actionError));
    } finally {
      setIsLoading(false);
    }
  }

  const canResolve =
    Boolean(order && isArbitrator && order.status === 1);

  const statusClass =
    [
      "escrow",
      "disputed",
      "completed",
      "refunded",
    ][order?.status] || "";

  return (
    <section className="arbitrationPanel">
      <div className="arbitrationHeader">
        <div>
          <span className="eyebrow">
            Dispute resolution
          </span>

          <h2>Review a disputed order</h2>

          <p>
            The current on-chain arbitrator can
            release disputed escrow funds to the
            buyer or seller.
          </p>
        </div>

        <div
          className={
            isArbitrator
              ? "arbitratorIdentity active"
              : "arbitratorIdentity restricted"
          }
        >
          <span>Current authority</span>

          <strong>
            {isArbitrator
              ? "Arbitrator verified"
              : "Access restricted"}
          </strong>

          <small>
            {shortAddress(
              isArbitrator ? account : arbitrator
            )}
          </small>
        </div>
      </div>

      {!isArbitrator && (
        <div className="sellerAccessWarning">
          Connect the current arbitrator wallet
          to review and resolve disputes.
        </div>
      )}

      <div className="arbitrationSearch">
        <div>
          <label htmlFor="arbitration-order-id">
            Disputed order ID
          </label>

          <input
            id="arbitration-order-id"
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
            !isCorrectNetwork ||
            !isArbitrator
          }
        >
          {isLoading
            ? "Loading..."
            : "Load dispute"}
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
          No disputed order loaded.
        </div>
      )}

      {order && (
        <div className="arbitrationOrderCard">
          <div className="arbitrationOrderTop">
            <div>
              <span>Order</span>
              <h3>#{order.id}</h3>
            </div>

            <span className={`badge ${statusClass}`}>
              {ORDER_STATUS[order.status] ||
                "Unknown"}
            </span>
          </div>

          <div className="arbitrationParties">
            <article>
              <span>Buyer</span>

              <strong>
                {shortAddress(order.buyer)}
              </strong>

              <small>
                Receives the funds when resolved
                in the buyer's favor.
              </small>
            </article>

            <article>
              <span>Seller</span>

              <strong>
                {shortAddress(order.seller)}
              </strong>

              <small>
                Receives the funds when resolved
                in the seller's favor.
              </small>
            </article>
          </div>

          <div className="arbitrationOrderDetails">
            <div>
              <span>Amount</span>
              <strong>{order.formattedAmount}</strong>
            </div>

            <div>
              <span>Asset</span>
              <strong>{order.assetSymbol}</strong>
            </div>

            <div>
              <span>Payment type</span>

              <strong>
                {PAYMENT_TYPE[order.paymentType] ||
                  "Unknown"}
              </strong>
            </div>

            <div>
              <span>Status</span>

              <strong>
                {ORDER_STATUS[order.status] ||
                  "Unknown"}
              </strong>
            </div>
          </div>

          {order.status !== 1 && (
            <div className="sellerAccessNotice">
              This order is not currently disputed
              and cannot be resolved.
            </div>
          )}

          {canResolve && (
            <div className="resolutionWarning">
              Resolution is final. Confirm the order
              details before selecting the recipient.
            </div>
          )}

          <div className="arbitrationActions">
            <button
              type="button"
              className="secondary"
              disabled={isLoading || !canResolve}
              onClick={() => resolveDispute(false)}
            >
              Resolve to buyer
            </button>

            <button
              type="button"
              className="primary"
              disabled={isLoading || !canResolve}
              onClick={() => resolveDispute(true)}
            >
              Resolve to seller
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
