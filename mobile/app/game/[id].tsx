import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGameDetail, type PickEntry, type RecentGameEntry, type BoxScore } from '@/hooks/useGameDetail';
import { useGames } from '@/hooks/usePicksData';
import { getCurrentNFLSeason } from '@/lib/nflSeason';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRatio(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw.replace('-', '/');
}

function StatRow({ label, away, home }: { label: string; away: string; home: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-border">
      <Text className="text-muted text-sm flex-1">{label}</Text>
      <Text className="text-white text-sm font-medium text-right" style={{ width: 64 }}>{away}</Text>
      <Text className="text-white text-sm font-medium text-right" style={{ width: 64 }}>{home}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function WinProbBar({ favoriteTeam, prob, homeTeam, awayTeam }: {
  favoriteTeam: string | null;
  prob: number | null;
  homeTeam: string;
  awayTeam: string;
}) {
  if (!prob || !favoriteTeam) return null;
  const favPct = Math.round(Number(prob));
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

// ── Recent game row ───────────────────────────────────────────────────────────

function RecentGameRow({ g }: { g: RecentGameEntry }) {
  const color = g.result === 'W' ? '#22c55e' : g.result === 'L' ? '#ef4444' : '#6b7280';
  const atLabel = g.isHome ? 'vs' : '@';
  const dateStr = g.gameTime
    ? new Date(g.gameTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  return (
    <View className="flex-row items-center px-4 py-2.5 border-b border-border">
      <View style={{ width: 24, height: 24, borderRadius: 5, backgroundColor: g.result ? `${color}25` : '#1f2937' }}
        className="items-center justify-center mr-3">
        <Text style={{ color, fontWeight: 'bold', fontSize: 11 }}>{g.result ?? 'Wk'}</Text>
      </View>
      {g.opponentLogo ? (
        <Image source={{ uri: g.opponentLogo }} style={{ width: 22, height: 22, marginRight: 6 }} resizeMode="contain" />
      ) : <View style={{ width: 22, marginRight: 6 }} />}
      <Text className="flex-1 text-white text-sm" numberOfLines={1}>{atLabel} {g.opponent}</Text>
      {g.teamScore !== null && g.oppScore !== null ? (
        <Text style={{ color, fontWeight: 'bold', fontSize: 13 }}>{g.teamScore}–{g.oppScore}</Text>
      ) : (
        <Text className="text-muted text-xs">{dateStr}</Text>
      )}
      <Text className="text-muted text-xs ml-2 w-8 text-right">W{g.week}</Text>
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
  const params = useLocalSearchParams<{ id: string; week: string; season: string; seasonType: string }>();
  const gameId = params.id;
  const week = parseInt(params.week ?? '0', 10);
  const season = parseInt(params.season ?? String(getCurrentNFLSeason()), 10);
  const seasonType = (params.seasonType ?? 'regular') as 'regular' | 'preseason';

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
  const isPre = game.status === 'pre';

  const homeWins = isFinal && (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const awayWins = isFinal && (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const myPickedHome = game.myPick === 'home';
  const myPickedAway = game.myPick === 'away';
  const hasPick = game.myPick !== null;
  const iWon = (myPickedHome && homeWins) || (myPickedAway && awayWins);
  const iLost = hasPick && isFinal && !iWon;

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
        {/* ── Outcome banner (final games with a pick) ── */}
        {isFinal && hasPick && (
          <View
            className={`mx-4 mt-4 rounded-xl py-3 px-4 flex-row items-center justify-center gap-2 ${iWon ? 'bg-success/20' : 'bg-danger/20'}`}
          >
            <Text className={`text-xl font-bold ${iWon ? 'text-success' : 'text-danger'}`}>
              {iWon ? '✓' : '✗'}
            </Text>
            <Text className={`font-bold text-base ${iWon ? 'text-success' : 'text-danger'}`}>
              {iWon ? 'Correct pick!' : 'Wrong pick'}
            </Text>
          </View>
        )}

        {/* ── Score / team info ── */}
        <View className="flex-row items-center px-4 py-6">
          {/* Away */}
          <TouchableOpacity
            className={`flex-1 items-center rounded-xl py-3 px-2 ${awayWins ? 'bg-success/10' : ''}`}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/team/[name]' as any, params: { name: game.awayTeam, season: String(season), seasonType } })}
          >
            {game.awayTeamLogo ? (
              <Image
                source={{ uri: game.awayTeamLogo }}
                style={{ width: 64, height: 64, opacity: isFinal && !awayWins ? 0.5 : 1 }}
                resizeMode="contain"
              />
            ) : null}
            <Text
              className={`font-semibold text-sm mt-2 text-center ${awayWins ? 'text-success' : 'text-white'}`}
              numberOfLines={2}
            >
              {game.awayTeam}
            </Text>
            {game.awayTeamRecord && !isFinal && (
              <Text className="text-muted text-xs">{game.awayTeamRecord}</Text>
            )}
            {myPickedAway && (
              <View className={`mt-1.5 rounded px-2 py-0.5 ${isFinal ? (awayWins ? 'bg-success' : 'bg-danger') : 'bg-primary'}`}>
                <Text className="text-white text-xs font-bold">
                  {isFinal ? (awayWins ? '✓ MY PICK' : '✗ MY PICK') : 'MY PICK'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Score or vs */}
          <View className="items-center px-3">
            {(isFinal || isLive) ? (
              <View className="items-center">
                <View className="flex-row items-center gap-2">
                  <Text className={`text-3xl font-bold ${awayWins ? 'text-success' : isFinal ? 'text-muted' : 'text-white'}`}>
                    {game.awayScore ?? 0}
                  </Text>
                  <Text className="text-muted text-lg">–</Text>
                  <Text className={`text-3xl font-bold ${homeWins ? 'text-success' : isFinal ? 'text-muted' : 'text-white'}`}>
                    {game.homeScore ?? 0}
                  </Text>
                </View>
                {isLive && (
                  <Text className="text-danger text-xs font-bold mt-1">LIVE</Text>
                )}
              </View>
            ) : (
              <>
                <Text className="text-muted text-base font-bold">vs</Text>
                {game.winningTeamWinProb && game.favoriteTeam && (() => {
                  const favPct = Math.round(Number(game.winningTeamWinProb));
                  const awayPct = game.favoriteTeam === game.awayTeam ? favPct : 100 - favPct;
                  const homePct = game.favoriteTeam === game.homeTeam ? favPct : 100 - favPct;
                  return <Text className="text-muted text-xs mt-1">{awayPct}% – {homePct}%</Text>;
                })()}
              </>
            )}
          </View>

          {/* Home */}
          <TouchableOpacity
            className={`flex-1 items-center rounded-xl py-3 px-2 ${homeWins ? 'bg-success/10' : ''}`}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/team/[name]' as any, params: { name: game.homeTeam, season: String(season), seasonType } })}
          >
            {game.homeTeamLogo ? (
              <Image
                source={{ uri: game.homeTeamLogo }}
                style={{ width: 64, height: 64, opacity: isFinal && !homeWins ? 0.5 : 1 }}
                resizeMode="contain"
              />
            ) : null}
            <Text
              className={`font-semibold text-sm mt-2 text-center ${homeWins ? 'text-success' : 'text-white'}`}
              numberOfLines={2}
            >
              {game.homeTeam}
            </Text>
            {game.homeTeamRecord && !isFinal && (
              <Text className="text-muted text-xs">{game.homeTeamRecord}</Text>
            )}
            {myPickedHome && (
              <View className={`mt-1.5 rounded px-2 py-0.5 ${isFinal ? (homeWins ? 'bg-success' : 'bg-danger') : 'bg-primary'}`}>
                <Text className="text-white text-xs font-bold">
                  {isFinal ? (homeWins ? '✓ MY PICK' : '✗ MY PICK') : 'MY PICK'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Pre-game stats (season averages) ── */}
        {isPre && (game.awayPPG !== null || game.homeYPG !== null || game.winningTeamWinProb !== null) && (
          <View className="mx-4 mb-4 bg-surface rounded-xl px-4 py-4">
            {game.statsSeasonUsed !== null && game.statsSeasonUsed < game.season && (
              <Text className="text-muted text-xs mb-2 text-center">Using {game.statsSeasonUsed} season averages</Text>
            )}
            <View className="flex-row mb-3">
              <Text className="text-muted text-xs font-semibold uppercase flex-1">Stat</Text>
              <Text className="text-muted text-xs font-semibold text-right" style={{ width: 64 }}>{game.awayTeam.split(' ').pop()}</Text>
              <Text className="text-muted text-xs font-semibold text-right" style={{ width: 64 }}>{game.homeTeam.split(' ').pop()}</Text>
            </View>
            {game.awayPPG !== null && game.homePPG !== null && (
              <StatRow label="PPG" away={game.awayPPG.toFixed(1)} home={game.homePPG.toFixed(1)} />
            )}
            {game.awayPPGA !== null && game.homePPGA !== null && (
              <StatRow label="Opp PPG" away={game.awayPPGA.toFixed(1)} home={game.homePPGA.toFixed(1)} />
            )}
            {game.awayYPG !== null && game.homeYPG !== null && (
              <StatRow label="YPG" away={String(game.awayYPG)} home={String(game.homeYPG)} />
            )}
            {game.awayYAPG !== null && game.homeYAPG !== null && (
              <StatRow label="Yds Allowed/G" away={String(game.awayYAPG)} home={String(game.homeYAPG)} />
            )}
            {game.awayPassYPG !== null && game.homePassYPG !== null && (
              <StatRow label="Pass YPG" away={String(game.awayPassYPG)} home={String(game.homePassYPG)} />
            )}
            {game.awayRushYPG !== null && game.homeRushYPG !== null && (
              <StatRow label="Rush YPG" away={String(game.awayRushYPG)} home={String(game.homeRushYPG)} />
            )}
            {game.awayThirdDownPct !== null && game.homeThirdDownPct !== null && (
              <StatRow label="3rd Down %" away={`${game.awayThirdDownPct}%`} home={`${game.homeThirdDownPct}%`} />
            )}
            {game.awayRedZonePct !== null && game.homeRedZonePct !== null && (
              <StatRow label="Red Zone %" away={`${game.awayRedZonePct}%`} home={`${game.homeRedZonePct}%`} />
            )}
            {game.awaySacksPG !== null && game.homeSacksPG !== null && (
              <StatRow label="Sacks/G" away={game.awaySacksPG.toFixed(1)} home={game.homeSacksPG.toFixed(1)} />
            )}
            {game.awayTurnoversPG !== null && game.homeTurnoversPG !== null && (
              <StatRow label="Turnovers/G" away={game.awayTurnoversPG.toFixed(1)} home={game.homeTurnoversPG.toFixed(1)} />
            )}
            <WinProbBar
              favoriteTeam={game.favoriteTeam}
              prob={game.winningTeamWinProb}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
            />
          </View>
        )}

        {/* ── Post-game box score ── */}
        {isFinal && (game.homeBoxScore !== null || game.awayBoxScore !== null) && (
          <View className="mx-4 mb-4 bg-surface rounded-xl px-4 py-4">
            <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">Box Score</Text>
            <View className="flex-row mb-3">
              <Text className="text-muted text-xs font-semibold uppercase flex-1">Stat</Text>
              <Text className="text-muted text-xs font-semibold text-right" style={{ width: 64 }}>{game.awayTeam.split(' ').pop()}</Text>
              <Text className="text-muted text-xs font-semibold text-right" style={{ width: 64 }}>{game.homeTeam.split(' ').pop()}</Text>
            </View>
            <StatRow
              label="Total Yards"
              away={String(game.awayBoxScore?.totalYards ?? '—')}
              home={String(game.homeBoxScore?.totalYards ?? '—')}
            />
            <StatRow
              label="Pass Yards"
              away={String(game.awayBoxScore?.passYards ?? '—')}
              home={String(game.homeBoxScore?.passYards ?? '—')}
            />
            <StatRow
              label="Rush Yards"
              away={String(game.awayBoxScore?.rushYards ?? '—')}
              home={String(game.homeBoxScore?.rushYards ?? '—')}
            />
            {(game.awayBoxScore?.thirdDownRaw || game.homeBoxScore?.thirdDownRaw) && (
              <StatRow
                label="3rd Down"
                away={formatRatio(game.awayBoxScore?.thirdDownRaw)}
                home={formatRatio(game.homeBoxScore?.thirdDownRaw)}
              />
            )}
            {(game.awayBoxScore?.redZoneRaw || game.homeBoxScore?.redZoneRaw) && (
              <StatRow
                label="Red Zone"
                away={formatRatio(game.awayBoxScore?.redZoneRaw)}
                home={formatRatio(game.homeBoxScore?.redZoneRaw)}
              />
            )}
            {(game.awayBoxScore?.sacks !== null || game.homeBoxScore?.sacks !== null) && (
              <StatRow
                label="Sacks"
                away={String(game.awayBoxScore?.sacks ?? '—')}
                home={String(game.homeBoxScore?.sacks ?? '—')}
              />
            )}
            {(game.awayBoxScore?.turnovers !== null || game.homeBoxScore?.turnovers !== null) && (
              <StatRow
                label="Turnovers"
                away={String(game.awayBoxScore?.turnovers ?? '—')}
                home={String(game.homeBoxScore?.turnovers ?? '—')}
              />
            )}
            {(game.awayBoxScore?.firstDowns !== null || game.homeBoxScore?.firstDowns !== null) && (
              <StatRow
                label="1st Downs"
                away={String(game.awayBoxScore?.firstDowns ?? '—')}
                home={String(game.homeBoxScore?.firstDowns ?? '—')}
              />
            )}
          </View>
        )}

        {/* ── Recent games (pre-game only) ── */}
        {isPre && (game.awayTeamRecentGames?.length > 0 || game.homeTeamRecentGames?.length > 0) && (
          <View className="mx-4 mb-4 flex-row gap-3">
            {[{ label: game.awayTeam, games: game.awayTeamRecentGames }, { label: game.homeTeam, games: game.homeTeamRecentGames }].map(({ label, games: rg }) =>
              rg?.length > 0 ? (
                <View key={label} className="flex-1">
                  <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-2" numberOfLines={1}>
                    {label.split(' ').slice(-1)[0]} Last {rg.length}
                  </Text>
                  <View className="bg-surface rounded-xl overflow-hidden">
                    {rg.map(g => <RecentGameRow key={g.gameId} g={g} />)}
                  </View>
                </View>
              ) : null
            )}
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
