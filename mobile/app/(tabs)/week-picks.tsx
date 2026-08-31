import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentNFLWeek } from '@/lib/nflSeason';
import { useWeekPicks, type WeekPicksGame, type WeekPicksUser } from '@/hooks/useWeekPicks';
import { useCurrentWeek } from '@/hooks/usePicksData';
import { useMyProfile } from '@/hooks/useProfile';
import { WeekSelector } from '@/components/WeekSelector';

type Filter = 'gridirons' | 'global';

// Same pattern as the Leaderboard tab's toggle — Gridirons only, everyone else always sees global.
function FilterToggle({ value, onChange }: { value: Filter; onChange: (v: Filter) => void }) {
  const options: { label: string; value: Filter }[] = [
    { label: 'Gridirons', value: 'gridirons' },
    { label: 'Global', value: 'global' },
  ];
  return (
    <View className="flex-row bg-surface rounded-xl p-1 mx-4 mb-2">
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

type SeasonEntry = { year: number; seasonType: 'regular' | 'preseason'; label: string };
const SEASON_ENTRIES: SeasonEntry[] = [
  { year: 2025, seasonType: 'regular', label: '2025 Season' },
  { year: 2026, seasonType: 'preseason', label: '2026 Preseason' },
  { year: 2026, seasonType: 'regular', label: '2026 Season' },
];
// Preseason is over — default to the current regular season. The server's useCurrentWeek()
// still corrects the week number on load; preseason stays reachable via the season selector.
function getDefaultEntryIdx(): number {
  const yr = new Date().getFullYear();
  return SEASON_ENTRIES.findIndex(e => e.year === yr && e.seasonType === 'regular');
}
const DEFAULT_IDX = Math.max(0, getDefaultEntryIdx());

const CELL = 68;   // px per game column — wide enough for full-size logo + score side by side
const NAME_W = 88; // px for the fixed name column

// ── Game column header ─────────────────────────────────────────────────────

function GameHeader({ game, onPress }: { game: WeekPicksGame; onPress: () => void }) {
  const isFinal = game.status === 'post';
  const awayWins = isFinal && (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const homeWins = isFinal && (game.homeScore ?? 0) > (game.awayScore ?? 0);

  return (
    <TouchableOpacity style={{ width: CELL }} className="items-center py-1 px-1" onPress={onPress} activeOpacity={0.7}>
      {/* Away logo + score */}
      <View className="flex-row items-center justify-center">
        <View className="w-9 h-9 items-center justify-center">
          {game.awayTeamLogo ? (
            <Image source={{ uri: game.awayTeamLogo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
          ) : (
            <Text className="text-muted text-xs">{game.awayTeam.slice(0, 3)}</Text>
          )}
        </View>
        {isFinal && (
          <Text className={`text-xs font-bold ml-1 ${awayWins ? 'text-success' : 'text-muted'}`}>
            {game.awayScore}
          </Text>
        )}
      </View>

      <Text className="text-muted text-[9px] my-0.5">{isFinal ? 'F' : 'vs'}</Text>

      {/* Home logo + score */}
      <View className="flex-row items-center justify-center">
        <View className="w-9 h-9 items-center justify-center">
          {game.homeTeamLogo ? (
            <Image source={{ uri: game.homeTeamLogo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
          ) : (
            <Text className="text-muted text-xs">{game.homeTeam.slice(0, 3)}</Text>
          )}
        </View>
        {isFinal && (
          <Text className={`text-xs font-bold ml-1 ${homeWins ? 'text-success' : 'text-muted'}`}>
            {game.homeScore}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Pick cell ──────────────────────────────────────────────────────────────

function PickCell({
  game,
  entry,
}: {
  game: WeekPicksGame;
  entry: { pick: 'home' | 'away'; isCorrect: boolean | null } | undefined;
}) {
  if (!entry) {
    return (
      <View style={{ width: CELL }} className="items-center justify-center py-2">
        <View className="w-8 h-8 rounded-full bg-surface-2 items-center justify-center">
          <Text className="text-border text-xs">–</Text>
        </View>
      </View>
    );
  }

  const pickedHome = entry.pick === 'home';
  const logo = pickedHome ? game.homeTeamLogo : game.awayTeamLogo;
  const teamName = pickedHome ? game.homeTeam : game.awayTeam;

  const isFinal = game.status === 'post';
  // A null isCorrect after the game is final means the game tied — not a loss.
  const isTie = isFinal && entry.isCorrect === null;
  const borderColor = isFinal
    ? isTie ? '#eab308' : entry.isCorrect === true ? '#22c55e' : '#ef4444'
    : '#3b82f6';
  const bgColor = isFinal
    ? isTie ? 'rgba(234,179,8,0.15)' : entry.isCorrect === true ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'
    : 'rgba(59,130,246,0.15)';

  return (
    <View style={{ width: CELL }} className="items-center justify-center py-2">
      <View
        style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor, backgroundColor: bgColor }}
        className="items-center justify-center"
      >
        {logo ? (
          <Image source={{ uri: logo }} style={{ width: 26, height: 26 }} resizeMode="contain" />
        ) : (
          <Text style={{ fontSize: 8, color: '#fff' }}>{teamName.slice(0, 3).toUpperCase()}</Text>
        )}
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function WeekPicksScreen() {
  const router = useRouter();
  const currentWeek = getCurrentNFLWeek();
  const { data: profile } = useMyProfile();
  const isGridiron = profile?.isGridiron ?? false;
  const [entryIdx, setEntryIdx] = useState(DEFAULT_IDX);
  const entry = SEASON_ENTRIES[entryIdx]!;
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [filter, setFilter] = useState<Filter>('global');
  const { data, isLoading, isError, refetch } = useWeekPicks(selectedWeek, entry.year, entry.seasonType, filter);

  useEffect(() => { setSelectedWeek(1); }, [entryIdx]);
  useEffect(() => { if (profile?.isGridiron) setFilter('gridirons'); }, [profile?.isGridiron]);

  // currentWeek above is a fast calendar-math guess that can't compute past "week 1" for
  // the whole preseason window — correct it once with the server's data-driven answer,
  // but only while still viewing the default (current) season/type entry.
  const { data: currentWeekData } = useCurrentWeek();
  const appliedServerDefault = useRef(false);
  useEffect(() => {
    if (!currentWeekData || appliedServerDefault.current) return;
    appliedServerDefault.current = true;
    if (entry.year === currentWeekData.season && entry.seasonType === currentWeekData.seasonType) {
      setSelectedWeek(currentWeekData.week);
    }
  }, [currentWeekData, entry]);

  // Synchronized horizontal scroll across header + all user rows.
  // isSyncing blocks echo events: scrollTo fires onScroll on the target view,
  // which would re-trigger syncScroll without the lock. rAF resets the lock
  // in ~1 frame so every legitimate user scroll event still propagates.
  const headerScrollRef = useRef<ScrollView>(null);
  const rowScrollRefs = useRef<(ScrollView | null)[]>([]);
  const isSyncing = useRef(false);

  const syncScroll = (x: number, skipHeader: boolean, skipRowIdx: number | null) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (!skipHeader) headerScrollRef.current?.scrollTo({ x, animated: false });
    rowScrollRefs.current.forEach((ref, i) => {
      if (i !== skipRowIdx) ref?.scrollTo({ x, animated: false });
    });
    requestAnimationFrame(() => { isSyncing.current = false; });
  };

  const onHeaderScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncScroll(e.nativeEvent.contentOffset.x, true, null);
  };

  const onRowScroll = (e: NativeSyntheticEvent<NativeScrollEvent>, rowIdx: number) => {
    syncScroll(e.nativeEvent.contentOffset.x, false, rowIdx);
  };

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
        <Text className="text-white text-lg font-bold mb-2">Couldn't load picks</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text className="text-primary text-sm">Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const games = data?.games ?? [];
  const users = data?.users ?? [];
  const picksByUser = data?.picksByUser ?? {};
  const locked = data?.locked ?? false;

  return (
    <View className="flex-1 bg-background">
      {/* Season selector */}
      <View className="flex-row items-center justify-center gap-4 py-3 border-b border-border">
        <TouchableOpacity
          onPress={() => setEntryIdx(i => Math.max(0, i - 1))}
          disabled={entryIdx <= 0}
          className={`w-8 h-8 bg-surface rounded-full items-center justify-center ${entryIdx <= 0 ? 'opacity-30' : ''}`}
        >
          <Text className="text-white text-base">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-base font-bold">{entry.label}</Text>
        <TouchableOpacity
          onPress={() => setEntryIdx(i => Math.min(SEASON_ENTRIES.length - 1, i + 1))}
          disabled={entryIdx >= SEASON_ENTRIES.length - 1}
          className={`w-8 h-8 bg-surface rounded-full items-center justify-center ${entryIdx >= SEASON_ENTRIES.length - 1 ? 'opacity-30' : ''}`}
        >
          <Text className="text-white text-base">›</Text>
        </TouchableOpacity>
      </View>

      <WeekSelector
        currentWeek={entry.year === new Date().getFullYear() ? currentWeek : 0}
        selectedWeek={selectedWeek}
        onSelect={setSelectedWeek}
        seasonType={entry.seasonType}
      />

      {isGridiron && <FilterToggle value={filter} onChange={setFilter} />}

      {/* Before lock: show message for current week, allow browsing past weeks */}
      {!locked ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">🔒</Text>
          <Text className="text-white text-lg font-bold text-center mb-2">
            Picks are hidden
          </Text>
          <Text className="text-muted text-sm text-center">
            Everyone's picks for {entry.seasonType === 'preseason' ? `Pre ${selectedWeek}` : `Week ${selectedWeek}`} will appear here after this week's lock.
          </Text>
          {selectedWeek > 1 && (
            <Text className="text-muted text-xs text-center mt-4">
              Tap a past week above to see those picks.
            </Text>
          )}
        </View>
      ) : games.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted text-sm">No games found for {entry.seasonType === 'preseason' ? `Pre ${selectedWeek}` : `Week ${selectedWeek}`}</Text>
        </View>
      ) : (
        <View className="flex-1">
          {/* Column headers row */}
          <View
            className="flex-row border-b border-border bg-surface"
            style={{ paddingLeft: NAME_W }}
          >
            <ScrollView
              ref={headerScrollRef}
              horizontal
              onScroll={onHeaderScroll}
              scrollEventThrottle={16}
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
            >
              {games.map(game => (
                <GameHeader
                  key={game.id}
                  game={game}
                  onPress={() => router.push({
                    pathname: '/game/[id]' as any,
                    params: { id: game.id, week: String(selectedWeek), season: String(entry.year), seasonType: entry.seasonType },
                  })}
                />
              ))}
            </ScrollView>
          </View>

          {/* User rows */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {users.map((user, rowIdx) => (
              <View
                key={user.id}
                className="flex-row items-center border-b border-border"
                style={{ minHeight: 56 }}
              >
                {/* Fixed name column */}
                <TouchableOpacity
                  style={{ width: NAME_W }}
                  className="px-3 justify-center"
                  onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: user.id } })}
                  activeOpacity={0.7}
                >
                  <Text className="text-white text-xs font-semibold" numberOfLines={1}>
                    {user.teamName}
                  </Text>
                  {(() => {
                    const userPicks = picksByUser[user.id] ?? {};
                    const correct = Object.values(userPicks).filter(p => p.isCorrect === true).length;
                    const wrong = Object.values(userPicks).filter(p => p.isCorrect === false).length;
                    if (correct + wrong === 0) return null;
                    return (
                      <Text className="text-muted text-xs mt-0.5">
                        {correct}–{wrong}
                      </Text>
                    );
                  })()}
                </TouchableOpacity>

                {/* Scrollable pick cells */}
                <ScrollView
                  ref={ref => { rowScrollRefs.current[rowIdx] = ref; }}
                  horizontal
                  onScroll={e => onRowScroll(e, rowIdx)}
                  scrollEventThrottle={16}
                  bounces={false}
                  overScrollMode="never"
                  showsHorizontalScrollIndicator={false}
                >
                  {games.map(game => (
                    <PickCell
                      key={game.id}
                      game={game}
                      entry={picksByUser[user.id]?.[game.id]}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
