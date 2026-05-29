import { DateTime } from 'luxon';
import { editWake, editLeaveHome, editFallAsleep, editArrival } from '../editResolver';
import { reverseCalc } from '../engine';
import { Schedule } from '../schedule';

const at = (h: number, m: number) =>
  DateTime.fromObject({ year: 2026, month: 1, day: 6, hour: h, minute: m }, { zone: 'UTC' }).toMillis();
const base: Schedule = { arrival: at(6, 0), zone: 'UTC', contingency: 15, travel: 70, prep: 50, sleep: 480 };
const hhmm = (ms: number) => DateTime.fromMillis(ms, { zone: 'UTC' }).toFormat('HH:mm');

test('editing Wake adjusts Prep; Arrival/Leave-home unchanged; Fall-asleep shifts by same delta', () => {
  const r = editWake(base, at(3, 25)); // 20 min earlier than 03:45
  expect(r.feasible).toBe(true);
  expect(r.schedule.prep).toBe(70);    // 50 + 20
  expect(r.schedule.arrival).toBe(base.arrival);
  const d = reverseCalc(r.schedule);
  expect(hhmm(d.leaveHome)).toBe('04:35');
  expect(hhmm(d.fallAsleep)).toBe('19:25'); // also 20 min earlier
});

test('editing Leave-home adjusts Travel, holds Contingency fixed, cascades lower times', () => {
  const r = editLeaveHome(base, at(4, 50)); // 15 min later than 04:35
  expect(r.feasible).toBe(true);
  expect(r.schedule.contingency).toBe(15); // fixed
  expect(r.schedule.travel).toBe(55);      // 70 - 15
  const d = reverseCalc(r.schedule);
  expect(d.arrival).toBe(base.arrival);     // anchor never moves
  expect(hhmm(d.wake)).toBe('04:00');       // shifted +15
  expect(hhmm(d.fallAsleep)).toBe('20:00'); // shifted +15
});

test('editing Fall-asleep adjusts Sleep', () => {
  // fall-asleep is 19:45 on the PREVIOUS day (day 5); 1h later = 20:45 day 5.
  const newFall = DateTime.fromObject(
    { year: 2026, month: 1, day: 5, hour: 20, minute: 45 }, { zone: 'UTC' },
  ).toMillis();
  const r = editFallAsleep(base, newFall);
  expect(r.feasible).toBe(true);
  expect(r.schedule.sleep).toBe(420); // 480 - 60
});

test('editing Arrival shifts the whole chain; durations unchanged', () => {
  const r = editArrival(base, at(7, 0));
  expect(r.schedule).toMatchObject({ contingency: 15, travel: 70, prep: 50, sleep: 480 });
  const d = reverseCalc(r.schedule);
  expect(hhmm(d.leaveHome)).toBe('05:35');
});

test('an edit that drives a duration negative is accepted but flagged infeasible', () => {
  const r = editWake(base, at(5, 0)); // wake after leave-home(04:35) => prep negative
  expect(r.feasible).toBe(false);
  expect(r.violation).toBe('negative-duration');
});
