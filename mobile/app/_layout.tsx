import '../src/global.css';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { NotificationPrompt } from '@/components/NotificationPrompt';

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
    const inNamedRoute = segments[0] === 'game' || segments[0] === 'user' || segments[0] === 'admin' || segments[0] === 'picks-by-team' || segments[0] === 'team';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/picks');
    } else if (user && !inTabsGroup && !inNamedRoute) {
      // Cold launch: segments unresolved (undefined/root) — send to tabs
      router.replace('/(tabs)/picks');
    }
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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}
