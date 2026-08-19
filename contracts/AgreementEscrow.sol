// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract AgreementEscrow is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    /* =========================================================
                               ENUMS
       ========================================================= */

    enum AgreementStatus {
        Proposed,
        Accepted,
        Active,
        Completed,
        Cancelled
    }

    enum MilestoneStatus {
        Pending,
        Submitted,
        Disputed,
        Released,
        Refunded
    }

    /* =========================================================
                              STRUCTS
       ========================================================= */

    struct Agreement {
        uint256 id;
        address client;
        address contractor;
        address token;
        uint256 totalAmount;
        uint256 remainingEscrow;
        AgreementStatus status;
        string metadataURI;
        uint256 milestoneCount;
        bool exists;
    }

    struct Milestone {
        uint256 id;
        uint256 amount;
        MilestoneStatus status;
        string metadataURI;
        string evidenceURI;
        bytes32 evidenceHash;
        bool exists;
    }

    /* =========================================================
                               ERRORS
       ========================================================= */

    error InvalidAddress(address account);

    error InvalidContractor(address contractor);

    error ClientAndContractorMustDiffer();

    error InvalidToken(address token);

    error TokenNotApproved(address token);

    error InvalidAmount();

    error InvalidFundingAmount(uint256 expected, uint256 received);

    error WrongFundingAsset(uint256 agreementId, address token);

    error AgreementDoesNotExist(uint256 agreementId);

    error MilestoneDoesNotExist(uint256 agreementId, uint256 milestoneId);

    error InvalidAgreementStatus(
        uint256 agreementId,
        AgreementStatus currentStatus
    );

    error InvalidMilestoneStatus(
        uint256 agreementId,
        uint256 milestoneId,
        MilestoneStatus currentStatus
    );

    error UnauthorizedClient(address caller);

    error UnauthorizedContractor(address caller);

    error UnauthorizedParty(address caller);

    error UnauthorizedArbitrator(address caller);

    error AgreementHasNoMilestones(uint256 agreementId);

    error EvidenceHashRequired();

    error EtherTransferFailed(address receiver, uint256 amount);

    error UnsupportedTokenBehavior(
        address token,
        uint256 expected,
        uint256 received
    );

    error InsufficientEscrowLiability(
        address token,
        uint256 available,
        uint256 required
    );

    error InsufficientAgreementEscrow(
        uint256 agreementId,
        uint256 available,
        uint256 required
    );

    error NoPendingArbitrator();

    error UnauthorizedPendingArbitrator(address caller);

    error DirectEtherNotAccepted();

    error OwnershipRenunciationDisabled();

    /* =========================================================
                              STORAGE
       ========================================================= */

    uint256 public nextAgreementId = 1;

    address public arbitrator;
    address public pendingArbitrator;

    uint256 public totalEscrowedETH;

    mapping(address token => uint256 amount) public totalEscrowedToken;

    mapping(address token => bool approved) public approvedToken;

    mapping(uint256 agreementId => Agreement agreement) public agreementById;

    mapping(uint256 agreementId => mapping(uint256 milestoneId => Milestone milestone))
        public milestoneById;

    /* =========================================================
                               EVENTS
       ========================================================= */

    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed client,
        address indexed contractor,
        address token,
        string metadataURI
    );

    event MilestoneAdded(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        uint256 amount,
        string metadataURI
    );

    event AgreementAccepted(
        uint256 indexed agreementId,
        address indexed contractor
    );

    event AgreementFunded(
        uint256 indexed agreementId,
        address indexed client,
        address token,
        uint256 amount
    );

    event AgreementCancelled(
        uint256 indexed agreementId,
        address indexed cancelledBy
    );

    event MilestoneSubmitted(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed contractor,
        string evidenceURI,
        bytes32 evidenceHash
    );

    event MilestoneApproved(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed client
    );

    event MilestoneReleased(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed contractor,
        address token,
        uint256 amount
    );

    event MilestoneRefunded(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed client,
        address token,
        uint256 amount
    );

    event MilestoneDisputeOpened(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed openedBy
    );

    event MilestoneDisputeResolved(
        uint256 indexed agreementId,
        uint256 indexed milestoneId,
        address indexed arbitrator,
        address recipient,
        bool releasedToContractor,
        address token,
        uint256 amount
    );

    event AgreementCompleted(uint256 indexed agreementId);

    event TokenApprovalUpdated(address indexed token, bool approved);

    event ArbitratorTransferStarted(
        address indexed currentArbitrator,
        address indexed pendingArbitrator
    );

    event ArbitratorTransferred(
        address indexed previousArbitrator,
        address indexed newArbitrator
    );

    event ArbitratorTransferCancelled(address indexed cancelledArbitrator);

    /* =========================================================
                              MODIFIERS
       ========================================================= */

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) {
            revert UnauthorizedArbitrator(msg.sender);
        }

        _;
    }

    /* =========================================================
                            CONSTRUCTOR
       ========================================================= */

    constructor(
        address initialOwner,
        address initialArbitrator
    ) Ownable(initialOwner) {
        if (initialArbitrator == address(0)) {
            revert InvalidAddress(initialArbitrator);
        }

        arbitrator = initialArbitrator;

        emit ArbitratorTransferred(address(0), initialArbitrator);
    }

    /* =========================================================
                          RECEIVE / FALLBACK
       ========================================================= */

    receive() external payable {
        revert DirectEtherNotAccepted();
    }

    fallback() external payable {
        revert DirectEtherNotAccepted();
    }

    /* =========================================================
                       AGREEMENT CREATION
       ========================================================= */

    function createAgreement(
        address contractor,
        address token,
        string calldata metadataURI
    ) external whenNotPaused returns (uint256 agreementId) {
        _validateContractor(contractor);

        _validateAgreementToken(token);

        agreementId = nextAgreementId++;

        agreementById[agreementId] = Agreement({
            id: agreementId,
            client: msg.sender,
            contractor: contractor,
            token: token,
            totalAmount: 0,
            remainingEscrow: 0,
            status: AgreementStatus.Proposed,
            metadataURI: metadataURI,
            milestoneCount: 0,
            exists: true
        });

        emit AgreementCreated(
            agreementId,
            msg.sender,
            contractor,
            token,
            metadataURI
        );
    }

    /* =========================================================
                           MILESTONES
       ========================================================= */

    function addMilestone(
        uint256 agreementId,
        uint256 amount,
        string calldata metadataURI
    ) external returns (uint256 milestoneId) {
        Agreement storage agreement = _getAgreement(agreementId);

        if (msg.sender != agreement.client) {
            revert UnauthorizedClient(msg.sender);
        }

        if (agreement.status != AgreementStatus.Proposed) {
            revert InvalidAgreementStatus(agreementId, agreement.status);
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        milestoneId = ++agreement.milestoneCount;

        milestoneById[agreementId][milestoneId] = Milestone({
            id: milestoneId,
            amount: amount,
            status: MilestoneStatus.Pending,
            metadataURI: metadataURI,
            evidenceURI: "",
            evidenceHash: bytes32(0),
            exists: true
        });

        agreement.totalAmount += amount;

        emit MilestoneAdded(agreementId, milestoneId, amount, metadataURI);
    }

    /* =========================================================
                       AGREEMENT ACCEPTANCE
       ========================================================= */

    function acceptAgreement(uint256 agreementId) external {
        Agreement storage agreement = _getAgreement(agreementId);

        if (msg.sender != agreement.contractor) {
            revert UnauthorizedContractor(msg.sender);
        }

        if (agreement.status != AgreementStatus.Proposed) {
            revert InvalidAgreementStatus(agreementId, agreement.status);
        }

        if (agreement.milestoneCount == 0) {
            revert AgreementHasNoMilestones(agreementId);
        }

        agreement.status = AgreementStatus.Accepted;

        emit AgreementAccepted(agreementId, msg.sender);
    }

    /* =========================================================
                           CANCELLATION
       ========================================================= */

    function cancelAgreement(uint256 agreementId) external {
        Agreement storage agreement = _getAgreement(agreementId);

        if (agreement.status == AgreementStatus.Proposed) {
            if (msg.sender != agreement.client) {
                revert UnauthorizedClient(msg.sender);
            }
        } else if (agreement.status == AgreementStatus.Accepted) {
            if (
                msg.sender != agreement.client &&
                msg.sender != agreement.contractor
            ) {
                revert UnauthorizedParty(msg.sender);
            }
        } else {
            revert InvalidAgreementStatus(agreementId, agreement.status);
        }

        agreement.status = AgreementStatus.Cancelled;

        emit AgreementCancelled(agreementId, msg.sender);
    }

    /* =========================================================
                          FUNDING - ETH
       ========================================================= */

    function fundAgreementETH(
        uint256 agreementId
    ) external payable nonReentrant whenNotPaused {
        Agreement storage agreement = _getAgreement(agreementId);

        _validateFundingAccess(agreementId, agreement);

        if (agreement.token != address(0)) {
            revert WrongFundingAsset(agreementId, agreement.token);
        }

        if (msg.value != agreement.totalAmount) {
            revert InvalidFundingAmount(agreement.totalAmount, msg.value);
        }

        agreement.remainingEscrow = msg.value;

        agreement.status = AgreementStatus.Active;

        totalEscrowedETH += msg.value;

        emit AgreementFunded(agreementId, msg.sender, address(0), msg.value);
    }

    /* =========================================================
                         FUNDING - ERC20
       ========================================================= */

    function fundAgreementERC20(
        uint256 agreementId
    ) external nonReentrant whenNotPaused {
        Agreement storage agreement = _getAgreement(agreementId);

        _validateFundingAccess(agreementId, agreement);

        address token = agreement.token;

        if (token == address(0)) {
            revert WrongFundingAsset(agreementId, token);
        }

        _validateApprovedToken(token);

        uint256 amount = agreement.totalAmount;

        agreement.remainingEscrow = amount;

        agreement.status = AgreementStatus.Active;

        totalEscrowedToken[token] += amount;

        _pullExactToken(token, msg.sender, address(this), amount);

        emit AgreementFunded(agreementId, msg.sender, token, amount);
    }

    /* =========================================================
                      CONTRACTOR SUBMISSION
       ========================================================= */

    function submitMilestone(
        uint256 agreementId,
        uint256 milestoneId,
        string calldata evidenceURI,
        bytes32 evidenceHash
    ) external {
        Agreement storage agreement = _getAgreement(agreementId);

        if (msg.sender != agreement.contractor) {
            revert UnauthorizedContractor(msg.sender);
        }

        if (agreement.status != AgreementStatus.Active) {
            revert InvalidAgreementStatus(agreementId, agreement.status);
        }

        Milestone storage milestone = _getMilestone(agreementId, milestoneId);

        if (milestone.status != MilestoneStatus.Pending) {
            revert InvalidMilestoneStatus(
                agreementId,
                milestoneId,
                milestone.status
            );
        }

        if (evidenceHash == bytes32(0)) {
            revert EvidenceHashRequired();
        }

        milestone.evidenceURI = evidenceURI;

        milestone.evidenceHash = evidenceHash;

        milestone.status = MilestoneStatus.Submitted;

        emit MilestoneSubmitted(
            agreementId,
            milestoneId,
            msg.sender,
            evidenceURI,
            evidenceHash
        );
    }

    /* =========================================================
                        CLIENT APPROVAL
       ========================================================= */

    function approveMilestone(
        uint256 agreementId,
        uint256 milestoneId
    ) external nonReentrant {
        Agreement storage agreement = _getAgreement(agreementId);

        if (msg.sender != agreement.client) {
            revert UnauthorizedClient(msg.sender);
        }

        if (agreement.status != AgreementStatus.Active) {
            revert InvalidAgreementStatus(agreementId, agreement.status);
        }

        Milestone storage milestone = _getMilestone(agreementId, milestoneId);

        if (milestone.status != MilestoneStatus.Submitted) {
            revert InvalidMilestoneStatus(
                agreementId,
                milestoneId,
                milestone.status
            );
        }

        emit MilestoneApproved(agreementId, milestoneId, msg.sender);

        _settleMilestone(
            agreementId,
            agreement,
            milestoneId,
            milestone,
            agreement.contractor,
            MilestoneStatus.Released
        );
    }

    /* =========================================================
                             DISPUTES
       ========================================================= */

    function openMilestoneDispute(
        uint256 agreementId,
        uint256 milestoneId
    ) external nonReentrant {
        Agreement storage agreement = _getAgreement(agreementId);

        if (agreement.status != AgreementStatus.Active) {
            revert InvalidAgreementStatus(agreementId, agreement.status);
        }

        if (
            msg.sender != agreement.client && msg.sender != agreement.contractor
        ) {
            revert UnauthorizedParty(msg.sender);
        }

        Milestone storage milestone = _getMilestone(agreementId, milestoneId);

        if (milestone.status != MilestoneStatus.Submitted) {
            revert InvalidMilestoneStatus(
                agreementId,
                milestoneId,
                milestone.status
            );
        }

        milestone.status = MilestoneStatus.Disputed;

        emit MilestoneDisputeOpened(agreementId, milestoneId, msg.sender);
    }

    /* =========================================================
                       DISPUTE RESOLUTION
       ========================================================= */

    function resolveMilestoneDispute(
        uint256 agreementId,
        uint256 milestoneId,
        bool releaseToContractor
    ) external nonReentrant onlyArbitrator {
        Agreement storage agreement = _getAgreement(agreementId);

        if (agreement.status != AgreementStatus.Active) {
            revert InvalidAgreementStatus(agreementId, agreement.status);
        }

        Milestone storage milestone = _getMilestone(agreementId, milestoneId);

        if (milestone.status != MilestoneStatus.Disputed) {
            revert InvalidMilestoneStatus(
                agreementId,
                milestoneId,
                milestone.status
            );
        }

        address recipient;

        MilestoneStatus finalStatus;

        if (releaseToContractor) {
            recipient = agreement.contractor;

            finalStatus = MilestoneStatus.Released;
        } else {
            recipient = agreement.client;

            finalStatus = MilestoneStatus.Refunded;
        }

        uint256 amount = milestone.amount;

        _settleMilestone(
            agreementId,
            agreement,
            milestoneId,
            milestone,
            recipient,
            finalStatus
        );

        emit MilestoneDisputeResolved(
            agreementId,
            milestoneId,
            msg.sender,
            recipient,
            releaseToContractor,
            agreement.token,
            amount
        );
    }

    /* =========================================================
                         TOKEN MANAGEMENT
       ========================================================= */

    function setTokenApproval(address token, bool approved) external onlyOwner {
        if (token == address(0)) {
            revert InvalidToken(token);
        }

        if (approved && token.code.length == 0) {
            revert InvalidToken(token);
        }

        approvedToken[token] = approved;

        emit TokenApprovalUpdated(token, approved);
    }

    /* =========================================================
                            PAUSING
       ========================================================= */

    /**
     * @notice Stops creation and funding of new agreement escrows.
     *
     * Existing submissions, releases, refunds and dispute
     * resolution remain available.
     */
    function pauseNewAgreements() external onlyOwner {
        _pause();
    }

    function unpauseNewAgreements() external onlyOwner {
        _unpause();
    }

    /* =========================================================
                      ARBITRATOR MANAGEMENT
       ========================================================= */

    function proposeArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) {
            revert InvalidAddress(newArbitrator);
        }

        pendingArbitrator = newArbitrator;

        emit ArbitratorTransferStarted(arbitrator, newArbitrator);
    }

    function cancelArbitratorTransfer() external onlyOwner {
        address cancelled = pendingArbitrator;

        pendingArbitrator = address(0);

        emit ArbitratorTransferCancelled(cancelled);
    }

    function acceptArbitratorRole() external {
        address pending = pendingArbitrator;

        if (pending == address(0)) {
            revert NoPendingArbitrator();
        }

        if (msg.sender != pending) {
            revert UnauthorizedPendingArbitrator(msg.sender);
        }

        address previous = arbitrator;

        arbitrator = pending;

        pendingArbitrator = address(0);

        emit ArbitratorTransferred(previous, arbitrator);
    }

    /* =========================================================
                            SOLVENCY
       ========================================================= */

    function isSolvent(address token) external view returns (bool) {
        if (token == address(0)) {
            return address(this).balance >= totalEscrowedETH;
        }

        return
            IERC20(token).balanceOf(address(this)) >= totalEscrowedToken[token];
    }

    /* =========================================================
                         OWNERSHIP SAFETY
       ========================================================= */

    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    /* =========================================================
                        INTERNAL - GETTERS
       ========================================================= */

    function _getAgreement(
        uint256 agreementId
    ) internal view returns (Agreement storage agreement) {
        agreement = agreementById[agreementId];

        if (!agreement.exists) {
            revert AgreementDoesNotExist(agreementId);
        }
    }

    function _getMilestone(
        uint256 agreementId,
        uint256 milestoneId
    ) internal view returns (Milestone storage milestone) {
        milestone = milestoneById[agreementId][milestoneId];

        if (!milestone.exists) {
            revert MilestoneDoesNotExist(agreementId, milestoneId);
        }
    }

    /* =========================================================
                     INTERNAL - VALIDATION
       ========================================================= */

    function _validateContractor(address contractor) internal view {
        if (contractor == address(0) || contractor == address(this)) {
            revert InvalidContractor(contractor);
        }

        if (contractor == msg.sender) {
            revert ClientAndContractorMustDiffer();
        }
    }

    function _validateAgreementToken(address token) internal view {
        if (token == address(0)) {
            return;
        }

        _validateApprovedToken(token);
    }

    function _validateApprovedToken(address token) internal view {
        if (token == address(0) || token.code.length == 0) {
            revert InvalidToken(token);
        }

        if (!approvedToken[token]) {
            revert TokenNotApproved(token);
        }
    }

    function _validateFundingAccess(
        uint256 agreementId,
        Agreement storage agreement
    ) internal view {
        if (msg.sender != agreement.client) {
            revert UnauthorizedClient(msg.sender);
        }

        if (agreement.status != AgreementStatus.Accepted) {
            revert InvalidAgreementStatus(agreementId, agreement.status);
        }

        if (agreement.totalAmount == 0) {
            revert InvalidAmount();
        }
    }

    /* =========================================================
                    INTERNAL - SETTLEMENT
       ========================================================= */

    function _settleMilestone(
        uint256 agreementId,
        Agreement storage agreement,
        uint256 milestoneId,
        Milestone storage milestone,
        address recipient,
        MilestoneStatus finalStatus
    ) internal {
        uint256 amount = milestone.amount;

        uint256 available = agreement.remainingEscrow;

        if (available < amount) {
            revert InsufficientAgreementEscrow(agreementId, available, amount);
        }

        /*
         * Checks-effects-interactions:
         * update milestone and accounting before payout.
         *
         * If payout fails the entire transaction reverts.
         */

        milestone.status = finalStatus;

        agreement.remainingEscrow = available - amount;

        _decreaseLiability(agreement.token, amount);

        _payout(agreement.token, recipient, amount);

        if (finalStatus == MilestoneStatus.Released) {
            emit MilestoneReleased(
                agreementId,
                milestoneId,
                agreement.contractor,
                agreement.token,
                amount
            );
        } else {
            emit MilestoneRefunded(
                agreementId,
                milestoneId,
                agreement.client,
                agreement.token,
                amount
            );
        }

        if (agreement.remainingEscrow == 0) {
            agreement.status = AgreementStatus.Completed;

            emit AgreementCompleted(agreementId);
        }
    }

    /* =========================================================
                     INTERNAL - TOKEN TRANSFERS
       ========================================================= */

    function _pullExactToken(
        address token,
        address from,
        address receiver,
        uint256 amount
    ) internal {
        IERC20 erc20 = IERC20(token);

        uint256 balanceBefore = erc20.balanceOf(receiver);

        erc20.safeTransferFrom(from, receiver, amount);

        uint256 balanceAfter = erc20.balanceOf(receiver);

        uint256 received = balanceAfter >= balanceBefore
            ? balanceAfter - balanceBefore
            : 0;

        if (received != amount) {
            revert UnsupportedTokenBehavior(token, amount, received);
        }
    }

    function _sendExactToken(
        address token,
        address receiver,
        uint256 amount
    ) internal {
        IERC20 erc20 = IERC20(token);

        uint256 balanceBefore = erc20.balanceOf(receiver);

        erc20.safeTransfer(receiver, amount);

        uint256 balanceAfter = erc20.balanceOf(receiver);

        uint256 received = balanceAfter >= balanceBefore
            ? balanceAfter - balanceBefore
            : 0;

        if (received != amount) {
            revert UnsupportedTokenBehavior(token, amount, received);
        }
    }

    /* =========================================================
                       INTERNAL - LIABILITY
       ========================================================= */

    function _decreaseLiability(address token, uint256 amount) internal {
        if (token == address(0)) {
            uint256 available = totalEscrowedETH;

            if (available < amount) {
                revert InsufficientEscrowLiability(token, available, amount);
            }

            totalEscrowedETH = available - amount;

            return;
        }

        uint256 available = totalEscrowedToken[token];

        if (available < amount) {
            revert InsufficientEscrowLiability(token, available, amount);
        }

        totalEscrowedToken[token] = available - amount;
    }

    /* =========================================================
                         INTERNAL - PAYOUT
       ========================================================= */

    function _payout(address token, address receiver, uint256 amount) internal {
        if (token == address(0)) {
            _sendETH(receiver, amount);

            return;
        }

        _sendExactToken(token, receiver, amount);
    }

    function _sendETH(address receiver, uint256 amount) internal {
        (bool success, ) = payable(receiver).call{value: amount}("");

        if (!success) {
            revert EtherTransferFailed(receiver, amount);
        }
    }
}
