import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlarmHealth, HealthReason } from '../../alarm/alarmHealth';

const REASON_TEXT: Record<HealthReason, string> = {
  'notifications-denied': 'Notifications are off — the alarm can’t alert you',
  'exact-alarm-denied': 'Exact alarms are blocked — your alarm may not fire on time',
  'full-screen-denied': 'Full-screen alarms are off — it won’t show over the lock screen',
  'overlay-denied': '“Appear on top” is off — the alarm shows as a banner, not full-screen',
  'battery-not-whitelisted': 'Battery optimization may kill the alarm — tap to fix',
};

type Props = {
  health: AlarmHealth;
  armedSummary: { wake: string; leave: string } | null;
  onFixPress: () => void;
};

export function StatusBanner({ health, armedSummary, onFixPress }: Props) {
  const atRisk = !health.isArmReliable || health.reasons.length > 0;

  if (atRisk) {
    return (
      <Pressable onPress={onFixPress} style={[styles.banner, styles.risk]}>
        <Text style={styles.riskTitle}>⚠ Your alarm may NOT ring — tap to fix</Text>
        {health.reasons.map((r) => (
          <Text key={r} style={styles.riskLine}>
            • {REASON_TEXT[r]}
          </Text>
        ))}
      </Pressable>
    );
  }

  return (
    <View style={[styles.banner, styles.ok]}>
      {armedSummary ? (
        <Text style={styles.okTitle}>
          ✓ Armed · Wake {armedSummary.wake} · Leave {armedSummary.leave}
        </Text>
      ) : (
        <Text style={styles.okTitle}>Ready — set your arrival time</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 12, padding: 16, marginBottom: 12 },
  ok: { backgroundColor: '#13351F' },
  okTitle: { color: '#3DDC84', fontSize: 16, fontWeight: '700' },
  risk: { backgroundColor: '#3A1320' },
  riskTitle: { color: '#FF7A8A', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  riskLine: { color: '#E2A8B2', fontSize: 13, lineHeight: 18 },
});
