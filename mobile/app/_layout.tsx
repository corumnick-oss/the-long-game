import '../src/global.css';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/picks');
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return <Slot />;
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
