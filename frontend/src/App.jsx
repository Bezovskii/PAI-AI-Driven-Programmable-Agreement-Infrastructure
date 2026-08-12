import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import { ethers } from "ethers";

import "./App.css";

import AdminPanel from "./components/admin/AdminPanel.jsx";
import AgreementWorkspace from "./components/agreements/AgreementWorkspace.jsx";
import ArbitrationPanel from "./components/arbitration/ArbitrationPanel.jsx";
import ArbitratorAcceptancePanel from "./components/arbitration/ArbitratorAcceptancePanel.jsx";
import BuyerOrderPanel from "./components/orders/BuyerOrderPanel.jsx";
import SellerOrderPanel from "./components/orders/SellerOrderPanel.jsx";
import BuyerPaymentPanel from "./components/payments/BuyerPaymentPanel.jsx";
import WalletControl from "./components/wallet/WalletControl.jsx";

import { useWeb3 } from "./hooks/useWeb3.js";

/*
 * Load this AFTER component CSS so the ESCT dark
 * protocol theme wins the cascade.
 */
import "./esct-dark.css";

function shortAddress(address) {
  if (!address) {
    return "Not connected";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function networkName(chainId) {
  if (!chainId) {
    return "Not connected";
  }

  const id = Number(chainId);

  if (id === 31337) {
    return "Hardhat Local";
  }

  if (id === 11155111) {
    return "Sepolia Testnet";
  }

  return `Chain ${id}`;
}

function formatEscrowEth(value) {
  try {
    const number = Number(
      ethers.formatEther(value)
    );

    return number.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      }
    );
  } catch {
    return "-";
  }
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
      <div className="accessStateRow">
        <span className="accessStateDot" />

        <span>
          {allowed
            ? "Access granted"
            : "Restricted area"}
        </span>
      </div>

      <h3>{title}</h3>

      <p>
        {allowed
          ? allowedText
          : deniedText}
      </p>
    </div>
  );
}

function ProtocolSidebar() {
  const {
    account,
    chainId,
    expectedChainId,
    isConnected,
    isCorrectNetwork,
    isOwner,
    isPaused,
  } = useWeb3();

  return (
    <aside className="protocolSidebar">
      <div className="sidebarSection">
        <span className="sidebarLabel">
          Protocol
        </span>

        <nav className="sidebarNav">
          <NavLink
            to="/"
            end
          >
            <span className="sidebarIcon">
              D
            </span>

            Dashboard
          </NavLink>

          <NavLink to="/agreements">
            <span className="sidebarIcon">
              G
            </span>

            Agreements
          </NavLink>

          <NavLink to="/buyer">
            <span className="sidebarIcon">
              B
            </span>

            Buyer
          </NavLink>

          <NavLink to="/seller">
            <span className="sidebarIcon">
              S
            </span>

            Seller
          </NavLink>

          <NavLink to="/arbitration">
            <span className="sidebarIcon">
              A
            </span>

            Disputes
          </NavLink>

          {isOwner && (
            <NavLink to="/admin">
              <span className="sidebarIcon">
                O
              </span>

              Admin
            </NavLink>
          )}
        </nav>
      </div>

      <div className="sidebarStatusCard">
        <div className="sidebarStatusHeading">
          <span
            className={
              isPaused
                ? "healthDot warning"
                : "healthDot"
            }
          />

          <span>Protocol health</span>
        </div>

        <strong>
          {isPaused
            ? "Payments paused"
            : "Operational"}
        </strong>

        <small>
          {isPaused
            ? "New payments disabled"
            : "Payment engine active"}
        </small>
      </div>

      <div className="sidebarInfoCard">
        <span className="sidebarLabel">
          Network
        </span>

        <div className="sidebarInfoRow">
          <span
            className={
              isConnected &&
                isCorrectNetwork
                ? "healthDot"
                : "healthDot warning"
            }
          />

          <strong>
            {networkName(chainId)}
          </strong>
        </div>

        <small>
          Expected chain:{" "}
          {expectedChainId}
        </small>
      </div>

      <div className="sidebarInfoCard">
        <span className="sidebarLabel">
          Connected wallet
        </span>

        <strong className="mono">
          {shortAddress(account)}
        </strong>

        <small>
          {isConnected
            ? "Wallet session active"
            : "Connect to use ESCT"}
        </small>
      </div>

      <div className="sidebarVersion">
        ESCT Protocol
        <span>RC2 / Testnet</span>
      </div>
    </aside>
  );
}

