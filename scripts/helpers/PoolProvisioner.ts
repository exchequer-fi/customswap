import {defaultAbiCoder} from "@ethersproject/abi";
import {BigNumber, Signer} from "ethers";

import {IVault, Vault} from "../../typechain-types/vault/Vault";
import {TokenDeployer} from "./TokenDeployer";
import {maxUint} from "./numbers";
import {scaleUp} from "./biggy";

import {ComposableCustomPool} from "../../typechain-types/ComposableCustomPool";
import {delay} from "./TimeMachine";

enum JoinKind {
    INIT = 0,
    EXACT_TOKENS_IN_FOR_BPT_OUT,
    TOKEN_IN_FOR_EXACT_BPT_OUT
}

enum ExitKind {
    EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0,
    BPT_IN_FOR_EXACT_TOKENS_OUT
}

export class PoolProvisioner {

    private static readonly MAX_UINT256: BigNumber = maxUint(256);
    private vault: Vault;
    private pool: ComposableCustomPool;

    constructor(vault: Vault, pool: ComposableCustomPool) {
        this.vault = vault;
        this.pool = pool;
    }

    public async init(tokens: string[], signer: Signer) {

        const poolId = await this.pool.getPoolId();
        const sa = await signer.getAddress();

        let amounts: BigNumber[] = [];
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = await TokenDeployer.connect(tokens[i], signer);
            await delay(1000);
            const d = await t.decimals();
            const s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(1000, d);
                    amounts.push(b);
                    limits.push(b);
                    await t.approve(this.vault.address, b);
                    await delay(1000);

                    break;
                }
                case "XCR":
                case "XCHR": {
                    let b = scaleUp(1003, d);
                    amounts.push(b);
                    limits.push(b);
                    await t.approve(this.vault.address, b);
                    await delay(1000);
                    break;
                }
                default:
                    // DO push BPT to amounts - unlike join or exit, init requires this
                    amounts.push(BigNumber.from(0));
                    limits.push(PoolProvisioner.MAX_UINT256);
                    break;
            }
        }

        let request: IVault.JoinPoolRequestStruct = {
            assets: tokens,
            maxAmountsIn: limits,
            fromInternalBalance: false,
            userData: defaultAbiCoder.encode(['uint256', 'uint256[]'], [JoinKind.INIT, amounts])
        };

        let tx = await this.vault.connect(signer).joinPool(poolId, sa, sa, request);
        await tx.wait();
    }

    public async joinExactTokensIn(tokens: string[], signer: Signer) {

        const poolId = await this.pool.getPoolId();
        const sa = await signer.getAddress();

        let amounts: BigNumber[] = [];
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = await TokenDeployer.connect(tokens[i], signer);
            const d = await t.decimals();
            const s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(90, d);
                    amounts.push(b);
                    limits.push(b);
                    await t.approve(this.vault.address, b);
                    break;
                }
                case "XCR":
                case "XCHR": {
                    let b = scaleUp(30, d);
                    amounts.push(b);
                    limits.push(b);
                    await t.approve(this.vault.address, b);
                    break;
                }
                default:
                    limits.push(PoolProvisioner.MAX_UINT256);
                    break;
            }
        }

        const minBPT = scaleUp(1, 18);

        let request: IVault.JoinPoolRequestStruct = {
            assets: tokens,
            maxAmountsIn: limits,
            fromInternalBalance: false,
            userData: defaultAbiCoder.encode(
                ['uint256', 'uint256[]', 'uint256'],
                [JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT, amounts, minBPT]
            )
        };


        let tx = await this.vault.connect(signer).joinPool(poolId, sa, sa, request);
        await tx.wait();
    }

    public async joinExactBPTOut(tokens: string[], signer: Signer) {

        const poolId = await this.pool.getPoolId();
        const sa = await signer.getAddress();

        let joinTokenIndex;
        let tokenCounter = 0;
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = await TokenDeployer.connect(tokens[i], signer);
            const d = await t.decimals();
            const s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(30, d);
                    limits.push(b);
                    await t.approve(this.vault.address, b);
                    joinTokenIndex = tokenCounter;
                    tokenCounter++;
                    break;
                }
                case "XCR":
                case "XCHR": {
                    let b = scaleUp(10, d);
                    limits.push(b);
                    await t.approve(this.vault.address, b);
                    tokenCounter++;
                    break;
                }
                default:
                    limits.push(PoolProvisioner.MAX_UINT256);
                    break;
            }
        }

        const bptOut = scaleUp(20, 18);

        let request: IVault.JoinPoolRequestStruct = {
            assets: tokens,
            maxAmountsIn: limits,
            fromInternalBalance: false,
            userData: defaultAbiCoder.encode(
                ['uint256', 'uint256', 'uint256'],
                [JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT, bptOut, joinTokenIndex]
            )
        };

        let tx = await this.vault.connect(signer).joinPool(poolId, sa, sa, request);
        await tx.wait();

    }

    public async exitExactTokensOut(tokens: string[], signer: Signer) {

        const poolId = await this.pool.getPoolId();
        const sa = await signer.getAddress();

        let amounts: BigNumber[] = [];
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = await TokenDeployer.connect(tokens[i], signer);
            const d = await t.decimals();
            const s = await t.symbol();
            switch (s) {
                case "USDC":
                    amounts.push(scaleUp(3, d));
                    limits.push(BigNumber.from(0));
                    break;
                case "XCHR":
                case "XCR":
                    amounts.push(scaleUp(1, d));
                    limits.push(BigNumber.from(0));
                    break;
                default:
                    limits.push(BigNumber.from(0));
                    break;
            }
        }

        const maxBPTAmountIn = scaleUp(10000, 18);

        let request: IVault.ExitPoolRequestStruct = {
            assets: tokens,
            minAmountsOut: limits,
            toInternalBalance: false,
            userData:
                defaultAbiCoder.encode(
                    ['uint256', 'uint256[]', 'uint256'],
                    [ExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT, amounts, maxBPTAmountIn]
                )
        };

        let tx = await this.vault.connect(signer).exitPool(poolId, sa, sa, request);
        await tx.wait();
    }


    public async exitExactBPTIn(tokens: string[], signer: Signer) {

        const poolId = await this.pool.getPoolId();
        const sa = await signer.getAddress();

        let exitTokenIndex;
        let limits: BigNumber[] = [];
        let tokenCounter = 0;
        for (let i = 0; i < tokens.length; i++) {
            const t = await TokenDeployer.connect(tokens[i], signer);
            let s = await t.symbol();
            switch (s) {
                case "USDC":
                    limits.push(BigNumber.from(0));
                    exitTokenIndex = tokenCounter;
                    tokenCounter++;
                    break;
                case "XCR":
                case "XCHR":
                    limits.push(BigNumber.from(0));
                    tokenCounter++;
                    break;
                default:
                    limits.push(BigNumber.from(0));
                    break;
            }
        }

        const bptIn = scaleUp(20, 18);

        let request: IVault.ExitPoolRequestStruct = {
            assets: tokens,
            minAmountsOut: limits,
            toInternalBalance: false,
            userData:
                defaultAbiCoder.encode(
                    ['uint256', 'uint256', 'uint256'],
                    [ExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptIn, exitTokenIndex]
                )
        };

        let tx = await this.vault.connect(signer).exitPool(poolId, sa, sa, request);
        await tx.wait();
    }

}
