import hre, {ethers} from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("signer address: %s bal: %d", deployer.address, (await deployer.getBalance()).toString());

    const factory = await ethers.getContractFactory("TestToken");

    const decimals = hre.ethers.BigNumber.from(10).pow(18);

    const contract = await factory.deploy("Exchequer Test Token", "XCR", 18);

    console.log("XCR token address:", contract.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
