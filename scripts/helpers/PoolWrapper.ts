import {defaultAbiCoder} from "@ethersproject/abi";
import {BigNumber, Signer} from "ethers";

import {IVault} from "../../typechain-types/vault/Vault";
import {TokenDeployer} from "./TokenDeployer";
import {VaultDeployer} from "./VaultDeployer";
import {maxUint} from "../../test/helpers/numbers";
import {scaleUp, scaleDn} from "./biggy";
import {inReceipt} from "./expectEvent";

import {ethers} from "hardhat";

import {ComposableCustomPool} from "../../typechain-types/ComposableCustomPool";
import {advanceTime, currentTimestamp, setNextBlockTimestamp} from "./TimeMachine";

enum JoinKind {
    INIT = 0,
    EXACT_TOKENS_IN_FOR_BPT_OUT,
    TOKEN_IN_FOR_EXACT_BPT_OUT
}

enum ExitKind {
    EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0,
    BPT_IN_FOR_EXACT_TOKENS_OUT
}

enum SwapKind {
    GivenIn = 0,
    GivenOut = 1
}

export class PoolWrapper {

    private static readonly MAX_UINT256: BigNumber = maxUint(256);
    private static readonly DAY = 60 * 60 * 24;

    private readonly customMath: string;
    private pool: ComposableCustomPool | undefined;

