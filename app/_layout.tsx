import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import AuthGuard from '@/components/AuthGuard';
import { AuthProvider } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  const paperTheme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

  // Use GestureHandlerRootView only on mobile platforms
  const RootContainer = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
    <RootContainer style={{ flex: 1 }}>
      <AuthProvider>
        <PaperProvider theme={paperTheme}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthGuard>
              <Stack>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
            </AuthGuard>
            <StatusBar style="auto" />
          </ThemeProvider>
        </PaperProvider>
      </AuthProvider>
    </RootContainer>
  );
}
