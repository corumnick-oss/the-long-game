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
import { Link, useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/context/AuthContext';

// To enable Google Sign-In:
// 1. Firebase Console > Authentication > Sign-in method > Google > copy Web client ID
// 2. Add to mobile/.env:  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

// Shared style for all text inputs — explicit height prevents iOS text clipping
const inputStyle = { height: 52, paddingHorizontal: 16 } as const;

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogleCredential, signInWithApple } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [_request, response, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || 'not-configured',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      setIsSubmitting(true);
      signInWithGoogleCredential(id_token)
        .catch((err: Error) => setError(err.message))
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
        'Google Sign-In Not Configured',
        'Add your Google Web Client ID to mobile/.env:\n\nEXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_ID.apps.googleusercontent.com\n\nFind it in Firebase Console → Authentication → Sign-in method → Google.',
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
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
        setIsSubmitting(false);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Apple sign-in failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Title */}
        <View className="items-center mb-12">
          <Text className="text-5xl mb-3">🏈</Text>
          <Text className="text-white text-3xl font-bold tracking-tight">The Long Game</Text>
          <Text className="text-muted text-sm mt-1">NFL Picks &amp; Leaderboards</Text>
        </View>

        {/* OAuth buttons */}
        <TouchableOpacity
          className="flex-row items-center justify-center bg-white rounded-xl mb-3"
          style={{ height: 50 }}
          onPress={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <Text className="text-[#333] font-semibold text-base">Sign in with Google</Text>
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
          className="bg-surface border border-border rounded-xl text-white text-base mb-3"
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          className="bg-surface border border-border rounded-xl text-white text-base mb-4"
          style={inputStyle}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        <TouchableOpacity className="items-end mb-4 -mt-1" onPress={() => router.push('/forgot-password' as never)}>
          <Text className="text-primary text-sm">Forgot password?</Text>
        </TouchableOpacity>

        {error ? (
          <Text className="text-danger text-sm mb-3 text-center">{error}</Text>
        ) : null}

        <TouchableOpacity
          className="bg-primary rounded-xl items-center justify-center"
          style={{ height: 50 }}
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
          <Text className="text-muted text-sm">Don't have an account? </Text>
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
