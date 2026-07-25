const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture } = require("./helpers/deployFixture");

describe("MultiPayment - createEscrowPayment", function () {
    let c;

    beforeEach(async function () {
        c = await deployFixture();
    });

    it("creates an ETH escrow, holds funds, and records liability", async function () {
        const sellerBefore = await ethers.provider.getBalance(c.seller.address);

        await expect(
            c.multiPayment.connect(c.buyer).createEscrowPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        )
            .to.emit(c.multiPayment, "EscrowPaymentCreated")
            .withArgs(
                1n,
                c.buyer.address,
                c.seller.address,
                ethers.ZeroAddress,
                c.ETH_AMOUNT
            );

        const order = await c.multiPayment.orderById(1);
        const sellerAfter = await ethers.provider.getBalance(c.seller.address);

        expect(order.paymentType).to.equal(1n);
        expect(order.status).to.equal(0n);
        expect(order.amount).to.equal(c.ETH_AMOUNT);
        expect(sellerAfter).to.equal(sellerBefore);
        expect(
            await ethers.provider.getBalance(c.multiPaymentAddress)
        ).to.equal(c.ETH_AMOUNT);
        expect(await c.multiPayment.totalEscrowedETH()).to.equal(c.ETH_AMOUNT);
        expect(
            await c.multiPayment.isSolvent(ethers.ZeroAddress)
        ).to.equal(true);
    });

    it("rejects zero seller", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).createEscrowPayment(
                ethers.ZeroAddress,
                { value: c.ETH_AMOUNT }
            )
        )
            .to.be.revertedWithCustomError(c.multiPayment, "InvalidSeller")
            .withArgs(ethers.ZeroAddress);
    });

    it("rejects self-payment", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).createEscrowPayment(
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
            c.multiPayment.connect(c.buyer).createEscrowPayment(
                c.seller.address,
                { value: 0 }
            )
        ).to.be.revertedWithCustomError(c.multiPayment, "InvalidAmount");
    });

    it("blocks new escrows while paused", async function () {
        await (await c.multiPayment.connect(c.owner).pauseNewPayments()).wait();

        await expect(
            c.multiPayment.connect(c.buyer).createEscrowPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        ).to.be.revertedWithCustomError(c.multiPayment, "EnforcedPause");
    });
});
