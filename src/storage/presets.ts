import AsyncStorage from '@react-native-async-storage/async-storage';
import { BOUNDS } from '../domain';

export type Durations = {
  contingency: number;
  travel: number;
  prep: number;
  sleep: number;
};

/** First-run seed values (spec §10). Each is within BOUNDS. */
export const SEED_DEFAULTS: Durations = {
  contingency: 15,
  travel: 60,
  prep: 45,
  sleep: 480,
};

const PRESETS_KEY = 'schedularm.presets.v1';
const FIELDS: (keyof Durations)[] = ['contingency', 'travel', 'prep', 'sleep'];

/** Clamp a stored value into BOUNDS; non-finite → the seed default for that field. */
function sanitize(field: keyof Durations, value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return SEED_DEFAULTS[field];
  const [min, max] = BOUNDS[field];
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function loadPresets(): Promise<Durations> {
  const raw = await AsyncStorage.getItem(PRESETS_KEY);
  if (!raw) return { ...SEED_DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof Durations, unknown>>;
    return FIELDS.reduce((acc, f) => {
      acc[f] = sanitize(f, parsed[f]);
      return acc;
    }, {} as Durations);
  } catch {
    return { ...SEED_DEFAULTS };
  }
}

export async function savePresets(durations: Durations): Promise<void> {
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(durations));
}
