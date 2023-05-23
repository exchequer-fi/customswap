require('dotenv').config();
const hre = require("hardhat");

const API_KEY = process.env.ALCHEMY_API_KEY;
const PRIVATE_KEY = process.env.GOERLI_PK;

const RATE_PROVIDER_ADDRESS = `0x5C19e84230344518dFB1F38e6D8002F77E730C9d`;
const FACTORY_ADDRESS = `0xe73E7497397141e7be019d08b0f47Ae7eDD3BB2f`;

const contract = require("../artifacts/contracts/ComposableCustomPoolFactory.sol/ComposableCustomPoolFactory.json");

// Provider
const provider = new hre.ethers.providers.AlchemyProvider(network = "goerli", API_KEY);

// Signer
const signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);

// Contract
const factory = new hre.ethers.Contract(RATE_PROVIDER_ADDRESS, contract.abi, signer);

async function main() {

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });