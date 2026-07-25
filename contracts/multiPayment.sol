// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
contract MultiPayment is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    enum PaymentType {
        Direct,
        Escrow
    }

    enum OrderStatus {
        InEscrow,
        Disputed,
        Completed,
        Refunded
    }

    struct Order {
        uint256 id;
        address buyer;
        address seller;
        address token;
        uint256 amount;
        PaymentType paymentType;
        OrderStatus status;
        bool exists;
    }

    error InvalidAddress(address account);
    error InvalidSeller(address seller);
    error BuyerAndSellerMustDiffer();
    error InvalidToken(address token);
    error InvalidAmount();

    error OrderDoesNotExist(uint256 orderId);

    error InvalidPaymentType(uint256 orderId, PaymentType currentType);

    error InvalidOrderStatus(uint256 orderId, OrderStatus currentStatus);

    error UnauthorizedBuyer(address caller);
    error UnauthorizedSeller(address caller);
    error UnauthorizedParty(address caller);
    error UnauthorizedArbitrator(address caller);

    error EtherTransferFailed(address receiver, uint256 amount);

    error TokenNotApproved(address token);

    error UnsupportedTokenBehavior(
        address token,
        uint256 expected,
        uint256 received
    );

    error NoPendingArbitrator();

    error UnauthorizedPendingArbitrator(address caller);

    error InsufficientEscrowLiability(
        address token,
        uint256 available,
        uint256 required
    );

    error DirectEtherNotAccepted();
    error OwnershipRenunciationDisabled();

    uint256 public nextOrderId = 1;

    address public arbitrator;
    address public pendingArbitrator;

    uint256 public totalEscrowedETH;

    mapping(address token => uint256 amount) public totalEscrowedToken;

    mapping(address token => bool approved) public approvedToken;

    mapping(uint256 orderId => Order order) public orderById;

    event DirectPaymentCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount
    );

    event EscrowPaymentCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount
    );

    event PaymentReceivedConfirmed(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount
    );

    event EscrowPaymentRefunded(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount
    );

    event DisputeOpened(uint256 indexed id, address indexed openedBy);

    event DisputeResolved(
        uint256 indexed id,
        address indexed arbitrator,
        address indexed recipient,
        bool releasedToSeller,
        address token,
        uint256 amount
    );

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

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) {
            revert UnauthorizedArbitrator(msg.sender);
        }

        _;
    }

    /**
     * @param initialOwner Address controlling token approval and emergency pause.
     * @param initialArbitrator Address authorized to resolve disputes.
     */
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

    /**
     * @dev ETH must enter through one of the explicit payment functions.
     */
    receive() external payable {
        revert DirectEtherNotAccepted();
    }

    fallback() external payable {
        revert DirectEtherNotAccepted();
    }

    /**
     * @notice Sends ETH directly to a seller.
     */
    function createDirectPayment(
        address seller
    ) external payable nonReentrant whenNotPaused {
        _validateSeller(seller);

        if (msg.value == 0) {
            revert InvalidAmount();
        }

        uint256 orderId = nextOrderId++;

        orderById[orderId] = Order({
            id: orderId,
            buyer: msg.sender,
            seller: seller,
            token: address(0),
            amount: msg.value,
            paymentType: PaymentType.Direct,
            status: OrderStatus.Completed,
            exists: true
        });

        _sendETH(seller, msg.value);

        emit DirectPaymentCreated(
            orderId,
            msg.sender,
            seller,
            address(0),
            msg.value
        );
    }

    /**
     * @notice Creates an ETH escrow order.
     */
    function createEscrowPayment(
        address seller
    ) external payable nonReentrant whenNotPaused {
        _validateSeller(seller);

        if (msg.value == 0) {
            revert InvalidAmount();
        }

        uint256 orderId = nextOrderId++;

        orderById[orderId] = Order({
            id: orderId,
            buyer: msg.sender,
            seller: seller,
            token: address(0),
            amount: msg.value,
            paymentType: PaymentType.Escrow,
            status: OrderStatus.InEscrow,
            exists: true
        });

        totalEscrowedETH += msg.value;

        emit EscrowPaymentCreated(
            orderId,
            msg.sender,
            seller,
            address(0),
            msg.value
        );
    }

    /**
     * @notice Sends an approved ERC20 token directly to a seller.
     */
    function createERC20DirectPayment(
        address seller,
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        _validateSeller(seller);
        _validateApprovedToken(token);

        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 orderId = nextOrderId++;

        orderById[orderId] = Order({
            id: orderId,
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            paymentType: PaymentType.Direct,
            status: OrderStatus.Completed,
            exists: true
        });

        _pullExactToken(token, msg.sender, seller, amount);

        emit DirectPaymentCreated(orderId, msg.sender, seller, token, amount);
    }

    /**
     * @notice Creates an escrow using an approved ERC20 token.
     */
    function createERC20EscrowPayment(
        address seller,
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        _validateSeller(seller);
        _validateApprovedToken(token);

        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 orderId = nextOrderId++;

        orderById[orderId] = Order({
            id: orderId,
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            paymentType: PaymentType.Escrow,
            status: OrderStatus.InEscrow,
            exists: true
        });

        totalEscrowedToken[token] += amount;

        _pullExactToken(token, msg.sender, address(this), amount);

        emit EscrowPaymentCreated(orderId, msg.sender, seller, token, amount);
    }

    /**
     * @notice Buyer confirms receipt and releases escrow to the seller.
     */
    function confirmReceipt(uint256 orderId) external nonReentrant {
        Order storage currentOrder = _getEscrowOrder(orderId);

        if (currentOrder.status != OrderStatus.InEscrow) {
            revert InvalidOrderStatus(orderId, currentOrder.status);
        }

        if (msg.sender != currentOrder.buyer) {
            revert UnauthorizedBuyer(msg.sender);
        }

        currentOrder.status = OrderStatus.Completed;

        _decreaseLiability(currentOrder.token, currentOrder.amount);

        _payout(currentOrder.token, currentOrder.seller, currentOrder.amount);

        emit PaymentReceivedConfirmed(
            orderId,
            currentOrder.buyer,
            currentOrder.seller,
            currentOrder.token,
            currentOrder.amount
        );
    }

    /**
     * @notice Seller voluntarily refunds an escrow to the buyer.
     */
    function refund(uint256 orderId) external nonReentrant {
        Order storage currentOrder = _getEscrowOrder(orderId);

        if (currentOrder.status != OrderStatus.InEscrow) {
            revert InvalidOrderStatus(orderId, currentOrder.status);
        }

        if (msg.sender != currentOrder.seller) {
            revert UnauthorizedSeller(msg.sender);
        }

        currentOrder.status = OrderStatus.Refunded;

        _decreaseLiability(currentOrder.token, currentOrder.amount);

        _payout(currentOrder.token, currentOrder.buyer, currentOrder.amount);

        emit EscrowPaymentRefunded(
            orderId,
            currentOrder.buyer,
            currentOrder.seller,
            currentOrder.token,
            currentOrder.amount
        );
    }

    /**
     * @notice Buyer or seller opens a dispute.
     */
    function openDispute(uint256 orderId) external nonReentrant {
        Order storage currentOrder = _getEscrowOrder(orderId);

        if (currentOrder.status != OrderStatus.InEscrow) {
            revert InvalidOrderStatus(orderId, currentOrder.status);
        }

        if (
            msg.sender != currentOrder.buyer &&
            msg.sender != currentOrder.seller
        ) {
            revert UnauthorizedParty(msg.sender);
        }

        currentOrder.status = OrderStatus.Disputed;

        emit DisputeOpened(orderId, msg.sender);
    }

    /**
     * @notice Arbitrator resolves a disputed escrow.
     * @param releaseToSeller True sends funds to seller; false refunds buyer.
     */
    function resolveDispute(
        uint256 orderId,
        bool releaseToSeller
    ) external nonReentrant onlyArbitrator {
        Order storage currentOrder = _getEscrowOrder(orderId);

        if (currentOrder.status != OrderStatus.Disputed) {
            revert InvalidOrderStatus(orderId, currentOrder.status);
        }

        address recipient;

        if (releaseToSeller) {
            currentOrder.status = OrderStatus.Completed;

            recipient = currentOrder.seller;
        } else {
            currentOrder.status = OrderStatus.Refunded;

            recipient = currentOrder.buyer;
        }

        _decreaseLiability(currentOrder.token, currentOrder.amount);

        _payout(currentOrder.token, recipient, currentOrder.amount);

        emit DisputeResolved(
            orderId,
            msg.sender,
            recipient,
            releaseToSeller,
            currentOrder.token,
            currentOrder.amount
        );
    }

    /**
     * @notice Approves or disables an ERC20 token.
     * @dev Existing escrows remain payable even if a token is later disabled.
     */
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

    /**
     * @notice Stops creation of new payments.
     * @dev Existing escrow exits and dispute resolution remain available.
     */
    function pauseNewPayments() external onlyOwner {
        _pause();
    }

    function unpauseNewPayments() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Starts a two-step arbitrator transfer.
     */
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

    /**
     * @notice Pending arbitrator accepts the role.
     */
    function acceptArbitratorRole() external {
        address pending = pendingArbitrator;

        if (pending == address(0)) {
            revert NoPendingArbitrator();
        }

        if (msg.sender != pending) {
            revert UnauthorizedPendingArbitrator(msg.sender);
        }

        address previousArbitrator = arbitrator;

        arbitrator = pending;
        pendingArbitrator = address(0);

        emit ArbitratorTransferred(previousArbitrator, arbitrator);
    }

    /**
     * @notice Checks whether the contract balance covers recorded liabilities.
     */
    function isSolvent(address token) external view returns (bool) {
        if (token == address(0)) {
            return address(this).balance >= totalEscrowedETH;
        }

        return
            IERC20(token).balanceOf(address(this)) >= totalEscrowedToken[token];
    }

    /**
     * @dev Disabled because the owner is required for emergency controls
     * and token management.
     */
    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    function _getEscrowOrder(
        uint256 orderId
    ) internal view returns (Order storage currentOrder) {
        currentOrder = orderById[orderId];

        if (!currentOrder.exists) {
            revert OrderDoesNotExist(orderId);
        }

        if (currentOrder.paymentType != PaymentType.Escrow) {
            revert InvalidPaymentType(orderId, currentOrder.paymentType);
        }
    }

    function _validateSeller(address seller) internal view {
        if (seller == address(0) || seller == address(this)) {
            revert InvalidSeller(seller);
        }

        if (seller == msg.sender) {
            revert BuyerAndSellerMustDiffer();
        }
    }

    function _validateApprovedToken(address token) internal view {
        if (token == address(0) || token.code.length == 0) {
            revert InvalidToken(token);
        }

        if (!approvedToken[token]) {
            revert TokenNotApproved(token);
        }
    }

    /**
     * @dev Pulls tokens and rejects fee-on-transfer or otherwise
     * non-exact token behavior.
     */
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

    /**
     * @dev Sends tokens and verifies the receiver obtained the exact amount.
     */
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

    function _decreaseLiability(address token, uint256 amount) internal {
        if (token == address(0)) {
            uint256 ethAvailable = totalEscrowedETH;

            if (ethAvailable < amount) {
                revert InsufficientEscrowLiability(token, ethAvailable, amount);
            }

            totalEscrowedETH = ethAvailable - amount;

            return;
        }

        uint256 tokenAvailable = totalEscrowedToken[token];

        if (tokenAvailable < amount) {
            revert InsufficientEscrowLiability(token, tokenAvailable, amount);
        }

        totalEscrowedToken[token] = tokenAvailable - amount;
    }

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
