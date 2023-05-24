import {ethers} from "hardhat";
import {Signer} from "ethers";

export class VaultDeployer {

    public static readonly SECOND = 1;
    public static readonly MINUTE = this.SECOND * 60;
    public static readonly HOUR = this.MINUTE * 60;
    public static readonly DAY = this.HOUR * 24;
    public static readonly MONTH = this.DAY * 30;
    public static readonly ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    private readonly pauseWindowDuration = 3 * VaultDeployer.MONTH;
    private readonly bufferPeriodDuration = VaultDeployer.MONTH;

    private async deployAuthorizer(from: string) {
        const factory = await ethers.getContractFactory("TimelockAuthorizer");
        return factory.deploy(from, VaultDeployer.ZERO_ADDRESS, VaultDeployer.MONTH);
    }

    public async deployVault(admin: string, wethAddress: string) {
        const authorizer = await this.deployAuthorizer(admin);
        const factory = await ethers.getContractFactory("Vault");
        return await factory.deploy(
            authorizer.address,
            wethAddress,
            this.pauseWindowDuration,
            this.bufferPeriodDuration
        );
    }

    public static async connect(address: string, signer: Signer) {
        const factory = await ethers.getContractFactory("Vault");
        return factory.attach(address).connect(signer);
    }
}