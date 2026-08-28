import { router } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  colors,
  radius,
  spacing,
} from '@/constants/theme';

export default function AgreementsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            PAI MOBILE
          </Text>

          <Text style={styles.title}>
            Agreements
          </Text>

          <Text style={styles.subtitle}>
            Your agreement workspace will be driven by
            the connected wallet and PAI agreement state.
          </Text>
        </View>

        <View style={styles.emptyCard}>
          <View style={styles.icon}>
            <View style={styles.iconInner} />
          </View>

          <Text style={styles.emptyTitle}>
            No wallet connected
          </Text>

          <Text style={styles.emptyDescription}>
            No fake agreement data is shown here.
            Wallet connection and real agreement loading
            are the next implementation milestone.
          </Text>

          <View style={styles.statusRow}>
            <View style={styles.statusDot} />

            <Text style={styles.statusText}>
              Mobile shell ready
            </Text>
          </View>
        </View>

        <View style={styles.foundation}>
          <Text style={styles.foundationLabel}>
            FOUNDATION STATUS
          </Text>

          <FoundationRow label="Expo SDK 57" done />
          <FoundationRow label="Expo Router" done />
          <FoundationRow label="PAI visual system" done />
          <FoundationRow label="Wallet connection" />
          <FoundationRow label="SIWE authentication" />
          <FoundationRow label="Agreement contract reads" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function FoundationRow({
  label,
  done = false,
}: {
  label: string;
  done?: boolean;
}) {
  return (
    <View style={styles.foundationRow}>
      <Text style={styles.foundationRowLabel}>
        {label}
      </Text>

      <View
        style={[
          styles.foundationStatus,
          done && styles.foundationStatusDone,
        ]}
      >
        <Text
          style={[
            styles.foundationStatusText,
            done && styles.foundationStatusTextDone,
          ]}
        >
          {done ? 'READY' : 'NEXT'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
  },

  backText: {
    color: colors.text,
    fontSize: 22,
  },

  pressed: {
    opacity: 0.7,
  },

  header: {
    marginTop: spacing.xl,
  },

  eyebrow: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },

  title: {
    marginTop: 8,
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },

  subtitle: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },

  emptyCard: {
    marginTop: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },

  icon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: 27,
    backgroundColor: 'rgba(22, 224, 207, 0.07)',
  },

  iconInner: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: colors.teal,
    borderRadius: 5,
  },

  emptyTitle: {
    marginTop: spacing.md,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  emptyDescription: {
    marginTop: spacing.sm,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },

  statusRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.green,
  },

  statusText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '700',
  },

  foundation: {
    marginTop: spacing.lg,
  },

  foundationLabel: {
    marginBottom: spacing.sm,
    color: colors.mutedSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },

  foundationRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },

  foundationRowLabel: {
    color: colors.muted,
    fontSize: 13,
  },

  foundationStatus: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  foundationStatusDone: {
    borderColor: 'rgba(118, 239, 101, 0.25)',
    backgroundColor: 'rgba(118, 239, 101, 0.06)',
  },

  foundationStatusText: {
    color: colors.mutedSecondary,
    fontSize: 9,
    fontWeight: '800',
  },

  foundationStatusTextDone: {
    color: colors.green,
  },
});
