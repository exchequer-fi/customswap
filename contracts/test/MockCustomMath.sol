// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../CustomMath.sol";

contract MockCustomMath {

    function invariant(uint256 amp1, uint256 amp2, uint256[] memory balances, uint256 curve) external pure returns (uint256) {
        return CustomMath.calculateInvariant(amp1, amp2, balances, curve);
    }

    function outGivenIn(
        uint256 amp1,
        uint256 amp2,
        uint256[] memory balances,
        uint256 tokenIndexIn,
        uint256 tokenIndexOut,
        uint256 tokenAmountIn
    ) external pure returns (uint256) {
        (,uint256 v) = CustomMath.calcOutGivenIn(
            amp1,
            amp2,
            balances,
            tokenIndexIn,
            tokenIndexOut,
            tokenAmountIn
        );
        return v;
    }

    function inGivenOut(
        uint256 amp1,
        uint256 amp2,
        uint256[] memory balances,
        uint256 tokenIndexIn,
        uint256 tokenIndexOut,
        uint256 tokenAmountOut
    ) external pure returns (uint256) {
        (,uint256 v) =
        CustomMath.calcInGivenOut(
            amp1,
            amp2,
            balances,
            tokenIndexIn,
            tokenIndexOut,
            tokenAmountOut
        );
        return v;
    }

    function exactTokensInForBPTOut(
        uint256 amp1,
        uint256 D1,
        uint256 amp2,
        uint256 D2,
        uint256[] memory balances,
        uint256[] memory amountsIn,
        uint256 bptTotalSupply,
        uint256 swapFee
    ) external pure returns (uint256) {
        return CustomMath.calcBptOutGivenExactTokensIn(
            CustomMath.Curve(amp1, D1, amp2, D2),
            balances,
            amountsIn,
            bptTotalSupply,
            swapFee
        );
    }

    function tokenInForExactBPTOut(
        uint256 amp1,
        uint256 D1,
        uint256 amp2,
        uint256 D2,
        uint256[] memory balances,
        uint256 tokenIndex,
        uint256 bptAmountOut,
        uint256 bptTotalSupply,
        uint256 swapFee
    ) external pure returns (uint256) {
        return CustomMath.calcTokenInGivenExactBptOut(
            CustomMath.Curve(amp1, D1, amp2, D2),
            balances,
            tokenIndex,
            bptAmountOut,
            bptTotalSupply,
            swapFee
        );
    }

    function exactBPTInForTokenOut(
        uint256 amp1,
        uint256 D1,
        uint256 amp2,
        uint256 D2,
        uint256[] memory balances,
        uint256 tokenIndex,
        uint256 bptAmountIn,
        uint256 bptTotalSupply,
        uint256 swapFee
    ) external pure returns (uint256) {
        return
        CustomMath.calcTokenOutGivenExactBptIn(
            CustomMath.Curve(amp1, D1, amp2, D2),
            balances,
            tokenIndex,
            bptAmountIn,
            bptTotalSupply,
            swapFee
        );
    }

    function bptInForExactTokensOut(
        uint256 amp1,
        uint256 D1,
        uint256 amp2,
        uint256 D2,
        uint256[] memory balances,
        uint256[] memory amountsOut,
        uint256 bptTotalSupply,
        uint256 swapFee
    ) external pure returns (uint256) {
        return CustomMath.calcBptInGivenExactTokensOut(
            CustomMath.Curve(amp1, D1, amp2, D2),
            balances,
            amountsOut,
            bptTotalSupply,
            swapFee
        );
    }

    function getTokenBalanceGivenInvariantAndAllOtherBalances(
        uint256 amplificationParameter1,
        uint256[] memory balances,
        uint256 currentInvariant,
        uint256 tokenIndex
    ) external pure returns (uint256) {
        return StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(
            amplificationParameter1,
            balances,
            currentInvariant,
            tokenIndex
        );
    }

    function getRate(
        uint256[] memory balances,
        uint256 amp1,
        uint256 amp2,
        uint256 supply
    ) external pure returns (uint256) {
        return CustomMath.getRate(balances, amp1, amp2, supply);
    }
}
