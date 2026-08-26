import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useLeaderboard, type LeaderboardEntry } from '../../src/hooks/useLeaderboard';
import { useCurrentWeek } from '../../src/hooks/usePicksData';
import { useToggleWeeklyBonus } from '../../src/hooks/useAdminData';
import { WeekSelector } from '../../src/components/WeekSelector';

type Filter = 'gridirons' | 'global';
type ViewType = 'season' | 'weekly';

// Ordered list of selectable seasons — each has a year, seasonType, and display label
type SeasonEntry = { year: number; seasonType: 'regular' | 'preseason'; label: string };
const SEASON_ENTRIES: SeasonEntry[] = [
  { year: 2025, seasonType: 'regular', label: '2025 Season' },
  { year: 2026, seasonType: 'preseason', label: '2026 Preseason' },
  { year: 2026, seasonType: 'regular', label: '2026 Season' },
];
// Default to 2026 Preseason; switch to 2026 Regular Season on Sept 7 (day after last preseason game)
function getDefaultEntryIdx(): number {
  const now = new Date();
  const yr = now.getFullYear();
  const afterPreseason = now >= new Date(yr, 8, 7); // Sept 7
  if (afterPreseason) return SEASON_ENTRIES.findIndex(e => e.year === yr && e.seasonType === 'regular');
  return SEASON_ENTRIES.findIndex(e => e.year === yr && e.seasonType === 'preseason');
}
const DEFAULT_IDX = Math.max(0, getDefaultEntryIdx());

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

function LeaderboardRow({
  entry,
  onPress,
  showBonus,
  canToggleBonus,
  onToggleBonus,
}: {
  entry: LeaderboardEntry;
  onPress: () => void;
  showBonus: boolean;
  canToggleBonus: boolean;
  onToggleBonus: () => void;
}) {
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

      <View className="flex-1 mr-2">
        <Text className="text-white font-semibold text-sm" numberOfLines={1}>
          {entry.teamName}
        </Text>
        {showBonus && (entry.weeklyBonusOptIn || canToggleBonus) && (
          <TouchableOpacity
            disabled={!canToggleBonus}
            onPress={(e) => { e.stopPropagation(); onToggleBonus(); }}
            className="self-start mt-1"
          >
            <Text
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full overflow-hidden ${
                entry.weeklyBonusOptIn ? 'bg-amber-500/20 text-amber-400' : 'bg-surface-2 text-muted'
              }`}
            >
              Bonus
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text className="text-white text-sm font-bold mr-4">
        {entry.wins}-{entry.losses}
      </Text>

      <Text className="text-white text-sm font-bold w-14 text-right">
        {entry.accuracy}%
      </Text>
    </TouchableOpacity>
  );
}

function ListHeader({
  filter, setFilter, type, setType, isGridiron, entryIdx, setEntryIdx, isCurrentEntry, currentWeek,
  selectedWeek, setSelectedWeek, seasonType,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  type: ViewType;
  setType: (t: ViewType) => void;
  isGridiron: boolean;
  entryIdx: number;
  setEntryIdx: (i: number) => void;
  isCurrentEntry: boolean;
  currentWeek: number;
  selectedWeek: number;
  setSelectedWeek: (w: number) => void;
  seasonType: 'regular' | 'preseason';
}) {
  const entry = SEASON_ENTRIES[entryIdx]!;
  return (
    <View className="px-4 pt-4 pb-2 gap-2">
      {/* Season selector */}
      <View className="flex-row items-center justify-center gap-4">
        <TouchableOpacity
          onPress={() => setEntryIdx(entryIdx - 1)}
          disabled={entryIdx <= 0}
          className={`w-8 h-8 bg-surface rounded-full items-center justify-center ${entryIdx <= 0 ? 'opacity-30' : ''}`}
        >
          <Text className="text-white text-base">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-base font-bold">{entry.label}</Text>
        <TouchableOpacity
          onPress={() => setEntryIdx(entryIdx + 1)}
          disabled={entryIdx >= SEASON_ENTRIES.length - 1}
          className={`w-8 h-8 bg-surface rounded-full items-center justify-center ${entryIdx >= SEASON_ENTRIES.length - 1 ? 'opacity-30' : ''}`}
        >
          <Text className="text-white text-base">›</Text>
        </TouchableOpacity>
      </View>

      {isGridiron && (
        <Toggle<Filter>
          options={[
            { label: 'Gridirons', value: 'gridirons' },
            { label: 'Global', value: 'global' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      )}
      {isCurrentEntry && (
        <Toggle<ViewType>
          options={[
            { label: 'Season', value: 'season' },
            { label: selectedWeek === currentWeek ? `Week ${currentWeek}` : `Week ${selectedWeek} ▾`, value: 'weekly' },
          ]}
          value={type}
          onChange={setType}
        />
      )}

      {isCurrentEntry && type === 'weekly' && (
        <View className="-mx-4">
          <WeekSelector
            currentWeek={currentWeek}
            selectedWeek={selectedWeek}
            onSelect={setSelectedWeek}
            totalWeeks={currentWeek}
            seasonType={seasonType}
          />
        </View>
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
  const isGridiron = profile?.isGridiron ?? false;
  const isAdmin = profile?.isAdmin ?? false;
  const [filter, setFilter] = useState<Filter>('global');
  const [type, setType] = useState<ViewType>('season');
  const [entryIdx, setEntryIdx] = useState(DEFAULT_IDX);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const toggleBonus = useToggleWeeklyBonus();

  useEffect(() => {
    if (profile?.isGridiron) setFilter('gridirons');
  }, [profile?.isGridiron]);

  // Reset weekly view when switching away from current regular season
  useEffect(() => { setType('season'); }, [entryIdx]);

  const entry = SEASON_ENTRIES[entryIdx]!;

  const { data: currentWeekData } = useCurrentWeek();
  const isCurrentEntry =
    currentWeekData != null &&
    entry.year === currentWeekData.season &&
    entry.seasonType === currentWeekData.seasonType;
  const currentWeek = currentWeekData?.week ?? 1;

  // Default the week selector to the current week whenever it becomes known / changes
  useEffect(() => { setSelectedWeek(currentWeek); }, [currentWeek]);

  const viewedWeek = type === 'weekly' ? selectedWeek : currentWeek;
  const showBonus = type === 'weekly' && filter === 'gridirons';

  const { data, isLoading, isError, refetch, isFetching } = useLeaderboard(
    filter,
    type,
    viewedWeek,
    entry.year,
    entry.seasonType,
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
            showBonus={showBonus}
            canToggleBonus={showBonus && isAdmin}
            onToggleBonus={() =>
              toggleBonus.mutate({ userId: item.userId, week: viewedWeek, season: entry.year, seasonType: entry.seasonType })
            }
            onPress={() => {
              if (item.isCurrentUser) {
                router.push('/(tabs)/profile');
              } else {
                router.push({ pathname: '/user/[id]' as any, params: { id: item.userId, season: String(entry.year) } });
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
            isGridiron={isGridiron}
            entryIdx={entryIdx}
            setEntryIdx={setEntryIdx}
            isCurrentEntry={isCurrentEntry}
            currentWeek={currentWeek}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
            seasonType={entry.seasonType}
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
