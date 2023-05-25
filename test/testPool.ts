import {ethers} from "hardhat";
import {BigNumber, Contract} from "ethers";

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import {scaleDn, scaleUp} from "../scripts/helpers/biggy";

import {TokenDeployer} from "../scripts/helpers/TokenDeployer";
import {TokenWrapper} from "../scripts/helpers/TokenWrapper";

import {VaultDeployer} from "../scripts/helpers/VaultDeployer";
import {VaultWrapper} from "../scripts/helpers/VaultWrapper";

import {PoolDeployer} from "../scripts/helpers/PoolDeployer";
import {PoolTrader} from "../scripts/helpers/PoolTrader";


import {TestToken} from "../typechain-types/solidity-utils/test/TestToken"
import {TestWETH} from "../typechain-types/solidity-utils/test/TestWETH"
import {ComposableCustomPool} from "../typechain-types/ComposableCustomPool"
import {Vault} from "../typechain-types/vault/Vault"
import {PoolProvisioner} from "../scripts/helpers/PoolProvisioner";
import {inReceipt} from "../scripts/helpers/expectEvent";
import {PoolManager} from "../scripts/helpers/PoolManager";

function line(msg: string) {
    console.log("---", msg, "---------------------------------");
}

async function deployTokens(admin: SignerWithAddress, lp: SignerWithAddress, trader: SignerWithAddress) {

    line("TOKEN begin");

    const td = new TokenDeployer();

    const weth = await td.deployWETH();

    const xcqr = await td.deployToken("XCHR Test Token", "XCHR", 18);
    await xcqr.mint(admin.address, scaleUp(30_000_000, await xcqr.decimals()));
    await xcqr.transfer(lp.address, scaleUp(10_000_000, await xcqr.decimals()));
    await xcqr.transfer(trader.address, scaleUp(5_000_000, await xcqr.decimals()));

    const usdc = await td.deployToken("USDC Test Token", "USDC", 6);
    await usdc.mint(admin.address, scaleUp(30_000_000, await usdc.decimals()));
    await usdc.transfer(lp.address, scaleUp(10_000_000, await usdc.decimals()));
    await usdc.transfer(trader.address, scaleUp(5_000_000, await usdc.decimals()));

    await TokenWrapper.printTokens([xcqr.address, usdc.address], admin.address);
    await TokenWrapper.printTokens([xcqr.address, usdc.address], lp.address);
    await TokenWrapper.printTokens([xcqr.address, usdc.address], trader.address);

    line("TOKENS end");

    return {weth, usdc, xcqr};
}

async function deployVault(admin: SignerWithAddress, weth: TestWETH) {

    const factory = await ethers.getContractFactory("CustomMath");

    const customMath = await factory.deploy();

    const vd = new VaultDeployer();

    const vault = await vd.deployVault(admin.address, weth.address);

    return {vault, customMath};

}

async function deployPool(vault: Vault, customMath: Contract, admin: SignerWithAddress, xcqr: TestToken, usdc: TestToken) {

    // A1 is the upside
    // A2 is the downside
    // range [1, 499]
    // higher number flattens
    // A1 = 1 - maximum upside (curvy)
    // A2 = 499 - support for downside (flat)


    const pd = new PoolDeployer(customMath.address, 1, 499);

    return await pd.deployPool(await vault.address, [xcqr.address, usdc.address], admin.address);

}

async function initPool(vault: Vault, pool: ComposableCustomPool, admin: SignerWithAddress, lp: SignerWithAddress) {

    const vw = new VaultWrapper(vault);
    const pw = new PoolProvisioner(vault, pool);
    const poolId = await pool.getPoolId();
    const tokens = await vw.getTokens(poolId);

    line("INIT begin");
    await vw.printTokens(poolId);
    await TokenWrapper.printTokens(tokens, admin.address);
    await pw.init(tokens, admin);
    console.log("init")
    await vw.printTokens(poolId);
    await TokenWrapper.printTokens(tokens, admin.address);
    line("INIT end");

}

