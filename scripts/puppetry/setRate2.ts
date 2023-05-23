import {ethers} from "hardhat";

async function setRate2() {
    const decimals = ethers.BigNumber.from(10).pow(18);
    const accounts = await ethers.provider.listAccounts();
    console.log(accounts);
    // Set up an ethers contract, representing our deployed Box instance
    // const address = "0xD7aECE617B04e6541A9B4CAFaf9a57F73538A62d";
    //const factory = await ethers.getContractFactory('ComposableCustomPoolFactory');
    //const f1 = await factory.attach(address);
    const address: string = '0x5C19e84230344518dFB1F38e6D8002F77E730C9d';
    const factory = await ethers.getContractFactory('XCQRRateProvider');
    const contract = await factory.attach(address);
    const tx = await contract.setRate(ethers.BigNumber.from(3).mul(decimals));
    await tx.wait();
    let rate = await contract.getRate();
    console.log("the new rate is " + rate.div(decimals));
}

setRate2()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
