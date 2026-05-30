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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

const inputStyle = { height: 52, paddingHorizontal: 16 } as const;

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
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
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          className="flex-row items-center mb-10 self-start"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color="#6b7280" />
          <Text className="text-muted text-sm ml-1">Back to Sign In</Text>
        </TouchableOpacity>

        {sent ? (
          /* Success state */
          <View className="items-center">
            <View className="w-16 h-16 rounded-full bg-green-500/20 items-center justify-center mb-6">
              <Ionicons name="checkmark-circle" size={36} color="#22c55e" />
            </View>
            <Text className="text-white text-2xl font-bold text-center mb-3">Check Your Email</Text>
            <Text className="text-muted text-sm text-center leading-5 mb-8">
              We sent a password reset link to{'\n'}
              <Text className="text-white">{email}</Text>
            </Text>
            <TouchableOpacity
              className="bg-primary rounded-xl items-center justify-center w-full"
              style={{ height: 50 }}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text className="text-white font-semibold text-base">Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Form state */
          <>
            <View className="items-center mb-10">
              <View className="w-16 h-16 rounded-full bg-blue-500/20 items-center justify-center mb-4">
                <Ionicons name="lock-open" size={30} color="#3b82f6" />
              </View>
              <Text className="text-white text-2xl font-bold text-center">Forgot Password?</Text>
              <Text className="text-muted text-sm text-center mt-2 leading-5">
                Enter your email and we'll send you a reset link.
              </Text>
            </View>

            <TextInput
              className="bg-surface border border-border rounded-xl text-white text-base mb-4"
              style={inputStyle}
              placeholder="Email"
              placeholderTextColor="#6b7280"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
            />

            {error ? (
              <Text className="text-danger text-sm mb-3 text-center">{error}</Text>
            ) : null}

            <TouchableOpacity
              className="bg-primary rounded-xl items-center justify-center"
              style={{ height: 50 }}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyFirebaseError(msg: string): string {
  if (msg.includes('user-not-found') || msg.includes('invalid-email')) {
    return 'No account found with that email.';
  }
  if (msg.includes('too-many-requests')) {
    return 'Too many attempts. Try again later.';
  }
  return msg;
}
