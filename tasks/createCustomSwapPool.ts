import {ethers} from "hardhat";
import {BigNumber, ContractReceipt} from "ethers";

async function getCreatedPoolId(receipt: ContractReceipt) {
    if (receipt.events == undefined) return undefined;
    for (let i = 0; i < receipt.events.length; i++) {
        let event = receipt.events[i];
        if (event.event == 'PoolCreated') {
            let args = event.args!;
            return args.at(0);
        }
    }
}


async function main() {

    const [deployer] = await ethers.getSigners();
    let s = deployer.address;
    let b0 = (await deployer.getBalance());
    console.log("signer: %s bal: %d", s, b0);

    const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
    const factoryAddress: string = '0x8443D52547D312f82F0CB21f9B9481c887fD45B8';
    const xcrAddress: string = '0x9F205c61DA8eE3be4805B15b003b4732603f3631';
    const usdcAddress: string = '0xD87Ba7A50B2E7E660f678A895E4B72E7CB4CCd9C';
    const xcrRpAddress: string = '0x5C19e84230344518dFB1F38e6D8002F77E730C9d';
    const usdcRPAddress: string = '0xC2B0fc4F1A12566E680648832857FDBD48e09E92';
    const [admin] = await ethers.getSigners();

    const factory = await ethers.getContractFactory('ComposableCustomPoolFactory', {
        libraries: {
            CustomMath: libraryAddress
        }
    });
    const contract = await factory.attach(factoryAddress);

    const A1 = 450;
    const A2 = 50;
    const MONTH = 30 * 24 * 60 * 60;
    const swapFee = ethers.BigNumber.from(10).pow(16);

    console.log("A1:", A1, "A2:", A2, "fee", swapFee);
    console.log("owner", admin.address);

    let tx = await contract.create(
        "XCQR CustomSwap XCR/USDC",
        "csXD2",
        [xcrAddress, usdcAddress],
        A1,
        A2,
        [xcrRpAddress, usdcRPAddress],
        [MONTH, MONTH],
        [false, false],
        swapFee,
        admin.address
    );

    console.log("tx: ", tx);

    let receipt = await tx.wait();

    console.log("receipt: ", getCreatedPoolId(receipt));

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
