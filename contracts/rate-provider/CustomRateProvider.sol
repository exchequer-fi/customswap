// SPDX-License-Identifier: MIT

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
import "../interfaces/pool-utils/IRateProvider.sol";

contract CustomPoolRateProvider is IRateProvider {
    uint256 internal constant ONE = 1e18; // 18 decimal places
    uint256 internal _rate;

    event ValueChanged(uint256 newValue);

    constructor() {
        _rate = ONE;
    }

    function getRate() external view override returns (uint256) {
        return _rate;
    }

    function setRate(uint256 newRate) external {
        _rate = newRate;
        emit ValueChanged(newRate);
    }
}
