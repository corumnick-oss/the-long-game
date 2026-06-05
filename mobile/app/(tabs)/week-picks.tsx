import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentNFLWeek } from '@/lib/nflSeason';
import { useWeekPicks, type WeekPicksGame, type WeekPicksUser } from '@/hooks/useWeekPicks';
import { WeekSelector } from '@/components/WeekSelector';

type SeasonEntry = { year: number; seasonType: 'regular' | 'preseason'; label: string };
const SEASON_ENTRIES: SeasonEntry[] = [
  { year: 2025, seasonType: 'regular', label: '2025 Season' },
  { year: 2026, seasonType: 'preseason', label: '2026 Preseason' },
  { year: 2026, seasonType: 'regular', label: '2026 Season' },
];
function getDefaultEntryIdx(): number {
  const now = new Date();
  const yr = now.getFullYear();
  const afterPreseason = now >= new Date(yr, 8, 7);
  if (afterPreseason) return SEASON_ENTRIES.findIndex(e => e.year === yr && e.seasonType === 'regular');
  return SEASON_ENTRIES.findIndex(e => e.year === yr && e.seasonType === 'preseason');
}
const DEFAULT_IDX = Math.max(0, getDefaultEntryIdx());

const CELL = 52;   // px per game column
const NAME_W = 88; // px for the fixed name column

// ── Game column header ─────────────────────────────────────────────────────

function GameHeader({ game, onPress }: { game: WeekPicksGame; onPress: () => void }) {
  const isFinal = game.status === 'post';
  return (
    <TouchableOpacity style={{ width: CELL }} className="items-center py-1 px-1" onPress={onPress} activeOpacity={0.7}>
      {/* Away logo */}
      <View className="w-9 h-9 items-center justify-center">
        {game.awayTeamLogo ? (
          <Image source={{ uri: game.awayTeamLogo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
        ) : (
          <Text className="text-muted text-xs">{game.awayTeam.slice(0, 3)}</Text>
        )}
      </View>
      {isFinal ? (
        <Text className="text-muted text-xs mt-0.5">
          {game.awayScore}–{game.homeScore}
        </Text>
      ) : (
        <Text className="text-muted text-xs mt-0.5">vs</Text>
      )}
      {/* Home logo */}
      <View className="w-9 h-9 items-center justify-center">
        {game.homeTeamLogo ? (
          <Image source={{ uri: game.homeTeamLogo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
        ) : (
          <Text className="text-muted text-xs">{game.homeTeam.slice(0, 3)}</Text>
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
  const borderColor = isFinal
    ? entry.isCorrect === true ? '#22c55e' : '#ef4444'
    : '#3b82f6';
  const bgColor = isFinal
    ? entry.isCorrect === true ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'
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
  const [entryIdx, setEntryIdx] = useState(DEFAULT_IDX);
  const entry = SEASON_ENTRIES[entryIdx]!;
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const { data, isLoading, isError, refetch } = useWeekPicks(selectedWeek, entry.year, entry.seasonType);

  useEffect(() => { setSelectedWeek(1); }, [entryIdx]);

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

      {/* Before lock: show message for current week, allow browsing past weeks */}
      {!locked ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">🔒</Text>
          <Text className="text-white text-lg font-bold text-center mb-2">
            Picks are hidden
          </Text>
          <Text className="text-muted text-sm text-center">
            Everyone's picks for {entry.seasonType === 'preseason' ? `Pre ${selectedWeek}` : `Week ${selectedWeek}`} will appear here after Wednesday 9 PM lock.
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
