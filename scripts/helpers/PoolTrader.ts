import {BigNumber, Signer} from "ethers";

import {IVault, Vault} from "../../typechain-types/vault/Vault";
import {TokenDeployer} from "./TokenDeployer";
import {maxUint} from "./numbers";
import {inReceipt} from "./expectEvent";

import {ComposableCustomPool} from "../../typechain-types/ComposableCustomPool";
import {TestToken} from "../../typechain-types/solidity-utils/test/TestToken";

enum SwapKind {
    GivenIn = 0,
    GivenOut = 1
}

export class PoolTrader {

    private static readonly MAX_UINT256: BigNumber = maxUint(256);
    private vault: Vault;
    private pool: ComposableCustomPool;

    constructor(vault: Vault, pool: ComposableCustomPool) {
        this.vault = vault;
        this.pool = pool;
    }

    public async queryGivenOut(tokenIn: TestToken, tokenOut: TestToken, amountOut: BigNumber, signer: Signer): Promise<BigNumber> {
        {
            const poolId = await this.pool.getPoolId();

            const sa = await signer.getAddress();

            const funds: IVault.FundManagementStruct = {
                sender: sa,
                recipient: sa,
                fromInternalBalance: false,
                toInternalBalance: false
            };

            const {tokens: allTokens} = await this.vault.getPoolTokens(poolId);

            const swapStep: IVault.BatchSwapStepStruct = {
                poolId: poolId,
                assetInIndex: allTokens.indexOf(tokenIn.address),
                assetOutIndex: allTokens.indexOf(tokenOut.address),
                amount: amountOut,
                userData: '0x'
            };

            const change = await this.vault.callStatic.queryBatchSwap(
                SwapKind.GivenOut,
                [swapStep],
                allTokens,
                funds,
            );

            return change[allTokens.indexOf(tokenIn.address)];
        }

    }

    public async swapGivenOut(tokenIn: TestToken, tokenOut: TestToken, amountOut: BigNumber, signer: Signer): Promise<BigNumber> {

        const poolId = await this.pool.getPoolId();

        const sa = await signer.getAddress();

        const maxAmountIn = PoolTrader.MAX_UINT256;

        await tokenIn.connect(signer).approve(this.vault.address, maxAmountIn);

        const singleSwap: IVault.SingleSwapStruct = {
            poolId: poolId,
            kind: SwapKind.GivenOut,
            assetIn: tokenIn.address,
            assetOut: tokenOut.address,
            amount: amountOut,
            userData: '0x'
        };

        const funds: IVault.FundManagementStruct = {
            sender: sa,
            recipient: sa,
            fromInternalBalance: false,
            toInternalBalance: false
        };

        const deadline: BigNumber = PoolTrader.MAX_UINT256;

        const tx = await this.vault.connect(signer).swap(
            singleSwap,
            funds,
            maxAmountIn,
            deadline
        );

        const receipt = await tx.wait();

        const args = inReceipt(receipt, 'Swap').args;

        return args.amountIn;

    }

    public async queryGivenIn(tokenIn: TestToken, tokenOut: TestToken, amountIn: BigNumber, signer: Signer) {

        const poolId = await this.pool.getPoolId();

        const sa = await signer.getAddress();

        const funds: IVault.FundManagementStruct = {
            sender: sa,
            recipient: sa,
            fromInternalBalance: false,
            toInternalBalance: false
        };

        const {tokens: allTokens} = await this.vault.getPoolTokens(poolId);

        const swapStep: IVault.BatchSwapStepStruct = {
            poolId: poolId,
            assetInIndex: allTokens.indexOf(tokenIn.address),
            assetOutIndex: allTokens.indexOf(tokenOut.address),
            amount: amountIn,
            userData: '0x'
        };

        const change = await this.vault.callStatic.queryBatchSwap(
            SwapKind.GivenIn,
            [swapStep],
            allTokens,
            funds,
        );

        return change[allTokens.indexOf(tokenOut.address)];

    }

    public async swapGivenIn(tokenIn: TestToken, tokenOut: TestToken, amountIn: BigNumber, signer: Signer): Promise<BigNumber> {

        const poolId = await this.pool.getPoolId();

        const sa = await signer.getAddress();

        const minAmountOut = 0;

        await tokenIn.connect(signer).approve(this.vault.address, amountIn);

        const singleSwap: IVault.SingleSwapStruct = {
            poolId: poolId,
            kind: SwapKind.GivenIn,
            assetIn: tokenIn.address,
            assetOut: tokenOut.address,
            amount: amountIn,
            userData: '0x'
        };

        const funds: IVault.FundManagementStruct = {
            sender: sa,
            recipient: sa,
            fromInternalBalance: false,
            toInternalBalance: false
        };

        const deadline: BigNumber = PoolTrader.MAX_UINT256;

        const tx = await this.vault.connect(signer).swap(
            singleSwap,
            funds,
            minAmountOut,
            deadline
        );

        const receipt = await tx.wait();

        const args = inReceipt(receipt, 'Swap').args;

        return args.amountOut;

    }

}
