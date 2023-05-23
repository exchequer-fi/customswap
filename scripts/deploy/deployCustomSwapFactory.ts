import {ethers} from 'hardhat';
import * as fs from 'fs';

type VaultDeployment = {
    authorizer: string;
    vault: string;
    balancerHelpers: string;
    protocolFeePercentagesProvider: string;
    weth: string;
    customMath: string;
};

async function loadDeployment(): Promise<VaultDeployment> {
    const hre = require("hardhat");
    const configFile = './deployments/' + hre.network.name + '.json';
    const loadedConfig = fs.readFileSync(configFile, 'utf-8');
    const config = JSON.parse(loadedConfig);

    const contracts = {
        authorizer: config.balancer.authorizer['20210418'],
        vault: config.balancer.vault['20210418'],
        balancerHelpers: config.balancer.balancerHelpers['20210418'],
        protocolFeePercentagesProvider: config.balancer.protocolFeePercentagesProvider['20220725'],
        weth: config.goerli.weth,
        customMath: config.XCQR.customMath['20230511'],
    } as VaultDeployment;

    console.log(configFile, contracts);
    return contracts;

}

async function main() {

    const contracts = await loadDeployment();


    const [deployer] = await ethers.getSigners();

    console.log("Deploying address / bal ", deployer.address, (await deployer.getBalance()).toString());

    const factory = await ethers.getContractFactory(
        "ComposableCustomPoolFactory",
        {
            signer: deployer,
            libraries: {CustomMath: contracts.customMath}
        }
    );

    console.log(contracts.vault, contracts.protocolFeePercentagesProvider);
    const contract = await factory.deploy(contracts.vault, contracts.protocolFeePercentagesProvider);
    console.log("ComposableCustomPoolFactory address:", contract.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
