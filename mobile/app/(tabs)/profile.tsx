import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { getCurrentNFLSeason } from '@/lib/nflSeason';
import {
  useMyProfile, useMyAchievements, useSeasonTrophies,
  type H2HEntry, type WeekRecord, type Achievement, type SeasonTrophy,
} from '@/hooks/useProfile';

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

function H2HRow({ entry, season }: { entry: H2HEntry; season: number }) {
  const router = useRouter();
  const decisive = entry.wins + entry.losses;
  const winPct = decisive > 0 ? Math.round((entry.wins / decisive) * 1000) / 10 : null;
  const initials = entry.teamName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: entry.opponentId, season: String(season) } })}
      activeOpacity={0.7}
      className="flex-row items-center py-3 border-b border-border"
    >
      <View className="w-8 h-8 rounded-full bg-surface-2 items-center justify-center mr-3">
        <Text className="text-white text-xs font-bold">{initials}</Text>
      </View>
      <Text className="flex-1 text-white text-sm font-medium">{entry.teamName}</Text>
      {winPct !== null ? (
        <Text className={`font-bold text-sm mr-2 ${winPct >= 50 ? 'text-success' : 'text-danger'}`}>
          {winPct}%
        </Text>
      ) : (
        <Text className="text-muted text-sm mr-2">—</Text>
      )}
      <Text className="text-primary text-xs">›</Text>
    </TouchableOpacity>
  );
}

// ── Achievement card ──────────────────────────────────────────────────────────

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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const currentSeason = getCurrentNFLSeason();
  const [season, setSeason] = useState(currentSeason);
  const { data: profile, isLoading } = useMyProfile(season);
  const { data: trophies = [] } = useMyAchievements(season);
  const { data: seasonTrophies = [] } = useSeasonTrophies(profile?.id);

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

  // Achievement type summary counts
  const achievementCounts: Record<string, number> = {};
  for (const t of trophies) {
    achievementCounts[t.type] = (achievementCounts[t.type] ?? 0) + 1;
  }
  const trophyTypes = Object.entries(achievementCounts).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View className="px-4 pt-6 pb-4 flex-row items-center">
        <Avatar name={profile.teamName} size={64} />
        <View className="ml-4 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-white text-xl font-bold">{profile.teamName}</Text>
            {profile.isGridiron && (
              <View className="bg-primary/20 rounded px-2 py-0.5">
                <Text className="text-primary text-xs font-semibold">GRIDIRON</Text>
              </View>
            )}
          </View>
          <Text className="text-muted text-xs mt-1">Member since {memberSince}</Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => router.push('/settings' as any)}
            className="bg-surface rounded-xl p-2.5"
          >
            <Ionicons name="options-outline" size={18} color="#6b7280" />
          </TouchableOpacity>
          {profile.isAdmin && (
            <TouchableOpacity
              onPress={() => router.push('/admin' as any)}
              className="bg-surface rounded-xl p-2.5"
            >
              <Ionicons name="settings-outline" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={signOut}
            className="bg-surface rounded-xl p-2.5"
          >
            <Text className="text-muted text-xs font-semibold">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Season stats ── */}
      <View className="mx-4 mb-5">
        <View className="flex-row items-center justify-center mb-3" style={{ gap: 16 }}>
          <TouchableOpacity
            onPress={() => setSeason(s => Math.max(FIRST_SEASON, s - 1))}
            disabled={season <= FIRST_SEASON}
            className={`w-9 h-9 bg-surface rounded-full items-center justify-center ${season <= FIRST_SEASON ? 'opacity-30' : ''}`}
          >
            <Text className="text-white text-2xl leading-7">−</Text>
          </TouchableOpacity>
          <Text className="text-muted text-xs font-semibold uppercase tracking-widest" style={{ minWidth: 80, textAlign: 'center' }}>{season} Season</Text>
          <TouchableOpacity
            onPress={() => setSeason(s => Math.min(currentSeason, s + 1))}
            disabled={season >= currentSeason}
            className={`w-9 h-9 bg-surface rounded-full items-center justify-center ${season >= currentSeason ? 'opacity-30' : ''}`}
          >
            <Text className="text-white text-2xl leading-7">+</Text>
          </TouchableOpacity>
        </View>
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
            label="Achievements"
            value={String(profile.trophyCount)}
          />
        </View>
      </View>

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
              <View className="flex-row items-center px-4 py-3 border-b border-border">
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
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/picks-by-team' as any, params: { season: String(season) } })}
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-3"
            >
              <Text className="text-base mr-2">🏈</Text>
              <Text className="flex-1 text-white text-sm font-medium">Picks by Team</Text>
              <Text className="text-primary text-sm">›</Text>
            </TouchableOpacity>
          </View>
        </Section>
      )}

      {/* ── H2H ── */}
      {profile.h2h && profile.h2h.length > 0 && (
        <Section title="H2H Win Pct">
          <View className="bg-surface rounded-xl px-4">
            {profile.h2h.map(entry => (
              <H2HRow key={entry.opponentId} entry={entry} season={season} />
            ))}
          </View>
        </Section>
      )}

      {/* ── Trophy Case ── */}
      {seasonTrophies.length > 0 && (
        <Section title="Trophy Case">
          <View className="flex-row flex-wrap gap-3">
            {seasonTrophies.map(trophy => (
              <View key={trophy.id} style={{ width: '47%' }}>
                <SeasonTrophyCard trophy={trophy} />
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* ── Achievements ── */}
      {trophies.length > 0 && (
        <Section title={`Achievements (${trophies.length})`}>
          {/* Type summary */}
          {trophyTypes.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {trophyTypes.map(([type, count]) => {
                const meta = achievementMeta(type);
                return (
                  <View key={type} className="flex-row items-center bg-surface rounded-full pl-1.5 pr-3 py-1.5 gap-2">
                    {meta.image ? (
                      <Image source={meta.image} style={{ width: 28, height: 28, borderRadius: 7 }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 18 }}>🏅</Text>
                    )}
                    <Text className="text-white text-sm font-bold">{count}</Text>
                    <Text className="text-muted text-xs">{meta.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {/* Grid — all achievements */}
          <View className="flex-row flex-wrap gap-3">
            {trophies.map(trophy => (
              <View key={trophy.id} style={{ width: '47%' }}>
                <AchievementCard trophy={trophy} />
              </View>
            ))}
          </View>
        </Section>
      )}

      <View className="h-8" />
    </ScrollView>
  );
}
