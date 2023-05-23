import {ethers} from "hardhat";

async function main() {

    const factory = await ethers.getContractFactory("TestToken");

    const address = "0x9F205c61DA8eE3be4805B15b003b4732603f3631";

    const contract = await factory.attach(address);

    const decimals = ethers.BigNumber.from(10).pow(18);

    const [deployer] = await ethers.getSigners();

    const tx = await contract.mint(deployer.address, decimals.mul(1_000_000));

    console.log(tx);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
