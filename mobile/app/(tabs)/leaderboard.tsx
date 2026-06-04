import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useLeaderboard, type LeaderboardEntry } from '../../src/hooks/useLeaderboard';
import { getCurrentNFLSeason, getCurrentNFLWeek } from '../../src/lib/nflSeason';

const currentSeason = getCurrentNFLSeason();
const currentWeek = getCurrentNFLWeek();
const MIN_SEASON = 2025;
const MAX_SEASON = new Date().getFullYear();

type Filter = 'longies' | 'global';
type ViewType = 'season' | 'weekly';
type SeasonType = 'regular' | 'preseason';

function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row bg-surface rounded-xl p-1">
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`flex-1 py-2 rounded-lg items-center ${value === opt.value ? 'bg-primary' : ''}`}
        >
          <Text className={`text-sm font-semibold ${value === opt.value ? 'text-white' : 'text-muted'}`}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Avatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View className="w-9 h-9 rounded-full bg-surface-2 items-center justify-center">
      <Text className="text-white text-xs font-bold">{initials}</Text>
    </View>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Text style={{ fontSize: 20 }}>🏆</Text>;
  if (rank === 2) return <Text style={{ fontSize: 20 }}>🥈</Text>;
  if (rank === 3) return <Text style={{ fontSize: 20 }}>🥉</Text>;
  return (
    <Text className="text-muted text-sm font-semibold" style={{ minWidth: 24, textAlign: 'center' }}>
      {rank}
    </Text>
  );
}

function LeaderboardRow({ entry, onPress }: { entry: LeaderboardEntry; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-3 border-b border-border ${entry.isCurrentUser ? 'bg-primary/10' : ''}`}
    >
      <View className="w-8 items-center mr-1">
        <RankBadge rank={entry.rank} />
      </View>

      <View className="mx-3">
        <Avatar name={entry.teamName} imageUrl={entry.profileImageUrl} />
      </View>

      <Text className="flex-1 text-white font-semibold text-sm" numberOfLines={1}>
        {entry.teamName}
      </Text>

      <Text className="text-muted text-sm mr-4">
        {entry.wins}-{entry.losses}
      </Text>

      <Text className="text-white text-sm font-bold w-14 text-right">
        {entry.accuracy}%
      </Text>
    </TouchableOpacity>
  );
}

function ListHeader({ filter, setFilter, type, setType, isLongie, season, setSeason, seasonType, setSeasonType }: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  type: ViewType;
  setType: (t: ViewType) => void;
  isLongie: boolean;
  season: number;
  setSeason: (s: number) => void;
  seasonType: SeasonType;
  setSeasonType: (st: SeasonType) => void;
}) {
  const isCurrentSeason = season === MAX_SEASON;
  return (
    <View className="px-4 pt-4 pb-2 gap-2">
      {/* Season selector */}
      <View className="flex-row items-center justify-center gap-4">
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

      {/* Preseason / Regular Season toggle */}
      <Toggle<SeasonType>
        options={[
          { label: 'Regular Season', value: 'regular' },
          { label: 'Preseason', value: 'preseason' },
        ]}
        value={seasonType}
        onChange={setSeasonType}
      />

      {isLongie && (
        <Toggle<Filter>
          options={[
            { label: 'Longies', value: 'longies' },
            { label: 'Global', value: 'global' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      )}
      {isCurrentSeason && seasonType === 'regular' && (
        <Toggle<ViewType>
          options={[
            { label: 'Season', value: 'season' },
            { label: `Week ${currentWeek}`, value: 'weekly' },
          ]}
          value={type}
          onChange={setType}
        />
      )}

      {/* Column headers */}
      <View className="flex-row items-center px-4 pt-2 pb-1">
        <View className="w-8 mr-1" />
        <View className="w-9 mx-3" />
        <Text className="flex-1 text-muted text-xs font-semibold uppercase">Team</Text>
        <Text className="text-muted text-xs font-semibold uppercase mr-4">W-L</Text>
        <Text className="text-muted text-xs font-semibold uppercase w-14 text-right">Acc</Text>
      </View>
    </View>
  );
}

import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useMyProfile } from '../../src/hooks/useProfile';

export default function LeaderboardScreen() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const isLongie = profile?.isLongie ?? false;
  const [filter, setFilter] = useState<Filter>('global');
  const [type, setType] = useState<ViewType>('season');
  const [season, setSeason] = useState(currentSeason);
  const [seasonType, setSeasonType] = useState<SeasonType>('regular');

  useEffect(() => {
    if (profile?.isLongie) setFilter('longies');
  }, [profile?.isLongie]);

  // Reset weekly view when switching away from current regular season
  useEffect(() => {
    if (season < MAX_SEASON || seasonType === 'preseason') setType('season');
  }, [season, seasonType]);

  const { data, isLoading, isError, refetch, isFetching } = useLeaderboard(
    filter,
    type,
    currentWeek,
    season,
    seasonType,
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-white text-lg font-bold mb-2">Couldn't load leaderboard</Text>
        <TouchableOpacity onPress={() => refetch()} className="mt-2">
          <Text className="text-primary text-sm">Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={data?.entries ?? []}
        keyExtractor={item => item.userId}
        renderItem={({ item }) => (
          <LeaderboardRow
            entry={item}
            onPress={() => {
              if (item.isCurrentUser) {
                router.push('/(tabs)/profile');
              } else {
                router.push({ pathname: '/user/[id]' as any, params: { id: item.userId } });
              }
            }}
          />
        )}
        ListHeaderComponent={
          <ListHeader
            filter={filter}
            setFilter={setFilter}
            type={type}
            setType={setType}
            isLongie={isLongie}
            season={season}
            setSeason={setSeason}
            seasonType={seasonType}
            setSeasonType={setSeasonType}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Text className="text-muted text-sm">No entries yet</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor="#3b82f6"
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </View>
  );
}
