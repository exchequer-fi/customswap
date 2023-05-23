// import config before anything else
import "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";

import {HardhatUserConfig} from "hardhat/config";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PK
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.7.1",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            }
        ]
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: false,
    },
};

export default config;
