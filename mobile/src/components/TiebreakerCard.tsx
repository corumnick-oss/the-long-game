import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { TiebreakerData } from '../hooks/usePicksData';

type Props = {
  data: NonNullable<TiebreakerData>;
  onSubmit: (tiebreakerGameId: string, predictedTotal: number) => Promise<void>;
  isLocked: boolean;
};

export function TiebreakerCard({ data, onSubmit, isLocked }: Props) {
  const existing = data.myPick?.predictedTotal;
  const [value, setValue] = useState(existing != null ? String(existing) : '');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async () => {
    const total = parseInt(value, 10);
    if (isNaN(total) || total < 0) return;
    setSubmitting(true);
    try {
      await onSubmit(data.tiebreakerGame.id, total);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  const gameName = data.game ? `${data.game.awayTeam} @ ${data.game.homeTeam}` : data.tiebreakerGame.description;

  return (
    <View className="bg-surface border border-border rounded-2xl mx-4 mb-6 p-4">
      <View className="flex-row items-center mb-3">
        <View className="bg-yellow-500/20 rounded-lg px-2 py-1 mr-2">
          <Text className="text-yellow-400 text-xs font-bold">TIEBREAKER</Text>
        </View>
        <Text className="text-muted text-xs flex-1" numberOfLines={1}>{gameName}</Text>
      </View>

      <Text className="text-white text-sm font-medium mb-3">
        {data.tiebreakerGame.description || 'Predict the total combined score'}
      </Text>

      {isLocked ? (
        <View>
          <Text className="text-muted text-xs mb-1">Your prediction</Text>
          <Text className="text-white text-2xl font-bold">
            {existing != null ? existing : '—'}
          </Text>
          {data.tiebreakerGame.actualTotal != null && (
            <Text className="text-muted text-xs mt-1">
              Actual total: <Text className="text-white">{data.tiebreakerGame.actualTotal}</Text>
            </Text>
          )}
        </View>
      ) : (
        <View className="flex-row items-center gap-3">
          <TextInput
            className="bg-background border border-border rounded-xl text-white text-lg font-bold text-center flex-1"
            style={{ height: 52 }}
            placeholder="0"
            placeholderTextColor="#6b7280"
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            maxLength={3}
          />
          <TouchableOpacity
            className={`rounded-xl items-center justify-center px-5 ${saved ? 'bg-green-600' : 'bg-primary'}`}
            style={{ height: 52 }}
            onPress={handleSubmit}
            disabled={submitting || !value}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white font-semibold">{saved ? 'Saved ✓' : existing != null ? 'Update' : 'Submit'}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
