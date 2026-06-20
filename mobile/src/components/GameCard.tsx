import { View, Text, TouchableOpacity, Pressable, Image } from 'react-native';
import type { Game } from '../hooks/usePicksData';

type Props = {
  game: Game;
  isLocked: boolean;
  onPick: (pick: 'home' | 'away') => void;
  onPress?: () => void;
  onTeamPress?: (teamName: string) => void;
};

function formatPeriodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  if (period === 5) return 'OT';
  return `${period - 4}OT`;
}

function formatGameTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function TeamRow({
  team,
  logo,
  record,
  score,
  ppg,
  ppgAllowed,
  ypg,
  isPicked,
  isWinner,
  isFinal,
  isLive,
  pickPct,
  showPct,
  pickOutcome,
  otherTeamPicked,
  onPress,
  onTeamPress,
  disabled,
}: {
  team: string;
  logo: string | null;
  record: string | null;
  score: number | null;
  ppg: number | null;
  ppgAllowed: number | null;
  ypg: number | null;
  isPicked: boolean;
  isWinner: boolean;
  isFinal: boolean;
  isLive: boolean;
  pickPct: number;
  showPct: boolean;
  pickOutcome: 'correct' | 'wrong' | 'pending' | null;
  otherTeamPicked: boolean;
  onPress: () => void;
  onTeamPress?: () => void;
  disabled: boolean;
}) {
  const showScore = isFinal || isLive;
  const winnerBg = isFinal && isWinner;

  const rowBgColor = winnerBg
    ? 'rgba(34,197,94,0.25)'
    : pickOutcome === 'wrong'
    ? 'rgba(239,68,68,0.12)'
    : pickOutcome === 'pending'
    ? 'rgba(59,130,246,0.20)'
    : otherTeamPicked && !isFinal
    ? 'rgba(0,0,0,0.18)'
    : undefined;

  const outcomeBadgeStyle = pickOutcome === 'correct' ? 'bg-success' : 'bg-danger';
  const outcomeBadgeLabel = pickOutcome === 'correct' ? '✓ CORRECT' : '✗ WRONG';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-3"
      style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
    >
      {/* Logo */}
      <View className="w-10 h-10 mr-3 items-center justify-center">
        {logo ? (
          <Image source={{ uri: logo }} style={{ width: 40, height: 40 }} resizeMode="contain" />
        ) : (
          <View className="w-10 h-10 rounded-full bg-surface items-center justify-center">
            <Text className="text-white text-xs font-bold">{team.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Team info */}
      <View className="flex-1">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={onTeamPress} activeOpacity={onTeamPress ? 0.6 : 1} disabled={!onTeamPress}>
            <Text className={`font-semibold text-base ${winnerBg ? 'text-green-400' : 'text-white'}`} numberOfLines={1}>
              {team}
            </Text>
          </TouchableOpacity>
          {/* Always reserve space for checkmark to prevent layout shift */}
          {(pickOutcome === 'correct' || pickOutcome === 'wrong') ? (
            <View className={`ml-2 rounded px-1.5 py-0.5 ${outcomeBadgeStyle}`}>
              <Text className="text-white text-xs font-bold">{outcomeBadgeLabel}</Text>
            </View>
          ) : (
            <Text
              className="ml-2 text-sm font-bold"
              style={{ color: isPicked ? 'white' : 'transparent' }}
            >✓</Text>
          )}
        </View>
        {!showScore && (
          <>
            <Text className="text-muted text-xs mt-0.5" style={{ opacity: record ? 1 : 0 }}>
              {record ?? ' '}
            </Text>
            <Text className="text-muted text-xs" style={{ opacity: ppg !== null ? 1 : 0 }}>
              {ppg !== null ? `${ppg.toFixed(1)} PPG · ${ppgAllowed?.toFixed(1) ?? '—'} PPGA` : ' '}
            </Text>
            <Text className="text-muted text-xs" style={{ opacity: ypg !== null ? 1 : 0 }}>
              {ypg !== null ? `${ypg} YPG` : ' '}
            </Text>
          </>
        )}
        {/* Pick % bar */}
        {showPct && (
          <View className="mt-1.5 h-1.5 bg-surface rounded-full overflow-hidden" style={{ width: '100%' }}>
            <View className="h-full bg-primary rounded-full" style={{ width: `${pickPct}%` }} />
          </View>
        )}
        {showPct && (
          <Text className="text-muted text-xs mt-0.5">{pickPct}% picked</Text>
        )}
      </View>

      {/* Score or win prob */}
      {showScore ? (
        <Text className={`text-2xl font-bold ml-2 ${winnerBg ? 'text-green-400' : 'text-white'}`}>
          {score ?? 0}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export function GameCard({ game, isLocked, onPick, onPress, onTeamPress }: Props) {
  const isFinal = game.status === 'post';
  const isLive = game.status === 'in';
  const isPre = game.status === 'pre';

  // Determine winner for final games
  const homeWins = isFinal && game.homeScore !== null && game.awayScore !== null && game.homeScore > game.awayScore;
  const awayWins = isFinal && game.homeScore !== null && game.awayScore !== null && game.awayScore > game.homeScore;

  const homePicked = game.myPick === 'home';
  const awayPicked = game.myPick === 'away';

  // Pick outcome for badge + border color
  const homePickOutcome: 'correct' | 'wrong' | 'pending' | null = homePicked
    ? isFinal ? (homeWins ? 'correct' : 'wrong') : 'pending'
    : null;
  const awayPickOutcome: 'correct' | 'wrong' | 'pending' | null = awayPicked
    ? isFinal ? (awayWins ? 'correct' : 'wrong') : 'pending'
    : null;

  // Show percentages whenever the server returns them (server only does so after lock)
  const showPct = game.homePickPct !== null;
  const homePct = game.homePickPct ?? 50;
  const awayPct = game.awayPickPct ?? 50;

  const canPick = !isLocked && game.isPicksOpen && (isPre || isLive);

  const hasPick = game.myPick !== null;
  const pickedOutcome = homePickOutcome ?? awayPickOutcome;
  const borderColor = !hasPick
    ? '#2a2a2a'
    : pickedOutcome === 'correct'
    ? '#22c55e'
    : pickedOutcome === 'wrong'
    ? '#ef4444'
    : '#3b82f6';

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface rounded-2xl mx-4 mb-4 overflow-hidden"
      style={{ borderWidth: 2, borderColor }}
    >
      {/* Live / Final badge */}
      {(isLive || isFinal) && (
        <View className={`px-3 py-1 ${isLive ? 'bg-red-600' : 'bg-zinc-700'}`}>
          <Text className="text-white text-xs font-bold text-center">
            {isLive
            ? game.statusType === 'STATUS_HALFTIME'
              ? 'HALFTIME'
              : `${game.displayClock ?? '0:00'} · ${game.period ? formatPeriodLabel(game.period) : '—'}`
            : 'FINAL'}
          </Text>
        </View>
      )}

      {/* Away team (top) */}
      <TeamRow
        team={game.awayTeam}
        logo={game.awayTeamLogo}
        record={game.awayTeamRecord}
        score={game.awayScore}
        ppg={game.awayPPG}
        ppgAllowed={game.awayPPGA}
        ypg={game.awayYPG}
        isPicked={awayPicked}
        isWinner={awayWins}
        isFinal={isFinal}
        isLive={isLive}
        pickPct={awayPct}
        showPct={showPct}
        pickOutcome={awayPickOutcome}
        otherTeamPicked={homePicked}
        onPress={() => onPick('away')}
        onTeamPress={onTeamPress ? () => onTeamPress(game.awayTeam) : undefined}
        disabled={!canPick}
      />

      {/* Divider with game info */}
      <View className="flex-row items-center px-4 py-1.5 border-t border-b border-border">
        <View className="flex-1" />
        <Text className="text-muted text-xs text-center flex-1">
          {isPre ? formatGameTime(game.gameTime) : isLive ? 'LIVE' : 'Final'}
        </Text>
        <View className="flex-1 items-end flex-row justify-end gap-2">
          {isPre && game.winningTeamWinProb && game.favoriteTeam && (
            <Text className="text-muted text-xs">
              {Math.round(Number(game.winningTeamWinProb))}% fav
            </Text>
          )}
          {onPress && <Text className="text-muted text-xs">›</Text>}
        </View>
      </View>

      {/* Home team (bottom) */}
      <TeamRow
        team={game.homeTeam}
        logo={game.homeTeamLogo}
        record={game.homeTeamRecord}
        score={game.homeScore}
        ppg={game.homePPG}
        ppgAllowed={game.homePPGA}
        ypg={game.homeYPG}
        isPicked={homePicked}
        isWinner={homeWins}
        isFinal={isFinal}
        isLive={isLive}
        pickPct={homePct}
        showPct={showPct}
        pickOutcome={homePickOutcome}
        otherTeamPicked={awayPicked}
        onPress={() => onPick('home')}
        onTeamPress={onTeamPress ? () => onTeamPress(game.homeTeam) : undefined}
        disabled={!canPick}
      />

      {/* Locked message if no pick yet — only for weeks that were open */}
      {isLocked && !hasPick && isPre && game.isPicksOpen && (
        <View className="px-4 py-2 bg-zinc-800/60">
          <Text className="text-muted text-xs text-center">Picks locked — you didn't submit</Text>
        </View>
      )}
    </Pressable>
  );
}
