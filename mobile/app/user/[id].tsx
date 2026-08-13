import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useWeekPicks } from '@/hooks/useWeekPicks';
import { useCurrentWeek } from '@/hooks/usePicksData';
import { getCurrentNFLSeason, getCurrentNFLWeek } from '@/lib/nflSeason';
import { useAuth } from '@/context/AuthContext';
import { WeekSelector } from '@/components/WeekSelector';
import { useSeasonTrophies, usePublicAchievements, type WeekRecord, type SeasonTrophy, type Achievement } from '@/hooks/useProfile';

const FIRST_SEASON = 2025;

// ── Achievement metadata ──────────────────────────────────────────────────────

const ACHIEVEMENT_META: Record<string, { image: number | null; label: string }> = {
  most_wins:   { image: require('../../assets/achievements/most_wins.png'), label: 'Top Picker' },
  loser:       { image: require('../../assets/achievements/loser.png'), label: 'Rough Week' },
  upset_pick:  { image: require('../../assets/achievements/upset_pick.png'), label: 'Upset Pick' },
  lone_wolf:   { image: require('../../assets/achievements/lone_wolf.png'), label: 'Lone Wolf' },
  contrarian:  { image: require('../../assets/achievements/contrarian.png'), label: 'Contrarian' },
};

function achievementMeta(type: string) {
  return ACHIEVEMENT_META[type] ?? { image: null, label: type };
}

function AchievementCard({ trophy }: { trophy: Achievement }) {
  const meta = achievementMeta(trophy.type);
  return (
    <View className="bg-surface rounded-2xl overflow-hidden">
      <View style={{ width: '100%', aspectRatio: 1 }}>
        {meta.image ? (
          <Image source={meta.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View className="flex-1 bg-surface-2 items-center justify-center">
            <Text style={{ fontSize: 40 }}>🏅</Text>
          </View>
        )}
      </View>
      <Text className="text-muted text-xs font-semibold text-center py-2">
        Week {trophy.week}
      </Text>
    </View>
  );
}

// ── Season trophy (podium) metadata ─────────────────────────────────────────────

const PLACEMENT_META: Record<string, { emoji: string; label: string }> = {
  champion:    { emoji: '🥇', label: 'Champion' },
  runner_up:   { emoji: '🥈', label: 'Runner-up' },
  third_place: { emoji: '🥉', label: 'Third Place' },
  last_place:  { emoji: '🥄', label: 'Last Place' },
};

function placementMeta(placement: string) {
  return PLACEMENT_META[placement] ?? { emoji: '🏅', label: placement };
}

function SeasonTrophyCard({ trophy }: { trophy: SeasonTrophy }) {
  const meta = placementMeta(trophy.placement);
  return (
    <View className="flex-1 bg-surface rounded-2xl p-4 items-center">
      <Text style={{ fontSize: 40 }}>{meta.emoji}</Text>
      <Text className="text-white text-sm font-bold mt-1">{meta.label}</Text>
      <Text className="text-muted text-xs mt-0.5">{trophy.season} Season</Text>
      <Text className="text-muted text-xs">{trophy.wins}-{trophy.losses}</Text>
    </View>
  );
}

// ── Reusable pieces (kept local — no shared component file yet) ───────────────

function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-primary/30 items-center justify-center">
      <Text style={{ fontSize: size * 0.35 }} className="text-primary font-bold">{initials}</Text>
    </View>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 bg-surface rounded-xl p-4 items-center">
      <Text className="text-white text-xl font-bold">{value}</Text>
      {sub && <Text className="text-muted text-xs mt-0.5">{sub}</Text>}
      <Text className="text-muted text-xs mt-1">{label}</Text>
    </View>
  );
}

