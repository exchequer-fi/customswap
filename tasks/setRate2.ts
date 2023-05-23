import {ethers} from "hardhat";
import {BigNumber} from "ethers";

async function setRate2() {
    const decimals = ethers.BigNumber.from(10).pow(18);

    const [deployer] = await ethers.getSigners();
    let s = deployer.address;
    let b0 = (await deployer.getBalance());
    console.log("signer: %s bal: %d", s, b0);

    // Set up an ethers contract, representing our deployed Box instance
    // const address = "0xD7aECE617B04e6541A9B4CAFaf9a57F73538A62d";
    //const factory = await ethers.getContractFactory('ComposableCustomPoolFactory');
    //const f1 = await factory.attach(address);
    const address1: string = '0x5C19e84230344518dFB1F38e6D8002F77E730C9d';
    const address2: string = '0xC2B0fc4F1A12566E680648832857FDBD48e09E92';
    const factory = await ethers.getContractFactory('CustomPoolRateProvider');
    const contract = await factory.attach(address2);

    let r = await contract.getRate();

    console.log("the old rate is " + r.toString());

    let newRate;
    if (r.eq(decimals.mul(5))) {
        newRate = ethers.BigNumber.from(1);
    } else {
        newRate = ethers.BigNumber.from(1);
    }
    // const gasPrice = ethers.BigNumber.from(10).pow(9).mul(30).div(10);
    // const gasLimit = ethers.BigNumber.from(10).pow(7).mul(3);

    const tx = await contract.setRate(ethers.BigNumber.from(newRate).mul(decimals));
    // console.log("tx: ", tx);
    let receipt = await tx.wait();
    // console.log("receipt: ", receipt);

    let rate = await contract.getRate();

    console.log("the new rate is " + rate.toString());

    let b1 = (await deployer.getBalance());
    let cost: BigNumber = b0.sub(b1);

    console.log("signer: %s bal: %d cost: %d wei / %d Gwei", s, b1, cost, cost.div(10e9));

}

setRate2()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
