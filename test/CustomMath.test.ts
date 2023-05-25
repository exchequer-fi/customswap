import {Contract} from 'ethers';
import {deploy} from '../scripts/helpers/contract';
import {bn, fp, BigNumber} from '../scripts/helpers/numbers';
import {expectEqualWithError} from '../scripts/helpers/relativeError';
import {
    calculateAnalyticalInvariantForTwoTokens,
    calculateInvariants,
    calcInGivenOut,
    calcOutGivenIn,
    getTokenBalanceGivenInvariantAndAllOtherBalances,
    calcBptOutGivenExactTokensIn,
    calcTokenInGivenExactBptOut,
    calcBptInGivenExactTokensOut,
    calcTokenOutGivenExactBptIn,
} from '../scripts/helpers/math';
import {random} from 'lodash';
import {expect} from 'chai';

const MAX_RELATIVE_ERROR = 0.0001; // Max relative error

// TODO: Test this math by checking extremes values for the amplification field (0 and infinite)
// to verify that it equals constant sum and constant product (weighted) invariants.

describe('CustomMath', function () {
    let mock: Contract;

    const AMP_PRECISION = 1e3;

    before(async function () {
        let stableMath: Contract = await deploy('StableMath');
        let customMath: Contract = await deploy('CustomMath', {
            libraries: {
                StableMath: stableMath.address,
            },
        });
        mock = await deploy('MockCustomMath', {
            libraries: {
                StableMath: stableMath.address,
                CustomMath: customMath.address,
            },
        });
    });

    context('invariant', () => {

        async function checkInvariant(balances: BigNumber[], amp1: number, amp2: number): Promise<void> {
            const A1 = bn(amp1).mul(AMP_PRECISION);
            const A2 = bn(amp2).mul(AMP_PRECISION);

            // actual
            const D1a = await mock.invariant(A1, A2, balances, 1);
            // expected
            const D1e = calculateInvariants(balances, amp1, amp2, 1);
            expectEqualWithError(D1a, D1e, MAX_RELATIVE_ERROR);

            //console.log("ts: C1", D1a.toString(), D1e.toString());

            // actual
            const D2a = await mock.invariant(A1, A2, balances, 2);
            // expected
            const D2e = calculateInvariants(balances, amp1, amp2, 2);

            //console.log("ts: C2", D2a.toString(), D2e.toString());

            expectEqualWithError(D2a, D2e, MAX_RELATIVE_ERROR);
        }


        context('check over a range of inputs', () => {
            for (let numTokens = 2; numTokens <= 2; numTokens++) {
                const balances = Array.from({length: numTokens}, () => random(250, 350)).map(fp);
                it(`computes the invariant for ${numTokens} tokens`, async () => {
                    for (let amp = 100; amp <= 5000; amp += 100) {
                        await checkInvariant(balances, amp, amp);
                    }
                });
            }
        });

        context('two tokens', () => {
            it('invariant equals analytical solution', async () => {
                const amp1 = bn(100);
                const amp2 = bn(100);
                const balances = [fp(10), fp(12)];
                {
                    const result = await mock.invariant(amp1.mul(AMP_PRECISION), amp2.mul(AMP_PRECISION), balances, 1);
                    const expectedInvariant = calculateAnalyticalInvariantForTwoTokens(balances, amp1);
                    expectEqualWithError(result, expectedInvariant, MAX_RELATIVE_ERROR);
                }
                {
                    const result = await mock.invariant(amp1.mul(AMP_PRECISION), amp2.mul(AMP_PRECISION), balances, 2);
                    const expectedInvariant = calculateAnalyticalInvariantForTwoTokens(balances, amp1);
                    expectEqualWithError(result, expectedInvariant, MAX_RELATIVE_ERROR);
                }
            });
        });

        it('still converges at extreme values', async () => {
            const amp1 = bn(1);
            const amp2 = bn(1);
            const balances = [fp(0.00000001), fp(1200000000)];

            {
                const result = await mock.invariant(amp1.mul(AMP_PRECISION), amp2.mul(AMP_PRECISION), balances, 1);
                const expectedInvariant = calculateInvariants(balances, amp1, amp2, 1);
                //console.log("result1", result.toString());
                //console.log("expect1", expectedInvariant.toString());
                expectEqualWithError(result, expectedInvariant, MAX_RELATIVE_ERROR);
            }
            {
                const result = await mock.invariant(amp1.mul(AMP_PRECISION), amp2.mul(AMP_PRECISION), balances, 2);
                const expectedInvariant = calculateInvariants(balances, amp1, amp2, 2);
                //console.log("result2", result.toString());
                //console.log("expect2", expectedInvariant.toString());
                expectEqualWithError(result, expectedInvariant, MAX_RELATIVE_ERROR);
            }
        });

    });


    context('token balance given invariant and other balances', () => {
        async function checkTokenBalanceGivenInvariants(
            balances: BigNumber[],
            amp1: number,
            amp2: number,
            invariant1: BigNumber,
            invariant2: BigNumber,
            tokenIndex: number,
        ): Promise<void> {
            const ampParameter1 = bn(amp1).mul(AMP_PRECISION);
            const ampParameter2 = bn(amp2).mul(AMP_PRECISION);
            {
                const actualTokenBalance = await mock.getTokenBalanceGivenInvariantAndAllOtherBalances(
                    ampParameter1,
                    balances,
                    invariant1,
                    tokenIndex,
                );
                // Note this function takes the decimal amp (unadjusted)
                const expectedTokenBalance = getTokenBalanceGivenInvariantAndAllOtherBalances(
                    amp1,
                    balances,
                    invariant1,
                    tokenIndex,
                );
                expectEqualWithError(actualTokenBalance, expectedTokenBalance, MAX_RELATIVE_ERROR);
            }
            {
                const actualTokenBalance = await mock.getTokenBalanceGivenInvariantAndAllOtherBalances(
                    ampParameter2,
                    balances,
                    invariant2,
                    tokenIndex,
                );
                // Note this function takes the decimal amp (unadjusted)
                const expectedTokenBalance = getTokenBalanceGivenInvariantAndAllOtherBalances(
                    amp2,
                    balances,
                    invariant2,
                    tokenIndex,
                );
                expectEqualWithError(actualTokenBalance, expectedTokenBalance, MAX_RELATIVE_ERROR);
            }
        }

        context('check over a range of inputs', () => {
            for (let numTokens = 2; numTokens <= 2; numTokens++) {
                const balances = Array.from({length: numTokens}, () => random(250, 350)).map(fp);

                it(`computes the token balance for ${numTokens} tokens`, async () => {
                    for (let amp1 = 200; amp1 <= 5000; amp1 += 200) {
                        for (let amp2 = 200; amp2 <= 5000; amp2 += 200) {
                            const currentInvariant1 = calculateInvariants(balances, amp1, amp2, 1);
                            const currentInvariant2 = calculateInvariants(balances, amp1, amp2, 2);

                            // mutate the balances
                            for (let tokenIndex = 0; tokenIndex < numTokens; tokenIndex++) {
                                const newBalances: BigNumber[] = Object.assign([], balances);
                                newBalances[tokenIndex] = newBalances[tokenIndex].add(fp(100));

                                await checkTokenBalanceGivenInvariants(
                                    newBalances,
                                    amp1, amp2,
                                    currentInvariant1, currentInvariant2,
                                    tokenIndex);
                            }
                        }
                    }
                });
            }
        });
    });


    context('in given out', () => {

        context('two tokens', () => {

            it('returns in given out', async () => {

                const amp1 = bn(100);
                const amp2 = bn(100);
                const balances = Array.from({length: 2}, () => random(8, 12)).map(fp);
                const tokenIndexIn = 0;
                const tokenIndexOut = 1;
                const amountOut = fp(2);

                const result = await mock.inGivenOut(
                    amp1.mul(AMP_PRECISION),
                    amp2.mul(AMP_PRECISION),
                    balances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amountOut);

                const expectedAmountIn = calcInGivenOut(balances, amp1, amp2, tokenIndexIn, tokenIndexOut, amountOut);

                expectEqualWithError(result, bn(expectedAmountIn.toFixed(0)), MAX_RELATIVE_ERROR);

            });
        });

    });


    context('out given in', () => {

        context('two tokens', () => {
            it('returns out given in', async () => {
                const amp1 = bn(10);
                const amp2 = bn(10);
                const balances = Array.from({length: 2}, () => random(10, 12)).map(fp);
                const tokenIndexIn = 0;
                const tokenIndexOut = 1;
                const amountIn = fp(2);

                const result = await mock.outGivenIn(
                    amp1.mul(AMP_PRECISION),
                    amp2.mul(AMP_PRECISION),
                    balances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amountIn);

                //console.log("result", result.toString());

                const expectedAmountOut = calcOutGivenIn(balances, amp1, amp2, tokenIndexIn, tokenIndexOut, amountIn);

                //console.log("expected", expectedAmountOut.toString());

                expectEqualWithError(result, bn(expectedAmountOut.toFixed(0)), MAX_RELATIVE_ERROR);

            });
        });

    });


    context('token in given exact BPT out', () => {
        const SWAP_FEE = fp(0.012);

        async function checkTokenInGivenBptOut(
            amp1: number,
            amp2: number,
            balances: BigNumber[],
            tokenIndex: number,
            bptAmountOut: BigNumber,
            bptTotalSupply: BigNumber,
            currentInvariant1: BigNumber,
            currentInvariant2: BigNumber,
            swapFee: BigNumber,
        ): Promise<void> {
            const amp1Parameter = bn(amp1).mul(AMP_PRECISION);
            const amp2Parameter = bn(amp2).mul(AMP_PRECISION);

            const actualTokenIn = await mock.tokenInForExactBPTOut(
                amp1Parameter,
                currentInvariant1,
                amp2Parameter,
                currentInvariant2,
                balances,
                tokenIndex,
                bptAmountOut,
                bptTotalSupply,
                swapFee,
            );


            const expectedTokenIn = calcTokenInGivenExactBptOut(
                tokenIndex,
                balances,
                amp1,
                amp2,
                bptAmountOut,
                bptTotalSupply,
                currentInvariant1,
                currentInvariant2,
                swapFee,
            );

            //.log("A1=", amp1, "D1=", currentInvariant1.toString(), "A2=", amp2, "D2=", currentInvariant2.toString());
            //console.log("Actual  =", actualTokenIn.toString());
            //console.log("Expected=", expectedTokenIn.toString());

            expect(actualTokenIn).gt(0);

            expectEqualWithError(actualTokenIn, expectedTokenIn, MAX_RELATIVE_ERROR);

        }

        context('check over a range of inputs', () => {
            const bptAmountOut = fp(1);

            for (let numTokens = 2; numTokens <= 2; numTokens++) {
                const balances = Array.from({length: numTokens}, () => random(250, 350)).map(fp);
                const totalSupply = balances.reduce((sum, current) => {
                    return (sum = sum.add(current));
                });

                it(`computes the token in for ${numTokens} tokens`, async () => {
                    for (let amp1 = 200; amp1 <= 5000; amp1 += 200) {
                        for (let amp2 = 200; amp2 <= 5000; amp2 += 200) {
                            const currentInvariant1 = calculateInvariants(balances, amp1, amp2, 1);
                            const currentInvariant2 = calculateInvariants(balances, amp1, amp2, 2);

                            // actual
                            const A1 = bn(amp1).mul(AMP_PRECISION);
                            const A2 = bn(amp2).mul(AMP_PRECISION);

                            const D1 = await mock.invariant(A1, A2, balances, 1);
                            const D2 = await mock.invariant(A1, A2, balances, 2);


                            //console.log("D1j=", currentInvariant1.toString());
                            //console.log("D1s=", D1.toString());
                            //console.log("D2j=", currentInvariant2.toString());
                            //console.log("D2s=", D2.toString());

                            for (let tokenIndex = 0; tokenIndex < numTokens; tokenIndex++) {
                                await checkTokenInGivenBptOut(
                                    amp1,
                                    amp2,
                                    balances,
                                    tokenIndex,
                                    bptAmountOut,
                                    totalSupply,
                                    currentInvariant1,
                                    currentInvariant2,
                                    SWAP_FEE,
                                );
                            }
                        }
                    }
                });
            }
        });
    });
    context('token out given exact BPT in', () => {
        const SWAP_FEE = fp(0.012);

        async function checkTokenOutGivenBptIn(
            amp1: number,
            amp2: number,
            balances: BigNumber[],
            tokenIndex: number,
            bptAmountIn: BigNumber,
            bptTotalSupply: BigNumber,
            currentInvariant1: BigNumber,
            currentInvariant2: BigNumber,
            swapFee: BigNumber,
        ): Promise<void> {
            const amp1Parameter = bn(amp1).mul(AMP_PRECISION);
            const amp2Parameter = bn(amp2).mul(AMP_PRECISION);

            const actualTokenOut = await mock.exactBPTInForTokenOut(
                amp1Parameter,
                currentInvariant1,
                amp2Parameter,
                currentInvariant2,
                balances,
                tokenIndex,
                bptAmountIn,
                bptTotalSupply,
                swapFee,
            );

            const expectedTokenOut = calcTokenOutGivenExactBptIn(
                tokenIndex,
                balances,
                amp1,
                amp2,
                bptAmountIn,
                bptTotalSupply,
                currentInvariant1,
                currentInvariant2,
                swapFee,
            );

            expect(actualTokenOut).gt(0);
            expectEqualWithError(actualTokenOut, expectedTokenOut, MAX_RELATIVE_ERROR);
        }

        context('check over a range of inputs', () => {
            const bptAmountIn = fp(1);

            for (let numTokens = 2; numTokens <= 2; numTokens++) {
                const balances = Array.from({length: numTokens}, () => random(250, 350)).map(fp);
                const totalSupply = balances.reduce((sum, current) => {
                    return (sum = sum.add(current));
                });

                it(`computes the token out for ${numTokens} tokens`, async () => {
                    // TODO: Check me. -JP
                    for (let amp1 = 200; amp1 <= 5000; amp1 += 200) {
                        for (let amp2 = 200; amp2 <= 5000; amp2 += 200) {
                            const currentInvariant1 = calculateInvariants(balances, amp1, amp2, 1);
                            const currentInvariant2 = calculateInvariants(balances, amp1, amp2, 2);

                            for (let tokenIndex = 0; tokenIndex < numTokens; tokenIndex++) {
                                await checkTokenOutGivenBptIn(
                                    amp1,
                                    amp2,
                                    balances,
                                    tokenIndex,
                                    bptAmountIn,
                                    totalSupply,
                                    currentInvariant1,
                                    currentInvariant2,
                                    SWAP_FEE,
                                );
                            }
                        }
                    }
                });
            }
        });
    });

    context('BPT in given exact tokens out', () => {
        const SWAP_FEE = fp(0.038);

        async function checkBptInGivenTokensOut(
            amp1: number,
            amp2: number,
            balances: BigNumber[],
            amountsOut: BigNumber[],
            bptTotalSupply: BigNumber,
            currentInvariant1: BigNumber,
            currentInvariant2: BigNumber,
            swapFee: BigNumber,
        ): Promise<void> {
            const amp1Parameter = bn(amp1).mul(AMP_PRECISION);
            const amp2Parameter = bn(amp2).mul(AMP_PRECISION);

            const actualBptIn = await mock.bptInForExactTokensOut(
                amp1Parameter,
                currentInvariant1,
                amp2Parameter,
                currentInvariant2,
                balances,
                amountsOut,
                bptTotalSupply,
                swapFee,
            );

            const expectedBptIn = calcBptInGivenExactTokensOut(
                balances,
                amp1,
                amp2,
                amountsOut,
                bptTotalSupply,
                currentInvariant1,
                currentInvariant2,
                swapFee,
            );

            expect(actualBptIn).gt(0);

            expectEqualWithError(actualBptIn, expectedBptIn, MAX_RELATIVE_ERROR);

        }

        context('check over a range of inputs', () => {
            for (let numTokens = 2; numTokens <= 2; numTokens++) {
                const balances = Array.from({length: numTokens}, () => random(250, 350)).map(fp);
                const totalSupply = balances.reduce((sum, current) => {
                    return (sum = sum.add(current));
                });
                const amountsOut = Array.from({length: numTokens}, () => random(0, 50)).map(fp);

                it(`computes the bptOut for ${numTokens} tokens`, async () => {
                    for (let amp1 = 200; amp1 <= 5000; amp1 += 200) {
                        for (let amp2 = 200; amp2 <= 5000; amp2 += 200) {
                            const currentInvariant1 = calculateInvariants(balances, amp1, amp2, 1);
                            const currentInvariant2 = calculateInvariants(balances, amp1, amp2, 2);
                            await checkBptInGivenTokensOut(
                                amp1, amp1,
                                balances,
                                amountsOut,
                                totalSupply,
                                currentInvariant1, currentInvariant2,
                                SWAP_FEE);
                        }
                    }
                });
            }
        });
    });


    context('BPT out given exact tokens in', () => {
        const SWAP_FEE = fp(0.022);

        async function checkBptOutGivenTokensIn(
            amp1: number,
            amp2: number,
            balances: BigNumber[],
            amountsIn: BigNumber[],
            bptTotalSupply: BigNumber,
            swapFee: BigNumber,
        ): Promise<void> {
            const amp1Parameter = bn(amp1).mul(AMP_PRECISION);
            const amp2Parameter = bn(amp2).mul(AMP_PRECISION);
            const currentInvariant1 = calculateInvariants(balances, amp1, amp2, 1);
            const currentInvariant2 = calculateInvariants(balances, amp1, amp2, 2);

            const actualBptOut = await mock.exactTokensInForBPTOut(
                amp1Parameter,
                currentInvariant1,
                amp2Parameter,
                currentInvariant2,
                balances,
                amountsIn,
                bptTotalSupply,
                swapFee,
            );

            const expectedBptOut = calcBptOutGivenExactTokensIn(
                balances,
                amp1,
                amp2,
                amountsIn,
                bptTotalSupply,
                currentInvariant1,
                currentInvariant2,
                swapFee,
            );

            expect(actualBptOut).gt(0);

            expectEqualWithError(actualBptOut, expectedBptOut, MAX_RELATIVE_ERROR);

        }

        context('check over a range of inputs', () => {
            for (let numTokens = 2; numTokens <= 2; numTokens++) {
                const balances = Array.from({length: numTokens}, () => random(250, 350)).map(fp);
                const totalSupply = balances.reduce((sum, current) => {
                    return (sum = sum.add(current));
                });
                const amountsIn = Array.from({length: numTokens}, () => random(0, 50)).map(fp);

                it(`computes the bptOut for ${numTokens} tokens`, async () => {
                    for (let amp = 100; amp <= 5000; amp += 100) {
                        // TODO: Check me, -JP
                        await checkBptOutGivenTokensIn(amp, amp, balances, amountsIn, totalSupply, SWAP_FEE);
                    }
                });
            }
        });
    });

// TODO: SKIPPING THIS FOR NOW - FIX ME

    /*
    context("get rate", () => {
      async function checkRate(balances: BigNumber[], amp1: number, amp2: number, supply: BigNumber): Promise<void> {
        const amp1Parameter = bn(amp1).mul(AMP_PRECISION);
        const amp2Parameter = bn(amp2).mul(AMP_PRECISION);
        const actualRate = await mock.getRate(balances, amp1Parameter, amp2Parameter, supply);
        const currentInvariant = calculateInvariant(balances, amp1Parameter, amp2Parameter);
        const expectedRate = fp(fromFp(currentInvariant).div(fromFp(supply)));

        expectEqualWithError(actualRate, expectedRate, MAX_RELATIVE_ERROR);
      }

      context("check over a range of inputs", () => {
        for (let numTokens = 2; numTokens <= 2; numTokens++) {
          const balances = Array.from({ length: numTokens }, () => random(250, 350)).map(fp);

          // Supply if all balances were maxed; rate should be ~ 0.7 - 1.0
          const supply = fp(350).mul(numTokens);

          it(`computes the rate for ${numTokens} tokens`, async () => {
            // TODO: Check me. -JP
            for (let amp = 100; amp <= 5000; amp += 100) {
              await checkRate(balances, amp, amp, supply);
            }
          });
        }
      });
    });
    */

})
;
