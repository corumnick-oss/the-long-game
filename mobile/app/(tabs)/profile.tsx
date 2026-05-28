import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <Text className="text-4xl mb-3">👤</Text>
      <Text className="text-white text-xl font-bold mb-1">
        {user?.displayName ?? 'Player'}
      </Text>
      <Text className="text-muted text-sm mb-8">{user?.email}</Text>

      <Text className="text-muted text-sm mb-8 text-center">
        Full profile coming in Phase 4
      </Text>

      <TouchableOpacity
        className="bg-surface border border-border rounded-xl px-8 py-3"
        onPress={signOut}
      >
        <Text className="text-danger font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
