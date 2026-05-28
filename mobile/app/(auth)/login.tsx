import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/context/AuthContext';

// To enable Google Sign-In:
// 1. Go to Firebase Console > Authentication > Sign-in method > Google
// 2. Copy the Web client ID and paste as EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env
// 3. Add iOS/Android client IDs if needed for native flows
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogleCredential, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || 'not-configured',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      setIsSubmitting(true);
      signInWithGoogleCredential(id_token)
        .catch((err) => setError(err.message))
        .finally(() => setIsSubmitting(false));
    } else if (response?.type === 'error') {
      setError(response.error?.message ?? 'Google sign-in failed');
    }
  }, [response]);

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setError(friendlyFirebaseError(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert(
        'Google Sign-In',
        'Google Sign-In is not yet configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env',
      );
      return;
    }
    setError('');
    promptGoogleAsync();
  };

  const handleAppleSignIn = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithApple();
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      const msg = err instanceof Error ? err.message : 'Apple sign-in failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Title */}
        <View className="items-center mb-12">
          <Text className="text-5xl mb-3">🏈</Text>
          <Text className="text-white text-3xl font-bold tracking-tight">The Long Game</Text>
          <Text className="text-muted text-sm mt-1">NFL Picks &amp; Leaderboards</Text>
        </View>

        {/* OAuth buttons */}
        <TouchableOpacity
          className="flex-row items-center justify-center bg-white rounded-xl py-3.5 mb-3"
          onPress={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <Text className="text-[#333] font-semibold text-base">G&nbsp;&nbsp;Sign in with Google</Text>
        </TouchableOpacity>

        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={{ height: 50, marginBottom: 12 }}
          onPress={handleAppleSignIn}
        />

        {/* Divider */}
        <View className="flex-row items-center my-5">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-muted text-sm mx-3">or</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        {/* Email / Password */}
        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-3.5 text-white text-base mb-3"
          placeholder="Email"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-3.5 text-white text-base mb-4"
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        {error ? (
          <Text className="text-danger text-sm mb-3 text-center">{error}</Text>
        ) : null}

        <TouchableOpacity
          className="bg-primary rounded-xl py-3.5 items-center"
          onPress={handleEmailSignIn}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Sign In</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-muted text-sm">Don&apos;t have an account? </Text>
          <Link href="/(auth)/signup">
            <Text className="text-primary text-sm font-semibold">Create one</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyFirebaseError(msg: string): string {
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
    return 'Invalid email or password.';
  }
  if (msg.includes('too-many-requests')) {
    return 'Too many attempts. Try again later.';
  }
  return msg;
}
