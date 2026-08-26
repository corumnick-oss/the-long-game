import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Switch, Alert, TextInput, KeyboardAvoidingView, Platform, Modal, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getCurrentNFLSeason, getCurrentNFLWeek } from '@/lib/nflSeason';
import { formatPacific, formatPacificDateOnly } from '@/lib/pacificTime';
import { useGames } from '@/hooks/usePicksData';
import {
  useAdminUsers, useUpdateUser,
  useSyncGames, useSyncScores, useSyncProbs, useSyncFullSeason,
  useSyncGamesForFutureSeason, useSyncFullSeasonForFutureSeason,
  useAwardTrophies, useUnlockWeek,
  useCorrectScore, useExportData, useCreateWeekPicksExportLink,
  useSendTestNotification, useSendTestEmail, useScheduleTestNotification, useCancelScheduledTest, useTokenStatus,
  useSyncTeamStats, useBroadcastNotification, useFeedbackList, type FeedbackItem,
  useSeasonStandingsPreview, useAwardSeasonTrophies,
  usePickAuditLog, type PickAuditLogEntry,
} from '@/hooks/useAdminData';
import type { Game } from '@/hooks/usePicksData';

type Tab = 'users' | 'tools' | 'data' | 'feedback' | 'activity';

// ── Shared ────────────────────────────────────────────────────────────────────

