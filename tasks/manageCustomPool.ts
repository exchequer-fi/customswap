import {ethers} from "hardhat";
import {VaultDeployer} from "../scripts/helpers/VaultDeployer";
import {VaultWrapper} from "../scripts/helpers/VaultWrapper";

import {PoolDeployer} from "../scripts/helpers/PoolDeployer";
import {delay} from "../scripts/helpers/TimeMachine";

async function main() {

    const vaultAddress: string = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
    const poolAddress: string = "0xCd30aEB2402De66c8feF819E828EbaaA5B0D67a0";

    const [signer] = await ethers.getSigners();

    console.log(await signer.getAddress());

    await delay(1000);

    const vault = await VaultDeployer.connect(vaultAddress, signer);

    await delay(1000);

    const vw = new VaultWrapper(vault);

    await delay(1000);

    const pool = await PoolDeployer.connect(poolAddress, libraryAddress, signer);

    await delay(1000);

    await delay(1000);

    const poolId = await pool.getPoolId();

    await delay(1000);

    const tokens = await vw.getTokens(poolId);

    await delay(1000);

    {
        const {value1, isUpdating1, precision1} = await pool.getAmplificationParameter1();
        console.log("A1: ", value1, isUpdating1, precision1);
        const {value2, isUpdating2, precision2} = await pool.getAmplificationParameter2();
        console.log("A2: ", value2, isUpdating2, precision2);
    }

    //await pool.stopAmplificationParameter1Update();
    await pool.stopAmplificationParameter2Update();

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
