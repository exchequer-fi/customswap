import {BigNumber} from "ethers";
import {ethers} from "hardhat";

export function scaleUp(n: number, exp: number) {
    return BigNumber.from(10).pow(exp).mul(n);
}

export function scaleDn(b: BigNumber, exp: number) {
    const scalar = BigNumber.from(10).pow(18 - exp);
    const str = ethers.utils.formatEther(b.mul(scalar));
    // console.log(str, b);
    return parseFloat(str);
}
