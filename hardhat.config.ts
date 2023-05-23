// import config before anything else
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";

import {HardhatUserConfig} from "hardhat/config";
import {hardhatCompilerConfig} from './config/hardhat.compiler';
import {hardhatSizerConfig} from './config/hardhat.sizer';
import {hardhatNetworkConfig} from './config/hardhat.network';


const config: HardhatUserConfig = {
    solidity: {
        //compilers: hardhatCompilerConfig.compilers,
        //overrides: hardhatCompilerConfig.overrides
        version: '0.7.1',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    contractSizer: hardhatSizerConfig.contractSizer,
    networks: hardhatNetworkConfig.networks,
    etherscan: hardhatNetworkConfig.etherscan,
    gasReporter: {
        enabled: false,
        currency: 'USD',
        outputFile: 'gas-report-ether.txt',
        coinmarketcap: 'COINPARKETCAP_API_KEY',
        token: 'ETH',
        gasPrice: 21,
        // https://medium.com/@abhijeet.sinha383/how-to-calculate-gas-and-costs-while-deploying-solidity-contracts-and-functions-54007d321626
    }
};

export default config;
