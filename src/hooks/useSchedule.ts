import { useEffect, useMemo, useReducer, useState } from 'react';
import { DateTime } from 'luxon';

import { isArmable, reverseCalc, validate } from '../domain';
import { loadPresets, savePresets, SEED_DEFAULTS } from '../storage/presets';
import {
  ScheduleAction,
  initialState,
  scheduleReducer,
  toSchedule,
} from '../state/scheduleReducer';

const NOW_TICK_MS = 60_000;

export function useSchedule() {
  const zone = useMemo(() => DateTime.local().zoneName ?? 'UTC', []);
  const [state, dispatch] = useReducer(scheduleReducer, undefined, () =>
    initialState(SEED_DEFAULTS, zone),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Replace seed durations with the user's sticky presets on mount.
  useEffect(() => {
    let cancelled = false;
    loadPresets().then((d) => {
      if (cancelled) return;
      (Object.keys(d) as (keyof typeof d)[]).forEach((field) =>
        dispatch({ type: 'set-duration', field, minutes: d[field] }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-evaluate past-wake / sleep-debt as time passes.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const schedule = useMemo(() => toSchedule(state), [state]);
  const derived = useMemo(() => (schedule ? reverseCalc(schedule) : null), [schedule]);
  const issues = useMemo(
    () => (schedule ? validate(schedule, nowMs) : []),
    [schedule, nowMs],
  );
  const armable = schedule != null && isArmable(issues);

  // Not memoized — use from event handlers only, never as an effect/memo dep.
  /** Persist the current durations as the new sticky presets (call when arming). */
  const persistPresets = () =>
    savePresets({
      contingency: state.contingency,
      travel: state.travel,
      prep: state.prep,
      sleep: state.sleep,
    });

  return {
    state,
    zone,
    schedule,
    derived,
    issues,
    armable,
    nowMs,
    dispatch,
    persistPresets,
  };
}
