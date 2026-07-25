// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMultiPaymentETH {
    function createDirectPayment(address seller) external payable;
    function refund(uint256 orderId) external;
}

contract ReentrantSeller {
    IMultiPaymentETH public immutable target;
    address public immutable sink;
    bool public armed;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address targetAddress, address sinkAddress) {
        target = IMultiPaymentETH(targetAddress);
        sink = sinkAddress;
    }

    function setArmed(bool value) external {
        armed = value;
    }

    function refundOrder(uint256 orderId) external {
        target.refund(orderId);
    }

    receive() external payable {
        if (!armed) return;
        armed = false;
        reentryAttempted = true;
        (bool ok, ) = address(target).call{value: msg.value}(
            abi.encodeCall(IMultiPaymentETH.createDirectPayment, (sink))
        );
        reentrySucceeded = ok;
    }
}
