import {ethers} from "hardhat";
import {TokenDeployer} from "./TokenDeployer";
import {scaleDn} from "./biggy";

export class VaultDeployer {

    public static readonly SECOND = 1;
    public static readonly MINUTE = this.SECOND * 60;
    public static readonly HOUR = this.MINUTE * 60;
    public static readonly DAY = this.HOUR * 24;
    public static readonly MONTH = this.DAY * 30;
    public static readonly ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    public static readonly ANY_ADDRESS = '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF';

    private readonly pauseWindowDuration = 3 * VaultDeployer.MONTH;
    private readonly bufferPeriodDuration = VaultDeployer.MONTH;

    private async deployAuthorizer(from: string) {
        const factory = await ethers.getContractFactory("TimelockAuthorizer");
        const contract = await factory.deploy(from, VaultDeployer.ZERO_ADDRESS, VaultDeployer.MONTH);
        // console.log("TimelockAuthorizer address:", contract.address);
        return contract.deployed();
    }

    public async attachAuthorizer(address: string) {
        const factory = await ethers.getContractFactory("TimelockAuthorizer");
        const contract = await factory.attach(address);
        return contract.deployed();
    }

    public async attachVault(address: string) {
        const factory = await ethers.getContractFactory("Vault");
        const contract = await factory.attach(address);
        return contract.deployed();
    }

    public async deployVault(admin: string, wethAddress: string) {
        const authorizer = await this.deployAuthorizer(admin);
        const factory = await ethers.getContractFactory("Vault");
        const contract = await factory.deploy(
            authorizer.address,
            wethAddress,
            this.pauseWindowDuration,
            this.bufferPeriodDuration
        );

        return contract.deployed();
    }

    public async getTokens(vaultAddress: string, poolId: string) {
        // console.log("tokens");
        const vault = await this.attachVault(vaultAddress);
        const pd = new TokenDeployer();
        const {tokens: tokens} = await vault.getPoolTokens(poolId);
        for (let i = 0; i < tokens.length; i++) {
            let t = await pd.attachToken(tokens[i]);
            // console.log(await t.symbol(), t.address, await t.decimals());
        }
        return tokens;
    }

    public async printTokens(vaultAddress: string, poolId: string) {
        console.log("VAULT TOKENS:", poolId);
        const vault = await this.attachVault(vaultAddress);
        const pd = new TokenDeployer();
        const {tokens: tokens, balances, lastChangeBlock} = await vault.getPoolTokens(poolId);
        for (let i = 0; i < tokens.length; i++) {
            const t = await pd.attachToken(tokens[i]);
            const s = await t.symbol();
            const d = await t.decimals();
            console.log(s, scaleDn(balances[i], d));
        }
    }

    public async grantPermission(vaultAddress: string, action: string, actorAddress: string) {
        const vault = await this.attachVault(vaultAddress);
        const selector = vault.interface.getSighash(action);
        const actionId = await vault.getActionId(selector);
        const authorizer = await new VaultDeployer().attachAuthorizer(await vault.getAuthorizer());
        await authorizer.grantPermissions([actionId], actorAddress, [VaultDeployer.ANY_ADDRESS]);
    }

}