async function provideLiquidity(vault: Vault, pool: ComposableCustomPool, admin: SignerWithAddress, lp: SignerWithAddress) {

    const vw = new VaultWrapper(vault);
    const pw = new PoolProvisioner(vault, pool);
    const poolId = await pool.getPoolId();
    const tokens = await vw.getTokens(poolId);

    {
        line("JOINT EXACT TKN IN begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        await pw.joinExactTokensIn(tokens, lp);
        console.log("join");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        line("JOIN EXACT TKN IN end");
    }
    {
        line("EXIT EXACT TKN OUT begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        await pw.exitExactTokensOut(tokens, lp);
        console.log("exit");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        line("EXIT EXACT TKN OUT end");
    }
    {
        line("JOIN EXACT BPT OUT begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        await pw.joinExactBPTOut(tokens, lp);
        console.log("join");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        line("JOIN EXACT BPT end");
    }
    {
        line("EXIT EXACT BPT IN begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        await pw.exitExactBPTIn(tokens, lp);
        console.log("exit");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        line("EXIT EXACT BPT end");
    }

}

async function printSwap(tokenIn: TestToken, amountIn: BigNumber, tokenOut: TestToken, amountOut: BigNumber) {
    const aIn = parseFloat(scaleDn(amountIn, await tokenIn.decimals()));
    const aOut = parseFloat(scaleDn(amountOut, await tokenOut.decimals()));
    const symIn = await tokenIn.symbol();
    let price;
    if (symIn == "USDC") {
        price = aIn / aOut;
    } else {
        price = aOut / aIn;
    }
    console.log("price:", price, "in", aIn, "out", aOut);
}

async function swapTokens(vault: Vault, pool: ComposableCustomPool, usdc: TestToken, xcqr: TestToken, trader: SignerWithAddress) {

    const vw = new VaultWrapper(vault);
    const pt = new PoolTrader(vault, pool);
    const poolId = await pool.getPoolId();

    if (true) {
        line("SWAP GIVEN OUT begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountOut = scaleUp(10, 18);
        //const expectedAmountIn = await pt.queryGivenOut(usdc, xcqr, actualAmountOut, trader);
        const actualAmountIn = await pt.swapGivenOut(usdc, xcqr, actualAmountOut, trader);

        await printSwap(usdc, actualAmountIn, xcqr, actualAmountOut);
        //console.log("expected In", expectedAmountIn.toString())

        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
        line("SWAP GIVEN OUT end");
    }

    if (false) {
        line("SWAP GIVEN IN begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountIn = scaleUp(10, 18);
        //const expectedAmountOut = await pt.queryGivenIn(xcqr, usdc, actualAmountIn, trader);
        const actualAmountOut = await pt.swapGivenIn(xcqr, usdc, actualAmountIn, trader);

        await printSwap(xcqr, actualAmountIn, usdc, actualAmountOut);
        //console.log("expected Out", expectedAmountOut.toString());

        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
        await vw.getAddress();
        line("SWAP GIVEN IN end");
    }
    if (false) {
        line("SWAP GIVEN OUT begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountOut = scaleUp(30, 6);
        // const expectedAmountIn = await pt.queryGivenOut(xcqr, usdc, actualAmountOut, trader);
        const actualAmountIn = await pt.swapGivenOut(xcqr, usdc, actualAmountOut, trader);

        await printSwap(xcqr, actualAmountIn, usdc, actualAmountOut);
        //console.log("expected In", expectedAmountIn.toString())

        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
        line("SWAP GIVEN OUT end");
    }
    if (false) {
        line("SWAP GIVEN IN begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

        const actualAmountIn = scaleUp(30, 6);
        //const expectedAmountOut = await pt.queryGivenIn(xcqr, usdc, actualAmountIn, trader);
        const actualAmountOut = await pt.swapGivenIn(usdc, xcqr, actualAmountIn, trader);

        await printSwap(usdc, actualAmountIn, xcqr, actualAmountOut);
        //console.log("expected Out", expectedAmountOut.toString());

        await vw.printTokens(poolId);
        await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
        await vw.getAddress();
        line("SWAP GIVEN IN end");
    }


}

async function main() {

    const [admin, lp, trader] = await ethers.getSigners();

    console.log("admin:", admin.address, "eth: ", (await admin.getBalance()).toString());
    console.log("LP   :", lp.address, "eth: ", (await lp.getBalance()).toString());
    console.log("tradr:", trader.address, "eth: ", (await trader.getBalance()).toString());

    const {weth, usdc, xcqr} = await deployTokens(admin, lp, trader);

    const {vault, customMath} = await deployVault(admin, weth);

    const pool = await deployPool(vault, customMath, admin, usdc, xcqr);
    {
        const pm = new PoolManager(vault, pool);
        await pm.diagnostics();
    }
    {
        //console.log("PERMISSIONS BEGIN");
        //await vd.grantPermission(vault.address, 'joinPool', lp.address);
        //await vd.grantPermission(vault.address, 'exitPool', lp.address);
        //console.log("PERMISSIONS END");
    }

    await initPool(vault, pool, admin, lp);

    // await provideLiquidity(vault, pool, admin, lp);

    await swapTokens(vault, pool, usdc, xcqr, trader);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
