import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrentNFLSeason } from '@/lib/nflSeason';
import { useTeamDetail, type RecentGame } from '@/hooks/useTeams';

const FIRST_SEASON = 2025;

function StatPill({ label, value }: { label: string; value: string | number | null }) {
  return (
    <View className="flex-1 bg-surface rounded-xl p-3 items-center">
      <Text className="text-white text-lg font-bold">{value ?? '—'}</Text>
      <Text className="text-muted text-xs mt-0.5">{label}</Text>
    </View>
  );
}

function GameRow({ game }: { game: RecentGame }) {
  const resultColor = game.result === 'W' ? '#22c55e' : game.result === 'L' ? '#ef4444' : '#6b7280';
  const resultLabel = game.result ?? (game.status === 'pre' ? 'Upcoming' : 'Live');
  const atLabel = game.isHome ? 'vs' : '@';
  const dateStr = game.gameTime
    ? new Date(game.gameTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border">
      {/* Result badge */}
      <View
        style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: game.result ? `${resultColor}25` : '#1f2937' }}
        className="items-center justify-center mr-3"
      >
        <Text style={{ color: resultColor, fontWeight: 'bold', fontSize: 12 }}>
          {game.result ?? (game.status === 'in' ? '●' : 'Wk')}
        </Text>
      </View>

      {/* Opponent */}
      <View className="w-7 h-7 mr-2 items-center justify-center">
        {game.opponentLogo ? (
          <Image source={{ uri: game.opponentLogo }} style={{ width: 26, height: 26 }} resizeMode="contain" />
        ) : null}
      </View>
      <Text className="flex-1 text-white text-sm" numberOfLines={1}>
        {atLabel} {game.opponent}
      </Text>

      {/* Score */}
      {game.myScore !== null && game.theirScore !== null ? (
        <Text style={{ color: resultColor, fontWeight: 'bold', fontSize: 14 }}>
          {game.myScore}–{game.theirScore}
        </Text>
      ) : (
        <Text className="text-muted text-sm">{dateStr}</Text>
      )}

      <Text className="text-muted text-xs ml-3 w-8 text-right">Wk {game.week}</Text>
    </View>
  );
}

