import {BigNumber} from "ethers";

export function scaleUp(n: number, exp: number) {
    return BigNumber.from(10).pow(exp).mul(n);
}

export function scaleDn(b: BigNumber, exp: number) {
    const divisor = BigNumber.from(10).pow(exp);
    const reminder = b.mod(divisor).toString();
    const s = b.div(divisor) + "." + reminder.padEnd(12, "0").substring(0, 12);
    return s.padStart(40);
    // return parseFloat(s);
}
