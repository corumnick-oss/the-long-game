import { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTeamList, type TeamSummary } from '@/hooks/useTeams';

const MIN_SEASON = 2025;
const MAX_SEASON = new Date().getFullYear();

type SortKey = 'record' | 'pick-accuracy' | 'name';

function TeamRow({ item, onPress }: { item: TeamSummary; onPress: () => void }) {
  const gp = item.wins + item.losses;
  const recordColor = item.wins > item.losses ? '#22c55e' : item.wins < item.losses ? '#ef4444' : '#eab308';
  const pickColor = item.pickAccuracy !== null
    ? item.pickAccuracy >= 60 ? '#22c55e' : item.pickAccuracy >= 40 ? '#eab308' : '#ef4444'
    : '#6b7280';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-3 border-b border-border"
    >
      {/* Logo */}
      <View className="w-10 h-10 mr-3 items-center justify-center">
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={{ width: 38, height: 38 }} resizeMode="contain" />
        ) : (
          <View className="w-10 h-10 rounded-full bg-surface items-center justify-center">
            <Text className="text-white text-xs font-bold">{item.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Name + games played */}
      <View className="flex-1">
        <Text className="text-white text-sm font-semibold" numberOfLines={1}>{item.name}</Text>
        {gp > 0 && (
          <Text className="text-muted text-xs mt-0.5">{gp} games played</Text>
        )}
      </View>

      {/* Season record */}
      <View className="items-end ml-3 mr-4">
        <Text style={{ color: recordColor, fontWeight: 'bold', fontSize: 14 }}>
          {item.wins}–{item.losses}
        </Text>
        <Text className="text-muted text-xs">record</Text>
      </View>

      {/* Pick accuracy */}
      {item.pickAccuracy !== null && (
        <View className="items-end ml-2" style={{ minWidth: 44 }}>
          <Text style={{ color: pickColor, fontWeight: 'bold', fontSize: 13 }}>
            {item.pickAccuracy}%
          </Text>
          <Text className="text-muted text-xs">picks</Text>
        </View>
      )}

      <Text className="text-muted text-sm ml-2">›</Text>
    </TouchableOpacity>
  );
}

function SortToggle({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const options: { key: SortKey; label: string }[] = [
    { key: 'record', label: 'Record' },
    { key: 'pick-accuracy', label: 'Pick %' },
    { key: 'name', label: 'A–Z' },
  ];
  return (
    <View className="flex-row bg-surface rounded-xl p-1 mx-4 mb-3">
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

export default function TeamCentralScreen() {
  const router = useRouter();
  const [season, setSeason] = useState(MAX_SEASON);
  const [sort, setSort] = useState<SortKey>('record');
  const [search, setSearch] = useState('');
  const { data = [], isLoading, isError } = useTeamList(season);

  const sorted = useMemo(() => {
    let list = search.trim()
      ? data.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
      : data;

    const copy = [...list];
    if (sort === 'pick-accuracy') {
      return copy.sort((a, b) => (b.pickAccuracy ?? -1) - (a.pickAccuracy ?? -1));
    }
    if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy; // 'record' — API already sorted by wins
  }, [data, sort, search]);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-white font-bold text-base text-center">Team Central</Text>
        <View style={{ width: 56 }} />
      </View>

      {/* Season selector */}
      <View className="flex-row items-center justify-center gap-4 py-3 border-b border-border">
        <TouchableOpacity
          onPress={() => setSeason(s => Math.max(MIN_SEASON, s - 1))}
          disabled={season <= MIN_SEASON}
          className={`w-8 h-8 bg-surface rounded-full items-center justify-center ${season <= MIN_SEASON ? 'opacity-30' : ''}`}
        >
          <Text className="text-white text-base">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-base font-bold">{season} Season</Text>
        <TouchableOpacity
          onPress={() => setSeason(s => Math.min(MAX_SEASON, s + 1))}
          disabled={season >= MAX_SEASON}
          className={`w-8 h-8 bg-surface rounded-full items-center justify-center ${season >= MAX_SEASON ? 'opacity-30' : ''}`}
        >
          <Text className="text-white text-base">›</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white font-bold mb-2">Couldn't load teams</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.name}
          ListHeaderComponent={
            <View className="pt-3 pb-1">
              {/* Search */}
              <View className="mx-4 mb-3 bg-surface rounded-xl px-4 flex-row items-center" style={{ height: 44 }}>
                <Text className="text-muted mr-2">🔍</Text>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search teams…"
                  placeholderTextColor="#6b7280"
                  className="flex-1 text-white text-sm"
                  style={{ height: 44 }}
                />
              </View>
              <SortToggle value={sort} onChange={setSort} />
              {/* Column labels */}
              <View className="flex-row items-center px-4 pb-2">
                <View style={{ width: 52 }} />
                <Text className="flex-1 text-muted text-xs font-semibold uppercase">Team</Text>
                <Text className="text-muted text-xs font-semibold uppercase mr-6">W-L</Text>
                <Text className="text-muted text-xs font-semibold uppercase mr-4">Picks</Text>
                <View style={{ width: 16 }} />
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TeamRow
              item={item}
              onPress={() => router.push({ pathname: '/team/[name]' as any, params: { name: item.name, season: String(season) } })}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-muted text-sm">No teams found</Text>
            </View>
          }
          ListFooterComponent={<View className="h-8" />}
        />
      )}
    </View>
  );
}
