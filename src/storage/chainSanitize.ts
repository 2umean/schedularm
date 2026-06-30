import { IANAZone } from 'luxon';

import { Pill, PILL_TYPES, PillType } from '../domain';

/**
 * Shared boundary sanitizers for persisted chains. Used by BOTH draftChain and
 * armedChain so the two storage paths can't drift (the armed-restore path reads
 * .pills straight into computeChain, so a malformed element must be dropped here
 * rather than reaching the engine as NaN/undefined).
 */

/** A stored arrival is only trusted if it's a finite, strictly-positive instant. */
export function sanitizeArrival(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** A stored zone is only trusted if it's a real IANA zone; anything else → UTC. */
export function sanitizeZone(value: unknown): string {
  return typeof value === 'string' && IANAZone.isValidZone(value) ? value : 'UTC';
}

function sanitizeType(value: unknown): PillType {
  return PILL_TYPES.includes(value as PillType) ? (value as PillType) : 'none';
}

/**
 * Round a stored duration to whole minutes; non-finite → 0. Deliberately does
 * NOT clamp into range — the reducer stores durations verbatim and validation is
 * the gate, so an out-of-range value survives a reload and keeps failing
 * validation rather than being silently rewritten (store-verbatim contract).
 */
function sanitizeDur(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Coerce one stored entry into a valid Pill, or null if it isn't a plain object. */
export function sanitizePill(value: unknown, index: number): Pill | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return {
    id: typeof v.id === 'string' && v.id ? v.id : `pill-${index}`,
    icon: typeof v.icon === 'string' ? v.icon : '',
    name: typeof v.name === 'string' ? v.name : '',
    dur: sanitizeDur(v.dur),
    type: sanitizeType(v.type),
  };
}

/** Coerce a stored pills value into a clean Pill[] (non-array → empty; junk entries dropped). */
export function sanitizePills(value: unknown): Pill[] {
  return (Array.isArray(value) ? value : [])
    .map(sanitizePill)
    .filter((p): p is Pill => p !== null);
}