    constructor(customMath: string) {
        this.customMath = customMath;
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

    public async poolId() {
        const p = this.pool!;
        return p.getPoolId();
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

        const {td, vault, poolId} = await this.setup();

        let amounts: BigNumber[] = [];
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let d = await t.decimals();
            let s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(3000, d);
                    amounts.push(b);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    break;
                }
                case "XCHR": {
                    let b = scaleUp(1000, d);
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

        const {td, vault, poolId} = await this.setup();

        let amounts: BigNumber[] = [];
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let d = await t.decimals();
            let s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(90, d);
                    amounts.push(b);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    break;
                }
                case "XCHR": {
                    let b = scaleUp(30, d);
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

        const {td, vault, poolId} = await this.setup();

        let joinTokenIndex;
        let tokenCounter = 0;
        let limits: BigNumber[] = [];
        for (let i = 0; i < tokens.length; i++) {
            let t = await td.attachToken(tokens[i]);
            let d = await t.decimals();
            let s = await t.symbol();
            switch (s) {
                case "USDC": {
                    let b = scaleUp(30, d);
                    limits.push(b);
                    await td.approveTransfer(tokens[i], signer, vault.address, b);
                    joinTokenIndex = tokenCounter;
                    tokenCounter++;
                    break;
                }
                case "XCHR": {
                    let b = scaleUp(10, d);
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
        const sa = await signer.getAddress();
        let tx = await vault.connect(signer).joinPool(poolId, sa, sa, request);
        await tx.wait();

    }

    public async exitExactTokensOut(tokens: string[], signer: Signer) {

        const {td, vault, poolId} = await this.setup();

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

        const {td, vault, poolId} = await this.setup();

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

        const sa = await signer.getAddress();
        let tx = await vault.connect(signer).exitPool(poolId, sa, sa, request);
        await tx.wait();
    }

    public async swapGivenOut(usdc: string, xhqr: string, signer: Signer) {

        const {td, vault, poolId} = await this.setup();

        const sa = await signer.getAddress();

        const amountOut = scaleUp(10, 18);

        const maxAmountIn = PoolWrapper.MAX_UINT256;

        await td.approveTransfer(usdc, signer, vault.address, maxAmountIn);

        const singleSwap: IVault.SingleSwapStruct = {
            poolId: poolId,
            kind: SwapKind.GivenOut,
            assetIn: usdc,
            assetOut: xhqr,
            amount: amountOut,
            userData: '0x'
        };

        const funds: IVault.FundManagementStruct = {
            sender: sa,
            recipient: sa,
            fromInternalBalance: false,
            toInternalBalance: false
        };

        const deadline: BigNumber = PoolWrapper.MAX_UINT256;

        const tx = await vault.connect(signer).swap(
            singleSwap,
            funds,
            maxAmountIn,
            deadline
        );
        const receipt = await tx.wait();

        {
            const args = inReceipt(receipt, 'Swap').args;
            const amountIn = parseFloat(scaleDn(args.amountIn,6));
            const amountOut = parseFloat(scaleDn(args.amountOut,18));
            const price = amountIn / amountOut;
            console.log("price:", price, amountIn, amountOut);
        }
    }

    public async swapGivenIn(usdc: string, xhqr: string, signer: Signer) {

        const {td, vault, poolId} = await this.setup();

        const sa = await signer.getAddress();

        const amountIn = scaleUp(10, 18);

        const minAmountOut = 0;

        await td.approveTransfer(xhqr, signer, vault.address, amountIn);

        const singleSwap: IVault.SingleSwapStruct = {
            poolId: poolId,
            kind: SwapKind.GivenIn,
            assetIn: xhqr,
            assetOut: usdc,
            amount: amountIn,
            userData: '0x'
        };

        const funds: IVault.FundManagementStruct = {
            sender: sa,
            recipient: sa,
            fromInternalBalance: false,
            toInternalBalance: false
        };

        const deadline: BigNumber = PoolWrapper.MAX_UINT256;

        const tx = await vault.connect(signer).swap(
            singleSwap,
            funds,
            minAmountOut,
            deadline
        );

        const receipt = await tx.wait();
        {
            const args = inReceipt(receipt, 'Swap').args;
            const amountIn = parseFloat(scaleDn(args.amountIn,18));
            const amountOut = parseFloat(scaleDn(args.amountOut,6));
            const price = amountOut / amountIn;
            console.log("price:", price, amountOut, amountIn);
        }


    }

    private async setup() {
        const td = new TokenDeployer();
        const pool = this.pool!
        const vault = await new VaultDeployer().attachVault(await pool.getVault());
        const poolId = await pool.getPoolId();
        return {td, pool, vault, poolId};
    }

    public async diagnostics() {
        const pool = this.pool!;
        const {value1, isUpdating1} = await pool.getAmplificationParameter1();
        console.log("A1: ", scaleDn(value1, 3), "U", isUpdating1, "P");
        const {value2, isUpdating2} = await pool.getAmplificationParameter2();
        console.log("A2: ", scaleDn(value2, 3), "U", isUpdating2, "P");
        console.log("SwapFee:", (await pool.getProtocolFeePercentageCache(0)).toString());
        console.log("Yield:", (await pool.getProtocolFeePercentageCache(2)).toString());
        console.log("FeeDelegation:", (await pool.getProtocolSwapFeeDelegation()));

        console.log("supplay", scaleDn(await pool.totalSupply(), 18));
        console.log("rate   ", scaleDn(await pool.getRate(), 18));
    }

    public async updateAmps() {
        // stopAmplificationParameter1Update
        // startAmplificationParameter2Update
        // stopAmplificationParameter2Update

        // updateProtocolFeePercentageCache

        const pool = this.pool!;

        const newAmp = scaleUp(450, 0);
        const duration = BigNumber.from(3).mul(PoolWrapper.DAY);
        const refTime = await currentTimestamp();
        const startTime = refTime.add(1);
        const endTime = startTime.add(duration);

        await setNextBlockTimestamp(startTime);
        await pool.startAmplificationParameter1Update(newAmp, endTime);

        {
            console.log("time", new Date(refTime.toNumber() * 1000).toString());
            const {value1, isUpdating1} = await pool.getAmplificationParameter1();
            console.log("A1: ", scaleDn(value1, 3), "U", isUpdating1, "P");
        }

        await advanceTime(duration.sub(1));

        {
            console.log("time", new Date((await currentTimestamp()).toNumber() * 1000).toString());
            const {value1, isUpdating1} = await pool.getAmplificationParameter1();
            console.log("A1: ", scaleDn(value1, 3), "U", isUpdating1, "P");
        }

    }
}
