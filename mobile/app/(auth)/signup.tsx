import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const inputStyle = { height: 52, paddingHorizontal: 16 } as const;

export default function SignupScreen() {
  const { signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!email || !password || !teamName) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password, teamName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      setError(friendlyFirebaseError(msg));
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
          paddingTop: 72,
          paddingBottom: 48,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-10">
          <Text className="text-5xl mb-3">🏈</Text>
          <Text className="text-white text-3xl font-bold tracking-tight">Create Account</Text>
          <Text className="text-muted text-sm mt-1">Join The Long Game</Text>
        </View>

        <TextInput
          className="bg-surface border border-border rounded-xl text-white text-base mb-3"
          style={inputStyle}
          placeholder="Team name (shown on leaderboard)"
          placeholderTextColor="#6b7280"
          value={teamName}
          onChangeText={setTeamName}
          autoCapitalize="words"
          autoComplete="name"
        />
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
          placeholder="Password (min. 6 characters)"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        {error ? (
          <Text className="text-danger text-sm mb-3 text-center">{error}</Text>
        ) : null}

        <TouchableOpacity
          className="bg-primary rounded-xl items-center justify-center"
          style={{ height: 50 }}
          onPress={handleSignUp}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Create Account</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-muted text-sm">Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text className="text-primary text-sm font-semibold">Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyFirebaseError(msg: string): string {
  if (msg.includes('email-already-in-use')) {
    return 'An account with this email already exists.';
  }
  if (msg.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (msg.includes('weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  return msg;
}
