import '@walletconnect/react-native-compat';
import 'react-native-get-random-values';

import {
  AppKit,
  AppKitProvider,
} from '@reown/appkit-react-native';
import { Stack } from 'expo-router';
import { StatusBar, View } from 'react-native';

import { colors } from '@/constants/theme';
import { appKit } from '@/lib/appkit/config';

export default function RootLayout() {
  return (
    <AppKitProvider instance={appKit}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
        }}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={colors.background}
        />

        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
            animation: 'fade',
          }}
        />

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
          }}
        >
          <AppKit />
        </View>
      </View>
    </AppKitProvider>
  );
}