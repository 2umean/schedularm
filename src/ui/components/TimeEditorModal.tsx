import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(value.getHours(), value.getMinutes())}
              style={[styles.btn, styles.primary]}
            >
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
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  btn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  ghost: { backgroundColor: 'transparent' },
  ghostText: { color: '#9AA4C2', fontSize: 16 },
  primary: { backgroundColor: '#3D6BFF' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
