const {BigNumber} = require("ethers");

let MONTH = 30 * 24 * 60 * 60;
let fee = BigNumber.from(10).pow(16);

module.exports = [
    {
        vault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // IVault vault;
        protocolFeeProvider: "0x0F3e0c4218b7b0108a3643cFe9D3ec0d4F57c54e", // IProtocolFeePercentagesProvider protocolFeeProvider;
        name: "XCQR CustomSwap XCR/USDC", // string name;
        symbol: "csXD2", // string symbol;
        tokens: ["0x9F205c61DA8eE3be4805B15b003b4732603f3631", "0xD87Ba7A50B2E7E660f678A895E4B72E7CB4CCd9C"], // IERC20[] tokens;
        rateProviders: ["0x5C19e84230344518dFB1F38e6D8002F77E730C9d", "0xC2B0fc4F1A12566E680648832857FDBD48e09E92"], // IRateProvider[] rateProviders;
        tokenRateCacheDurations: [MONTH, MONTH], // uint256[] tokenRateCacheDurations;
        exemptFromYieldProtocolFeeFlags: [false, false], // bool[] exemptFromYieldProtocolFeeFlags;
        amplificationParameter1: 450, // uint256 amplificationParameter1;
        amplificationParameter2: 50, // uint256 amplificationParameter2;
        swapFeePercentage: fee, // uint256 swapFeePercentage;
        pauseWindowDuration: 6343596, // uint256 pauseWindowDuration; 3 months
        bufferPeriodDuration: MONTH, // uint256 bufferPeriodDuration; 1 month
        owner: "0xd713Eef55104c67cA1A6a1dB617FaeE1831cF5e3"// address owner
    }
];
