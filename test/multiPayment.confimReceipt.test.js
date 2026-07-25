const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture } = require("./helpers/deployFixture");

describe("MultiPayment - confirmReceipt", function () {
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

    it("allows buyer to release ETH escrow to seller", async function () {
        const before = await ethers.provider.getBalance(c.seller.address);

        await expect(c.multiPayment.connect(c.buyer).confirmReceipt(1))
            .to.emit(c.multiPayment, "PaymentReceivedConfirmed")
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
        expect(order.status).to.equal(2n);
        expect(await c.multiPayment.totalEscrowedETH()).to.equal(0n);
    });

    it("rejects anyone except buyer", async function () {
        await expect(
            c.multiPayment.connect(c.outsider).confirmReceipt(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "UnauthorizedBuyer"
            )
            .withArgs(c.outsider.address);
    });

    it("rejects nonexistent order", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).confirmReceipt(999)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "OrderDoesNotExist"
            )
            .withArgs(999n);
    });

    it("rejects a direct-payment order", async function () {
        await (
            await c.multiPayment.connect(c.buyer).createDirectPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        ).wait();

        await expect(
            c.multiPayment.connect(c.buyer).confirmReceipt(2)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidPaymentType"
            )
            .withArgs(2n, 0n);
    });

    it("rejects second confirmation", async function () {
        await (await c.multiPayment.connect(c.buyer).confirmReceipt(1)).wait();

        await expect(
            c.multiPayment.connect(c.buyer).confirmReceipt(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidOrderStatus"
            )
            .withArgs(1n, 2n);
    });

    it("rejects confirmation after dispute", async function () {
        await (await c.multiPayment.connect(c.buyer).openDispute(1)).wait();

        await expect(
            c.multiPayment.connect(c.buyer).confirmReceipt(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidOrderStatus"
            )
            .withArgs(1n, 1n);
    });

    it("allows existing escrow exit while new payments are paused", async function () {
        await (await c.multiPayment.connect(c.owner).pauseNewPayments()).wait();

        await expect(
            c.multiPayment.connect(c.buyer).confirmReceipt(1)
        ).not.to.be.reverted;
    });
});
