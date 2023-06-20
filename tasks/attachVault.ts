import {ethers} from "hardhat";

async function getVault() {
    const address = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const factory = await ethers.getContractFactory("Vault");
    const contract = await factory.attach(address)
    return contract.deployed();
}

async function main() {

    const poolId = "0x713ce2d8e4ddd756f35620c4b48ca5f6558ef0800000000000000000000007ea";
    const vault = await getVault();
    console.log("pool: ", await vault.getPool(poolId));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
