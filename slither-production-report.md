'npx hardhat clean' running (wd: D:\github\Multi-Payment-Dapp)
'npx hardhat clean --global' running (wd: D:\github\Multi-Payment-Dapp)
'npx hardhat compile --force' running (wd: D:\github\Multi-Payment-Dapp)
INFO:Detectors:
Detector: reentrancy-balance
Reentrancy in MultiPayment._pullExactToken(address,address,address,uint256) (contracts/multiPayment.sol#578-599):
	External call allowing reentrancy:
	- erc20.safeTransferFrom(from,receiver,amount) (contracts/multiPayment.sol#588)
	Balance read before the call:
	- balanceBefore = erc20.balanceOf(receiver) (contracts/multiPayment.sol#586)
	Possible stale balance used after the call in a condition:
	- received != amount (contracts/multiPayment.sol#596)
		- stale variable `received`
Reentrancy in MultiPayment._sendExactToken(address,address,uint256) (contracts/multiPayment.sol#604-624):
	External call allowing reentrancy:
	- erc20.safeTransfer(receiver,amount) (contracts/multiPayment.sol#613)
	Balance read before the call:
	- balanceBefore = erc20.balanceOf(receiver) (contracts/multiPayment.sol#611)
	Possible stale balance used after the call in a condition:
	- received != amount (contracts/multiPayment.sol#621)
		- stale variable `received`
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities
INFO:Detectors:
Detector: low-level-calls
Low level call in MultiPayment._sendETH(address,uint256) (contracts/multiPayment.sol#657-663):
	- (success,None) = address(receiver).call{value: amount}() (contracts/multiPayment.sol#658)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#low-level-calls
INFO:Slither:. analyzed (25 contracts with 102 detectors), 3 result(s) found
**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [reentrancy-balance](#reentrancy-balance) (2 results) (High)
 - [low-level-calls](#low-level-calls) (1 results) (Informational)
## reentrancy-balance
Impact: High
Confidence: Medium
 - [ ] ID-0
Reentrancy in [MultiPayment._pullExactToken(address,address,address,uint256)](contracts/multiPayment.sol#L578-L599):
	External call allowing reentrancy:
	- [erc20.safeTransferFrom(from,receiver,amount)](contracts/multiPayment.sol#L588)
	Balance read before the call:
	- [balanceBefore = erc20.balanceOf(receiver)](contracts/multiPayment.sol#L586)
	Possible stale balance used after the call in a condition:
	- [received != amount](contracts/multiPayment.sol#L596)
		- stale variable `received`

contracts/multiPayment.sol#L578-L599


 - [ ] ID-1
Reentrancy in [MultiPayment._sendExactToken(address,address,uint256)](contracts/multiPayment.sol#L604-L624):
	External call allowing reentrancy:
	- [erc20.safeTransfer(receiver,amount)](contracts/multiPayment.sol#L613)
	Balance read before the call:
	- [balanceBefore = erc20.balanceOf(receiver)](contracts/multiPayment.sol#L611)
	Possible stale balance used after the call in a condition:
	- [received != amount](contracts/multiPayment.sol#L621)
		- stale variable `received`

contracts/multiPayment.sol#L604-L624


## low-level-calls
Impact: Informational
Confidence: High
 - [ ] ID-2
Low level call in [MultiPayment._sendETH(address,uint256)](contracts/multiPayment.sol#L657-L663):
	- [(success,None) = address(receiver).call{value: amount}()](contracts/multiPayment.sol#L658)

contracts/multiPayment.sol#L657-L663


