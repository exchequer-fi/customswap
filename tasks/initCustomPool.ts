import {ethers, network} from "hardhat";

import {ComposableCustomPool} from "../typechain-types/ComposableCustomPool"
import {Signer} from "ethers";

import {TokenDeployer} from "../scripts/helpers/TokenDeployer";
import {TokenWrapper} from "../scripts/helpers/TokenWrapper";

import {VaultDeployer} from "../scripts/helpers/VaultDeployer";
import {VaultWrapper} from "../scripts/helpers/VaultWrapper";

import {PoolDeployer} from "../scripts/helpers/PoolDeployer";
import {PoolWrapper} from "../scripts/helpers/PoolWrapper";


const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
const xchrAddress: string = '0x9F205c61DA8eE3be4805B15b003b4732603f3631';
const usdcAddress: string = '0xD87Ba7A50B2E7E660f678A895E4B72E7CB4CCd9C';
const poolAddress0: string = "0x713CE2D8E4Ddd756F35620C4B48Ca5F6558EF080";
const poolAddress: string = "0x0167Cf094f922e2Bc71f4935778a618d555d3735";
const vaultAddress: string = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const signerAddress: string = "0xd713Eef55104c67cA1A6a1dB617FaeE1831cF5e3";

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

    const pw = new PoolWrapper(vault, pool);

    await delay(1000);

    const poolId = await pool.getPoolId();

    await delay(1000);

    const tokens = await vw.getTokens(poolId);

    await delay(1000);

    await vw.printTokens(poolId);

    await delay(1000);

    await pw.init(tokens, signer);

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
