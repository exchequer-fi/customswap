// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General public License for more details.

// You should have received a copy of the GNU General public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./StableMath.sol";
// import "hardhat/console.sol";

// solhint-disable private-vars-leading-underscore, var-name-mixedcase

library CustomMath {

    using FixedPoint for uint256;

    uint256 public constant _MIN_AMP = 1;
    uint256 public constant _MAX_AMP = 5000;
    uint256 public constant _AMP_PRECISION = 1e3;
    uint256 public constant _MAX_CUSTOM_TOKENS = 2;

    struct Curve {
        uint256 A1;
        uint256 D1;
        uint256 A2;
        uint256 D2;
    }

    function getRate(
        uint256[] memory B,
        uint256 A1,
        uint256 A2,
        uint256 supply
    ) public pure returns (uint256) {
        // When calculating the current BPT rate, we may not have paid the protocol fees, therefore
        // the invariant should be smaller than its current value. Then, we round down overall.
        uint256 curve = 1;
        uint256 D1 = calculateInvariant(A1, A2, B, curve);
        return D1.divDown(supply);
    }

    function getCurve(uint256[] memory B) public pure returns (uint256) {
        if (B[0] < B[1]) {
            return 1;
        } else {
            return 2;
        }
    }

    function _calcZ(uint256 A, uint256 D) private pure returns (uint256[] memory ZZ) {

        // console.log("A", A, "D", D);

        uint256 D2 = Math.mul(D, D);

        uint256 a = A * 2;

        uint256 tmp = Math.divDown(Math.mul(D, _AMP_PRECISION), Math.mul(8, a));

        uint256 b = D.sub(Math.mul(4, tmp));

        uint256 c = Math.mul(D2, tmp);

        uint256 Z = Math.divDown(b.add(Math.divDown(c, D2)), 2);

        uint256 Zp = 0;

        for (uint256 i = 0; i < 255; i++) {
            Zp = Z;

            Z = Math.divDown(b.add(Math.divDown(c, Math.mul(Z, Z))), 2);

            if (Z > Zp) {
                if (Z - Zp <= 1) {
                    ZZ = new uint256[](2);
                    ZZ[0] = Z;
                    ZZ[1] = Z;
                    // console.log("sl: z converged in i, Z", i, Z);
                    return ZZ;
                }
            } else if (Zp - Z <= 1) {
                ZZ = new uint256[](2);
                ZZ[0] = Z;
                ZZ[1] = Z;
                // console.log("sl: z converged in i, Z", i, Z);
                return ZZ;
            }
        }

        _revert(Errors.STABLE_GET_BALANCE_DIDNT_CONVERGE);

        ZZ = new uint256[](2);
        return ZZ;
    }

    // A1, A2 - amplification factors
    // B - token balances
    // Ct - target curve (1 or 2)
    function calculateInvariant(uint256 A1, uint256 A2, uint256[] memory B, uint256 Ct) public pure returns (uint256)
    {

        uint256 C = getCurve(B);

        // console.log("C=", C, "Ct=", Ct);

        if (C == Ct) {
            if (C == 1) {
                uint256 D1 = StableMath.__calculateInvariant(A1, B);
                //console.log("D1 ", D1);
                return D1;
            } else {
                uint256 D2 = StableMath.__calculateInvariant(A2, B);
                //console.log("D2 ", D2);
                return D2;
            }
        } else {
            if (C == 1) {
                uint256 D1 = StableMath.__calculateInvariant(A1, B);
                uint256[] memory Z = _calcZ(A1, D1);
                //uint256 DZ1 = StableMath.__calculateInvariant(A1, Z);
                uint256 DZ2 = StableMath.__calculateInvariant(A2, Z);
                //console.log("D1 ", D1);
                //console.log("DZ2", DZ2);
                return DZ2;
            } else {
                uint256 D2 = StableMath.__calculateInvariant(A2, B);
                uint256[] memory Z = _calcZ(A2, D2);
                //uint256 DZ2 = StableMath.__calculateInvariant(A2, Z);
                uint256 DZ1 = StableMath.__calculateInvariant(A1, Z);
                //console.log("D2 ", D2);
                //console.log("DZ1", DZ1);
                return DZ1;
            }
        }

    }

    function calculateInvariants(uint256 A1, uint256 A2, uint256[] memory B) public pure returns (uint256, uint256)
    {
        uint256 D1;
        uint256 D2;
        if (getCurve(B) == 1) {
            D1 = StableMath.__calculateInvariant(A1, B);
            D2 = StableMath.__calculateInvariant(A2, _calcZ(A1, D1));
        } else {
            D2 = StableMath.__calculateInvariant(A2, B);
            D1 = StableMath.__calculateInvariant(A1, _calcZ(A2, D2));
        }

        return (D1, D2);

    }

    // TRADE
    // Bb - balance before the trade
    function calcOutGivenIn(
        uint256 A1, uint256 A2, uint256[] memory B, uint256 tokenIndexIn, uint256 tokenIndexOut, uint256 tokenAmountIn
    ) public pure returns (uint256, uint256) {

        uint256 curveIn = getCurve(B);
        uint256 curveOut;

        // balance after the trade
        uint256 [] memory Ba = new uint256[](2);
        Ba[tokenIndexIn] = B[tokenIndexIn].add(tokenAmountIn);
        Ba[tokenIndexOut] = B[tokenIndexOut];

        //console.log("calcOutGivenIn", tokenIndexIn, tokenIndexOut, tokenAmountIn);
        //console.log("B[0] =", B[0], "B[1] =", B[1]);
        //console.log("Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
        //console.log("Cin=", curveIn);

        if (curveIn == 1) {
            uint256 D1 = StableMath.__calculateInvariant(A1, B);
            Ba[tokenIndexOut] = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(A1, Ba, D1, tokenIndexOut);
            curveOut = getCurve(Ba);
            if (curveOut == 2) {
                // we are on curve 2, so we should have used A2/D2
                uint256 [] memory Z = _calcZ(A1, D1);
                uint256 D2 = StableMath.__calculateInvariant(A2, Z);
                Ba[tokenIndexIn] = B[tokenIndexIn].add(tokenAmountIn);
                Ba[tokenIndexOut] = B[tokenIndexOut];
                //console.log("before 2 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
                Ba[tokenIndexOut] = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(A2, Ba, D2, tokenIndexOut);
                //console.log("after  2 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
            }
        } else {
            uint256 D2 = StableMath.__calculateInvariant(A2, B);
            Ba[tokenIndexOut] = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(A2, Ba, D2, tokenIndexOut);
            curveOut = getCurve(Ba);
            if (curveOut == 1) {
                // we are on curve 1, so we should have used A1/D1
                uint256 [] memory Z = _calcZ(A2, D2);
                uint256 D1 = StableMath.__calculateInvariant(A1, Z);
                Ba[tokenIndexIn] = B[tokenIndexIn].add(tokenAmountIn);
                Ba[tokenIndexOut] = B[tokenIndexOut];
                //console.log("before 1 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
                Ba[tokenIndexOut] = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(A1, Ba, D1, tokenIndexOut);
                //console.log("after 1 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
            }
        }
        //console.log("calcOutGivenIn done", B[tokenIndexOut], Ba[tokenIndexOut]);
        return (curveOut, B[tokenIndexOut].sub(Ba[tokenIndexOut]).sub(1));

    }

    function calcInGivenOut(
        uint256 A1, uint256 A2, uint256[] memory B, uint256 tokenIndexIn, uint256 tokenIndexOut, uint256 tokenAmountOut
    ) public pure returns (uint256, uint256) {

        uint256 curveIn = getCurve(B);
        uint256 curveOut;

        uint256 [] memory Ba = new uint256[](2);
        Ba[tokenIndexIn] = B[tokenIndexIn];
        Ba[tokenIndexOut] = B[tokenIndexOut].sub(tokenAmountOut);

        //console.log("calcInGivenOut", tokenIndexIn, tokenIndexOut, tokenAmountOut);
        //console.log("B[0] =", B[0], "B[1] =", B[1]);
        //console.log("Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
        //console.log("Cin=", curveIn);

        if (curveIn == 1) {
            uint256 D1 = StableMath.__calculateInvariant(A1, B);
            //console.log("D1=", D1);
            Ba[tokenIndexIn] = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(A1, Ba, D1, tokenIndexIn);
            curveOut = getCurve(Ba);
            //console.log("Cout=", curveOut, Ba[0], Ba[1]);
            if (curveOut == 2) {
                // we are on curve 2, so we should have used A2/D2
                uint256 [] memory Z = _calcZ(A1, D1);
                //console.log("Z=", Z[0], Z[1]);
                uint256 D2 = StableMath.__calculateInvariant(A2, Z);
                //console.log("D2=", D2);
                Ba[tokenIndexIn] = B[tokenIndexIn];
                Ba[tokenIndexOut] = B[tokenIndexOut].sub(tokenAmountOut);
                //console.log("before 2 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
                Ba[tokenIndexIn] = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(A2, Ba, D2, tokenIndexIn);
                //console.log("after  2 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
            }
        } else {
            uint256 D2 = StableMath.__calculateInvariant(A2, B);
            //console.log("D2=", D2);
            Ba[tokenIndexIn] = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(A2, Ba, D2, tokenIndexIn);
            curveOut = getCurve(Ba);
            //console.log("Cout=", curveOut, Ba[0], Ba[1]);
            if (curveOut == 1) {
                // we are on curve 1, so we should have used A1/D1
                uint256 [] memory Z = _calcZ(A2, D2);
                //console.log("Z=", Z[0], Z[1]);
                uint256 D1 = StableMath.__calculateInvariant(A1, Z);
                //console.log("D1=", D1);
                Ba[tokenIndexIn] = B[tokenIndexIn];
                Ba[tokenIndexOut] = B[tokenIndexOut].sub(tokenAmountOut);
                //console.log("before 1 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
                Ba[tokenIndexIn] = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(A1, Ba, D1, tokenIndexIn);
                //console.log("after 1 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
            }
        }
        //console.log("calcInGivenOut done");
        return (curveOut, Ba[tokenIndexIn].sub(B[tokenIndexIn]).add(1));

    }

    // REBALANCE - ISSUE/MINT

    // A1, A2 - amplification factors
    // Bb - balances before rebalance
    // dBb - exact token balances to add (in)
    // fee - swap fee percentage
    // Qbpt - total quantity of BPT
    function calcBptOutGivenExactTokensIn(
        Curve memory C, uint256[] memory Bb, uint256[] memory dBb, uint256 Qbpt, uint256 fee
    ) public pure returns (uint256) {

        // BPT out, so we round down overall.

        // First loop calculates the sum of all token balances, which will be used to calculate
        // the current weights of each token, relative to this sum
        uint256 sum = 0;
        for (uint256 i = 0; i < Bb.length; i++) {
            sum = sum.add(Bb[i]);
        }

        // Calculate the weighted balance ratio without considering fees
        uint256[] memory R = new uint256[](dBb.length);
        // The weighted sum of token balance ratios without considering fees
        uint256 Rw = 0;
        for (uint256 i = 0; i < Bb.length; i++) {
            // current weight
            uint256 Wc = Bb[i].divDown(sum);
            R[i] = Bb[i].add(dBb[i]).divDown(Bb[i]);
            Rw = Rw.add(R[i].mulDown(Wc));
        }

        // Second loop calculates new quantities in, taking into account the fee on the percentage excess
        // Ba - balances after rebalance
        uint256[] memory Ba = new uint256[](Bb.length);
        for (uint256 i = 0; i < Bb.length; i++) {
            // quantity to add after subtracting fees
            uint256 dBi;
            // Check if the balance ratio is greater than the ideal ratio to charge fees or not
            if (R[i] > Rw) {
                // tax-free portion
                uint256 dBf = Bb[i].mulDown(Rw.sub(FixedPoint.ONE));
                // taxable portion
                uint256 dBt = dBb[i].sub(dBf);
                // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
                dBi = dBf.add(dBt.mulDown(FixedPoint.ONE - fee));
            } else {
                dBi = dBb[i];
            }
            Ba[i] = Bb[i].add(dBi);
        }

        // which curve are we on?
        uint256 curve = getCurve(Ba);
        // what is the new invariant for the curve
        uint256 Dc = calculateInvariant(C.A1, C.A2, Ba, curve);

        // how much did the invariant grow?
        // we both invariants before this rebalance - they should correspond to Bb & A1/A2.
        uint256 Rinv;
        if (curve == 1) {
            Rinv = Dc.divDown(C.D1);
        } else {
            Rinv = Dc.divDown(C.D2);
        }
        // If the invariant didn't increase for any reason, we simply don't mint BPT
        if (Rinv > FixedPoint.ONE) {
            return Qbpt.mulDown(Rinv - FixedPoint.ONE);
        } else {
            return 0;
        }
    }

    // A1, A2, D1, D2 - current curves
    // B - token balances
    // Qbpt - total supply of BPT
    // dQbpt - exact quantity of BPT out
    // fee - swap fee percentage

    function calcTokenInGivenExactBptOut(
        Curve memory C, uint256[] memory B, uint256 tokenIndex, uint256 dQbpt, uint256 Qbpt, uint256 fee
    ) public pure returns (uint256) {
        // Token in, so we round up overall.

        uint256 R = Qbpt.add(dQbpt).divUp(Qbpt);
        // both A1/D1 and A2/D2 will give us the same side, in other words we can determine which side of x=y we are on.
        uint256 newD1 = R.mulUp(C.D1);
        // Calculate amount in without fee.
        uint256 newBalanceTokenIndex = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(C.A1, B, newD1, tokenIndex);

        uint256[] memory newB = new uint256[](2);
        newB[tokenIndex] = newBalanceTokenIndex;
        newB[1 - tokenIndex] = B[1 - tokenIndex];
        uint256 curveOut = getCurve(newB);

        if (curveOut != 1) {
            uint256 newD2 = R.mulUp(C.D2);
            newBalanceTokenIndex = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(C.A2, B, newD2, tokenIndex);
        }

        // the curve may have changed, but it's ok, all we need is the new balance.
        uint256 amountInWithoutFee = newBalanceTokenIndex.sub(B[tokenIndex]);

        // First calculate the sum of all token balances, which will be used to calculate
        // the current weight of each token
        uint256 sum = 0;
        for (uint256 i = 0; i < B.length; i++) {
            sum = sum.add(B[i]);
        }

        // We can now compute how much extra balance is being deposited and used in virtual swaps, and charge swap fees
        // accordingly.
        uint256 w = B[tokenIndex].divDown(sum);
        uint256 taxablePercentage = w.complement();
        uint256 taxableAmount = amountInWithoutFee.mulUp(taxablePercentage);
        uint256 nonTaxableAmount = amountInWithoutFee.sub(taxableAmount);

        // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
        return nonTaxableAmount.add(taxableAmount.divUp(FixedPoint.ONE - fee));
    }

    // REBALANCE - REDEEM/BURN

    // Flow of calculations:
    // amountsTokenOut -> amountsOutProportional ->
    // amountOutPercentageExcess -> amountOutBeforeFee -> newInvariant -> amountBPTIn
    // A1, A2, D1, D2 - current curves
    // B - token balances
    // dB - exact token balances to subtract (out)
    // Qbpt - total supply of BPT
    // fee - swap fee percentage

    function calcBptInGivenExactTokensOut(
        Curve memory C, uint256[] memory B, uint256[] memory dB, uint256 Qbpt, uint256 fee
    ) public pure returns (uint256) {
        // BPT in, so we round up overall.

        // First loop calculates the sum of all token balances, which will be used to calculate
        // the current weights of each token relative to this sum
        uint256 sum = 0;
        for (uint256 i = 0; i < B.length; i++) {
            sum = sum.add(B[i]);
        }

        // Calculate the weighted balance ratio without considering fees
        uint256[] memory R = new uint256[](dB.length);
        // The weighted sum of token balance ratios without considering fees
        uint256 Rw = 0;
        for (uint256 i = 0; i < B.length; i++) {
            // current weight
            uint256 Wc = B[i].divUp(sum);
            R[i] = B[i].sub(dB[i]).divUp(B[i]);
            Rw = Rw.add(R[i].mulUp(Wc));
        }

        // Second loop calculates new amounts in, taking into account the fee on the percentage excess
        // Ba - balance after the rebalance
        uint256[] memory Ba = new uint256[](B.length);
        for (uint256 i = 0; i < B.length; i++) {
            // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it to
            // 'token out'. This results in slightly larger price impact.
            // amount out with fee
            uint256 dBi;
            if (Rw > R[i]) {
                // tax-free portions
                uint256 dBf = B[i].mulDown(Rw.complement());
                // taxable portion
                uint256 dBt = dB[i].sub(dBf);
                // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
                dBi = dBf.add(dBt.divUp(FixedPoint.ONE - fee));
            } else {
                dBi = dB[i];
            }

            Ba[i] = B[i].sub(dBi);
        }

        // which curve are we on?
        uint256 curve = getCurve(Ba);
        // what is the new invariant for the curve
        uint256 Dc = calculateInvariant(C.A1, C.A2, Ba, curve);

        // how much did the invariant grow?
        // we both invariants before this rebalance - they should correspond to Bb & A1/A2.
        uint256 Rinv;
        if (curve == 1) {
            Rinv = Dc.divDown(C.D1);
        } else {
            Rinv = Dc.divDown(C.D2);
        }

        // return amountBPTIn
        return Qbpt.mulUp(Rinv.complement());

    }

    // A1, A2, D1, D2 - current curves
    // B - token balances
    // Qbpt - total supply of BPT
    // dQbpt - exact quantity of BPT in
    // fee - swap fee percentage

    function calcTokenOutGivenExactBptIn(
        Curve memory C, uint256[] memory B, uint256 tokenIndex, uint256 dQbpt, uint256 Qbpt, uint256 fee
    ) public pure returns (uint256) {
        // Token out, so we round down overall.

        // uint256 newInvariant = bptTotalSupply.sub(bptAmountIn).divUp(bptTotalSupply).mulUp(currentInvariant);

        uint256 R = Qbpt.sub(dQbpt).divUp(Qbpt);
        uint256 D1 = R.mulUp(C.D1);

        // Calculate amount out without fee
        uint256 newBalanceTokenIndex = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(C.A1, B, D1, tokenIndex);

        uint256[] memory newB = new uint256[](2);
        newB[tokenIndex] = newBalanceTokenIndex;
        newB[1 - tokenIndex] = B[1 - tokenIndex];
        uint256 curveOut = getCurve(newB);

        if (curveOut != 1) {
            uint256 D2 = R.mulUp(C.D2);
            newBalanceTokenIndex = StableMath.__getTokenBalanceGivenInvariantAndAllOtherBalances(C.A2, B, D2, tokenIndex);
        }

        uint256 amountOutWithoutFee = B[tokenIndex].sub(newBalanceTokenIndex);

        // First calculate the sum of all token balances, which will be used to calculate
        // the current weight of each token
        uint256 sum = 0;
        for (uint256 i = 0; i < B.length; i++) {
            sum = sum.add(B[i]);
        }

        // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
        // in swap fees.
        // current weight
        uint256 Wc = B[tokenIndex].divDown(sum);
        uint256 taxablePercentage = Wc.complement();

        // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
        // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
        uint256 taxableAmount = amountOutWithoutFee.mulUp(taxablePercentage);
        uint256 nonTaxableAmount = amountOutWithoutFee.sub(taxableAmount);

        // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
        return nonTaxableAmount.add(taxableAmount.mulDown(FixedPoint.ONE - fee));

    }
}
