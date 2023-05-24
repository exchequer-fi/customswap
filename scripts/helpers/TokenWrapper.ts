import {scaleDn} from "./biggy";
import {TokenDeployer} from "./TokenDeployer";
import {TestToken} from "../../typechain-types/solidity-utils/test/TestToken";
import {BigNumber, Signer} from "ethers";

export class TokenWrapper {

    private token: TestToken;

    constructor(token: TestToken) {
        this.token = token;
    }
    public static async printTokens(tokens: string[], address: string) {
        console.log("ACCNT TOKENS:", address);
        for (let i = 0; i < tokens.length; i++) {
            const t = await TokenDeployer.attach(tokens[i]);
            const s = await t.symbol();
            const b = await t.balanceOf(address);
            const d = await t.decimals();
            console.log(s, scaleDn(b, d));
        }
    }
    public static async approveTransfer(token: string, signer: Signer, to: string, amount: BigNumber) {
        let t = await TokenDeployer.connect(token, signer);
        (await t.approve(to, amount)).wait();
        //const scale = scaleUp(1, await t.decimals());
        //let b = (await t.balanceOf(signer.getAddress())).div(scale);
        //let a = (await t.allowance(signer.getAddress(), to)).div(scale);
        //let sym = await t.symbol();
        // console.log(sym, "bal:", b.toNumber(), "allow:", a.toNumber());
    }

}