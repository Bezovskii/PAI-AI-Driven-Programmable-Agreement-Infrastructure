const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture } = require("./helpers/deployFixture");

describe("MultiPayment - disputes", function () {
  let c;

  beforeEach(async function () {
    c = await deployFixture();
    await (
      await c.multiPayment.connect(c.buyer).createEscrowPayment(
        c.seller.address,
        { value: c.ETH_AMOUNT }
      )
    ).wait();
  });

  it("allows buyer to open dispute", async function () {
    await expect(c.multiPayment.connect(c.buyer).openDispute(1))
      .to.emit(c.multiPayment, "DisputeOpened")
      .withArgs(1n, c.buyer.address);

    expect((await c.multiPayment.orderById(1)).status).to.equal(1n);
  });

  it("allows seller to open dispute", async function () {
    await expect(c.multiPayment.connect(c.seller).openDispute(1))
      .to.emit(c.multiPayment, "DisputeOpened")
      .withArgs(1n, c.seller.address);
  });

  it("rejects unrelated party opening dispute", async function () {
    await expect(
      c.multiPayment.connect(c.outsider).openDispute(1)
    )
      .to.be.revertedWithCustomError(
        c.multiPayment,
        "UnauthorizedParty"
      )
      .withArgs(c.outsider.address);
  });

  it("allows arbitrator to release disputed ETH to seller", async function () {
    await (await c.multiPayment.connect(c.buyer).openDispute(1)).wait();
    const before = await ethers.provider.getBalance(c.seller.address);

    await expect(
      c.multiPayment.connect(c.arbitrator).resolveDispute(1, true)
    )
      .to.emit(c.multiPayment, "DisputeResolved")
      .withArgs(
        1n,
        c.arbitrator.address,
        c.seller.address,
        true,
        ethers.ZeroAddress,
        c.ETH_AMOUNT
      );

    const after = await ethers.provider.getBalance(c.seller.address);
    expect(after - before).to.equal(c.ETH_AMOUNT);
    expect((await c.multiPayment.orderById(1)).status).to.equal(2n);
    expect(await c.multiPayment.totalEscrowedETH()).to.equal(0n);
  });

  it("allows arbitrator to refund disputed ETH to buyer", async function () {
    await (await c.multiPayment.connect(c.buyer).openDispute(1)).wait();
    const before = await ethers.provider.getBalance(c.buyer.address);

    await (
      await c.multiPayment.connect(c.arbitrator).resolveDispute(1, false)
    ).wait();

    const after = await ethers.provider.getBalance(c.buyer.address);
    expect(after - before).to.equal(c.ETH_AMOUNT);
    expect((await c.multiPayment.orderById(1)).status).to.equal(3n);
  });

  it("rejects non-arbitrator resolution", async function () {
    await (await c.multiPayment.connect(c.buyer).openDispute(1)).wait();

    await expect(
      c.multiPayment.connect(c.outsider).resolveDispute(1, true)
    )
      .to.be.revertedWithCustomError(
        c.multiPayment,
        "UnauthorizedArbitrator"
      )
      .withArgs(c.outsider.address);
  });

  it("rejects resolution before dispute", async function () {
    await expect(
      c.multiPayment.connect(c.arbitrator).resolveDispute(1, true)
    )
      .to.be.revertedWithCustomError(
        c.multiPayment,
        "InvalidOrderStatus"
      )
      .withArgs(1n, 0n);
  });

  it("rotates arbitrator through propose and accept", async function () {
    await expect(
      c.multiPayment
        .connect(c.owner)
        .proposeArbitrator(c.newArbitrator.address)
    )
      .to.emit(c.multiPayment, "ArbitratorTransferStarted")
      .withArgs(c.arbitrator.address, c.newArbitrator.address);

    await expect(
      c.multiPayment.connect(c.newArbitrator).acceptArbitratorRole()
    )
      .to.emit(c.multiPayment, "ArbitratorTransferred")
      .withArgs(c.arbitrator.address, c.newArbitrator.address);

    expect(await c.multiPayment.arbitrator()).to.equal(
      c.newArbitrator.address
    );

    await (await c.multiPayment.connect(c.buyer).openDispute(1)).wait();

    await expect(
      c.multiPayment.connect(c.arbitrator).resolveDispute(1, true)
    )
      .to.be.revertedWithCustomError(
        c.multiPayment,
        "UnauthorizedArbitrator"
      )
      .withArgs(c.arbitrator.address);

    await expect(
      c.multiPayment.connect(c.newArbitrator).resolveDispute(1, true)
    ).not.to.be.reverted;
  });

  it("rejects arbitrator acceptance by wrong address", async function () {
    await (
      await c.multiPayment
        .connect(c.owner)
        .proposeArbitrator(c.newArbitrator.address)
    ).wait();

    await expect(
      c.multiPayment.connect(c.outsider).acceptArbitratorRole()
    )
      .to.be.revertedWithCustomError(
        c.multiPayment,
        "UnauthorizedPendingArbitrator"
      )
      .withArgs(c.outsider.address);
  });

  it("allows dispute and resolution while new payments are paused", async function () {
    await (await c.multiPayment.connect(c.owner).pauseNewPayments()).wait();
    await (await c.multiPayment.connect(c.buyer).openDispute(1)).wait();

    await expect(
      c.multiPayment.connect(c.arbitrator).resolveDispute(1, true)
    ).not.to.be.reverted;
  });
});
