import '../src/global.css';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { NotificationPrompt } from '@/components/NotificationPrompt';

SplashScreen.preventAutoHideAsync();

// Show notifications even when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { showPrompt, handleAllow, handleMaybeLater } = useNotificationPermission(!!user);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inNamedRoute = segments[0] === 'game' || segments[0] === 'user' || segments[0] === 'admin' || segments[0] === 'picks-by-team' || segments[0] === 'team' || segments[0] === 'team-central';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/picks');
    } else if (user && !inTabsGroup && !inNamedRoute) {
      // Cold launch: segments unresolved (undefined/root) — send to tabs
      router.replace('/(tabs)/picks');
    }
    SplashScreen.hideAsync();
  }, [user, isLoading, segments]);

  // Re-fetch all queries when auth state settles so they get the correct Bearer token
  useEffect(() => {
    if (!isLoading) {
      queryClient.invalidateQueries();
    }
  }, [user?.uid, isLoading]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <NotificationPrompt
        visible={showPrompt}
        onAllow={handleAllow}
        onMaybeLater={handleMaybeLater}
      />
    </>
  );
}

export default function RootLayout() {
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    (async () => {
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (isAvailable) {
          setIsUpdating(true);
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Ignore network errors — user will get update next launch
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <AuthGate />
        {isUpdating && (
          <View style={styles.updateOverlay}>
            <ActivityIndicator color="#3b82f6" size="large" />
            <Text style={styles.updateText}>Downloading update...</Text>
          </View>
        )}
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  updateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  updateText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 16,
  },
});
