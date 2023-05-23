import {ethers} from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("signer address: %s bal: %d", deployer.address, (await deployer.getBalance()).toString());

    const factory = await ethers.getContractFactory("CustomMath");

    const contract = await factory.deploy();

    console.log("StableMath address:", contract.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