function WeeklyHistory({ history }: { history: WeekRecord[] }) {
  if (!history.length) return <Text className="text-muted text-sm">No history yet</Text>;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {history.map(({ week, wins, losses }) => {
        const total = wins + losses;
        const bg = total === 0 ? 'bg-surface'
          : wins > losses ? 'bg-success/80'
          : wins < losses ? 'bg-danger/80'
          : 'bg-yellow-600/80';
        return (
          <View key={week} className={`${bg} rounded items-center justify-center`} style={{ width: 36, height: 36 }}>
            <Text className="text-white text-xs font-bold">{week}</Text>
            {total > 0 && <Text className="text-white/80" style={{ fontSize: 9 }}>{wins}-{losses}</Text>}
          </View>
        );
      })}
    </View>
  );
}

// ── Pick comparison ───────────────────────────────────────────────────────────

function PickComparison({
  targetId,
  targetName,
  season,
  isCurrentSeason,
}: {
  targetId: string;
  targetName: string;
  season: number;
  isCurrentSeason: boolean;
}) {
  const { user } = useAuth();
  const currentWeek = getCurrentNFLWeek();
  // TEMPORARY (Aug 2026): lets Nick test H2H comparisons against real preseason data before
  // the regular season has any games. Self-limiting -- only appears while preseason is the
  // actual current season type -- but should be removed outright once regular season starts.
  const { data: currentWeekData } = useCurrentWeek();
  const previewingPreseason = isCurrentSeason && currentWeekData?.seasonType === 'preseason';
  const [seasonType, setSeasonType] = useState<'regular' | 'preseason'>('regular');
  const effectiveSeasonType = previewingPreseason ? seasonType : 'regular';

  const maxWeek = effectiveSeasonType === 'preseason' ? (currentWeekData?.week ?? 1) : (isCurrentSeason ? currentWeek : 18);
  const [comparisonWeek, setComparisonWeek] = useState(maxWeek);

  // Reset to latest week when season or season type changes
  useEffect(() => {
    if (effectiveSeasonType === 'preseason') setComparisonWeek(currentWeekData?.week ?? 1);
    else setComparisonWeek(isCurrentSeason ? getCurrentNFLWeek() : 18);
  }, [season, effectiveSeasonType]);

  const { data: weekPicksData } = useWeekPicks(comparisonWeek, season, effectiveSeasonType);

  const myPicksMap = weekPicksData?.picksByUser[user!.uid] ?? {};
  const theirPicksMap = weekPicksData?.picksByUser[targetId] ?? {};
  const games = weekPicksData?.games ?? [];

  // Compute H2H summary for this week
  let h2hWins = 0, h2hLosses = 0, h2hTies = 0;
  for (const game of games) {
    const myEntry = myPicksMap[game.id];
    const theirEntry = theirPicksMap[game.id];
    if (!myEntry || !theirEntry) continue;
    if (myEntry.isCorrect === null || theirEntry.isCorrect === null) continue;
    if (myEntry.isCorrect && !theirEntry.isCorrect) h2hWins++;
    else if (!myEntry.isCorrect && theirEntry.isCorrect) h2hLosses++;
    else h2hTies++;
  }

  const diffCount = games.filter(g => {
    const mine = myPicksMap[g.id]?.pick;
    const theirs = theirPicksMap[g.id]?.pick;
    return mine && theirs && mine !== theirs;
  }).length;

  const effectiveCurrentWeek = effectiveSeasonType === 'preseason' ? (currentWeekData?.week ?? 1) : currentWeek;
  const isPastWeek = !isCurrentSeason || comparisonWeek < effectiveCurrentWeek;
  const canShow = weekPicksData?.locked || isPastWeek;

  const weekSelector = (
    <View>
      {previewingPreseason && (
        <TouchableOpacity
          onPress={() => setSeasonType(t => (t === 'preseason' ? 'regular' : 'preseason'))}
          className="self-start bg-surface border border-border rounded-full px-3 py-1 mb-2"
        >
          <Text className="text-xs text-primary font-semibold">
            {seasonType === 'preseason' ? 'Viewing Preseason — tap for Regular' : 'Viewing Regular — tap for Preseason'}
          </Text>
        </TouchableOpacity>
      )}
      <WeekSelector
        currentWeek={isCurrentSeason ? effectiveCurrentWeek : 0}
        selectedWeek={comparisonWeek}
        onSelect={setComparisonWeek}
        totalWeeks={maxWeek}
      />
    </View>
  );

  if (!canShow) {
    return (
      <View>
        {weekSelector}
        <View className="bg-surface rounded-xl px-4 py-5 mt-3 items-center">
          <Text className="text-muted text-sm text-center">
            Pick comparison appears here after Wednesday 9 PM lock.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {weekSelector}

      {/* H2H summary */}
      <View className="bg-surface rounded-xl flex-row mb-3">
        {([
          { label: 'You win', value: h2hWins, color: 'text-success' },
          { label: 'They win', value: h2hLosses, color: 'text-danger' },
          { label: 'Tie', value: h2hTies, color: 'text-muted' },
        ] as const).map(({ label, value, color }) => (
          <View key={label} className="flex-1 items-center py-3">
            <Text className={`text-xl font-bold ${color}`}>{value}</Text>
            <Text className="text-muted text-xs mt-0.5">{label}</Text>
          </View>
        ))}
      </View>

      {/* Diff note */}
      {games.length > 0 && (
        <Text className="text-muted text-xs mb-2">
          {diffCount > 0
            ? `Different picks on ${diffCount} game${diffCount === 1 ? '' : 's'}`
            : 'Same pick on every game this week'}
        </Text>
      )}

      {/* Game-by-game */}
      {games.length === 0 ? (
        <View className="bg-surface rounded-xl px-4 py-5 items-center">
          <Text className="text-muted text-sm">No games found for this week.</Text>
        </View>
      ) : (
        <View className="bg-surface rounded-xl overflow-hidden">
          <View className="flex-row px-4 py-2 border-b border-border">
            <Text className="flex-1 text-muted text-xs font-semibold">Game</Text>
            <Text className="w-24 text-center text-muted text-xs font-semibold">You</Text>
            <Text className="w-24 text-center text-muted text-xs font-semibold" numberOfLines={1}>
              {targetName.split(' ')[0]}
            </Text>
          </View>

          {games.map(game => {
            const myEntry = myPicksMap[game.id];
            const theirEntry = theirPicksMap[game.id];
            const differ = myEntry?.pick && theirEntry?.pick && myEntry.pick !== theirEntry.pick;

            const pickLabel = (entry?: { pick: 'home' | 'away'; isCorrect: boolean | null }) => {
              if (!entry) return { text: '—', logo: null, correct: null };
              const team = entry.pick === 'home' ? game.homeTeam : game.awayTeam;
              const logo = entry.pick === 'home' ? game.homeTeamLogo : game.awayTeamLogo;
              return { text: team.split(' ').pop() ?? team, logo, correct: entry.isCorrect };
            };

            const mine = pickLabel(myEntry);
            const theirs = pickLabel(theirEntry);

            const pickColor = (correct: boolean | null) =>
              correct === true ? 'text-success' : correct === false ? 'text-danger' : 'text-white';

            return (
              <View
                key={game.id}
                className={`flex-row items-center px-4 py-2.5 border-b border-border ${differ ? 'bg-primary/5' : ''}`}
              >
                <View className="flex-1">
                  <Text className="text-white text-xs" numberOfLines={1}>
                    {game.awayTeam.split(' ').pop()} @ {game.homeTeam.split(' ').pop()}
                  </Text>
                  {differ && <Text className="text-primary text-xs mt-0.5">different pick</Text>}
                </View>

                <View className="w-24 items-center">
                  {mine.logo ? (
                    <View className="flex-row items-center gap-1">
                      <Image source={{ uri: mine.logo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                      <Text className={`text-xs font-semibold ${pickColor(mine.correct)}`}>{mine.text}</Text>
                    </View>
                  ) : (
                    <Text className="text-muted text-xs">{mine.text}</Text>
                  )}
                </View>

                <View className="w-24 items-center">
                  {theirs.logo ? (
                    <View className="flex-row items-center gap-1">
                      <Image source={{ uri: theirs.logo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                      <Text className={`text-xs font-semibold ${pickColor(theirs.correct)}`}>{theirs.text}</Text>
                    </View>
                  ) : (
                    <Text className="text-muted text-xs">{theirs.text}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id: userId, season: seasonParam } = useLocalSearchParams<{ id: string; season?: string }>();
  const currentSeason = getCurrentNFLSeason();
  const [season, setSeason] = useState(seasonParam ? parseInt(seasonParam, 10) : currentSeason);
  const isCurrentSeason = season === currentSeason;
  const { data: profile, isLoading } = usePublicProfile(userId, season);
  const { data: seasonTrophies = [] } = useSeasonTrophies(profile?.id);
  const { data: achievements = [] } = usePublicAchievements(profile?.id, season);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-white text-lg font-bold mb-2">Profile not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary text-sm">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <View className="flex-1 bg-background">
      {/* Header bar */}
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-white font-bold text-base" numberOfLines={1}>
          {profile.teamName}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View className="px-4 pt-5 pb-4 flex-row items-center">
          <Avatar name={profile.teamName} size={56} />
          <View className="ml-4 flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-white text-lg font-bold">{profile.teamName}</Text>
              {profile.isGridiron && (
                <View className="bg-primary/20 rounded px-2 py-0.5">
                  <Text className="text-primary text-xs font-semibold">GRIDIRON</Text>
                </View>
              )}
            </View>
            <Text className="text-muted text-xs mt-1">Member since {memberSince}</Text>
          </View>
        </View>

        {/* Season selector */}
        <View className="flex-row items-center justify-center py-3 border-b border-border">
          <TouchableOpacity
            onPress={() => setSeason(s => Math.max(FIRST_SEASON, s - 1))}
            disabled={season <= FIRST_SEASON}
            className="px-3 py-1"
          >
            <Text className={`text-xl font-bold ${season <= FIRST_SEASON ? 'text-border' : 'text-primary'}`}>−</Text>
          </TouchableOpacity>
          <Text className="text-white font-semibold text-sm mx-3">{season} Season</Text>
          <TouchableOpacity
            onPress={() => setSeason(s => Math.min(currentSeason, s + 1))}
            disabled={season >= currentSeason}
            className="px-3 py-1"
          >
            <Text className={`text-xl font-bold ${season >= currentSeason ? 'text-border' : 'text-primary'}`}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Season stats */}
        <View className="mx-4 mb-5 mt-5">
          <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
            {season} Season
          </Text>
          <View className="flex-row gap-2 mb-2">
            <StatBox
              label="Record"
              value={`${profile.seasonRecord.wins}-${profile.seasonRecord.losses}`}
            />
            <StatBox label="Accuracy" value={`${profile.accuracy}%`} />
          </View>
          <View className="flex-row gap-2">
            <StatBox
              label="Best Week"
              value={profile.bestWeek ? `Week ${profile.bestWeek.week}` : '—'}
              sub={profile.bestWeek ? `${profile.bestWeek.wins} wins` : undefined}
            />
            <StatBox label="Achievements" value={String(profile.trophyCount)} />
          </View>
        </View>

        {/* Weekly history */}
        <View className="mx-4 mb-5">
          <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
            Week by Week
          </Text>
          <WeeklyHistory history={profile.weeklyHistory} />
        </View>

        {/* Trophy Case */}
        {seasonTrophies.length > 0 && (
          <View className="mx-4 mb-5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
              Trophy Case
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {seasonTrophies.map(trophy => (
                <View key={trophy.id} style={{ width: '47%' }}>
                  <SeasonTrophyCard trophy={trophy} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Achievements — weekly, filtered to the selected season */}
        {achievements.length > 0 && (
          <View className="mx-4 mb-5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
              Achievements ({achievements.length})
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {achievements.map(trophy => (
                <View key={trophy.id} style={{ width: '47%' }}>
                  <AchievementCard trophy={trophy} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Pick comparison — all seasons, with week navigation */}
        <View className="mx-4 mb-5">
          <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
            Pick Comparison
          </Text>
          <PickComparison
            targetId={profile.id}
            targetName={profile.teamName}
            season={season}
            isCurrentSeason={isCurrentSeason}
          />
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
