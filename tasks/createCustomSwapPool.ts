import {ethers} from "hardhat";
import {BigNumber, utils} from "ethers";

async function main() {

    const [deployer] = await ethers.getSigners();
    let s = deployer.address;
    let b0 = (await deployer.getBalance());
    console.log("signer: %s bal: %d", s, b0);

    const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
    const oldFactoryAddress: string = '0xD7aECE617B04e6541A9B4CAFaf9a57F73538A62d';
    const factoryAddress: string = '0x8443D52547D312f82F0CB21f9B9481c887fD45B8';
    const xcrAddress: string = '0x9F205c61DA8eE3be4805B15b003b4732603f3631';
    const usdcAddress: string = '0xD87Ba7A50B2E7E660f678A895E4B72E7CB4CCd9C';
    const xcrRpAddress: string = '0x5C19e84230344518dFB1F38e6D8002F77E730C9d';
    const usdcRPAddress: string = '0xC2B0fc4F1A12566E680648832857FDBD48e09E92';

    // console.log("network: ", await ethers.provider.getNetwork());

    const [admin] = await ethers.getSigners();
    // console.log("admin: ", admin);

    const factory = await ethers.getContractFactory('ComposableCustomPoolFactory', {
        libraries: {
            CustomMath: libraryAddress
        }
    });
    const contract = await factory.attach(factoryAddress);

    const A1 = 400;
    const A2 = 400;
    const MONTH = 30 * 24 * 60 * 60;
    const swapFee = ethers.BigNumber.from(10).pow(16);

    console.log("A1: %d A2: %d D: %d fee: %s", A1, A2, MONTH, swapFee);

    // const gasPrice = ethers.BigNumber.from(10).pow(9).mul(25).div(10);
    // const gasLimit = ethers.BigNumber.from(10).pow(7).mul(3);
    // const cost = gasLimit.mul(gasPrice);
    //
    // console.log("gasPrice: %s wei / %s Gwei", gasPrice, utils.formatUnits(gasPrice, "gwei"));
    // console.log("gasLimit: %s ops", gasLimit);
    // console.log("totalCost: %s wei / %s Gwei / %s eth",
    //     cost,
    //     utils.formatUnits(cost, "gwei"),
    //     utils.formatEther(cost)
    // );

    let tx = await contract.create(
        "XCQR CustomSwap XCR/USDC",
        "csXCRUSDC",
        [xcrAddress, usdcAddress],
        A1,
        A2,
        [xcrRpAddress, usdcRPAddress],
        [MONTH, MONTH],
        [false, false],
        swapFee,
        admin.address,
        // {gasPrice: gasPrice}
    );

    //console.log("tx: ", tx);

    let receipt = await tx.wait();

    //console.log("receipt: ", receipt);

    let b1 = (await deployer.getBalance());
    let cost2: BigNumber = b0.sub(b1);

    console.log("signer: %s bal: %d cost: %d wei / %d Gwei", s, b1, cost2, cost2.div(10e9));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
