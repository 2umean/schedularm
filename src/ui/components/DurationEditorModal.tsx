import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { formatDuration } from '../format';
import { colors, fonts, radii, spacing } from '../theme';

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
            <Pressable onPress={() => adjust(-STEP)} style={[styles.step, styles.minus]}>
              <Text style={[styles.stepText, styles.minusText]}>−</Text>
            </Pressable>
            <Text style={styles.value}>{formatDuration(minutes)}</Text>
            <Pressable onPress={() => adjust(STEP)} style={[styles.step, styles.plus]}>
              <Text style={[styles.stepText, styles.plusText]}>＋</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.ghost}>
              <Text style={styles.ghostText}>{t('editor.cancel')}</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(minutes)} style={styles.primary}>
              <Text style={styles.primaryText}>{t('editor.set')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(31,51,73,0.35)',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  card: { backgroundColor: colors.bubble, borderRadius: radii.modal, padding: spacing.xl },
  title: { color: colors.ink, fontSize: 16, fontFamily: fonts.extra, marginBottom: spacing.l },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    borderRadius: radii.pill,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minus: { backgroundColor: colors.skyBgTop },
  plus: { backgroundColor: colors.sky500 },
  stepText: { fontSize: 26, fontFamily: fonts.extra },
  minusText: { color: colors.sky700 },
  plusText: { color: colors.white },
  value: { color: colors.ink, fontSize: 28, fontFamily: fonts.clock },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.m,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  ghost: { paddingVertical: spacing.s, paddingHorizontal: spacing.s },
  ghostText: { color: colors.ink2, fontSize: 14, fontFamily: fonts.bold },
  primary: {
    backgroundColor: colors.sky500,
    borderRadius: radii.pill,
    paddingVertical: spacing.s + 2,
    paddingHorizontal: spacing.xl,
  },
  primaryText: { color: colors.white, fontSize: 14, fontFamily: fonts.extra },
});
