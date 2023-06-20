import {ethers, network} from "hardhat";

import {ComposableCustomPool} from "../typechain-types/ComposableCustomPool"
import {Signer} from "ethers";

import {TokenDeployer} from "../scripts/helpers/TokenDeployer";
import {TokenWrapper} from "../scripts/helpers/TokenWrapper";

import {VaultDeployer} from "../scripts/helpers/VaultDeployer";
import {VaultWrapper} from "../scripts/helpers/VaultWrapper";

import {PoolDeployer} from "../scripts/helpers/PoolDeployer";
import {PoolTrader} from "../scripts/helpers/PoolTrader";
import {PoolProvisioner} from "../scripts/helpers/PoolProvisioner";

const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
const poolAddress: string = "0xd8E51aC844e6309fffc532C9749B8F8458375c49";
const vaultAddress: string = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

function delay(ms: number) {
    console.log("sleep", ms, "ms")
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initPool() {

    // await network.provider.request({method: "hardhat_impersonateAccount", params: [signerAddress]});
    // const signer = await ethers.provider.getSigner(signerAddress);
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

    await vw.printTokens(poolId);

    await delay(1000);

    const pp = new PoolProvisioner(vault, pool);

    await pp.init(tokens, signer);

    await delay(1000);

    await vw.printTokens(poolId);

}

async function main() {

    await initPool();

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
