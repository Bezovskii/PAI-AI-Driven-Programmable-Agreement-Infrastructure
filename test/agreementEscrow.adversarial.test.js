const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
    deployAgreementFixture,
} = require("./helpers/deployAgreementFixture");

describe("AgreementEscrow - adversarial security", function () {
    let c;

    beforeEach(async function () {
        c = await deployAgreementFixture();
    });

    async function prepareRejectingContractorAgreement() {
        const RejectingContractor =
            await ethers.getContractFactory(
                "RejectingAgreementContractor"
            );

        const rejecting =
            await RejectingContractor.deploy();

        await rejecting.waitForDeployment();

        const rejectingAddress =
            await rejecting.getAddress();

        await c.agreementEscrow
            .connect(c.client)
            .createAgreement(
                rejectingAddress,
                ethers.ZeroAddress,
                "ipfs://rejecting-contractor"
            );

        await c.agreementEscrow
            .connect(c.client)
            .addMilestone(
                1,
                c.ETH_AMOUNT,
                "ipfs://rejecting-milestone"
            );

        await rejecting.acceptAgreement(
            c.agreementEscrowAddress,
            1
        );

        await c.agreementEscrow
            .connect(c.client)
            .fundAgreementETH(
                1,
                {
                    value: c.ETH_AMOUNT,
                }
            );

        await rejecting.submitMilestone(
            c.agreementEscrowAddress,
            1,
            1,
            c.EVIDENCE_URI,
            c.EVIDENCE_HASH
        );

        return {
            rejecting,
            rejectingAddress,
        };
    }

    it("rejects fee-on-transfer funding and rolls back agreement accounting", async function () {
        const FeeToken =
            await ethers.getContractFactory(
                "FeeOnTransferToken"
            );

        const token =
            await FeeToken.deploy(100);

        await token.waitForDeployment();

        const tokenAddress =
            await token.getAddress();

        const amount =
            ethers.parseEther("100");

        await c.agreementEscrow
            .connect(c.owner)
            .setTokenApproval(
                tokenAddress,
                true
            );

        await token.mint(
            c.client.address,
            amount
        );

        await c.agreementEscrow
            .connect(c.client)
            .createAgreement(
                c.contractor.address,
                tokenAddress,
                "ipfs://fee-token-agreement"
            );

        await c.agreementEscrow
            .connect(c.client)
            .addMilestone(
                1,
                amount,
                "ipfs://fee-token-milestone"
            );

        await c.agreementEscrow
            .connect(c.contractor)
            .acceptAgreement(1);

        await token
            .connect(c.client)
            .approve(
                c.agreementEscrowAddress,
                amount
            );

        const expectedReceived =
            (amount * 9900n) /
            10000n;

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .fundAgreementERC20(1)
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "UnsupportedTokenBehavior"
            )
            .withArgs(
                tokenAddress,
                amount,
                expectedReceived
            );

        const agreement =
            await c.agreementEscrow
                .agreementById(1);

        expect(
            agreement.status
        ).to.equal(1n);

        expect(
            agreement.remainingEscrow
        ).to.equal(0n);

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    tokenAddress
                )
        ).to.equal(0n);

        expect(
            await token.balanceOf(
                c.agreementEscrowAddress
            )
        ).to.equal(0n);
    });

    it("rolls back milestone settlement when token becomes fee-on-transfer during payout", async function () {
        const OutboundFeeToken =
            await ethers.getContractFactory(
                "OutboundFeeToken"
            );

        const token =
            await OutboundFeeToken.deploy(
                100
            );

        await token.waitForDeployment();

        const tokenAddress =
            await token.getAddress();

        const amount =
            ethers.parseEther("100");

        await c.agreementEscrow
            .connect(c.owner)
            .setTokenApproval(
                tokenAddress,
                true
            );

        await token.mint(
            c.client.address,
            amount
        );

        await c.agreementEscrow
            .connect(c.client)
            .createAgreement(
                c.contractor.address,
                tokenAddress,
                "ipfs://outbound-fee"
            );

        await c.agreementEscrow
            .connect(c.client)
            .addMilestone(
                1,
                amount,
                "ipfs://outbound-fee-milestone"
            );

        await c.agreementEscrow
            .connect(c.contractor)
            .acceptAgreement(1);

        await token
            .connect(c.client)
            .approve(
                c.agreementEscrowAddress,
                amount
            );

        await c.agreementEscrow
            .connect(c.client)
            .fundAgreementERC20(1);

        await token.setFeeSender(
            c.agreementEscrowAddress
        );

        await c.agreementEscrow
            .connect(c.contractor)
            .submitMilestone(
                1,
                1,
                c.EVIDENCE_URI,
                c.EVIDENCE_HASH
            );

        const expectedReceived =
            (amount * 9900n) /
            10000n;

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .approveMilestone(
                    1,
                    1
                )
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "UnsupportedTokenBehavior"
            )
            .withArgs(
                tokenAddress,
                amount,
                expectedReceived
            );

        const milestone =
            await c.agreementEscrow
                .milestoneById(
                    1,
                    1
                );

        expect(
            milestone.status
        ).to.equal(1n);

        const agreement =
            await c.agreementEscrow
                .agreementById(1);

        expect(
            agreement.status
        ).to.equal(2n);

        expect(
            agreement.remainingEscrow
        ).to.equal(amount);

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    tokenAddress
                )
        ).to.equal(amount);

        expect(
            await token.balanceOf(
                c.agreementEscrowAddress
            )
        ).to.equal(amount);
    });

    it("blocks ERC20 callback reentrancy during agreement funding", async function () {
        const ReentrantToken =
            await ethers.getContractFactory(
                "AgreementReentrantToken"
            );

        const token =
            await ReentrantToken.deploy();

        await token.waitForDeployment();

        const tokenAddress =
            await token.getAddress();

        const amount =
            ethers.parseEther("1");

        await c.agreementEscrow
            .connect(c.owner)
            .setTokenApproval(
                tokenAddress,
                true
            );

        await token.mint(
            c.client.address,
            amount
        );

        await c.agreementEscrow
            .connect(c.client)
            .createAgreement(
                c.contractor.address,
                tokenAddress,
                "ipfs://reentrant-agreement"
            );

        await c.agreementEscrow
            .connect(c.client)
            .addMilestone(
                1,
                amount,
                "ipfs://reentrant-milestone"
            );

        await c.agreementEscrow
            .connect(c.contractor)
            .acceptAgreement(1);

        await token
            .connect(c.client)
            .approve(
                c.agreementEscrowAddress,
                amount
            );

        await token.arm(
            c.agreementEscrowAddress,
            1
        );

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .fundAgreementERC20(1)
        ).not.to.be.reverted;

        expect(
            await token.reentryAttempted()
        ).to.equal(true);

        expect(
            await token.reentrySucceeded()
        ).to.equal(false);

        const agreement =
            await c.agreementEscrow
                .agreementById(1);

        expect(
            agreement.status
        ).to.equal(2n);

        expect(
            agreement.remainingEscrow
        ).to.equal(amount);

        expect(
            await c.agreementEscrow
                .totalEscrowedToken(
                    tokenAddress
                )
        ).to.equal(amount);

        expect(
            await token.balanceOf(
                c.agreementEscrowAddress
            )
        ).to.equal(amount);
    });

    it("preserves ETH milestone state and liability when contractor rejects payout", async function () {
        const {
            rejectingAddress,
        } =
            await prepareRejectingContractorAgreement();

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .approveMilestone(
                    1,
                    1
                )
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "EtherTransferFailed"
            )
            .withArgs(
                rejectingAddress,
                c.ETH_AMOUNT
            );

        const milestone =
            await c.agreementEscrow
                .milestoneById(
                    1,
                    1
                );

        expect(
            milestone.status
        ).to.equal(1n);

        const agreement =
            await c.agreementEscrow
                .agreementById(1);

        expect(
            agreement.status
        ).to.equal(2n);

        expect(
            agreement.remainingEscrow
        ).to.equal(
            c.ETH_AMOUNT
        );

        expect(
            await c.agreementEscrow
                .totalEscrowedETH()
        ).to.equal(
            c.ETH_AMOUNT
        );

        expect(
            await ethers.provider.getBalance(
                c.agreementEscrowAddress
            )
        ).to.equal(
            c.ETH_AMOUNT
        );
    });

    it("lets arbitration refund escrow when the contractor rejects ETH", async function () {
        const {
            rejecting,
        } =
            await prepareRejectingContractorAgreement();

        await rejecting.openDispute(
            c.agreementEscrowAddress,
            1,
            1
        );

        const clientBalanceBefore =
            await ethers.provider.getBalance(
                c.client.address
            );

        await expect(
            c.agreementEscrow
                .connect(c.arbitrator)
                .resolveMilestoneDispute(
                    1,
                    1,
                    false
                )
        ).not.to.be.reverted;

        const clientBalanceAfter =
            await ethers.provider.getBalance(
                c.client.address
            );

        expect(
            clientBalanceAfter -
            clientBalanceBefore
        ).to.equal(
            c.ETH_AMOUNT
        );

        const milestone =
            await c.agreementEscrow
                .milestoneById(
                    1,
                    1
                );

        expect(
            milestone.status
        ).to.equal(4n);

        const agreement =
            await c.agreementEscrow
                .agreementById(1);

        expect(
            agreement.status
        ).to.equal(3n);

        expect(
            agreement.remainingEscrow
        ).to.equal(0n);

        expect(
            await c.agreementEscrow
                .totalEscrowedETH()
        ).to.equal(0n);
    });

    it("forced ETH increases balance without corrupting recorded liability", async function () {
        await c.createFundedEthAgreement();

        const ForceSend =
            await ethers.getContractFactory(
                "ForceSend"
            );

        const forcedAmount =
            ethers.parseEther("0.25");

        const force =
            await ForceSend.deploy({
                value: forcedAmount,
            });

        await force.waitForDeployment();

        await force.force(
            c.agreementEscrowAddress
        );

        expect(
            await c.agreementEscrow
                .totalEscrowedETH()
        ).to.equal(
            c.ETH_AMOUNT
        );

        expect(
            await ethers.provider.getBalance(
                c.agreementEscrowAddress
            )
        ).to.equal(
            c.ETH_AMOUNT +
            forcedAmount
        );

        expect(
            await c.agreementEscrow.isSolvent(
                ethers.ZeroAddress
            )
        ).to.equal(true);

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

        await c.agreementEscrow
            .connect(c.client)
            .approveMilestone(
                1,
                2
            );

        expect(
            await c.agreementEscrow
                .totalEscrowedETH()
        ).to.equal(0n);

        expect(
            await ethers.provider.getBalance(
                c.agreementEscrowAddress
            )
        ).to.equal(
            forcedAmount
        );

        expect(
            await c.agreementEscrow.isSolvent(
                ethers.ZeroAddress
            )
        ).to.equal(true);
    });

    it("pause blocks creation of new agreements", async function () {
        await c.agreementEscrow
            .connect(c.owner)
            .pauseNewAgreements();

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .createAgreement(
                    c.contractor.address,
                    ethers.ZeroAddress,
                    "ipfs://paused"
                )
        ).to.be.revertedWithCustomError(
            c.agreementEscrow,
            "EnforcedPause"
        );
    });

    it("pause blocks funding of accepted agreements", async function () {
        await c.createAcceptedEthAgreement();

        await c.agreementEscrow
            .connect(c.owner)
            .pauseNewAgreements();

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .fundAgreementETH(
                    1,
                    {
                        value: c.ETH_AMOUNT,
                    }
                )
        ).to.be.revertedWithCustomError(
            c.agreementEscrow,
            "EnforcedPause"
        );

        const agreement =
            await c.agreementEscrow
                .agreementById(1);

        expect(
            agreement.status
        ).to.equal(1n);

        expect(
            agreement.remainingEscrow
        ).to.equal(0n);

        expect(
            await c.agreementEscrow
                .totalEscrowedETH()
        ).to.equal(0n);
    });

    it("pause does not trap an already-funded milestone release", async function () {
        await c.createFundedEthAgreement();

        await c.agreementEscrow
            .connect(c.owner)
            .pauseNewAgreements();

        await expect(
            c.agreementEscrow
                .connect(c.contractor)
                .submitMilestone(
                    1,
                    1,
                    c.EVIDENCE_URI,
                    c.EVIDENCE_HASH
                )
        ).not.to.be.reverted;

        await expect(
            c.agreementEscrow
                .connect(c.client)
                .approveMilestone(
                    1,
                    1
                )
        ).not.to.be.reverted;

        expect(
            (
                await c.agreementEscrow
                    .milestoneById(
                        1,
                        1
                    )
            ).status
        ).to.equal(3n);

        expect(
            await c.agreementEscrow
                .totalEscrowedETH()
        ).to.equal(
            c.ETH_MILESTONE_TWO
        );
    });

    it("pause does not block resolution of an existing dispute", async function () {
        await c.createFundedEthAgreement();

        await c.submitMilestone(
            1,
            1
        );

        await c.agreementEscrow
            .connect(c.client)
            .openMilestoneDispute(
                1,
                1
            );

        await c.agreementEscrow
            .connect(c.owner)
            .pauseNewAgreements();

        await expect(
            c.agreementEscrow
                .connect(c.arbitrator)
                .resolveMilestoneDispute(
                    1,
                    1,
                    false
                )
        ).not.to.be.reverted;

        expect(
            (
                await c.agreementEscrow
                    .milestoneById(
                        1,
                        1
                    )
            ).status
        ).to.equal(4n);

        expect(
            await c.agreementEscrow
                .totalEscrowedETH()
        ).to.equal(
            c.ETH_MILESTONE_TWO
        );
    });

    it("removes the old arbitrator authority after two-step role transfer", async function () {
        await c.createFundedEthAgreement();

        await c.submitMilestone(
            1,
            1
        );

        await c.agreementEscrow
            .connect(c.client)
            .openMilestoneDispute(
                1,
                1
            );

        await c.agreementEscrow
            .connect(c.owner)
            .proposeArbitrator(
                c.newArbitrator.address
            );

        await expect(
            c.agreementEscrow
                .connect(c.outsider)
                .acceptArbitratorRole()
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "UnauthorizedPendingArbitrator"
            )
            .withArgs(
                c.outsider.address
            );

        await c.agreementEscrow
            .connect(c.newArbitrator)
            .acceptArbitratorRole();

        expect(
            await c.agreementEscrow.arbitrator()
        ).to.equal(
            c.newArbitrator.address
        );

        await expect(
            c.agreementEscrow
                .connect(c.arbitrator)
                .resolveMilestoneDispute(
                    1,
                    1,
                    true
                )
        )
            .to.be.revertedWithCustomError(
                c.agreementEscrow,
                "UnauthorizedArbitrator"
            )
            .withArgs(
                c.arbitrator.address
            );

        await expect(
            c.agreementEscrow
                .connect(c.newArbitrator)
                .resolveMilestoneDispute(
                    1,
                    1,
                    true
                )
        ).not.to.be.reverted;
    });

    it("cancelled arbitrator transfer cannot later be accepted", async function () {
        await c.agreementEscrow
            .connect(c.owner)
            .proposeArbitrator(
                c.newArbitrator.address
            );

        expect(
            await c.agreementEscrow
                .pendingArbitrator()
        ).to.equal(
            c.newArbitrator.address
        );

        await c.agreementEscrow
            .connect(c.owner)
            .cancelArbitratorTransfer();

        expect(
            await c.agreementEscrow
                .pendingArbitrator()
        ).to.equal(
            ethers.ZeroAddress
        );

        await expect(
            c.agreementEscrow
                .connect(c.newArbitrator)
                .acceptArbitratorRole()
        ).to.be.revertedWithCustomError(
            c.agreementEscrow,
            "NoPendingArbitrator"
        );
    });

    it("prevents ownership renunciation", async function () {
        await expect(
            c.agreementEscrow
                .connect(c.owner)
                .renounceOwnership()
        ).to.be.revertedWithCustomError(
            c.agreementEscrow,
            "OwnershipRenunciationDisabled"
        );

        expect(
            await c.agreementEscrow.owner()
        ).to.equal(
            c.owner.address
        );
    });
});