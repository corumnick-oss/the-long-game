import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onAllow: () => void;
  onMaybeLater: () => void;
};

export function NotificationPrompt({ visible, onAllow, onMaybeLater }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View className="flex-1 bg-black/60 items-center justify-center px-6">
        <View className="bg-surface w-full rounded-2xl p-6 items-center" style={{ maxWidth: 360 }}>
          <View className="w-16 h-16 rounded-full bg-blue-500/20 items-center justify-center mb-4">
            <Ionicons name="notifications" size={32} color="#3b82f6" />
          </View>

          <Text className="text-white text-xl font-bold text-center mb-2">
            Stay in the Game
          </Text>

          <Text className="text-muted text-sm text-center mb-6 leading-5">
            Get notified when picks open each week, when the deadline is near, and when your results are in.
          </Text>

          <TouchableOpacity
            className="bg-blue-500 w-full rounded-xl py-3 items-center mb-3"
            onPress={onAllow}
          >
            <Text className="text-white font-semibold text-base">Enable Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity className="py-2" onPress={onMaybeLater}>
            <Text className="text-muted text-sm">Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
