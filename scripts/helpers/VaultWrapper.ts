import {TokenDeployer} from "./TokenDeployer";
import {scaleDn} from "./biggy";
import {Vault} from "../../typechain-types/vault/Vault";
export class VaultWrapper {

    private vault: Vault;

    constructor(vault: Vault) {
        this.vault = vault;

    }

    public async getAddress() {
        return await this.vault.address;
    }

    public async getTokens(poolId: string) {
        const {tokens: tokens} = await this.vault.getPoolTokens(poolId);
        return tokens;
    }

    public async printTokens(poolId: string) {
        console.log("VAULT TOKENS");
        const {tokens: tokens, balances,} = await this.vault.getPoolTokens(poolId);
        for (let i = 0; i < tokens.length; i++) {
            const t = await TokenDeployer.attach(tokens[i]);
            const s = await t.symbol();
            const d = await t.decimals();
            console.log(s.padEnd(10), scaleDn(balances[i], d));
        }
    }

    // public async grantPermission(action: string, actorAddress: string) {
    //     const selector = this.vault.interface.getSighash(action);
    //     const actionId = await this.vault.getActionId(selector);
    //     const authorizer = await new VaultWeapper().attachAuthorizer(await vault.getAuthorizer());
    //     await authorizer.grantPermissions([actionId], actorAddress, [VaultWeapper.ANY_ADDRESS]);
    // }


    // public async grantPermission(action: string, address: string) {
    //     const selector = this.pool.interface.getSighash(action);
    //     const actionId = await this.pool.getActionId(selector);
    //     const actionIds = [actionId];
    //     const wheres = actionIds.map(() => VaultDeployer.ANY_ADDRESS);
    //     const authorizer = await new VaultDeployer().attachAuthorizer(await this.pool.getAuthorizer());
    //     await authorizer.grantPermissions(actionIds, address, wheres);
    // }

}