const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture } = require("./helpers/deployFixture");

describe("MultiPayment - createDirectPayment", function () {
    let c;

    beforeEach(async function () {
        c = await deployFixture();
    });

    it("creates a completed ETH direct-payment order and pays seller", async function () {
        const before = await ethers.provider.getBalance(c.seller.address);

        await expect(
            c.multiPayment.connect(c.buyer).createDirectPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        )
            .to.emit(c.multiPayment, "DirectPaymentCreated")
            .withArgs(
                1n,
                c.buyer.address,
                c.seller.address,
                ethers.ZeroAddress,
                c.ETH_AMOUNT
            );

        const after = await ethers.provider.getBalance(c.seller.address);
        const order = await c.multiPayment.orderById(1);

        expect(after - before).to.equal(c.ETH_AMOUNT);
        expect(order.buyer).to.equal(c.buyer.address);
        expect(order.seller).to.equal(c.seller.address);
        expect(order.token).to.equal(ethers.ZeroAddress);
        expect(order.amount).to.equal(c.ETH_AMOUNT);
        expect(order.paymentType).to.equal(0n);
        expect(order.status).to.equal(2n);
        expect(order.exists).to.equal(true);
        expect(await c.multiPayment.nextOrderId()).to.equal(2n);
    });

    it("rejects zero seller", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).createDirectPayment(
                ethers.ZeroAddress,
                { value: c.ETH_AMOUNT }
            )
        )
            .to.be.revertedWithCustomError(c.multiPayment, "InvalidSeller")
            .withArgs(ethers.ZeroAddress);
    });

    it("rejects self-payment", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).createDirectPayment(
                c.buyer.address,
                { value: c.ETH_AMOUNT }
            )
        ).to.be.revertedWithCustomError(
            c.multiPayment,
            "BuyerAndSellerMustDiffer"
        );
    });

    it("rejects zero amount", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).createDirectPayment(
                c.seller.address,
                { value: 0 }
            )
        ).to.be.revertedWithCustomError(c.multiPayment, "InvalidAmount");
    });

    it("blocks new direct payments while paused", async function () {
        await (await c.multiPayment.connect(c.owner).pauseNewPayments()).wait();

        await expect(
            c.multiPayment.connect(c.buyer).createDirectPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        ).to.be.revertedWithCustomError(c.multiPayment, "EnforcedPause");
    });
});
