import { en } from '../en';
import { ko } from '../ko';

/** Flatten nested catalog into dotted key paths. */
const keysOf = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? keysOf(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

const valueAt = (obj: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], obj);

test('ko and en catalogs have identical key sets', () => {
  expect(keysOf(ko).sort()).toEqual(keysOf(en).sort());
});

test('every catalog value is a non-empty string (day.other excepted)', () => {
  for (const catalog of [en, ko]) {
    for (const key of keysOf(catalog)) {
      const v = valueAt(catalog, key);
      expect(typeof v).toBe('string');
      if (key !== 'day.other') expect((v as string).length).toBeGreaterThan(0);
    }
  }
});

test('parameterized keys carry the same placeholders in both locales', () => {
  const params = (s: string) => (s.match(/{{\w+}}/g) ?? []).sort();
  for (const key of keysOf(en)) {
    expect(params(valueAt(ko, key) as string)).toEqual(params(valueAt(en, key) as string));
  }
});
