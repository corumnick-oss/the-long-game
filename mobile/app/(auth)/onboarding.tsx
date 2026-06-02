import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';

const FEATURES = [
  {
    icon: '🏈',
    title: 'Season-Long Picks',
    description: 'Pick the winner of every game, every week, all 18 weeks.',
  },
  {
    icon: '👥',
    title: 'Compete With Friends',
    description: 'A private leaderboard for your crew. Bragging rights on the line.',
  },
  {
    icon: '📈',
    title: 'Climb the Rankings',
    description: 'Weekly and season standings update live as games finish.',
  },
  {
    icon: '⚡',
    title: 'Chase the Upset',
    description: "Call the games nobody else does. Earn trophies for it.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-10 pb-8 justify-between">

        {/* Logo */}
        <View className="items-center">
          <View
            className="items-center justify-center rounded-full mb-5"
            style={{ width: 88, height: 88, backgroundColor: 'rgba(59,130,246,0.15)' }}
          >
            <Text style={{ fontSize: 44 }}>🏈</Text>
          </View>
          <Text className="text-white font-bold tracking-tight" style={{ fontSize: 34 }}>
            The Long Game
          </Text>
          <Text className="text-muted text-sm mt-1.5">NFL Picks &amp; Leaderboards</Text>
        </View>

        {/* Features */}
        <View className="gap-5">
          {FEATURES.map((f) => (
            <View key={f.title} className="flex-row items-start gap-4">
              <View
                className="items-center justify-center rounded-xl"
                style={{ width: 46, height: 46, backgroundColor: 'rgba(255,255,255,0.06)' }}
              >
                <Text style={{ fontSize: 22 }}>{f.icon}</Text>
              </View>
              <View className="flex-1 pt-0.5">
                <Text className="text-white font-semibold text-base">{f.title}</Text>
                <Text className="text-muted text-sm mt-0.5 leading-5">{f.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View className="gap-3">
          <TouchableOpacity
            className="bg-primary rounded-2xl items-center justify-center"
            style={{ height: 54 }}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-base tracking-wide">Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center py-2"
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Text className="text-muted text-sm">
              Already have an account?{' '}
              <Text className="text-primary font-semibold">Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}
