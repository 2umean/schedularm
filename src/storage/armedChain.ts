import AsyncStorage from '@react-native-async-storage/async-storage';

import { Chain } from '../domain';
import { sanitizeArrival, sanitizePills, sanitizeZone } from './chainSanitize';

/**
 * The *armed* v2 chain snapshot — only exists once an alarm is set. Distinct
 * from the editable draft (draftChain.ts). Uses the SAME boundary sanitizers as
 * draftChain so the arm-restore path (computeChain reads .pills via
 * primaryEventInstant) can never see a malformed element.
 */
const ARMED_KEY = 'schedularm.armed.v2';

export async function saveArmedChain(chain: Chain): Promise<void> {
  await AsyncStorage.setItem(ARMED_KEY, JSON.stringify(chain));
}

export async function loadArmedChain(): Promise<Chain | null> {
  const raw = await AsyncStorage.getItem(ARMED_KEY);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as unknown;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
    const obj = c as Record<string, unknown>;
    return {
      arrival: sanitizeArrival(obj.arrival),
      zone: sanitizeZone(obj.zone),
      pills: sanitizePills(obj.pills),
    };
  } catch {
    return null;
  }
}

export async function clearArmedChain(): Promise<void> {
  await AsyncStorage.removeItem(ARMED_KEY);
}
