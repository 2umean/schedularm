import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  icon: string;
  label: string;
  clock: string;
  day: string;
  emphasis?: 'anchor' | 'alarm' | 'muted';
  badge?: string; // e.g. "ALARM"
  onPress?: () => void;
};

export function TimeRow({ icon, label, clock, day, emphasis = 'muted', badge, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.labelCol}>
        <Text style={[styles.label, emphasis === 'anchor' && styles.anchorLabel]}>{label}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      <View style={styles.timeCol}>
        <Text style={[styles.clock, emphasis === 'anchor' && styles.anchorClock]}>{clock}</Text>
        <Text style={styles.day}>{day}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  icon: { fontSize: 20, width: 32 },
  labelCol: { flex: 1 },
  label: { color: '#C7CEE6', fontSize: 16 },
  anchorLabel: { color: '#FFFFFF', fontWeight: '700' },
  badge: { color: '#7E8AB0', fontSize: 11, marginTop: 2 },
  timeCol: { alignItems: 'flex-end' },
  clock: { color: '#E7ECFB', fontSize: 18, fontWeight: '600' },
  anchorClock: { color: '#3D6BFF', fontSize: 22, fontWeight: '800' },
  day: { color: '#7E8AB0', fontSize: 12 },
});
