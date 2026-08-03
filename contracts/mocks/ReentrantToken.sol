// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IMultiPaymentToken {
    function createERC20EscrowPayment(address seller, address token, uint256 amount) external;
}

contract ReentrantToken is ERC20 {
    address public target;
    address public nestedSeller;
    bool public armed;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor() ERC20("Reentrant Token", "RNT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, address nestedSeller_) external {
        target = target_;
        nestedSeller = nestedSeller_;
        armed = true;
        _mint(address(this), 1 ether);
        _approve(address(this), target_, type(uint256).max);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false;
            reentryAttempted = true;
            (bool ok, ) = target.call(
                abi.encodeCall(
                    IMultiPaymentToken.createERC20EscrowPayment,
                    (nestedSeller, address(this), 1)
                )
            );
            reentrySucceeded = ok;
        }
        return super.transferFrom(from, to, value);
    }
}
