import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useDeleteAccount, useMyProfile, useUpdateTeamName } from '@/hooks/useProfile';

const inputStyle = { height: 52, paddingHorizontal: 16 } as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const deleteAccount = useDeleteAccount();
  const { data: profile } = useMyProfile();
  const updateTeamName = useUpdateTeamName();
  const [teamName, setTeamName] = useState('');

  useEffect(() => {
    if (profile?.teamName) setTeamName(profile.teamName);
  }, [profile?.teamName]);

  const saveTeamName = () => {
    const trimmed = teamName.trim();
    if (!trimmed) {
      Alert.alert('Team name required', 'Please enter a team name.');
      return;
    }
    updateTeamName.mutate(trimmed, {
      onError: () => Alert.alert('Error', 'Could not update your team name. Please try again.'),
    });
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This permanently deletes your account and sign-in. Your past picks stay on record to keep other players’ leaderboards and history accurate, but they’ll no longer be tied to a visible name. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: confirmDeleteAccountFinal },
      ],
    );
  };

  const confirmDeleteAccountFinal = () => {
    Alert.alert(
      'Are you absolutely sure?',
      'This is your last chance to back out — your account will be deleted immediately and you’ll be signed out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount.mutateAsync();
              await signOut();
            } catch (err) {
              Alert.alert('Error', 'Could not delete your account. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-base">Settings</Text>
        </View>
        <View style={{ width: 56 }} />
      </View>

      <View className="p-4">
        <Text className="text-muted text-xs font-semibold mb-2 uppercase">Team Name</Text>
        <View className="bg-surface rounded-xl p-4 mb-6">
          <Text className="text-muted text-xs leading-5 mb-3">
            Shown on the leaderboard and to other players.
          </Text>
          <TextInput
            className="bg-background border border-border rounded-xl text-white text-base mb-3"
            style={inputStyle}
            placeholder="Team name"
            placeholderTextColor="#6b7280"
            value={teamName}
            onChangeText={setTeamName}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TouchableOpacity
            onPress={saveTeamName}
            disabled={updateTeamName.isPending || teamName.trim() === (profile?.teamName ?? '')}
            className="border border-primary rounded-lg items-center py-2.5"
            style={{ opacity: updateTeamName.isPending || teamName.trim() === (profile?.teamName ?? '') ? 0.5 : 1 }}
          >
            <Text className="text-primary text-sm font-semibold">
              {updateTeamName.isPending ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-muted text-xs font-semibold mb-2 uppercase">Danger Zone</Text>
        <View className="bg-surface rounded-xl p-4">
          <Text className="text-white text-sm font-bold mb-1">Delete Account</Text>
          <Text className="text-muted text-xs leading-5 mb-3">
            Permanently deletes your account and sign-in. This can't be undone.
          </Text>
          <TouchableOpacity
            onPress={confirmDeleteAccount}
            disabled={deleteAccount.isPending}
            className="border border-danger rounded-lg items-center py-2.5"
          >
            <Text className="text-danger text-sm font-semibold">
              {deleteAccount.isPending ? 'Deleting…' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
