import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useWeekPicks } from '@/hooks/useWeekPicks';
import { useGames } from '@/hooks/usePicksData';
import { getCurrentNFLSeason, getCurrentNFLWeek } from '@/lib/nflSeason';
import { useAuth } from '@/context/AuthContext';
import type { WeekRecord } from '@/hooks/useProfile';

const SEASON = getCurrentNFLSeason();

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

// ── Pick comparison (Nick's favorite feature) ─────────────────────────────────

function PickComparison({
  targetId,
  targetName,
}: {
  targetId: string;
  targetName: string;
}) {
  const { user } = useAuth();
  const week = getCurrentNFLWeek();
  const { data: weekPicksData } = useWeekPicks(week, SEASON);
  const { data: myGames } = useGames(week, SEASON);

  if (!weekPicksData?.locked) {
    return (
      <View className="bg-surface rounded-xl px-4 py-5 items-center">
        <Text className="text-muted text-sm text-center">
          Pick comparison appears here after Wednesday 9 PM lock.
        </Text>
      </View>
    );
  }

  const myPicksMap = Object.fromEntries(
    (myGames ?? []).map(g => [g.id, g.myPick])
  );
  const theirPicksMap = weekPicksData.picksByUser[targetId] ?? {};
  const games = weekPicksData.games;

  const diffCount = games.filter(g => {
    const mine = myPicksMap[g.id];
    const theirs = theirPicksMap[g.id]?.pick;
    return mine && theirs && mine !== theirs;
  }).length;

  return (
    <View>
      <Text className="text-muted text-xs mb-2">
        {diffCount > 0
          ? `You picked differently on ${diffCount} game${diffCount === 1 ? '' : 's'} this week`
          : 'You picked the same team on every game this week'}
      </Text>
      <View className="bg-surface rounded-xl overflow-hidden">
        {/* Header */}
        <View className="flex-row px-4 py-2 border-b border-border">
          <Text className="flex-1 text-muted text-xs font-semibold">Game</Text>
          <Text className="w-24 text-center text-muted text-xs font-semibold">You</Text>
          <Text className="w-24 text-center text-muted text-xs font-semibold" numberOfLines={1}>
            {targetName.split(' ')[0]}
          </Text>
        </View>

        {games.map(game => {
          const myPick = myPicksMap[game.id];
          const theirEntry = theirPicksMap[game.id];
          const theirPick = theirEntry?.pick;
          const differ = myPick && theirPick && myPick !== theirPick;

          const pickLabel = (pick: 'home' | 'away' | null | undefined, isCorrect?: boolean | null) => {
            if (!pick) return { text: '—', logo: null, correct: null };
            const team = pick === 'home' ? game.homeTeam : game.awayTeam;
            const logo = pick === 'home' ? game.homeTeamLogo : game.awayTeamLogo;
            return { text: team.split(' ').pop() ?? team, logo, correct: isCorrect ?? null };
          };

          const mine = pickLabel(myPick as 'home' | 'away' | null);
          const theirs = pickLabel(theirPick, theirEntry?.isCorrect);

          const myCorrect = (myGames ?? []).find(g => g.id === game.id);
          const myIsCorrect = myCorrect?.myPick
            ? (myCorrect.myPick === 'home'
              ? (game.homeScore ?? 0) > (game.awayScore ?? 0)
              : (game.awayScore ?? 0) > (game.homeScore ?? 0))
            : null;

          return (
            <View
              key={game.id}
              className={`flex-row items-center px-4 py-2.5 border-b border-border ${differ ? 'bg-primary/5' : ''}`}
            >
              {/* Game */}
              <View className="flex-1">
                <Text className="text-white text-xs" numberOfLines={1}>
                  {game.awayTeam.split(' ').pop()} @ {game.homeTeam.split(' ').pop()}
                </Text>
                {differ && (
                  <Text className="text-primary text-xs mt-0.5">different pick</Text>
                )}
              </View>

              {/* My pick */}
              <View className="w-24 items-center">
                {mine.logo ? (
                  <View className="flex-row items-center gap-1">
                    <Image source={{ uri: mine.logo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                    <Text className={`text-xs font-semibold ${myIsCorrect === true ? 'text-success' : myIsCorrect === false ? 'text-danger' : 'text-white'}`}>
                      {mine.text}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-muted text-xs">{mine.text}</Text>
                )}
              </View>

              {/* Their pick */}
              <View className="w-24 items-center">
                {theirs.logo ? (
                  <View className="flex-row items-center gap-1">
                    <Image source={{ uri: theirs.logo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                    <Text className={`text-xs font-semibold ${theirs.correct === true ? 'text-success' : theirs.correct === false ? 'text-danger' : 'text-white'}`}>
                      {theirs.text}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-muted text-xs">{theirs.text}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id: userId } = useLocalSearchParams<{ id: string }>();
  const { data: profile, isLoading } = usePublicProfile(userId);

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

  const h2w = profile.h2hCurrentWeek;

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
              {profile.isLongie && (
                <View className="bg-primary/20 rounded px-2 py-0.5">
                  <Text className="text-primary text-xs font-semibold">LONGIE</Text>
                </View>
              )}
            </View>
            <Text className="text-muted text-xs mt-1">Member since {memberSince}</Text>
          </View>
        </View>

        {/* Season stats */}
        <View className="mx-4 mb-5">
          <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
            {getCurrentNFLSeason()} Season
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

        {/* H2H this week summary */}
        {h2w && (
          <View className="mx-4 mb-5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
              H2H vs You (current week)
            </Text>
            <View className="bg-surface rounded-xl flex-row">
              {[
                { label: 'You win', value: h2w.wins, color: 'text-success' },
                { label: 'They win', value: h2w.losses, color: 'text-danger' },
                { label: 'Tie', value: h2w.ties, color: 'text-muted' },
              ].map(({ label, value, color }) => (
                <View key={label} className="flex-1 items-center py-4">
                  <Text className={`text-2xl font-bold ${color}`}>{value}</Text>
                  <Text className="text-muted text-xs mt-1">{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Weekly history */}
        <View className="mx-4 mb-5">
          <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
            Week by Week
          </Text>
          <WeeklyHistory history={profile.weeklyHistory} />
        </View>

        {/* Pick comparison */}
        <View className="mx-4 mb-5">
          <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
            Pick Comparison — Week {getCurrentNFLWeek()}
          </Text>
          <PickComparison targetId={profile.id} targetName={profile.teamName} />
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
