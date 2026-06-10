import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schedule } from '../domain';

const ARMED_KEY = 'schedularm.armed.v1';

export async function saveArmed(schedule: Schedule): Promise<void> {
  await AsyncStorage.setItem(ARMED_KEY, JSON.stringify(schedule));
}

export async function loadArmed(): Promise<Schedule | null> {
  const raw = await AsyncStorage.getItem(ARMED_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Schedule;
  } catch {
    return null;
  }
}

export async function clearArmed(): Promise<void> {
  await AsyncStorage.removeItem(ARMED_KEY);
}
