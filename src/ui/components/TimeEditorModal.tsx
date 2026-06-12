import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { colors, fonts, radii, spacing } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  /** Seed clock shown when the picker opens, as a JS Date (local). */
  initial: Date;
  onCancel: () => void;
  onConfirm: (hour: number, minute: number) => void;
};

export function TimeEditorModal({ visible, title, initial, onCancel, onConfirm }: Props) {
  const [value, setValue] = useState<Date>(initial);

  // On Android the picker IS a system dialog with its own OK/Cancel — wrapping it
  // in our Modal stacks two dialogs. Render it bare and commit from its events.
  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={initial}
        mode="time"
        is24Hour
        display="spinner"
        onChange={(e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) {
            onConfirm(d.getHours(), d.getMinutes());
          } else {
            onCancel();
          }
        }}
      />
    );
  }

  const onChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (d) setValue(d);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <DateTimePicker
            value={value}
            mode="time"
            is24Hour
            display="spinner"
            onChange={onChange}
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.btn, styles.ghost]}>
              <Text style={styles.ghostText}>{t('editor.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(value.getHours(), value.getMinutes())}
              style={[styles.btn, styles.primary]}
            >
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
  title: { color: colors.ink, fontSize: 16, fontFamily: fonts.extra, marginBottom: spacing.s },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.m, marginTop: spacing.m },
  btn: { borderRadius: radii.pill, paddingVertical: spacing.s + 2, paddingHorizontal: spacing.xl },
  ghost: { backgroundColor: 'transparent' },
  ghostText: { color: colors.ink2, fontSize: 14, fontFamily: fonts.bold },
  primary: { backgroundColor: colors.sky500 },
  primaryText: { color: colors.white, fontSize: 14, fontFamily: fonts.extra },
});
