require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ quiet: true });

const networks = {
    localhost: {
        url: "http://localhost:8545",
        chainId: 31337,
    },
};

if (process.env.SEPOLIA_RPC_URL && process.env.PRIVATE_KEY) {
    networks.sepolia = {
        url: process.env.SEPOLIA_RPC_URL,
        accounts: [process.env.PRIVATE_KEY],
    };
}

module.exports = {
    solidity: {
        version: "0.8.35",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            evmVersion: "cancun",
        },
    },
    networks,
};