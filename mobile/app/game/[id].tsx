import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGameDetail, type PickEntry } from '@/hooks/useGameDetail';
import { useGames } from '@/hooks/usePicksData';
import { getCurrentNFLSeason } from '@/lib/nflSeason';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function WinProbBar({ favoriteTeam, prob, homeTeam, awayTeam }: {
  favoriteTeam: string | null;
  prob: string | null;
  homeTeam: string;
  awayTeam: string;
}) {
  if (!prob || !favoriteTeam) return null;
  const favPct = Math.round(parseFloat(prob) * 100);
  const undPct = 100 - favPct;
  const favIsHome = favoriteTeam === homeTeam;
  const homePct = favIsHome ? favPct : undPct;
  const awayPct = favIsHome ? undPct : favPct;

  return (
    <View className="mt-4">
      <Text className="text-muted text-xs mb-1">Win probability</Text>
      <View className="h-2 bg-surface rounded-full overflow-hidden flex-row">
        <View className="h-full bg-primary/60" style={{ flex: awayPct }} />
        <View className="h-full bg-primary" style={{ flex: homePct }} />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-muted text-xs">{awayPct}%</Text>
        <Text className="text-muted text-xs">{homePct}%</Text>
      </View>
    </View>
  );
}

// ── Pick list row ─────────────────────────────────────────────────────────────

