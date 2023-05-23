import {BigNumber} from "ethers";

export function scaleUp(n: number, exp: number) {
    return BigNumber.from(10).pow(exp).mul(n);
}

export function scaleDn(b: BigNumber, exp: number) {
    const divisor = BigNumber.from(10).pow(exp);
    const s = b.div(divisor) + "." + b.mod(divisor);
    return parseFloat(s);
}
