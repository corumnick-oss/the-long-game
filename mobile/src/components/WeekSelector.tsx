import { useRef, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Text, View } from 'react-native';

type Props = {
  currentWeek: number;
  selectedWeek: number;
  onSelect: (week: number) => void;
  totalWeeks?: number;
  seasonType?: 'regular' | 'preseason';
};

export function WeekSelector({ currentWeek, selectedWeek, onSelect, totalWeeks, seasonType = 'regular' }: Props) {
  const weeks = totalWeeks ?? (seasonType === 'preseason' ? 4 : 18);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Scroll selected week into view
    const offset = Math.max(0, (selectedWeek - 1) * 52 - 100);
    scrollRef.current?.scrollTo({ x: offset, animated: true });
  }, [selectedWeek]);

  return (
    <View className="border-b border-border">
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
      >
        {Array.from({ length: weeks }, (_, i) => i + 1).map(week => {
          const isSelected = week === selectedWeek;
          const isCurrent = week === currentWeek;
          return (
            <TouchableOpacity
              key={week}
              onPress={() => onSelect(week)}
              className={`w-10 h-10 rounded-full items-center justify-center mr-2 ${
                isSelected ? 'bg-primary' : 'bg-surface'
              }`}
              style={isCurrent && !isSelected ? { borderWidth: 1, borderColor: '#3b82f6' } : undefined}
            >
              <Text
                className={`text-xs font-semibold ${isSelected ? 'text-white' : isCurrent ? 'text-primary' : 'text-muted'}`}
              >
                {seasonType === 'preseason' ? `P${week}` : week}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
