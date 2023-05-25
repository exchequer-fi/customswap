import { Decimal } from "decimal.js";
import { BigNumber } from "ethers";

import { BigNumberish, decimal, bn, fp, fromFp, toFp } from "./numbers";

function _calcZ(
  A: BigNumberish,
  D: Decimal
): Decimal {

  let d = decimal(D);
  let D2 = d.mul(d);
  let D3 = d.mul(D2);
  let a = decimal(A).mul(2);
  let b = D.sub(D.div(a.mul(2)));
  let c = D3.div(a.mul(8));

  // We iterate to find the balance
  let Zp = decimal(0);

  let Z = b.add(c.div(D2)).div(decimal(2));

  for (let i = 0; i < 255; i++) {

    Zp = Z;

    Z = b.add(c.div(Z.mul(Z))).div(decimal(2));

    if (Z.gt(Zp)) {
      if (fp(Z).sub(fp(Zp)).lte(1)) {
        //console.log("ts: z converges in ", i, "Z=", Z);
        break;
      }
    } else if (fp(Zp).sub(fp(Z)).lte(1)) {
      //console.log("ts: z converges in ", i, "Z=", Z);
      break;
    }

  }

  return Z;
}

function _getTokenBalanceGivenInvariantAndAllOtherBalances(
  balances: Decimal[],
  amplificationParameter: Decimal | BigNumberish,
  invariant: Decimal,
  tokenIndex: number
): Decimal {
  let sum = decimal(0);
  let mul = decimal(1);
  const numTokens = balances.length;

  for (let i = 0; i < numTokens; i++) {
    if (i != tokenIndex) {
      sum = sum.add(balances[i]);
      mul = mul.mul(balances[i]);
    }
  }

  // const a = 1;
  amplificationParameter = decimal(amplificationParameter);
  const b = invariant.div(amplificationParameter.mul(numTokens)).add(sum).sub(invariant);
  const c = invariant
    .pow(numTokens + 1)
    .mul(-1)
    .div(
      amplificationParameter.mul(
        decimal(numTokens)
          .pow(numTokens + 1)
          .mul(mul)
      )
    );

  return b
    .mul(-1)
    .add(b.pow(2).sub(c.mul(4)).squareRoot())
    .div(2);
}


export function getCurve(
  fpRawBalances: Decimal[]
): number {
  if (fpRawBalances[0] < fpRawBalances[1]) {
    return 1;
  } else {
    return 2;
  }
}


export function calculateInvariant(fpRawBalances: BigNumberish[],
                                   amplificationParameter: BigNumberish): BigNumber {
  return calculateApproxInvariant(fpRawBalances, amplificationParameter);
}

export function calculateInvariants(
  fpRawBalances: BigNumberish[],
  A1: BigNumberish,
  A2: BigNumberish,
  Ct: number
): BigNumber {

  let C = getCurve(fpRawBalances.map(fromFp));
  if (C == Ct) {
    if (C == 1) {
      return calculateApproxInvariant(fpRawBalances, A1);
    } else {
      return calculateApproxInvariant(fpRawBalances, A2);
    }
  } else {
    if (C == 1) {
      let D1 = calculateApproxInvariant(fpRawBalances, A1);
      let Z = fp(_calcZ(A1, fromFp(D1)));
      //console.log("ts Z =", Z.toString());
      return calculateApproxInvariant([Z, Z], A2);
    } else {
      let D2 = calculateApproxInvariant(fpRawBalances, A2);
      let Z = fp(_calcZ(A2, fromFp(D2)));
      //console.log("ts Z =", Z.toString());
      return calculateApproxInvariant([Z, Z], A1);
    }
  }
}

