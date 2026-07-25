const { ethers } = require("hardhat");

async function deployFixture() {
    const [
        owner,
        arbitrator,
        buyer,
        seller,
        outsider,
        newArbitrator,
    ] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20.deploy();
    await mockToken.waitForDeployment();

    const MultiPayment = await ethers.getContractFactory("MultiPayment");
    const multiPayment = await MultiPayment.deploy(
        owner.address,
        arbitrator.address
    );
    await multiPayment.waitForDeployment();

    const tokenAddress = await mockToken.getAddress();
    const multiPaymentAddress = await multiPayment.getAddress();

    await (
        await multiPayment
            .connect(owner)
            .setTokenApproval(tokenAddress, true)
    ).wait();

    const BUYER_INITIAL_TOKEN_BALANCE = ethers.parseUnits("100000", 6);
    await (
        await mockToken.mint(
            buyer.address,
            BUYER_INITIAL_TOKEN_BALANCE
        )
    ).wait();

    const ETH_AMOUNT = ethers.parseEther("1");
    const TOKEN_AMOUNT = ethers.parseUnits("100", 6);

    return {
        multiPayment,
        mockToken,
        owner,
        arbitrator,
        buyer,
        seller,
        outsider,
        newArbitrator,
        tokenAddress,
        multiPaymentAddress,
        ETH_AMOUNT,
        TOKEN_AMOUNT,
        BUYER_INITIAL_TOKEN_BALANCE,
    };
}

module.exports = { deployFixture };
