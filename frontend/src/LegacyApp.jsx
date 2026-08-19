import { ethers } from "ethers";
import { useMemo, useState } from "react";
import "./App.css";

import { contractAddress } from "./contract/contractAddress.js";
import contractABI from "./contract/MultiPaymentABI.json";

const DEMO = {
  buyer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  arbitrator: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  seller: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
};

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [arbitrator, setArbitrator] = useState("");

  const [sellerAddress, setSellerAddress] = useState("");
  const [ethAmount, setEthAmount] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [erc20Amount, setErc20Amount] = useState("");

  const [orderId, setOrderId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderData, setOrderData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activeAsset, setActiveAsset] = useState("ETH");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isConnected = Boolean(account && contract);
  const isArbitrator =
    account && arbitrator && account.toLowerCase() === arbitrator.toLowerCase();

  const metrics = useMemo(() => {
    return {
      total: recentOrders.length,
      completed: recentOrders.filter((o) => o.status === 2).length,
      disputed: recentOrders.filter((o) => o.status === 1).length,
      escrow: recentOrders.filter((o) => o.status === 0).length,
    };
  }, [recentOrders]);

  function short(address) {
    if (!address) return "-";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function statusName(status) {
    return ["In Escrow", "Disputed", "Completed", "Refunded"][status] || "Unknown";
  }

  function paymentTypeName(type) {
    return ["Direct", "Escrow"][type] || "Unknown";
  }

  function statusClass(status) {
    return ["escrow", "disputed", "completed", "refunded"][status] || "";
  }

  async function connectWallet() {
    if (!window.ethereum) return alert("MetaMask is not installed");

    try {
      setLoading(true);
      setMessage("Connecting wallet...");

      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const appContract = new ethers.Contract(
        contractAddress,
        contractABI.abi,
        signer
      );

      const arb = await appContract.arbitrator();

      setAccount(accounts[0]);
      setContract(appContract);
      setArbitrator(arb);
      setMessage("Wallet connected successfully.");
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  function validateSeller() {
    if (!contract) return alert("Connect wallet first");
    if (!ethers.isAddress(sellerAddress)) return alert("Invalid seller address");
    return true;
  }

  async function getTokenMeta(address) {
    if (address.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      return { symbol: "ETH", decimals: 18 };
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const token = new ethers.Contract(address, ERC20_ABI, provider);

    const [symbol, decimals] = await Promise.all([
      token.symbol(),
      token.decimals(),
    ]);

    return { symbol, decimals };
  }

  async function getParsedERC20Amount() {
    const meta = await getTokenMeta(tokenAddress);
    return ethers.parseUnits(erc20Amount, meta.decimals);
  }

  async function approveERC20() {
    if (!validateSeller()) return;
    if (!ethers.isAddress(tokenAddress)) return alert("Invalid token address");
    if (!erc20Amount || Number(erc20Amount) <= 0) return alert("Invalid ERC20 amount");

    try {
      setLoading(true);
      setMessage("Waiting for ERC20 approval...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const parsed = await getParsedERC20Amount();

      const tx = await token.approve(contractAddress, parsed);
      setMessage("Approval submitted. Waiting for confirmation...");
      await tx.wait();

      setMessage("ERC20 approval confirmed.");
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message || "Approval failed");
    } finally {
      setLoading(false);
    }
  }

  async function createEthDirect() {
    if (!validateSeller()) return;
    if (!ethAmount || Number(ethAmount) <= 0) return alert("Invalid ETH amount");

    try {
      setLoading(true);
      setMessage("Creating ETH direct payment...");

      const tx = await contract.createDirectPayment(sellerAddress, {
        value: ethers.parseEther(ethAmount),
      });

      await tx.wait();
      const nextId = await contract.nextOrderId();
      const id = Number(nextId) - 1;

      setOrderId(String(id));
      setMessage(`ETH direct payment created. Order #${id}`);
      await readOrder(String(id));
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message || "ETH direct failed");
    } finally {
      setLoading(false);
    }
  }

  async function createEthEscrow() {
    if (!validateSeller()) return;
    if (!ethAmount || Number(ethAmount) <= 0) return alert("Invalid ETH amount");

    try {
      setLoading(true);
      setMessage("Creating ETH escrow...");

      const tx = await contract.createEscrowPayment(sellerAddress, {
        value: ethers.parseEther(ethAmount),
      });

      await tx.wait();
      const nextId = await contract.nextOrderId();
      const id = Number(nextId) - 1;

      setOrderId(String(id));
      setMessage(`ETH escrow created. Order #${id}`);
      await readOrder(String(id));
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message || "ETH escrow failed");
    } finally {
      setLoading(false);
    }
  }

  async function createERC20Direct() {
    if (!validateSeller()) return;
    if (!ethers.isAddress(tokenAddress)) return alert("Invalid token address");
    if (!erc20Amount || Number(erc20Amount) <= 0) return alert("Invalid ERC20 amount");

    try {
      setLoading(true);
      setMessage("Creating ERC20 direct payment...");

      const parsed = await getParsedERC20Amount();

      const tx = await contract.createERC20DirectPayment(
        sellerAddress,
        tokenAddress,
        parsed
      );

      await tx.wait();
      const nextId = await contract.nextOrderId();
      const id = Number(nextId) - 1;

      setOrderId(String(id));
      setMessage(`ERC20 direct payment created. Order #${id}`);
      await readOrder(String(id));
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message || "ERC20 direct failed");
    } finally {
      setLoading(false);
    }
  }

  async function createERC20Escrow() {
    if (!validateSeller()) return;
    if (!ethers.isAddress(tokenAddress)) return alert("Invalid token address");
    if (!erc20Amount || Number(erc20Amount) <= 0) return alert("Invalid ERC20 amount");

    try {
      setLoading(true);
      setMessage("Creating ERC20 escrow...");

      const parsed = await getParsedERC20Amount();

      const tx = await contract.createERC20EscrowPayment(
        sellerAddress,
        tokenAddress,
        parsed
      );

      await tx.wait();
      const nextId = await contract.nextOrderId();
      const id = Number(nextId) - 1;

      setOrderId(String(id));
      setMessage(`ERC20 escrow created. Order #${id}`);
      await readOrder(String(id));
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message || "ERC20 escrow failed");
    } finally {
      setLoading(false);
    }
  }

  async function readOrder(targetId = orderId) {
    if (!contract) return alert("Connect wallet first");
    if (!targetId || Number(targetId) <= 0) return alert("Invalid order ID");

    try {
      const order = await contract.orderById(Number(targetId));
      const meta = await getTokenMeta(order[3]);

      const parsed = {
        id: order[0].toString(),
        buyer: order[1],
        seller: order[2],
        token: order[3],
        amount: order[4].toString(),
        formattedAmount: `${ethers.formatUnits(order[4], meta.decimals)} ${meta.symbol}`,
        asset: meta.symbol,
        paymentType: Number(order[5]),
        status: Number(order[6]),
        exists: order[7],
      };

      setOrderId(String(targetId));
      setSelectedOrderId(parsed.id);
      setOrderData(parsed);

      setRecentOrders((prev) => {
        const clean = prev.filter((o) => o.id !== parsed.id);
        return [parsed, ...clean].slice(0, 8);
      });

      setMessage(`Viewing Order #${parsed.id}.`);
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message || "Read failed");
    }
  }

  async function contractAction(action, successMessage) {
    if (!contract) return alert("Connect wallet first");
    if (!orderId || Number(orderId) <= 0) return alert("Invalid order ID");

    try {
      setLoading(true);
      setMessage("Transaction submitted...");

      const tx = await action();
      await tx.wait();

      setMessage(successMessage);
      await readOrder(orderId);
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      {loading && <div className="overlay">⏳ Transaction pending...</div>}

      <header className="hero">
        <div>
          <div className="brand">⚖️ ESCT Protocol</div>
          <h1>Multi-Payment Escrow Engine</h1>
          <p>
            Secure ETH and ERC20 transactions with escrow protection, refund logic,
            dispute handling, and arbitrator-based settlement.
          </p>

          <div className="chips">
            <span>⚡ ETH</span>
            <span>🪙 ERC20</span>
            <span>🛡 Escrow</span>
            <span>⚖️ Arbitration</span>
            <span>✅ 49 Tests</span>
          </div>
        </div>

        <button className="primary big" onClick={connectWallet}>
          {isConnected ? "Connected ✅" : "Connect Wallet"}
        </button>
      </header>

      {message && <div className="toast">{message}</div>}

      <section className="stats">
        <div className="stat">
          <span>Total Loaded</span>
          <strong>{metrics.total}</strong>
        </div>
        <div className="stat">
          <span>Completed</span>
          <strong>{metrics.completed}</strong>
        </div>
        <div className="stat">
          <span>Disputed</span>
          <strong>{metrics.disputed}</strong>
        </div>
        <div className="stat">
          <span>In Escrow</span>
          <strong>{metrics.escrow}</strong>
        </div>
      </section>

      <section className="walletGrid">
        <div className="walletCard">
          <span>Connected Wallet</span>
          <strong>{account ? short(account) : "Not connected"}</strong>
          <small>Role: {isArbitrator ? "⚖️ Arbitrator" : "👤 User"}</small>
        </div>

        <div className="walletCard">
          <span>Contract</span>
          <strong>{contract ? "Online ✅" : "Offline ❌"}</strong>
          <small>{short(contractAddress)}</small>
        </div>

        <div className="walletCard demo">
          <span>Demo Accounts</span>
          <small>Buyer: {short(DEMO.buyer)}</small>
          <small>Seller: {short(DEMO.seller)}</small>
          <small>Arbitrator: {short(DEMO.arbitrator)}</small>
        </div>
      </section>

      <main className="layout">
        <section className="panel">
          <h2>Create Payment</h2>

          <div className="tabs">
            <button
              className={activeAsset === "ETH" ? "active" : ""}
              onClick={() => setActiveAsset("ETH")}
            >
              ETH
            </button>
            <button
              className={activeAsset === "ERC20" ? "active" : ""}
              onClick={() => setActiveAsset("ERC20")}
            >
              ERC20
            </button>
          </div>

          <label>Seller Address</label>
          <input
            placeholder="0x seller address"
            value={sellerAddress}
            onChange={(e) => setSellerAddress(e.target.value)}
          />

          {activeAsset === "ETH" ? (
            <>
              <label>ETH Amount</label>
              <input
                placeholder="0.1"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
              />

              <div className="actions">
                <button className="secondary" onClick={createEthDirect}>
                  Direct ETH
                </button>
                <button className="primary" onClick={createEthEscrow}>
                  Escrow ETH
                </button>
              </div>
            </>
          ) : (
            <>
              <label>Token Address</label>
              <input
                placeholder="ERC20 token contract"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
              />

              <label>Token Amount</label>
              <input
                placeholder="100"
                value={erc20Amount}
                onChange={(e) => setErc20Amount(e.target.value)}
              />

              <div className="actions wrap">
                <button className="secondary" onClick={approveERC20}>
                  1. Approve
                </button>
                <button className="secondary" onClick={createERC20Direct}>
                  Direct ERC20
                </button>
                <button className="primary" onClick={createERC20Escrow}>
                  Escrow ERC20
                </button>
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Manage Order</h2>

          <label>Order ID</label>
          <input
            placeholder="1"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />

          <div className="actions wrap">
            <button
              className="primary"
              onClick={async () => {
                setLoading(true);
                await readOrder(orderId);
                setLoading(false);
              }}
            >
              Read
            </button>

            <button
              className="secondary"
              onClick={() =>
                contractAction(
                  () => contract.confirmReceipt(Number(orderId)),
                  "Receipt confirmed. Funds released."
                )
              }
            >
              Confirm
            </button>

            <button
              className="secondary"
              onClick={() =>
                contractAction(
                  () => contract.refund(Number(orderId)),
                  "Refund completed."
                )
              }
            >
              Refund
            </button>

            <button
              className="danger"
              onClick={() =>
                contractAction(
                  () => contract.openDispute(Number(orderId)),
                  "Dispute opened."
                )
              }
            >
              Dispute
            </button>

            {isArbitrator && (
              <>
                <button
                  className="secondary"
                  onClick={() =>
                    contractAction(
                      () => contract.resolveDispute(Number(orderId), true),
                      "Resolved to seller."
                    )
                  }
                >
                  Resolve Seller
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    contractAction(
                      () => contract.resolveDispute(Number(orderId), false),
                      "Resolved to buyer."
                    )
                  }
                >
                  Resolve Buyer
                </button>
              </>
            )}
          </div>

          {!orderData && (
            <div className="emptyState">
              No order selected. Enter an order ID and click Read.
            </div>
          )}

          {orderData && (
            <div className="orderCard">
              <div className="orderTop">
                <h3>Order #{orderData.id}</h3>
                <span className={`badge ${statusClass(orderData.status)}`}>
                  {statusName(orderData.status)}
                </span>
              </div>

              <div className="orderGrid">
                <div>
                  <span>Buyer</span>
                  <strong>{short(orderData.buyer)}</strong>
                </div>
                <div>
                  <span>Seller</span>
                  <strong>{short(orderData.seller)}</strong>
                </div>
                <div>
                  <span>Asset</span>
                  <strong>{orderData.asset}</strong>
                </div>
                <div>
                  <span>Amount</span>
                  <strong>{orderData.formattedAmount}</strong>
                </div>
                <div>
                  <span>Type</span>
                  <strong>{paymentTypeName(orderData.paymentType)}</strong>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <section className="panel full">
        <h2>Recent Orders</h2>

        {recentOrders.length === 0 ? (
          <div className="emptyState">Orders you read will appear here.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Buyer</th>
                <th>Seller</th>
                <th>Asset</th>
                <th>Type</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className={selectedOrderId === order.id ? "selectedRow" : ""}
                >
                  <td>#{order.id}</td>
                  <td>{short(order.buyer)}</td>
                  <td>{short(order.seller)}</td>
                  <td>{order.asset}</td>
                  <td>{paymentTypeName(order.paymentType)}</td>
                  <td>
                    <span className={`badge ${statusClass(order.status)}`}>
                      {statusName(order.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      className={
                        selectedOrderId === order.id ? "mini activeMini" : "mini"
                      }
                      onClick={async () => {
                        setLoading(true);
                        setOrderId(order.id);
                        setSelectedOrderId(order.id);
                        setMessage(`Opening Order #${order.id}...`);
                        await readOrder(order.id);
                        setLoading(false);
                        window.scrollTo({ top: 430, behavior: "smooth" });
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer>
        ESCT Protocol — Solidity • Hardhat • Ethers.js • React • ERC20
      </footer>
    </div>
  );
}

export default App;