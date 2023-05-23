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

import "../ComposableCustomPoolProtocolFees.sol";

contract MockComposableCustomPoolProtocolFees is ComposableCustomPoolProtocolFees {
    constructor(
        IVault vault,
        IProtocolFeePercentagesProvider protocolFeeProvider,
        IERC20[] memory tokens,
        IRateProvider[] memory tokenRateProviders,
        uint256[] memory tokenRateCacheDurations,
        bool[] memory exemptFromYieldProtocolFeeFlags
    )
    ComposableCustomPoolStorage(
        StorageParams({
    registeredTokens : _insertSorted(tokens, IERC20(this)),
    tokenRateProviders : tokenRateProviders,
    exemptFromYieldProtocolFeeFlags : exemptFromYieldProtocolFeeFlags
    })
    )
    ComposableCustomPoolRates(
        RatesParams({
    tokens : tokens,
    rateProviders : tokenRateProviders,
    tokenRateCacheDurations : tokenRateCacheDurations
    })
    )
    ProtocolFeeCache(protocolFeeProvider, ProtocolFeeCache.DELEGATE_PROTOCOL_SWAP_FEES_SENTINEL)
    BasePool(
        vault,
        IVault.PoolSpecialization.GENERAL,
        "MockCustomPoolStorage",
        "MOCK_BPT",
        _insertSorted(tokens, IERC20(this)),
        new address[](tokens.length + 1),
        1e12, // BasePool._MIN_SWAP_FEE_PERCENTAGE
        0,
        0,
        address(0)
    )
    {
        // solhint-disable-previous-line no-empty-blocks
    }

    function payProtocolFeesBeforeJoinExit(
        uint256 lastJEA1,
        uint256 lastJED1,
        uint256 lastJEA2,
        uint256 lastJED2,
        uint256[] memory registeredBalances
    ) external returns (uint256 virtualSupply, uint256[] memory balances) {
        (virtualSupply, balances,,) = _payProtocolFeesBeforeJoinExit(
            CustomMath.Curve(lastJEA1, lastJED1, lastJEA2, lastJED2),
            registeredBalances
        );
        return (virtualSupply, balances);
    }

    function updateInvariantAfterJoinExit(
        uint256 lastJEA1,
        uint256 lastJED1,
        uint256 lastJEA2,
        uint256 lastJED2,
        uint256[] memory balances,
        uint256 preJoinExitSupply,
        uint256 postJoinExitSupply
    ) external {
        return _updateInvariantAfterJoinExit(
            CustomMath.Curve(lastJEA1, lastJED1, lastJEA2, lastJED2),
            balances,
            preJoinExitSupply,
            postJoinExitSupply
        );
    }

    function updatePostJoinExit(
        uint256 currentAmp1, uint256 postJoinExitInvariant1, uint256 currentAmp2, uint256 postJoinExitInvariant2
    ) external {
        _updatePostJoinExit(CustomMath.Curve(currentAmp1, postJoinExitInvariant1, currentAmp2, postJoinExitInvariant2));
    }

    function setTotalSupply(uint256 newSupply) external {
        _setTotalSupply(newSupply);
    }

    function getGrowthInvariants(uint256[] memory balances, uint256 lastPostJoinExitAmp1, uint256 lastPostJoinExitAmp2)
    external
    view
    returns (
        uint256 currentCurve,
        uint256 swapFeeGrowthInvariant,
        uint256 totalNonExemptGrowthInvariant,
        uint256 totalGrowthInvariant
    )
    {
        return _getGrowthInvariants(balances, lastPostJoinExitAmp1, lastPostJoinExitAmp2);
    }

    function getProtocolPoolOwnershipPercentage(
        uint256 lastJEA1,
        uint256 lastJED1,
        uint256 lastJEA2,
        uint256 lastJED2,
        uint256[] memory balances
    ) external view returns (uint256) {

        (uint256 percentage,,) = _getProtocolPoolOwnershipPercentage(
            CustomMath.Curve(lastJEA1, lastJED1, lastJEA2, lastJED2),
            balances
        );

        return percentage;
    }

    // Stubbed functions

    function _scalingFactors() internal view virtual override returns (uint256[] memory) {}

    function _onInitializePool(
        bytes32,
        address,
        address,
        uint256[] memory,
        bytes memory
    ) internal pure override returns (uint256, uint256[] memory) {
        revert("NOT_IMPLEMENTED");
    }

    function _onJoinPool(
        bytes32,
        address,
        address,
        uint256[] memory,
        uint256,
        uint256,
        uint256[] memory,
        bytes memory
    ) internal pure override returns (uint256, uint256[] memory) {
        revert("NOT_IMPLEMENTED");
    }

    function _onExitPool(
        bytes32,
        address,
        address,
        uint256[] memory,
        uint256,
        uint256,
        uint256[] memory,
        bytes memory
    ) internal pure override returns (uint256, uint256[] memory) {
        revert("NOT_IMPLEMENTED");
    }
}
