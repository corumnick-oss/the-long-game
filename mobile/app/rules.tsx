import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

const RULES = [
  {
    title: 'Make Your Picks',
    body: 'Every week, pick the winner of each game. Picks are free to change right up until they lock.',
  },
  {
    title: 'How You Win',
    body: "This is a season-long competition. Every correct pick counts toward your record, and whoever has the most wins when the season ends takes the title.",
  },
  {
    title: 'Picks Lock the Night Before Kickoff',
    body: "Picks lock at 11:59 PM PST the night before that week's first game — usually Wednesday, but earlier or later for weeks with an unusual schedule. Once a week locks, no more changes — your picks are final and everyone's picks become visible.",
  },
  {
    title: "Missed a Game? We've Got You Covered",
    body: "If you forget to pick a game, we'll auto-fill it for you with the Raiders (if they're playing that week) or the away team. This only kicks in starting your second active week — your very first week is never auto-filled.",
  },
  {
    title: 'Weekly Achievements',
    body: "Every Tuesday, achievements are awarded for the week that just finished — things like Most Wins, Lone Wolf (correctly picking a winner nobody else did), and Upset Pick.",
  },
  {
    title: 'Leaderboard',
    body: "See how you stack up against everyone playing, or switch to just your private friend group's standings if you're part of one.",
  },
];

export default function RulesScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-base">How It Works</Text>
        </View>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {RULES.map((rule, i) => (
          <View key={rule.title} className="bg-surface rounded-xl p-4 mb-3">
            <View className="flex-row items-center mb-1.5">
              <View className="w-6 h-6 rounded-full bg-primary/20 items-center justify-center mr-2">
                <Text className="text-primary text-xs font-bold">{i + 1}</Text>
              </View>
              <Text className="text-white font-bold text-sm flex-1">{rule.title}</Text>
            </View>
            <Text className="text-muted text-sm leading-5">{rule.body}</Text>
          </View>
        ))}
        <Text className="text-white text-sm font-semibold text-center mt-2">Good luck! 🏈</Text>
      </ScrollView>
    </View>
  );
}
