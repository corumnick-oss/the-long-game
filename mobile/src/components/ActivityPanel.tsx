import { useRef, useEffect, useState } from 'react';
import {
  View, Text, Modal, Animated, TouchableOpacity, Pressable,
  FlatList, ActivityIndicator, Dimensions, StyleSheet,
} from 'react-native';
import { useActivity, type ActivityItem } from '../hooks/useActivity';

const PANEL_WIDTH = Dimensions.get('window').width * 0.85;

function activityIcon(type: string): string {
  switch (type) {
    case 'week_unlock': return '🔓';
    case 'week_lock': return '🔒';
    case 'trophy_award': case 'trophies_awarded': return '🏆';
    case 'trophy_earn': return '🏅';
    case 'user_join': return '👋';
    case 'score_correction': return '📝';
    case 'pick_submit': return '✅';
    case 'weekly_result': return '📊';
    case 'admin_sync': return '🔄';
    case 'milestone': return '⭐';
    default: return '📣';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{activityIcon(item.type)}</Text>
      <View style={styles.rowText}>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
    </View>
  );
}

function Feed({ tab, enabled }: { tab: 'global' | 'personal'; enabled: boolean }) {
  const {
    data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useActivity(tab, enabled);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Couldn't load activity</Text>
      </View>
    );
  }

  const items = data?.pages.flatMap(p => p.items) ?? [];

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>
          {tab === 'personal' ? 'Your activity will appear here.' : 'No global activity yet.'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <ActivityRow item={item} />}
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator color="#3b82f6" style={{ padding: 16 }} /> : null
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ActivityPanel({ visible, onClose }: Props) {
  const [tab, setTab] = useState<'global' | 'personal'>('global');
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : PANEL_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop — tapping it closes the panel */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
        <View style={styles.overlay} />
      </Pressable>

      {/* Panel — rendered after backdrop so it captures touches first */}
      <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* Inner Pressable blocks backdrop from firing for taps inside the panel */}
        <Pressable style={{ flex: 1 }} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Activity</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {(['global', 'personal'] as const).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              >
                <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                  {t === 'global' ? 'Global Feed' : 'Your Activity'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Feed tab={tab} enabled={visible} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    color: '#6b7280',
    fontSize: 18,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 20,
  },
  tabBtn: {
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#3b82f6',
  },
  tabLabel: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#3b82f6',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  icon: {
    fontSize: 18,
    marginRight: 12,
    marginTop: 1,
  },
  rowText: {
    flex: 1,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  time: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 3,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  empty: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
