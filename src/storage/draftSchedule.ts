import AsyncStorage from '@react-native-async-storage/async-storage';

import { BOUNDS } from '../domain';
import { Durations, SEED_DEFAULTS } from './presets';

/**
 * The whole in-progress (editable) schedule — arrival anchor + captured zone +
 * the four durations. Persisted on every change and restored on launch so
 * nothing resets when the app is closed and reopened. Distinct from the *armed*
 * snapshot (armedSchedule.ts), which only exists once an alarm is set.
 */
export type DraftSchedule = {
  arrival: number | null; // epoch ms, or null before an arrival is entered
  zone: string;
  contingency: number;
  travel: number;
  prep: number;
  sleep: number;
};

const DRAFT_KEY = 'schedularm.draft.v1';
const FIELDS: (keyof Durations)[] = ['contingency', 'travel', 'prep', 'sleep'];

/** Clamp a stored duration into BOUNDS; non-finite → the seed default for that field. */
function sanitizeDuration(field: keyof Durations, value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return SEED_DEFAULTS[field];
  const [min, max] = BOUNDS[field];
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** A stored arrival is only trusted if it's a finite, strictly-positive instant. */
function sanitizeArrival(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function loadDraft(): Promise<DraftSchedule | null> {
  const raw = await AsyncStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    return {
      arrival: sanitizeArrival(parsed.arrival),
      zone: typeof parsed.zone === 'string' && parsed.zone ? parsed.zone : 'UTC',
      ...FIELDS.reduce((acc, f) => {
        acc[f] = sanitizeDuration(f, parsed[f]);
        return acc;
      }, {} as Durations),
    };
  } catch {
    return null;
  }
}

export async function saveDraft(draft: DraftSchedule): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY);
}
