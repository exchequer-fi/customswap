import {defaultAbiCoder} from "@ethersproject/abi";
import {BigNumber, Signer} from "ethers";

import {IVault} from "../../typechain-types/vault/Vault";
import {TokenDeployer} from "./TokenDeployer";
import {VaultDeployer} from "./VaultDeployer";
import {maxUint} from "../../test/helpers/numbers";
import {scaleUp} from "./biggy";
import {ethers} from "hardhat";

import {ComposableCustomPool} from "../../typechain-types/ComposableCustomPool";

export enum JoinKind {
    INIT = 0,
    EXACT_TOKENS_IN_FOR_BPT_OUT,
    TOKEN_IN_FOR_EXACT_BPT_OUT
}

export enum ExitKind {
    EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0,
    BPT_IN_FOR_EXACT_TOKENS_OUT
}

export class PoolWrapper {

    private static readonly MAX_UINT256: BigNumber = maxUint(256);

    private readonly customMath: string;
    private pool: ComposableCustomPool | undefined;

    constructor(customMath: string) {
        this.customMath = customMath;
    }

    public async poolId() {
        const p = this.pool!;
        return p.getPoolId();
    }

    public async connect(address: string) {
        const factory = await ethers.getContractFactory("ComposableCustomPool", {
                libraries: {
                    CustomMath: this.customMath
                }
            }
        );
        this.pool = await factory.attach(address);
        return this;
    }

    public async printRates() {

        console.log("pool rates");

        const p = this.pool!;
        const v = await (new VaultDeployer()).attachVault(await p.getVault());
        const td = new TokenDeployer();

        const {tokens: tokens} = await v.getPoolTokens(await p.getPoolId());
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let sym = await t.symbol();
            // let scale = toBig(1, await t.decimals());
            let r = await p.getTokenRate(t.address);
            if (sym == "BPTT") {
                console.log("%s r=%d cache: ", sym, r);
            } else {
                const {rate, oldRate, duration, expires} = await p.getTokenRateCache(t.address);
                console.log("%s r=%d cache r=%d o=%d d=%d e=%d", sym,
                    r,
                    rate,
                    oldRate,
                    duration,
                    expires);
            }
        }
    }


    public async grantPermission(action: string, address: string) {
        const pool = this.pool!;
        const selector = pool.interface.getSighash(action);
        const actionId = await pool.getActionId(selector);
        const actionIds = [actionId];
        const wheres = actionIds.map(() => VaultDeployer.ANY_ADDRESS);
        const authorizer = await new VaultDeployer().attachAuthorizer(await pool.getAuthorizer());
        await authorizer.grantPermissions(actionIds, address, wheres);
    }

    public async init(tokens: string[], signer: Signer) {

        console.log("init pool");
        const pool = this.pool!;
        const poolId = await pool.getPoolId();
        const vault = await new VaultDeployer().attachVault(await pool.getVault());
        const td = new TokenDeployer();

        let amounts: BigNumber[] = [];
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let d = await t.decimals();
            let s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(3, d);
                    amounts.push(b);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    break;
                }
                case "XCHR": {
                    let b = scaleUp(1, d);
                    amounts.push(b);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    break;
                }
                default:
                    // DO push BPT to amounts - unlike join or exit, init requires this
                    amounts.push(BigNumber.from(0));
                    limits.push(PoolWrapper.MAX_UINT256);
                    break;
            }
        }

        let request: IVault.JoinPoolRequestStruct = {
            assets: tokens,
            maxAmountsIn: limits,
            fromInternalBalance: false,
            userData: defaultAbiCoder.encode(['uint256', 'uint256[]'], [JoinKind.INIT, amounts])
        };

        const sa = await signer.getAddress();
        let tx = await vault.connect(signer).joinPool(poolId, sa, sa, request);
        await tx.wait();
    }

    public async joinExactTokensIn(tokens: string[], signer: Signer) {

        console.log("join pool with exact tokens");

        const pool = this.pool!
        const poolId = await pool.getPoolId();
        const vault = await new VaultDeployer().attachVault(await pool.getVault());
        const td = new TokenDeployer();

        let amounts: BigNumber[] = [];
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let d = await t.decimals();
            let s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(3, d);
                    amounts.push(b);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    break;
                }
                case "XCHR": {
                    let b = scaleUp(1, d);
                    amounts.push(b);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    break;
                }
                default:
                    limits.push(PoolWrapper.MAX_UINT256);
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

        const sa = await signer.getAddress();
        let tx = await vault.connect(signer).joinPool(poolId, sa, sa, request);
        await tx.wait();
    }

    public async joinExactBPTOut(tokens: string[], signer: Signer) {

        const pool = this.pool!
        const poolId = await pool.getPoolId();
        const vault = await new VaultDeployer().attachVault(await pool.getVault());

        const td = new TokenDeployer();

        let joinTokenIndex;
        let tokenCounter = 0;
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let d = await t.decimals();
            let s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(3, d);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    joinTokenIndex = tokenCounter;
                    tokenCounter++;
                    break;
                }
                case "XCHR": {
                    let b = scaleUp(1, d);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    tokenCounter++;
                    break;
                }
                default:
                    limits.push(PoolWrapper.MAX_UINT256);
                    break;
            }
        }

        const bptOut = scaleUp(2, 18);

        let request: IVault.JoinPoolRequestStruct = {
            assets: tokens,
            maxAmountsIn: limits,
            fromInternalBalance: false,
            userData: defaultAbiCoder.encode(
                ['uint256', 'uint256', 'uint256'],
                [JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT, bptOut, joinTokenIndex]
            )
        };
        const sa = await signer.getAddress();
        let tx = await vault.connect(signer).joinPool(poolId, sa, sa, request);
        await tx.wait();

    }

    public async exitExactTokensOut(tokens: string[], signer: Signer) {

        const pool = this.pool!
        const poolId = await pool.getPoolId();
        const vault = await new VaultDeployer().attachVault(await pool.getVault());
        const td = new TokenDeployer();

        let amounts: BigNumber[] = [];
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let d = await t.decimals();
            let s = await t.symbol();
            switch (s) {
                case "USDC":
                    amounts.push(scaleUp(3, d));
                    limits.push(BigNumber.from(0));
                    break;
                case "XCHR":
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

        const sa = await signer.getAddress();
        let tx = await vault.connect(signer).exitPool(poolId, sa, sa, request);
        await tx.wait();
    }


    public async exitExactBPTIn(tokens: string[], signer: Signer) {

        const pool = this.pool!
        const poolId = await pool.getPoolId();
        const vault = await new VaultDeployer().attachVault(await pool.getVault());
        const td = new TokenDeployer();

        let exitTokenIndex;
        let limits: BigNumber[] = [];
        let tokenCounter = 0;
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let s = await t.symbol();
            switch (s) {
                case "USDC":
                    limits.push(BigNumber.from(0));
                    exitTokenIndex = tokenCounter;
                    tokenCounter++;
                    break;
                case "XCHR":
                    limits.push(BigNumber.from(0));
                    tokenCounter++;
                    break;
                default:
                    limits.push(BigNumber.from(0));
                    break;
            }
        }

        const bptIn = scaleUp(2, 18);

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

        const sa = await signer.getAddress();
        let tx = await vault.connect(signer).exitPool(poolId, sa, sa, request);
        await tx.wait();
    }


}
