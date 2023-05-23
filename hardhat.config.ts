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
                version: '0.7.1',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 9999
                    }
                }
            }
        ],
        overrides: {
            'contracts/ComposableCustomPool.sol': {
                version: '0.7.1',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            'contracts/MockComposableCustomPool.sol': {
                version: "0.7.1",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            'contracts/vault/Vault.sol': {
                version: "0.7.1",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 500,
                    },
                },
            },
        }
    },
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545"
        },
        hardhat: {
            chainId: 1337 // We set 1337 to make interacting with MetaMask simpler
        }
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: false,
    },
};

export default config;
