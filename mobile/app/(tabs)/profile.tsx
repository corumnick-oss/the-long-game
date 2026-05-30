import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useMyProfile, useMyTrophies, type H2HEntry, type WeekRecord, type Trophy } from '@/hooks/useProfile';

// ── Trophy metadata ──────────────────────────────────────────────────────────

const TROPHY_META: Record<string, { emoji: string; label: string }> = {
  most_wins:   { emoji: '🏆', label: 'Top Picker' },
  loser:       { emoji: '😢', label: 'Rough Week' },
  upset_pick:  { emoji: '⚡', label: 'Upset Pick' },
  lone_wolf:   { emoji: '🐺', label: 'Lone Wolf' },
  contrarian:  { emoji: '🎯', label: 'Contrarian' },
};

function trophyMeta(type: string) {
  return TROPHY_META[type] ?? { emoji: '🏅', label: type };
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 64 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-primary/30 items-center justify-center"
    >
      <Text style={{ fontSize: size * 0.35 }} className="text-primary font-bold">
        {initials}
      </Text>
    </View>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mx-4 mb-5">
      <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
        {title}
      </Text>
      {children}
    </View>
  );
}

// ── 2×2 Stats grid ───────────────────────────────────────────────────────────

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 bg-surface rounded-xl p-4 items-center">
      <Text className="text-white text-xl font-bold">{value}</Text>
      {sub && <Text className="text-muted text-xs mt-0.5">{sub}</Text>}
      <Text className="text-muted text-xs mt-1">{label}</Text>
    </View>
  );
}

// ── Weekly history ────────────────────────────────────────────────────────────

