// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {MultiPayment} from "../../contracts/multiPayment.sol";
import {MockERC20} from "../../contracts/MockERC20.sol";
import {MultiPaymentHandler} from "./MultiPaymentHandler.sol";

contract MultiPaymentInvariantTest is StdInvariant, Test {
    MultiPayment internal multiPayment;
    MockERC20 internal token;
    MultiPaymentHandler internal handler;

    address internal constant ARBITRATOR = address(0xA11CE);

    function setUp() public {
        multiPayment = new MultiPayment(address(this), ARBITRATOR);

        token = new MockERC20();

        multiPayment.setTokenApproval(address(token), true);

        handler = new MultiPaymentHandler(multiPayment, token, ARBITRATOR);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](6);

        selectors[0] = MultiPaymentHandler.createEscrow.selector;

        selectors[1] = MultiPaymentHandler.createTokenEscrow.selector;

        selectors[2] = MultiPaymentHandler.confirmReceipt.selector;

        selectors[3] = MultiPaymentHandler.refund.selector;

        selectors[4] = MultiPaymentHandler.openDispute.selector;

        selectors[5] = MultiPaymentHandler.resolveDispute.selector;

        targetSelector(
            FuzzSelector({addr: address(handler), selectors: selectors})
        );
    }

    function invariant_ethBalanceCoversLiability() public view {
        assertGe(
            address(multiPayment).balance,
            multiPayment.totalEscrowedETH()
        );
    }

    function invariant_tokenBalanceCoversLiability() public view {
        assertGe(
            token.balanceOf(address(multiPayment)),
            multiPayment.totalEscrowedToken(address(token))
        );
    }

    function invariant_protocolReportsETHSolvent() public view {
        assertTrue(multiPayment.isSolvent(address(0)));
    }

    function invariant_protocolReportsTokenSolvent() public view {
        assertTrue(multiPayment.isSolvent(address(token)));
    }

    function invariant_ethLiabilityMatchesGhostAccounting() public view {
        assertEq(
            multiPayment.totalEscrowedETH(),
            handler.expectedOutstandingETH()
        );
    }

    function invariant_tokenLiabilityMatchesGhostAccounting() public view {
        assertEq(
            multiPayment.totalEscrowedToken(address(token)),
            handler.expectedOutstandingToken()
        );
    }

    function invariant_ethValueIsConserved() public view {
        assertEq(
            handler.ghostCreatedETH(),
            handler.ghostReleasedETH() +
                handler.ghostRefundedETH() +
                multiPayment.totalEscrowedETH()
        );
    }

    function invariant_tokenValueIsConserved() public view {
        assertEq(
            handler.ghostCreatedToken(),
            handler.ghostReleasedToken() +
                handler.ghostRefundedToken() +
                multiPayment.totalEscrowedToken(address(token))
        );
    }

    function invariant_orderCounterMatchesCreatedEscrows() public view {
        assertEq(multiPayment.nextOrderId(), handler.escrowOrderCount() + 1);
    }

    function invariant_activeOrdersMatchLiabilities() public view {
        uint256 count = handler.escrowOrderCount();

        uint256 activeETH;
        uint256 activeToken;

        for (uint256 i; i < count; ++i) {
            uint256 orderId = handler.escrowOrderIdAt(i);

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

            bool isActive = status == MultiPayment.OrderStatus.InEscrow ||
                status == MultiPayment.OrderStatus.Disputed;

            if (
                !exists ||
                paymentType != MultiPayment.PaymentType.Escrow ||
                !isActive
            ) {
                continue;
            }

            if (orderToken == address(0)) {
                activeETH += amount;
            } else if (orderToken == address(token)) {
                activeToken += amount;
            }
        }

        assertEq(activeETH, multiPayment.totalEscrowedETH());

        assertEq(activeToken, multiPayment.totalEscrowedToken(address(token)));
    }
}
