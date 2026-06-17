import { useEffect, useLayoutEffect, useMemo, useReducer, useState } from 'react';
import { DateTime } from 'luxon';

import { isArmable, reverseCalc, rollScheduleToFuture, Schedule, validate } from '../domain';
import { loadArmed } from '../storage/armedSchedule';
import { DraftSchedule, loadDraft, saveDraft } from '../storage/draftSchedule';
import { loadPresets, SEED_DEFAULTS } from '../storage/presets';
import {
  initialState,
  scheduleReducer,
  toSchedule,
  ScheduleState,
} from '../state/scheduleReducer';

const NOW_TICK_MS = 60_000;

/**
 * Build the reducer state for a restored schedule, reconciled to the current
 * device zone (the app is single-zone; see spec §4) and rolled to its next
 * future occurrence — so a relaunch never lands on an un-armable past schedule
 * and the displayed/rolled zone always matches the zone used for formatting.
 */
function restoreState(draft: DraftSchedule, nowMs: number, deviceZone: string): ScheduleState {
  const durations = {
    contingency: draft.contingency,
    travel: draft.travel,
    prep: draft.prep,
    sleep: draft.sleep,
  };
  if (draft.arrival == null) return { arrival: null, zone: deviceZone, ...durations };
  const rolled = rollScheduleToFuture(
    { arrival: draft.arrival, zone: deviceZone, ...durations },
    nowMs,
  );
  return { arrival: rolled.arrival, zone: deviceZone, ...durations };
}

const fromSchedule = (s: Schedule): DraftSchedule => ({
  arrival: s.arrival,
  zone: s.zone,
  contingency: s.contingency,
  travel: s.travel,
  prep: s.prep,
  sleep: s.sleep,
});

export function useSchedule() {
  const zone = useMemo(() => DateTime.local().zoneName ?? 'UTC', []);
  const [state, dispatch] = useReducer(scheduleReducer, undefined, () =>
    initialState(SEED_DEFAULTS, zone),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  // Restore the entire in-progress schedule (arrival + durations) on launch.
  // Order of precedence: saved draft → a still-valid armed alarm (migration for
  // users who upgrade with an alarm already set) → sticky preset durations.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadDraft();
      if (cancelled) return;
      if (draft) {
        dispatch({ type: 'hydrate', state: restoreState(draft, Date.now(), zone) });
      } else {
        const armed = await loadArmed();
        if (cancelled) return;
        if (armed && reverseCalc(armed).wake > Date.now()) {
          dispatch({ type: 'hydrate', state: restoreState(fromSchedule(armed), Date.now(), zone) });
        } else {
          const presets = await loadPresets();
          if (cancelled) return;
          (Object.keys(presets) as (keyof typeof presets)[]).forEach((field) =>
            dispatch({ type: 'set-duration', field, minutes: presets[field] }),
          );
        }
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [zone]);

  // Persist every change — but only after hydration, so the pre-hydration
  // initial state never clobbers the stored draft.
  useEffect(() => {
    if (hydrated) void saveDraft(state);
  }, [state, hydrated]);

  // Re-evaluate past-wake / sleep-debt and re-roll as time passes.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const rawSchedule = useMemo(() => toSchedule(state), [state]);
  // The schedule shown and armed is always rolled to its next future occurrence,
  // so a passed wake-up advances to the next day instead of blocking the alarm.
  const schedule = useMemo(
    () => (rawSchedule ? rollScheduleToFuture(rawSchedule, nowMs) : null),
    [rawSchedule, nowMs],
  );

  // Sync the stored anchor to the rolled value so reducer edits (which read
  // state.arrival) always operate on the same instant the user sees. Runs in a
  // LAYOUT effect — synchronously before paint — so an edit fired right after a
  // day-boundary tick can never solve a duration against a stale raw anchor.
  // Idempotent: rollScheduleToFuture returns the same reference once future.
  useLayoutEffect(() => {
    if (schedule && schedule.arrival !== state.arrival) {
      dispatch({ type: 'roll-arrival', instant: schedule.arrival });
    }
  }, [schedule, state.arrival]);

  const derived = useMemo(() => (schedule ? reverseCalc(schedule) : null), [schedule]);
  const issues = useMemo(() => (schedule ? validate(schedule, nowMs) : []), [schedule, nowMs]);
  const armable = schedule != null && isArmable(issues);

  return {
    state,
    zone,
    schedule,
    derived,
    issues,
    armable,
    nowMs,
    dispatch,
  };
}
