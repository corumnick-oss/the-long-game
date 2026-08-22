import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/context/AuthContext';

const ONBOARDING_KEY = 'has_seen_onboarding';

const FEATURES = [
  { icon: '🏈', title: 'Season-Long Picks', description: 'Pick every game, every week, all 18 weeks long.' },
  { icon: '👥', title: 'Compete With Friends', description: 'Private leaderboard, bragging rights, real stakes.' },
  { icon: '📈', title: 'Climb the Rankings', description: 'Weekly and season standings, live all year.' },
  { icon: '⚡', title: 'Chase the Upset', description: "Call the games nobody else does. Earn achievements for it." },
];

const RULES_SUMMARY = [
  'Pick the winner of every pro football game, every week.',
  "It's a season-long competition — most wins by the end of the season takes the title.",
  'Picks lock Wednesday at 11:59 PM PST — no changes after that.',
  "Miss a pick after your first active week? We'll auto-fill it for you.",
  'Full rules are always available from the book icon at the top of the app. Good luck!',
];

// Shared style for all text inputs — explicit height prevents iOS text clipping
const inputStyle = { height: 52, paddingHorizontal: 16 } as const;

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      if (!val) setShowOnboarding(true);
    });
  }, []);

  const handleGetStarted = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return (
      <SafeAreaView style={ob.safe}>
        <View style={ob.container}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={ob.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={ob.logoSection}>
              <View style={ob.iconCircle}>
                <Text style={ob.footballEmoji}>🏈</Text>
              </View>
              <Text style={ob.appName}>The Long Game</Text>
              <Text style={ob.tagline}>Football Picks &amp; Leaderboards</Text>
            </View>
            <View style={ob.featuresSection}>
              {FEATURES.map(f => (
                <View key={f.title} style={ob.featureRow}>
                  <View style={ob.featureIconBox}>
                    <Text style={ob.featureIcon}>{f.icon}</Text>
                  </View>
                  <View style={ob.featureText}>
                    <Text style={ob.featureTitle}>{f.title}</Text>
                    <Text style={ob.featureDesc}>{f.description}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={ob.rulesSection}>
              <Text style={ob.rulesTitle}>How It Works</Text>
              {RULES_SUMMARY.map(line => (
                <View key={line} style={ob.rulesRow}>
                  <Text style={ob.rulesBullet}>•</Text>
                  <Text style={ob.rulesText}>{line}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={ob.ctaSection}>
            <TouchableOpacity style={ob.button} onPress={handleGetStarted} activeOpacity={0.85}>
              <Text style={ob.buttonText}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ob.signInLink} onPress={handleGetStarted} activeOpacity={0.7}>
              <Text style={ob.signInText}>
                Already have an account?{'  '}
                <Text style={ob.signInHighlight}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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

  const handleGoogleSignIn = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'SIGN_IN_CANCELLED') {
        setIsSubmitting(false);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
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
          paddingTop: 72,
          paddingBottom: 48,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Title */}
        <View className="items-center mb-12">
          <Text className="text-5xl mb-3">🏈</Text>
          <Text className="text-white text-3xl font-bold tracking-tight">The Long Game</Text>
          <Text className="text-muted text-sm mt-1">Football Picks &amp; Leaderboards</Text>
        </View>

        {/* OAuth buttons */}
        <TouchableOpacity
          className="flex-row items-center justify-center bg-white rounded-xl mb-3"
          style={{ height: 50 }}
          onPress={handleGoogleSignIn}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#333" />
          ) : (
            <Text className="text-[#333] font-semibold text-base">Sign in with Google</Text>
          )}
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

const ob = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f0f' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', gap: 28 },
  logoSection: { alignItems: 'center' },
  iconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  footballEmoji: { fontSize: 40 },
  appName: { color: '#ffffff', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#6b7280', fontSize: 14, marginTop: 6 },
  featuresSection: { gap: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureIcon: { fontSize: 22 },
  featureText: { flex: 1 },
  featureTitle: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  featureDesc: { color: '#9ca3af', fontSize: 13, marginTop: 2, lineHeight: 18 },
  rulesSection: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 },
  rulesTitle: { color: '#ffffff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  rulesRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  rulesBullet: { color: '#3b82f6', fontSize: 13, lineHeight: 18 },
  rulesText: { color: '#9ca3af', fontSize: 13, lineHeight: 18, flex: 1 },
  ctaSection: { gap: 8 },
  button: { backgroundColor: '#3b82f6', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  signInLink: { alignItems: 'center', paddingVertical: 10 },
  signInText: { color: '#6b7280', fontSize: 14 },
  signInHighlight: { color: '#3b82f6', fontWeight: '600' },
});
