import { MINUTE_MS, Schedule } from './schedule';
import { reverseCalc } from './engine';

export type EditOutcome = {
  schedule: Schedule;
  feasible: boolean;
  violation?: 'negative-duration';
};

function finalize(schedule: Schedule): EditOutcome {
  const negative = [schedule.contingency, schedule.travel, schedule.prep, schedule.sleep].some((v) => v < 0);
  return { schedule, feasible: !negative, violation: negative ? 'negative-duration' : undefined };
}

/** Convert an elapsed-ms delta to whole minutes. Math.round guards against a non-minute-aligned
 *  instant from the time picker producing a fractional Minutes value (the Minutes contract is integers). */
const toMinutes = (deltaMs: number): number => Math.round(deltaMs / MINUTE_MS);

/** Wake edit → solve Prep (leaveHome unchanged). */
export function editWake(s: Schedule, newWakeMs: number): EditOutcome {
  const { leaveHome } = reverseCalc(s);
  return finalize({ ...s, prep: toMinutes(leaveHome - newWakeMs) });
}

/** Leave-home edit → solve Travel, holding Contingency fixed. */
export function editLeaveHome(s: Schedule, newLeaveMs: number): EditOutcome {
  return finalize({ ...s, travel: toMinutes(s.arrival - s.contingency * MINUTE_MS - newLeaveMs) });
}

/** Fall-asleep edit → solve Sleep. */
export function editFallAsleep(s: Schedule, newFallMs: number): EditOutcome {
  const { wake } = reverseCalc(s);
  return finalize({ ...s, sleep: toMinutes(wake - newFallMs) });
}

/** Arrival edit → move the anchor; durations unchanged. */
export function editArrival(s: Schedule, newArrivalMs: number): EditOutcome {
  return finalize({ ...s, arrival: newArrivalMs });
}
