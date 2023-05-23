import {ethers} from "hardhat";

import {PoolDeployer} from "../scripts/helpers/PoolDeployer";
import {TokenDeployer} from "../scripts/helpers/TokenDeployer";
import {VaultDeployer} from "../scripts/helpers/VaultDeployer";
import {PoolWrapper} from "../scripts/helpers/PoolWrapper";
import {scaleUp} from "../scripts/helpers/biggy";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

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

    await td.printTokens([xcqr.address, usdc.address], admin.address);
    await td.printTokens([xcqr.address, usdc.address], lp.address);
    await td.printTokens([xcqr.address, usdc.address], trader.address);

    line("TOKENS end");

    return {weth, usdc, xcqr, td};
}

async function deployPool(admin: SignerWithAddress, weth: TestWETH, xcqr: TestToken, usdc: TestToken) {

    const factory = await ethers.getContractFactory("CustomMath");
    const customMath = await factory.deploy();

    line("POOL begin");

    const vd = new VaultDeployer();

    const vault = await vd.deployVault(admin.address, weth.address);

    const pd = new PoolDeployer(customMath.address);

    const pool = await pd.deployPool(await vault.getAddress(), [xcqr.address, usdc.address], admin.address);

    const pw = await new PoolWrapper(customMath.address).connect(pool.address);

    line("POOL end");

    return {vd, pw};

}

async function seedLiquidity(td: TokenDeployer, vd: VaultDeployer, pw: PoolWrapper, admin: SignerWithAddress, lp: SignerWithAddress) {

    const poolId = await pw.poolId();
    const tokens = await vd.getTokens(poolId);

    line("INIT begin");
    await vd.printTokens(await vd.getAddress(), poolId);
    await td.printTokens(tokens, admin.address);
    await pw.init(tokens, admin);
    console.log("init")
    await vd.printTokens(await vd.getAddress(), poolId);
    await td.printTokens(tokens, admin.address);
    line("INIT end");

}

async function provideLiquidity(td: TokenDeployer, vd: VaultDeployer, pw: PoolWrapper, admin: SignerWithAddress, lp: SignerWithAddress) {

    const poolId = await pw.poolId();
    const tokens = await vd.getTokens(poolId);

    if (false) {
        line("JOINT EXACT TKN IN begin");
        await vd.printTokens(await vd.getAddress(), poolId);
        await td.printTokens(tokens, lp.address);
        await pw.joinExactTokensIn(tokens, lp);
        console.log("join");
        await vd.printTokens(await vd.getAddress(), poolId);
        await td.printTokens(tokens, lp.address);
        line("JOIN EXACT TKN IN end");
    }
    if (false) {
        line("EXIT EXACT TKN OUT begin");
        await vd.printTokens(await vd.getAddress(), poolId);
        await td.printTokens(tokens, lp.address);
        await pw.exitExactTokensOut(tokens, lp);
        console.log("exit");
        await vd.printTokens(await vd.getAddress(), poolId);
        await td.printTokens(tokens, lp.address);
        line("EXIT EXACT TKN OUT end");
    }
    if (true) {
        line("JOIN EXACT BPT OUT begin");
        await vd.printTokens(await vd.getAddress(), poolId);
        await td.printTokens(tokens, lp.address);
        await pw.joinExactBPTOut(tokens, lp);
        console.log("join");
        await vd.printTokens(await vd.getAddress(), poolId);
        await td.printTokens(tokens, lp.address);
        line("JOIN EXACT BPT end");
    }
    if (true) {
        line("EXIT EXACT BPT IN begin");
        await vd.printTokens(await vd.getAddress(), poolId);
        await td.printTokens(tokens, lp.address);
        await pw.exitExactBPTIn(tokens, lp);
        console.log("exit");
        await vd.printTokens(await vd.getAddress(), poolId);
        await td.printTokens(tokens, lp.address);
        line("EXIT EXACT BPT end");
    }

}

async function swapTokens(td: TokenDeployer, vd: VaultDeployer, pw: PoolWrapper, usdc: Contract, xcqr: Contract, trader: SignerWithAddress) {

    line("SWAP GIVEN OUT begin");
    await vd.printTokens(await vd.getAddress(), await pw.poolId());
    await td.printTokens([usdc.address, xcqr.address], trader.address);

    await pw.swapGivenOut(usdc.address, xcqr.address, trader);
    line("swap");

    await vd.printTokens(await vd.getAddress(), await pw.poolId());
    await td.printTokens([usdc.address, xcqr.address], trader.address);
    line("SWAP GIVEN OUT end");


    line("SWAP GIVEN IN begin");
    await vd.printTokens(await vd.getAddress(), await pw.poolId());
    await td.printTokens([usdc.address, xcqr.address], trader.address);

    await pw.swapGivenIn(usdc.address, xcqr.address, trader);
    line("swap");

    await vd.printTokens(await vd.getAddress(), await pw.poolId());
    await td.printTokens([usdc.address, xcqr.address], trader.address);
    await vd.getAddress();
    line("SWAP GIVEN IN end");

}

async function main() {

    const [admin, lp, trader] = await ethers.getSigners();

    console.log("admin:", admin.address, "eth: ", (await admin.getBalance()).toString());
    console.log("LP   :", lp.address, "eth: ", (await lp.getBalance()).toString());
    console.log("tradr:", trader.address, "eth: ", (await trader.getBalance()).toString());

    const {weth, usdc, xcqr, td} = await deployTokens(admin, lp, trader);

    const {vd, pw} = await deployPool(admin, weth, usdc, xcqr);

    {
        //console.log("PERMISSIONS BEGIN");
        //await vd.grantPermission(vault.address, 'joinPool', lp.address);
        //await vd.grantPermission(vault.address, 'exitPool', lp.address);
        //console.log("PERMISSIONS END");
    }

    await seedLiquidity(td, vd, pw, admin, lp);

    await provideLiquidity(td, vd, pw, admin, lp);

    await swapTokens(td, vd, pw, usdc, xcqr, trader);

    await pw.diagnostics();

    await pw.updateAmps();


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
