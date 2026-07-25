const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture } = require("./helpers/deployFixture");

describe("MultiPayment - state transitions and administration", function () {
    let c;

    beforeEach(async function () {
        c = await deployFixture();
    });

    it("assigns sequential order IDs", async function () {
        await (
            await c.multiPayment.connect(c.buyer).createEscrowPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        ).wait();

        await (
            await c.multiPayment.connect(c.buyer).createDirectPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        ).wait();

        expect((await c.multiPayment.orderById(1)).id).to.equal(1n);
        expect((await c.multiPayment.orderById(2)).id).to.equal(2n);
        expect(await c.multiPayment.nextOrderId()).to.equal(3n);
    });

    it("completed order cannot become disputed", async function () {
        await (
            await c.multiPayment.connect(c.buyer).createEscrowPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        ).wait();

        await (await c.multiPayment.connect(c.buyer).confirmReceipt(1)).wait();

        await expect(
            c.multiPayment.connect(c.buyer).openDispute(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidOrderStatus"
            )
            .withArgs(1n, 2n);
    });

    it("refunded order cannot become disputed", async function () {
        await (
            await c.multiPayment.connect(c.buyer).createEscrowPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        ).wait();

        await (await c.multiPayment.connect(c.seller).refund(1)).wait();

        await expect(
            c.multiPayment.connect(c.buyer).openDispute(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidOrderStatus"
            )
            .withArgs(1n, 3n);
    });

    it("disputed order cannot be confirmed or refunded directly", async function () {
        await (
            await c.multiPayment.connect(c.buyer).createEscrowPayment(
                c.seller.address,
                { value: c.ETH_AMOUNT }
            )
        ).wait();

        await (await c.multiPayment.connect(c.buyer).openDispute(1)).wait();

        await expect(
            c.multiPayment.connect(c.buyer).confirmReceipt(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidOrderStatus"
            )
            .withArgs(1n, 1n);

        await expect(
            c.multiPayment.connect(c.seller).refund(1)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "InvalidOrderStatus"
            )
            .withArgs(1n, 1n);
    });

    it("only owner can pause", async function () {
        await expect(
            c.multiPayment.connect(c.outsider).pauseNewPayments()
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "OwnableUnauthorizedAccount"
            )
            .withArgs(c.outsider.address);
    });

    it("owner can pause and unpause new payments", async function () {
        await (await c.multiPayment.connect(c.owner).pauseNewPayments()).wait();
        expect(await c.multiPayment.paused()).to.equal(true);

        await (await c.multiPayment.connect(c.owner).unpauseNewPayments()).wait();
        expect(await c.multiPayment.paused()).to.equal(false);
    });

    it("rejects direct ETH sent to receive()", async function () {
        await expect(
            c.buyer.sendTransaction({
                to: c.multiPaymentAddress,
                value: c.ETH_AMOUNT,
            })
        ).to.be.revertedWithCustomError(
            c.multiPayment,
            "DirectEtherNotAccepted"
        );
    });

    it("disables ownership renunciation", async function () {
        await expect(
            c.multiPayment.connect(c.owner).renounceOwnership()
        ).to.be.revertedWithCustomError(
            c.multiPayment,
            "OwnershipRenunciationDisabled"
        );
    });

    it("uses two-step ownership transfer", async function () {
        await (
            await c.multiPayment
                .connect(c.owner)
                .transferOwnership(c.outsider.address)
        ).wait();

        expect(await c.multiPayment.owner()).to.equal(c.owner.address);
        expect(await c.multiPayment.pendingOwner()).to.equal(
            c.outsider.address
        );

        await (
            await c.multiPayment.connect(c.outsider).acceptOwnership()
        ).wait();

        expect(await c.multiPayment.owner()).to.equal(c.outsider.address);
    });

    it("initial owner and arbitrator are separate roles", async function () {
        expect(await c.multiPayment.owner()).to.equal(c.owner.address);
        expect(await c.multiPayment.arbitrator()).to.equal(
            c.arbitrator.address
        );
        expect(c.owner.address).not.to.equal(c.arbitrator.address);
    });
    it("rejects arbitrator acceptance when no transfer is pending", async function () {
        await expect(
            c.multiPayment.connect(c.outsider).acceptArbitratorRole()
        ).to.be.revertedWithCustomError(
            c.multiPayment,
            "NoPendingArbitrator"
        );
    });
});
