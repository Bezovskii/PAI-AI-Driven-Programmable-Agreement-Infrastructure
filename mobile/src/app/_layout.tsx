import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';

import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
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
    </>
  );
}