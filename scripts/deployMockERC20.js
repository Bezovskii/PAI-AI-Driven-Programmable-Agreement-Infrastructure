const hre = require("hardhat");

async function main() {
    const { ethers } = hre;

    const BUYER =
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    const [deployer] =
        await ethers.getSigners();

    console.log("\n=== MOCK ERC20 DEPLOYMENT ===");
    console.log("Deployer:", deployer.address);
    console.log("Buyer:", BUYER);

    const MockERC20 =
        await ethers.getContractFactory(
            "MockERC20"
        );

    const token =
        await MockERC20.deploy();

    await token.waitForDeployment();

    const tokenAddress =
        await token.getAddress();

    console.log(
        "\nMock USD Coin deployed to:",
        tokenAddress
    );

    const mintAmount =
        ethers.parseUnits(
            "10000",
            6
        );

    const mintTx =
        await token.mint(
            BUYER,
            mintAmount
        );

    await mintTx.wait();

    const balance =
        await token.balanceOf(
            BUYER
        );

    console.log(
        "Minted to buyer:",
        ethers.formatUnits(
            balance,
            6
        ),
        "mUSDC"
    );

    console.log(
        "\nTOKEN ADDRESS:",
        tokenAddress
    );

    console.log(
        "================================\n"
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});