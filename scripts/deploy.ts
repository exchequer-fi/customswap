import {ethers} from "hardhat";
import {Contract} from "ethers";
import {fp} from "../test/helpers/numbers";

import {ComposableCustomPoolFactory} from "../typechain-types/ComposableCustomPoolFactory";

const SECOND = 1;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function deployToken() {
    const factory = await ethers.getContractFactory("TestToken");
    const contract = await factory.deploy("Wrapped ETH", "WETH", 18);
    console.log("TestToken address:", contract.address);
    return contract.deployed();
}

async function deployWETH() {
    const factory = await ethers.getContractFactory("TestWETH");
    const contract = await factory.deploy();
    console.log("WETH address:", contract.address);
    return contract.deployed();
}

async function deployAuthorizer(from: string) {
    const factory = await ethers.getContractFactory("TimelockAuthorizer");
    const contract = await factory.deploy(from, ZERO_ADDRESS, MONTH);
    console.log("TimelockAuthorizer address:", contract.address);
    return contract.deployed();
}

async function deployVault(from: string) {

    const authorizer = await deployAuthorizer(from);

    const wETH = await deployWETH();

    const pauseWindowDuration = 3 * MONTH;

    const bufferPeriodDuration = MONTH;

    const factory = await ethers.getContractFactory("Vault");
    const contract = await factory.deploy(
        authorizer.address,
        wETH.address,
        pauseWindowDuration,
        bufferPeriodDuration
    );
    console.log("Vault address:", contract.address);

    return contract.deployed();
}

async function deployProtocolFeeProvider(vault: Contract) {
    const maxYieldValue = fp(0.5);
    const maxAUMValue = fp(0.5);

    const factory = await ethers.getContractFactory("ProtocolFeePercentagesProvider");

    const contract = await factory.deploy(
        vault.address,
        maxYieldValue,
        maxAUMValue
    );
    console.log("Fee Provider address:", contract.address);
    return contract.deployed();
}

async function deployCustomMath() {
    const factory = await ethers.getContractFactory("CustomMath");
    const contract = await factory.deploy();
    console.log("CustomMathLib address:", contract.address);
    return contract.deployed();
}

async function deployCustomSwapFactory(from: string, customMathLib: Contract) {

    const factory = await ethers.getContractFactory("ComposableCustomPoolFactory", {
        libraries: {
            CustomMath: customMathLib.address
        }
    });

    const vault = await deployVault(from);

    const protocolFeeProvider = await deployProtocolFeeProvider(vault);

    const contract = await factory.deploy(vault.address, protocolFeeProvider.address);

    console.log("ComposableCustomPoolFactory address:", contract.address);
    return contract.deployed();

}

async function deployPool(factory: ComposableCustomPoolFactory) {

    // const pool = factory.create();

}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const customMathLib = await deployCustomMath();
    const customPoolFactory = await deployCustomSwapFactory(deployer.address, customMathLib);

    await deployPool(customPoolFactory);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
