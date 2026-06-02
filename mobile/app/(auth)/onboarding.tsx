import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const FEATURES = [
  {
    icon: '🏈',
    title: 'Season-Long Picks',
    description: 'Pick every game, every week, all 18 weeks long.',
  },
  {
    icon: '👥',
    title: 'Compete With Friends',
    description: 'Private leaderboard, bragging rights, real stakes.',
  },
  {
    icon: '📈',
    title: 'Climb the Rankings',
    description: 'Weekly and season standings, live all year.',
  },
  {
    icon: '⚡',
    title: 'Chase the Upset',
    description: "Call the games nobody else does. Earn trophies for it.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();

  const goToLogin = () => router.replace('/(auth)/login' as never);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.iconCircle}>
            <Text style={styles.footballEmoji}>🏈</Text>
          </View>
          <Text style={styles.appName}>The Long Game</Text>
          <Text style={styles.tagline}>NFL Picks &amp; Leaderboards</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIconBox}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity style={styles.button} onPress={goToLogin} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signInLink} onPress={goToLogin} activeOpacity={0.7}>
            <Text style={styles.signInText}>
              Already have an account?{'  '}
              <Text style={styles.signInHighlight}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },

  // Logo
  logoSection: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  footballEmoji: {
    fontSize: 40,
  },
  appName: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 6,
  },

  // Features
  featuresSection: {
    gap: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureIcon: {
    fontSize: 22,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  featureDesc: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },

  // CTA
  ctaSection: {
    gap: 8,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  signInText: {
    color: '#6b7280',
    fontSize: 14,
  },
  signInHighlight: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