function ActionBtn({
  label, onPress, loading, result,
}: {
  label: string; onPress: () => void; loading: boolean; result?: string;
}) {
  const isSuccess = result?.startsWith('✓');
  const isError = result?.startsWith('✗');
  return (
    <View className="mb-4">
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
        className={`bg-surface rounded-xl px-4 py-3.5 flex-row items-center justify-between ${loading ? 'opacity-60' : ''}`}
      >
        <Text className="text-white font-medium">{label}</Text>
        {loading
          ? <ActivityIndicator size="small" color="#3b82f6" />
          : <Text className="text-muted text-xl leading-6">›</Text>
        }
      </TouchableOpacity>
      {result ? (
        <Text className={`text-xs mt-1.5 ml-1 ${isSuccess ? 'text-success' : isError ? 'text-danger' : 'text-muted'}`}>
          {result}
        </Text>
      ) : null}
    </View>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────────

function UsersTab({ season }: { season: number }) {
  const { data: users = [], isLoading, isError } = useAdminUsers();
  const { mutate: updateUser, isPending } = useUpdateUser();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (isLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3b82f6" /></View>;
  }
  if (isError) {
    return <View className="flex-1 items-center justify-center px-8"><Text className="text-muted text-sm text-center">Failed to load users</Text></View>;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      {users.map(u => (
        <View key={u.id} className="mx-4 mb-3 bg-surface rounded-xl px-4 py-3">
          {/* Name row */}
          <View className="flex-row items-center mb-1">
            {editingId === u.id ? (
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                className="flex-1 text-white font-semibold text-base bg-surface-2 rounded-lg px-3 mr-2"
                style={{ height: 36 }}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (editValue.trim()) updateUser({ id: u.id, teamName: editValue.trim() });
                  setEditingId(null);
                }}
              />
            ) : (
              <Text className="flex-1 text-white font-semibold text-base">{u.teamName}</Text>
            )}
            <View className="flex-row gap-1.5 items-center">
              {u.isAdmin && <View className="bg-orange-600/30 rounded px-1.5 py-0.5"><Text className="text-orange-400 text-xs font-bold">ADMIN</Text></View>}
              {u.isGridiron && <View className="bg-primary/20 rounded px-1.5 py-0.5"><Text className="text-primary text-xs font-bold">GRIDIRON</Text></View>}
              {editingId === u.id ? (
                <TouchableOpacity
                  onPress={() => {
                    if (editValue.trim()) updateUser({ id: u.id, teamName: editValue.trim() });
                    setEditingId(null);
                  }}
                  className="bg-success/20 rounded px-2 py-0.5"
                >
                  <Text className="text-success text-xs font-bold">Save</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => { setEditingId(u.id); setEditValue(u.teamName); }}
                  className="p-1"
                >
                  <Text className="text-muted text-xs">✏️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text className="text-muted text-xs mb-3">{u.email}</Text>

          {/* Gridiron toggle */}
          <View className="flex-row items-center justify-between border-t border-border pt-2">
            <Text className="text-muted text-sm">Gridiron</Text>
            <Switch
              value={u.isGridiron}
              onValueChange={val => updateUser({ id: u.id, isGridiron: val })}
              disabled={isPending}
              trackColor={{ false: '#374151', true: '#1d4ed8' }}
              thumbColor={u.isGridiron ? '#3b82f6' : '#9ca3af'}
            />
          </View>
        </View>
      ))}
      <View className="h-8" />
    </ScrollView>
  );
}

// ── Score Editor ───────────────────────────────────────────────────────────────

function ScoreEditor({
  game,
  onDone,
}: {
  game: Game;
  onDone: () => void;
}) {
  const [homeScore, setHomeScore] = useState(String(game.homeScore ?? ''));
  const [awayScore, setAwayScore] = useState(String(game.awayScore ?? ''));
  const [status, setStatus] = useState<'pre' | 'in' | 'post'>(game.status);
  const { mutate: correctScore, isPending } = useCorrectScore();

  const save = () => {
    const home = parseInt(homeScore, 10);
    const away = parseInt(awayScore, 10);
    if (isNaN(home) || isNaN(away)) {
      Alert.alert('Invalid scores', 'Enter valid numbers for both scores.');
      return;
    }
    correctScore({ id: game.id, homeScore: home, awayScore: away, status }, {
      onSuccess: () => onDone(),
      onError: () => Alert.alert('Error', 'Failed to update score.'),
    });
  };

  const statusOptions: { value: 'pre' | 'in' | 'post'; label: string }[] = [
    { value: 'pre', label: 'Pre-game' },
    { value: 'in', label: 'Live' },
    { value: 'post', label: 'Final' },
  ];

  return (
    <View className="mx-4 mb-4 bg-surface rounded-xl p-4">
      <Text className="text-white font-semibold mb-3">
        {game.awayTeam.split(' ').pop()} @ {game.homeTeam.split(' ').pop()}
      </Text>

      <View className="flex-row gap-3 mb-3">
        <View className="flex-1">
          <Text className="text-muted text-xs mb-1">Away score</Text>
          <TextInput
            value={awayScore}
            onChangeText={setAwayScore}
            keyboardType="number-pad"
            className="bg-surface-2 text-white rounded-lg px-3 text-center"
            style={{ height: 44 }}
            placeholder="0"
            placeholderTextColor="#6b7280"
          />
        </View>
        <View className="flex-1">
          <Text className="text-muted text-xs mb-1">Home score</Text>
          <TextInput
            value={homeScore}
            onChangeText={setHomeScore}
            keyboardType="number-pad"
            className="bg-surface-2 text-white rounded-lg px-3 text-center"
            style={{ height: 44 }}
            placeholder="0"
            placeholderTextColor="#6b7280"
          />
        </View>
      </View>

      <Text className="text-muted text-xs mb-1">Status</Text>
      <View className="flex-row gap-2 mb-4">
        {statusOptions.map(opt => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setStatus(opt.value)}
            className={`flex-1 py-2 rounded-lg items-center ${status === opt.value ? 'bg-primary' : 'bg-surface-2'}`}
          >
            <Text className={`text-xs font-semibold ${status === opt.value ? 'text-white' : 'text-muted'}`}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="flex-row gap-2">
        <TouchableOpacity onPress={onDone} className="flex-1 bg-surface-2 py-2.5 rounded-lg items-center">
          <Text className="text-muted text-sm font-semibold">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={save}
          disabled={isPending}
          className={`flex-1 bg-primary py-2.5 rounded-lg items-center ${isPending ? 'opacity-60' : ''}`}
        >
          {isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text className="text-white text-sm font-semibold">Save Score</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── NFL Tools Tab ──────────────────────────────────────────────────────────────

function ToolsTab({ season }: { season: number }) {
  const currentSeason = getCurrentNFLSeason();
  const [week, setWeek] = useState(() => season > currentSeason ? 1 : getCurrentNFLWeek());
  const [results, setResults] = useState<Record<string, string>>({});
  const setResult = (key: string, msg: string) => setResults(r => ({ ...r, [key]: msg }));
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const [seasonType, setSeasonType] = useState<'regular' | 'preseason'>('regular');
  const maxWeek = seasonType === 'preseason' ? 4 : 22;

  const isFutureSeason = season > currentSeason;
  const syncGames = useSyncGames();
  const syncGamesFuture = useSyncGamesForFutureSeason();
  const syncScores = useSyncScores();
  const syncProbs = useSyncProbs();
  const syncFullSeason = useSyncFullSeason();
  const syncFullSeasonFuture = useSyncFullSeasonForFutureSeason();
  const activeSyncGames = isFutureSeason ? syncGamesFuture : syncGames;
  const activeFullSync = isFutureSeason ? syncFullSeasonFuture : syncFullSeason;
  const syncTeamStats = useSyncTeamStats();
  const awardTrophies = useAwardTrophies();
  const standingsPreview = useSeasonStandingsPreview();
  const awardSeasonTrophies = useAwardSeasonTrophies();
  const unlockWeek = useUnlockWeek();
  const sendTest = useSendTestNotification();
  const sendTestEmail = useSendTestEmail();
  const scheduleTest = useScheduleTestNotification();
  const cancelScheduled = useCancelScheduledTest();
  const tokenStatus = useTokenStatus();
  const broadcast = useBroadcastNotification();
  const [scheduleMinutes, setScheduleMinutes] = useState<number>(5);
  const [scheduledFireAt, setScheduledFireAt] = useState<string | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastGridironsOnly, setBroadcastGridironsOnly] = useState(false);

  const { data: games = [] } = useGames(week, season);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
        {/* Season type toggle */}
        <View className="flex-row bg-surface rounded-xl p-1 my-4">
          {(['regular', 'preseason'] as const).map(st => (
            <TouchableOpacity
              key={st}
              onPress={() => { setSeasonType(st); setWeek(1); setSelectedGame(null); }}
              className={`flex-1 py-2 rounded-lg items-center ${seasonType === st ? 'bg-primary' : ''}`}
            >
              <Text className={`text-sm font-semibold ${seasonType === st ? 'text-white' : 'text-muted'}`}>
                {st === 'regular' ? 'Regular Season' : 'Preseason'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Week picker */}
        <View className="mb-5 flex-row items-center justify-center" style={{ gap: 24 }}>
          <TouchableOpacity
            onPress={() => { setWeek(w => Math.max(1, w - 1)); setSelectedGame(null); }}
            className="w-11 h-11 bg-surface rounded-full items-center justify-center"
          >
            <Text className="text-white text-2xl leading-7">−</Text>
          </TouchableOpacity>
          <View className="items-center" style={{ minWidth: 120 }}>
            <Text className="text-white text-2xl font-bold">
              {seasonType === 'preseason' ? `Pre ${week}` : `Week ${week}`}
            </Text>
            <Text className="text-muted text-xs mt-0.5">{season} Season</Text>
          </View>
          <TouchableOpacity
            onPress={() => { setWeek(w => Math.min(maxWeek, w + 1)); setSelectedGame(null); }}
            className="w-11 h-11 bg-surface rounded-full items-center justify-center"
          >
            <Text className="text-white text-2xl leading-7">+</Text>
          </TouchableOpacity>
        </View>

        {/* Sync buttons */}
        <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">Sync</Text>

        <ActionBtn
          label={`Sync Full ${seasonType === 'preseason' ? 'Preseason' : 'Regular Season'} (All Weeks)`}
          loading={activeFullSync.isPending}
          result={results['fullsync']}
          onPress={() =>
            Alert.alert(
              'Sync Full Season',
              `Sync all ${seasonType === 'preseason' ? '4 preseason' : '18 regular season'} weeks for ${season}? This may take a minute.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sync All',
                  onPress: () =>
                    activeFullSync.mutate({ season, seasonType }, {
                      onSuccess: (r) => setResult('fullsync', `✓ Synced ${r.total} games across all weeks`),
                      onError: (e: any) => setResult('fullsync', `✗ ${e?.message ?? 'Full sync failed'}`),
                    }),
                },
              ],
            )
          }
        />
        <ActionBtn
          label={`Sync ${seasonType === 'preseason' ? `Pre ${week}` : `Week ${week}`} from ESPN`}
          loading={activeSyncGames.isPending}
          result={results['sync']}
          onPress={() =>
            activeSyncGames.mutate({ week, season, seasonType }, {
              onSuccess: (r) => setResult('sync', `✓ Synced ${r.synced} games`),
              onError: (e: any) => setResult('sync', `✗ ${e?.message ?? 'Sync failed'}`),
            })
          }
        />
        <ActionBtn
          label="Sync Scores Only"
          loading={syncScores.isPending}
          result={results['scores']}
          onPress={() =>
            syncScores.mutate({ week, season, seasonType }, {
              onSuccess: (r) => setResult('scores', `✓ Updated scores for ${r.updated} games`),
              onError: () => setResult('scores', '✗ Score sync failed'),
            })
          }
        />
        <ActionBtn
          label="Sync Win Probabilities"
          loading={syncProbs.isPending}
          result={results['probs']}
          onPress={() =>
            syncProbs.mutate({ week, season }, {
              onSuccess: () => setResult('probs', `✓ Win probs updated`),
              onError: () => setResult('probs', '✗ Sync failed'),
            })
          }
        />
        <ActionBtn
          label={`Sync Team Stats (${season} ${seasonType === 'preseason' ? 'Preseason' : 'Regular'})`}
          loading={syncTeamStats.isPending}
          result={results['teamstats']}
          onPress={() =>
            Alert.alert(
              'Sync Team Stats',
              `Backfill box score stats for all completed ${season} ${seasonType} games? This may take a minute.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sync',
                  onPress: () =>
                    syncTeamStats.mutate({ season, seasonType }, {
                      onSuccess: (r) => setResult('teamstats', `✓ Synced stats for ${r.synced} games`),
                      onError: (e: any) => setResult('teamstats', `✗ ${e?.message ?? 'Sync failed'}`),
                    }),
                },
              ],
            )
          }
        />

        {/* Actions */}
        <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3 mt-2">Actions</Text>

        <ActionBtn
          label="Award Achievements"
          loading={awardTrophies.isPending}
          result={results['trophies']}
          onPress={() =>
            Alert.alert('Award Achievements', `Award weekly achievements for Week ${week}?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Award',
                onPress: () =>
                  awardTrophies.mutate({ week, season }, {
                    onSuccess: (r) => setResult('trophies', `✓ Awarded ${r.awarded?.length ?? 0} achievements for Week ${week}`),
                    onError: () => setResult('trophies', '✗ Failed'),
                  }),
              },
            ])
          }
        />
        <ActionBtn
          label={`Award ${season} Season Trophies`}
          loading={standingsPreview.isPending || awardSeasonTrophies.isPending}
          result={results['season_trophies']}
          onPress={async () => {
            try {
              const { standings } = await standingsPreview.mutateAsync(season);
              if (standings.length === 0) {
                Alert.alert('No Standings', `No completed picks found for the ${season} regular season.`);
                return;
              }
              const last = standings[standings.length - 1]!;
              const placementLines = standings
                .filter(s => s.rank <= 3 || (s.rank > 3 && s.wins === last.wins && s.losses === last.losses))
                .map(s => {
                  const label = s.rank === 1 ? '🥇 Champion' : s.rank === 2 ? '🥈 Runner-up' : s.rank === 3 ? '🥉 Third Place' : '🥄 Last Place';
                  return `${label}: ${s.teamName} (${s.wins}-${s.losses})`;
                })
                .join('\n');

              Alert.alert(
                `Award ${season} Season Trophies`,
                `${placementLines}\n\nAlready-awarded placements are skipped.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Award',
                    onPress: () =>
                      awardSeasonTrophies.mutate(season, {
                        onSuccess: (r) => setResult('season_trophies', `✓ Awarded ${r.awarded.length} season trophies for ${season}`),
                        onError: () => setResult('season_trophies', '✗ Failed'),
                      }),
                  },
                ],
              );
            } catch (e: any) {
              setResult('season_trophies', `✗ ${e?.message ?? 'Failed to load standings'}`);
            }
          }}
        />
        <ActionBtn
          label="Unlock Week"
          loading={unlockWeek.isPending}
          result={results['unlock']}
          onPress={() =>
            Alert.alert('Unlock Week', `Unlock Week ${week} ${seasonType === 'preseason' ? 'preseason' : 'regular season'} picks?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Unlock',
                onPress: () =>
                  unlockWeek.mutate({ week, season, seasonType }, {
                    onSuccess: () => setResult('unlock', `✓ Week ${week} ${seasonType} picks unlocked`),
                    onError: () => setResult('unlock', '✗ Failed'),
                  }),
              },
            ])
          }
        />

        {/* Notifications */}
        <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3 mt-2">Notifications</Text>

        <View className="bg-surface rounded-xl px-4 py-3 mb-3 flex-row items-center justify-between">
          <Text className="text-muted text-xs">Push token registered</Text>
          {tokenStatus.isLoading ? (
            <ActivityIndicator size="small" color="#888" />
          ) : (
            <Text className={`text-xs font-bold ${tokenStatus.data?.hasToken ? 'text-success' : 'text-danger'}`}>
              {tokenStatus.data?.hasToken ? '✓ Yes' : '✗ No — open app on device first'}
            </Text>
          )}
        </View>

        <ActionBtn
          label="Send Test Notification Now"
          loading={sendTest.isPending}
          result={results['notif_test']}
          onPress={() =>
            sendTest.mutate(undefined, {
              onSuccess: (r: any) => {
                const ticket = r?.tickets?.[0];
                if (ticket?.status === 'error') {
                  setResult('notif_test', `✗ Expo error: ${ticket.message}`);
                } else {
                  setResult('notif_test', '✓ Sent — check your device');
                }
              },
              onError: (err: any) => setResult('notif_test', `✗ ${err?.message ?? 'Send failed'}`),
            })
          }
        />

        <ActionBtn
          label="Send Test Picks Email (to yourself)"
          loading={sendTestEmail.isPending}
          result={results['email_test']}
          onPress={() =>
            sendTestEmail.mutate(undefined, {
              onSuccess: (r) => setResult('email_test', `✓ Sent — check your inbox (${r.seasonType} week ${r.week})`),
              onError: (err: any) => setResult('email_test', `✗ ${err?.message ?? 'Send failed'}`),
            })
          }
        />

        <View className="mb-4">
          <View className="bg-surface rounded-xl px-4 py-3.5">
            <Text className="text-white font-medium mb-1">Schedule Deadline Reminder Test</Text>
            <Text className="text-muted text-xs mb-3">Fires the "1 hour left for picks" message after a delay.</Text>
            <View className="flex-row gap-2 mb-3">
              {[1, 5, 10, 30].map(min => (
                <TouchableOpacity
                  key={min}
                  onPress={() => setScheduleMinutes(min)}
                  activeOpacity={0.7}
                  className={`flex-1 py-2 rounded-lg items-center ${scheduleMinutes === min ? 'bg-primary' : 'bg-surface-2'}`}
                >
                  <Text className={`text-xs font-semibold ${scheduleMinutes === min ? 'text-white' : 'text-muted'}`}>
                    {min}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {scheduledFireAt ? (
              <View className="flex-row gap-2">
                <View className="flex-1 bg-success/10 rounded-lg py-2.5 items-center">
                  <Text className="text-success text-xs font-semibold">
                    Fires at {new Date(scheduledFireAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    cancelScheduled.mutate(undefined, {
                      onSuccess: () => { setScheduledFireAt(null); setResult('notif_schedule', '✓ Cancelled'); },
                    })
                  }
                  className="bg-danger/20 rounded-lg px-4 py-2.5 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-danger text-xs font-semibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() =>
                  scheduleTest.mutate({ delayMinutes: scheduleMinutes }, {
                    onSuccess: (r) => { setScheduledFireAt(r.fireAt); setResult('notif_schedule', ''); },
                    onError: () => setResult('notif_schedule', '✗ Schedule failed'),
                  })
                }
                disabled={scheduleTest.isPending}
                activeOpacity={0.7}
                className={`bg-primary rounded-lg py-2.5 items-center ${scheduleTest.isPending ? 'opacity-60' : ''}`}
              >
                <Text className="text-white text-sm font-semibold">
                  Schedule in {scheduleMinutes}m
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {results['notif_schedule'] ? (
            <Text className="text-xs mt-1.5 ml-1 text-muted">{results['notif_schedule']}</Text>
          ) : null}
        </View>

        {/* Broadcast notification */}
        <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3 mt-2">Broadcast Notification</Text>

        <View className="bg-surface rounded-xl px-4 py-3.5 mb-4">
          <TextInput
            placeholder="Title"
            placeholderTextColor="#4b5563"
            value={broadcastTitle}
            onChangeText={setBroadcastTitle}
            returnKeyType="next"
            className="bg-surface-2 text-white rounded-lg px-3 mb-2"
            style={{ height: 44 }}
          />
          <TextInput
            placeholder="Message body"
            placeholderTextColor="#4b5563"
            value={broadcastBody}
            onChangeText={setBroadcastBody}
            multiline
            className="bg-surface-2 text-white rounded-lg px-3"
            style={{ height: 80, paddingTop: 10, textAlignVertical: 'top' }}
          />

          {/* Audience toggle */}
          <View className="flex-row bg-surface-2 rounded-xl p-1 mt-3 mb-3">
            {[false, true].map(gridiron => (
              <TouchableOpacity
                key={String(gridiron)}
                onPress={() => setBroadcastGridironsOnly(gridiron)}
                className={`flex-1 py-2 rounded-lg items-center ${broadcastGridironsOnly === gridiron ? 'bg-primary' : ''}`}
                activeOpacity={0.7}
              >
                <Text className={`text-sm font-semibold ${broadcastGridironsOnly === gridiron ? 'text-white' : 'text-muted'}`}>
                  {gridiron ? 'Gridirons Only' : 'All Users'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => {
              if (!broadcastTitle.trim() || !broadcastBody.trim()) {
                Alert.alert('Missing fields', 'Title and message are required.');
                return;
              }
              const audience = broadcastGridironsOnly ? 'Gridirons only' : 'all users';
              Alert.alert(
                'Send Broadcast',
                `Send to ${audience}?\n\n"${broadcastTitle.trim()}"\n${broadcastBody.trim()}`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Send',
                    onPress: () =>
                      broadcast.mutate(
                        { title: broadcastTitle.trim(), body: broadcastBody.trim(), gridirons_only: broadcastGridironsOnly },
                        {
                          onSuccess: (r) => {
                            setResult('broadcast', `✓ Sent${r.sent != null ? ` to ${r.sent} users` : ''}`);
                            setBroadcastTitle('');
                            setBroadcastBody('');
                          },
                          onError: (e: any) => setResult('broadcast', `✗ ${e?.message ?? 'Send failed'}`),
                        },
                      ),
                  },
                ],
              );
            }}
            disabled={broadcast.isPending}
            activeOpacity={0.7}
            className={`bg-primary rounded-xl py-3 items-center ${broadcast.isPending ? 'opacity-60' : ''}`}
          >
            {broadcast.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text className="text-white font-semibold">Send Broadcast</Text>
            }
          </TouchableOpacity>

          {results['broadcast'] ? (
            <Text className={`text-xs mt-2 ${results['broadcast'].startsWith('✓') ? 'text-success' : 'text-danger'}`}>
              {results['broadcast']}
            </Text>
          ) : null}
        </View>

        {/* Score correction */}
        <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3 mt-2">Score Correction</Text>

        {selectedGame && (
          <ScoreEditor
            game={selectedGame}
            onDone={() => setSelectedGame(null)}
          />
        )}

        {games.length === 0 ? (
          <View className="bg-surface rounded-xl px-4 py-5 mb-4 items-center">
            <Text className="text-muted text-sm">No games loaded — tap Sync Games first</Text>
          </View>
        ) : (
          <View className="bg-surface rounded-xl overflow-hidden mb-4">
            {games.map((game, idx) => {
              const isSelected = selectedGame?.id === game.id;
              const scoreStr = game.status === 'pre'
                ? new Date(game.gameTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : `${game.awayScore ?? 0}–${game.homeScore ?? 0}`;
              const statusLabel = game.status === 'post' ? 'F' : game.status === 'in' ? 'LIVE' : '';
              return (
                <TouchableOpacity
                  key={game.id}
                  onPress={() => setSelectedGame(isSelected ? null : game)}
                  className={`flex-row items-center px-4 py-2.5 ${idx < games.length - 1 ? 'border-b border-border' : ''} ${isSelected ? 'bg-primary/10' : ''}`}
                  activeOpacity={0.7}
                >
                  <Text className="flex-1 text-white text-sm" numberOfLines={1}>
                    {game.awayTeam.split(' ').pop()} @ {game.homeTeam.split(' ').pop()}
                  </Text>
                  {statusLabel ? (
                    <Text className={`text-xs font-bold mr-2 ${game.status === 'in' ? 'text-danger' : 'text-muted'}`}>
                      {statusLabel}
                    </Text>
                  ) : null}
                  <Text className="text-muted text-sm">{scoreStr}</Text>
                  <Text className="text-primary text-sm ml-2">{isSelected ? '▲' : '✏️'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Data Tab ──────────────────────────────────────────────────────────────────

function DataTab({ season }: { season: number }) {
  const [seasonType, setSeasonType] = useState<'regular' | 'preseason'>('regular');
  const [week, setWeek] = useState(getCurrentNFLWeek());
  const maxWeek = seasonType === 'preseason' ? 4 : 22;
  const exportData = useExportData();
  const createExportLink = useCreateWeekPicksExportLink();
  const [seasonSummary, setSeasonSummary] = useState<string | undefined>();
  const [weekSummary, setWeekSummary] = useState<string | undefined>();

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4">
      <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-4">Season Export</Text>

      <ActionBtn
        label={`Export ${season} Season Data`}
        loading={exportData.isPending}
        result={seasonSummary}
        onPress={() =>
          exportData.mutate(season, {
            onSuccess: (r) =>
              setSeasonSummary(
                `✓ ${r.users.length} users · ${r.games.length} games · ${r.picks.length} picks · ${r.trophies.length} achievements`,
              ),
            onError: () => setSeasonSummary('✗ Export failed'),
          })
        }
      />

      <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-4 mt-2">Weekly Picks CSV (Gridirons only)</Text>

      {/* Season type toggle */}
      <View className="flex-row bg-surface rounded-xl p-1 mb-3">
        {(['regular', 'preseason'] as const).map(st => (
          <TouchableOpacity
            key={st}
            onPress={() => { setSeasonType(st); setWeek(1); }}
            className={`flex-1 py-2 rounded-lg items-center ${seasonType === st ? 'bg-primary' : ''}`}
          >
            <Text className={`text-sm font-semibold ${seasonType === st ? 'text-white' : 'text-muted'}`}>
              {st === 'regular' ? 'Regular Season' : 'Preseason'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Week picker for weekly export */}
      <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={() => setWeek(w => Math.max(1, w - 1))}
          className="w-9 h-9 bg-surface rounded-full items-center justify-center"
        >
          <Text className="text-white text-xl leading-6">−</Text>
        </TouchableOpacity>
        <Text className="text-white font-semibold" style={{ minWidth: 90, textAlign: 'center' }}>
          {seasonType === 'preseason' ? `Pre ${week}` : `Week ${week}`}
        </Text>
        <TouchableOpacity
          onPress={() => setWeek(w => Math.min(maxWeek, w + 1))}
          className="w-9 h-9 bg-surface rounded-full items-center justify-center"
        >
          <Text className="text-white text-xl leading-6">+</Text>
        </TouchableOpacity>
      </View>

      <ActionBtn
        label={`Download Week ${week} Picks CSV`}
        loading={createExportLink.isPending}
        result={weekSummary}
        onPress={() =>
          createExportLink.mutate({ week, season, seasonType }, {
            onSuccess: (url) => {
              setWeekSummary(undefined);
              Linking.openURL(url);
            },
            onError: (err: any) =>
              setWeekSummary(
                err?.message?.includes('not locked')
                  ? '✗ This week hasn\'t locked yet'
                  : '✗ Export failed',
              ),
          })
        }
      />

      <Text className="text-muted text-xs leading-5 mt-2">
        Opens a real CSV download in your browser (Gridirons only, once the week has locked) — save it, email it, or drop it anywhere you want a backup.
      </Text>

      <View className="h-8" />
    </ScrollView>
  );
}

// ── Feedback Tab ──────────────────────────────────────────────────────────────

function FeedbackDetailModal({ item, onClose }: { item: FeedbackItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <Modal visible={!!item} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center px-4 pt-14 pb-4 border-b border-border">
          <TouchableOpacity onPress={onClose} className="mr-3 py-1">
            <Text className="text-primary text-base font-semibold">‹ Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text className="text-white text-base font-bold" numberOfLines={1}>
              {item.metadata?.teamName ?? 'Unknown'}
            </Text>
            <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{item.metadata?.userEmail}</Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          <Text className="text-muted text-xs mt-5 mb-3">
            {formatPacific(new Date(item.createdAt), { weekday: 'long' })} PT
          </Text>
          {item.metadata?.subject ? (
            <Text className="text-primary text-lg font-bold mb-4">{item.metadata.subject}</Text>
          ) : null}
          <Text style={{ color: '#fff', fontSize: 18, lineHeight: 28 }}>{item.metadata?.message}</Text>
          <View className="h-12" />
        </ScrollView>
      </View>
    </Modal>
  );
}

function FeedbackTab() {
  const { data: items = [], isLoading } = useFeedbackList();
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  if (isLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3b82f6" /></View>;
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-muted text-sm text-center">No feedback yet</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4">
        {items.map((item: FeedbackItem) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setSelected(item)}
            activeOpacity={0.7}
            className="bg-surface rounded-xl px-4 py-3 mb-3"
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-white font-semibold">{item.metadata?.teamName ?? 'Unknown'}</Text>
              <Text className="text-muted text-xs">
                {formatPacificDateOnly(new Date(item.createdAt))}
              </Text>
            </View>
            {item.metadata?.subject ? (
              <Text className="text-primary text-sm font-semibold mb-1">{item.metadata.subject}</Text>
            ) : null}
            <Text className="text-muted text-sm" numberOfLines={2}>{item.metadata?.message}</Text>
            <Text className="text-primary text-xs mt-1.5">Tap to read →</Text>
          </TouchableOpacity>
        ))}
        <View className="h-8" />
      </ScrollView>
      <FeedbackDetailModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function actionLabel(e: PickAuditLogEntry): string {
  switch (e.action) {
    case 'create': return `Picked ${e.new_team}`;
    case 'update': return `Changed pick from ${e.previous_team} to ${e.new_team}`;
    case 'delete': return `Removed pick (was ${e.previous_team})`;
    case 'default_applied': return `Auto-assigned ${e.new_team} (missed deadline)`;
    case 'admin_edit': return `Admin (${e.admin_name ?? '?'}) changed pick to ${e.new_team}`;
    default: return e.action;
  }
}

function ActivityTab({ season }: { season: number }) {
  const [seasonType, setSeasonType] = useState<'regular' | 'preseason'>('regular');
  const [week, setWeek] = useState(getCurrentNFLWeek());
  const maxWeek = seasonType === 'preseason' ? 4 : 22;
  const { data: entries = [], isLoading } = usePickAuditLog({ season, seasonType, week });

  return (
    <View className="flex-1">
      {/* Season type toggle */}
      <View className="flex-row bg-surface rounded-xl p-1 mx-4 mt-4 mb-3">
        {(['regular', 'preseason'] as const).map(st => (
          <TouchableOpacity
            key={st}
            onPress={() => { setSeasonType(st); setWeek(1); }}
            className={`flex-1 py-2 rounded-lg items-center ${seasonType === st ? 'bg-primary' : ''}`}
          >
            <Text className={`text-sm font-semibold ${seasonType === st ? 'text-white' : 'text-muted'}`}>
              {st === 'regular' ? 'Regular Season' : 'Preseason'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Week picker */}
      <View className="mb-3 flex-row items-center justify-center" style={{ gap: 24 }}>
        <TouchableOpacity
          onPress={() => setWeek(w => Math.max(1, w - 1))}
          className="w-9 h-9 bg-surface rounded-full items-center justify-center"
        >
          <Text className="text-white text-xl leading-6">−</Text>
        </TouchableOpacity>
        <Text className="text-white font-semibold" style={{ minWidth: 90, textAlign: 'center' }}>
          {seasonType === 'preseason' ? `Pre ${week}` : `Week ${week}`}
        </Text>
        <TouchableOpacity
          onPress={() => setWeek(w => Math.min(maxWeek, w + 1))}
          className="w-9 h-9 bg-surface rounded-full items-center justify-center"
        >
          <Text className="text-white text-xl leading-6">+</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3b82f6" /></View>
      ) : entries.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted text-sm text-center">No pick activity for this week</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
          {entries.map(e => (
            <View key={e.id} className="bg-surface rounded-xl px-4 py-3 mb-2.5">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-white font-semibold text-sm">{e.player_name}</Text>
                <Text className="text-muted text-xs">
                  {formatPacific(new Date(e.created_at))} PT
                </Text>
              </View>
              <Text className="text-muted text-xs mb-1">{e.away_team} @ {e.home_team}</Text>
              <Text className={`text-sm ${e.action === 'admin_edit' ? 'text-primary' : e.action === 'default_applied' ? 'text-amber-400' : 'text-white'}`}>
                {actionLabel(e)}
              </Text>
            </View>
          ))}
          <View className="h-8" />
        </ScrollView>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'tools', label: 'NFL Tools' },
  { id: 'data', label: 'Data' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'activity', label: 'Activity' },
];

export default function AdminScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('users');

  // Season selector — defaults to current calendar year so admin can sync 2026 games
  const currentSeason = getCurrentNFLSeason();
  const maxSeason = new Date().getFullYear();
  const [adminSeason, setAdminSeason] = useState(maxSeason);
  const minSeason = 2025;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-4 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 py-1">
          <Text className="text-primary text-base font-semibold">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold flex-1">Admin Dashboard</Text>

        {/* Season selector */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setAdminSeason(s => Math.max(minSeason, s - 1))}
            disabled={adminSeason <= minSeason}
            className={`w-7 h-7 bg-surface rounded-full items-center justify-center ${adminSeason <= minSeason ? 'opacity-30' : ''}`}
          >
            <Text className="text-white text-base leading-5">‹</Text>
          </TouchableOpacity>
          <Text className="text-white text-sm font-semibold" style={{ minWidth: 36, textAlign: 'center' }}>
            {adminSeason}
          </Text>
          <TouchableOpacity
            onPress={() => setAdminSeason(s => Math.min(maxSeason, s + 1))}
            disabled={adminSeason >= maxSeason}
            className={`w-7 h-7 bg-surface rounded-full items-center justify-center ${adminSeason >= maxSeason ? 'opacity-30' : ''}`}
          >
            <Text className="text-white text-base leading-5">›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View className="flex-row border-b border-border">
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            className="flex-1 items-center py-3"
            style={{ borderBottomWidth: 2, borderBottomColor: tab === t.id ? '#3b82f6' : 'transparent' }}
          >
            <Text className={`text-sm font-semibold ${tab === t.id ? 'text-primary' : 'text-muted'}`}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View className="flex-1 pt-2">
        {tab === 'users' && <UsersTab season={adminSeason} />}
        {tab === 'tools' && <ToolsTab season={adminSeason} />}
        {tab === 'data' && <DataTab season={adminSeason} />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'activity' && <ActivityTab season={adminSeason} />}
      </View>
    </View>
  );
}
