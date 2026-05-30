import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../lib/queryClient';
import { auth } from '../lib/firebase';

const STORAGE_KEY = 'notification_prompt_state';
const MAYBE_LATER_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FIRST_LOGIN_DELAY_MS = 10_000; // 10 seconds

type PromptState = {
  dismissed?: boolean; // permanently dismissed (user said no to system dialog)
  maybeLaterAt?: number; // timestamp when they tapped "Maybe Later"
};

async function registerPushToken() {
  if (!Device.isDevice) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  let tokenData: Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync();
  } catch {
    // Requires an EAS project ID — not available until EAS dev build
    return;
  }
  const token = tokenData.data;
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  const user = auth.currentUser;
  if (!user) return;

  try {
    const idToken = await user.getIdToken();
    await fetch(`${API_BASE}/api/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token, platform }),
    });
  } catch (err) {
    console.error('Failed to register push token:', err);
  }
}

export function useNotificationPermission(userLoggedIn: boolean) {
  const [showPrompt, setShowPrompt] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userLoggedIn) return;

    (async () => {
      // If already granted, just register the token silently
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        await registerPushToken();
        return;
      }

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const state: PromptState = raw ? JSON.parse(raw) : {};

      if (state.dismissed) return;

      if (state.maybeLaterAt) {
        const elapsed = Date.now() - state.maybeLaterAt;
        if (elapsed < MAYBE_LATER_DELAY_MS) return;
      }

      timerRef.current = setTimeout(() => setShowPrompt(true), FIRST_LOGIN_DELAY_MS);
    })();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userLoggedIn]);

  const handleAllow = async () => {
    setShowPrompt(false);
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await registerPushToken();
    } else {
      // User denied the system dialog — don't ask again
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: true }));
    }
  };

  const handleMaybeLater = async () => {
    setShowPrompt(false);
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ maybeLaterAt: Date.now() }),
    );
  };

  return { showPrompt, handleAllow, handleMaybeLater };
}
