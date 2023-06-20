import {ethers} from "hardhat";

async function main() {
    const blockNumber1: number = 9015501
    const blockNumber2: number = 9092549; // number of the block you want to get timestamp of
    // number of the block you want to get timestamp of
    const provider = ethers.provider;
    let block = await provider.getBlock(blockNumber1);
    console.log(block.timestamp);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
