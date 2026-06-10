import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPresets, savePresets, SEED_DEFAULTS } from '../presets';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('loadPresets returns seed defaults when nothing is stored', async () => {
  expect(await loadPresets()).toEqual(SEED_DEFAULTS);
});

test('savePresets then loadPresets round-trips', async () => {
  const next = { contingency: 20, travel: 90, prep: 30, sleep: 450 };
  await savePresets(next);
  expect(await loadPresets()).toEqual(next);
});

test('an out-of-range stored value is clamped to BOUNDS on load', async () => {
  await AsyncStorage.setItem(
    'schedularm.presets.v1',
    JSON.stringify({ contingency: 15, travel: 60, prep: 45, sleep: 99999 }),
  );
  expect((await loadPresets()).sleep).toBe(960); // BOUNDS.sleep[1]
});

test('a corrupt stored payload falls back to seed defaults', async () => {
  await AsyncStorage.setItem('schedularm.presets.v1', '{not json');
  expect(await loadPresets()).toEqual(SEED_DEFAULTS);
});

test('a missing/NaN field falls back to its seed default', async () => {
  await AsyncStorage.setItem(
    'schedularm.presets.v1',
    JSON.stringify({ contingency: 25, travel: 'oops' }),
  );
  const p = await loadPresets();
  expect(p.contingency).toBe(25);
  expect(p.travel).toBe(SEED_DEFAULTS.travel);
  expect(p.prep).toBe(SEED_DEFAULTS.prep);
});
