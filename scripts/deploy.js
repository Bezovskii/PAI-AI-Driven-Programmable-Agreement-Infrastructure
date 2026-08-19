const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
    const { ethers } = hre;

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    const ownerAddress =
        process.env.INITIAL_OWNER || deployer.address;

    const arbitratorAddress =
        process.env.INITIAL_ARBITRATOR || deployer.address;

    if (!ethers.isAddress(ownerAddress)) {
        throw new Error(
            `Invalid INITIAL_OWNER address: ${ownerAddress}`
        );
    }

    if (!ethers.isAddress(arbitratorAddress)) {
        throw new Error(
            `Invalid INITIAL_ARBITRATOR address: ${arbitratorAddress}`
        );
    }

    console.log("\n=== ESCT DEPLOYMENT ===");
    console.log("Chain ID:", network.chainId.toString());
    console.log("Deployer:", deployer.address);
    console.log("Initial owner:", ownerAddress);
    console.log("Initial arbitrator:", arbitratorAddress);

    const MultiPayment =
        await ethers.getContractFactory("MultiPayment");

    const multiPayment =
        await MultiPayment.deploy(
            ownerAddress,
            arbitratorAddress
        );

    console.log(
        "\nDeployment transaction:",
        multiPayment.deploymentTransaction().hash
    );

    await multiPayment.waitForDeployment();

    const contractAddress =
        await multiPayment.getAddress();

    console.log(
        "MultiPayment deployed to:",
        contractAddress
    );

    const frontendAddressFile = path.join(
        __dirname,
        "..",
        "frontend",
        "src",
        "contract",
        "contractAddress.js"
    );

    const frontendAddressContent =
        `export const contractAddress =
    "${contractAddress}";
`;

    fs.writeFileSync(
        frontendAddressFile,
        frontendAddressContent,
        "utf8"
    );

    console.log(
        "Frontend address updated:",
        frontendAddressFile
    );

    const deployedOwner =
        await multiPayment.owner();

    const deployedArbitrator =
        await multiPayment.arbitrator();

    console.log("\n=== DEPLOYMENT VERIFICATION ===");
    console.log("Contract owner:", deployedOwner);
    console.log(
        "Contract arbitrator:",
        deployedArbitrator
    );
    console.log(
        "Protocol paused:",
        await multiPayment.paused()
    );
    console.log("==============================\n");
}

main().catch((error) => {
    console.error("\nDeployment failed:");
    console.error(error);
    process.exitCode = 1;
});