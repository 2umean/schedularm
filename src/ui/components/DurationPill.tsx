import { Pressable, StyleSheet, Text } from 'react-native';

import { formatDuration } from '../format';

type Props = {
  icon: string;
  minutes: number;
  onPress: () => void;
};

export function DurationPill({ icon, minutes, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.pill}>
      <Text style={styles.text}>
        {icon} {formatDuration(minutes)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1B2340',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 32,
    marginVertical: 2,
  },
  text: { color: '#AEB7DA', fontSize: 14 },
});
