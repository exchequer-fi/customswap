require('dotenv').config();

const API_KEY = process.env.ALCHEMY_API_KEY;
const API_URL = `https://eth-goerli.g.alchemy.com/v2/${API_KEY}`;
const PRIVATE_KEY = process.env.GOERLI_PK;
const CONTRACT_ADDRESS = `0x5C19e84230344518dFB1F38e6D8002F77E730C9d`;

const contract = require("../artifacts/contracts/rate-provider/XCQRRateProvider.sol/XCQRRateProvider.json");
const hre = require("hardhat");

//console.log(JSON.stringify(contract.abi));

// Provider
const alchemyProvider = new hre.ethers.providers.AlchemyProvider(network = "goerli", API_KEY);

// Signer
const signer = new hre.ethers.Wallet(PRIVATE_KEY, alchemyProvider);

// Contract
const rp = new hre.ethers.Contract(CONTRACT_ADDRESS, contract.abi, signer);

async function main() {
    const decimals = hre.ethers.BigNumber.from(10).pow(18);

    let r = await rp.getRate();
    console.log("the current rate is " + r.div(decimals));

    console.log("updating the rate");
    let newRate;
    if (r.eq(decimals)) {
        newRate = hre.ethers.BigNumber.from(10).mul(decimals);
    } else {
        newRate = hre.ethers.BigNumber.from(1).mul(decimals);
    }
    const tx = await rp.setRate(newRate);
    await tx.wait();

    r = await rp.getRate();
    console.log("the new rate is " + r.div(decimals));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });