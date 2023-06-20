import {ethers, network} from "hardhat";
import {BigNumber, Signer} from "ethers";

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import {scaleDn, scaleUp} from "../scripts/helpers/biggy";

import {TokenDeployer} from "../scripts/helpers/TokenDeployer";
import {TokenWrapper} from "../scripts/helpers/TokenWrapper";

import {VaultDeployer} from "../scripts/helpers/VaultDeployer";
import {VaultWrapper} from "../scripts/helpers/VaultWrapper";

import {PoolDeployer} from "../scripts/helpers/PoolDeployer";
import {PoolTrader} from "../scripts/helpers/PoolTrader";


import {TestToken} from "../typechain-types/solidity-utils/test/TestToken"
import {ComposableCustomPool} from "../typechain-types/ComposableCustomPool"
import {Vault} from "../typechain-types/vault/Vault"
import {PoolProvisioner} from "../scripts/helpers/PoolProvisioner";
import {delay} from "../scripts/helpers/TimeMachine";

function line(msg: string) {
    console.log("---", msg, "---------------------------------");
}

async function provideLiquidity(vault: Vault, pool: ComposableCustomPool, admin: Signer, lp: Signer) {

    const vw = new VaultWrapper(vault);
    const pw = new PoolProvisioner(vault, pool);
    const poolId = await pool.getPoolId();
    const tokens = await vw.getTokens(poolId);
    const lpAddress = await lp.getAddress();
    {
        line("JOINT EXACT TKN IN begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lpAddress);
        await pw.joinExactTokensIn(tokens, lp);
        console.log("join");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lpAddress);
        line("JOIN EXACT TKN IN end");
    }
    await delay(2000);

    {
        line("EXIT EXACT TKN OUT begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lpAddress);
        await pw.exitExactTokensOut(tokens, lp);
        console.log("exit");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lpAddress);
        line("EXIT EXACT TKN OUT end");
    }
    await delay(2000);

    {
        line("JOIN EXACT BPT OUT begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lpAddress);
        await pw.joinExactBPTOut(tokens, lp);
        console.log("join");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lpAddress);
        line("JOIN EXACT BPT end");
    }
    await delay(2000);
    {
        line("EXIT EXACT BPT IN begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lpAddress);
        await pw.exitExactBPTIn(tokens, lp);
        console.log("exit");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lpAddress);
        line("EXIT EXACT BPT end");
    }

}

async function printSwap(tokenIn: TestToken, amountIn: BigNumber, tokenOut: TestToken, amountOut: BigNumber) {
    const aIn = scaleDn(amountIn, await tokenIn.decimals());
    const aOut = scaleDn(amountOut, await tokenOut.decimals());
    const symIn = await tokenIn.symbol();
    let price;
    if (symIn == "USDC") {
        price = aIn / aOut;
    } else {
        price = aOut / aIn;
    }
    console.log("price:", Math.abs(price), "in", aIn, "out", aOut);
}

async function swapTokens(vault: Vault, pool: ComposableCustomPool, usdc: TestToken, xcqr: TestToken, trader: SignerWithAddress) {

    const vw = new VaultWrapper(vault);
    const pt = new PoolTrader(vault, pool);
    const poolId = await pool.getPoolId();

    if (true) {
        line("BUY 100 XCHR");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountOut = scaleUp(100, 18);
        //const expectedAmountIn = await pt.queryGivenOut(usdc, xcqr, actualAmountOut, trader);
        const actualAmountIn = await pt.swapGivenOut(usdc, xcqr, actualAmountOut, trader);

        await printSwap(usdc, actualAmountIn, xcqr, actualAmountOut);
        //console.log("expected USDC", +expectedAmountIn.toString());
        //console.log("actual   USDC", +actualAmountIn.toString());

        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
    }
    await delay(2000);

    if (true) {
        line("SELL 100 XCHR");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountIn = scaleUp(100, 18);
        //const expectedAmountOut = await pt.queryGivenIn(xcqr, usdc, actualAmountIn, trader);
        const actualAmountOut = await pt.swapGivenIn(xcqr, usdc, actualAmountIn, trader);

        await printSwap(xcqr, actualAmountIn, usdc, actualAmountOut);
        //console.log("expected USDC", -expectedAmountOut.toString());
        //console.log("actual   USDC", +actualAmountOut.toString());

        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
    }
    await delay(2000);

    if (true) {
        line("SELL 100 USDC");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountIn = scaleUp(100, 6);
        //const expectedAmountOut = await pt.queryGivenIn(usdc, xcqr, actualAmountIn, trader);
        const actualAmountOut = await pt.swapGivenIn(usdc, xcqr, actualAmountIn, trader);

        await printSwap(usdc, actualAmountIn, xcqr, actualAmountOut);
        //console.log("expected XCHR", -expectedAmountOut.toString());
        //console.log("actual   XCHR", +actualAmountOut.toString());

        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
    }

    await delay(2000);

    if (true) {
        line("BUY 100 USDC");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountOut = scaleUp(100, 6);
        //const expectedAmountIn = await pt.queryGivenOut(xcqr, usdc, actualAmountOut, trader);
        const actualAmountIn = await pt.swapGivenOut(xcqr, usdc, actualAmountOut, trader);

        await printSwap(xcqr, actualAmountIn, usdc, actualAmountOut);
        //console.log("expected XCHR", +expectedAmountIn.toString())
        //console.log("actual   XCHR", +actualAmountIn.toString())

        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
    }

}

async function swapRoundTrip(vault: Vault, pool: ComposableCustomPool, usdc: TestToken, xcqr: TestToken, trader: SignerWithAddress) {

    const vw = new VaultWrapper(vault);
    const pt = new PoolTrader(vault, pool);
    const poolId = await pool.getPoolId();

    const qty = 900;

    {
        line("BUY 10 XCHR");
        await vw.printTokens(poolId);
        //await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountOut = scaleUp(qty, 18);
        const actualAmountIn = await pt.swapGivenOut(usdc, xcqr, actualAmountOut, trader);

        await printSwap(usdc, actualAmountIn, xcqr, actualAmountOut);

        await vw.printTokens(poolId);
        //await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        {
            console.log("spot");
            const aout = scaleUp(1, 15);
            const ain = await pt.queryGivenOut(usdc, xcqr, aout, trader);
            await printSwap(usdc, ain, xcqr, aout);
        }
    }
    await delay(2000);

    if (true) {
        line("SELL 20 XCHR");
        await vw.printTokens(poolId);
        //await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountIn = scaleUp(2 * qty, 18);
        const actualAmountOut = await pt.swapGivenIn(xcqr, usdc, actualAmountIn, trader);

        await printSwap(xcqr, actualAmountIn, usdc, actualAmountOut);

        await vw.printTokens(poolId);
        //await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        {
            console.log("spot");
            const ain = scaleUp(1, 15);
            const aout = await pt.queryGivenIn(xcqr, usdc, ain, trader);
            await printSwap(xcqr, ain, usdc, aout);
        }
    }
    await delay(2000);

    if (true) {
        line("BUY 10 XCHR");
        await vw.printTokens(poolId);
        //await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountOut = scaleUp(qty, 18);
        const actualAmountIn = await pt.swapGivenOut(usdc, xcqr, actualAmountOut, trader);

        await printSwap(usdc, actualAmountIn, xcqr, actualAmountOut);

        await vw.printTokens(poolId);
        //await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        {
            console.log("spot");
            const aout = scaleUp(1, 15);
            const ain = await pt.queryGivenOut(usdc, xcqr, aout, trader);
            await printSwap(usdc, ain, xcqr, aout);
        }
    }
}


async function main() {

    const vaultAddress: string = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
    const poolAddress: string = "0xCd30aEB2402De66c8feF819E828EbaaA5B0D67a0";

    // const signerAddress: string = "0xd713Eef55104c67cA1A6a1dB617FaeE1831cF5e3";
    //await network.provider.request({method: "hardhat_impersonateAccount", params: [signerAddress]});
    //const signer = await ethers.provider.getSigner();

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

    {// Amplification
        const {value1, isUpdating1, precision1} = await pool.getAmplificationParameter1();
        console.log("A1: ", value1, isUpdating1, precision1);
        const {value2, isUpdating2, precision2} = await pool.getAmplificationParameter2();
        console.log("A2: ", value2, isUpdating2, precision2);
     }

    await vw.printTokens(poolId);

    await delay(1000);

    //await provideLiquidity(vault, pool, signer, signer);

    await delay(1000);

    const usdcAddress: string = '0xD87Ba7A50B2E7E660f678A895E4B72E7CB4CCd9C';
    const usdc = await TokenDeployer.connect(usdcAddress, signer);
    await delay(1000);

    const xchrAddress: string = '0x9F205c61DA8eE3be4805B15b003b4732603f3631';
    const xcqr = await TokenDeployer.connect(xchrAddress, signer);
    await delay(1000);

    // await swapTokens(vault, pool, usdc, xcqr, signer);

    await delay(1000);

    await swapRoundTrip(vault, pool, usdc, xcqr, signer);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
