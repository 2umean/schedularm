import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveArmed, loadArmed, clearArmed } from '../armedSchedule';
import { Schedule } from '../../domain';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const sample: Schedule = {
  arrival: 1_800_000_000_000,
  zone: 'Asia/Seoul',
  contingency: 15,
  travel: 60,
  prep: 45,
  sleep: 480,
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('loadArmed returns null when nothing is armed', async () => {
  expect(await loadArmed()).toBeNull();
});

test('saveArmed then loadArmed round-trips the Schedule', async () => {
  await saveArmed(sample);
  expect(await loadArmed()).toEqual(sample);
});

test('clearArmed removes the armed schedule', async () => {
  await saveArmed(sample);
  await clearArmed();
  expect(await loadArmed()).toBeNull();
});

test('a corrupt armed payload loads as null (never throws)', async () => {
  await AsyncStorage.setItem('schedularm.armed.v1', '{broken');
  expect(await loadArmed()).toBeNull();
});
