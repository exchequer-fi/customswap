import {ethers} from "hardhat";
import {BigNumber, Contract} from "ethers";
import {fp} from "./helpers/numbers";

import {
    ComposableCustomPoolFactory
} from "../typechain-types/ComposableCustomPoolFactory";

const SECOND = 1;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const gasPrice = ethers.BigNumber.from(10).pow(9).mul(25).div(10);
const gasLimit = ethers.BigNumber.from(30000000);

async function deployToken(desc: string, symbol: string, decimalc: number) {
    const factory = await ethers.getContractFactory("TestToken");
    const contract = await factory.deploy(desc, symbol, decimalc);
    console.log("TestToken address:", contract.address, desc, symbol);
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
        bufferPeriodDuration,
        {
            gasLimit: gasLimit,
            gasPrice: gasPrice
        }
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

async function deployRateProvider() {
    const factory = await ethers.getContractFactory("XCQRRateProvider");
    const contract = await factory.deploy();
    console.log("XCQRRateProvider address:", contract.address);
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

    console.log("deploying ComposableCustomPoolFactory");


    const contract = await factory.deploy(vault.address, protocolFeeProvider.address, {
        gasLimit: gasLimit,
        gasPrice: gasPrice
    });

    console.log("ComposableCustomPoolFactory address:", contract.address);

    return contract.deployed();

}

async function deployPool(admin: string, factory: ComposableCustomPoolFactory) {

    const A1 = 400;
    const A2 = 400;
    const MONTH = 30 * 24 * 60 * 60;
    const swapFee = ethers.BigNumber.from(10).pow(16);

    const XCR = await deployToken("XCR Test Token", "XCR", 18);
    XCR.mint(admin, 1_000_000);
    const xrcRateProvider = await deployRateProvider();
    await xrcRateProvider.setRate(BigNumber.from(10).pow(18).mul(1));
    console.log("XCR is ", await xrcRateProvider.getRate());

    const USDC = await deployToken("USDC Test Token", "USDC", 18);
    USDC.mint(admin, 3_000_000);
    const usdcRateProvider = await deployRateProvider();
    await usdcRateProvider.setRate(BigNumber.from(10).pow(18));
    console.log("USDC is ", await usdcRateProvider.getRate());

    const tx = await factory.create(
        "XCQR CustomSwap XCR/USDC",
        "csXCRUSDC",
        XCR.address < USDC.address ?
            [XCR.address, USDC.address] : [USDC.address, XCR.address],
        A1,
        A2,
        XCR.address < USDC.address ?
            [xrcRateProvider.address, usdcRateProvider.address] : [usdcRateProvider.address, xrcRateProvider.address],
        [MONTH, MONTH],
        [false, false],
        swapFee,
        admin,
        {gasLimit: gasLimit, gasPrice: gasPrice}
    );

    let receipt = await tx.wait();

}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const customMathLib = await deployCustomMath();
    const customPoolFactory = await deployCustomSwapFactory(deployer.address, customMathLib);

    await deployPool(deployer.address, customPoolFactory);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
