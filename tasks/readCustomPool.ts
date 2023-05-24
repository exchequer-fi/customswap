import {ethers} from "hardhat";

import {ComposableCustomPool} from "../typechain-types/ComposableCustomPool"
import {VaultWrapper} from "../scripts/helpers/VaultWrapper";
import {VaultDeployer} from "../scripts/helpers/VaultDeployer";

const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
const vaultAddress: string = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const poolAddress: string = "0x0167Cf094f922e2Bc71f4935778a618d555d3735";

async function getPool() {

    const factory = await ethers.getContractFactory("ComposableCustomPool", {
        libraries: {
            CustomMath: libraryAddress
        }
    });

    const pool = await factory.attach(poolAddress);
    return pool.deployed();
}

async function readSwap(pool: ComposableCustomPool) {

    {   // General Pool

        console.log("desc: ", await pool.name());
        console.log("symbol: ", await pool.symbol());
        console.log("decimals: ", await pool.decimals());
        console.log("id: ", await pool.getPoolId());
        console.log("owner: ", await pool.getOwner());
        console.log("authorizer: ", await pool.getAuthorizer());
        console.log("vault: ", await pool.getVault());
        // getSwapFeePercentage & Set
        console.log("fee %: ", await pool.getSwapFeePercentage());
        let f = await pool.getScalingFactors();
        console.log("Scaling Factors: ", f);
        console.log("inRecoveryMode: ", await pool.inRecoveryMode());
        console.log("ProtocolFeesCollector: ", await pool.getProtocolFeesCollector());

        // setAssetManagerPoolConfig
        // pause
        // unpause
    }
    {// Authorization
        // getActionId
    }
    {// storage
        // getRateProviders
        // getVirtualSupply
        // isTokenExemptFromYieldProtocolFee
        console.log("BPT Index: ", await pool.getBptIndex());
    }
    {// Amplification
        const {value1, isUpdating1, precision1} = await pool.getAmplificationParameter1();
        console.log("A1: ", value1, isUpdating1, precision1);
        const {value2, isUpdating2, precision2} = await pool.getAmplificationParameter2();
        console.log("A2: ", value2, isUpdating2, precision2);
        // startAmplificationParameter1Update
        // stopAmplificationParameter1Update
        // startAmplificationParameter2Update
        // stopAmplificationParameter2Update

    }
    {// rate provider
        const xcrAddress: string = '0x9F205c61DA8eE3be4805B15b003b4732603f3631';
        console.log("XCR rate: ", await pool.getTokenRate(xcrAddress));
        const {duration, expires, rate} = await pool.getTokenRateCache(xcrAddress);
        console.log("XCR cache rate: ", duration, expires, rate);
    }
    {
        const usdcAddress: string = '0xD87Ba7A50B2E7E660f678A895E4B72E7CB4CCd9C';
        console.log("USDC rate: ", await pool.getTokenRate(usdcAddress));
        const {duration, expires, rate} = await pool.getTokenRateCache(usdcAddress);
        console.log("USDC cache rate: ", duration, expires, rate);

        // setTokenRateCacheDuration
        // updateTokenRateCache
    }
    {
        console.log("Fee % SWAP: ", await pool.getProtocolFeePercentageCache(0));
        // UNHANDLED_FEE_TYPE
        // console.log("Fee % FLASH_LOAN: ", await pool.getProtocolFeePercentageCache(1));
        console.log("Fee % YIELD: ", await pool.getProtocolFeePercentageCache(2));
        console.log("Fee % AUM: ", await pool.getProtocolFeePercentageCache(3));
        console.log("SwapFeeDelegation: ", await pool.getProtocolSwapFeeDelegation());
        // updateProtocolFeePercentageCache
    }

}

async function main() {

    let [signer,] = await ethers.getSigners();

    const pool = await getPool();

    await readSwap(pool);

    const poolId = await pool.getPoolId();

    const vault = await VaultDeployer.connect(vaultAddress, signer);

    const vw = new VaultWrapper(vault);

    await vw.printTokens(poolId);


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
