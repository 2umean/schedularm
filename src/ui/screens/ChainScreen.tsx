import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AlarmService } from '../../alarm/AlarmService';
import { BOUNDS, resolveArrivalInstant, reverseCalc, ValidationIssue } from '../../domain';
import { useArming } from '../../hooks/useArming';
import { useSchedule } from '../../hooks/useSchedule';
import { DurationEditorModal } from '../components/DurationEditorModal';
import { DurationPill } from '../components/DurationPill';
import { StatusBanner } from '../components/StatusBanner';
import { TimeEditorModal } from '../components/TimeEditorModal';
import { TimeRow } from '../components/TimeRow';
import { formatClockWithDay, pickedTimeToInstant } from '../format';

type DurationField = 'contingency' | 'travel' | 'prep' | 'sleep';
type TimeField = 'arrival' | 'wake' | 'leaveHome' | 'fallAsleep';

const TIME_LABEL: Record<TimeField, string> = {
  arrival: 'arrival',
  wake: 'wake up',
  leaveHome: 'leave home',
  fallAsleep: 'fall asleep',
};
const DURATION_LABEL: Record<DurationField, string> = {
  contingency: 'contingency',
  travel: 'travel',
  prep: 'prep',
  sleep: 'sleep',
};

const ISSUE_TEXT = (i: ValidationIssue): string => {
  switch (i.kind) {
    case 'infeasible':
      return 'This timing is impossible — a step would take negative time.';
    case 'past-wake':
      return 'The wake-up time has already passed.';
    case 'sleep-debt':
      return 'Heads up: not much time left to sleep.';
    case 'chain-too-long':
      return 'The total span is unrealistically long.';
    case 'out-of-range':
      return `The ${i.field} duration is out of range.`;
  }
};

export function ChainScreen() {
  const { state, zone, schedule, derived, issues, armable, nowMs, dispatch, persistPresets } =
    useSchedule();
  const { armed, health, arm, disarm, refreshHealth } = useArming();

  const [timeEditor, setTimeEditor] = useState<TimeField | null>(null);
  const [durationEditor, setDurationEditor] = useState<DurationField | null>(null);

  const ref = schedule?.arrival ?? nowMs;
  const fmt = (ms: number) => formatClockWithDay(ms, ref, zone);

  const armedSummary = (() => {
    if (armed == null) return null;
    const d = reverseCalc(armed);
    return {
      wake: formatClockWithDay(d.wake, ref, zone).clock,
      leave: formatClockWithDay(d.leaveHome, ref, zone).clock,
    };
  })();

  const onArm = async () => {
    if (!schedule || !armable) return;
    await arm(schedule);
    // Sticky-on-arm (spec §9) — but presets are a convenience; never let their write block the alarm.
    await persistPresets().catch(() => {});
  };

  const openTime = (field: TimeField) => setTimeEditor(field);
  const confirmTime = (hour: number, minute: number) => {
    if (!timeEditor) return;
    if (timeEditor === 'arrival') {
      const instant = schedule
        ? pickedTimeToInstant(schedule.arrival, hour, minute, zone)
        : resolveArrivalInstant(hour, minute, zone, nowMs);
      dispatch({ type: schedule ? 'edit-arrival' : 'set-arrival', instant, zone });
    } else if (derived) {
      const base =
        timeEditor === 'wake'
          ? derived.wake
          : timeEditor === 'leaveHome'
            ? derived.leaveHome
            : derived.fallAsleep;
      const instant = pickedTimeToInstant(base, hour, minute, zone);
      dispatch({
        type:
          timeEditor === 'wake'
            ? 'edit-wake'
            : timeEditor === 'leaveHome'
              ? 'edit-leave-home'
              : 'edit-fall-asleep',
        instant,
      });
    }
    setTimeEditor(null);
  };

  const confirmDuration = (minutes: number) => {
    if (!durationEditor) return;
    dispatch({ type: 'set-duration', field: durationEditor, minutes });
    setDurationEditor(null);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <StatusBanner
          health={health}
          armedSummary={armedSummary}
          onFixPress={async () => {
            await AlarmService.requestCritical();
            refreshHealth();
          }}
        />

        {issues.map((i, idx) => (
          <Text key={idx} style={styles.issue}>
            ⚠ {ISSUE_TEXT(i)}
          </Text>
        ))}

        {schedule && derived ? (
          <View style={styles.chain}>
            <TimeRow
              icon="🌙"
              label="Fall asleep"
              {...fmt(derived.fallAsleep)}
              onPress={() => openTime('fallAsleep')}
            />
            <DurationPill icon="😴" minutes={state.sleep} onPress={() => setDurationEditor('sleep')} />

            <TimeRow
              icon="⏰"
              label="Wake up"
              badge="ALARM"
              emphasis="alarm"
              {...fmt(derived.wake)}
              onPress={() => openTime('wake')}
            />
            <DurationPill icon="🚿" minutes={state.prep} onPress={() => setDurationEditor('prep')} />

            <TimeRow
              icon="🚪"
              label="Leave home"
              {...fmt(derived.leaveHome)}
              onPress={() => openTime('leaveHome')}
            />
            <View style={styles.pillRow}>
              <DurationPill icon="🚕" minutes={state.travel} onPress={() => setDurationEditor('travel')} />
              <DurationPill
                icon="🛟"
                minutes={state.contingency}
                onPress={() => setDurationEditor('contingency')}
              />
            </View>

            <TimeRow
              icon="📍"
              label="Arrive by"
              emphasis="anchor"
              {...fmt(derived.arrival)}
              onPress={() => openTime('arrival')}
            />
          </View>
        ) : (
          <Pressable style={styles.empty} onPress={() => openTime('arrival')}>
            <Text style={styles.emptyText}>＋ Set your arrival time</Text>
          </Pressable>
        )}

        {schedule ? (
          <Pressable
            onPress={armed ? disarm : onArm}
            disabled={!armed && !armable}
            style={[styles.arm, armed ? styles.disarm : armable ? styles.armActive : styles.armDisabled]}
          >
            <Text style={styles.armText}>{armed ? 'Disarm' : 'Arm alarm'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {timeEditor ? (
        <TimeEditorModal
          visible
          title={`Set ${TIME_LABEL[timeEditor]}`}
          initial={new Date()}
          onCancel={() => setTimeEditor(null)}
          onConfirm={confirmTime}
        />
      ) : null}

      {durationEditor ? (
        <DurationEditorModal
          visible
          title={`Set ${DURATION_LABEL[durationEditor]}`}
          initialMinutes={state[durationEditor]}
          max={BOUNDS[durationEditor][1]}
          onCancel={() => setDurationEditor(null)}
          onConfirm={confirmDuration}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1021' },
  scroll: { padding: 20, paddingTop: 64 },
  issue: { color: '#FFB870', fontSize: 14, marginBottom: 6 },
  chain: { backgroundColor: '#11172B', borderRadius: 16, padding: 16 },
  pillRow: { flexDirection: 'row', gap: 8 },
  empty: {
    borderWidth: 1,
    borderColor: '#2A3A66',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: { color: '#7E8AB0', fontSize: 18 },
  arm: { marginTop: 24, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  armActive: { backgroundColor: '#3D6BFF' },
  armDisabled: { backgroundColor: '#27314F' },
  disarm: { backgroundColor: '#B5304A' },
  armText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