// The amp factor input must be a number: *not* multiplied by the precision
export function getTokenBalanceGivenInvariantAndAllOtherBalances(
  amp: number,
  fpBalances: BigNumber[],
  fpInvariant: BigNumber,
  tokenIndex: number
): BigNumber {
  const invariant = fromFp(fpInvariant);
  const balances = fpBalances.map(fromFp);
  return fp(_getTokenBalanceGivenInvariantAndAllOtherBalances(balances, decimal(amp), invariant, tokenIndex));
}

export function calculateApproxInvariant(
  fpRawBalances: BigNumberish[],
  amplificationParameter: BigNumberish
): BigNumber {
  const totalCoins = fpRawBalances.length;
  const balances = fpRawBalances.map(fromFp);

  const sum = balances.reduce((a, b) => a.add(b), decimal(0));

  if (sum.isZero()) {
    return bn(0);
  }

  let inv = sum;
  let prevInv = decimal(0);
  const amp1TimesTotal = decimal(amplificationParameter).mul(totalCoins);

  for (let i = 0; i < 255; i++) {
    let P_D = balances[0].mul(totalCoins);
    for (let j = 1; j < totalCoins; j++) {
      P_D = P_D.mul(balances[j]).mul(totalCoins).div(inv);
    }

    prevInv = inv;
    inv = decimal(totalCoins)
      .mul(inv)
      .mul(inv)
      .add(amp1TimesTotal.mul(sum).mul(P_D))
      .div(decimal(totalCoins).add(1).mul(inv).add(amp1TimesTotal.sub(1).mul(P_D)));

    // converge with precision of integer 1
    if (inv.gt(prevInv)) {
      if (fp(inv).sub(fp(prevInv)).lte(1)) {
        //console.log("ts: inv converges in ", i, "D=", inv);
        break;
      }
    } else if (fp(prevInv).sub(fp(inv)).lte(1)) {
      //console.log("ts: inv converges in ", i, "D=", inv);
      break;
    }
  }

  return fp(inv);
}

export function calculateAnalyticalInvariantForTwoTokens(
  fpRawBalances: BigNumberish[],
  amplificationParameter: BigNumberish
): BigNumber {
  if (fpRawBalances.length !== 2) {
    throw "Analytical invariant is solved only for 2 balances";
  }

  const sum = fpRawBalances.reduce((a: Decimal, b: BigNumberish) => a.add(fromFp(b)), decimal(0));
  const prod = fpRawBalances.reduce((a: Decimal, b: BigNumberish) => a.mul(fromFp(b)), decimal(1));

  // The amplification parameter equals to: A n^(n-1), where A is the amplification coefficient
  const amplificationCoefficient = decimal(amplificationParameter).div(2);

  //Q
  const q = amplificationCoefficient.mul(-16).mul(sum).mul(prod);

  //P
  const p = amplificationCoefficient.minus(decimal(1).div(4)).mul(16).mul(prod);

  //C
  const c = q
    .pow(2)
    .div(4)
    .add(p.pow(3).div(27))
    .pow(1 / 2)
    .minus(q.div(2))
    .pow(1 / 3);

  const invariant = c.minus(p.div(c.mul(3)));
  return fp(invariant);
}

