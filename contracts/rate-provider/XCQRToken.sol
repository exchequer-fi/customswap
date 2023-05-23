// SPDX-License-Identifier: MIT

// Solidity files have to start with this pragma.
// It will be used by the Solidity compiler to validate its version.

pragma solidity ^0.7.0;

import "../solidity-utils/openzeppelin/ERC20.sol";

contract XCQRToken is ERC20 {
    // constructor() ERC20("XCQR Test Token", "XTT", 1000000 * 10 ** 18) {
    constructor() ERC20("XCQR Test Token", "XTT") {
    }
}