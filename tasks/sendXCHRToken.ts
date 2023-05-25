import {ethers} from "hardhat";

const signerAddress: string = "0xd713Eef55104c67cA1A6a1dB617FaeE1831cF5e3";

async function main() {

    const [signer] = await ethers.getSigners();
    // await network.provider.request({method: "hardhat_impersonateAccount", params: [signerAddress]});
    // const signer = await ethers.provider.getSigner(signerAddress);

    const factory = await ethers.getContractFactory("TestToken");

    const address = "0x9F205c61DA8eE3be4805B15b003b4732603f3631";

    const token = await factory.attach(address);

    const decimals = ethers.BigNumber.from(10).pow(18);

    const bunny = "0xA91AccFfaf556C45d18dd33B8c9B82CD3464DCCB";

    const [deployer] = await ethers.getSigners();

    console.log(await token.symbol(), signerAddress, await token.balanceOf(signerAddress))

    const tx = await token.connect(signer).transfer(bunny, decimals.mul(1_000));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