export function calcOutGivenIn(
  fpBalances: BigNumberish[],
  amplificationParameter1: BigNumberish,
  amplificationParameter2: BigNumberish,
  tokenIndexIn: number,
  tokenIndexOut: number,
  fpTokenAmountIn: BigNumberish
): Decimal {

  let B = fpBalances.map(fromFp);
  //console.log("calcOutGivenIn B [0]=", B[0], "B [1]=", B[1]);
  let curveIn = getCurve(B);

  let Ba: Decimal[] = [new Decimal(0), new Decimal(0)];
  Ba[tokenIndexIn] = B[tokenIndexIn].add(fromFp(fpTokenAmountIn));
  Ba[tokenIndexOut] = B[tokenIndexOut];
  //console.log("calcOutGivenIn Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);

  let curveOut;

  if (curveIn == 1) {
    let D1 = calculateInvariant(fpBalances, amplificationParameter1);
    Ba[tokenIndexOut] = _getTokenBalanceGivenInvariantAndAllOtherBalances(Ba, amplificationParameter1, fromFp(D1), tokenIndexOut);
    curveOut = getCurve(Ba);
    if (curveOut == 2) {
      // we are on curve 2, so we should have used A2/D2
      let Z = _calcZ(amplificationParameter1, fromFp(D1));
      let D2 = calculateInvariant([fp(Z), fp(Z)], amplificationParameter2);
      Ba[tokenIndexIn] = B[tokenIndexIn].add(fromFp(fpTokenAmountIn));
      Ba[tokenIndexOut] = B[tokenIndexOut];
      //console.log("before 2 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
      Ba[tokenIndexOut] = _getTokenBalanceGivenInvariantAndAllOtherBalances(Ba, amplificationParameter2, fromFp(D2), tokenIndexOut);
      //console.log("after  2 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
    }
  } else {
    let D2 = calculateInvariant(fpBalances, amplificationParameter2);
    Ba[tokenIndexOut] = _getTokenBalanceGivenInvariantAndAllOtherBalances(Ba, amplificationParameter2, fromFp(D2), tokenIndexOut);
    curveOut = getCurve(Ba);
    if (curveOut == 1) {
      // we are on curve 1, so we should have used A1/D1
      let Z = _calcZ(amplificationParameter2, fromFp(D2));
      let D1 = calculateInvariant([fp(Z), fp(Z)], amplificationParameter1);
      Ba[tokenIndexIn] = B[tokenIndexIn].add(fromFp(fpTokenAmountIn));
      Ba[tokenIndexOut] = B[tokenIndexOut];
      //console.log("before 1 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
      Ba[tokenIndexOut] = _getTokenBalanceGivenInvariantAndAllOtherBalances(Ba, amplificationParameter1, fromFp(D1), tokenIndexOut);
      //console.log("after  1 Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);
    }
  }
  //console.log("calcOutGivenIn done:", B[tokenIndexOut], Ba[tokenIndexOut]);
  return toFp(B[tokenIndexOut].sub(Ba[tokenIndexOut]));
}

export function calcInGivenOut(
  fpBalances: BigNumberish[],
  amplificationParameter1: BigNumberish,
  amplificationParameter2: BigNumberish,
  tokenIndexIn: number,
  tokenIndexOut: number,
  fpTokenAmountOut: BigNumberish
): Decimal {

  let B = fpBalances.map(fromFp);
  let curveIn = getCurve(B);

  let Ba: Decimal[] = [new Decimal(0), new Decimal(0)];
  Ba[tokenIndexIn] = B[tokenIndexIn];
  Ba[tokenIndexOut] = B[tokenIndexOut].sub(fromFp(fpTokenAmountOut));
  //console.log("calcInGivenOut Ba[0]=", Ba[0], "Ba[1]=", Ba[1]);

  let curveOut;

  if (curveIn == 1) {

    let D1 = calculateInvariant(fpBalances, amplificationParameter1);

    Ba[tokenIndexIn] = _getTokenBalanceGivenInvariantAndAllOtherBalances(Ba, amplificationParameter1, fromFp(D1), tokenIndexIn);

    curveOut = getCurve(Ba);

    if (curveOut == 2) {
      // we are on curve 2, so we should have used A2/D2
      let Z = _calcZ(amplificationParameter1, fromFp(D1));
      let D2 = calculateInvariant([fp(Z), fp(Z)], amplificationParameter2);
      Ba[tokenIndexIn] = B[tokenIndexIn];
      Ba[tokenIndexOut] = B[tokenIndexOut].sub(fromFp(fpTokenAmountOut));
      Ba[tokenIndexIn] = _getTokenBalanceGivenInvariantAndAllOtherBalances(Ba, amplificationParameter2, fromFp(D2), tokenIndexIn);
    }
  } else {

    let D2 = calculateInvariant(fpBalances, amplificationParameter2);

    Ba[tokenIndexIn] = _getTokenBalanceGivenInvariantAndAllOtherBalances(Ba, amplificationParameter2, fromFp(D2), tokenIndexIn);

    curveOut = getCurve(Ba);

    if (curveOut == 1) {
      // we are on curve 1, so we should have used A1/D1
      let Z = _calcZ(amplificationParameter2, fromFp(D2));
      let D1 = calculateInvariant([fp(Z), fp(Z)], amplificationParameter1);
      Ba[tokenIndexIn] = B[tokenIndexIn];
      Ba[tokenIndexOut] = B[tokenIndexOut].sub(fromFp(fpTokenAmountOut));
      Ba[tokenIndexIn] = _getTokenBalanceGivenInvariantAndAllOtherBalances(Ba, amplificationParameter1, fromFp(D1), tokenIndexIn);
    }
  }

  return toFp(Ba[tokenIndexIn].sub(B[tokenIndexIn]));

}

