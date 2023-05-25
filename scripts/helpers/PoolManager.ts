import {BigNumber} from "ethers";

import {Vault} from "../../typechain-types/vault/Vault";
import {TokenDeployer} from "./TokenDeployer";
import {scaleUp, scaleDn} from "./biggy";

import {ComposableCustomPool} from "../../typechain-types/ComposableCustomPool";
import {advanceTime, currentTimestamp, setNextBlockTimestamp} from "./TimeMachine";

export class PoolManager {

    private static readonly DAY = 60 * 60 * 24;

    private vault: Vault;
    private pool: ComposableCustomPool;

    constructor(vault: Vault, pool: ComposableCustomPool) {
        this.vault = vault;
        this.pool = pool;
    }

    public async poolId() {
        return this.pool.getPoolId();
    }

    public async printRates() {

        console.log("pool rates");

        const {tokens: tokens} = await this.vault.getPoolTokens(await this.pool.getPoolId());

        for (let i = 0; i < tokens.length; i++) {
            let t = await TokenDeployer.attach(tokens[i]);
            let sym = await t.symbol();
            // let scale = toBig(1, await t.decimals());
            let r = await this.pool.getTokenRate(t.address);
            if (sym == "BPTT" || sym == "csXCRUSDC") {
                console.log("%s r=%d cache: ", sym, r);
            } else {
                const {rate, oldRate, duration, expires} = await this.pool.getTokenRateCache(t.address);
                console.log("%s r=%d cache r=%d o=%d d=%d e=%d", sym,
                    r,
                    rate,
                    oldRate,
                    duration,
                    expires);
            }
        }
    }
    public async diagnostics() {
        const {value1, isUpdating1} = await this.pool.getAmplificationParameter1();
        console.log("A1: ", scaleDn(value1, 3), "U", isUpdating1, "P");
        const {value2, isUpdating2} = await this.pool.getAmplificationParameter2();
        console.log("A2: ", scaleDn(value2, 3), "U", isUpdating2, "P");
        console.log("SwapFee:", (await this.pool.getProtocolFeePercentageCache(0)).toString());
        console.log("Yield:", (await this.pool.getProtocolFeePercentageCache(2)).toString());
        console.log("FeeDelegation:", (await this.pool.getProtocolSwapFeeDelegation()));
        //console.log("supplay", scaleDn(await this.pool.totalSupply(), 18));
        //console.log("rate   ", scaleDn(await this.pool.getRate(), 18));
    }
    public async updateAmps() {

        const newAmp = scaleUp(450, 0);
        const duration = BigNumber.from(3).mul(PoolManager.DAY);
        const refTime = await currentTimestamp();
        const startTime = refTime.add(1);
        const endTime = startTime.add(duration);

        await setNextBlockTimestamp(startTime);
        await this.pool.startAmplificationParameter1Update(newAmp, endTime);

        {
            console.log("time", new Date(refTime.toNumber() * 1000).toString());
            const {value1, isUpdating1} = await this.pool.getAmplificationParameter1();
            console.log("A1: ", scaleDn(value1, 3), "U", isUpdating1, "P");
        }

        await advanceTime(duration.sub(1));

        {
            console.log("time", new Date((await currentTimestamp()).toNumber() * 1000).toString());
            const {value1, isUpdating1} = await this.pool.getAmplificationParameter1();
            console.log("A1: ", scaleDn(value1, 3), "U", isUpdating1, "P");
        }

    }
}
