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

import "./pool-utils/BasePoolAuthorization.sol";
import "./solidity-utils/helpers/WordCodec.sol";
import "./CustomMath.sol";
// import "hardhat/console.sol";

abstract contract CustomPoolAmplification is BasePoolAuthorization {
    using WordCodec for bytes32;

    // This contract uses timestamps to slowly update its Amplification parameter over time. These changes must occur
    // over a minimum time period much larger than the blocktime, making timestamp manipulation a non-issue.
    // solhint-disable not-rely-on-time

    // Amplification factor changes must happen over a minimum period of one day, and can at most divide or multiply the
    // current value by 2 every day.
    // WARNING: this only limits *a single* amplification change to have a maximum rate of change of twice the original
    // value daily. It is possible to perform multiple amplification changes in sequence to increase this value more
    // rapidly: for example, by doubling the value every day it can increase by a factor of 8 over three days (2^3).
    uint256 private constant _MIN_UPDATE_TIME = 1 days;
    uint256 private constant _MAX_AMP_UPDATE_DAILY_RATE = 2;

    // The amplification data structure is as follows:
    // [  64 bits |   64 bits  |  64 bits  |   64 bits   ]
    // [ end time | start time | end value | start value ]
    // |MSB                                           LSB|

    uint256 private constant _AMP_START_VALUE_OFFSET = 0;
    uint256 private constant _AMP_END_VALUE_OFFSET = 64;
    uint256 private constant _AMP_START_TIME_OFFSET = 128;
    uint256 private constant _AMP_END_TIME_OFFSET = 192;

    uint256 private constant _AMP_VALUE_BIT_LENGTH = 64;
    uint256 private constant _AMP_TIMESTAMP_BIT_LENGTH = 64;

    bytes32 private _packedAmplification1Data;
    bytes32 private _packedAmplification2Data;

    event Amp1UpdateStarted(uint256 startValue, uint256 endValue, uint256 startTime, uint256 endTime);
    event Amp1UpdateStopped(uint256 currentValue);

    event Amp2UpdateStarted(uint256 startValue, uint256 endValue, uint256 startTime, uint256 endTime);
    event Amp2UpdateStopped(uint256 currentValue);

    constructor(uint256 amplificationParameter1, uint256 amplificationParameter2) {
        _require(amplificationParameter1 >= CustomMath._MIN_AMP, Errors.MIN_AMP);
        _require(amplificationParameter1 <= CustomMath._MAX_AMP, Errors.MAX_AMP);

        _require(amplificationParameter2 >= CustomMath._MIN_AMP, Errors.MIN_AMP);
        _require(amplificationParameter2 <= CustomMath._MAX_AMP, Errors.MAX_AMP);

        uint256 initialAmp1 = Math.mul(amplificationParameter1, CustomMath._AMP_PRECISION);
        uint256 initialAmp2 = Math.mul(amplificationParameter2, CustomMath._AMP_PRECISION);

        _setAmplification1Data(initialAmp1);
        _setAmplification2Data(initialAmp2);
    }

    function getAmplificationParameter1() external view returns (uint256 value1, bool isUpdating1, uint256 precision1)
    {
        (value1, isUpdating1) = _getAmplificationParameter1();
        precision1 = CustomMath._AMP_PRECISION;
        // console.log(value1,isUpdating1,precision1);
    }

    function getAmplificationParameter2() external view returns (uint256 value2, bool isUpdating2, uint256 precision2)
    {
        (value2, isUpdating2) = _getAmplificationParameter2();
        precision2 = CustomMath._AMP_PRECISION;
    }

    // Return the current amp value, which will be an interpolation if there is an ongoing amp update.
    // Also return a flag indicating whether there is an ongoing update.
    function _getAmplificationParameter1() internal view returns (uint256 value, bool isUpdating) {
        (uint256 startValue, uint256 endValue, uint256 startTime, uint256 endTime) = _getAmplification1Data();

        // Note that block.timestamp >= startTime, since startTime is set to the current time when an update starts

        if (block.timestamp < endTime) {
            isUpdating = true;

            // We can skip checked arithmetic as:
            //  - block.timestamp is always larger or equal to startTime
            //  - endTime is always larger than startTime
            //  - the value delta is bounded by the largest amplification parameter, which never causes the
            //    multiplication to overflow.
            // This also means that the following computation will never revert nor yield invalid results.
            if (endValue > startValue) {
                value = startValue + ((endValue - startValue) * (block.timestamp - startTime)) / (endTime - startTime);
            } else {
                value = startValue - ((startValue - endValue) * (block.timestamp - startTime)) / (endTime - startTime);
            }
        } else {
            isUpdating = false;
            value = endValue;
        }
    }

    function _getAmplificationParameter2() internal view returns (uint256 value, bool isUpdating) {
        (uint256 startValue, uint256 endValue, uint256 startTime, uint256 endTime) = _getAmplification2Data();

        // Note that block.timestamp >= startTime, since startTime is set to the current time when an update starts

        if (block.timestamp < endTime) {
            isUpdating = true;

            // We can skip checked arithmetic as:
            //  - block.timestamp is always larger or equal to startTime
            //  - endTime is always larger than startTime
            //  - the value delta is bounded by the largest amplification parameter, which never causes the
            //    multiplication to overflow.
            // This also means that the following computation will never revert nor yield invalid results.
            if (endValue > startValue) {
                value = startValue + ((endValue - startValue) * (block.timestamp - startTime)) / (endTime - startTime);
            } else {
                value = startValue - ((startValue - endValue) * (block.timestamp - startTime)) / (endTime - startTime);
            }
        } else {
            isUpdating = false;
            value = endValue;
        }
    }

    // Unpack and return all amplification-related parameters.
    function _getAmplification1Data()
        private
        view
        returns (
            uint256 startValue,
            uint256 endValue,
            uint256 startTime,
            uint256 endTime
        )
    {
        startValue = _packedAmplification1Data.decodeUint(_AMP_START_VALUE_OFFSET, _AMP_VALUE_BIT_LENGTH);
        endValue = _packedAmplification1Data.decodeUint(_AMP_END_VALUE_OFFSET, _AMP_VALUE_BIT_LENGTH);
        startTime = _packedAmplification1Data.decodeUint(_AMP_START_TIME_OFFSET, _AMP_TIMESTAMP_BIT_LENGTH);
        endTime = _packedAmplification1Data.decodeUint(_AMP_END_TIME_OFFSET, _AMP_TIMESTAMP_BIT_LENGTH);
        // console.log("get A1", startTime, endTime, endValue);
    }

    function _getAmplification2Data()
        private
        view
        returns (
            uint256 startValue,
            uint256 endValue,
            uint256 startTime,
            uint256 endTime
        )
    {
        startValue = _packedAmplification2Data.decodeUint(_AMP_START_VALUE_OFFSET, _AMP_VALUE_BIT_LENGTH);
        endValue = _packedAmplification2Data.decodeUint(_AMP_END_VALUE_OFFSET, _AMP_VALUE_BIT_LENGTH);
        startTime = _packedAmplification2Data.decodeUint(_AMP_START_TIME_OFFSET, _AMP_TIMESTAMP_BIT_LENGTH);
        endTime = _packedAmplification2Data.decodeUint(_AMP_END_TIME_OFFSET, _AMP_TIMESTAMP_BIT_LENGTH);
        // console.log("get A2", startTime, endTime, endValue);
    }

    /**
     * @dev Begin changing the amplification parameter to `rawEndValue` over time. The value will change linearly until
     * `endTime` is reached, when it will be `rawEndValue`.
     *
     * NOTE: Internally, the amplification parameter is represented using higher precision. The values returned by
     * `getAmplificationParameter` have to be corrected to account for this when comparing to `rawEndValue`.
     */
    function startAmplificationParameter1Update(uint256 rawEndValue, uint256 endTime) external authenticate {
        // console.log("startA1:", rawEndValue, endTime);
        _require(rawEndValue >= CustomMath._MIN_AMP, Errors.MIN_AMP);
        _require(rawEndValue <= CustomMath._MAX_AMP, Errors.MAX_AMP);

        uint256 duration = Math.sub(endTime, block.timestamp);
        _require(duration >= _MIN_UPDATE_TIME, Errors.AMP_END_TIME_TOO_CLOSE);

        (uint256 currentValue, bool isUpdating) = _getAmplificationParameter1();
        _require(!isUpdating, Errors.AMP_ONGOING_UPDATE);

        uint256 endValue = Math.mul(rawEndValue, CustomMath._AMP_PRECISION);

        // daily rate = (endValue / currentValue) / duration * 1 day
        // We perform all multiplications first to not reduce precision, and round the division up as we want to avoid
        // large rates. Note that these are regular integer multiplications and divisions, not fixed point.
        uint256 dailyRate = endValue > currentValue
            ? Math.divUp(Math.mul(1 days, endValue), Math.mul(currentValue, duration))
            : Math.divUp(Math.mul(1 days, currentValue), Math.mul(endValue, duration));
        _require(dailyRate <= _MAX_AMP_UPDATE_DAILY_RATE, Errors.AMP_RATE_TOO_HIGH);

        _setAmplification1Data(currentValue, endValue, block.timestamp, endTime);
    }

    function startAmplificationParameter2Update(uint256 rawEndValue, uint256 endTime) external authenticate {
        // console.log("startA2:", rawEndValue, endTime);
        _require(rawEndValue >= CustomMath._MIN_AMP, Errors.MIN_AMP);
        _require(rawEndValue <= CustomMath._MAX_AMP, Errors.MAX_AMP);

        uint256 duration = Math.sub(endTime, block.timestamp);
        _require(duration >= _MIN_UPDATE_TIME, Errors.AMP_END_TIME_TOO_CLOSE);

        (uint256 currentValue, bool isUpdating) = _getAmplificationParameter2();
        _require(!isUpdating, Errors.AMP_ONGOING_UPDATE);

        uint256 endValue = Math.mul(rawEndValue, CustomMath._AMP_PRECISION);

        // daily rate = (endValue / currentValue) / duration * 1 day
        // We perform all multiplications first to not reduce precision, and round the division up as we want to avoid
        // large rates. Note that these are regular integer multiplications and divisions, not fixed point.
        uint256 dailyRate = endValue > currentValue
            ? Math.divUp(Math.mul(1 days, endValue), Math.mul(currentValue, duration))
            : Math.divUp(Math.mul(1 days, currentValue), Math.mul(endValue, duration));
        _require(dailyRate <= _MAX_AMP_UPDATE_DAILY_RATE, Errors.AMP_RATE_TOO_HIGH);

        _setAmplification2Data(currentValue, endValue, block.timestamp, endTime);
    }

    /**
     * @dev Stops the amplification parameter change process, keeping the current value.
     */
    function stopAmplificationParameter1Update() external authenticate {
        (uint256 currentValue, bool isUpdating) = _getAmplificationParameter1();
        _require(isUpdating, Errors.AMP_NO_ONGOING_UPDATE);

        _setAmplification1Data(currentValue);
    }

    function stopAmplificationParameter2Update() external authenticate {
        (uint256 currentValue, bool isUpdating) = _getAmplificationParameter2();
        _require(isUpdating, Errors.AMP_NO_ONGOING_UPDATE);

        _setAmplification2Data(currentValue);
    }

    function _setAmplification1Data(uint256 value) private {
        _storeAmplification1Data(value, value, block.timestamp, block.timestamp);
        emit Amp1UpdateStopped(value);
    }

    function _setAmplification2Data(uint256 value) private {
        _storeAmplification2Data(value, value, block.timestamp, block.timestamp);
        emit Amp2UpdateStopped(value);
    }

    function _setAmplification1Data(uint256 startValue, uint256 endValue, uint256 startTime, uint256 endTime) private {
        _storeAmplification1Data(startValue, endValue, startTime, endTime);
        emit Amp1UpdateStarted(startValue, endValue, startTime, endTime);
    }

    function _setAmplification2Data(uint256 startValue, uint256 endValue, uint256 startTime, uint256 endTime) private {
        _storeAmplification2Data(startValue, endValue, startTime, endTime);
        emit Amp2UpdateStarted(startValue, endValue, startTime, endTime);
    }

    function _storeAmplification1Data(
        uint256 startValue,
        uint256 endValue,
        uint256 startTime,
        uint256 endTime
    ) private {
        _packedAmplification1Data =
            WordCodec.encodeUint(startValue, _AMP_START_VALUE_OFFSET, _AMP_VALUE_BIT_LENGTH) |
            WordCodec.encodeUint(endValue, _AMP_END_VALUE_OFFSET, _AMP_VALUE_BIT_LENGTH) |
            WordCodec.encodeUint(startTime, _AMP_START_TIME_OFFSET, _AMP_TIMESTAMP_BIT_LENGTH) |
            WordCodec.encodeUint(endTime, _AMP_END_TIME_OFFSET, _AMP_TIMESTAMP_BIT_LENGTH);
    }
    function _storeAmplification2Data(
        uint256 startValue,
        uint256 endValue,
        uint256 startTime,
        uint256 endTime
    ) private {
        _packedAmplification2Data =
            WordCodec.encodeUint(startValue, _AMP_START_VALUE_OFFSET, _AMP_VALUE_BIT_LENGTH) |
            WordCodec.encodeUint(endValue, _AMP_END_VALUE_OFFSET, _AMP_VALUE_BIT_LENGTH) |
            WordCodec.encodeUint(startTime, _AMP_START_TIME_OFFSET, _AMP_TIMESTAMP_BIT_LENGTH) |
            WordCodec.encodeUint(endTime, _AMP_END_TIME_OFFSET, _AMP_TIMESTAMP_BIT_LENGTH);
    }

    // Permissioned functions

    /**
     * @dev Overrides only owner action to allow setting the cache duration for the token rates
     */
    function _isOwnerOnlyAction(bytes32 actionId) internal view virtual override returns (bool) {
        return
            (actionId == getActionId(this.startAmplificationParameter1Update.selector)) ||
            (actionId == getActionId(this.stopAmplificationParameter1Update.selector)) ||
            (actionId == getActionId(this.startAmplificationParameter2Update.selector)) ||
            (actionId == getActionId(this.stopAmplificationParameter2Update.selector));
    }
}
