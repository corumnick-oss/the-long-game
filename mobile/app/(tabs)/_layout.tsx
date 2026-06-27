import { useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedbackModal } from '@/components/FeedbackModal';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={24}
      color={focused ? '#3b82f6' : '#6b7280'}
    />
  );
}

function FeedbackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity className="pr-4 pl-2 py-1" onPress={onPress}>
      <Ionicons name="chatbubble-ellipses-outline" size={24} color="#9ca3af" />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);
  const headerRight = useCallback(() => <FeedbackButton onPress={openFeedback} />, [openFeedback]);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#0f0f0f',
            borderTopColor: '#2a2a2a',
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#6b7280',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
          headerStyle: { backgroundColor: '#0f0f0f' },
          headerTintColor: '#fff',
          headerShadowVisible: false,
          headerRight,
        }}
      >
        <Tabs.Screen
          name="picks"
          options={{
            title: 'Picks',
            tabBarIcon: ({ focused }) => <TabIcon name="american-football" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: 'Leaderboard',
            tabBarIcon: ({ focused }) => <TabIcon name="trophy" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="week-picks"
          options={{
            title: 'Week Picks',
            tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
          }}
        />
      </Tabs>
      <FeedbackModal visible={feedbackOpen} onClose={closeFeedback} />
    </>
  );
}
