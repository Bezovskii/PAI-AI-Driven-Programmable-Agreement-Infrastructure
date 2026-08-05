// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import {Test} from "forge-std/Test.sol";

import {MultiPayment} from "../../contracts/multiPayment.sol";
import {MockERC20} from "../../contracts/MockERC20.sol";

contract MultiPaymentBoundaryTest is Test {
    MultiPayment internal multiPayment;
    MockERC20 internal token;

    address internal constant BUYER = address(0xB0B);
    address internal constant SELLER = address(0x5E11E2);
    address internal constant ARBITRATOR = address(0xA11CE);
    address internal constant OUTSIDER = address(0xBAD);

    function setUp() public {
        multiPayment = new MultiPayment(address(this), ARBITRATOR);

        token = new MockERC20();

        multiPayment.setTokenApproval(address(token), true);

        vm.deal(BUYER, 100 ether);

        token.mint(BUYER, 1_000_000e6);

        vm.prank(BUYER);
        token.approve(address(multiPayment), type(uint256).max);
    }

    function testZeroEthEscrowReverts() public {
        vm.prank(BUYER);

        vm.expectRevert(MultiPayment.InvalidAmount.selector);

        multiPayment.createEscrowPayment{value: 0}(SELLER);
    }

    function testOneWeiEthEscrowSucceeds() public {
        vm.prank(BUYER);

        multiPayment.createEscrowPayment{value: 1 wei}(SELLER);

        assertEq(multiPayment.totalEscrowedETH(), 1 wei);

        assertEq(address(multiPayment).balance, 1 wei);

        assertEq(multiPayment.nextOrderId(), 2);
    }

    function testZeroSellerReverts() public {
        vm.prank(BUYER);

        vm.expectRevert(
            abi.encodeWithSelector(
                MultiPayment.InvalidSeller.selector,
                address(0)
            )
        );

        multiPayment.createEscrowPayment{value: 1 ether}(address(0));
    }

    function testBuyerCannotBeSeller() public {
        vm.prank(BUYER);

        vm.expectRevert(MultiPayment.BuyerAndSellerMustDiffer.selector);

        multiPayment.createEscrowPayment{value: 1 ether}(BUYER);
    }

    function testZeroTokenAmountReverts() public {
        vm.prank(BUYER);

        vm.expectRevert(MultiPayment.InvalidAmount.selector);

        multiPayment.createERC20EscrowPayment(SELLER, address(token), 0);
    }

    function testOneTokenUnitSucceeds() public {
        vm.prank(BUYER);

        multiPayment.createERC20EscrowPayment(SELLER, address(token), 1);

        assertEq(multiPayment.totalEscrowedToken(address(token)), 1);

        assertEq(token.balanceOf(address(multiPayment)), 1);
    }

    function testExactTokenAllowanceSucceeds() public {
        uint256 amount = 500e6;

        vm.prank(BUYER);
        token.approve(address(multiPayment), amount);

        vm.prank(BUYER);
        multiPayment.createERC20EscrowPayment(SELLER, address(token), amount);

        assertEq(multiPayment.totalEscrowedToken(address(token)), amount);

        assertEq(token.allowance(BUYER, address(multiPayment)), 0);
    }

    function testInsufficientTokenAllowanceReverts() public {
        uint256 amount = 500e6;

        vm.prank(BUYER);
        token.approve(address(multiPayment), amount - 1);

        vm.prank(BUYER);
        vm.expectRevert();

        multiPayment.createERC20EscrowPayment(SELLER, address(token), amount);

        assertEq(multiPayment.totalEscrowedToken(address(token)), 0);

        assertEq(multiPayment.nextOrderId(), 1);
    }

    function testNonexistentOrderReverts() public {
        vm.prank(BUYER);

        vm.expectRevert(
            abi.encodeWithSelector(MultiPayment.OrderDoesNotExist.selector, 999)
        );

        multiPayment.confirmReceipt(999);
    }

    function testUnauthorizedBuyerCannotConfirm() public {
        vm.prank(BUYER);

        multiPayment.createEscrowPayment{value: 1 ether}(SELLER);

        vm.prank(OUTSIDER);

        vm.expectRevert(
            abi.encodeWithSelector(
                MultiPayment.UnauthorizedBuyer.selector,
                OUTSIDER
            )
        );

        multiPayment.confirmReceipt(1);

        assertEq(multiPayment.totalEscrowedETH(), 1 ether);
    }

    function testCannotConfirmTwice() public {
        vm.prank(BUYER);

        multiPayment.createEscrowPayment{value: 1 ether}(SELLER);

        vm.prank(BUYER);
        multiPayment.confirmReceipt(1);

        assertEq(multiPayment.totalEscrowedETH(), 0);

        vm.prank(BUYER);

        vm.expectRevert(
            abi.encodeWithSelector(
                MultiPayment.InvalidOrderStatus.selector,
                1,
                MultiPayment.OrderStatus.Completed
            )
        );

        multiPayment.confirmReceipt(1);
    }

    function testPauseBlocksNewEscrowButAllowsRefund() public {
        vm.prank(BUYER);

        multiPayment.createEscrowPayment{value: 1 ether}(SELLER);

        multiPayment.pauseNewPayments();

        assertTrue(multiPayment.paused());

        vm.prank(BUYER);
        vm.expectRevert();

        multiPayment.createEscrowPayment{value: 1 ether}(SELLER);

        // Existing escrow exits remain available while paused.
        vm.prank(SELLER);
        multiPayment.refund(1);

        assertEq(multiPayment.totalEscrowedETH(), 0);

        assertEq(address(multiPayment).balance, 0);
    }
}
