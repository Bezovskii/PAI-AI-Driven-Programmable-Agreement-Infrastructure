const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture } = require("./helpers/deployFixture");

describe("MultiPayment - adversarial security", function () {
  let c;

  beforeEach(async function () {
    c = await deployFixture();
  });

  it("blocks reentrancy from a malicious ETH seller during direct payment", async function () {
    const ReentrantSeller = await ethers.getContractFactory("ReentrantSeller");
    const attacker = await ReentrantSeller.deploy(
      c.multiPaymentAddress,
      c.outsider.address
    );
    await attacker.waitForDeployment();
    const attackerAddress = await attacker.getAddress();
    await attacker.setArmed(true);

    await expect(
      c.multiPayment
        .connect(c.buyer)
        .createDirectPayment(attackerAddress, { value: c.ETH_AMOUNT })
    ).not.to.be.reverted;

    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.reentrySucceeded()).to.equal(false);
    expect(await c.multiPayment.nextOrderId()).to.equal(2n);
    expect(await ethers.provider.getBalance(attackerAddress)).to.equal(c.ETH_AMOUNT);
  });

  it("blocks reentrancy during escrow release and pays exactly once", async function () {
    const ReentrantSeller = await ethers.getContractFactory("ReentrantSeller");
    const attacker = await ReentrantSeller.deploy(
      c.multiPaymentAddress,
      c.outsider.address
    );
    await attacker.waitForDeployment();
    const attackerAddress = await attacker.getAddress();

    await c.multiPayment
      .connect(c.buyer)
      .createEscrowPayment(attackerAddress, { value: c.ETH_AMOUNT });
    await attacker.setArmed(true);

    await expect(c.multiPayment.connect(c.buyer).confirmReceipt(1)).not.to.be.reverted;

    const order = await c.multiPayment.orderById(1);
    expect(order.status).to.equal(2n);
    expect(await c.multiPayment.totalEscrowedETH()).to.equal(0n);
    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.reentrySucceeded()).to.equal(false);
    expect(await ethers.provider.getBalance(attackerAddress)).to.equal(c.ETH_AMOUNT);
  });

  it("rolls back a direct ETH payment when the receiver rejects ETH", async function () {
    const RejectingReceiver = await ethers.getContractFactory("RejectingReceiver");
    const rejecting = await RejectingReceiver.deploy();
    await rejecting.waitForDeployment();
    const rejectingAddress = await rejecting.getAddress();

    await expect(
      c.multiPayment
        .connect(c.buyer)
        .createDirectPayment(rejectingAddress, { value: c.ETH_AMOUNT })
    )
      .to.be.revertedWithCustomError(c.multiPayment, "EtherTransferFailed")
      .withArgs(rejectingAddress, c.ETH_AMOUNT);

    expect(await c.multiPayment.nextOrderId()).to.equal(1n);
    expect((await c.multiPayment.orderById(1)).exists).to.equal(false);
  });

  it("preserves escrow state and liability when an ETH seller rejects release", async function () {
    const RejectingReceiver = await ethers.getContractFactory("RejectingReceiver");
    const rejecting = await RejectingReceiver.deploy();
    await rejecting.waitForDeployment();
    const rejectingAddress = await rejecting.getAddress();

    await c.multiPayment
      .connect(c.buyer)
      .createEscrowPayment(rejectingAddress, { value: c.ETH_AMOUNT });

    await expect(c.multiPayment.connect(c.buyer).confirmReceipt(1))
      .to.be.revertedWithCustomError(c.multiPayment, "EtherTransferFailed")
      .withArgs(rejectingAddress, c.ETH_AMOUNT);

    const order = await c.multiPayment.orderById(1);
    expect(order.status).to.equal(0n);
    expect(await c.multiPayment.totalEscrowedETH()).to.equal(c.ETH_AMOUNT);
    expect(await ethers.provider.getBalance(c.multiPaymentAddress)).to.equal(c.ETH_AMOUNT);
  });

  it("lets a rejecting seller refund the preserved escrow to the buyer", async function () {
    const RejectingReceiver = await ethers.getContractFactory("RejectingReceiver");
    const rejecting = await RejectingReceiver.deploy();
    await rejecting.waitForDeployment();
    const rejectingAddress = await rejecting.getAddress();

    await c.multiPayment
      .connect(c.buyer)
      .createEscrowPayment(rejectingAddress, { value: c.ETH_AMOUNT });
    await expect(c.multiPayment.connect(c.buyer).confirmReceipt(1)).to.be.reverted;

    await expect(rejecting.refundOrder(c.multiPaymentAddress, 1)).not.to.be.reverted;
    expect((await c.multiPayment.orderById(1)).status).to.equal(3n);
    expect(await c.multiPayment.totalEscrowedETH()).to.equal(0n);
  });

  it("rejects fee-on-transfer deposits and rolls back order and liability", async function () {
    const FeeToken = await ethers.getContractFactory("FeeOnTransferToken");
    const token = await FeeToken.deploy(100); // 1%
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    await token.mint(c.buyer.address, c.TOKEN_AMOUNT);
    await c.multiPayment.connect(c.owner).setTokenApproval(tokenAddress, true);
    await token.connect(c.buyer).approve(c.multiPaymentAddress, c.TOKEN_AMOUNT);

    const expectedReceived = (c.TOKEN_AMOUNT * 9900n) / 10000n;
    await expect(
      c.multiPayment
        .connect(c.buyer)
        .createERC20EscrowPayment(c.seller.address, tokenAddress, c.TOKEN_AMOUNT)
    )
      .to.be.revertedWithCustomError(c.multiPayment, "UnsupportedTokenBehavior")
      .withArgs(tokenAddress, c.TOKEN_AMOUNT, expectedReceived);

    expect(await c.multiPayment.nextOrderId()).to.equal(1n);
    expect(await c.multiPayment.totalEscrowedToken(tokenAddress)).to.equal(0n);
    expect(await token.balanceOf(c.multiPaymentAddress)).to.equal(0n);
  });

  it("rejects tokens that become fee-on-transfer only during payout", async function () {
    const OutboundFeeToken = await ethers.getContractFactory("OutboundFeeToken");
    const token = await OutboundFeeToken.deploy(100); // 1%
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    await token.mint(c.buyer.address, c.TOKEN_AMOUNT);
    await c.multiPayment.connect(c.owner).setTokenApproval(tokenAddress, true);
    await token.connect(c.buyer).approve(c.multiPaymentAddress, c.TOKEN_AMOUNT);
    await c.multiPayment
      .connect(c.buyer)
      .createERC20EscrowPayment(c.seller.address, tokenAddress, c.TOKEN_AMOUNT);
    await token.setFeeSender(c.multiPaymentAddress);

    const expectedReceived = (c.TOKEN_AMOUNT * 9900n) / 10000n;
    await expect(c.multiPayment.connect(c.buyer).confirmReceipt(1))
      .to.be.revertedWithCustomError(c.multiPayment, "UnsupportedTokenBehavior")
      .withArgs(tokenAddress, c.TOKEN_AMOUNT, expectedReceived);

    expect((await c.multiPayment.orderById(1)).status).to.equal(0n);
    expect(await c.multiPayment.totalEscrowedToken(tokenAddress)).to.equal(c.TOKEN_AMOUNT);
    expect(await token.balanceOf(c.multiPaymentAddress)).to.equal(c.TOKEN_AMOUNT);
  });

  it("blocks ERC20 callback reentrancy during transferFrom", async function () {
    const ReentrantToken = await ethers.getContractFactory("ReentrantToken");
    const token = await ReentrantToken.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    await token.mint(c.buyer.address, c.TOKEN_AMOUNT);
    await c.multiPayment.connect(c.owner).setTokenApproval(tokenAddress, true);
    await token.connect(c.buyer).approve(c.multiPaymentAddress, c.TOKEN_AMOUNT);
    await token.arm(c.multiPaymentAddress, c.outsider.address);

    await c.multiPayment
      .connect(c.buyer)
      .createERC20EscrowPayment(c.seller.address, tokenAddress, c.TOKEN_AMOUNT);

    expect(await token.reentryAttempted()).to.equal(true);
    expect(await token.reentrySucceeded()).to.equal(false);
    expect(await c.multiPayment.nextOrderId()).to.equal(2n);
    expect(await c.multiPayment.totalEscrowedToken(tokenAddress)).to.equal(c.TOKEN_AMOUNT);
  });

  it("keeps ETH and token liabilities solvent across mixed exits", async function () {
    await c.mockToken
      .connect(c.buyer)
      .approve(c.multiPaymentAddress, c.TOKEN_AMOUNT * 3n);

    await c.multiPayment
      .connect(c.buyer)
      .createEscrowPayment(c.seller.address, { value: c.ETH_AMOUNT });
    await c.multiPayment
      .connect(c.buyer)
      .createEscrowPayment(c.seller.address, { value: c.ETH_AMOUNT });
    await c.multiPayment
      .connect(c.buyer)
      .createERC20EscrowPayment(c.seller.address, c.tokenAddress, c.TOKEN_AMOUNT);
    await c.multiPayment
      .connect(c.buyer)
      .createERC20EscrowPayment(c.seller.address, c.tokenAddress, c.TOKEN_AMOUNT);

    await c.multiPayment.connect(c.buyer).confirmReceipt(1);
    await c.multiPayment.connect(c.seller).refund(2);
    await c.multiPayment.connect(c.buyer).openDispute(3);
    await c.multiPayment.connect(c.arbitrator).resolveDispute(3, true);
    await c.multiPayment.connect(c.seller).refund(4);

    expect(await c.multiPayment.totalEscrowedETH()).to.equal(0n);
    expect(await c.multiPayment.totalEscrowedToken(c.tokenAddress)).to.equal(0n);
    expect(await c.multiPayment.isSolvent(ethers.ZeroAddress)).to.equal(true);
    expect(await c.multiPayment.isSolvent(c.tokenAddress)).to.equal(true);
  });

  it("removes the old arbitrator's authority immediately after role transfer", async function () {
    await c.multiPayment
      .connect(c.buyer)
      .createEscrowPayment(c.seller.address, { value: c.ETH_AMOUNT });
    await c.multiPayment.connect(c.buyer).openDispute(1);

    await c.multiPayment.connect(c.owner).proposeArbitrator(c.newArbitrator.address);
    await c.multiPayment.connect(c.newArbitrator).acceptArbitratorRole();

    await expect(c.multiPayment.connect(c.arbitrator).resolveDispute(1, true))
      .to.be.revertedWithCustomError(c.multiPayment, "UnauthorizedArbitrator")
      .withArgs(c.arbitrator.address);

    await expect(
      c.multiPayment.connect(c.newArbitrator).resolveDispute(1, true)
    ).not.to.be.reverted;
  });

  it("cannot resolve the same dispute twice", async function () {
    await c.multiPayment
      .connect(c.buyer)
      .createEscrowPayment(c.seller.address, { value: c.ETH_AMOUNT });
    await c.multiPayment.connect(c.buyer).openDispute(1);
    await c.multiPayment.connect(c.arbitrator).resolveDispute(1, false);

    await expect(c.multiPayment.connect(c.arbitrator).resolveDispute(1, true))
      .to.be.revertedWithCustomError(c.multiPayment, "InvalidOrderStatus")
      .withArgs(1n, 3n);
  });

  it("forced ETH can increase balance but cannot corrupt recorded liability", async function () {
    await c.multiPayment
      .connect(c.buyer)
      .createEscrowPayment(c.seller.address, { value: c.ETH_AMOUNT });

    const ForceSend = await ethers.getContractFactory("ForceSend");
    const force = await ForceSend.deploy({ value: ethers.parseEther("0.25") });
    await force.waitForDeployment();
    await force.force(c.multiPaymentAddress);

    expect(await c.multiPayment.totalEscrowedETH()).to.equal(c.ETH_AMOUNT);
    expect(await ethers.provider.getBalance(c.multiPaymentAddress)).to.equal(
      ethers.parseEther("1.25")
    );
    expect(await c.multiPayment.isSolvent(ethers.ZeroAddress)).to.equal(true);
  });
});