function DashboardPage() {
  const {
    account,
    chainId,
    owner,
    arbitrator,
    contract,
    isConnected,
    isCorrectNetwork,
    isOwner,
    isArbitrator,
    isPaused,
    transaction,
  } = useWeb3();

  const [metrics, setMetrics] =
    useState({
      totalOrders: "-",
      escrowedEth: "-",
      solvent: null,
    });

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      if (
        !contract ||
        !isCorrectNetwork
      ) {
        setMetrics({
          totalOrders: "-",
          escrowedEth: "-",
          solvent: null,
        });

        return;
      }

      try {
        const [
          nextOrderId,
          escrowedEth,
          solvent,
        ] = await Promise.all([
          contract.nextOrderId(),
          contract.totalEscrowedETH(),
          contract.isSolvent(
            ethers.ZeroAddress
          ),
        ]);

        if (cancelled) {
          return;
        }

        const totalOrders =
          nextOrderId > 0n
            ? nextOrderId - 1n
            : 0n;

        setMetrics({
          totalOrders:
            totalOrders.toString(),

          escrowedEth:
            formatEscrowEth(
              escrowedEth
            ),

          solvent:
            Boolean(solvent),
        });
      } catch (error) {
        console.error(
          "Dashboard metrics error:",
          error
        );
      }
    }

    loadMetrics();

    return () => {
      cancelled = true;
    };
  }, [
    contract,
    isCorrectNetwork,
    transaction.status,
    transaction.hash,
  ]);

  let authority = "User";

  if (isOwner) {
    authority = "Administrator";
  } else if (isArbitrator) {
    authority = "Arbitrator";
  }

  return (
    <div className="rolePage dashboardPage">
      <div className="pageHeading dashboardHeading">
        <div>
          <span className="eyebrow">
            Protocol overview
          </span>

          <h1>
            ESCT Dashboard
          </h1>

          <p>
            On-chain transaction,
            escrow, dispute and
            protocol authority
            workspace.
          </p>
        </div>

        <div className="liveIndicator">
          <span className="healthDot" />

          LIVE CONTRACT
        </div>
      </div>

      <section className="roleStats protocolMetrics">
        <article>
          <div className="metricTop">
            <span className="metricIcon">
              #
            </span>

            <span>
              Orders created
            </span>
          </div>

          <strong>
            {metrics.totalOrders}
          </strong>

          <small>
            Recorded on-chain
          </small>
        </article>

        <article>
          <div className="metricTop">
            <span className="metricIcon">
              E
            </span>

            <span>
              ETH in escrow
            </span>
          </div>

          <strong>
            {metrics.escrowedEth}{" "}
            <em>ETH</em>
          </strong>

          <small>
            Current protocol liability
          </small>
        </article>

        <article>
          <div className="metricTop">
            <span className="metricIcon">
              S
            </span>

            <span>
              Solvency
            </span>
          </div>

          <strong
            className={
              metrics.solvent === false
                ? "dangerText"
                : "healthyText"
            }
          >
            {metrics.solvent === null
              ? "-"
              : metrics.solvent
                ? "Healthy"
                : "Check"}
          </strong>

          <small>
            ETH liability coverage
          </small>
        </article>

        <article>
          <div className="metricTop">
            <span className="metricIcon">
              P
            </span>

            <span>
              Protocol
            </span>
          </div>

          <strong
            className={
              isPaused
                ? "dangerText"
                : "healthyText"
            }
          >
            {isPaused
              ? "Paused"
              : "Active"}
          </strong>

          <small>
            {networkName(chainId)}
          </small>
        </article>
      </section>

      <section className="dashboardMainGrid">
        <div className="dashboardProtocolCard">
          <div className="dashboardCardHeader">
            <div>
              <span className="eyebrow">
                Connected identity
              </span>

              <h2>
                Current session
              </h2>
            </div>

            <span
              className={
                isConnected
                  ? "statusPill active"
                  : "statusPill"
              }
            >
              {isConnected
                ? "CONNECTED"
                : "OFFLINE"}
            </span>
          </div>

          <div className="sessionAddress">
            <span>Wallet</span>

            <strong className="mono">
              {shortAddress(account)}
            </strong>
          </div>

          <div className="sessionGrid">
            <div>
              <span>Authority</span>

              <strong>
                {authority}
              </strong>
            </div>

            <div>
              <span>Network</span>

              <strong>
                {networkName(chainId)}
              </strong>
            </div>

            <div>
              <span>
                Network status
              </span>

              <strong
                className={
                  isCorrectNetwork
                    ? "healthyText"
                    : "dangerText"
                }
              >
                {isCorrectNetwork
                  ? "Verified"
                  : "Mismatch"}
              </strong>
            </div>
          </div>
        </div>

        <div className="dashboardProtocolCard protocolAuthorityCard">
          <div className="dashboardCardHeader">
            <div>
              <span className="eyebrow">
                Contract authority
              </span>

              <h2>
                Protocol roles
              </h2>
            </div>
          </div>

          <div className="authorityRow">
            <div>
              <span>Owner</span>

              <strong className="mono">
                {shortAddress(owner)}
              </strong>
            </div>

            <span className="authorityTag">
              ADMIN
            </span>
          </div>

          <div className="authorityRow">
            <div>
              <span>Arbitrator</span>

              <strong className="mono">
                {shortAddress(
                  arbitrator
                )}
              </strong>
            </div>

            <span className="authorityTag amber">
              ARBITRATION
            </span>
          </div>
        </div>
      </section>

      <section className="roleGrid">
        <div className="roleCard">
          <span className="roleIcon">
            B
          </span>

          <div>
            <span className="roleCardLabel">
              PAYMENT
            </span>

            <h2>
              Buyer workspace
            </h2>

            <p>
              Create direct or protected
              escrow payments and manage
              existing orders.
            </p>

            <NavLink to="/agreements">
            <span className="sidebarIcon">
              G
            </span>

            Agreements
          </NavLink>

          <NavLink to="/buyer">
              Open workspace
              <span>→</span>
            </NavLink>
          </div>
        </div>

        <div className="roleCard">
          <span className="roleIcon seller">
            S
          </span>

          <div>
            <span className="roleCardLabel">
              DELIVERY
            </span>

            <h2>
              Seller workspace
            </h2>

            <p>
              Review orders, refund
              eligible escrows and
              initiate disputes.
            </p>

            <NavLink to="/seller">
              Open workspace
              <span>→</span>
            </NavLink>
          </div>
        </div>

        <div className="roleCard">
          <span className="roleIcon arbitration">
            A
          </span>

          <div>
            <span className="roleCardLabel">
              RESOLUTION
            </span>

            <h2>
              Arbitration
            </h2>

            <p>
              Review disputed orders and
              execute final escrow
              resolution.
            </p>

            <NavLink to="/arbitration">
              Open workspace
              <span>→</span>
            </NavLink>
          </div>
        </div>

        <div className="roleCard">
          <span className="roleIcon admin">
            O
          </span>

          <div>
            <span className="roleCardLabel">
              CONTROL
            </span>

            <h2>
              Administration
            </h2>

            <p>
              Protocol pause controls,
              assets, liabilities and
              authority management.
            </p>

            <NavLink to="/admin">
              Open workspace
              <span>→</span>
            </NavLink>
          </div>
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
            Buyer / Protected payments
          </span>

          <h1>
            Buyer workspace
          </h1>

          <p>
            Create a new transaction or
            load an existing Order ID to
            confirm delivery, release
            escrow or open a dispute.
          </p>
        </div>
      </div>

      <div className="buyerWorkspaceGrid">
        <BuyerPaymentPanel />

        <BuyerOrderPanel />
      </div>

      <section className="workspacePreview buyerSteps">
        <div>
          <span>01</span>

          <h3>
            Create
          </h3>

          <p>
            Choose an asset, seller and
            protection method.
          </p>
        </div>

        <div>
          <span>02</span>

          <h3>
            Escrow
          </h3>

          <p>
            Protected funds remain locked
            while delivery is completed.
          </p>
        </div>

        <div>
          <span>03</span>

          <h3>
            Release or dispute
          </h3>

          <p>
            Confirm the delivery or send
            the order to arbitration.
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
            Seller / Order execution
          </span>

          <h1>
            Seller workspace
          </h1>

          <p>
            Load an assigned order,
            inspect the protected value
            and execute available seller
            actions.
          </p>
        </div>
      </div>

      <SellerOrderPanel />

      <section className="workspacePreview">
        <div>
          <span>01</span>

          <h3>
            Load order
          </h3>

          <p>
            Enter the exact on-chain
            Order ID.
          </p>
        </div>

        <div>
          <span>02</span>

          <h3>
            Verify
          </h3>

          <p>
            ESCT checks that the connected
            wallet is the recorded seller.
          </p>
        </div>

        <div>
          <span>03</span>

          <h3>
            Act
          </h3>

          <p>
            Refund an eligible escrow or
            initiate arbitration.
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
            Arbitration / Final resolution
          </span>

          <h1>
            Arbitration workspace
          </h1>

          <p>
            Review disputed escrow orders
            and execute the final
            settlement decision.
          </p>
        </div>
      </div>

      <ArbitratorAcceptancePanel />

      <AccessCard
        allowed={isArbitrator}
        title="Arbitrator authority"
        allowedText="The connected wallet matches the protocol arbitrator and can execute dispute resolution."
        deniedText={`Connect the current arbitrator wallet: ${shortAddress(
          arbitrator
        )}`}
      />

      <ArbitrationPanel />
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
            Administration / Protocol control
          </span>

          <h1>
            Protocol administration
          </h1>

          <p>
            Manage payment availability,
            assets, liabilities,
            solvency and arbitrator
            authority.
          </p>
        </div>
      </div>

      <AccessCard
        allowed={isOwner}
        title="Administrator authority"
        allowedText={`Owner authority confirmed. Protocol is currently ${isPaused
            ? "paused"
            : "active"
          }.`}
        deniedText={`Connect the protocol owner wallet: ${shortAddress(
          owner
        )}`}
      />

      <AdminPanel />
    </div>
  );
}

