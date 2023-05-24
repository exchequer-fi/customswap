import {ethers} from "hardhat";

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import {scaleUp} from "../scripts/helpers/biggy";

import {TokenDeployer} from "../scripts/helpers/TokenDeployer";
import {TokenWrapper} from "../scripts/helpers/TokenWrapper";

import {VaultDeployer} from "../scripts/helpers/VaultDeployer";
import {VaultWrapper} from "../scripts/helpers/VaultWrapper";

import {PoolDeployer} from "../scripts/helpers/PoolDeployer";
import {PoolWrapper} from "../scripts/helpers/PoolWrapper";


import {TestToken} from "../typechain-types/solidity-utils/test/TestToken"
import {TestWETH} from "../typechain-types/solidity-utils/test/TestWETH"
import {Contract} from "ethers";

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

    return {weth, usdc, xcqr, td};
}

async function deployPool(admin: SignerWithAddress, weth: TestWETH, xcqr: TestToken, usdc: TestToken) {

    const factory = await ethers.getContractFactory("CustomMath");
    const customMath = await factory.deploy();

    line("POOL begin");

    const vd = new VaultDeployer();

    const vault = await vd.deployVault(admin.address, weth.address);

    const vw = new VaultWrapper(vault);

    const pd = new PoolDeployer(customMath.address);

    const pool = await pd.deployPool(await vault.address, [xcqr.address, usdc.address], admin.address);

    const pw = await new PoolWrapper(vault, pool);

    line("POOL end");

    return {vw, pw};

}

async function seedLiquidity(td: TokenDeployer, vw: VaultWrapper, pw: PoolWrapper, admin: SignerWithAddress, lp: SignerWithAddress) {

    const poolId = await pw.poolId();
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

async function provideLiquidity(td: TokenDeployer, vw: VaultWrapper, pw: PoolWrapper, admin: SignerWithAddress, lp: SignerWithAddress) {

    const poolId = await pw.poolId();
    const tokens = await vw.getTokens(poolId);

    if (false) {
        line("JOINT EXACT TKN IN begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        await pw.joinExactTokensIn(tokens, lp);
        console.log("join");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        line("JOIN EXACT TKN IN end");
    }
    if (false) {
        line("EXIT EXACT TKN OUT begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        await pw.exitExactTokensOut(tokens, lp);
        console.log("exit");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        line("EXIT EXACT TKN OUT end");
    }
    if (true) {
        line("JOIN EXACT BPT OUT begin");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        await pw.joinExactBPTOut(tokens, lp);
        console.log("join");
        await vw.printTokens(poolId);
        await TokenWrapper.printTokens(tokens, lp.address);
        line("JOIN EXACT BPT end");
    }
    if (true) {
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

async function swapTokens(td: TokenDeployer, vw: VaultWrapper, pw: PoolWrapper, usdc: Contract, xcqr: Contract, trader: SignerWithAddress) {

    line("SWAP GIVEN OUT begin");
    await vw.printTokens(await pw.poolId());
    await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

    await pw.swapGivenOut(usdc.address, xcqr.address, trader);
    line("swap");

    await vw.printTokens(await pw.poolId());
    await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
    line("SWAP GIVEN OUT end");


    line("SWAP GIVEN IN begin");
    await vw.printTokens(await pw.poolId());
    await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);

    await pw.swapGivenIn(usdc.address, xcqr.address, trader);
    line("swap");

    await vw.printTokens(await pw.poolId());
    await TokenWrapper.printTokens([usdc.address, xcqr.address], trader.address);
    await vw.getAddress();
    line("SWAP GIVEN IN end");

}

async function main() {

    const [admin, lp, trader] = await ethers.getSigners();

    console.log("admin:", admin.address, "eth: ", (await admin.getBalance()).toString());
    console.log("LP   :", lp.address, "eth: ", (await lp.getBalance()).toString());
    console.log("tradr:", trader.address, "eth: ", (await trader.getBalance()).toString());

    const {weth, usdc, xcqr, td} = await deployTokens(admin, lp, trader);

    const {vw, pw} = await deployPool(admin, weth, usdc, xcqr);

    {
        //console.log("PERMISSIONS BEGIN");
        //await vd.grantPermission(vault.address, 'joinPool', lp.address);
        //await vd.grantPermission(vault.address, 'exitPool', lp.address);
        //console.log("PERMISSIONS END");
    }

    await seedLiquidity(td, vw, pw, admin, lp);

    await provideLiquidity(td, vw, pw, admin, lp);

    await swapTokens(td, vw, pw, usdc, xcqr, trader);

    await pw.diagnostics();

    await pw.updateAmps();


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
