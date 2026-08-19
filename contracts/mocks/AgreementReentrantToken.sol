// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IAgreementEscrowReentrant {
    function fundAgreementERC20(uint256 agreementId) external;
}

contract AgreementReentrantToken is ERC20 {
    address public target;

    uint256 public agreementId;

    bool public armed;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor() ERC20("Agreement Reentrant Token", "ARNT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, uint256 agreementId_) external {
        target = target_;

        agreementId = agreementId_;

        armed = true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public override returns (bool) {
        /*
         * AgreementEscrow calls transferFrom while
         * fundAgreementERC20() is executing.
         *
         * The token attempts to recursively enter the
         * same AgreementEscrow funding function.
         */

        if (armed && msg.sender == target) {
            armed = false;

            reentryAttempted = true;

            (bool success, ) = target.call(
                abi.encodeCall(
                    IAgreementEscrowReentrant.fundAgreementERC20,
                    (agreementId)
                )
            );

            reentrySucceeded = success;
        }

        return super.transferFrom(from, to, value);
    }
}
