import { MINUTE_MS, Schedule } from '../schedule';

test('MINUTE_MS is 60000', () => {
  expect(MINUTE_MS).toBe(60_000);
});

test('a Schedule holds arrival instant + 4 durations + zone', () => {
  const s: Schedule = { arrival: 0, zone: 'UTC', contingency: 15, travel: 70, prep: 50, sleep: 480 };
  expect(s.contingency + s.travel + s.prep + s.sleep).toBe(615);
});
