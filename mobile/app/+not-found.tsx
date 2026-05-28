import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <Text className="text-white text-xl font-bold mb-2">Screen not found</Text>
      <Link href="/(tabs)/picks">
        <Text className="text-primary text-sm">Go home</Text>
      </Link>
    </View>
  );
}
