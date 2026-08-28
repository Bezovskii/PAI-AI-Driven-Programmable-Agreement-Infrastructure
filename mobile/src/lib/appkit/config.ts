import '@walletconnect/react-native-compat';
import 'react-native-get-random-values';

import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import {
    createAppKit,
    type AppKitNetwork,
} from '@reown/appkit-react-native';

import { appKitStorage } from './storage';

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
    throw new Error(
        'Missing EXPO_PUBLIC_REOWN_PROJECT_ID. Add it to mobile/.env.',
    );
}

export const sepoliaNetwork: AppKitNetwork = {
    id: 11155111,
    name: 'Sepolia',
    nativeCurrency: {
        name: 'Sepolia Ether',
        symbol: 'ETH',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ['https://ethereum-sepolia-rpc.publicnode.com'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Etherscan',
            url: 'https://sepolia.etherscan.io',
        },
    },
    chainNamespace: 'eip155',
    caipNetworkId: 'eip155:11155111',
    testnet: true,
};

const ethersAdapter = new EthersAdapter();

export const appKit = createAppKit({
    projectId,

    adapters: [ethersAdapter],

    networks: [sepoliaNetwork],

    defaultNetwork: sepoliaNetwork,

    storage: appKitStorage,

    metadata: {
        name: 'PAI Mobile',
        description: 'Programmable Agreement Infrastructure for digital work.',
        url: 'https://multi-payment-dapp.vercel.app',
        icons: [],
        redirect: {
            native: 'pai://',
        },
    },

    themeMode: 'dark',

    features: {
        swaps: false,
        onramp: false,
        socials: false,
        showWallets: true,
    },
});

export { ethersAdapter };

