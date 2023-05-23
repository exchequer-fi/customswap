import path from "path";

const solc = require('solc')
const fs = require('fs')

const CONTRACT_FILE = 'ComposableCustomPool.sol'

const content = fs.readFileSync('contracts/' + CONTRACT_FILE).toString()

const input = {
    language: 'Solidity',
    sources: {
        [CONTRACT_FILE]: {
            content: content
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*']
            }
        },
        optimizer: {
            enabled: true,
            runs: 200,
        },
    }
}

solc;
function findImports(relativePath: string) {
    //my imported sources are stored under the node_modules folder!
    let absolutePath = "";
    if (relativePath == "hardhat/console.sol") {
        absolutePath = path.resolve(__dirname, '../node_modules', relativePath);
    } else {
        absolutePath = path.resolve(__dirname, '../contracts', relativePath);
    }

    // console.log("path ", relativePath, "=>", absolutePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    return {contents: source};
}

// console.log("input: ", input);

const output = JSON.parse(solc.compile(JSON.stringify(input), {import: findImports}))

console.log("output: ", output);


for (const contractName in output.contracts[CONTRACT_FILE]) {
    const c1 = output.contracts[CONTRACT_FILE][contractName].evm.bytecode;
    const c2 = output.contracts[CONTRACT_FILE][contractName].evm.deployedBytecode;

    console.log(contractName, ": ", c1.object.length, c2.object.length);
    fs.writeFile("bytecode.hex", c2.object, function () {
        console.log("The file was saved!");
    });
}