const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
    deployAgreementFixture,
} = require("./helpers/deployAgreementFixture");

describe("AgreementEscrow - lifecycle", function () {
    let c;

    beforeEach(async function () {
        c = await deployAgreementFixture();
    });

    describe("Agreement creation", function () {
        it("creates an ETH agreement in Proposed state", async function () {
            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .createAgreement(
                        c.contractor.address,
                        ethers.ZeroAddress,
                        "ipfs://agreement-eth"
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
                    ethers.ZeroAddress,
                    "ipfs://agreement-eth"
                );

            const agreement =
                await c.agreementEscrow.agreementById(1);

            expect(agreement.id).to.equal(1n);

            expect(agreement.client).to.equal(
                c.client.address
            );

            expect(agreement.contractor).to.equal(
                c.contractor.address
            );

            expect(agreement.token).to.equal(
                ethers.ZeroAddress
            );

            expect(agreement.totalAmount).to.equal(
                0n
            );

            expect(
                agreement.remainingEscrow
            ).to.equal(0n);

            expect(agreement.status).to.equal(0n);

            expect(agreement.metadataURI).to.equal(
                "ipfs://agreement-eth"
            );

            expect(
                agreement.milestoneCount
            ).to.equal(0n);

            expect(agreement.exists).to.equal(true);

            expect(
                await c.agreementEscrow.nextAgreementId()
            ).to.equal(2n);
        });

        it("rejects the client as their own contractor", async function () {
            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .createAgreement(
                        c.client.address,
                        ethers.ZeroAddress,
                        "ipfs://invalid"
                    )
            ).to.be.revertedWithCustomError(
                c.agreementEscrow,
                "ClientAndContractorMustDiffer"
            );
        });

        it("rejects the zero address as contractor", async function () {
            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .createAgreement(
                        ethers.ZeroAddress,
                        ethers.ZeroAddress,
                        "ipfs://invalid"
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "InvalidContractor"
                )
                .withArgs(ethers.ZeroAddress);
        });
    });

    describe("Milestone construction", function () {
        it("adds milestones and accumulates the agreement total", async function () {
            await c.createEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .addMilestone(
                        1,
                        c.ETH_MILESTONE_ONE,
                        "ipfs://milestone-1"
                    )
            )
                .to.emit(
                    c.agreementEscrow,
                    "MilestoneAdded"
                )
                .withArgs(
                    1n,
                    1n,
                    c.ETH_MILESTONE_ONE,
                    "ipfs://milestone-1"
                );

            await c.agreementEscrow
                .connect(c.client)
                .addMilestone(
                    1,
                    c.ETH_MILESTONE_TWO,
                    "ipfs://milestone-2"
                );

            const agreement =
                await c.agreementEscrow.agreementById(1);

            expect(
                agreement.milestoneCount
            ).to.equal(2n);

            expect(agreement.totalAmount).to.equal(
                c.ETH_AMOUNT
            );

            const milestoneOne =
                await c.agreementEscrow.milestoneById(
                    1,
                    1
                );

            const milestoneTwo =
                await c.agreementEscrow.milestoneById(
                    1,
                    2
                );

            expect(milestoneOne.id).to.equal(1n);

            expect(milestoneOne.amount).to.equal(
                c.ETH_MILESTONE_ONE
            );

            expect(milestoneOne.status).to.equal(0n);

            expect(
                milestoneOne.metadataURI
            ).to.equal("ipfs://milestone-1");

            expect(milestoneOne.exists).to.equal(
                true
            );

            expect(milestoneTwo.id).to.equal(2n);

            expect(milestoneTwo.amount).to.equal(
                c.ETH_MILESTONE_TWO
            );

            expect(milestoneTwo.status).to.equal(0n);
        });

        it("only lets the client add milestones", async function () {
            await c.createEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .addMilestone(
                        1,
                        c.ETH_MILESTONE_ONE,
                        "ipfs://unauthorized"
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "UnauthorizedClient"
                )
                .withArgs(c.contractor.address);
        });

        it("rejects zero-value milestones", async function () {
            await c.createEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .addMilestone(
                        1,
                        0,
                        "ipfs://zero"
                    )
            ).to.be.revertedWithCustomError(
                c.agreementEscrow,
                "InvalidAmount"
            );
        });

        it("prevents milestone changes after contractor acceptance", async function () {
            await c.createAcceptedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .addMilestone(
                        1,
                        ethers.parseEther("0.1"),
                        "ipfs://late-milestone"
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "InvalidAgreementStatus"
                )
                .withArgs(
                    1n,
                    1n
                );
        });
    });

    describe("Agreement acceptance", function () {
        it("lets the contractor accept a configured agreement", async function () {
            await c.createEthAgreement();

            await c.addEthMilestones(1);

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .acceptAgreement(1)
            )
                .to.emit(
                    c.agreementEscrow,
                    "AgreementAccepted"
                )
                .withArgs(
                    1n,
                    c.contractor.address
                );

            const agreement =
                await c.agreementEscrow.agreementById(1);

            expect(agreement.status).to.equal(1n);
        });

        it("rejects acceptance from anyone except the contractor", async function () {
            await c.createEthAgreement();

            await c.addEthMilestones(1);

            await expect(
                c.agreementEscrow
                    .connect(c.outsider)
                    .acceptAgreement(1)
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "UnauthorizedContractor"
                )
                .withArgs(c.outsider.address);
        });

        it("rejects acceptance when no milestones exist", async function () {
            await c.createEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .acceptAgreement(1)
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "AgreementHasNoMilestones"
                )
                .withArgs(1n);
        });
    });

    describe("ETH funding", function () {
        it("funds an accepted agreement and activates it", async function () {
            await c.createAcceptedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .fundAgreementETH(1, {
                        value: c.ETH_AMOUNT,
                    })
            )
                .to.emit(
                    c.agreementEscrow,
                    "AgreementFunded"
                )
                .withArgs(
                    1n,
                    c.client.address,
                    ethers.ZeroAddress,
                    c.ETH_AMOUNT
                );

            const agreement =
                await c.agreementEscrow.agreementById(1);

            expect(agreement.status).to.equal(2n);

            expect(
                agreement.remainingEscrow
            ).to.equal(c.ETH_AMOUNT);

            expect(
                await c.agreementEscrow.totalEscrowedETH()
            ).to.equal(c.ETH_AMOUNT);

            expect(
                await ethers.provider.getBalance(
                    c.agreementEscrowAddress
                )
            ).to.equal(c.ETH_AMOUNT);

            expect(
                await c.agreementEscrow.isSolvent(
                    ethers.ZeroAddress
                )
            ).to.equal(true);
        });

        it("only lets the client fund the agreement", async function () {
            await c.createAcceptedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.outsider)
                    .fundAgreementETH(1, {
                        value: c.ETH_AMOUNT,
                    })
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "UnauthorizedClient"
                )
                .withArgs(c.outsider.address);
        });

        it("requires the exact total ETH amount", async function () {
            await c.createAcceptedEthAgreement();

            const wrongAmount =
                ethers.parseEther("0.9");

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .fundAgreementETH(1, {
                        value: wrongAmount,
                    })
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "InvalidFundingAmount"
                )
                .withArgs(
                    c.ETH_AMOUNT,
                    wrongAmount
                );

            const agreement =
                await c.agreementEscrow.agreementById(1);

            expect(agreement.status).to.equal(1n);

            expect(
                agreement.remainingEscrow
            ).to.equal(0n);

            expect(
                await c.agreementEscrow.totalEscrowedETH()
            ).to.equal(0n);
        });

        it("cannot fund the same agreement twice", async function () {
            await c.createFundedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .fundAgreementETH(1, {
                        value: c.ETH_AMOUNT,
                    })
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
    });

    describe("Milestone submission", function () {
        it("lets the contractor submit delivery evidence", async function () {
            await c.createFundedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .submitMilestone(
                        1,
                        1,
                        c.EVIDENCE_URI,
                        c.EVIDENCE_HASH
                    )
            )
                .to.emit(
                    c.agreementEscrow,
                    "MilestoneSubmitted"
                )
                .withArgs(
                    1n,
                    1n,
                    c.contractor.address,
                    c.EVIDENCE_URI,
                    c.EVIDENCE_HASH
                );

            const milestone =
                await c.agreementEscrow.milestoneById(
                    1,
                    1
                );

            expect(milestone.status).to.equal(1n);

            expect(milestone.evidenceURI).to.equal(
                c.EVIDENCE_URI
            );

            expect(milestone.evidenceHash).to.equal(
                c.EVIDENCE_HASH
            );
        });

        it("rejects milestone submission from a non-contractor", async function () {
            await c.createFundedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .submitMilestone(
                        1,
                        1,
                        c.EVIDENCE_URI,
                        c.EVIDENCE_HASH
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "UnauthorizedContractor"
                )
                .withArgs(c.client.address);
        });

        it("requires a non-zero evidence hash", async function () {
            await c.createFundedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .submitMilestone(
                        1,
                        1,
                        c.EVIDENCE_URI,
                        ethers.ZeroHash
                    )
            ).to.be.revertedWithCustomError(
                c.agreementEscrow,
                "EvidenceHashRequired"
            );

            const milestone =
                await c.agreementEscrow.milestoneById(
                    1,
                    1
                );

            expect(milestone.status).to.equal(0n);
        });

        it("cannot submit the same milestone twice", async function () {
            await c.createFundedEthAgreement();

            await c.submitMilestone(1, 1);

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .submitMilestone(
                        1,
                        1,
                        c.EVIDENCE_URI,
                        c.EVIDENCE_HASH
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
    });

    describe("Milestone release", function () {
        it("releases one milestone and reduces escrow liability", async function () {
            await c.createFundedEthAgreement();

            await c.submitMilestone(1, 1);

            const contractorBalanceBefore =
                await ethers.provider.getBalance(
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
                    ethers.ZeroAddress,
                    c.ETH_MILESTONE_ONE
                );

            const contractorBalanceAfter =
                await ethers.provider.getBalance(
                    c.contractor.address
                );

            expect(
                contractorBalanceAfter -
                contractorBalanceBefore
            ).to.equal(
                c.ETH_MILESTONE_ONE
            );

            const milestone =
                await c.agreementEscrow.milestoneById(
                    1,
                    1
                );

            expect(milestone.status).to.equal(3n);

            const agreement =
                await c.agreementEscrow.agreementById(1);

            expect(agreement.status).to.equal(2n);

            expect(
                agreement.remainingEscrow
            ).to.equal(
                c.ETH_MILESTONE_TWO
            );

            expect(
                await c.agreementEscrow.totalEscrowedETH()
            ).to.equal(
                c.ETH_MILESTONE_TWO
            );

            expect(
                await ethers.provider.getBalance(
                    c.agreementEscrowAddress
                )
            ).to.equal(
                c.ETH_MILESTONE_TWO
            );

            expect(
                await c.agreementEscrow.isSolvent(
                    ethers.ZeroAddress
                )
            ).to.equal(true);
        });

        it("only lets the client approve a submitted milestone", async function () {
            await c.createFundedEthAgreement();

            await c.submitMilestone(1, 1);

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .approveMilestone(
                        1,
                        1
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "UnauthorizedClient"
                )
                .withArgs(c.contractor.address);
        });

        it("cannot approve a milestone before submission", async function () {
            await c.createFundedEthAgreement();

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
                    0n
                );
        });
    });

    describe("Agreement completion", function () {
        it("completes after every milestone has been settled", async function () {
            await c.createFundedEthAgreement();

            await c.submitMilestone(1, 1);

            await c.agreementEscrow
                .connect(c.client)
                .approveMilestone(
                    1,
                    1
                );

            let agreement =
                await c.agreementEscrow.agreementById(1);

            expect(agreement.status).to.equal(2n);

            expect(
                agreement.remainingEscrow
            ).to.equal(
                c.ETH_MILESTONE_TWO
            );

            await c.submitMilestone(1, 2);

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

            agreement =
                await c.agreementEscrow.agreementById(1);

            expect(agreement.status).to.equal(3n);

            expect(
                agreement.remainingEscrow
            ).to.equal(0n);

            expect(
                await c.agreementEscrow.totalEscrowedETH()
            ).to.equal(0n);

            expect(
                await ethers.provider.getBalance(
                    c.agreementEscrowAddress
                )
            ).to.equal(0n);

            const milestoneOne =
                await c.agreementEscrow.milestoneById(
                    1,
                    1
                );

            const milestoneTwo =
                await c.agreementEscrow.milestoneById(
                    1,
                    2
                );

            expect(milestoneOne.status).to.equal(3n);

            expect(milestoneTwo.status).to.equal(3n);

            expect(
                await c.agreementEscrow.isSolvent(
                    ethers.ZeroAddress
                )
            ).to.equal(true);
        });
    });

    describe("Cancellation", function () {
        it("lets the client cancel a proposed agreement", async function () {
            await c.createEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .cancelAgreement(1)
            )
                .to.emit(
                    c.agreementEscrow,
                    "AgreementCancelled"
                )
                .withArgs(
                    1n,
                    c.client.address
                );

            const agreement =
                await c.agreementEscrow.agreementById(1);

            expect(agreement.status).to.equal(4n);
        });

        it("lets the contractor cancel an accepted but unfunded agreement", async function () {
            await c.createAcceptedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .cancelAgreement(1)
            )
                .to.emit(
                    c.agreementEscrow,
                    "AgreementCancelled"
                )
                .withArgs(
                    1n,
                    c.contractor.address
                );

            expect(
                (
                    await c.agreementEscrow.agreementById(
                        1
                    )
                ).status
            ).to.equal(4n);
        });

        it("does not allow cancellation after funding", async function () {
            await c.createFundedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .cancelAgreement(1)
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
    });

    describe("Missing entities", function () {
        it("rejects unknown agreement IDs", async function () {
            await expect(
                c.agreementEscrow
                    .connect(c.client)
                    .addMilestone(
                        999,
                        1,
                        "ipfs://missing"
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "AgreementDoesNotExist"
                )
                .withArgs(999n);
        });

        it("rejects unknown milestone IDs", async function () {
            await c.createFundedEthAgreement();

            await expect(
                c.agreementEscrow
                    .connect(c.contractor)
                    .submitMilestone(
                        1,
                        999,
                        c.EVIDENCE_URI,
                        c.EVIDENCE_HASH
                    )
            )
                .to.be.revertedWithCustomError(
                    c.agreementEscrow,
                    "MilestoneDoesNotExist"
                )
                .withArgs(
                    1n,
                    999n
                );
        });
    });
});