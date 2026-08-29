import {
  useAccount,
  useAppKit,
} from '@reown/appkit-react-native';
import { router } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';

function shortenAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AgreementsScreen() {
  const {
    open,
    disconnect,
  } = useAppKit();

  const {
    address,
    chainId,
    isConnected,
    chain,
  } = useAccount();

  const handleConnect = async () => {
    console.log('PAI_CONNECT_WALLET_PRESSED');

    try {
      await open();
    } catch (error) {
      console.error('PAI_CONNECT_ERROR', error);
    }
  };

  const handleDisconnect = async () => {
    console.log('PAI_DISCONNECT_WALLET_PRESSED');

    try {
      await disconnect();
    } catch (error) {
      console.error('PAI_DISCONNECT_ERROR', error);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </Pressable>

        <Text style={styles.eyebrow}>
          AGREEMENT WORKSPACE
        </Text>

        <Text style={styles.title}>
          Wallet connection
        </Text>

        <Text style={styles.description}>
          Connect your wallet to continue into PAI.
        </Text>

        <View style={styles.card}>
          <Text style={styles.statusLabel}>
            WALLET STATUS
          </Text>

          <Text style={styles.statusValue}>
            {isConnected ? 'Connected' : 'Not connected'}
          </Text>

          {address ? (
            <Text style={styles.address}>
              {shortenAddress(address)}
            </Text>
          ) : null}

          {chain?.name ? (
            <Text style={styles.network}>
              Network: {chain.name}
            </Text>
          ) : null}

          {chainId ? (
            <Text style={styles.network}>
              Chain ID: {String(chainId)}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Connect wallet"
            onPress={handleConnect}
            style={({ pressed }) => [
              styles.connectButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.connectButtonText}>
              Connect wallet
            </Text>
          </Pressable>

          {isConnected ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleDisconnect}
              style={({ pressed }) => [
                styles.disconnectButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.disconnectButtonText}>
                Disconnect wallet
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.securityText}>
          PAI never stores your private key or seed phrase.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingRight: 20,
    marginBottom: 38,
  },

  backText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '600',
  },

  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
  },

  title: {
    marginTop: 12,
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },

  description: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },

  card: {
    marginTop: 32,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
  },

  statusLabel: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  statusValue: {
    marginTop: 8,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },

  address: {
    marginTop: 10,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },

  network: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
  },

  connectButton: {
    marginTop: 28,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
    borderRadius: 14,
  },

  connectButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },

  disconnectButton: {
    marginTop: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },

  disconnectButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.7,
  },

  securityText: {
    marginTop: 20,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});