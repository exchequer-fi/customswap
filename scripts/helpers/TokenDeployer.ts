import {ethers} from "hardhat";
import {Signer} from "ethers";

export class TokenDeployer {

    public async deployToken(desc: string, symbol: string, decimal: number) {
        const factory = await ethers.getContractFactory("TestToken");
        return factory.deploy(desc, symbol, decimal);
    }

    public async deployWETH() {
        const factory = await ethers.getContractFactory("TestWETH");
        return factory.deploy();
    }

    public static async connect(address: string, signer: Signer) {
        const factory = await ethers.getContractFactory("TestToken");
        return factory.attach(address).connect(signer);
    }
   public static async attach(address: string) {
        const factory = await ethers.getContractFactory("TestToken");
        return factory.attach(address);
    }

}