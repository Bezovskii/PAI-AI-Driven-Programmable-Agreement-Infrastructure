const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
    deployAgreementFixture,
} = require("./helpers/deployAgreementFixture");

describe("AgreementEscrow - ERC20", function () {
    let c;

    beforeEach(async function () {
        c = await deployAgreementFixture();
    });

    it("creates an agreement using an approved ERC20 token", async function () {
        await expect(
            c.agreementEscrow
                .connect(c.client)
                .createAgreement(
                    c.contractor.address,
                    c.tokenAddress,
                    "ipfs://token-agreement"
                )
        )
            .to.emit(
                c.agreementEscrow,
                "AgreementCreated"
            )
            .withArgs(
                1n,
                c.client.address,
                c.contractor.address,
                c.tokenAddress,
                "ipfs://token-agreement"
            );

        const agreement =
            await c.agreementEscrow.agreementById(1);

        expect(agreement.token).to.equal(
            c.tokenAddress
        );

        expect(agreement.status).to.equal(0n);
    });

    it("rejects agreement creation with an unapproved ERC20 token", async function () {
        const MockERC20 =
            await ethers.getContractFactory(
                "MockERC20"
            );

        const otherToken =
            await MockERC20.deploy();

        await otherToken.waitForDeployment();

        const otherTokenAddress =
            await otherToken.getAddress();

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .createAgreement(
                    c.contractor.address,
                    otherTokenAddress,
                    "ipfs://unapproved"
                )
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "TokenNotApproved"
            )
            .withArgs(otherTokenAddress);
    });

    it("funds an accepted ERC20 agreement with the exact total amount", async function () {
        await c.createAcceptedTokenAgreement();

        await c.mockToken
            .connect(c.client)
            .approve(
                c.agreementEscrowAddress,
                c.TOKEN_AMOUNT
            );

        const clientBalanceBefore =
            await c.mockToken.balanceOf(
                c.client.address
            );

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .fundAgreementERC20(1)
        )
            .to.emit(
                c.agreementEscrow,
                "AgreementFunded"
            )
            .withArgs(
                1n,
                c.client.address,
                c.tokenAddress,
                c.TOKEN_AMOUNT
            );

        const clientBalanceAfter =
            await c.mockToken.balanceOf(
                c.client.address
            );

        expect(
            clientBalanceBefore -
            clientBalanceAfter
        ).to.equal(
            c.TOKEN_AMOUNT
        );

        expect(
            await c.mockToken.balanceOf(
                c.agreementEscrowAddress
            )
        ).to.equal(
            c.TOKEN_AMOUNT
        );

        const agreement =
            await c.agreementEscrow.agreementById(1);

        expect(agreement.status).to.equal(2n);

        expect(
            agreement.remainingEscrow
        ).to.equal(
            c.TOKEN_AMOUNT
        );

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    c.tokenAddress
                )
        ).to.equal(
            c.TOKEN_AMOUNT
        );

        expect(
            await c.agreementEscrow.isSolvent(
                c.tokenAddress
            )
        ).to.equal(true);
    });

    it("only lets the client fund an ERC20 agreement", async function () {
        await c.createAcceptedTokenAgreement();

        await c.mockToken.mint(
            c.outsider.address,
            c.TOKEN_AMOUNT
        );

        await c.mockToken
            .connect(c.outsider)
            .approve(
                c.agreementEscrowAddress,
                c.TOKEN_AMOUNT
            );

        await expect(
            c.agreementEscrow
                .connect(c.outsider)
                .fundAgreementERC20(1)
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "UnauthorizedClient"
            )
            .withArgs(
                c.outsider.address
            );
    });

    it("rejects ERC20 funding for an ETH agreement", async function () {
        await c.createAcceptedEthAgreement();

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .fundAgreementERC20(1)
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "WrongFundingAsset"
            )
            .withArgs(
                1n,
                ethers.ZeroAddress
            );
    });

    it("rejects ETH funding for an ERC20 agreement", async function () {
        await c.createAcceptedTokenAgreement();

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .fundAgreementETH(
                    1,
                    {
                        value:
                            ethers.parseEther("1"),
                    }
                )
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "WrongFundingAsset"
            )
            .withArgs(
                1n,
                c.tokenAddress
            );
    });

    it("cannot fund the same ERC20 agreement twice", async function () {
        await c.createFundedTokenAgreement();

        await c.mockToken
            .connect(c.client)
            .approve(
                c.agreementEscrowAddress,
                c.TOKEN_AMOUNT
            );

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .fundAgreementERC20(1)
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "InvalidAgreementStatus"
            )
            .withArgs(
                1n,
                2n
            );
    });

    it("releases an ERC20 milestone to the contractor", async function () {
        await c.createFundedTokenAgreement();

        await c.submitMilestone(
            1,
            1
        );

        const contractorBalanceBefore =
            await c.mockToken.balanceOf(
                c.contractor.address
            );

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .approveMilestone(
                    1,
                    1
                )
        )
            .to.emit(
                c.agreementEscrow,
                "MilestoneReleased"
            )
            .withArgs(
                1n,
                1n,
                c.contractor.address,
                c.tokenAddress,
                c.MILESTONE_ONE_AMOUNT
            );

        const contractorBalanceAfter =
            await c.mockToken.balanceOf(
                c.contractor.address
            );

        expect(
            contractorBalanceAfter -
            contractorBalanceBefore
        ).to.equal(
            c.MILESTONE_ONE_AMOUNT
        );

        const milestone =
            await c.agreementEscrow.milestoneById(
                1,
                1
            );

        expect(
            milestone.status
        ).to.equal(3n);

        const agreement =
            await c.agreementEscrow.agreementById(1);

        expect(
            agreement.remainingEscrow
        ).to.equal(
            c.MILESTONE_TWO_AMOUNT
        );

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    c.tokenAddress
                )
        ).to.equal(
            c.MILESTONE_TWO_AMOUNT
        );

        expect(
            await c.mockToken.balanceOf(
                c.agreementEscrowAddress
            )
        ).to.equal(
            c.MILESTONE_TWO_AMOUNT
        );

        expect(
            await c.agreementEscrow.isSolvent(
                c.tokenAddress
            )
        ).to.equal(true);
    });

    it("completes an ERC20 agreement after all milestones are released", async function () {
        await c.createFundedTokenAgreement();

        await c.submitMilestone(
            1,
            1
        );

        await c.agreementEscrow
            .connect(c.client)
            .approveMilestone(
                1,
                1
            );

        await c.submitMilestone(
            1,
            2
        );

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .approveMilestone(
                    1,
                    2
                )
        )
            .to.emit(
                c.agreementEscrow,
                "AgreementCompleted"
            )
            .withArgs(1n);

        const agreement =
            await c.agreementEscrow.agreementById(1);

        expect(agreement.status).to.equal(3n);

        expect(
            agreement.remainingEscrow
        ).to.equal(0n);

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    c.tokenAddress
                )
        ).to.equal(0n);

        expect(
            await c.mockToken.balanceOf(
                c.agreementEscrowAddress
            )
        ).to.equal(0n);

        expect(
            await c.mockToken.balanceOf(
                c.contractor.address
            )
        ).to.equal(
            c.TOKEN_AMOUNT
        );

        expect(
            await c.agreementEscrow.isSolvent(
                c.tokenAddress
            )
        ).to.equal(true);
    });

    it("prevents funding if the token is disabled before deposit", async function () {
        await c.createAcceptedTokenAgreement();

        await c.agreementEscrow
            .connect(c.owner)
            .setTokenApproval(
                c.tokenAddress,
                false
            );

        await c.mockToken
            .connect(c.client)
            .approve(
                c.agreementEscrowAddress,
                c.TOKEN_AMOUNT
            );

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .fundAgreementERC20(1)
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "TokenNotApproved"
            )
            .withArgs(
                c.tokenAddress
            );

        const agreement =
            await c.agreementEscrow.agreementById(1);

        expect(agreement.status).to.equal(1n);

        expect(
            agreement.remainingEscrow
        ).to.equal(0n);

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    c.tokenAddress
                )
        ).to.equal(0n);
    });

    it("still allows an already-funded agreement to settle after token approval is disabled", async function () {
        await c.createFundedTokenAgreement();

        await c.agreementEscrow
            .connect(c.owner)
            .setTokenApproval(
                c.tokenAddress,
                false
            );

        await c.submitMilestone(
            1,
            1
        );

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .approveMilestone(
                    1,
                    1
                )
        ).not.to.be.reverted;

        expect(
            await c.mockToken.balanceOf(
                c.contractor.address
            )
        ).to.equal(
            c.MILESTONE_ONE_AMOUNT
        );

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    c.tokenAddress
                )
        ).to.equal(
            c.MILESTONE_TWO_AMOUNT
        );
    });

    it("preserves exact token accounting across sequential milestone releases", async function () {
        await c.createFundedTokenAgreement();

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    c.tokenAddress
                )
        ).to.equal(
            c.TOKEN_AMOUNT
        );

        await c.submitMilestone(
            1,
            1
        );

        await c.agreementEscrow
            .connect(c.client)
            .approveMilestone(
                1,
                1
            );

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    c.tokenAddress
                )
        ).to.equal(
            c.MILESTONE_TWO_AMOUNT
        );

        await c.submitMilestone(
            1,
            2
        );

        await c.agreementEscrow
            .connect(c.client)
            .approveMilestone(
                1,
                2
            );

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    c.tokenAddress
                )
        ).to.equal(0n);

        expect(
            await c.mockToken.balanceOf(
                c.contractor.address
            )
        ).to.equal(
            c.TOKEN_AMOUNT
        );

        expect(
            await c.agreementEscrow.isSolvent(
                c.tokenAddress
            )
        ).to.equal(true);
    });
});