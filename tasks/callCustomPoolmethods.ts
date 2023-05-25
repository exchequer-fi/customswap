import {ethers} from "hardhat";
import {defaultAbiCoder} from "@ethersproject/abi";

import {BigNumber} from "ethers";
import {maxUint} from "../scripts/helpers/numbers";

import {TestToken} from "../../../Projects/boot/xcqr-customswap/typechain-types/solidity-utils/test/TestToken"
import {IVault, Vault} from "../../../Projects/boot/xcqr-customswap/typechain-types/vault/Vault"

const MAX_UINT256: BigNumber = maxUint(256);
const MAX_UINT112: BigNumber = maxUint(112);

const poolId: string = "0x713ce2d8e4ddd756f35620c4b48ca5f6558ef0800000000000000000000007ea";

enum StablePoolJoinKind {
    INIT = 0,
    EXACT_TOKENS_IN_FOR_BPT_OUT,
    TOKEN_IN_FOR_EXACT_BPT_OUT,
}

async function getSigner() {
    const imposter: string = "0xd713Eef55104c67cA1A6a1dB617FaeE1831cF5e3";
    return await ethers.getImpersonatedSigner(imposter);
}

async function getVault() {
    const address: string = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const factory = await ethers.getContractFactory("Vault", await getSigner());
    const contract = await factory.attach(address)
    return contract.deployed();
}

async function getPool(vault: Vault, poolId: string) {

    const poolInfo = await vault.getPool(poolId);
    const poolAddress = poolInfo[0];

    const libAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';

    const factory = await ethers.getContractFactory("ComposableCustomPool", {
        libraries: {
            CustomMath: libAddress
        },
        signer: await getSigner()
    });

    const pool = await factory.attach(poolAddress);

    return pool.deployed();

}

async function getToken(address: string) {
    const factory = await ethers.getContractFactory("TestToken",
        await getSigner()
    );
    let s0 = factory.signer;
    //console.log(await s0.getAddress());
    const token: TestToken = await factory.attach(address);
    let s1 = token.signer;
    //console.log(await s1.getAddress());
    return token.deployed();
}

async function getTokens(vault: Vault, poolId: string) {

    const {tokens: tokens} = await vault.getPoolTokens(poolId);

    const testTokens: TestToken[] = [];

    for (let i = 0; i < tokens.length; i++) {
        let token = await getToken(tokens[i]);
        testTokens.push(token);
    }
    return testTokens;
}

async function printPoolTokens(vault: Vault, poolId: string) {

    const {tokens, balances, lastChangeBlock} = await vault.getPoolTokens(poolId);

    for (let i = 0; i < tokens.length; i++) {
        const token = await getToken(tokens[i]);
        const {
            cash,
            managed,
            lastChangeBlock,
            assetManager
        } = await vault.getPoolTokenInfo(poolId, token.address);

        console.log("%s balance %d cash: %d, managed %d, %d, %s",
            tokens[i],
            balances[i],
            cash,
            managed,
            lastChangeBlock,
            await token.symbol());
    }
}

async function main() {

    let signer = await getSigner();
    const vault = await getVault();
    const pool = await getPool(vault, poolId);

    await printPoolTokens(vault, poolId);
    console.log("total supply: ", await pool.totalSupply());

    let bptIndex = (await pool.getBptIndex()).toNumber();

    let initialBalances: BigNumber[] = [
        BigNumber.from(0),
        BigNumber.from(10).pow(18).mul(10),
        BigNumber.from(10).pow(6).mul(30)
    ];
    //= Array.from({length: 2 + 1}).map((_, i) => (i == bptIndex ? 0 : fp(1 - i / 10)));
    console.log(initialBalances);

    {
        const tokens = await getTokens(vault, poolId);

        for (let i = 0; i < tokens.length; i++) {
            let t = tokens[i];
            if (i != bptIndex) {
                let tx = await t.approve(vault.address, initialBalances[i], {from: signer.address});
                tx.wait();
            }
            const decimals = BigNumber.from(10).pow(await t.decimals());
            console.log("%s bal=%d allowance %d",
                await t.symbol(),
                (await t.balanceOf(signer.address)).div(decimals),
                (await t.allowance(signer.address, vault.address)).div(decimals));
        }
    }


    const {tokens, balances, lastChangeBlock} = await vault.getPoolTokens(poolId);


    let joinRequest: IVault.JoinPoolRequestStruct = {
        assets: tokens,
        maxAmountsIn: Array(3).fill(MAX_UINT256), // TODO: BigNumber.from(10).pow(18).mul(100)),
        fromInternalBalance: false,
        userData: defaultAbiCoder.encode(['uint256', 'uint256[]'], [StablePoolJoinKind.INIT, initialBalances])
    };

    if (true) {
        let tx = await vault.joinPool(
            poolId,
            signer.address,
            signer.address,
            joinRequest
        );
        //console.log("tx: ", tx);
        let receipt = await tx.wait();
        //console.log("receipt: ", receipt);
    }

    await printPoolTokens(vault, poolId);
    console.log("total supply: ", await pool.totalSupply());

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