function WeeklyHistory({ history }: { history: WeekRecord[] }) {
  if (!history.length) {
    return <Text className="text-muted text-sm">No history yet</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {history.map(({ week, wins, losses }) => {
        const total = wins + losses;
        const bg = total === 0
          ? 'bg-surface'
          : wins > losses ? 'bg-success/80'
          : wins < losses ? 'bg-danger/80'
          : 'bg-yellow-600/80';
        return (
          <View key={week} className={`${bg} rounded items-center justify-center`} style={{ width: 36, height: 36 }}>
            <Text className="text-white text-xs font-bold">{week}</Text>
            {total > 0 && (
              <Text className="text-white/80" style={{ fontSize: 9 }}>{wins}-{losses}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── H2H row ───────────────────────────────────────────────────────────────────

function H2HRow({ entry }: { entry: H2HEntry }) {
  const router = useRouter();
  const total = entry.wins + entry.losses + entry.ties;
  const initials = entry.teamName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: entry.opponentId } })}
      activeOpacity={0.7}
      className="flex-row items-center py-2.5 border-b border-border"
    >
      <View className="w-8 h-8 rounded-full bg-surface-2 items-center justify-center mr-3">
        <Text className="text-white text-xs font-bold">{initials}</Text>
      </View>
      <Text className="flex-1 text-white text-sm font-medium">{entry.teamName}</Text>
      <Text className="text-primary text-xs mr-3">›</Text>
      {total === 0 ? (
        <Text className="text-muted text-sm">No games</Text>
      ) : (
        <View className="flex-row items-center gap-3">
          <View className="items-center">
            <Text className="text-success font-bold text-sm">{entry.wins}</Text>
            <Text className="text-muted text-xs">W</Text>
          </View>
          <View className="items-center">
            <Text className="text-danger font-bold text-sm">{entry.losses}</Text>
            <Text className="text-muted text-xs">L</Text>
          </View>
          <View className="items-center">
            <Text className="text-muted font-bold text-sm">{entry.ties}</Text>
            <Text className="text-muted text-xs">T</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Trophy card ───────────────────────────────────────────────────────────────

function TrophyCard({ trophy }: { trophy: Trophy }) {
  const meta = trophyMeta(trophy.type);
  return (
    <View className="flex-1 bg-surface rounded-xl p-3 m-1">
      <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
      <Text className="text-white text-xs font-semibold mt-1" numberOfLines={1}>
        {meta.label}
      </Text>
      <Text className="text-muted text-xs">Week {trophy.week}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useMyProfile();
  const { data: trophies = [] } = useMyTrophies();

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
        <Text className="text-white text-lg font-bold mb-2">Profile unavailable</Text>
        <TouchableOpacity onPress={signOut}>
          <Text className="text-danger text-sm mt-4">Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Trophy type summary counts
  const trophyCounts: Record<string, number> = {};
  for (const t of trophies) {
    trophyCounts[t.type] = (trophyCounts[t.type] ?? 0) + 1;
  }
  const trophyTypes = Object.entries(trophyCounts).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View className="px-4 pt-6 pb-4 flex-row items-center">
        <Avatar name={profile.teamName} size={64} />
        <View className="ml-4 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-white text-xl font-bold">{profile.teamName}</Text>
            {profile.isLongie && (
              <View className="bg-primary/20 rounded px-2 py-0.5">
                <Text className="text-primary text-xs font-semibold">LONGIE</Text>
              </View>
            )}
          </View>
          <Text className="text-muted text-xs mt-1">Member since {memberSince}</Text>
        </View>
        <TouchableOpacity
          onPress={signOut}
          className="bg-surface rounded-xl p-2.5"
        >
          <Text className="text-muted text-xs font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── Season stats ── */}
      <Section title="2025 Season">
        <View className="flex-row gap-2 mb-2">
          <StatBox
            label="Record"
            value={`${profile.seasonRecord.wins}-${profile.seasonRecord.losses}`}
          />
          <StatBox
            label="Accuracy"
            value={`${profile.accuracy}%`}
          />
        </View>
        <View className="flex-row gap-2">
          <StatBox
            label="Best Week"
            value={profile.bestWeek ? `Week ${profile.bestWeek.week}` : '—'}
            sub={profile.bestWeek ? `${profile.bestWeek.wins} wins` : undefined}
          />
          <StatBox
            label="Trophies"
            value={String(profile.trophyCount)}
          />
        </View>
      </Section>

      {/* ── Weekly history ── */}
      <Section title="Week by Week">
        <WeeklyHistory history={profile.weeklyHistory} />
      </Section>

      {/* ── Insights ── */}
      {(profile.insights.bestTeam || profile.insights.worstTeam) && (
        <Section title="Insights">
          <View className="bg-surface rounded-xl overflow-hidden">
            {profile.insights.bestTeam && (
              <View className="flex-row items-center px-4 py-3 border-b border-border">
                <Text className="text-success text-base mr-2">↑</Text>
                <View className="flex-1">
                  <Text className="text-white text-sm font-medium">{profile.insights.bestTeam.team}</Text>
                  <Text className="text-muted text-xs">Best team to pick</Text>
                </View>
                <View className="items-end">
                  <Text className="text-success font-bold">{profile.insights.bestTeam.accuracy}%</Text>
                  <Text className="text-muted text-xs">
                    {profile.insights.bestTeam.wins}-{profile.insights.bestTeam.losses}
                  </Text>
                </View>
              </View>
            )}
            {profile.insights.worstTeam && (
              <View className="flex-row items-center px-4 py-3">
                <Text className="text-danger text-base mr-2">↓</Text>
                <View className="flex-1">
                  <Text className="text-white text-sm font-medium">{profile.insights.worstTeam.team}</Text>
                  <Text className="text-muted text-xs">Worst team to pick</Text>
                </View>
                <View className="items-end">
                  <Text className="text-danger font-bold">{profile.insights.worstTeam.accuracy}%</Text>
                  <Text className="text-muted text-xs">
                    {profile.insights.worstTeam.wins}-{profile.insights.worstTeam.losses}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Section>
      )}

      {/* ── H2H ── */}
      {profile.h2h && profile.h2h.length > 0 && (
        <Section title="Head to Head">
          <View className="bg-surface rounded-xl px-4">
            {profile.h2h.map(entry => (
              <H2HRow key={entry.opponentId} entry={entry} />
            ))}
          </View>
        </Section>
      )}

      {/* ── Trophy case ── */}
      {trophies.length > 0 && (
        <Section title={`Trophy Case (${trophies.length})`}>
          {/* Type summary */}
          {trophyTypes.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {trophyTypes.map(([type, count]) => {
                const meta = trophyMeta(type);
                return (
                  <View key={type} className="flex-row items-center bg-surface rounded-full px-3 py-1.5 gap-1.5">
                    <Text>{meta.emoji}</Text>
                    <Text className="text-white text-xs font-semibold">{count}</Text>
                    <Text className="text-muted text-xs">{meta.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {/* Grid — most recent 12 */}
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {trophies.slice(0, 12).map(trophy => (
              <View key={trophy.id} style={{ width: '50%' }}>
                <TrophyCard trophy={trophy} />
              </View>
            ))}
          </View>
          {trophies.length > 12 && (
            <Text className="text-muted text-xs text-center mt-2">
              +{trophies.length - 12} more
            </Text>
          )}
        </Section>
      )}

      <View className="h-8" />
    </ScrollView>
  );
}
