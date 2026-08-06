import {
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import "./App.css";

import LegacyApp from "./LegacyApp.jsx";
import AdminPanel from "./components/admin/AdminPanel.jsx";
import ArbitrationPanel from "./components/arbitration/ArbitrationPanel.jsx";
import SellerOrderPanel from "./components/orders/SellerOrderPanel.jsx";
import BuyerPaymentPanel from "./components/payments/BuyerPaymentPanel.jsx";
import { useWeb3 } from "./hooks/useWeb3.js";

function shortAddress(address) {
  if (!address) {
    return "Not connected";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function AccessCard({
  allowed,
  title,
  allowedText,
  deniedText,
}) {
  return (
    <div
      className={
        allowed
          ? "accessCard allowed"
          : "accessCard denied"
      }
    >
      <span>
        {allowed
          ? "Access granted"
          : "Restricted area"}
      </span>

      <h3>{title}</h3>

      <p>
        {allowed
          ? allowedText
          : deniedText}
      </p>
    </div>
  );
}

function DashboardPage() {
  const {
    account,
    chainId,
    expectedChainId,
    owner,
    arbitrator,
    isConnected,
    isCorrectNetwork,
    isOwner,
    isArbitrator,
    isPaused,
  } = useWeb3();

  let authority = "User";

  if (isOwner) {
    authority = "Administrator";
  } else if (isArbitrator) {
    authority = "Arbitrator";
  }

  return (
    <div className="rolePage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">
            Protocol overview
          </span>

          <h1>Your ESCT workspace</h1>

          <p>
            Permissions are detected directly from
            the connected wallet and the protocol
            contract.
          </p>
        </div>
      </div>

      <section className="roleStats">
        <article>
          <span>Wallet</span>

          <strong>
            {shortAddress(account)}
          </strong>

          <small>
            {isConnected
              ? "Connected"
              : "Wallet required"}
          </small>
        </article>

        <article>
          <span>Network</span>

          <strong>
            {chainId ?? "-"}
          </strong>

          <small>
            Expected chain: {expectedChainId}
          </small>
        </article>

        <article>
          <span>Protocol</span>

          <strong>
            {isPaused
              ? "Paused"
              : "Active"}
          </strong>

          <small>
            {!isConnected
              ? "Connect wallet to verify"
              : isCorrectNetwork
                ? "Correct network"
                : "Network mismatch"}
          </small>
        </article>

        <article>
          <span>Your authority</span>

          <strong>
            {authority}
          </strong>

          <small>
            Detected on-chain
          </small>
        </article>
      </section>

      <section className="roleGrid">
        <div className="roleCard">
          <span className="roleIcon">
            B
          </span>

          <div>
            <h2>Buyer workspace</h2>

            <p>
              Create direct or escrow payments,
              confirm successful delivery, and
              open disputes.
            </p>

            <NavLink to="/buyer">
              Open buyer workspace
            </NavLink>
          </div>
        </div>

        <div className="roleCard">
          <span className="roleIcon">
            S
          </span>

          <div>
            <h2>Seller workspace</h2>

            <p>
              Review incoming orders, refund
              eligible escrows, and open disputes.
            </p>

            <NavLink to="/seller">
              Open seller workspace
            </NavLink>
          </div>
        </div>

        <div className="roleCard">
          <span className="roleIcon">
            A
          </span>

          <div>
            <h2>Arbitration</h2>

            <p>
              Review disputed orders and resolve
              protected funds to the buyer or seller.
            </p>

            <NavLink to="/arbitration">
              Open arbitration workspace
            </NavLink>
          </div>
        </div>

        <div className="roleCard">
          <span className="roleIcon">
            O
          </span>

          <div>
            <h2>Protocol administration</h2>

            <p>
              Manage pause controls, approved
              tokens, arbitrator authority, and
              protocol solvency.
            </p>

            <NavLink to="/admin">
              Open admin workspace
            </NavLink>
          </div>
        </div>
      </section>

      <section className="protocolIdentity">
        <div>
          <span>Protocol owner</span>

          <strong>
            {shortAddress(owner)}
          </strong>
        </div>

        <div>
          <span>Current arbitrator</span>

          <strong>
            {shortAddress(arbitrator)}
          </strong>
        </div>
      </section>
    </div>
  );
}

function BuyerPage() {
  return (
    <div className="rolePage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">
            Contextual role
          </span>

          <h1>Buyer workspace</h1>

          <p>
            Create direct or escrow payments.
            Your connected wallet becomes the
            on-chain buyer for every payment
            created from this workspace.
          </p>
        </div>
      </div>

      <BuyerPaymentPanel />

      <section className="workspacePreview buyerSteps">
        <div>
          <span>01</span>

          <h3>Create payment</h3>

          <p>
            Choose ETH or ERC20 and decide
            whether the payment should be direct
            or protected by escrow.
          </p>
        </div>

        <div>
          <span>02</span>

          <h3>Seller delivers</h3>

          <p>
            For escrow payments, funds remain
            protected while the seller completes
            the agreement.
          </p>
        </div>

        <div>
          <span>03</span>

          <h3>Confirm or dispute</h3>

          <p>
            Confirm successful delivery to release
            funds, or open a dispute when the
            agreement is not completed.
          </p>
        </div>
      </section>
    </div>
  );
}

function SellerPage() {
  return (
    <div className="rolePage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">
            Contextual role
          </span>

          <h1>Seller workspace</h1>

          <p>
            Find orders assigned to your wallet,
            review their status, refund the buyer,
            or open a dispute when permitted.
          </p>
        </div>
      </div>

      <SellerOrderPanel />

      <section className="workspacePreview">
        <div>
          <span>01</span>

          <h3>Find the order</h3>

          <p>
            Enter the on-chain order ID to load
            the parties, asset, amount, payment
            type, and current status.
          </p>
        </div>

        <div>
          <span>02</span>

          <h3>Verify your role</h3>

          <p>
            Seller actions appear only when the
            connected wallet matches the seller
            recorded in the order.
          </p>
        </div>

        <div>
          <span>03</span>

          <h3>Refund or dispute</h3>

          <p>
            Refund an eligible escrow payment
            or open a dispute before the order
            is completed.
          </p>
        </div>
      </section>
    </div>
  );
}

function ArbitrationPage() {
  const {
    isArbitrator,
    arbitrator,
  } = useWeb3();

  return (
    <div className="rolePage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">
            Protocol authority
          </span>

          <h1>Arbitration workspace</h1>

          <p>
            Review disputed escrow orders and
            release protected funds to the buyer
            or seller.
          </p>
        </div>
      </div>

      <AccessCard
        allowed={isArbitrator}
        title="Arbitrator access"
        allowedText="The connected wallet matches the current protocol arbitrator."
        deniedText={`Connect the current arbitrator wallet: ${shortAddress(
          arbitrator
        )}`}
      />

      <ArbitrationPanel />

      <section className="workspacePreview">
        <div>
          <span>01</span>

          <h3>Load dispute</h3>

          <p>
            Enter the order ID and verify that
            the order is currently disputed.
          </p>
        </div>

        <div>
          <span>02</span>

          <h3>Review parties</h3>

          <p>
            Confirm the buyer, seller, asset,
            amount, and current escrow status.
          </p>
        </div>

        <div>
          <span>03</span>

          <h3>Resolve permanently</h3>

          <p>
            Release the funds to the buyer or
            seller. Dispute resolution cannot
            be reversed.
          </p>
        </div>
      </section>
    </div>
  );
}

function AdminPage() {
  const {
    isOwner,
    owner,
    isPaused,
  } = useWeb3();

  return (
    <div className="rolePage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">
            Protocol authority
          </span>

          <h1>Administration workspace</h1>

          <p>
            Manage payment availability, approved
            tokens, protocol liabilities, solvency,
            and arbitrator authority.
          </p>
        </div>
      </div>

      <AccessCard
        allowed={isOwner}
        title="Administrator access"
        allowedText={`Owner authority confirmed. Protocol status: ${isPaused
            ? "paused"
            : "active"
          }.`}
        deniedText={`Connect the protocol owner wallet: ${shortAddress(
          owner
        )}`}
      />

      <AdminPanel />

      <section className="workspacePreview">
        <div>
          <span>01</span>

          <h3>Control exposure</h3>

          <p>
            Pause or unpause the creation of new
            direct and escrow payments.
          </p>
        </div>

        <div>
          <span>02</span>

          <h3>Manage assets</h3>

          <p>
            Approve or disable ERC20 assets and
            review their recorded liabilities.
          </p>
        </div>

        <div>
          <span>03</span>

          <h3>Manage authority</h3>

          <p>
            Propose a new arbitrator and monitor
            the two-step transfer process.
          </p>
        </div>
      </section>
    </div>
  );
}

function App() {
  const {
    account,
    isConnected,
    isConnecting,
    isCorrectNetwork,
    chainId,
    expectedChainId,
    isOwner,
    isArbitrator,
    connectWallet,
    transaction,
  } = useWeb3();

  return (
    <div className="roleApp">
      <header className="roleHeader">
        <NavLink
          className="roleBrand"
          to="/"
        >
          <span>ESCT</span>

          <div>
            <strong>Protocol</strong>

            <small>
              Secure transaction infrastructure
            </small>
          </div>
        </NavLink>

        <nav className="roleNav">
          <NavLink
            to="/"
            end
          >
            Overview
          </NavLink>

          <NavLink to="/buyer">
            Buyer
          </NavLink>

          <NavLink to="/seller">
            Seller
          </NavLink>

          {isArbitrator && (
            <NavLink to="/arbitration">
              Arbitration
            </NavLink>
          )}

          {isOwner && (
            <NavLink to="/admin">
              Admin
            </NavLink>
          )}

          <NavLink to="/workspace">
            Legacy workspace
          </NavLink>
        </nav>

        <button
          type="button"
          className="walletButton"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting
            ? "Connecting..."
            : isConnected
              ? shortAddress(account)
              : "Connect wallet"}
        </button>
      </header>

      {isConnected &&
        !isCorrectNetwork && (
          <div className="networkWarning">
            Wrong network. Connected chain:{" "}
            {chainId}. Expected chain:{" "}
            {expectedChainId}.
          </div>
        )}

      {transaction.status !== "idle" &&
        transaction.message && (
          <div
            className={`transactionBanner ${transaction.status}`}
          >
            <span>
              {transaction.message}
            </span>

            {transaction.hash && (
              <small>
                {shortAddress(
                  transaction.hash
                )}
              </small>
            )}
          </div>
        )}

      <main className="roleContent">
        <Routes>
          <Route
            path="/"
            element={<DashboardPage />}
          />

          <Route
            path="/buyer"
            element={<BuyerPage />}
          />

          <Route
            path="/seller"
            element={<SellerPage />}
          />

          <Route
            path="/arbitration"
            element={<ArbitrationPage />}
          />

          <Route
            path="/admin"
            element={<AdminPage />}
          />

          <Route
            path="/workspace"
            element={<LegacyApp />}
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;