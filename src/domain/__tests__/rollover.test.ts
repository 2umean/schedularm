import { DateTime } from 'luxon';

import { reverseCalc } from '../engine';
import { rollScheduleToFuture } from '../rollover';
import { Schedule } from '../schedule';

const at = (zone: string, y: number, mo: number, d: number, h: number, mi: number) =>
  DateTime.fromObject({ year: y, month: mo, day: d, hour: h, minute: mi }, { zone }).toMillis();

// arrival 06:00; wake = 06:00 − (15+60)m − 45m = 04:00 (same day).
const base = (zone: string, d: number): Schedule => ({
  arrival: at(zone, 2026, 1, d, 6, 0),
  zone,
  contingency: 15,
  travel: 60,
  prep: 45,
  sleep: 480,
});

const wakeLocal = (s: Schedule) =>
  DateTime.fromMillis(reverseCalc(s).wake, { zone: s.zone }).toFormat('HH:mm');
const arrivalLocal = (s: Schedule) =>
  DateTime.fromMillis(s.arrival, { zone: s.zone });

test('a schedule whose wake is still in the future is returned unchanged (identity)', () => {
  const s = base('UTC', 6);
  const now = at('UTC', 2026, 1, 6, 3, 0); // before wake 04:00
  expect(rollScheduleToFuture(s, now)).toBe(s);
});

test('a wake that has just passed rolls the whole chain to the next day', () => {
  const s = base('UTC', 6);
  const now = at('UTC', 2026, 1, 6, 5, 0); // after wake 04:00 day 6
  const rolled = rollScheduleToFuture(s, now);
  expect(arrivalLocal(rolled).day).toBe(7); // arrival advanced one day
  expect(arrivalLocal(rolled).toFormat('HH:mm')).toBe('06:00'); // wall-clock preserved
  expect(reverseCalc(rolled).wake).toBeGreaterThan(now);
});

test('wake exactly == now still rolls forward (strictly future)', () => {
  const s = base('UTC', 6);
  const now = reverseCalc(s).wake; // exactly the wake instant
  const rolled = rollScheduleToFuture(s, now);
  expect(reverseCalc(rolled).wake).toBeGreaterThan(now);
  expect(arrivalLocal(rolled).day).toBe(7);
});

test('a wake several days in the past advances by as many whole days as needed', () => {
  const s = base('UTC', 6);
  const now = at('UTC', 2026, 1, 9, 12, 0); // 3+ days after wake 04:00 day 6
  const rolled = rollScheduleToFuture(s, now);
  expect(reverseCalc(rolled).wake).toBeGreaterThan(now);
  expect(arrivalLocal(rolled).toFormat('HH:mm')).toBe('06:00');
  // next 06:00 arrival whose 04:00 wake is after day-9 noon → arrival day 10
  expect(arrivalLocal(rolled).day).toBe(10);
});

test('durations are untouched by the roll', () => {
  const s = base('UTC', 6);
  const now = at('UTC', 2026, 1, 6, 5, 0);
  const rolled = rollScheduleToFuture(s, now);
  expect(rolled.contingency).toBe(s.contingency);
  expect(rolled.travel).toBe(s.travel);
  expect(rolled.prep).toBe(s.prep);
  expect(rolled.sleep).toBe(s.sleep);
});

test('rolled arrival stays minute-aligned', () => {
  const s = base('UTC', 6);
  const now = at('UTC', 2026, 1, 6, 5, 0);
  expect(rollScheduleToFuture(s, now).arrival % 60_000).toBe(0);
});

test('an arrival years in the past still lands in the future in a single call (minimal next occurrence)', () => {
  const s = base('UTC', 6); // arrival 2026-01-06 06:00, wake 04:00
  const now = at('UTC', 2029, 5, 20, 12, 0); // ~3.4 years later
  const rolled = rollScheduleToFuture(s, now);
  const wake = reverseCalc(rolled).wake;
  expect(wake).toBeGreaterThan(now); // armable, not capped-in-the-past
  expect(wake).toBeLessThanOrEqual(now + 25 * 60 * 60 * 1000); // the *next* occurrence, not far beyond
  expect(arrivalLocal(rolled).toFormat('HH:mm')).toBe('06:00'); // wall-clock preserved
});

test('rolling across a spring-forward day preserves the wall-clock arrival time', () => {
  // US Eastern spring-forward is 2026-03-08 (02:00 -> 03:00). Arrival 12:00 on
  // 03-07; wake 11:00 same day. now is just after wake → roll to 03-08 12:00.
  const zone = 'America/New_York';
  const s: Schedule = {
    arrival: at(zone, 2026, 3, 7, 12, 0),
    zone,
    contingency: 15,
    travel: 30,
    prep: 15, // wake = 12:00 − 60m = 11:00
    sleep: 480,
  };
  const now = at(zone, 2026, 3, 7, 11, 30); // after wake 11:00
  const rolled = rollScheduleToFuture(s, now);
  const local = arrivalLocal(rolled);
  expect(local.day).toBe(8);
  expect(local.toFormat('HH:mm')).toBe('12:00'); // same wall-clock despite the 23h day
  expect(wakeLocal(rolled)).toBe('11:00');
});
