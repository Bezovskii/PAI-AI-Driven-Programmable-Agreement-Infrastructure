// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import {Test} from "forge-std/Test.sol";

import {MultiPayment} from "../../contracts/multiPayment.sol";
import {MockERC20} from "../../contracts/MockERC20.sol";

contract MultiPaymentHandler is Test {
    MultiPayment public immutable multiPayment;
    MockERC20 public immutable token;
    address public immutable arbitrator;

    address[] private buyers;
    address[] private sellers;
    uint256[] private escrowOrderIds;

    uint256 public ghostCreatedETH;
    uint256 public ghostReleasedETH;
    uint256 public ghostRefundedETH;

    uint256 public ghostCreatedToken;
    uint256 public ghostReleasedToken;
    uint256 public ghostRefundedToken;

    constructor(
        MultiPayment _multiPayment,
        MockERC20 _token,
        address _arbitrator
    ) {
        multiPayment = _multiPayment;
        token = _token;
        arbitrator = _arbitrator;

        buyers.push(address(0x1001));
        buyers.push(address(0x1002));
        buyers.push(address(0x1003));
        buyers.push(address(0x1004));

        sellers.push(address(0x2001));
        sellers.push(address(0x2002));
        sellers.push(address(0x2003));
        sellers.push(address(0x2004));

        for (uint256 i; i < buyers.length; ++i) {
            address buyer = buyers[i];

            vm.deal(buyer, 1_000 ether);

            token.mint(buyer, 1_000_000e6);

            vm.prank(buyer);
            token.approve(address(multiPayment), type(uint256).max);
        }
    }

    function createEscrow(
        uint256 buyerSeed,
        uint256 sellerSeed,
        uint256 rawAmount
    ) external {
        address buyer = buyers[buyerSeed % buyers.length];
        address seller = sellers[sellerSeed % sellers.length];

        uint256 amount = bound(rawAmount, 1 wei, 10 ether);

        if (buyer.balance < amount) {
            vm.deal(buyer, buyer.balance + amount);
        }

        uint256 orderId = multiPayment.nextOrderId();

        vm.prank(buyer);
        multiPayment.createEscrowPayment{value: amount}(seller);

        escrowOrderIds.push(orderId);
        ghostCreatedETH += amount;
    }

    function createTokenEscrow(
        uint256 buyerSeed,
        uint256 sellerSeed,
        uint256 rawAmount
    ) external {
        address buyer = buyers[buyerSeed % buyers.length];
        address seller = sellers[sellerSeed % sellers.length];

        uint256 amount = bound(rawAmount, 1, 10_000e6);

        if (token.balanceOf(buyer) < amount) {
            token.mint(buyer, amount);
        }

        uint256 orderId = multiPayment.nextOrderId();

        vm.prank(buyer);
        multiPayment.createERC20EscrowPayment(seller, address(token), amount);

        escrowOrderIds.push(orderId);
        ghostCreatedToken += amount;
    }

    function confirmReceipt(uint256 orderSeed) external {
        if (escrowOrderIds.length == 0) {
            return;
        }

        uint256 orderId = escrowOrderIds[orderSeed % escrowOrderIds.length];

        (
            ,
            address buyer,
            ,
            address orderToken,
            uint256 amount,
            MultiPayment.PaymentType paymentType,
            MultiPayment.OrderStatus status,
            bool exists
        ) = multiPayment.orderById(orderId);

        if (
            !exists ||
            paymentType != MultiPayment.PaymentType.Escrow ||
            status != MultiPayment.OrderStatus.InEscrow
        ) {
            return;
        }

        vm.prank(buyer);
        multiPayment.confirmReceipt(orderId);

        _recordRelease(orderToken, amount);
    }

    function refund(uint256 orderSeed) external {
        if (escrowOrderIds.length == 0) {
            return;
        }

        uint256 orderId = escrowOrderIds[orderSeed % escrowOrderIds.length];

        (
            ,
            ,
            address seller,
            address orderToken,
            uint256 amount,
            MultiPayment.PaymentType paymentType,
            MultiPayment.OrderStatus status,
            bool exists
        ) = multiPayment.orderById(orderId);

        if (
            !exists ||
            paymentType != MultiPayment.PaymentType.Escrow ||
            status != MultiPayment.OrderStatus.InEscrow
        ) {
            return;
        }

        vm.prank(seller);
        multiPayment.refund(orderId);

        _recordRefund(orderToken, amount);
    }

    function openDispute(uint256 orderSeed, bool openedBySeller) external {
        if (escrowOrderIds.length == 0) {
            return;
        }

        uint256 orderId = escrowOrderIds[orderSeed % escrowOrderIds.length];

        (
            ,
            address buyer,
            address seller,
            ,
            ,
            MultiPayment.PaymentType paymentType,
            MultiPayment.OrderStatus status,
            bool exists
        ) = multiPayment.orderById(orderId);

        if (
            !exists ||
            paymentType != MultiPayment.PaymentType.Escrow ||
            status != MultiPayment.OrderStatus.InEscrow
        ) {
            return;
        }

        address caller = openedBySeller ? seller : buyer;

        vm.prank(caller);
        multiPayment.openDispute(orderId);
    }

    function resolveDispute(uint256 orderSeed, bool releaseToSeller) external {
        if (escrowOrderIds.length == 0) {
            return;
        }

        uint256 orderId = escrowOrderIds[orderSeed % escrowOrderIds.length];

        (
            ,
            ,
            ,
            address orderToken,
            uint256 amount,
            MultiPayment.PaymentType paymentType,
            MultiPayment.OrderStatus status,
            bool exists
        ) = multiPayment.orderById(orderId);

        if (
            !exists ||
            paymentType != MultiPayment.PaymentType.Escrow ||
            status != MultiPayment.OrderStatus.Disputed
        ) {
            return;
        }

        vm.prank(arbitrator);
        multiPayment.resolveDispute(orderId, releaseToSeller);

        if (releaseToSeller) {
            _recordRelease(orderToken, amount);
        } else {
            _recordRefund(orderToken, amount);
        }
    }

    function _recordRelease(address orderToken, uint256 amount) internal {
        if (orderToken == address(0)) {
            ghostReleasedETH += amount;
        } else {
            ghostReleasedToken += amount;
        }
    }

    function _recordRefund(address orderToken, uint256 amount) internal {
        if (orderToken == address(0)) {
            ghostRefundedETH += amount;
        } else {
            ghostRefundedToken += amount;
        }
    }

    function escrowOrderCount() external view returns (uint256) {
        return escrowOrderIds.length;
    }

    function escrowOrderIdAt(uint256 index) external view returns (uint256) {
        return escrowOrderIds[index];
    }

    function expectedOutstandingETH() external view returns (uint256) {
        return ghostCreatedETH - ghostReleasedETH - ghostRefundedETH;
    }

    function expectedOutstandingToken() external view returns (uint256) {
        return ghostCreatedToken - ghostReleasedToken - ghostRefundedToken;
    }
}
