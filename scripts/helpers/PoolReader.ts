import {ComposableCustomPool} from "../../typechain-types/ComposableCustomPool";
import {PoolDeployer} from "./PoolDeployer";
import {setWith} from "lodash";
import {VaultWrapper} from "./VaultWrapper";
import {VaultDeployer} from "./VaultDeployer";
import {TokenDeployer} from "./TokenDeployer";

export class PoolReader {

    private readonly pool: ComposableCustomPool;

    constructor(pool: ComposableCustomPool) {
        this.pool = pool;
    }

    async read() {

        const pool = this.pool;

        console.log("desc:".padEnd(20), await pool.name());
        console.log("symbol:".padEnd(20), await pool.symbol());
        console.log("id:".padEnd(20), await pool.getPoolId());
        console.log("owner:".padEnd(20), await pool.getOwner());
        console.log("authorizer:".padEnd(20), await pool.getAuthorizer());
        console.log("vault:".padEnd(20), await pool.getVault());
        console.log("ProtocolFeeCollector".padEnd(20), await pool.getProtocolFeesCollector());
        console.log("decimals:".padEnd(20), await pool.decimals());
        let f = await pool.getScalingFactors();
        console.log("Scaling Factors:".padEnd(20), f[0].toString(), f[1].toString(), f[2].toString());
        console.log("inRecoveryMode:".padEnd(20), await pool.inRecoveryMode());
        // getSwapFeePercentage & Set
        let s = await pool.getPausedState();
        console.log("pause:".padEnd(20), "pause", s[0], "pauseWindowEndTime", s[1].toString(), "bufferPeriodEndTime", s[2].toString());

        console.log("fee %:".padEnd(20), (await pool.getSwapFeePercentage()).toString());

        {// storage
            // getRateProviders
            // getVirtualSupply
            // isTokenExemptFromYieldProtocolFee
            console.log("BPT Index:".padEnd(20), (await pool.getBptIndex()).toString());
            console.log("Virtual Supply:".padEnd(20), (await pool.getVirtualSupply()).toString());
        }
        {// Amplification
            const {value1, isUpdating1, precision1} = await pool.getAmplificationParameter1();
            console.log("A1:".padEnd(20), value1.toNumber(), isUpdating1, precision1.toNumber());
            const {value2, isUpdating2, precision2} = await pool.getAmplificationParameter2();
            console.log("A2:".padEnd(20), value2.toNumber(), isUpdating2, precision2.toNumber());
            // startAmplificationParameter1Update
            // stopAmplificationParameter1Update
            // startAmplificationParameter2Update
            // stopAmplificationParameter2Update

        }
        {// rate provider

            const vaultAddress = await pool.getVault();

            const vault = await VaultDeployer.connect(vaultAddress, pool.signer);

            const {tokens,} = await vault.getPoolTokens(await pool.getPoolId());

            const bpt = (await pool.getBptIndex()).toNumber();
            for (let i = 0; i < tokens.length; i++) {
                const token = await TokenDeployer.connect(tokens[i], pool.signer);
                const sym = await token.symbol();
                if (i == bpt) continue;
                const {duration, expires, rate} = await pool.getTokenRateCache(token.address);
                console.log(sym.padEnd(20), "rate", (await pool.getTokenRate(tokens[i])).toString(), "cache", duration.toString(), expires.toString(), rate.toString());
            }
        }

        if (false) {
            const rp = await pool.getRateProviders();
            for (let i = 0; i < rp.length; i++) {
                if (rp[i] == "0x0000000000000000000000000000000000000000") continue;
                const r = await PoolDeployer.attachRateProvider(rp[i]);
                console.log("rate from provider", i, (await r.getRate()).toString());
            }
        }

        if (false) {
            console.log("Fee % SWAP: ", (await pool.getProtocolFeePercentageCache(0)).toString());
            // UNHANDLED_FEE_TYPE
            // console.log("Fee % FLASH_LOAN: ", await pool.getProtocolFeePercentageCache(1));
            console.log("Fee % YIELD: ", (await pool.getProtocolFeePercentageCache(2)).toString());
            console.log("Fee % AUM: ", (await pool.getProtocolFeePercentageCache(3)).toString());
            console.log("SwapFeeDelegation: ", (await pool.getProtocolSwapFeeDelegation()));
            // updateProtocolFeePercentageCache
        }

    }

}