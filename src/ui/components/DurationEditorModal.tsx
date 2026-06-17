import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { t } from '../../i18n';
import { composeDuration, splitDuration } from '../format';
import { colors, fonts, radii, spacing } from '../theme';

const STEP = 1; // minute — fine-grained nudge (was 5)

type Props = {
  visible: boolean;
  title: string;
  initialMinutes: number;
  max: number;
  onCancel: () => void;
  onConfirm: (minutes: number) => void;
};

const clampTotal = (n: number, max: number) => Math.min(max, Math.max(0, n));
const onlyDigits = (s: string) => s.replace(/[^0-9]/g, '');
const pad2 = (n: number) => String(n).padStart(2, '0');

export function DurationEditorModal({
  visible,
  title,
  initialMinutes,
  max,
  onCancel,
  onConfirm,
}: Props) {
  const seed = clampTotal(Math.round(initialMinutes), max);
  const seedParts = splitDuration(seed);
  const [minutes, setMinutes] = useState(seed);
  const [hStr, setHStr] = useState(String(seedParts.hours));
  const [mStr, setMStr] = useState(pad2(seedParts.mins));

  /** Push a committed total back into both fields (used by ± and on blur). */
  const syncFields = (total: number) => {
    const p = splitDuration(total);
    setHStr(String(p.hours));
    setMStr(pad2(p.mins));
  };

  const setTotal = (total: number) => {
    const clamped = clampTotal(total, max);
    setMinutes(clamped);
    syncFields(clamped);
  };

  // While typing, track the parsed total live. Snap the visible fields to the
  // canonical clamped value when the entry is out of bounds (capped) OR the
  // minutes carry past 59 — so what's shown always equals what Set commits
  // (e.g. "0:75" normalizes to "1:15"; "16:30" over max snaps to "16:00").
  const recompute = (h: string, m: string) => {
    const { total, capped } = composeDuration(h, m, max);
    setMinutes(total);
    if (capped || Number(m || '0') >= 60) syncFields(total);
  };

  const onChangeHours = (txt: string) => {
    const v = onlyDigits(txt).slice(0, 2);
    setHStr(v);
    recompute(v, mStr);
  };
  const onChangeMins = (txt: string) => {
    const v = onlyDigits(txt).slice(0, 2);
    setMStr(v);
    recompute(hStr, v);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.stepper}>
            <Pressable onPress={() => setTotal(minutes - STEP)} style={[styles.step, styles.minus]}>
              <Text style={[styles.stepText, styles.minusText]}>−</Text>
            </Pressable>
            <View style={styles.fields}>
              <TextInput
                style={styles.input}
                value={hStr}
                onChangeText={onChangeHours}
                onBlur={() => syncFields(minutes)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                returnKeyType="done"
                accessibilityLabel={t('editor.hours')}
              />
              <Text style={styles.colon}>:</Text>
              <TextInput
                style={styles.input}
                value={mStr}
                onChangeText={onChangeMins}
                onBlur={() => syncFields(minutes)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                returnKeyType="done"
                accessibilityLabel={t('editor.minutes')}
              />
            </View>
            <Pressable onPress={() => setTotal(minutes + STEP)} style={[styles.step, styles.plus]}>
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
  fields: { flexDirection: 'row', alignItems: 'center' },
  input: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: fonts.clock,
    textAlign: 'center',
    minWidth: 50,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: colors.sky500,
  },
  colon: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: fonts.clock,
    marginHorizontal: spacing.xs,
  },
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
