// import config before anything else
import dotenv from "dotenv"

dotenv.config()

const GOERLI_API_KEY: string = process.env.GOERLI_API_KEY!;
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY!;

const SEPOLIA_API_KEY: string = process.env.SEPOLIA_API_KEY!;
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY!;

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY!;

export const hardhatNetworkConfig = {
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545",
            // allowUnlimitedContractSize: true,
            // throwOnTransactionFailures: true,
            // throwOnCallFailures: true,
            // gas: 12000000,
            // blockGasLimit: 0x1fffffffffffff,
            // timeout: 1800000
        },
        hardhat: {
            chainId: 1337, // We set 1337 to make interacting with MetaMask simpler
            // throwOnTransactionFailures: true,
            // throwOnCallFailures: true,
            // allowUnlimitedContractSize: true,
            // gas: 12000000,
            // blockGasLimit: 0x1fffffffffffff,
            // timeout: 1800000
        },
        goerli: {
            chainId: 5,
            url: `https://eth-goerli.g.alchemy.com/v2/${GOERLI_API_KEY}`,
            accounts: [GOERLI_PRIVATE_KEY],
            // gasPrice: 10_000_000_000
        },
        sepolia: {
            chainId: 11155111,
            url: `https://eth-sepolia.g.alchemy.com/v2/${SEPOLIA_API_KEY}`,
            accounts: [SEPOLIA_PRIVATE_KEY],
            // gasPrice: 10_000_000_000
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY
    }
};