export function calcBptOutGivenExactTokensIn(
  fpBalances: BigNumberish[],
  amplificationParameter1: BigNumberish,
  amplificationParameter2: BigNumberish,
  fpAmountsIn: BigNumberish[],
  fpBptTotalSupply: BigNumberish,
  fpCurrentInvariant1: BigNumberish,
  fpCurrentInvariant2: BigNumberish,
  fpSwapFeePercentage: BigNumberish
): BigNumberish {
  // Get current invariant

  const balances = fpBalances.map(fromFp);
  const amountsIn = fpAmountsIn.map(fromFp);

  // First calculate the sum of all token balances which will be used to calculate
  // the current weights of each token relative to the sum of all balances
  const sumBalances = balances.reduce((a: Decimal, b: Decimal) => a.add(b), decimal(0));

  // Calculate the weighted balance ratio without considering fees
  const balanceRatiosWithFee = [];
  // The weighted sum of token balance rations sans fee
  let invariantRatioWithFees = decimal(0);
  for (let i = 0; i < balances.length; i++) {
    const currentWeight = balances[i].div(sumBalances);
    balanceRatiosWithFee[i] = balances[i].add(amountsIn[i]).div(balances[i]);
    invariantRatioWithFees = invariantRatioWithFees.add(balanceRatiosWithFee[i].mul(currentWeight));
  }

  // Second loop to calculate new amounts in taking into account the fee on the % excess
  for (let i = 0; i < balances.length; i++) {
    let amountInWithoutFee;

    // Check if the balance ratio is greater than the ideal ratio to charge fees or not
    if (balanceRatiosWithFee[i].gt(invariantRatioWithFees)) {
      const nonTaxableAmount = balances[i].mul(invariantRatioWithFees.sub(1));
      const taxableAmount = amountsIn[i].sub(nonTaxableAmount);
      amountInWithoutFee = nonTaxableAmount.add(taxableAmount.mul(decimal(1).sub(fromFp(fpSwapFeePercentage))));
    } else {
      amountInWithoutFee = amountsIn[i];
    }

    balances[i] = balances[i].add(amountInWithoutFee);
  }

  let curve = getCurve(balances);
  // Calculate the new invariant, taking swap fees into account
  let newInvariant = fromFp(calculateInvariants(balances.map(fp), amplificationParameter1, amplificationParameter2, curve));

  let invariantRatio;
  if (curve == 1) {
    invariantRatio = newInvariant.div(fromFp(fpCurrentInvariant1));
  } else {
    invariantRatio = newInvariant.div(fromFp(fpCurrentInvariant2));
  }

  if (invariantRatio.gt(1)) {
    return fp(fromFp(fpBptTotalSupply).mul(invariantRatio.sub(1)));
  } else {
    return bn(0);
  }
}

