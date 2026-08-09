const { ethers } = require("hardhat");

async function deployAgreementFixture() {
    const [
        owner,
        client,
        contractor,
        arbitrator,
        outsider,
        newArbitrator,
    ] = await ethers.getSigners();

    const ETH_AMOUNT = ethers.parseEther("1");

    const TOKEN_AMOUNT = ethers.parseUnits(
        "1000",
        6
    );

    const MILESTONE_ONE_AMOUNT =
        ethers.parseUnits("400", 6);

    const MILESTONE_TWO_AMOUNT =
        ethers.parseUnits("600", 6);

    const ETH_MILESTONE_ONE =
        ethers.parseEther("0.4");

    const ETH_MILESTONE_TWO =
        ethers.parseEther("0.6");

    const AgreementEscrow =
        await ethers.getContractFactory(
            "AgreementEscrow"
        );

    const agreementEscrow =
        await AgreementEscrow.deploy(
            owner.address,
            arbitrator.address
        );

    await agreementEscrow.waitForDeployment();

    const agreementEscrowAddress =
        await agreementEscrow.getAddress();

    const MockERC20 =
        await ethers.getContractFactory(
            "MockERC20"
        );

    const mockToken =
        await MockERC20.deploy();

    await mockToken.waitForDeployment();

    const tokenAddress =
        await mockToken.getAddress();

    await agreementEscrow
        .connect(owner)
        .setTokenApproval(
            tokenAddress,
            true
        );

    await mockToken.mint(
        client.address,
        TOKEN_AMOUNT * 10n
    );

    async function createEthAgreement() {
        await agreementEscrow
            .connect(client)
            .createAgreement(
                contractor.address,
                ethers.ZeroAddress,
                "ipfs://agreement-eth"
            );

        return 1n;
    }

    async function createTokenAgreement() {
        await agreementEscrow
            .connect(client)
            .createAgreement(
                contractor.address,
                tokenAddress,
                "ipfs://agreement-token"
            );

        return 1n;
    }

    async function addEthMilestones(
        agreementId = 1
    ) {
        await agreementEscrow
            .connect(client)
            .addMilestone(
                agreementId,
                ETH_MILESTONE_ONE,
                "ipfs://milestone-1"
            );

        await agreementEscrow
            .connect(client)
            .addMilestone(
                agreementId,
                ETH_MILESTONE_TWO,
                "ipfs://milestone-2"
            );
    }

    async function addTokenMilestones(
        agreementId = 1
    ) {
        await agreementEscrow
            .connect(client)
            .addMilestone(
                agreementId,
                MILESTONE_ONE_AMOUNT,
                "ipfs://milestone-1"
            );

        await agreementEscrow
            .connect(client)
            .addMilestone(
                agreementId,
                MILESTONE_TWO_AMOUNT,
                "ipfs://milestone-2"
            );
    }

    async function createAcceptedEthAgreement() {
        const agreementId =
            await createEthAgreement();

        await addEthMilestones(
            agreementId
        );

        await agreementEscrow
            .connect(contractor)
            .acceptAgreement(
                agreementId
            );

        return agreementId;
    }

    async function createAcceptedTokenAgreement() {
        const agreementId =
            await createTokenAgreement();

        await addTokenMilestones(
            agreementId
        );

        await agreementEscrow
            .connect(contractor)
            .acceptAgreement(
                agreementId
            );

        return agreementId;
    }

    async function createFundedEthAgreement() {
        const agreementId =
            await createAcceptedEthAgreement();

        await agreementEscrow
            .connect(client)
            .fundAgreementETH(
                agreementId,
                {
                    value: ETH_AMOUNT,
                }
            );

        return agreementId;
    }

    async function createFundedTokenAgreement() {
        const agreementId =
            await createAcceptedTokenAgreement();

        await mockToken
            .connect(client)
            .approve(
                agreementEscrowAddress,
                TOKEN_AMOUNT
            );

        await agreementEscrow
            .connect(client)
            .fundAgreementERC20(
                agreementId
            );

        return agreementId;
    }

    const EVIDENCE_URI =
        "ipfs://delivery-evidence";

    const EVIDENCE_HASH =
        ethers.keccak256(
            ethers.toUtf8Bytes(
                "ESCT milestone delivery evidence"
            )
        );

    async function submitMilestone(
        agreementId = 1,
        milestoneId = 1
    ) {
        await agreementEscrow
            .connect(contractor)
            .submitMilestone(
                agreementId,
                milestoneId,
                EVIDENCE_URI,
                EVIDENCE_HASH
            );
    }

    return {
        owner,
        client,
        contractor,
        arbitrator,
        outsider,
        newArbitrator,

        agreementEscrow,
        agreementEscrowAddress,

        mockToken,
        tokenAddress,

        ETH_AMOUNT,
        TOKEN_AMOUNT,

        ETH_MILESTONE_ONE,
        ETH_MILESTONE_TWO,

        MILESTONE_ONE_AMOUNT,
        MILESTONE_TWO_AMOUNT,

        EVIDENCE_URI,
        EVIDENCE_HASH,

        createEthAgreement,
        createTokenAgreement,

        addEthMilestones,
        addTokenMilestones,

        createAcceptedEthAgreement,
        createAcceptedTokenAgreement,

        createFundedEthAgreement,
        createFundedTokenAgreement,

        submitMilestone,
    };
}

module.exports = {
    deployAgreementFixture,
};