import {ethers} from "hardhat";

async function main() {
    const libraryAddress: string = '0xCc3650F13Aa626222e41101a6C9Aac31554E481E';
    const factoryAddress: string = '0xD7aECE617B04e6541A9B4CAFaf9a57F73538A62d';

    const accounts = await ethers.provider.listAccounts();
    console.log(accounts);
    console.log(await ethers.provider.getNetwork());

    const factory = await ethers.getContractFactory('ComposableCustomPoolFactory', {
        libraries: {
            CustomMath: libraryAddress
        }
    });
    const contract = await factory.attach(factoryAddress);


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
