import { DateTime } from 'luxon';

import { reverseCalc } from './engine';
import { MINUTE_MS, Schedule } from './schedule';

const DAY_MS = 24 * 60 * MINUTE_MS;
/** Cap on the DST fine-tune loop — the bulk jump lands within ~1 day of `now`. */
const MAX_FINE_TUNE_STEPS = 5;

/**
 * Advance a schedule's arrival forward to its next future occurrence — in whole
 * calendar days within the captured zone, so the wall-clock arrival time is
 * preserved and each step is DST-safe — until the derived wake instant is
 * strictly after `nowMs`.
 *
 * This makes a bare "arrive by 06:00" behave as the *next* 06:00 once the prior
 * occurrence has elapsed (spec §6, "soonest future instant"): an alarm whose
 * wake-up has already passed rolls forward instead of becoming un-armable via a
 * `past-wake` block. The bulk jump is computed directly (not a 1-day-at-a-time
 * loop), so even an ancient/corrupt stored arrival lands in the future in a
 * single call. Returns the input unchanged (referential identity, so callers
 * can memoize on it) when the wake is already in the future.
 */
export function rollScheduleToFuture(s: Schedule, nowMs: number): Schedule {
  const wakeMs = reverseCalc(s).wake;
  if (wakeMs > nowMs) return s;

  // Jump most of the gap at once (ceil → the minimal whole-day advance), then
  // fine-tune for any DST unevenness or an exact boundary tie.
  const approxDays = Math.ceil((nowMs - wakeMs) / DAY_MS); // >= 1
  let arrival = DateTime.fromMillis(s.arrival, { zone: s.zone })
    .plus({ days: approxDays })
    .toMillis();

  for (let i = 0; reverseCalc({ ...s, arrival }).wake <= nowMs && i < MAX_FINE_TUNE_STEPS; i += 1) {
    arrival = DateTime.fromMillis(arrival, { zone: s.zone }).plus({ days: 1 }).toMillis();
  }
  return { ...s, arrival };
}