export default function TeamDetailScreen() {
  const router = useRouter();
  const { name, season: seasonParam, seasonType: seasonTypeParam } = useLocalSearchParams<{ name: string; season?: string; seasonType?: string }>();
  const currentSeason = new Date().getFullYear();
  const [season, setSeason] = useState(seasonParam ? parseInt(seasonParam, 10) : getCurrentNFLSeason());
  const seasonType = (seasonTypeParam as 'regular' | 'preseason') ?? 'regular';
  const { data: team, isLoading, isError } = useTeamDetail(name ?? '', season, seasonType);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (isError || !team) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-white font-bold mb-2">Team not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary text-sm">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickColor = team.pickAccuracy !== null
    ? team.pickAccuracy >= 60 ? '#22c55e' : team.pickAccuracy >= 40 ? '#eab308' : '#ef4444'
    : '#6b7280';
  const recordColor = team.wins > team.losses ? '#22c55e' : team.wins < team.losses ? '#ef4444' : '#eab308';
  const gp = team.wins + team.losses;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-base" numberOfLines={1}>{team.name}</Text>
          <View className="flex-row items-center gap-3 mt-0.5">
            <TouchableOpacity
              onPress={() => setSeason(s => Math.max(FIRST_SEASON, s - 1))}
              disabled={season <= FIRST_SEASON}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            >
              <Text className={`text-base leading-5 ${season <= FIRST_SEASON ? 'text-surface' : 'text-muted'}`}>−</Text>
            </TouchableOpacity>
            <Text className="text-muted text-xs">{season} {seasonType === 'preseason' ? 'Preseason' : 'Season'}</Text>
            <TouchableOpacity
              onPress={() => setSeason(s => Math.min(currentSeason, s + 1))}
              disabled={season >= currentSeason}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <Text className={`text-base leading-5 ${season >= currentSeason ? 'text-surface' : 'text-muted'}`}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Team hero */}
        <View className="items-center py-6">
          {team.logo ? (
            <Image source={{ uri: team.logo }} style={{ width: 96, height: 96 }} resizeMode="contain" />
          ) : (
            <View className="w-24 h-24 rounded-full bg-surface items-center justify-center">
              <Text className="text-white text-2xl font-bold">{team.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <Text className="text-white text-xl font-bold mt-3">{team.name}</Text>
          <Text style={{ color: recordColor, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
            {team.wins}–{team.losses}
            {gp > 0 ? <Text style={{ color: '#6b7280', fontWeight: '400', fontSize: 13 }}> · {gp} games</Text> : null}
          </Text>
        </View>

        {/* Scoring stats */}
        {(team.ppg !== null || team.ppgAllowed !== null) && (
          <View className="mx-4 mb-5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">Scoring</Text>
            <View className="flex-row gap-2">
              <StatPill label="PPG" value={team.ppg} />
              <StatPill label="PPG Allowed" value={team.ppgAllowed} />
              {team.ppg !== null && team.ppgAllowed !== null && (
                <StatPill
                  label="Diff"
                  value={`${team.ppg - team.ppgAllowed >= 0 ? '+' : ''}${(team.ppg - team.ppgAllowed).toFixed(1)}`}
                />
              )}
            </View>
          </View>
        )}

        {/* Yards stats */}
        {(team.ypg !== null || team.yapg !== null) && (
          <View className="mx-4 mb-5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">Yards</Text>
            <View className="flex-row gap-2">
              {team.ypg !== null && <StatPill label="YPG" value={team.ypg} />}
              {team.yapg !== null && <StatPill label="YPG Allowed" value={team.yapg} />}
              {team.passYpg !== null && <StatPill label="Pass YPG" value={team.passYpg} />}
              {team.rushYpg !== null && <StatPill label="Rush YPG" value={team.rushYpg} />}
            </View>
            {team.statsSeasonUsed !== null && team.statsSeasonUsed < season && (
              <Text className="text-muted text-xs mt-2 text-center">Using {team.statsSeasonUsed} season averages</Text>
            )}
          </View>
        )}

        {/* Efficiency stats */}
        {(team.thirdDownPct !== null || team.redZonePct !== null || team.sacksPG !== null || team.turnoversPG !== null) && (
          <View className="mx-4 mb-5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">Efficiency</Text>
            <View className="flex-row gap-2 mb-2">
              {team.thirdDownPct !== null && <StatPill label="3rd Down %" value={`${team.thirdDownPct}%`} />}
              {team.redZonePct !== null && <StatPill label="Red Zone %" value={`${team.redZonePct}%`} />}
            </View>
            <View className="flex-row gap-2">
              {team.sacksPG !== null && <StatPill label="Sacks/G" value={team.sacksPG.toFixed(1)} />}
              {team.turnoversPG !== null && <StatPill label="Turnovers/G" value={team.turnoversPG.toFixed(1)} />}
            </View>
          </View>
        )}

        {/* Community picks */}
        {team.pickTotal > 0 && (
          <View className="mx-4 mb-5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">Community Picks</Text>
            <View className="bg-surface rounded-xl px-4 py-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="items-center">
                  <Text className="text-white text-xl font-bold">{team.pickTotal}</Text>
                  <Text className="text-muted text-xs">Total Picks</Text>
                </View>
                <View className="items-center">
                  <Text className="text-success text-xl font-bold">{team.pickWins}</Text>
                  <Text className="text-muted text-xs">Correct</Text>
                </View>
                <View className="items-center">
                  <Text className="text-danger text-xl font-bold">{team.pickLosses}</Text>
                  <Text className="text-muted text-xs">Wrong</Text>
                </View>
                <View className="items-center">
                  <Text style={{ color: pickColor, fontSize: 20, fontWeight: 'bold' }}>
                    {team.pickAccuracy}%
                  </Text>
                  <Text className="text-muted text-xs">Accuracy</Text>
                </View>
              </View>
              {/* Accuracy bar */}
              <View className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{ width: `${team.pickAccuracy ?? 0}%`, backgroundColor: pickColor }}
                />
              </View>
            </View>
          </View>
        )}

        {/* Recent games */}
        {team.recentGames.length > 0 && (
          <View className="mx-4 mb-5">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">Recent Games</Text>
            <View className="bg-surface rounded-xl overflow-hidden">
              {team.recentGames.map(game => (
                <GameRow key={game.gameId} game={game} />
              ))}
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
