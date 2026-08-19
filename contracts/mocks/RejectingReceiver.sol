// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

interface IMultiPaymentRefund {
    function refund(uint256 orderId) external;
}

contract RejectingReceiver {
    function refundOrder(address target, uint256 orderId) external {
        IMultiPaymentRefund(target).refund(orderId);
    }

    receive() external payable {
        revert("REJECT_ETH");
    }
}
