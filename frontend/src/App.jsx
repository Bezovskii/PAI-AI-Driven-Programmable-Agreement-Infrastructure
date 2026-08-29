import {
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import "./App.css";

import AgreementWorkspace from "./components/agreements/AgreementWorkspace.jsx";
import WalletControl from "./components/wallet/WalletControl.jsx";

import { useWeb3 } from "./hooks/useWeb3.js";

import "./pai-dark.css";

function shortAddress(address) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function networkName(chainId) {
  if (!chainId) {
    return "Not connected";
  }

  const id = Number(chainId);

  if (id === 31337) {
    return "Local development";
  }

  if (id === 11155111) {
    return "Sepolia Testnet";
  }

  return `Chain ${id}`;
}

function SidebarGlyph({
  type,
}) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (type === "agreement") {
    return (
      <span className="sidebarIcon">
        <svg {...commonProps}>
          <path d="M6 3.5h8.3L19 8.2V20.5H6z" />
          <path d="M14 3.5V8h5" />
          <path d="M9 12h7" />
          <path d="M9 15.5h7" />
        </svg>
      </span>
    );
  }

  return (
    <span className="sidebarIcon">
      <svg {...commonProps}>
        <rect
          x="3.5"
          y="3.5"
          width="6.5"
          height="6.5"
          rx="1.4"
        />

        <rect
          x="14"
          y="3.5"
          width="6.5"
          height="6.5"
          rx="1.4"
        />

        <rect
          x="3.5"
          y="14"
          width="6.5"
          height="6.5"
          rx="1.4"
        />

        <rect
          x="14"
          y="14"
          width="6.5"
          height="6.5"
          rx="1.4"
        />
      </svg>
    </span>
  );
}

function ProtocolSidebar() {
  const {
    account,
    chainId,
    expectedChainId,
    isConnected,
    isCorrectNetwork,
  } = useWeb3();

  return (
    <aside className="protocolSidebar">
      <div className="sidebarSection">
        <span className="sidebarLabel">
          Workspace
        </span>

        <nav className="sidebarNav">
          <NavLink
            to="/"
            end
          >
            <SidebarGlyph type="dashboard" />

            Overview
          </NavLink>

          <NavLink to="/agreements">
            <SidebarGlyph type="agreement" />

            Agreements
          </NavLink>
        </nav>
      </div>

      <div className="sidebarStatusCard">
        <div className="sidebarStatusHeading">
          <span
            className={
              isConnected
                ? "healthDot"
                : "healthDot warning"
            }
          />

          <span>
            Wallet
          </span>
        </div>

        <strong>
          {isConnected
            ? shortAddress(account)
            : "Not connected"}
        </strong>

        <small>
          {isConnected
            ? "PAI identity available"
            : "Connect to enter the workspace"}
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

      <div className="sidebarVersion">
        PAI
        <span>
          Programmable Agreement Infrastructure
        </span>
      </div>
    </aside>
  );
}

function DashboardPage() {
  return (
    <div className="rolePage dashboardPage">
      <div className="pageHeading dashboardHeading">
        <div>
          <span className="eyebrow">
            PAI
          </span>

          <h1>
            Programmable Agreement Infrastructure
          </h1>

          <p>
            Define agreements, establish explicit
            acceptance, manage milestones and
            evidence, and connect settlement only
            when the agreement requires it.
          </p>
        </div>

        <div className="liveIndicator">
          <span className="healthDot" />

          APPLICATION LAYER
        </div>
      </div>

      <section className="workspacePreview">
        <div>
          <span>01</span>

          <h3>
            Define
          </h3>

          <p>
            Create the terms, parties,
            milestones and expected
            deliverables.
          </p>
        </div>

        <div>
          <span>02</span>

          <h3>
            Accept
          </h3>

          <p>
            Counterparties explicitly
            accept the programmable
            agreement.
          </p>
        </div>

        <div>
          <span>03</span>

          <h3>
            Execute
          </h3>

          <p>
            Track delivery, evidence and
            lifecycle state through the
            agreement workspace.
          </p>
        </div>
      </section>

      <section className="roleGrid">
        <div className="roleCard">
          <span className="roleIcon">
            A
          </span>

          <div>
            <span className="roleCardLabel">
              PAI CORE
            </span>

            <h2>
              Agreement workspace
            </h2>

            <p>
              Create and manage programmable
              agreements and milestone-based
              work.
            </p>

            <NavLink to="/agreements">
              Open agreements
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
              SETTLEMENT INTEGRATION
            </span>

            <h2>
              ESCT settlement layer
            </h2>

            <p>
              When required, PAI can use ESCT
              for escrow, disputes, arbitration
              and financial settlement.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function App() {
  const {
    isConnected,
    isCorrectNetwork,
    chainId,
    expectedChainId,
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
            P
          </span>

          <div>
            <strong>
              PAI
            </strong>

            <small>
              Agreement Infrastructure
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
            Agreements
          </NavLink>
        </nav>

        <WalletControl />
      </header>

      <div className="testnetWarning">
        <span className="warningIcon">
          !
        </span>

        <strong>
          TESTNET
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