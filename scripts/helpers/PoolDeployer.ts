import {ethers} from "hardhat";
import {ContractReceipt, Signer} from "ethers";
import {fp} from "./numbers";
import {scaleUp} from "./biggy";
import {TokenDeployer} from "./TokenDeployer";

export class PoolDeployer {

    public readonly customMath: string;

    public readonly desc: string = "XCQR CustomSwap XCQR/USDC";
    public readonly symbol: string = "BPTT";
    public readonly MONTH = 30 * 24 * 60 * 60;
    public readonly swapFee = ethers.BigNumber.from(10).pow(16);

    public readonly maxYieldValue = fp(0.5);
    public readonly maxAUMValue = fp(0.5);

    public readonly xcqrRate: number = 1;
    public readonly usdcRate: number = 1;

    constructor(customMath: string) {
        this.customMath = customMath;
    }

    private async deployProtocolFeeProvider(vault: string) {
        const factory = await ethers.getContractFactory("ProtocolFeePercentagesProvider");
        return await factory.deploy(
            vault,
            this.maxYieldValue,
            this.maxAUMValue
        );
    }

    private async deployRateProvider() {
        const factory = await ethers.getContractFactory("CustomPoolRateProvider");
        return await factory.deploy();
    }

    private async attachCustomSwapFactory(address: string) {
        const factory = await ethers.getContractFactory("ComposableCustomPoolFactory", {
            libraries: {
                CustomMath: this.customMath
            }
        });
        return factory.attach(address);
    }

    private async deployCustomSwapFactory(vaultAddress: string) {
        const factory = await ethers.getContractFactory("ComposableCustomPoolFactory", {
            libraries: {
                CustomMath: this.customMath
            }
        });
        const protocolFeeProvider = await this.deployProtocolFeeProvider(vaultAddress);
        return await factory.deploy(vaultAddress, protocolFeeProvider.address);
    }

    private getCreatedPoolId(receipt: ContractReceipt) {
        if (receipt.events == undefined) return undefined;
        for (let i = 0; i < receipt.events.length; i++) {
            let event = receipt.events[i];
            if (event.event == 'PoolCreated') {
                let args = event.args!;
                return args.at(0);
            }
        }
    }

    private async attachPool(address: string) {
        const factory = await ethers.getContractFactory("ComposableCustomPool", {
                libraries: {
                    CustomMath: this.customMath
                }
            }
        );
        return factory.attach(address);
    }

    public static async attachRateProvider(address: string) {
        const factory = await ethers.getContractFactory("CustomPoolRateProvider");
        return factory.attach(address);
    }

    public async deployPool(vaultAddress: string, tokens: string[], amps: number[], admin: string) {

        const factory = await this.deployCustomSwapFactory(vaultAddress);

        if (tokens[0].toUpperCase() > tokens[1].toUpperCase()){
            const tmp1 = tokens[0];
            tokens[0] = tokens[1];
            tokens[1] = tmp1;
            const tmp2 = amps[0];
            amps[0] = amps[1];
            amps[1] = tmp2;
        }

        tokens.sort((one, two) => (one.toUpperCase() > two.toUpperCase() ? 1 : -1));

        console.log("provider rates");

        let providers: string[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const a = tokens[i];
            const p = await this.deployRateProvider();
            const t = await TokenDeployer.attach(a);
            const s = await t.symbol();
            // Always return 18 even if the token t.decimals() is not 18
            const d: number = 18;
            let r0;
            switch (s) {
                case "USDC":
                    r0 = scaleUp(this.usdcRate, d);
                    break;
                case "XCHR":
                    r0 = scaleUp(this.xcqrRate, d);
                    break;
                default:
                    r0 = 0;
                    break
            }
            await p.setRate(r0);
            const r1 = await p.getRate();
            providers.push(p.address);
            console.log(s, t.address, r1.toString());
        }

        const tx = await factory.create(
            this.desc,
            this.symbol,
            tokens,
            amps[0],
            amps[1],
            providers,
            [this.MONTH, this.MONTH],
            [false, false],
            this.swapFee,
            admin
        );

        let receipt = await tx.wait();

        let newPoolId = this.getCreatedPoolId(receipt);

        return await this.attachPool(newPoolId);

    }

    public static async connect(address: string, customMath: string, signer: Signer) {
        const factory = await ethers.getContractFactory("ComposableCustomPool", {
                libraries: {
                    CustomMath: customMath
                }
            }
        );
        const pool = await factory.attach(address);
        return pool.connect(signer);
    }
}