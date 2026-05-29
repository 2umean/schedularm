import { DateTime } from 'luxon';
import { validate, isArmable, BOUNDS } from '../validation';
import { Schedule } from '../schedule';

const at = (h: number, m: number, day = 6) =>
  DateTime.fromObject({ year: 2026, month: 1, day, hour: h, minute: m }, { zone: 'UTC' }).toMillis();
const now = at(19, 0, 5); // evening before, BEFORE fall-asleep (19:45 day 5)
const base: Schedule = { arrival: at(6, 0), zone: 'UTC', contingency: 15, travel: 70, prep: 50, sleep: 480 };

test('a valid schedule has no issues', () => {
  expect(validate(base, now)).toEqual([]);
});

test('an out-of-range duration is reported', () => {
  const issues = validate({ ...base, sleep: BOUNDS.sleep[1] + 1 }, now);
  expect(issues).toContainEqual({ kind: 'out-of-range', field: 'sleep' });
});

test('a negative duration is infeasible (blocking)', () => {
  const issues = validate({ ...base, prep: -10 }, now);
  expect(issues).toContainEqual({ kind: 'infeasible' });
});

test('a wake time in the past is blocking', () => {
  const lateNow = at(4, 0); // after wake 03:45
  expect(validate(base, lateNow)).toContainEqual({ kind: 'past-wake' });
});

test('a fall-asleep already passed is a (non-blocking) sleep-debt nudge', () => {
  const lateNow = at(20, 30, 5); // after fallAsleep 19:45 but before wake
  expect(validate(base, lateNow)).toContainEqual({ kind: 'sleep-debt' });
});

test('wake exactly == now is blocking (boundary)', () => {
  const wakeInstant = at(3, 45); // base wake is 03:45 day 6 — exactly now
  expect(validate(base, wakeInstant)).toContainEqual({ kind: 'past-wake' });
});

test('an absurd total chain span is reported even when each duration is in range', () => {
  const huge: Schedule = { ...base, contingency: 360, travel: 720, prep: 360, sleep: 960 }; // 2400 min total
  expect(validate(huge, at(19, 0, 3))).toContainEqual({ kind: 'chain-too-long' });
});

test('isArmable blocks on infeasible/past-wake/out-of-range/chain-too-long, allows sleep-debt', () => {
  expect(isArmable([])).toBe(true);
  expect(isArmable([{ kind: 'sleep-debt' }])).toBe(true);
  expect(isArmable([{ kind: 'infeasible' }])).toBe(false);
  expect(isArmable([{ kind: 'past-wake' }])).toBe(false);
  expect(isArmable([{ kind: 'chain-too-long' }])).toBe(false);
  expect(isArmable([{ kind: 'out-of-range', field: 'sleep' }])).toBe(false);
});
