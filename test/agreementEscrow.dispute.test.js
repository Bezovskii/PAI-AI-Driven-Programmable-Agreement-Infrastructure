const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
    deployAgreementFixture,
} = require("./helpers/deployAgreementFixture");

describe("AgreementEscrow - disputes", function () {
    let c;

    beforeEach(async function () {
        c = await deployAgreementFixture();
    });

    async function prepareEthDispute() {
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
    }

    async function prepareTokenDispute() {
        await c.createFundedTokenAgreement();

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
    }

    describe("Opening disputes", function () {
        it("lets the client dispute a submitted milestone", async function () {
            await c.createFundedEthAgreement();

            await c.submitMilestone(
                1,
                1
            );

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .openMilestoneDispute(
                        1,
                        1
                    )
            )
                .to.emit(
                    c.agreementEscrow,
                    "MilestoneDisputeOpened"
                )
                .withArgs(
                    1n,
                    1n,
                    c.client.address
                );

            const milestone =
                await c.agreementEscrow.milestoneById(
                    1,
                    1
                );

            expect(
                milestone.status
            ).to.equal(2n);
        });

        it("lets the contractor dispute their submitted milestone", async function () {
            await c.createFundedEthAgreement();

            await c.submitMilestone(
                1,
                1
            );

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .openMilestoneDispute(
                        1,
                        1
                    )
            )
                .to.emit(
                    c.agreementEscrow,
                    "MilestoneDisputeOpened"
                )
                .withArgs(
                    1n,
                    1n,
                    c.contractor.address
                );

            expect(
                (
                    await c.agreementEscrow
                        .milestoneById(
                            1,
                            1
                        )
                ).status
            ).to.equal(2n);
        });

        it("rejects disputes from outsiders", async function () {
            await c.createFundedEthAgreement();

            await c.submitMilestone(
                1,
                1
            );

            await expect(
                c.agreementEscrow
                    .connect(c.outsider)
                    .openMilestoneDispute(
                        1,
                        1
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "UnauthorizedParty"
                )
                .withArgs(
                    c.outsider.address
                );
        });

        it("cannot dispute a milestone before submission", async function () {
            await c.createFundedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .openMilestoneDispute(
                        1,
                        1
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "InvalidMilestoneStatus"
                )
                .withArgs(
                    1n,
                    1n,
                    0n
                );
        });

        it("cannot open the same dispute twice", async function () {
            await prepareEthDispute();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .openMilestoneDispute(
                        1,
                        1
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "InvalidMilestoneStatus"
                )
                .withArgs(
                    1n,
                    1n,
                    2n
                );
        });

        it("cannot approve a milestone after it enters dispute", async function () {
            await prepareEthDispute();

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
                    "InvalidMilestoneStatus"
                )
                .withArgs(
                    1n,
                    1n,
                    2n
                );
        });
    });

    describe("ETH arbitration", function () {
        it("arbitrator can resolve ETH milestone to contractor", async function () {
            await prepareEthDispute();

            const balanceBefore =
                await ethers.provider.getBalance(
                    c.contractor.address
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
                .to.emit(
                    c.agreementEscrow,
                    "MilestoneDisputeResolved"
                )
                .withArgs(
                    1n,
                    1n,
                    c.arbitrator.address,
                    c.contractor.address,
                    true,
                    ethers.ZeroAddress,
                    c.ETH_MILESTONE_ONE
                );

            const balanceAfter =
                await ethers.provider.getBalance(
                    c.contractor.address
                );

            expect(
                balanceAfter -
                balanceBefore
            ).to.equal(
                c.ETH_MILESTONE_ONE
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
                await c.agreementEscrow.agreementById(
                    1
                );

            expect(
                agreement.remainingEscrow
            ).to.equal(
                c.ETH_MILESTONE_TWO
            );

            expect(
                await c.agreementEscrow
                    .totalEscrowedETH()
            ).to.equal(
                c.ETH_MILESTONE_TWO
            );
        });

        it("arbitrator can resolve ETH milestone to client", async function () {
            await prepareEthDispute();

            const balanceBefore =
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
            )
                .to.emit(
                    c.agreementEscrow,
                    "MilestoneDisputeResolved"
                )
                .withArgs(
                    1n,
                    1n,
                    c.arbitrator.address,
                    c.client.address,
                    false,
                    ethers.ZeroAddress,
                    c.ETH_MILESTONE_ONE
                );

            const balanceAfter =
                await ethers.provider.getBalance(
                    c.client.address
                );

            expect(
                balanceAfter -
                balanceBefore
            ).to.equal(
                c.ETH_MILESTONE_ONE
            );

            const milestone =
                await c.agreementEscrow.milestoneById(
                    1,
                    1
                );

            expect(
                milestone.status
            ).to.equal(4n);

            const agreement =
                await c.agreementEscrow.agreementById(
                    1
                );

            expect(
                agreement.remainingEscrow
            ).to.equal(
                c.ETH_MILESTONE_TWO
            );

            expect(
                await c.agreementEscrow
                    .totalEscrowedETH()
            ).to.equal(
                c.ETH_MILESTONE_TWO
            );
        });

        it("rejects resolution by a non-arbitrator", async function () {
            await prepareEthDispute();

            await expect(
                c.agreementEscrow
                    .connect(c.outsider)
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
                    c.outsider.address
                );
        });

        it("cannot resolve a milestone that is not disputed", async function () {
            await c.createFundedEthAgreement();

            await c.submitMilestone(
                1,
                1
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
                    "InvalidMilestoneStatus"
                )
                .withArgs(
                    1n,
                    1n,
                    1n
                );
        });

        it("cannot resolve the same dispute twice", async function () {
            await prepareEthDispute();

            await c.agreementEscrow
                .connect(c.arbitrator)
                .resolveMilestoneDispute(
                    1,
                    1,
                    false
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
                    "InvalidMilestoneStatus"
                )
                .withArgs(
                    1n,
                    1n,
                    4n
                );
        });
    });

    describe("ERC20 arbitration", function () {
        it("releases disputed ERC20 milestone to contractor", async function () {
            await prepareTokenDispute();

            const contractorBefore =
                await c.mockToken.balanceOf(
                    c.contractor.address
                );

            await c.agreementEscrow
                .connect(c.arbitrator)
                .resolveMilestoneDispute(
                    1,
                    1,
                    true
                );

            const contractorAfter =
                await c.mockToken.balanceOf(
                    c.contractor.address
                );

            expect(
                contractorAfter -
                contractorBefore
            ).to.equal(
                c.MILESTONE_ONE_AMOUNT
            );

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

        it("refunds disputed ERC20 milestone to client", async function () {
            await prepareTokenDispute();

            const clientBefore =
                await c.mockToken.balanceOf(
                    c.client.address
                );

            await c.agreementEscrow
                .connect(c.arbitrator)
                .resolveMilestoneDispute(
                    1,
                    1,
                    false
                );

            const clientAfter =
                await c.mockToken.balanceOf(
                    c.client.address
                );

            expect(
                clientAfter -
                clientBefore
            ).to.equal(
                c.MILESTONE_ONE_AMOUNT
            );

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
    });

    describe("Mixed milestone outcomes", function () {
        it("completes when one milestone is released and another refunded", async function () {
            await c.createFundedEthAgreement();

            /*
             * Milestone #1:
             * normal approval -> contractor
             */

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

            /*
             * Milestone #2:
             * dispute -> refund to client
             */

            await c.submitMilestone(
                1,
                2
            );

            await c.agreementEscrow
                .connect(c.client)
                .openMilestoneDispute(
                    1,
                    2
                );

            await expect(
                c.agreementEscrow
                    .connect(c.arbitrator)
                    .resolveMilestoneDispute(
                        1,
                        2,
                        false
                    )
            )
                .to.emit(
                    c.agreementEscrow,
                    "AgreementCompleted"
                )
                .withArgs(1n);

            const agreement =
                await c.agreementEscrow.agreementById(
                    1
                );

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
                (
                    await c.agreementEscrow
                        .milestoneById(
                            1,
                            2
                        )
                ).status
            ).to.equal(4n);

            expect(
                await c.agreementEscrow.isSolvent(
                    ethers.ZeroAddress
                )
            ).to.equal(true);
        });

        it("completes when every milestone is resolved by arbitration", async function () {
            await c.createFundedTokenAgreement();

            /*
             * Milestone #1 -> contractor
             */

            await c.submitMilestone(
                1,
                1
            );

            await c.agreementEscrow
                .connect(c.contractor)
                .openMilestoneDispute(
                    1,
                    1
                );

            await c.agreementEscrow
                .connect(c.arbitrator)
                .resolveMilestoneDispute(
                    1,
                    1,
                    true
                );

            /*
             * Milestone #2 -> client
             */

            await c.submitMilestone(
                1,
                2
            );

            await c.agreementEscrow
                .connect(c.client)
                .openMilestoneDispute(
                    1,
                    2
                );

            await c.agreementEscrow
                .connect(c.arbitrator)
                .resolveMilestoneDispute(
                    1,
                    2,
                    false
                );

            const agreement =
                await c.agreementEscrow.agreementById(
                    1
                );

            expect(
                agreement.status
            ).to.equal(3n);

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
                    c.contractor.address
                )
            ).to.equal(
                c.MILESTONE_ONE_AMOUNT
            );

            expect(
                await c.agreementEscrow.isSolvent(
                    c.tokenAddress
                )
            ).to.equal(true);
        });
    });
});