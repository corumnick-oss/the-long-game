import { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateTeamName } from '../hooks/useProfile';

type Props = {
  visible: boolean;
  onDone: () => void;
};

export function TeamNamePrompt({ visible, onDone }: Props) {
  const [teamName, setTeamName] = useState('');
  const updateTeamName = useUpdateTeamName();

  const canSave = teamName.trim().length > 0 && !updateTeamName.isPending;

  const handleSave = () => {
    if (!canSave) return;
    updateTeamName.mutate(teamName.trim(), {
      onSuccess: () => {
        setTeamName('');
        onDone();
      },
    });
  };

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-black/60 items-center justify-center px-6"
      >
        <View className="bg-surface w-full rounded-2xl p-6 items-center" style={{ maxWidth: 360 }}>
          <View className="w-16 h-16 rounded-full bg-blue-500/20 items-center justify-center mb-4">
            <Ionicons name="shield" size={32} color="#3b82f6" />
          </View>

          <Text className="text-white text-xl font-bold text-center mb-2">
            Name Your Team
          </Text>

          <Text className="text-muted text-sm text-center mb-6 leading-5">
            Pick a team name — this is what everyone will see on the Leaderboard and Week Picks.
          </Text>

          <TextInput
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Team name"
            placeholderTextColor="#6b7280"
            autoCapitalize="words"
            autoFocus
            maxLength={40}
            style={{ height: 52, paddingHorizontal: 16 }}
            className="bg-surface-2 text-white rounded-xl w-full mb-4"
            onSubmitEditing={handleSave}
            returnKeyType="done"
          />

          <TouchableOpacity
            className={`w-full rounded-xl py-3 items-center ${canSave ? 'bg-blue-500' : 'bg-blue-500/40'}`}
            onPress={handleSave}
            disabled={!canSave}
          >
            {updateTeamName.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