export function calcTokenInGivenExactBptOut(
  tokenIndex: number,
  fpBalances: BigNumberish[],
  amplificationParameter1: BigNumberish,
  amplificationParameter2: BigNumberish,
  fpBptAmountOut: BigNumberish,
  fpBptTotalSupply: BigNumberish,
  fpCurrentInvariant1: BigNumberish,
  fpCurrentInvariant2: BigNumberish,
  fpSwapFeePercentage: BigNumberish
): BigNumberish {

  const balances = fpBalances.map(fromFp);

  let amountInWithoutFee;
  {
    let R = fromFp(bn(fpBptTotalSupply).add(fpBptAmountOut)).div(fromFp(fpBptTotalSupply));

    // both A1/D1 and A2/D2 will give us the same side, in other words we can determine which side of x=y we are on.
    let newD1 = R.mul(fromFp(fpCurrentInvariant1));
    // Calculate amount in without fee.
    let newBalanceTokenIndex = _getTokenBalanceGivenInvariantAndAllOtherBalances(balances, amplificationParameter1, newD1, tokenIndex);

    let newB: Decimal[] = [new Decimal(0), new Decimal(0)];
    newB[tokenIndex] = newBalanceTokenIndex;
    newB[1 - tokenIndex] = balances[1 - tokenIndex];
    let curveOut = getCurve(newB);

    if (curveOut != 1) {
      let newD2 = R.mul(fromFp(fpCurrentInvariant2));
      newBalanceTokenIndex = _getTokenBalanceGivenInvariantAndAllOtherBalances(balances, amplificationParameter2, newD2, tokenIndex);
    }

    // the curve may have changed, but it's ok, all we need is the new balance.
    amountInWithoutFee = newBalanceTokenIndex.sub(balances[tokenIndex]);

  }

  const sumBalances = balances.reduce((a: Decimal, b: Decimal) => a.add(b), decimal(0));
  // We can now compute how much extra balance is being deposited and used in virtual swaps, and charge swap fees
  // accordingly.
  const currentWeight = balances[tokenIndex].div(sumBalances);
  const taxablePercentage = currentWeight.gt(1) ? 0 : decimal(1).sub(currentWeight);
  const taxableAmount = amountInWithoutFee.mul(taxablePercentage);
  const nonTaxableAmount = amountInWithoutFee.sub(taxableAmount);

  const bptOut = nonTaxableAmount.add(taxableAmount.div(decimal(1).sub(fromFp(fpSwapFeePercentage))));

  return fp(bptOut);
}

