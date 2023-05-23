const {expect} = require("chai");

const {loadFixture} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

describe("Rate Provider contract", function () {

    let decimals = hre.ethers.BigNumber.from(10).pow(18)

    async function deployRateProviderFixture() {
        const factory = await hre.ethers.getContractFactory("XCQRRateProvider");
        const [owner, addr1, addr2] = await hre.ethers.getSigners();
        const rateProvider = await factory.deploy();
        await rateProvider.deployed();
        return {rateProvider, owner, addr1, addr2};
    }

    describe("Storage", function () {

        it('retrieve default rate', async function () {
            const {rateProvider} = await loadFixture(deployRateProviderFixture);
            const rate = await rateProvider.getRate();
            expect(rate).to.equal(hre.ethers.BigNumber.from(1).mul(decimals));
        });

        it('retrieve returns a value previously stored', async function () {
            const {rateProvider} = await loadFixture(deployRateProviderFixture);
            await rateProvider.setRate(hre.ethers.BigNumber.from(10).mul(decimals));
            const rate = await rateProvider.getRate();
            expect(rate).to.equal(hre.ethers.BigNumber.from(10).mul(decimals));
        });

    });

});
