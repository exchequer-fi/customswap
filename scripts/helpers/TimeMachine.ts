import {ethers, network} from "hardhat";
import {bn} from "./numbers";
import {BigNumber} from "ethers";

export async function currentTimestamp() {
    const {timestamp} = await network.provider.send('eth_getBlockByNumber', ['latest', true]);
    return bn(timestamp);
}

export async function setNextBlockTimestamp(timestamp: BigNumber) {
    await ethers.provider.send('evm_setNextBlockTimestamp', [parseInt(timestamp.toString())]);
}

export async function advanceTime(seconds: BigNumber) {
    await ethers.provider.send('evm_increaseTime', [parseInt(seconds.toString())]);
    await ethers.provider.send('evm_mine', []);
}

export function delay(ms: number) {
    console.log("sleep", ms, "ms")
    return new Promise(resolve => setTimeout(resolve, ms));
}