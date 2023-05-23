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

//import "./interfaces/pool-custom/CustomPoolUserData.sol";
//import "./interfaces/solidity-utils/helpers/BalancerErrors.sol";
//import "./interfaces/standalone-utils/IProtocolFeePercentagesProvider.sol";
//import "./interfaces/pool-utils/IRateProvider.sol";
//
//import "@balancer-labs/v2-solidity-utils/contracts/math/FixedPoint.sol";
//import "@balancer-labs/v2-solidity-utils/contracts/math/Math.sol";
//import "@balancer-labs/v2-solidity-utils/contracts/helpers/ERC20Helpers.sol";
//import "@balancer-labs/v2-solidity-utils/contracts/helpers/InputHelpers.sol";
//
//import "@balancer-labs/v2-pool-utils/contracts/BaseGeneralPool.sol";
//import "@balancer-labs/v2-pool-utils/contracts/rates/PriceRateCache.sol";

//import "./interfaces/pool-custom/CustomPoolUserData.sol";
//import "./interfaces/standalone-utils/IProtocolFeePercentagesProvider.sol";
//import "./pool-utils/BaseGeneralPool.sol";

import "../interfaces/pool-custom/CustomPoolUserData.sol";
import "../pool-utils/BaseGeneralPool.sol";

import "./ComposableCustomPoolStorage.sol";
import "./ComposableCustomPoolRates.sol";
import "./ComposableCustomPoolStorage.sol";
import "./ComposableCustomPoolRates.sol";
import "./ComposableCustomPoolProtocolFees.sol";
import "./CustomPoolAmplification.sol";
import "./CustomMath.sol";

/**
 * @dev CustomPool with preminted BPT and rate providers for each token, allowing for e.g. wrapped tokens with a known
 * price ratio, such as Compound's cTokens.
 *
 * BPT is preminted on Pool initialization and registered as one of the Pool's tokens, allowing for swaps to behave as
 * single-token joins or exits (by swapping a token for BPT). We also support regular joins and exits, which can mint
 * and burn BPT.
 *
 * Preminted BPT is deposited in the Vault as the initial balance of the Pool, and doesn't belong to any entity until
 * transferred out of the Pool. The Pool's arithmetic behaves as if it didn't exist, and the BPT total supply is not
 * a useful value: we rely on the 'virtual supply' (how much BPT is actually owned outside the Vault) instead.
 */
