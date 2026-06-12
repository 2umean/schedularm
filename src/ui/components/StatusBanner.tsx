import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlarmHealth } from '../../alarm/alarmHealth';
import { t } from '../../i18n';
import { colors, fonts, radii, shadows, spacing } from '../theme';

type Props = {
  health: AlarmHealth;
  armedSummary: { wake: string; leave: string } | null;
  onFixPress: () => void;
};

export function StatusBanner({ health, armedSummary, onFixPress }: Props) {
  const atRisk = !health.isArmReliable || health.reasons.length > 0;

  if (atRisk) {
    return (
      <Pressable onPress={onFixPress} style={styles.risk}>
        <Text style={styles.riskTitle}>{t('banner.atRisk')}</Text>
        {health.reasons.map((r) => (
          <Text key={r} style={styles.riskLine}>
            • {t(`reason.${r}`)}
          </Text>
        ))}
      </Pressable>
    );
  }

  return (
    <View style={[styles.chip, armedSummary ? styles.armed : styles.ready]}>
      <Text style={armedSummary ? styles.armedText : styles.readyText}>
        {armedSummary
          ? t('banner.armed', { wake: armedSummary.wake, leave: armedSummary.leave })
          : t('banner.ready')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    paddingVertical: spacing.m - 2,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
  },
  armed: { backgroundColor: colors.mintBg },
  armedText: { color: colors.green, fontSize: 13, fontFamily: fonts.extra },
  ready: { backgroundColor: colors.bubble, ...shadows.bubble },
  readyText: { color: colors.ink2, fontSize: 13, fontFamily: fonts.bold },
  risk: {
    backgroundColor: colors.blushBg,
    borderRadius: radii.bubble - 4,
    padding: spacing.l - 2,
    marginBottom: spacing.m,
  },
  riskTitle: { color: colors.red, fontSize: 13, fontFamily: fonts.extra },
  riskLine: { color: colors.blushText, fontSize: 11, fontFamily: fonts.semi, marginTop: 3, lineHeight: 16 },
});
