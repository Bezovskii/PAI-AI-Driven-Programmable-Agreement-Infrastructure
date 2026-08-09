// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

interface IAgreementEscrowContractorHarness {
    function acceptAgreement(uint256 agreementId) external;

    function submitMilestone(
        uint256 agreementId,
        uint256 milestoneId,
        string calldata evidenceURI,
        bytes32 evidenceHash
    ) external;

    function openMilestoneDispute(
        uint256 agreementId,
        uint256 milestoneId
    ) external;
}

contract RejectingAgreementContractor {
    function acceptAgreement(address target, uint256 agreementId) external {
        IAgreementEscrowContractorHarness(target).acceptAgreement(agreementId);
    }

    function submitMilestone(
        address target,
        uint256 agreementId,
        uint256 milestoneId,
        string calldata evidenceURI,
        bytes32 evidenceHash
    ) external {
        IAgreementEscrowContractorHarness(target).submitMilestone(
            agreementId,
            milestoneId,
            evidenceURI,
            evidenceHash
        );
    }

    function openDispute(
        address target,
        uint256 agreementId,
        uint256 milestoneId
    ) external {
        IAgreementEscrowContractorHarness(target).openMilestoneDispute(
            agreementId,
            milestoneId
        );
    }

    receive() external payable {
        revert("REJECT_ETH");
    }
}
