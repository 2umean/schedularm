import { Schedule } from './schedule';
import { reverseCalc } from './engine';

/** [min, max] minutes per duration. */
export const BOUNDS = {
  contingency: [0, 360],
  travel: [0, 720],
  prep: [0, 360],
  sleep: [0, 960],
} as const;

/** Max sane total chain span (arrival → fall-asleep), in minutes. ~26h covers a long sleep + commute + buffers. */
export const MAX_CHAIN_SPAN = 26 * 60;

type DurationField = keyof typeof BOUNDS;

export type ValidationIssue =
  | { kind: 'out-of-range'; field: DurationField }
  | { kind: 'infeasible' }
  | { kind: 'chain-too-long' }
  | { kind: 'past-wake' }
  | { kind: 'sleep-debt' };

export function validate(s: Schedule, nowMs: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  (Object.keys(BOUNDS) as DurationField[]).forEach((f) => {
    const [min, max] = BOUNDS[f];
    if (s[f] < min || s[f] > max) issues.push({ kind: 'out-of-range', field: f });
  });

  if ([s.contingency, s.travel, s.prep, s.sleep].some((v) => v < 0)) {
    issues.push({ kind: 'infeasible' });
  }

  if (s.contingency + s.travel + s.prep + s.sleep > MAX_CHAIN_SPAN) {
    issues.push({ kind: 'chain-too-long' });
  }

  const { wake, fallAsleep } = reverseCalc(s);
  if (wake <= nowMs) issues.push({ kind: 'past-wake' });
  else if (fallAsleep <= nowMs) issues.push({ kind: 'sleep-debt' });

  return issues;
}

/** The safety gate: which issue kinds block arming an alarm. sleep-debt is a nudge, not a blocker. */
const BLOCKING: ReadonlyArray<ValidationIssue['kind']> = [
  'out-of-range',
  'infeasible',
  'chain-too-long',
  'past-wake',
];

/** True when the schedule is safe to arm (no blocking issues). The UI must gate the arm button on this. */
export function isArmable(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => BLOCKING.includes(i.kind));
}