contract ComposableCustomPool is IRateProvider, BaseGeneralPool, CustomPoolAmplification, ComposableCustomPoolRates, ComposableCustomPoolProtocolFees
{
    using FixedPoint for uint256;
    using PriceRateCache for bytes32;
    using CustomPoolUserData for bytes;
    using BasePoolUserData for bytes;

    // The maximum imposed by the Vault, which stores balances in a packed format, is 2**(112) - 1.
    // We are preminting half of that value (rounded up).
    uint256 private constant _PREMINTED_TOKEN_BALANCE = 2 ** (111);

    // The constructor arguments are received in a struct to work around stack-too-deep issues
    struct NewPoolParams {
        IVault vault;
        IProtocolFeePercentagesProvider protocolFeeProvider;
        string name;
        string symbol;
        IERC20[] tokens;
        IRateProvider[] rateProviders;
        uint256[] tokenRateCacheDurations;
        bool[] exemptFromYieldProtocolFeeFlags;
        uint256 amplificationParameter1;
        uint256 amplificationParameter2;
        uint256 swapFeePercentage;
        uint256 pauseWindowDuration;
        uint256 bufferPeriodDuration;
        address owner;
    }

    constructor(NewPoolParams memory params)
    BasePool(
    params.vault,
    IVault.PoolSpecialization.GENERAL,
    params.name,
    params.symbol,
    _insertSorted(params.tokens, IERC20(this)),
    new address[](params.tokens.length + 1),
    params.swapFeePercentage,
    params.pauseWindowDuration,
    params.bufferPeriodDuration,
    params.owner
    )
    CustomPoolAmplification(params.amplificationParameter1, params.amplificationParameter2)
    ComposableCustomPoolStorage(_extractStorageParams(params))
    ComposableCustomPoolRates(_extractRatesParams(params))
    ProtocolFeeCache(params.protocolFeeProvider, ProtocolFeeCache.DELEGATE_PROTOCOL_SWAP_FEES_SENTINEL)
    {
        // solhint-disable-previous-line no-empty-blocks
    }

    // Translate parameters to avoid stack-too-deep issues in the constructor
    function _extractRatesParams(NewPoolParams memory params)
    private
    pure
    returns (ComposableCustomPoolRates.RatesParams memory)
    {
        return
        ComposableCustomPoolRates.RatesParams({
            tokens: params.tokens,
            rateProviders: params.rateProviders,
            tokenRateCacheDurations: params.tokenRateCacheDurations
        });
    }

    // Translate parameters to avoid stack-too-deep issues in the constructor
    function _extractStorageParams(NewPoolParams memory params)
    private
    view
    returns (ComposableCustomPoolStorage.StorageParams memory)
    {
        return
        ComposableCustomPoolStorage.StorageParams({
            registeredTokens: _insertSorted(params.tokens, IERC20(this)),
            tokenRateProviders: params.rateProviders,
            exemptFromYieldProtocolFeeFlags: params.exemptFromYieldProtocolFeeFlags
        });
    }

    /**
     * @notice Return the minimum BPT balance, required to avoid minimum token balances.
     * @dev This amount is minted and immediately burned on pool initialization, so that the total supply
     * (and therefore post-exit token balances), can never be zero. This keeps the math well-behaved when
     * liquidity is low. (It also provides an easy way to check whether a pool has been initialized, to
     * ensure this is only done once.)
     */
    function getMinimumBpt() external pure returns (uint256) {
        return _getMinimumBpt();
    }

    // BasePool hook

    /**
     * @dev Override base pool hook invoked before any swap, join, or exit to ensure rates are updated before
     * the operation.
     */
    function _beforeSwapJoinExit() internal override {
        super._beforeSwapJoinExit();

        // Before the scaling factors are read, we must update the cached rates, as those will be used to compute the
        // scaling factors.
        // Note that this is not done in a recovery mode exit (since _beforeSwapjoinExit() is not called under those
        // conditions), but this is fine as recovery mode exits are unaffected by scaling factors anyway.
        _cacheTokenRatesIfNecessary();
    }

    // Swap Hooks

    /**
     * @dev Override this hook called by the base class `onSwap`, to check whether we are doing a regular swap,
     * or a swap involving BPT, which is equivalent to a single token join or exit. Since one of the Pool's
     * tokens is the preminted BPT, we need to handle swaps where BPT is involved separately.
     *
     * At this point, the balances are unscaled. The indices are coming from the Vault, so they are indices into
     * the array of registered tokens (including BPT).
     *
     * If this is a swap involving BPT, call `_swapWithBpt`, which computes the amountOut using the swapFeePercentage
     * and charges protocol fees, in the same manner as single token join/exits. Otherwise, perform the default
     * processing for a regular swap.
     */
    function _swapGivenIn(
        SwapRequest memory swapRequest,
        uint256[] memory registeredBalances,
        uint256 registeredIndexIn,
        uint256 registeredIndexOut,
        uint256[] memory scalingFactors
    ) internal virtual override returns (uint256) {
        return
        (swapRequest.tokenIn == IERC20(this) || swapRequest.tokenOut == IERC20(this))
        ? _swapWithBpt(swapRequest, registeredBalances, registeredIndexIn, registeredIndexOut, scalingFactors)
        : super._swapGivenIn(
            swapRequest,
            registeredBalances,
            registeredIndexIn,
            registeredIndexOut,
            scalingFactors
        );
    }

    /**
     * @dev Override this hook called by the base class `onSwap`, to check whether we are doing a regular swap,
     * or a swap involving BPT, which is equivalent to a single token join or exit. Since one of the Pool's
     * tokens is the preminted BPT, we need to handle swaps where BPT is involved separately.
     *
     * At this point, the balances are unscaled. The indices and balances are coming from the Vault, so they
     * refer to the full set of registered tokens (including BPT).
     *
     * If this is a swap involving BPT, call `_swapWithBpt`, which computes the amountOut using the swapFeePercentage
     * and charges protocol fees, in the same manner as single token join/exits. Otherwise, perform the default
     * processing for a regular swap.
     */
    function _swapGivenOut(
        SwapRequest memory swapRequest,
        uint256[] memory registeredBalances,
        uint256 registeredIndexIn,
        uint256 registeredIndexOut,
        uint256[] memory scalingFactors
    ) internal virtual override returns (uint256) {
        return
        (swapRequest.tokenIn == IERC20(this) || swapRequest.tokenOut == IERC20(this))
        ? _swapWithBpt(swapRequest, registeredBalances, registeredIndexIn, registeredIndexOut, scalingFactors)
        : super._swapGivenOut(
            swapRequest,
            registeredBalances,
            registeredIndexIn,
            registeredIndexOut,
            scalingFactors
        );
    }

    /**
     * @dev This is called from the base class `_swapGivenIn`, so at this point the amount has been adjusted
     * for swap fees, and balances have had scaling applied. This will only be called for regular (non-BPT) swaps,
     * so forward to `onRegularSwap`.
     */
    function _onSwapGivenIn(
        SwapRequest memory request,
        uint256[] memory registeredBalances,
        uint256 registeredIndexIn,
        uint256 registeredIndexOut
    ) internal virtual override returns (uint256) {

        // Adjust indices and balances for BPT token
        uint256[] memory balances = _dropBptItem(registeredBalances);
        //uint256 indexIn = _skipBptIndex(registeredIndexIn);
        //uint256 indexOut = _skipBptIndex(registeredIndexOut);

        // current As
        (uint256 A1,) = _getAmplificationParameter1();
        (uint256 A2,) = _getAmplificationParameter2();

        (, uint256 quantityOut) = CustomMath.calcOutGivenIn(
            A1,
            A2,
            balances,
            _skipBptIndex(registeredIndexIn),
            _skipBptIndex(registeredIndexOut),
            request.amount
        );

        return quantityOut;

    }

    /**
     * @dev This is called from the base class `_swapGivenOut`, so at this point the amount has been adjusted
     * for swap fees, and balances have had scaling applied. This will only be called for regular (non-BPT) swaps,
     * so forward to `onRegularSwap`.
     */
    function _onSwapGivenOut(
        SwapRequest memory request,
        uint256[] memory registeredBalances,
        uint256 registeredIndexIn,
        uint256 registeredIndexOut
    ) internal virtual override returns (uint256) {

        // function _onRegularSwap(OnRegularSwapParams memory params) private view returns (uint256) {
        // Adjust indices and balances for BPT token
        uint256[] memory balances = _dropBptItem(registeredBalances);
        // uint256 indexIn = _skipBptIndex(registeredIndexIn);
        // uint256 indexOut = _skipBptIndex(registeredIndexOut);

        // current As
        (uint256 A1,) = _getAmplificationParameter1();
        (uint256 A2,) = _getAmplificationParameter2();

        (, uint256 quantityOut) = CustomMath.calcInGivenOut(
            A1,
            A2,
            balances,
            _skipBptIndex(registeredIndexIn),
            _skipBptIndex(registeredIndexOut),
            request.amount
        );

        return quantityOut;

    }

    /**
     * @dev Perform a swap involving the BPT token, equivalent to a single-token join or exit. As with the standard
     * joins and swaps, we first pay any protocol fees pending from swaps that occurred since the previous join or
     * exit, then perform the operation (joinSwap or exitSwap), and finally store the "post operation" invariant and
     * amp, which establishes the new basis for protocol fees.
     *
     * At this point, the scaling factors (including rates) have been computed by the base class, but not yet applied
     * to the balances.
     */

    function _swapWithBpt(
        SwapRequest memory swapRequest,
        uint256[] memory registeredBalances,
        uint256 registeredIndexIn,
        uint256 registeredIndexOut,
        uint256[] memory scalingFactors
    ) private returns (uint256) {
        // Stack too deep
        // isGivenIn = swapRequest.kind == IVault.SwapKind.GIVEN_IN;

        _upscaleArray(registeredBalances, scalingFactors);

        swapRequest.amount = _upscale(
            swapRequest.amount,
            scalingFactors[swapRequest.kind == IVault.SwapKind.GIVEN_IN ? registeredIndexIn : registeredIndexOut]
        );

        BeforeJoinExitReturn memory rets = _beforeJoinExit(registeredBalances);

        // These calls mutate `balances` so that it holds the post join-exit balances.
        (uint256 amountCalculated, uint256 postJoinExitSupply) = registeredIndexOut == getBptIndex()
        ? _doJoinSwap(
            swapRequest.kind == IVault.SwapKind.GIVEN_IN,
            swapRequest.amount,
            rets.balances,
            _skipBptIndex(registeredIndexIn),
            rets.curve,
            rets.preJoinExitSupply
        )
        : _doExitSwap(
            swapRequest.kind == IVault.SwapKind.GIVEN_IN,
            swapRequest.amount,
            rets.balances,
            _skipBptIndex(registeredIndexOut),
            rets.curve,
            rets.preJoinExitSupply
        );

        _updateInvariantAfterJoinExit(rets.curve, rets.balances, rets.preJoinExitSupply, postJoinExitSupply);

        return
        swapRequest.kind == IVault.SwapKind.GIVEN_IN
        ? _downscaleDown(amountCalculated, scalingFactors[registeredIndexOut]) // Amount out, round down
        : _downscaleUp(amountCalculated, scalingFactors[registeredIndexIn]);
        // Amount in, round up
    }

    /**
     * @dev This mutates `balances` so that they become the post-joinswap balances. The CustomMath interfaces
     * are different depending on the swap direction, so we forward to the appropriate low-level join function.
     */
    function _doJoinSwap(
        bool isGivenIn,
        uint256 amount,
        uint256[] memory balances,
        uint256 indexIn,
        CustomMath.Curve memory curve,
        uint256 virtualSupply
    ) internal view returns (uint256, uint256) {

        if (isGivenIn) {

            // return _joinSwapExactTokenInForBptOut(amount, balances, indexIn, curve, virtualSupply);

            // @dev Since this is a join, we know the tokenOut is BPT. Since it is GivenIn, we know the tokenIn amount,
            // and must calculate the BPT amount out.
            // We are moving preminted BPT out of the Vault, which increases the virtual supply.

            //        function _joinSwapExactTokenInForBptOut(
            //        uint256 amountIn,
            //        uint256[] memory balances,
            //        uint256 indexIn,
            //        CustomMath.Curve memory curve,
            //        uint256 virtualSupply
            //        ) internal view returns (uint256, uint256) {
            // The CustomMath function was created with joins in mind, so it expects a full amounts array. We create an
            // empty one and only set the amount for the token involved.

            uint256[] memory amountsIn = new uint256[](balances.length);
            amountsIn[indexIn] = amount;

            uint256 bptOut = CustomMath.calcBptOutGivenExactTokensIn(
                curve,
                balances,
                amountsIn,
                virtualSupply,
                getSwapFeePercentage()
            );

            balances[indexIn] = balances[indexIn].add(amount);

            uint256 postJoinExitSupply = virtualSupply.add(bptOut);

            return (bptOut, postJoinExitSupply);

        } else {
            // return _joinSwapExactBptOutForTokenIn(amount, balances, indexIn, curve, virtualSupply);

            // @dev Since this is a join, we know the tokenOut is BPT. Since it is GivenOut, we know the BPT amount,
            // and must calculate the token amount in.
            // We are moving preminted BPT out of the Vault, which increases the virtual supply.

            //        function _joinSwapExactBptOutForTokenIn(
            //        uint256 bptOut,
            //        uint256[] memory balances,
            //        uint256 indexIn,
            //        CustomMath.Curve memory curve,
            //        uint256 virtualSupply
            //        ) internal view returns (uint256, uint256) {

            uint256 amountIn = CustomMath.calcTokenInGivenExactBptOut(
                curve,
                balances,
                indexIn,
                amount,
                virtualSupply,
                getSwapFeePercentage()
            );

            balances[indexIn] = balances[indexIn].add(amountIn);
            uint256 postJoinExitSupply = virtualSupply.add(amount);

            return (amountIn, postJoinExitSupply);

        }
    }


    /**
     * @dev This mutates balances so that they become the post-exitswap balances. The CustomMath interfaces are
     * different depending on the swap direction, so we forward to the appropriate low-level exit function.
     */
    function _doExitSwap(
        bool isGivenIn,
        uint256 amount,
        uint256[] memory balances,
        uint256 indexOut,
        CustomMath.Curve memory curve,
        uint256 virtualSupply
    ) internal view returns (uint256, uint256) {
        if (isGivenIn) {
            //return _exitSwapExactBptInForTokenOut(amount, balances, indexOut, curve, virtualSupply);

            // @dev Since this is an exit, we know the tokenIn is BPT. Since it is GivenIn, we know the BPT amount,
            // and must calculate the token amount out.
            // We are moving BPT out of circulation and into the Vault, which decreases the virtual supply.

            //        function _exitSwapExactBptInForTokenOut(
            //        uint256 bptAmount,
            //        uint256[] memory balances,
            //        uint256 indexOut,
            //        CustomMath.Curve memory curve,
            //        uint256 virtualSupply
            //        ) internal view returns (uint256, uint256) {
            uint256 amountOut = CustomMath.calcTokenOutGivenExactBptIn(
                curve,
                balances,
                indexOut,
                amount,
                virtualSupply,
                getSwapFeePercentage()
            );

            balances[indexOut] = balances[indexOut].sub(amountOut);
            uint256 postJoinExitSupply = virtualSupply.sub(amount);

            return (amountOut, postJoinExitSupply);

        } else {
            // return _exitSwapExactTokenOutForBptIn(amount, balances, indexOut, curve, virtualSupply);

            // @dev Since this is an exit, we know the tokenIn is BPT. Since it is GivenOut, we know the token amount out,
            // and must calculate the BPT amount in.
            // We are moving BPT out of circulation and into the Vault, which decreases the virtual supply.

            //        function _exitSwapExactTokenOutForBptIn(
            //        uint256 amountOut,
            //        uint256[] memory balances,
            //        uint256 indexOut,
            //        CustomMath.Curve memory curve,
            //        uint256 virtualSupply
            //        ) internal view returns (uint256, uint256) {
            // The CustomMath function was created with exits in mind, so it expects a full amounts array. We create an
            // empty one and only set the amount for the token involved.

            uint256[] memory amountsOut = new uint256[](balances.length);

            amountsOut[indexOut] = amount;

            uint256 bptAmount = CustomMath.calcBptInGivenExactTokensOut(curve, balances, amountsOut, virtualSupply, getSwapFeePercentage());

            balances[indexOut] = balances[indexOut].sub(amount);

            uint256 postJoinExitSupply = virtualSupply.sub(bptAmount);

            return (bptAmount, postJoinExitSupply);

        }
    }


    // Join Hooks

    /**
     * Since this Pool has preminted BPT which is stored in the Vault, it cannot simply be minted at construction.
     *
     * We take advantage of the fact that CustomPools have an initialization step where BPT is minted to the first
     * account joining them, and perform both actions at once. By minting the entire BPT supply for the initial joiner
     * and then pulling all tokens except those due the joiner, we arrive at the desired state of the Pool holding all
     * BPT except the joiner's.
     */
    function _onInitializePool(
        bytes32,
        address sender,
        address,
        uint256[] memory scalingFactors,
        bytes memory userData
    ) internal override returns (uint256, uint256[] memory) {
        CustomPoolUserData.JoinKind kind = userData.joinKind();
        _require(kind == CustomPoolUserData.JoinKind.INIT, Errors.UNINITIALIZED);

        // AmountsIn usually does not include the BPT token; initialization is the one time it has to.
        uint256[] memory amountsInIncludingBpt = userData.initialAmountsIn();
        InputHelpers.ensureInputLengthMatch(amountsInIncludingBpt.length, scalingFactors.length);
        _upscaleArray(amountsInIncludingBpt, scalingFactors);

        (uint256 amp1,) = _getAmplificationParameter1();
        (uint256 amp2,) = _getAmplificationParameter2();
        uint256[] memory amountsIn = _dropBptItem(amountsInIncludingBpt);
        (uint256 invariantAfterJoin1, uint256 invariantAfterJoin2) = CustomMath.calculateInvariants(amp1, amp2, amountsIn);

        // Set the initial BPT to the value of the invariant
        // TODO: we are using the first invariant. Could do the other.
        uint256 bptAmountOut = invariantAfterJoin1;

        // BasePool will mint bptAmountOut for the sender: we then also mint the remaining BPT to make up the total
        // supply, and have the Vault pull those tokens from the sender as part of the join.
        // We are only minting half of the maximum value - already an amount many orders of magnitude greater than any
        // conceivable real liquidity - to allow for minting new BPT as a result of regular joins.
        //
        // Note that the sender need not approve BPT for the Vault as the Vault already has infinite BPT allowance for
        // all accounts.
        uint256 initialBpt = _PREMINTED_TOKEN_BALANCE.sub(bptAmountOut);

        _mintPoolTokens(sender, initialBpt);
        amountsInIncludingBpt[getBptIndex()] = initialBpt;

        // Initialization is still a join, so we need to do post-join work.
        _updatePostJoinExit(CustomMath.Curve(amp1, invariantAfterJoin1, amp2, invariantAfterJoin2));

        return (bptAmountOut, amountsInIncludingBpt);
    }

    /**
     * @dev Base pool hook called from `onJoinPool`. Forward to `onJoinExitPool` with `isJoin` set to true.
     */
    function _onJoinPool(
        bytes32,
        address,
        address,
        uint256[] memory registeredBalances,
        uint256,
        uint256,
        uint256[] memory scalingFactors,
        bytes memory userData
    ) internal override returns (uint256, uint256[] memory) {
        //return _onJoinExitPool(true, registeredBalances, scalingFactors, userData);

        BeforeJoinExitReturn memory rets = _beforeJoinExit(registeredBalances);

        (uint256 bptAmount, uint256[] memory amountsDelta) = _doJoin(
            rets.curve,
            rets.balances,
            rets.preJoinExitSupply,
            scalingFactors,
            userData
        );

        // Unlike joinswaps, explicit joins do not mutate balances into the post join-exit balances so we must perform
        // this mutation here.
        _mutateAmounts(rets.balances, amountsDelta, FixedPoint.add);
        uint256 postJoinExitSupply = FixedPoint.add(rets.preJoinExitSupply, bptAmount);

        // Pass in the post-join balances to reset the protocol fee basis.
        // We are minting bptAmount, increasing the total (and virtual) supply post-join
        _updateInvariantAfterJoinExit(
            rets.curve,
            rets.balances,
            rets.preJoinExitSupply,
            postJoinExitSupply
        );

        // For clarity and simplicity, arrays used and computed in lower level functions do not include BPT.
        // But the amountsIn array passed back to the Vault must include BPT, so we add it back in here.
        return (bptAmount, _addBptItem(amountsDelta, 0));

    }

    /**
     * @dev Support single- and multi-token joins, but not explicit proportional joins.
     */

    function _doJoin(
        CustomMath.Curve memory curve,
        uint256[] memory balances,
        uint256 preJoinExitSupply,
        uint256[] memory scalingFactors,
        bytes memory userData
    ) internal view returns (uint256, uint256[] memory) {
        CustomPoolUserData.JoinKind kind = userData.joinKind();
        if (kind == CustomPoolUserData.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT) {

            // @dev Multi-token join. Joins with proportional amounts will pay no protocol fees.

            (uint256[] memory amountsIn, uint256 minBPTAmountOut) = userData.exactTokensInForBptOut();

            InputHelpers.ensureInputLengthMatch(balances.length, amountsIn.length);

            // The user-provided amountsIn is unscaled, so we address that.
            _upscaleArray(amountsIn, _dropBptItem(scalingFactors));

            uint256 bptAmountOut = CustomMath.calcBptOutGivenExactTokensIn(
                curve,
                balances,
                amountsIn,
                preJoinExitSupply, // = virtualSupply,
                getSwapFeePercentage()
            );

            _require(bptAmountOut >= minBPTAmountOut, Errors.BPT_OUT_MIN_AMOUNT);

            return (bptAmountOut, amountsIn);

            //return _joinExactTokensInForBPTOut(params, userData);

        } else if (kind == CustomPoolUserData.JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT) {

            // @dev Single-token join, equivalent to swapping a pool token for BPT.

            // Since this index is sent in from the user, we interpret it as NOT including the BPT token.
            (uint256 bptAmountOut, uint256 tokenIndex) = userData.tokenInForExactBptOut();
            // Note that there is no maximum amountIn parameter: this is handled by `IVault.joinPool`.

            // Balances are passed through from the Vault hook, and include BPT
            _require(tokenIndex < balances.length, Errors.OUT_OF_BOUNDS);

            // We join with a single token, so initialize amountsIn with zeros.
            uint256[] memory amountsIn = new uint256[](balances.length);

            // And then assign the result to the selected token.
            amountsIn[tokenIndex] = CustomMath.calcTokenInGivenExactBptOut(
                curve,
                balances,
                tokenIndex,
                bptAmountOut,
                preJoinExitSupply, // = virtualSupply,
                getSwapFeePercentage()
            );

            return (bptAmountOut, amountsIn);

            //  return _joinTokenInForExactBPTOut(params, userData);
        } else {
            _revert(Errors.UNHANDLED_JOIN_KIND);
            return (0, new uint256[](0));
        }
    }

    /**
     * @dev Base pool hook called from `onExitPool`. Forward to `onJoinExitPool` with `isJoin` set to false.
     * Note that recovery mode exits do not call `_onExitPool`.
     */
    function _onExitPool(
        bytes32,
        address,
        address,
        uint256[] memory registeredBalances,
        uint256,
        uint256,
        uint256[] memory scalingFactors,
        bytes memory userData
    ) internal override returns (uint256, uint256[] memory) {
        // return _onJoinExitPool(false, registeredBalances, scalingFactors, userData);
        // @dev Pay protocol fees before the operation, and call `_updateInvariantAfterJoinExit` afterward, to establish

        BeforeJoinExitReturn memory rets = _beforeJoinExit(registeredBalances);

        (uint256 bptAmount, uint256[] memory amountsDelta) = _doExit(
            rets.curve,
            rets.balances,
            rets.preJoinExitSupply,
            scalingFactors,
            userData
        );

        // Unlike joinswaps, explicit joins do not mutate balances into the post join-exit balances so we must perform
        // this mutation here.
        _mutateAmounts(rets.balances, amountsDelta, FixedPoint.sub);
        uint256 postJoinExitSupply = FixedPoint.sub(rets.preJoinExitSupply, bptAmount);

        // Pass in the post-join balances to reset the protocol fee basis.
        // We are minting bptAmount, increasing the total (and virtual) supply post-join
        _updateInvariantAfterJoinExit(
            rets.curve,
            rets.balances,
            rets.preJoinExitSupply,
            postJoinExitSupply
        );

        // For clarity and simplicity, arrays used and computed in lower level functions do not include BPT.
        // But the amountsIn array passed back to the Vault must include BPT, so we add it back in here.
        return (bptAmount, _addBptItem(amountsDelta, 0));

    }

    // Exit Hooks

    /**
     * @dev Support single- and multi-token exits, but not explicit proportional exits, which are
     * supported through Recovery Mode.
     */
    function _doExit(
        CustomMath.Curve memory curve,
        uint256[] memory balances,
        uint256 preJoinExitSupply,
        uint256[] memory scalingFactors,
        bytes memory userData
    ) internal view returns (uint256, uint256[] memory) {
        CustomPoolUserData.ExitKind kind = userData.exitKind();
        if (kind == CustomPoolUserData.ExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT) {

            // @dev Multi-token exit. Proportional exits will pay no protocol fees.

            (uint256[] memory amountsOut, uint256 maxBPTAmountIn) = userData.bptInForExactTokensOut();
            InputHelpers.ensureInputLengthMatch(amountsOut.length, balances.length);

            // The user-provided amountsIn is unscaled, so we address that.
            _upscaleArray(amountsOut, _dropBptItem(scalingFactors));

            uint256 bptAmountIn = CustomMath.calcBptInGivenExactTokensOut(
                curve,
                balances,
                amountsOut,
                preJoinExitSupply, // virtualSupply,
                getSwapFeePercentage()
            );

            _require(bptAmountIn <= maxBPTAmountIn, Errors.BPT_IN_MAX_AMOUNT);

            return (bptAmountIn, amountsOut);

            //  return _exitBPTInForExactTokensOut(params, userData);
        } else if (kind == CustomPoolUserData.ExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT) {

            // @dev Single-token exit, equivalent to swapping BPT for a pool token.

            // function _exitExactBPTInForTokenOut(DoJoinParams memory params, bytes memory userData) private view returns (uint256, uint256[] memory) {
            // Since this index is sent in from the user, we interpret it as NOT including the BPT token
            (uint256 bptAmountIn, uint256 tokenIndex) = userData.exactBptInForTokenOut();
            // Note that there is no minimum amountOut parameter: this is handled by `IVault.exitPool`.

            _require(tokenIndex < balances.length, Errors.OUT_OF_BOUNDS);

            // We exit in a single token, so initialize amountsOut with zeros
            uint256[] memory amountsOut = new uint256[](balances.length);

            // And then assign the result to the selected token.
            amountsOut[tokenIndex] = CustomMath.calcTokenOutGivenExactBptIn(
                curve,
                balances,
                tokenIndex,
                bptAmountIn,
                preJoinExitSupply, // = virtualSupply,
                getSwapFeePercentage()
            );

            return (bptAmountIn, amountsOut);

            // return _exitExactBPTInForTokenOut(params, userData);
        } else {
            _revert(Errors.UNHANDLED_EXIT_KIND);
            return (0, new uint256[](0));
        }
    }

    /**
     * @dev Pay any due protocol fees and calculate values necessary for performing the join/exit.
     */
    struct BeforeJoinExitReturn {
        uint256 preJoinExitSupply;
        uint256[] balances;
        CustomMath.Curve curve;
    }

    function _beforeJoinExit(uint256[] memory registeredBalances) internal returns (BeforeJoinExitReturn memory)
    {
        // last post re-balance curve
        CustomMath.Curve memory lastC = getLastJoinExitData();

        (
        uint256 preJoinExitSupply,
        uint256[] memory balances,
        uint256 curve,
        uint256 oldAmpPreJoinExitInvariant
        ) = _payProtocolFeesBeforeJoinExit(lastC, registeredBalances);

        // If the amplification factor is the same as it was during the last join/exit then we can reuse the
        // value calculated using the "old" amplification factor. If not, then we have to calculate this now.
        (uint256 currentA1,) = _getAmplificationParameter1();
        (uint256 currentA2,) = _getAmplificationParameter2();

        // regardless of which curve we are on we need to both invariants updated
        uint256 preJoinExitInvariant1;
        uint256 preJoinExitInvariant2;
        // TODO: use same calculateInvariant;
        if (curve == 1) {
            preJoinExitInvariant1 = (currentA1 == lastC.A1)
            ? oldAmpPreJoinExitInvariant
            : CustomMath.calculateInvariant(currentA1, currentA2, balances, 1);
            preJoinExitInvariant2 = CustomMath.calculateInvariant(currentA1, currentA2, balances, 2);
            // assert preJoinExitInvariant1 ==  CustomMath._calculateInvariant(currentAmp1, E);
        } else {
            preJoinExitInvariant2 = (currentA2 == lastC.A2)
            ? oldAmpPreJoinExitInvariant
            : CustomMath.calculateInvariant(currentA1, currentA2, balances, 2);
            preJoinExitInvariant1 = CustomMath.calculateInvariant(currentA1, currentA2, balances, 1);
        }

        return BeforeJoinExitReturn(
            preJoinExitSupply,
            balances,
            CustomMath.Curve(currentA1, preJoinExitInvariant1, currentA2, preJoinExitInvariant2)
        );
    }

    /**
     * @dev We cannot use the default RecoveryMode implementation here, since we need to account for the BPT token.
     */
    function _doRecoveryModeExit(
        uint256[] memory registeredBalances,
        uint256,
        bytes memory userData
    ) internal virtual override returns (uint256, uint256[] memory) {
        // Since this Pool uses preminted BPT, we need to replace the total supply with the virtual total supply, and
        // adjust the balances array by removing BPT from it.
        (uint256 virtualSupply, uint256[] memory balances) = _dropBptItemFromBalances(registeredBalances);

        (uint256 bptAmountIn, uint256[] memory amountsOut) = super._doRecoveryModeExit(
            balances,
            virtualSupply,
            userData
        );

        // The vault requires an array including BPT, so add it back in here.
        return (bptAmountIn, _addBptItem(amountsOut, 0));
    }

    // BPT rate

    /**
     * @dev This function returns the appreciation of one BPT relative to the
     * underlying tokens. This starts at 1 when the pool is created and grows over time.
     * Because of preminted BPT, it uses `getVirtualSupply` instead of `totalSupply`.
     */
    function getRate() public view virtual override returns (uint256) {
        (, uint256[] memory balancesIncludingBpt,) = getVault().getPoolTokens(getPoolId());
        _upscaleArray(balancesIncludingBpt, _scalingFactors());

        (uint256 virtualSupply, uint256[] memory balances) = _dropBptItemFromBalances(balancesIncludingBpt);

        (uint256 currentAmp1,) = _getAmplificationParameter1();
        (uint256 currentAmp2,) = _getAmplificationParameter2();

        return CustomMath.getRate(balances, currentAmp1, currentAmp2, virtualSupply);
    }

    // Helpers

    /**
     * @dev Mutates `amounts` by applying `mutation` with each entry in `arguments`.
     *
     * Equivalent to `amounts = amounts.map(mutation)`.
     */
    function _mutateAmounts(
        uint256[] memory toMutate,
        uint256[] memory arguments,
        function(uint256, uint256) pure returns (uint256) mutation
    ) private pure {
        uint256 length = toMutate.length;
        InputHelpers.ensureInputLengthMatch(length, arguments.length);

        for (uint256 i = 0; i < length; ++i) {
            toMutate[i] = mutation(toMutate[i], arguments[i]);
        }
    }

    // Permissioned functions

    /**
     * @dev Inheritance rules still require us to override this in the most derived contract, even though
     * it only calls super.
     */
    function _isOwnerOnlyAction(bytes32 actionId)
    internal
    view
    virtual
    override(
    // Our inheritance pattern creates a small diamond that requires explicitly listing the parents here.
    // Each parent calls the `super` version, so linearization ensures all implementations are called.
    BasePool,
    ComposableCustomPoolProtocolFees,
    CustomPoolAmplification,
    ComposableCustomPoolRates
    )
    returns (bool)
    {
        return super._isOwnerOnlyAction(actionId);
    }
}
