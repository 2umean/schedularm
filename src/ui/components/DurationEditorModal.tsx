import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '../format';

const STEP = 5; // minutes

type Props = {
  visible: boolean;
  title: string;
  initialMinutes: number;
  max: number;
  onCancel: () => void;
  onConfirm: (minutes: number) => void;
};

export function DurationEditorModal({
  visible,
  title,
  initialMinutes,
  max,
  onCancel,
  onConfirm,
}: Props) {
  const [minutes, setMinutes] = useState(initialMinutes);

  const adjust = (delta: number) =>
    setMinutes((m) => Math.min(max, Math.max(0, m + delta)));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.stepper}>
            <Pressable onPress={() => adjust(-STEP)} style={styles.step}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.value}>{formatDuration(minutes)}</Text>
            <Pressable onPress={() => adjust(STEP)} style={styles.step}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.btn, styles.ghost]}>
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(minutes)} style={[styles.btn, styles.primary]}>
              <Text style={styles.primaryText}>Set</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#161C33', borderRadius: 16, padding: 20 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    backgroundColor: '#2A3A66',
    borderRadius: 12,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  value: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  btn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  ghost: { backgroundColor: 'transparent' },
  ghostText: { color: '#9AA4C2', fontSize: 16 },
  primary: { backgroundColor: '#3D6BFF' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
