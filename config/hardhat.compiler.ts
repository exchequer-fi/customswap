export const hardhatCompilerConfig = {
    compilers: [
        {
            version: '0.7.1',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 9999
                }
            }
        }
    ],
    overrides: {
        'contracts/ComposableCustomPool.sol': {
            version: '0.7.1',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 500,
                },
            },
        },
        'contracts/MockComposableCustomPool.sol': {
            version: "0.7.1",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 100,
                },
            },
        },
        'contracts/vault/Vault.sol': {
            version: "0.7.1",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 500,
                },
            },
        },
    }
};
