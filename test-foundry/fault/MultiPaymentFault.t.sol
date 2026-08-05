// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import {Test} from "forge-std/Test.sol";

import {MultiPayment} from "../../contracts/multiPayment.sol";
import {FeeOnTransferToken} from "../../contracts/mocks/FeeOnTransferToken.sol";
import {OutboundFeeToken} from "../../contracts/mocks/OutboundFeeToken.sol";
import {RejectingReceiver} from "../../contracts/mocks/RejectingReceiver.sol";

contract MultiPaymentFaultTest is Test {
    MultiPayment internal multiPayment;

    address internal constant BUYER = address(0xB0B);
    address internal constant SELLER = address(0x5E11E2);
    address internal constant ARBITRATOR = address(0xA11CE);

    function setUp() public {
        multiPayment = new MultiPayment(address(this), ARBITRATOR);

        vm.deal(BUYER, 100 ether);
    }

    function testFeeOnTransferDepositRevertsAndRollsBack() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken(100);

        uint256 amount = 100 ether;
        uint256 received = 99 ether;

        multiPayment.setTokenApproval(address(feeToken), true);

        feeToken.mint(BUYER, amount);

        vm.prank(BUYER);
        feeToken.approve(address(multiPayment), amount);

        vm.prank(BUYER);

        vm.expectRevert(
            abi.encodeWithSelector(
                MultiPayment.UnsupportedTokenBehavior.selector,
                address(feeToken),
                amount,
                received
            )
        );

        multiPayment.createERC20EscrowPayment(
            SELLER,
            address(feeToken),
            amount
        );

        assertEq(multiPayment.totalEscrowedToken(address(feeToken)), 0);

        assertEq(feeToken.balanceOf(address(multiPayment)), 0);

        assertEq(feeToken.balanceOf(BUYER), amount);

        assertEq(multiPayment.nextOrderId(), 1);
    }

    function testOutboundFeePayoutRevertsAndPreservesEscrow() public {
        OutboundFeeToken outboundToken = new OutboundFeeToken(100);

        uint256 amount = 100 ether;
        uint256 received = 99 ether;

        multiPayment.setTokenApproval(address(outboundToken), true);

        outboundToken.mint(BUYER, amount);

        vm.prank(BUYER);
        outboundToken.approve(address(multiPayment), amount);

        vm.prank(BUYER);
        multiPayment.createERC20EscrowPayment(
            SELLER,
            address(outboundToken),
            amount
        );

        // Turn on the fee only for transfers sent
        // from the MultiPayment contract.
        outboundToken.setFeeSender(address(multiPayment));

        vm.prank(BUYER);

        vm.expectRevert(
            abi.encodeWithSelector(
                MultiPayment.UnsupportedTokenBehavior.selector,
                address(outboundToken),
                amount,
                received
            )
        );

        multiPayment.confirmReceipt(1);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            MultiPayment.OrderStatus status,
            bool exists
        ) = multiPayment.orderById(1);

        assertTrue(exists);

        assertEq(uint256(status), uint256(MultiPayment.OrderStatus.InEscrow));

        assertEq(
            multiPayment.totalEscrowedToken(address(outboundToken)),
            amount
        );

        assertEq(outboundToken.balanceOf(address(multiPayment)), amount);

        assertEq(outboundToken.balanceOf(SELLER), 0);
    }

    function testRejectingSellerPreservesEthEscrow() public {
        RejectingReceiver rejectingSeller = new RejectingReceiver();

        uint256 amount = 1 ether;

        vm.prank(BUYER);
        multiPayment.createEscrowPayment{value: amount}(
            address(rejectingSeller)
        );

        vm.prank(BUYER);

        vm.expectRevert(
            abi.encodeWithSelector(
                MultiPayment.EtherTransferFailed.selector,
                address(rejectingSeller),
                amount
            )
        );

        multiPayment.confirmReceipt(1);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            MultiPayment.OrderStatus status,
            bool exists
        ) = multiPayment.orderById(1);

        assertTrue(exists);

        assertEq(uint256(status), uint256(MultiPayment.OrderStatus.InEscrow));

        assertEq(multiPayment.totalEscrowedETH(), amount);

        assertEq(address(multiPayment).balance, amount);
    }

    function testRejectingSellerCanRefundBuyer() public {
        RejectingReceiver rejectingSeller = new RejectingReceiver();

        uint256 amount = 1 ether;
        uint256 buyerBalanceBefore = BUYER.balance;

        vm.prank(BUYER);
        multiPayment.createEscrowPayment{value: amount}(
            address(rejectingSeller)
        );

        assertEq(BUYER.balance, buyerBalanceBefore - amount);

        rejectingSeller.refundOrder(address(multiPayment), 1);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            MultiPayment.OrderStatus status,
            bool exists
        ) = multiPayment.orderById(1);

        assertTrue(exists);

        assertEq(uint256(status), uint256(MultiPayment.OrderStatus.Refunded));

        assertEq(multiPayment.totalEscrowedETH(), 0);

        assertEq(address(multiPayment).balance, 0);

        assertEq(BUYER.balance, buyerBalanceBefore);
    }

    function testRejectingDirectPaymentRollsBackOrder() public {
        RejectingReceiver rejectingSeller = new RejectingReceiver();

        uint256 amount = 1 ether;

        vm.prank(BUYER);

        vm.expectRevert(
            abi.encodeWithSelector(
                MultiPayment.EtherTransferFailed.selector,
                address(rejectingSeller),
                amount
            )
        );

        multiPayment.createDirectPayment{value: amount}(
            address(rejectingSeller)
        );

        assertEq(multiPayment.nextOrderId(), 1);

        assertEq(address(multiPayment).balance, 0);

        (, , , , , , , bool exists) = multiPayment.orderById(1);

        assertFalse(exists);
    }
}
