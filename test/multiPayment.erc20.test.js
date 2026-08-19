const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture } = require("./helpers/deployFixture");

describe("MultiPayment - ERC20", function () {
    let c;

    beforeEach(async function () {
        c = await deployFixture();
    });

    async function approveBuyer(amount = c.TOKEN_AMOUNT) {
        await (
            await c.mockToken
                .connect(c.buyer)
                .approve(c.multiPaymentAddress, amount)
        ).wait();
    }

    it("creates ERC20 direct payment and pays seller", async function () {
        await approveBuyer();
        const before = await c.mockToken.balanceOf(c.seller.address);

        await expect(
            c.multiPayment.connect(c.buyer).createERC20DirectPayment(
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            )
        )
            .to.emit(c.multiPayment, "DirectPaymentCreated")
            .withArgs(
                1n,
                c.buyer.address,
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            );

        const after = await c.mockToken.balanceOf(c.seller.address);
        const order = await c.multiPayment.orderById(1);

        expect(after - before).to.equal(c.TOKEN_AMOUNT);
        expect(order.paymentType).to.equal(0n);
        expect(order.status).to.equal(2n);
        expect(order.token).to.equal(c.tokenAddress);
    });

    it("creates ERC20 escrow and records liability", async function () {
        await approveBuyer();

        await expect(
            c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            )
        )
            .to.emit(c.multiPayment, "EscrowPaymentCreated")
            .withArgs(
                1n,
                c.buyer.address,
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            );

        expect(
            await c.mockToken.balanceOf(c.multiPaymentAddress)
        ).to.equal(c.TOKEN_AMOUNT);

        expect(
            await c.multiPayment.totalEscrowedToken(c.tokenAddress)
        ).to.equal(c.TOKEN_AMOUNT);

        expect(
            await c.multiPayment.isSolvent(c.tokenAddress)
        ).to.equal(true);
    });

    it("releases ERC20 escrow to seller", async function () {
        await approveBuyer();

        await (
            await c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            )
        ).wait();

        const before = await c.mockToken.balanceOf(c.seller.address);
        await (await c.multiPayment.connect(c.buyer).confirmReceipt(1)).wait();
        const after = await c.mockToken.balanceOf(c.seller.address);

        expect(after - before).to.equal(c.TOKEN_AMOUNT);
        expect(
            await c.multiPayment.totalEscrowedToken(c.tokenAddress)
        ).to.equal(0n);
    });

    it("refunds ERC20 escrow to buyer", async function () {
        await approveBuyer();

        await (
            await c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            )
        ).wait();

        const before = await c.mockToken.balanceOf(c.buyer.address);
        await (await c.multiPayment.connect(c.seller).refund(1)).wait();
        const after = await c.mockToken.balanceOf(c.buyer.address);

        expect(after - before).to.equal(c.TOKEN_AMOUNT);
    });

    it("rejects unapproved token", async function () {
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const otherToken = await MockERC20.deploy();
        await otherToken.waitForDeployment();

        const otherAddress = await otherToken.getAddress();
        await (await otherToken.mint(c.buyer.address, c.TOKEN_AMOUNT)).wait();
        await (
            await otherToken
                .connect(c.buyer)
                .approve(c.multiPaymentAddress, c.TOKEN_AMOUNT)
        ).wait();

        await expect(
            c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                otherAddress,
                c.TOKEN_AMOUNT
            )
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "TokenNotApproved"
            )
            .withArgs(otherAddress);
    });

    it("allows only owner to approve or disable token", async function () {
        await expect(
            c.multiPayment
                .connect(c.outsider)
                .setTokenApproval(c.tokenAddress, false)
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "OwnableUnauthorizedAccount"
            )
            .withArgs(c.outsider.address);
    });

    it("disabled token cannot create new payments", async function () {
        await (
            await c.multiPayment
                .connect(c.owner)
                .setTokenApproval(c.tokenAddress, false)
        ).wait();

        await approveBuyer();

        await expect(
            c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            )
        )
            .to.be.revertedWithCustomError(
                c.multiPayment,
                "TokenNotApproved"
            )
            .withArgs(c.tokenAddress);
    });

    it("existing escrow can exit after token is disabled", async function () {
        await approveBuyer();

        await (
            await c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            )
        ).wait();

        await (
            await c.multiPayment
                .connect(c.owner)
                .setTokenApproval(c.tokenAddress, false)
        ).wait();

        await expect(
            c.multiPayment.connect(c.buyer).confirmReceipt(1)
        ).not.to.be.reverted;
    });

    it("rejects zero token amount", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                c.tokenAddress,
                0
            )
        ).to.be.revertedWithCustomError(c.multiPayment, "InvalidAmount");
    });

    it("rejects EOA as token address", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                c.outsider.address,
                c.TOKEN_AMOUNT
            )
        )
            .to.be.revertedWithCustomError(c.multiPayment, "InvalidToken")
            .withArgs(c.outsider.address);
    });

    it("reverts when allowance is insufficient", async function () {
        await expect(
            c.multiPayment.connect(c.buyer).createERC20EscrowPayment(
                c.seller.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            )
        ).to.be.reverted;
    });
});
