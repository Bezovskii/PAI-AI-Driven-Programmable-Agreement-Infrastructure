const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture } = require("./helpers/deployFixture");

describe("MultiPayment - refund", function () {
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

    it("allows seller to refund ETH escrow to buyer", async function () {
        const before = await ethers.provider.getBalance(c.buyer.address);

        await expect(c.multiPayment.connect(c.seller).refund(1))
            .to.emit(c.multiPayment, "EscrowPaymentRefunded")
            .withArgs(
                1n,
                c.buyer.address,
                c.seller.address,
                ethers.ZeroAddress,
                c.ETH_AMOUNT
            );

        const after = await ethers.provider.getBalance(c.buyer.address);
        const order = await c.multiPayment.orderById(1);

        expect(after - before).to.equal(c.ETH_AMOUNT);
        expect(order.status).to.equal(3n);
        expect(await c.multiPayment.totalEscrowedETH()).to.equal(0n);
    });

    it("rejects anyone except seller", async function () {
        await expect(
            c.multiPayment.connect(c.outsider).refund(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "UnauthorizedSeller"
            )
            .withArgs(c.outsider.address);
    });

    it("rejects nonexistent order", async function () {
        await expect(
            c.multiPayment.connect(c.seller).refund(999)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "OrderDoesNotExist"
            )
            .withArgs(999n);
    });

    it("rejects second refund", async function () {
        await (await c.multiPayment.connect(c.seller).refund(1)).wait();

        await expect(
            c.multiPayment.connect(c.seller).refund(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidOrderStatus"
            )
            .withArgs(1n, 3n);
    });

    it("rejects refund after dispute", async function () {
        await (await c.multiPayment.connect(c.buyer).openDispute(1)).wait();

        await expect(
            c.multiPayment.connect(c.seller).refund(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidOrderStatus"
            )
            .withArgs(1n, 1n);
    });

    it("allows existing escrow refund while new payments are paused", async function () {
        await (await c.multiPayment.connect(c.owner).pauseNewPayments()).wait();

        await expect(
            c.multiPayment.connect(c.seller).refund(1)
        ).not.to.be.reverted;
    });
});