function PickRow({ entry }: { entry: PickEntry }) {
  const initials = entry.teamName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const outcomeColor = entry.isCorrect === true
    ? 'text-success'
    : entry.isCorrect === false
    ? 'text-danger'
    : 'text-muted';
  const outcomeChar = entry.isCorrect === true ? '✓' : entry.isCorrect === false ? '✗' : '·';

  return (
    <View className="flex-row items-center px-4 py-2.5 border-b border-border">
      <View className="w-8 h-8 rounded-full bg-surface-2 items-center justify-center mr-3">
        <Text className="text-white text-xs font-bold">{initials}</Text>
      </View>
      <Text className="flex-1 text-white text-sm">{entry.teamName}</Text>
      <Text className={`text-lg font-bold ${outcomeColor}`}>{outcomeChar}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function GameDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; week: string; season: string }>();
  const gameId = params.id;
  const week = parseInt(params.week ?? '0', 10);
  const season = parseInt(params.season ?? String(getCurrentNFLSeason()), 10);

  const { data: game, isLoading, isError } = useGameDetail(gameId);
  const { data: weekGames } = useGames(week, season);

  // Prev / Next within the week
  const orderedIds = weekGames?.map(g => g.id) ?? [];
  const idx = orderedIds.indexOf(gameId);
  const prevId = idx > 0 ? orderedIds[idx - 1] : null;
  const nextId = idx < orderedIds.length - 1 ? orderedIds[idx + 1] : null;

  const navigate = (id: string) =>
    router.replace({ pathname: '/game/[id]' as any, params: { id, week: String(week), season: String(season) } });

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (isError || !game) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-white text-lg font-bold mb-2">Game not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary text-sm">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFinal = game.status === 'post';
  const isLive = game.status === 'in';
  const homePicks = game.pickBreakdown?.picks.filter(p => p.pick === 'home') ?? [];
  const awayPicks = game.pickBreakdown?.picks.filter(p => p.pick === 'away') ?? [];

  return (
    <View className="flex-1 bg-background">
      {/* ── Header bar ── */}
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {game.awayTeam} @ {game.homeTeam}
          </Text>
          <Text className="text-muted text-xs">
            {isFinal ? 'Final' : isLive ? `Q${game.period ?? ''} · ${game.displayClock ?? ''}` : formatDate(game.gameTime)}
          </Text>
        </View>
        <View className="flex-row ml-3 gap-2">
          <TouchableOpacity
            onPress={() => prevId && navigate(prevId)}
            disabled={!prevId}
            className={`px-2 py-1 rounded ${prevId ? 'bg-surface' : 'opacity-20'}`}
          >
            <Text className="text-white text-sm">‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => nextId && navigate(nextId)}
            disabled={!nextId}
            className={`px-2 py-1 rounded ${nextId ? 'bg-surface' : 'opacity-20'}`}
          >
            <Text className="text-white text-sm">›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Score or team info ── */}
        <View className="flex-row items-center px-6 py-6">
          {/* Away */}
          <View className="flex-1 items-center">
            {game.awayTeamLogo ? (
              <Image source={{ uri: game.awayTeamLogo }} style={{ width: 64, height: 64 }} resizeMode="contain" />
            ) : null}
            <Text className="text-white font-semibold text-sm mt-2 text-center" numberOfLines={2}>
              {game.awayTeam}
            </Text>
            {game.awayTeamRecord && (
              <Text className="text-muted text-xs">{game.awayTeamRecord}</Text>
            )}
          </View>

          {/* Score or vs */}
          <View className="items-center px-4">
            {(isFinal || isLive) ? (
              <View className="flex-row items-center gap-3">
                <Text className="text-white text-3xl font-bold">{game.awayScore ?? 0}</Text>
                <Text className="text-muted text-lg">–</Text>
                <Text className="text-white text-3xl font-bold">{game.homeScore ?? 0}</Text>
              </View>
            ) : (
              <>
                <Text className="text-muted text-lg font-bold">vs</Text>
                {game.spread && (
                  <Text className="text-muted text-xs mt-1">Spread: {game.spread}</Text>
                )}
              </>
            )}
          </View>

          {/* Home */}
          <View className="flex-1 items-center">
            {game.homeTeamLogo ? (
              <Image source={{ uri: game.homeTeamLogo }} style={{ width: 64, height: 64 }} resizeMode="contain" />
            ) : null}
            <Text className="text-white font-semibold text-sm mt-2 text-center" numberOfLines={2}>
              {game.homeTeam}
            </Text>
            {game.homeTeamRecord && (
              <Text className="text-muted text-xs">{game.homeTeamRecord}</Text>
            )}
          </View>
        </View>

        {/* ── Pre-game stats ── */}
        {!isFinal && !isLive && (
          <View className="mx-4 mb-4 bg-surface rounded-xl px-4 py-4">
            <View className="flex-row justify-between mb-3">
              <Text className="text-muted text-xs font-semibold uppercase">Stat</Text>
              <Text className="text-muted text-xs font-semibold text-right" style={{ width: 60 }}>
                {game.awayTeam.split(' ').pop()}
              </Text>
              <Text className="text-muted text-xs font-semibold text-right" style={{ width: 60 }}>
                {game.homeTeam.split(' ').pop()}
              </Text>
            </View>
            {game.awayTeamPPG && game.homeTeamPPG && (
              <View className="flex-row justify-between py-1.5 border-b border-border">
                <Text className="text-muted text-sm flex-1">PPG</Text>
                <Text className="text-white text-sm text-right" style={{ width: 60 }}>{parseFloat(game.awayTeamPPG).toFixed(1)}</Text>
                <Text className="text-white text-sm text-right" style={{ width: 60 }}>{parseFloat(game.homeTeamPPG).toFixed(1)}</Text>
              </View>
            )}
            {game.awayTeamPPGAllowed && game.homeTeamPPGAllowed && (
              <View className="flex-row justify-between py-1.5">
                <Text className="text-muted text-sm flex-1">Opp PPG</Text>
                <Text className="text-white text-sm text-right" style={{ width: 60 }}>{parseFloat(game.awayTeamPPGAllowed).toFixed(1)}</Text>
                <Text className="text-white text-sm text-right" style={{ width: 60 }}>{parseFloat(game.homeTeamPPGAllowed).toFixed(1)}</Text>
              </View>
            )}
            <WinProbBar
              favoriteTeam={game.favoriteTeam}
              prob={game.winningTeamWinProb}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
            />
          </View>
        )}

        {/* ── Pick list (after lock only) ── */}
        {game.isLocked && game.pickBreakdown && (
          <>
            {/* Away picks */}
            {awayPicks.length > 0 && (
              <View className="mx-4 mb-4">
                <View className="flex-row items-center mb-2">
                  {game.awayTeamLogo && (
                    <Image source={{ uri: game.awayTeamLogo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                  )}
                  <Text className="text-white font-semibold text-sm ml-2">
                    {game.awayTeam} — {game.pickBreakdown.awayPct}%
                  </Text>
                </View>
                <View className="bg-surface rounded-xl overflow-hidden">
                  {awayPicks.map(p => <PickRow key={p.userId} entry={p} />)}
                </View>
              </View>
            )}

            {/* Home picks */}
            {homePicks.length > 0 && (
              <View className="mx-4 mb-4">
                <View className="flex-row items-center mb-2">
                  {game.homeTeamLogo && (
                    <Image source={{ uri: game.homeTeamLogo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                  )}
                  <Text className="text-white font-semibold text-sm ml-2">
                    {game.homeTeam} — {game.pickBreakdown.homePct}%
                  </Text>
                </View>
                <View className="bg-surface rounded-xl overflow-hidden">
                  {homePicks.map(p => <PickRow key={p.userId} entry={p} />)}
                </View>
              </View>
            )}

            {/* No picks edge case */}
            {awayPicks.length === 0 && homePicks.length === 0 && (
              <View className="mx-4 mb-4 items-center py-8">
                <Text className="text-muted text-sm">No picks submitted for this game</Text>
              </View>
            )}
          </>
        )}

        {/* Before lock message */}
        {!game.isLocked && (
          <View className="mx-4 mb-4 bg-surface rounded-xl px-4 py-6 items-center">
            <Text className="text-muted text-sm text-center">
              Player picks will appear here after Wednesday 9 PM lock.
            </Text>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
