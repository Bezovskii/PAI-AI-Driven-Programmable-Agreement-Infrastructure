import {
  useAccount,
  useAppKit,
} from '@reown/appkit-react-native';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';
import { sepoliaNetwork } from '@/lib/appkit/config';

const SEPOLIA_CHAIN_ID = 11155111;

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
    switchNetwork,
  } = useAppKit();

  const {
    address,
    chainId,
    isConnected,
    chain,
  } = useAccount();

  const numericChainId =
    chainId === undefined || chainId === null
      ? undefined
      : Number(chainId);

  const isSepolia =
    isConnected && numericChainId === SEPOLIA_CHAIN_ID;

  const handleConnect = async () => {
    await open();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleSwitchToSepolia = async () => {
    await switchNetwork(sepoliaNetwork);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>
          AGREEMENT WORKSPACE
        </Text>

        <Text style={styles.title}>
          Wallet connection
        </Text>

        <Text style={styles.description}>
          Connect an external wallet to continue into the PAI agreement
          lifecycle.
        </Text>

        {!isConnected ? (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />

              <View style={styles.statusCopy}>
                <Text style={styles.statusLabel}>
                  WALLET
                </Text>

                <Text style={styles.statusValue}>
                  Not connected
                </Text>
              </View>
            </View>

            <Text style={styles.cardText}>
              PAI never stores your private key or seed phrase.
              Transactions remain controlled by your wallet.
            </Text>

            <Pressable
              onPress={handleConnect}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                Connect wallet
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    styles.statusDotConnected,
                  ]}
                />

                <View style={styles.statusCopy}>
                  <Text style={styles.statusLabel}>
                    CONNECTED WALLET
                  </Text>

                  <Text style={styles.address}>
                    {address
                      ? shortenAddress(address)
                      : 'Connected'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  Network
                </Text>

                <Text style={styles.detailValue}>
                  {chain?.name ?? 'Unknown'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  Chain ID
                </Text>

                <Text style={styles.detailValue}>
                  {numericChainId ?? 'Unknown'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  PAI network
                </Text>

                <Text
                  style={[
                    styles.detailValue,
                    isSepolia
                      ? styles.goodText
                      : styles.warningText,
                  ]}
                >
                  {isSepolia
                    ? 'Ready'
                    : 'Wrong network'}
                </Text>
              </View>
            </View>

            {!isSepolia && (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>
                  Sepolia required
                </Text>

                <Text style={styles.warningCopy}>
                  PAI Mobile is currently configured for the Sepolia
                  test network.
                </Text>

                <Pressable
                  onPress={handleSwitchToSepolia}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    Switch to Sepolia
                  </Text>
                </Pressable>
              </View>
            )}

            {isSepolia && (
              <View style={styles.readyCard}>
                <Text style={styles.readyLabel}>
                  FOUNDATION GATE
                </Text>

                <Text style={styles.readyTitle}>
                  Wallet ready
                </Text>

                <Text style={styles.readyCopy}>
                  The next step is SIWE authentication with the existing
                  PAI backend.
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleDisconnect}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Disconnect wallet
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 58,
    paddingBottom: 40,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 34,
  },

  backText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
  },

  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 12,
  },

  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    marginBottom: 12,
  },

  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
  },

  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.muted,
    marginRight: 12,
  },

  statusDotConnected: {
    backgroundColor: colors.teal,
  },

  statusCopy: {
    flex: 1,
  },

  statusLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 5,
  },

  statusValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  address: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },

  cardText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 22,
    marginBottom: 22,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },

  detailLabel: {
    color: colors.muted,
    fontSize: 14,
  },

  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },

  goodText: {
    color: colors.teal,
  },

  warningText: {
    color: '#FFB15C',
  },

  warningCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: '#5E4428',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },

  warningTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },

  warningCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  readyCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },

  readyLabel: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 8,
  },

  readyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },

  readyCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },

  primaryButton: {
    backgroundColor: colors.teal,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  primaryButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },

  secondaryButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },

  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },

  buttonPressed: {
    opacity: 0.72,
  },
});
