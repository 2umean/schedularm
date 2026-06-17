import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearDraft, loadDraft, saveDraft, DraftSchedule } from '../draftSchedule';
import { SEED_DEFAULTS } from '../presets';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const sample: DraftSchedule = {
  arrival: 1_900_000_000_000, // a finite, positive instant
  zone: 'Asia/Seoul',
  contingency: 20,
  travel: 90,
  prep: 30,
  sleep: 450,
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('loadDraft returns null when nothing is stored', async () => {
  expect(await loadDraft()).toBeNull();
});

test('saveDraft then loadDraft round-trips', async () => {
  await saveDraft(sample);
  expect(await loadDraft()).toEqual(sample);
});

test('a null arrival round-trips (durations-only draft)', async () => {
  const noArrival = { ...sample, arrival: null };
  await saveDraft(noArrival);
  expect((await loadDraft())?.arrival).toBeNull();
});

test('clearDraft removes the stored draft', async () => {
  await saveDraft(sample);
  await clearDraft();
  expect(await loadDraft()).toBeNull();
});

test('an out-of-range stored duration is clamped to BOUNDS on load', async () => {
  await AsyncStorage.setItem(
    'schedularm.draft.v1',
    JSON.stringify({ ...sample, sleep: 99999 }),
  );
  expect((await loadDraft())?.sleep).toBe(960); // BOUNDS.sleep[1]
});

test('a missing/NaN duration falls back to its seed default', async () => {
  await AsyncStorage.setItem(
    'schedularm.draft.v1',
    JSON.stringify({ arrival: sample.arrival, zone: 'UTC', contingency: 25, travel: 'oops' }),
  );
  const d = await loadDraft();
  expect(d?.contingency).toBe(25);
  expect(d?.travel).toBe(SEED_DEFAULTS.travel);
  expect(d?.prep).toBe(SEED_DEFAULTS.prep);
});

test('a non-positive or non-finite arrival is rejected to null', async () => {
  await AsyncStorage.setItem('schedularm.draft.v1', JSON.stringify({ ...sample, arrival: 0 }));
  expect((await loadDraft())?.arrival).toBeNull();

  await AsyncStorage.setItem('schedularm.draft.v1', JSON.stringify({ ...sample, arrival: 'nope' }));
  expect((await loadDraft())?.arrival).toBeNull();
});

test('a missing zone falls back to UTC', async () => {
  await AsyncStorage.setItem(
    'schedularm.draft.v1',
    JSON.stringify({ arrival: sample.arrival, contingency: 15, travel: 60, prep: 45, sleep: 480 }),
  );
  expect((await loadDraft())?.zone).toBe('UTC');
});

test('a corrupt stored payload falls back to null', async () => {
  await AsyncStorage.setItem('schedularm.draft.v1', '{not json');
  expect(await loadDraft()).toBeNull();
});
