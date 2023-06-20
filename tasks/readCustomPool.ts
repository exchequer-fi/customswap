import {ethers} from "hardhat";

import {VaultWrapper} from "../scripts/helpers/VaultWrapper";
import {VaultDeployer} from "../scripts/helpers/VaultDeployer";
import {PoolReader} from "../scripts/helpers/PoolReader";

const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
const vaultAddress: string = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const poolAddress: string = "0x80ef10F7CF08dc34Aa213c494cbE7521F7133b73";

async function getPool() {

    const factory = await ethers.getContractFactory("ComposableCustomPool", {
        libraries: {
            CustomMath: libraryAddress
        }
    });

    const pool = await factory.attach(poolAddress);
    return pool.deployed();
}

async function main() {

    let [signer,] = await ethers.getSigners();

    const pool = await getPool();

    await new PoolReader(pool).read();

    const poolId = await pool.getPoolId();

    const vault = await VaultDeployer.connect(vaultAddress, signer);

    const vw = new VaultWrapper(vault);

    await vw.printTokens(poolId);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