export function calcBptInGivenExactTokensOut(
  fpBalances: BigNumberish[],
  amplificationParameter1: BigNumberish,
  amplificationParameter2: BigNumberish,
  fpAmountsOut: BigNumberish[],
  fpBptTotalSupply: BigNumberish,
  fpCurrentInvariant1: BigNumberish,
  fpCurrentInvariant2: BigNumberish,
  fpSwapFeePercentage: BigNumberish
): BigNumber {

  const balances = fpBalances.map(fromFp);
  const amountsOut = fpAmountsOut.map(fromFp);

  // First calculate the sum of all token balances which will be used to calculate
  // the current weight of token
  const sumBalances = balances.reduce((a: Decimal, b: Decimal) => a.add(b), decimal(0));

  // Calculate the weighted balance ratio without considering fees
  const balanceRatiosWithoutFee = [];
  let invariantRatioWithoutFees = decimal(0);
  for (let i = 0; i < balances.length; i++) {
    const currentWeight = balances[i].div(sumBalances);
    balanceRatiosWithoutFee[i] = balances[i].sub(amountsOut[i]).div(balances[i]);
    invariantRatioWithoutFees = invariantRatioWithoutFees.add(balanceRatiosWithoutFee[i].mul(currentWeight));
  }

  // Second loop to calculate new amounts in taking into account the fee on the % excess
  for (let i = 0; i < balances.length; i++) {
    // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it to
    // 'token out'. This results in slightly larger price impact.

    let amountOutWithFee;
    if (invariantRatioWithoutFees.gt(balanceRatiosWithoutFee[i])) {
      const invariantRatioComplement = invariantRatioWithoutFees.gt(1)
        ? decimal(0)
        : decimal(1).sub(invariantRatioWithoutFees);
      const nonTaxableAmount = balances[i].mul(invariantRatioComplement);
      const taxableAmount = amountsOut[i].sub(nonTaxableAmount);
      amountOutWithFee = nonTaxableAmount.add(taxableAmount.div(decimal(1).sub(fromFp(fpSwapFeePercentage))));
    } else {
      amountOutWithFee = amountsOut[i];
    }

    balances[i] = balances[i].sub(amountOutWithFee);
  }
  const curve = getCurve(balances);

  // get new invariant taking into account swap fees
  const newInvariant = fromFp(calculateInvariants(balances.map(fp), amplificationParameter1, amplificationParameter2, curve));

  // return amountBPTIn
  let invariantRatio;
  if (curve == 1) {
    invariantRatio = newInvariant.div(fromFp(fpCurrentInvariant1));
  } else {
    invariantRatio = newInvariant.div(fromFp(fpCurrentInvariant2));
  }

  const invariantRatioComplement = invariantRatio.lt(1) ? decimal(1).sub(invariantRatio) : decimal(0);

  return fp(fromFp(fpBptTotalSupply).mul(invariantRatioComplement));
}

export function calcTokenOutGivenExactBptIn(
  tokenIndex: number,
  fpBalances: BigNumberish[],
  amplificationParameter1: BigNumberish,
  amplificationParameter2: BigNumberish,
  fpBptAmountIn: BigNumberish,
  fpBptTotalSupply: BigNumberish,
  fpCurrentInvariant1: BigNumberish,
  fpCurrentInvariant2: BigNumberish,
  fpSwapFeePercentage: BigNumberish
): BigNumberish {
  // Calculate new invariant
  const balances = fpBalances.map(fromFp);

  const R = fromFp(bn(fpBptTotalSupply).sub(fpBptAmountIn)).div(fromFp(fpBptTotalSupply));

  const D1 = R.mul(fromFp(fpCurrentInvariant1));

  // Calculate amount out without fee
  let newBalanceTokenIndex = _getTokenBalanceGivenInvariantAndAllOtherBalances(balances, amplificationParameter1, D1, tokenIndex);

  let newB: Decimal[] = [new Decimal(0), new Decimal(0)];
  newB[tokenIndex] = newBalanceTokenIndex;
  newB[1 - tokenIndex] = balances[1 - tokenIndex];
  let curveOut = getCurve(newB);

  if (curveOut != 1) {
    let D2 = R.mul(fromFp(fpCurrentInvariant2));
    newBalanceTokenIndex = _getTokenBalanceGivenInvariantAndAllOtherBalances(balances, amplificationParameter2, D2, tokenIndex);
  }


  // First calculate the sum of all token balances which will be used to calculate
  // the current weight of token
  const sumBalances = balances.reduce((a: Decimal, b: Decimal) => a.add(b), decimal(0));

  // get amountOutBeforeFee

  const amountOutWithoutFee = balances[tokenIndex].sub(newBalanceTokenIndex);

  // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
  // in swap fees.
  const currentWeight = balances[tokenIndex].div(sumBalances);
  const taxablePercentage = currentWeight.gt(1) ? decimal(0) : decimal(1).sub(currentWeight);

  // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
  // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
  const taxableAmount = amountOutWithoutFee.mul(taxablePercentage);
  const nonTaxableAmount = amountOutWithoutFee.sub(taxableAmount);
  const tokenOut = nonTaxableAmount.add(taxableAmount.mul(decimal(1).sub(fromFp(fpSwapFeePercentage))));
  return fp(tokenOut);
}

