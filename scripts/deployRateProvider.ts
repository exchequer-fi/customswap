import {ethers} from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying address / bal ", deployer.address, (await deployer.getBalance()).toString());

    const factory = await ethers.getContractFactory("XCQRRateProvider");

    const contract = await factory.deploy();

    console.log("Rate Provider address:", contract.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
