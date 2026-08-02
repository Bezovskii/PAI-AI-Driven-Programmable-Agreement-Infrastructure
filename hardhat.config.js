require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ quiet: true });

const networks = {
    localhost: {
        url: "http://localhost:8545",
        chainId: 31337,
    },
};

// Add Sepolia only when both required secrets exist.
// This prevents local tools from receiving undefined network values.
if (process.env.SEPOLIA_RPC_URL && process.env.PRIVATE_KEY) {
    networks.sepolia = {
        url: process.env.SEPOLIA_RPC_URL,
        accounts: [process.env.PRIVATE_KEY],
    };
}

module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks,
};