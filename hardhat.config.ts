// import config before anything else
import dotenv from "dotenv"
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
import {HardhatUserConfig} from "hardhat/config";

dotenv.config()

const INFURA_API_KEY = process.env.INFURA_API_KEY!;

const GOERLI_API_KEY: string = process.env.GOERLI_API_KEY!;
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY!;

const SEPOLIA_API_KEY: string = process.env.SEPOLIA_API_KEY!;
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY!;

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY!;

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
        },
        goerli_alchemy: {
            chainId: 5,
            url: `https://eth-goerli.g.alchemy.com/v2/${GOERLI_API_KEY}`,
            accounts: [GOERLI_PRIVATE_KEY],
            gasPrice: 10_000_000_000
        },
        goerli_infura: {
            chainId: 5,
            url: `https://goerli.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [GOERLI_PRIVATE_KEY],
            gasPrice: 10_000_000_000
        },
        sepolia: {
            // chainId: 11155111,
            url: `https://eth-sepolia.g.alchemy.com/v2/${SEPOLIA_API_KEY}`,
            // url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [SEPOLIA_PRIVATE_KEY],
            gasPrice: 10_000_000_000
        },
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
