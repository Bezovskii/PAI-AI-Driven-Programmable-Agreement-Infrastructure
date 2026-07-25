// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OutboundFeeToken is ERC20 {
    address public feeSender;
    uint256 public immutable feeBps;

    constructor(uint256 feeBps_) ERC20("Outbound Fee Token", "OFT") {
        feeBps = feeBps_;
    }

    function setFeeSender(address account) external {
        feeSender = account;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != feeSender || from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, address(0xdead), fee);
        super._update(from, to, value - fee);
    }
}