function App() {
  const {
    isConnected,
    isCorrectNetwork,
    chainId,
    expectedChainId,
    isOwner,
    transaction,
  } = useWeb3();

  return (
    <div className="roleApp">
      <header className="roleHeader">
        <NavLink
          className="roleBrand"
          to="/"
        >
          <span className="brandGlyph">
            E
          </span>

          <div>
            <strong>ESCT</strong>

            <small>
              Protocol
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

          <NavLink to="/agreements">
            <span className="sidebarIcon">
              G
            </span>

            Agreements
          </NavLink>

          <NavLink to="/buyer">
            Buyer
          </NavLink>

          <NavLink to="/seller">
            Seller
          </NavLink>

          <NavLink to="/arbitration">
            Arbitration
          </NavLink>

          {isOwner && (
            <NavLink to="/admin">
              Admin
            </NavLink>
          )}
        </nav>

        <WalletControl />
      </header>

      <div className="testnetWarning">
        <span className="warningIcon">
          !
        </span>

        <strong>
          TESTNET ENVIRONMENT
        </strong>

        <span>
          DO NOT USE REAL FUNDS
        </span>
      </div>

      {isConnected &&
        !isCorrectNetwork && (
          <div className="wrongNetworkWarning">
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
              <small className="mono">
                {shortAddress(
                  transaction.hash
                )}
              </small>
            )}
          </div>
        )}

      <div className="protocolShell">
        <ProtocolSidebar />

        <main className="roleContent">
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage />
              }
            />

            <Route
              path="/agreements"
              element={
                <AgreementWorkspace />
              }
            />
            <Route
              path="/buyer"
              element={
                <BuyerPage />
              }
            />

            <Route
              path="/seller"
              element={
                <SellerPage />
              }
            />

            <Route
              path="/arbitration"
              element={
                <ArbitrationPage />
              }
            />

            <Route
              path="/admin"
              element={
                <AdminPage />
              }
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
    </div>
  );
}

export default App;


