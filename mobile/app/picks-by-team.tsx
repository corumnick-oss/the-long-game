import { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getCurrentNFLSeason } from '@/lib/nflSeason';
import { usePicksByTeam, type TeamPickRecord } from '@/hooks/useProfile';

type SortKey = 'most-picked' | 'accuracy' | 'name';

function AccuracyBadge({ accuracy, total }: { accuracy: number; total: number }) {
  if (total === 0) return null;
  const color = accuracy >= 60 ? '#22c55e' : accuracy >= 40 ? '#eab308' : '#ef4444';
  return (
    <Text style={{ color, fontWeight: 'bold', fontSize: 13, minWidth: 36, textAlign: 'right' }}>
      {accuracy}%
    </Text>
  );
}

function TeamRow({ item, onPress }: { item: TeamPickRecord; onPress: () => void }) {
  const recordColor = item.wins > item.losses
    ? '#22c55e'
    : item.wins < item.losses
    ? '#ef4444'
    : '#eab308';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-3 border-b border-border"
    >
      <View className="w-9 h-9 mr-3 items-center justify-center">
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={{ width: 34, height: 34 }} resizeMode="contain" />
        ) : (
          <View className="w-9 h-9 rounded-full bg-surface items-center justify-center">
            <Text className="text-white text-xs font-bold">{item.team.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
      </View>

      <Text className="flex-1 text-white text-sm font-medium" numberOfLines={1}>
        {item.team}
      </Text>

      <View className="items-end ml-3">
        <Text style={{ color: recordColor, fontWeight: 'bold', fontSize: 14 }}>
          {item.wins}–{item.losses}
        </Text>
        <AccuracyBadge accuracy={item.accuracy} total={item.total} />
      </View>
      <Text className="text-muted text-sm ml-2">›</Text>
    </TouchableOpacity>
  );
}

function SortToggle({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const options: { key: SortKey; label: string }[] = [
    { key: 'most-picked', label: 'Most Picked' },
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'name', label: 'A–Z' },
  ];
  return (
    <View className="flex-row bg-surface rounded-xl p-1 mx-4 my-3">
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          onPress={() => onChange(opt.key)}
          className={`flex-1 py-2 rounded-lg items-center ${value === opt.key ? 'bg-primary' : ''}`}
          activeOpacity={0.7}
        >
          <Text className={`text-xs font-semibold ${value === opt.key ? 'text-white' : 'text-muted'}`}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function PicksByTeamScreen() {
  const router = useRouter();
  const { season: seasonParam } = useLocalSearchParams<{ season?: string }>();
  const season = seasonParam ? parseInt(seasonParam, 10) : getCurrentNFLSeason();
  const [sort, setSort] = useState<SortKey>('most-picked');
  const { data = [], isLoading, isError } = usePicksByTeam(season);

  const sorted = useMemo(() => {
    const copy = [...data];
    if (sort === 'accuracy') return copy.sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);
    if (sort === 'name') return copy.sort((a, b) => a.team.localeCompare(b.team));
    return copy; // 'most-picked' — already sorted by total desc from API
  }, [data, sort]);

  const totalWins = data.reduce((s, r) => s + r.wins, 0);
  const totalLosses = data.reduce((s, r) => s + r.losses, 0);
  const overallAccuracy = totalWins + totalLosses > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : 0;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-base">Picks by Team</Text>
          <Text className="text-muted text-xs">{season} Season</Text>
        </View>
        <View style={{ width: 56 }} />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white font-bold mb-2">Couldn't load picks</Text>
          <Text className="text-muted text-sm text-center">Pull down to retry.</Text>
        </View>
      ) : data.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">🏈</Text>
          <Text className="text-white font-bold text-center mb-2">No picks yet</Text>
          <Text className="text-muted text-sm text-center">
            Your team records will appear here once games are settled.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.team}
          ListHeaderComponent={
            <>
              {/* Summary bar */}
              <View className="flex-row items-center justify-around px-4 py-4 mx-4 mt-4 bg-surface rounded-xl">
                <View className="items-center">
                  <Text className="text-white text-lg font-bold">{totalWins}–{totalLosses}</Text>
                  <Text className="text-muted text-xs">Overall</Text>
                </View>
                <View className="w-px h-8 bg-border" />
                <View className="items-center">
                  <Text className="text-white text-lg font-bold">{data.length}</Text>
                  <Text className="text-muted text-xs">Teams</Text>
                </View>
                <View className="w-px h-8 bg-border" />
                <View className="items-center">
                  <Text className="text-white text-lg font-bold">{overallAccuracy}%</Text>
                  <Text className="text-muted text-xs">Accuracy</Text>
                </View>
              </View>
              <SortToggle value={sort} onChange={setSort} />
            </>
          }
          renderItem={({ item }) => (
            <TeamRow
              item={item}
              onPress={() => router.push({ pathname: '/team/[name]' as any, params: { name: item.team, season: String(season), seasonType: 'regular' } })}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View className="h-8" />}
        />
      )}
    </View>
  );
}
