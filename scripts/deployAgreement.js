const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
    const { ethers, artifacts } = hre;

    const [deployer] = await ethers.getSigners();

    const network =
        await ethers.provider.getNetwork();

    const ownerAddress =
        process.env.INITIAL_OWNER ||
        deployer.address;

    const arbitratorAddress =
        process.env.INITIAL_ARBITRATOR ||
        deployer.address;

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

    console.log(
        "\n=== ESCT AGREEMENT V1 DEPLOYMENT ==="
    );

    console.log(
        "Chain ID:",
        network.chainId.toString()
    );

    console.log(
        "Deployer:",
        deployer.address
    );

    console.log(
        "Initial owner:",
        ownerAddress
    );

    console.log(
        "Initial arbitrator:",
        arbitratorAddress
    );

    const AgreementEscrow =
        await ethers.getContractFactory(
            "AgreementEscrow"
        );

    const agreementEscrow =
        await AgreementEscrow.deploy(
            ownerAddress,
            arbitratorAddress
        );

    console.log(
        "\nDeployment transaction:",
        agreementEscrow
            .deploymentTransaction()
            .hash
    );

    await agreementEscrow.waitForDeployment();

    const agreementAddress =
        await agreementEscrow.getAddress();

    console.log(
        "AgreementEscrow deployed to:",
        agreementAddress
    );

    const frontendContractDir =
        path.join(
            __dirname,
            "..",
            "frontend",
            "src",
            "contract"
        );

    fs.mkdirSync(
        frontendContractDir,
        {
            recursive: true,
        }
    );

    const addressFile =
        path.join(
            frontendContractDir,
            "agreementContractAddress.js"
        );

    const addressContent =
        `export const agreementContractAddress = "${agreementAddress}";
`;

    fs.writeFileSync(
        addressFile,
        addressContent,
        "utf8"
    );

    console.log(
        "Frontend Agreement address updated:",
        addressFile
    );

    const artifact =
        await artifacts.readArtifact(
            "AgreementEscrow"
        );

    const abiFile =
        path.join(
            frontendContractDir,
            "AgreementEscrowABI.json"
        );

    fs.writeFileSync(
        abiFile,
        JSON.stringify(
            artifact.abi,
            null,
            2
        ),
        "utf8"
    );

    console.log(
        "Frontend Agreement ABI updated:",
        abiFile
    );

    const deployedOwner =
        await agreementEscrow.owner();

    const deployedArbitrator =
        await agreementEscrow.arbitrator();

    const paused =
        await agreementEscrow.paused();

    const nextAgreementId =
        await agreementEscrow.nextAgreementId();

    console.log(
        "\n=== AGREEMENT V1 VERIFICATION ==="
    );

    console.log(
        "Contract owner:",
        deployedOwner
    );

    console.log(
        "Contract arbitrator:",
        deployedArbitrator
    );

    console.log(
        "Protocol paused:",
        paused
    );

    console.log(
        "Next agreement ID:",
        nextAgreementId.toString()
    );

    console.log(
        "=================================\n"
    );
}

main().catch((error) => {
    console.error(
        "\nAgreement deployment failed:"
    );

    console.error(error);

    process.exitCode = 1;
});