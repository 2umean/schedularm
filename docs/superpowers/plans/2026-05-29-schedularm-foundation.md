# schedularm — Plan 1: Foundation (Scaffold + M0 Spike + Domain Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Expo/TypeScript project, prove a wake-up alarm actually rings on real Android hardware (the go/no-go gate), and build the fully-tested pure-TypeScript reverse-calculation domain engine.

**Architecture:** A single React Native + Expo (dev build / CNG) app in TypeScript. This plan delivers three independent, testable pieces: (A) a runnable scaffold with Jest, (B) a throwaway M0 spike that validates the native alarm path on a device, and (C) the `src/domain` engine — pure functions with no React/native dependencies, modeling canonical state as `arrival instant + 4 durations` and deriving the other times with DST-aware instant math.

**Tech Stack:** Expo SDK (current), React Native, TypeScript, Jest + ts-jest, Luxon (DST-correct date math). Native alarm libraries/modules are explored in M0, not committed here.

**Source spec:** `docs/superpowers/specs/2026-05-29-reverse-alarm-design.md`. **Deployment reference:** `docs/deployment.md`.

**Scope note:** This is Plan 1 of 4. Plans 2 (AlarmService + ChainScreen UI / M1), 3 (safety & health / M3), and 4 (leave-home notification, bedtime nudge, capped snooze, presets, i18n, a11y / M4) are written **after** the M0 gate passes, because their native approach depends on M0's outcome.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `app.config.ts`, `tsconfig.json`, `eas.json` | Expo project config, IDs, permissions, build profiles |
| `jest.config.js`, `babel.config.js` | Test + transform config |
| `src/domain/schedule.ts` | Canonical `Schedule` type, `DerivedSchedule`, `Minutes`, `MINUTE_MS` |
| `src/domain/datetime.ts` | Luxon wrapper: arrival instant resolution (DST-aware), local-clock formatting, relative-day label |
| `src/domain/engine.ts` | `reverseCalc()` — pure epoch math, derives the 3 times |
| `src/domain/editResolver.ts` | Arrival-protected edits: solve for the correct duration; feasibility outcome |
| `src/domain/validation.ts` | Duration bounds, infeasible / past-wake / sleep-debt checks |
| `src/domain/index.ts` | Barrel re-export of the domain API |
| `src/domain/__tests__/*.test.ts` | Jest tests per module |
| `spike/` (throwaway) | M0 hardcoded-alarm proof; deleted after the gate |

---

## Phase A — Project scaffolding

### Task A1: Initialize the Expo TypeScript project into the existing repo

**Files:**
- Create: `package.json`, `app.json`/`app.config.ts`, `tsconfig.json`, `App.tsx` (and `babel.config.js` only if the template emits one — recent Expo SDK blank-typescript templates often omit it; don't worry if it's absent)

The repo already contains `docs/`, `.gitignore`, and `.git`, so scaffold into a temp dir and merge (create-expo-app refuses a non-empty dir).

- [ ] **Step 1: Scaffold in a temp directory**

Run:
```bash
cd /Users/umean/Documents/dev/agent
npx create-expo-app@latest schedularm-tmp --template blank-typescript
```
Expected: a new `schedularm-tmp/` with a blank Expo TS app.

- [ ] **Step 2: Merge generated files into the repo (preserve docs/ and .git)**

Run:
```bash
cd /Users/umean/Documents/dev/agent
rsync -a --exclude='.git' --exclude='.gitignore' --exclude='docs' schedularm-tmp/ schedularm/
rm -rf schedularm-tmp
```
Expected: `schedularm/` now has `package.json`, `App.tsx`, `tsconfig.json`, etc., with `docs/` and git history intact.

- [ ] **Step 3: Verify it runs**

Run: `cd /Users/umean/Documents/dev/agent/schedularm && npx expo start` (then `q` to quit after it boots).
Expected: Metro starts with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo TypeScript app"
```

### Task A2: Configure app identity and alarm permissions in app.config.ts

**Files:**
- Create/Modify: `app.config.ts` (replace generated `app.json`)

- [ ] **Step 1: Replace app.json with app.config.ts**

Create `app.config.ts`:
```ts
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'schedularm',
  slug: 'schedularm',
  scheme: 'schedularm',
  version: '0.1.0',
  orientation: 'portrait',
  ios: {
    bundleIdentifier: 'com.umean.schedularm',
    deploymentTarget: '26.0',
    infoPlist: {
      NSAlarmKitUsageDescription:
        'schedularm sets alarms so airline crew reliably wake up and leave on time for their duties.',
    },
  },
  android: {
    package: 'com.umean.schedularm',
    permissions: [
      'USE_EXACT_ALARM',
      'USE_FULL_SCREEN_INTENT',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_SPECIAL_USE',
      'RECEIVE_BOOT_COMPLETED',
      'POST_NOTIFICATIONS',
      'WAKE_LOCK',
      'VIBRATE',
    ],
  },
};

export default config;
```
Then delete `app.json`.

> NOTE: Do NOT add any `com.apple.developer.alarmkit` entitlement — it does not exist and will break the iOS build (see `docs/deployment.md`). AlarmKit needs only the Info.plist string above.
>
> NOTE: Declaring `FOREGROUND_SERVICE_SPECIAL_USE` here only adds the *permission*. The matching `<service android:foregroundServiceType="specialUse">` and its `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` `<property>` live on the actual service and are injected by the **Task B3 config plugin** (they can't be hand-edited under CNG) — so this task is intentionally not "complete" on the Android service side yet.

- [ ] **Step 2: Verify config resolves**

Run: `npx expo config --type public`
Expected: JSON output showing `ios.bundleIdentifier` and the Android permissions.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: configure app identity and alarm permissions"
```

### Task A3: Set up Jest for pure-TypeScript domain tests

**Files:**
- Create: `jest.config.js`
- Modify: `package.json` (add scripts + devDeps)

- [ ] **Step 1: Install test + date deps**

Run:
```bash
npx expo install luxon
# Pin jest + ts-jest to a known-compatible pair so the setup is reproducible
# (a bare `npm i -D jest` can pull Jest 30 with different defaults than ts-jest expects).
npm install --save-dev jest@^29 ts-jest@^29 @types/jest @types/luxon
```

- [ ] **Step 2: Create jest.config.js**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
};
```

- [ ] **Step 3: Add the test script to package.json**

In `package.json` `"scripts"`, add: `"test": "jest"`.

- [ ] **Step 4: Add a smoke test**

Create `src/domain/__tests__/smoke.test.ts`:
```ts
test('jest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: set up jest for domain tests"
```

---

## Phase B — M0 alarm spike (GO/NO-GO GATE)

> The spike is **throwaway** (lives in `spike/`, deleted after the gate). Its only job: prove a wake-up alarm reliably rings on a **real Android phone**. iOS is deferred (needs the paid account + an iOS 26 device); Android is free to test today. The spike is exploratory, so steps are concrete actions rather than TDD.

### Task B1: Create a development build installable on your Android phone

**Files:**
- Modify: `eas.json` (build profiles)

- [ ] **Step 1: Install EAS CLI and log in**

Run: `npm install -g eas-cli && eas login`

- [ ] **Step 2: Initialize EAS**

Run: `eas init` (accept creating the project; writes `extra.eas.projectId` into config).

- [ ] **Step 3: Create eas.json with three profiles**

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "android": { "buildType": "apk" } },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": {}
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 4: Build a dev client APK in the cloud**

Run: `eas build --profile development --platform android`
Expected: a build URL; when done, a downloadable `.apk`.

- [ ] **Step 5: Install on your phone and run the JS server**

Install the APK (open the EAS link on the phone, allow "install unknown apps"). Then run `npx expo start --dev-client`, scan the QR.
Expected: the blank app opens on your phone via the dev client.

- [ ] **Step 6: Commit the eas.json**

```bash
git add eas.json && git commit -m "chore: add eas build profiles"
```

### Task B2: Spike — try a candidate alarm library first

**Files:**
- Create: `spike/AlarmSpike.tsx` (temporary screen wired into `App.tsx`)

- [ ] **Step 1: Add a candidate library**

Pick ONE maintained RN full-screen-alarm / Notifee-style library after checking its npm last-publish date and open-issue health (the spec's research pointed at the `react-native-notify-kit` Notifee fork as a starting candidate — confirm it's still the best maintained option). **Record the chosen package + exact version in `spike/RESULTS.md`** so the M0 verdict that drives Plan 2 captures the selection. Install per its docs.

- [ ] **Step 2: Schedule a hardcoded alarm ~2 minutes out**

Create `spike/AlarmSpike.tsx` with a single button that schedules a full-screen, looping, must-dismiss alarm 2 minutes in the future using the library's API (alarm/`USAGE_ALARM` sound, full-screen intent). Wire it as the root of `App.tsx`.

- [ ] **Step 3: Run the device test matrix**

Trigger the alarm, then for EACH condition confirm it rings loudly, shows over the lock screen, and must be dismissed:
- screen locked
- app swiped away (killed)
- device idle long enough to enter Doze
- ringer in silent / Do-Not-Disturb
- after a device reboot (re-arm on `BOOT_COMPLETED`)

Record pass/fail per condition in `spike/RESULTS.md`.

### Task B3: If the library fails any condition — prototype the bespoke native path

**Files:**
- Create: `modules/native-alarm/` (Expo local module) + `plugins/withNativeAlarm.ts` (config plugin)

- [ ] **Step 1: Generate a local Expo module**

Run: `npx create-expo-module@latest --local native-alarm`

- [ ] **Step 2: Implement the minimal Android ring path (Kotlin)**

In the module: schedule with `AlarmManager.setAlarmClock`; on fire, post a high-importance full-screen-intent notification launching a `showWhenLocked`/`turnScreenOn` Activity that starts a `specialUse` foreground service looping the `USAGE_ALARM` ringtone + vibration + wake lock until dismissed. Add a `BOOT_COMPLETED` receiver that re-arms from a stored time.

- [ ] **Step 3: Add the config plugin for the manifest pieces**

Create `plugins/withNativeAlarm.ts` injecting the `<activity>`, `<service android:foregroundServiceType="specialUse">` + `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` `<property>`, and the boot receiver (these cannot be hand-edited under CNG). Reference it from `app.config.ts` `plugins`.

- [ ] **Step 4: Rebuild the dev client and re-run the Task B2 device matrix**

Run: `eas build --profile development --platform android`, reinstall, retest all five conditions. Record results in `spike/RESULTS.md`.

### Task B4: Record the go/no-go decision

- [ ] **Step 1: Write the verdict**

In `spike/RESULTS.md`, state: which approach rang reliably across all five conditions (library vs bespoke module), any conditions that failed and why, and the decision: **GO** (alarm path proven — proceed to Plan 2) or **NO-GO** (revisit the stack/approach). This verdict drives the AlarmService implementation in Plan 2.

- [ ] **Step 2: Commit the spike + results**

```bash
git add spike modules plugins eas.json app.config.ts
git commit -m "spike: M0 alarm reliability proof on Android"
```

> Keep `spike/` until Plan 2 ports the proven approach behind `AlarmService`, then delete it.

---

## Phase C — Domain engine (pure TypeScript, full TDD)

> No React, no native, no hardware. Fully testable now and independent of the M0 outcome.

### Task C1: Canonical Schedule types and constants

**Files:**
- Create: `src/domain/schedule.ts`
- Test: `src/domain/__tests__/schedule.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { MINUTE_MS, Schedule } from '../schedule';

test('MINUTE_MS is 60000', () => {
  expect(MINUTE_MS).toBe(60_000);
});

test('a Schedule holds arrival instant + 4 durations + zone', () => {
  const s: Schedule = { arrival: 0, zone: 'UTC', contingency: 15, travel: 70, prep: 50, sleep: 480 };
  expect(s.contingency + s.travel + s.prep + s.sleep).toBe(615);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- schedule`
Expected: FAIL (cannot find module `../schedule`).

- [ ] **Step 3: Implement schedule.ts**

```ts
export const MINUTE_MS = 60_000;

/** A duration in whole minutes, >= 0. */
export type Minutes = number;

/** Canonical state — the ONLY source of truth. The 3 derived times are pure functions of this. */
export type Schedule = {
  arrival: number; // absolute instant, epoch ms, seconds/millis zeroed
  zone: string;    // IANA zone captured at entry, e.g. "Asia/Seoul"
  contingency: Minutes;
  travel: Minutes;
  prep: Minutes;
  sleep: Minutes;
};

export type DerivedSchedule = {
  arrival: number;
  leaveHome: number;
  wake: number;
  fallAsleep: number;
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- schedule`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/schedule.ts src/domain/__tests__/schedule.test.ts
git commit -m "feat(domain): canonical Schedule types"
```

### Task C2: reverseCalc — derive the three times

**Files:**
- Create: `src/domain/engine.ts`
- Test: `src/domain/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test (incl. midnight crossing)**

```ts
import { DateTime } from 'luxon';
import { reverseCalc } from '../engine';
import { Schedule } from '../schedule';

const arrivalUtc = (h: number, m: number) =>
  DateTime.fromObject({ year: 2026, month: 1, day: 6, hour: h, minute: m }, { zone: 'UTC' }).toMillis();

test('reverseCalc derives leaveHome/wake/fallAsleep by subtracting durations', () => {
  const s: Schedule = { arrival: arrivalUtc(6, 0), zone: 'UTC', contingency: 15, travel: 70, prep: 50, sleep: 480 };
  const d = reverseCalc(s);
  const hhmm = (ms: number) => DateTime.fromMillis(ms, { zone: 'UTC' }).toFormat('HH:mm');
  expect(hhmm(d.leaveHome)).toBe('04:35');
  expect(hhmm(d.wake)).toBe('03:45');
  expect(hhmm(d.fallAsleep)).toBe('19:45'); // previous day
});

test('fallAsleep lands on the previous calendar day for an early report', () => {
  const s: Schedule = { arrival: arrivalUtc(6, 0), zone: 'UTC', contingency: 15, travel: 70, prep: 50, sleep: 480 };
  const d = reverseCalc(s);
  expect(DateTime.fromMillis(d.fallAsleep, { zone: 'UTC' }).day).toBe(5);
});

test('an N-minute gap is preserved as REAL elapsed time across a DST spring-forward', () => {
  // US Eastern springs forward 2026-03-08 02:00 -> 03:00. Arrival 04:00 local that day;
  // a 9h sleep chain (contingency+travel+prep+sleep) crosses the gap.
  const arrival = DateTime.fromObject(
    { year: 2026, month: 3, day: 8, hour: 4, minute: 0 },
    { zone: 'America/New_York' },
  ).toMillis();
  const s: Schedule = { arrival, zone: 'America/New_York', contingency: 0, travel: 0, prep: 0, sleep: 540 };
  const d = reverseCalc(s);
  // (a) elapsed REAL time is exactly 540 minutes (epoch math is DST-agnostic)
  expect((arrival - d.fallAsleep) / MINUTE_MS).toBe(540);
  // (b) the LOCAL clock face lands at 18:00 the previous day. A naive clock-face
  //     subtraction (04:00 − 9h) would wrongly give 19:00; 18:00 proves the skipped
  //     DST hour was absorbed as real elapsed time.
  const fa = DateTime.fromMillis(d.fallAsleep, { zone: 'America/New_York' });
  expect(fa.toFormat('HH:mm')).toBe('18:00');
  expect(fa.day).toBe(7);
});
```

> Add `import { MINUTE_MS } from '../schedule';` to the test imports for this case.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- engine`
Expected: FAIL (cannot find module `../engine`).

- [ ] **Step 3: Implement engine.ts**

```ts
import { MINUTE_MS, Schedule, DerivedSchedule } from './schedule';

/** Pure epoch-ms subtraction — elapsed real time, so gaps are DST-safe by construction. */
export function reverseCalc(s: Schedule): DerivedSchedule {
  const leaveHome = s.arrival - (s.contingency + s.travel) * MINUTE_MS;
  const wake = leaveHome - s.prep * MINUTE_MS;
  const fallAsleep = wake - s.sleep * MINUTE_MS;
  return { arrival: s.arrival, leaveHome, wake, fallAsleep };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- engine`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/engine.ts src/domain/__tests__/engine.test.ts
git commit -m "feat(domain): reverseCalc derivation"
```

### Task C3: datetime — arrival resolution (DST-aware) + formatting

**Files:**
- Create: `src/domain/datetime.ts`
- Test: `src/domain/__tests__/datetime.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { DateTime } from 'luxon';
import { resolveArrivalInstant, toLocalClock, relativeDayLabel } from '../datetime';

const nowAt = (zone: string, y: number, mo: number, d: number, h: number, mi: number) =>
  DateTime.fromObject({ year: y, month: mo, day: d, hour: h, minute: mi }, { zone }).toMillis();

test('a future clock time today resolves to today', () => {
  const now = nowAt('UTC', 2026, 1, 6, 5, 0);
  const ms = resolveArrivalInstant(6, 0, 'UTC', now);
  expect(DateTime.fromMillis(ms, { zone: 'UTC' }).toFormat('yyyy-MM-dd HH:mm')).toBe('2026-01-06 06:00');
});

test('a clock time already past today resolves to tomorrow', () => {
  const now = nowAt('UTC', 2026, 1, 6, 7, 0);
  const ms = resolveArrivalInstant(6, 0, 'UTC', now);
  expect(DateTime.fromMillis(ms, { zone: 'UTC' }).day).toBe(7);
});

test('exactly-now resolves to tomorrow (strictly future)', () => {
  const now = nowAt('UTC', 2026, 1, 6, 6, 0);
  const ms = resolveArrivalInstant(6, 0, 'UTC', now);
  expect(DateTime.fromMillis(ms, { zone: 'UTC' }).day).toBe(7);
});

test('arrival is minute-aligned (seconds/millis zeroed)', () => {
  const now = nowAt('UTC', 2026, 1, 6, 5, 0);
  const ms = resolveArrivalInstant(6, 0, 'UTC', now);
  expect(ms % 60_000).toBe(0);
});

test('a spring-forward nonexistent local time shifts forward', () => {
  // US Eastern 2026-03-08 02:30 does not exist (clocks jump 02:00 -> 03:00)
  const now = nowAt('America/New_York', 2026, 3, 7, 12, 0);
  const ms = resolveArrivalInstant(2, 30, 'America/New_York', now, { year: 2026, month: 3, day: 8 });
  const local = DateTime.fromMillis(ms, { zone: 'America/New_York' });
  expect(local.hour).toBe(3); // bumped past the gap
  expect(local.isValid).toBe(true);
});

test('toLocalClock formats HH:mm in zone', () => {
  const ms = nowAt('Asia/Seoul', 2026, 1, 6, 3, 45);
  expect(toLocalClock(ms, 'Asia/Seoul')).toBe('03:45');
});

test('a fall-back ambiguous local time resolves to the EARLIER occurrence', () => {
  // US Eastern 2026-11-01: clocks fall back 02:00 EDT -> 01:00 EST, so 01:30 occurs twice.
  // Spec policy: resolve to the earlier occurrence (EDT, offset -240).
  const now = nowAt('America/New_York', 2026, 10, 31, 12, 0);
  const ms = resolveArrivalInstant(1, 30, 'America/New_York', now, { year: 2026, month: 11, day: 1 });
  expect(DateTime.fromMillis(ms, { zone: 'America/New_York' }).offset).toBe(-240); // EDT, the earlier 01:30
});

test('relativeDayLabel detects previous day', () => {
  const ref = nowAt('UTC', 2026, 1, 6, 6, 0);
  const prev = nowAt('UTC', 2026, 1, 5, 19, 45);
  expect(relativeDayLabel(prev, ref, 'UTC')).toBe('prev-day');
});

test('relativeDayLabel detects same-day and next-day', () => {
  const ref = nowAt('UTC', 2026, 1, 6, 6, 0);
  expect(relativeDayLabel(nowAt('UTC', 2026, 1, 6, 22, 0), ref, 'UTC')).toBe('same-day');
  expect(relativeDayLabel(nowAt('UTC', 2026, 1, 7, 3, 0), ref, 'UTC')).toBe('next-day');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- datetime`
Expected: FAIL (cannot find module `../datetime`).

- [ ] **Step 3: Implement datetime.ts**

```ts
import { DateTime } from 'luxon';

type YMD = { year: number; month: number; day: number };

/**
 * Resolve a wall-clock time in `zone` to the soonest future instant strictly after `nowMs`.
 * With an explicit date, resolves that date. Luxon resolves DST-nonexistent local times
 * forward and ambiguous (fall-back) times to the earlier offset, matching the spec policy.
 */
export function resolveArrivalInstant(
  hour: number,
  minute: number,
  zone: string,
  nowMs: number,
  date?: YMD,
): number {
  const now = DateTime.fromMillis(nowMs, { zone });
  let target = date
    ? DateTime.fromObject({ ...date, hour, minute, second: 0, millisecond: 0 }, { zone })
    : now.set({ hour, minute, second: 0, millisecond: 0 });
  if (!date && target <= now) {
    target = target.plus({ days: 1 });
  }
  return target.toMillis();
}

export function toLocalClock(instantMs: number, zone: string): string {
  return DateTime.fromMillis(instantMs, { zone }).toFormat('HH:mm');
}

export type DayLabel = 'same-day' | 'prev-day' | 'next-day' | 'other';

export function relativeDayLabel(instantMs: number, referenceMs: number, zone: string): DayLabel {
  const a = DateTime.fromMillis(instantMs, { zone }).startOf('day');
  const b = DateTime.fromMillis(referenceMs, { zone }).startOf('day');
  const diff = Math.round(a.diff(b, 'days').days);
  if (diff === 0) return 'same-day';
  if (diff === -1) return 'prev-day';
  if (diff === 1) return 'next-day';
  return 'other';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- datetime`
Expected: PASS, 9 tests. (If the spring-forward/fall-back tests return wrong offsets, your Node build lacks full ICU tz data — Node 13+ official binaries ship full ICU by default, so just upgrade Node rather than installing the deprecated `full-icu` package.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/datetime.ts src/domain/__tests__/datetime.test.ts
git commit -m "feat(domain): DST-aware arrival resolution + formatting"
```

### Task C4: editResolver — arrival-protected edits

**Files:**
- Create: `src/domain/editResolver.ts`
- Test: `src/domain/__tests__/editResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { DateTime } from 'luxon';
import { editWake, editLeaveHome, editFallAsleep, editArrival } from '../editResolver';
import { reverseCalc } from '../engine';
import { Schedule } from '../schedule';

const at = (h: number, m: number) =>
  DateTime.fromObject({ year: 2026, month: 1, day: 6, hour: h, minute: m }, { zone: 'UTC' }).toMillis();
const base: Schedule = { arrival: at(6, 0), zone: 'UTC', contingency: 15, travel: 70, prep: 50, sleep: 480 };
const hhmm = (ms: number) => DateTime.fromMillis(ms, { zone: 'UTC' }).toFormat('HH:mm');

test('editing Wake adjusts Prep; Arrival/Leave-home unchanged; Fall-asleep shifts by same delta', () => {
  const r = editWake(base, at(3, 25)); // 20 min earlier than 03:45
  expect(r.feasible).toBe(true);
  expect(r.schedule.prep).toBe(70);    // 50 + 20
  expect(r.schedule.arrival).toBe(base.arrival);
  const d = reverseCalc(r.schedule);
  expect(hhmm(d.leaveHome)).toBe('04:35');
  expect(hhmm(d.fallAsleep)).toBe('19:25'); // also 20 min earlier
});

test('editing Leave-home adjusts Travel, holds Contingency fixed, cascades lower times', () => {
  const r = editLeaveHome(base, at(4, 50)); // 15 min later than 04:35
  expect(r.feasible).toBe(true);
  expect(r.schedule.contingency).toBe(15); // fixed
  expect(r.schedule.travel).toBe(55);      // 70 - 15
  const d = reverseCalc(r.schedule);
  expect(d.arrival).toBe(base.arrival);     // anchor never moves
  expect(hhmm(d.wake)).toBe('04:00');       // shifted +15
  expect(hhmm(d.fallAsleep)).toBe('20:00'); // shifted +15
});

test('editing Fall-asleep adjusts Sleep', () => {
  // fall-asleep is 19:45 on the PREVIOUS day (day 5); 1h later = 20:45 day 5.
  const newFall = DateTime.fromObject(
    { year: 2026, month: 1, day: 5, hour: 20, minute: 45 }, { zone: 'UTC' },
  ).toMillis();
  const r = editFallAsleep(base, newFall);
  expect(r.feasible).toBe(true);
  expect(r.schedule.sleep).toBe(420); // 480 - 60
});

test('editing Arrival shifts the whole chain; durations unchanged', () => {
  const r = editArrival(base, at(7, 0));
  expect(r.schedule).toMatchObject({ contingency: 15, travel: 70, prep: 50, sleep: 480 });
  const d = reverseCalc(r.schedule);
  expect(hhmm(d.leaveHome)).toBe('05:35');
});

test('an edit that drives a duration negative is accepted but flagged infeasible', () => {
  const r = editWake(base, at(5, 0)); // wake after leave-home(04:35) => prep negative
  expect(r.feasible).toBe(false);
  expect(r.violation).toBe('negative-duration');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- editResolver`
Expected: FAIL (cannot find module `../editResolver`).

- [ ] **Step 3: Implement editResolver.ts**

```ts
import { MINUTE_MS, Schedule } from './schedule';
import { reverseCalc } from './engine';

export type EditOutcome = {
  schedule: Schedule;
  feasible: boolean;
  violation?: 'negative-duration';
};

function finalize(schedule: Schedule): EditOutcome {
  const negative = [schedule.contingency, schedule.travel, schedule.prep, schedule.sleep].some((v) => v < 0);
  return { schedule, feasible: !negative, violation: negative ? 'negative-duration' : undefined };
}

/** Convert an elapsed-ms delta to whole minutes. Math.round guards against a non-minute-aligned
 *  instant from the time picker producing a fractional Minutes value (the Minutes contract is integers). */
const toMinutes = (deltaMs: number): number => Math.round(deltaMs / MINUTE_MS);

/** Wake edit → solve Prep (leaveHome unchanged). */
export function editWake(s: Schedule, newWakeMs: number): EditOutcome {
  const { leaveHome } = reverseCalc(s);
  return finalize({ ...s, prep: toMinutes(leaveHome - newWakeMs) });
}

/** Leave-home edit → solve Travel, holding Contingency fixed. */
export function editLeaveHome(s: Schedule, newLeaveMs: number): EditOutcome {
  return finalize({ ...s, travel: toMinutes(s.arrival - s.contingency * MINUTE_MS - newLeaveMs) });
}

/** Fall-asleep edit → solve Sleep. */
export function editFallAsleep(s: Schedule, newFallMs: number): EditOutcome {
  const { wake } = reverseCalc(s);
  return finalize({ ...s, sleep: toMinutes(wake - newFallMs) });
}

/** Arrival edit → move the anchor; durations unchanged. */
export function editArrival(s: Schedule, newArrivalMs: number): EditOutcome {
  return finalize({ ...s, arrival: newArrivalMs });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- editResolver`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/editResolver.ts src/domain/__tests__/editResolver.test.ts
git commit -m "feat(domain): arrival-protected edit resolver"
```

### Task C5: validation — bounds, infeasible, past-wake, sleep-debt

**Files:**
- Create: `src/domain/validation.ts`
- Test: `src/domain/__tests__/validation.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { DateTime } from 'luxon';
import { validate, isArmable, BOUNDS } from '../validation';
import { Schedule } from '../schedule';

const at = (h: number, m: number, day = 6) =>
  DateTime.fromObject({ year: 2026, month: 1, day, hour: h, minute: m }, { zone: 'UTC' }).toMillis();
const now = at(19, 0, 5); // evening before, BEFORE fall-asleep (19:45 day 5)
const base: Schedule = { arrival: at(6, 0), zone: 'UTC', contingency: 15, travel: 70, prep: 50, sleep: 480 };

test('a valid schedule has no issues', () => {
  expect(validate(base, now)).toEqual([]);
});

test('an out-of-range duration is reported', () => {
  const issues = validate({ ...base, sleep: BOUNDS.sleep[1] + 1 }, now);
  expect(issues).toContainEqual({ kind: 'out-of-range', field: 'sleep' });
});

test('a negative duration is infeasible (blocking)', () => {
  const issues = validate({ ...base, prep: -10 }, now);
  expect(issues).toContainEqual({ kind: 'infeasible' });
});

test('a wake time in the past is blocking', () => {
  const lateNow = at(4, 0); // after wake 03:45
  expect(validate(base, lateNow)).toContainEqual({ kind: 'past-wake' });
});

test('a fall-asleep already passed is a (non-blocking) sleep-debt nudge', () => {
  const lateNow = at(20, 30, 5); // after fallAsleep 19:45 but before wake
  expect(validate(base, lateNow)).toContainEqual({ kind: 'sleep-debt' });
});

test('wake exactly == now is blocking (boundary)', () => {
  const wakeInstant = at(3, 45); // base wake is 03:45 day 6 — exactly now
  expect(validate(base, wakeInstant)).toContainEqual({ kind: 'past-wake' });
});

test('an absurd total chain span is reported even when each duration is in range', () => {
  const huge: Schedule = { ...base, contingency: 360, travel: 720, prep: 360, sleep: 960 }; // 2400 min total
  expect(validate(huge, at(19, 0, 3))).toContainEqual({ kind: 'chain-too-long' });
});

test('isArmable blocks on infeasible/past-wake/out-of-range/chain-too-long, allows sleep-debt', () => {
  expect(isArmable([])).toBe(true);
  expect(isArmable([{ kind: 'sleep-debt' }])).toBe(true);
  expect(isArmable([{ kind: 'infeasible' }])).toBe(false);
  expect(isArmable([{ kind: 'past-wake' }])).toBe(false);
  expect(isArmable([{ kind: 'chain-too-long' }])).toBe(false);
  expect(isArmable([{ kind: 'out-of-range', field: 'sleep' }])).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- validation`
Expected: FAIL (cannot find module `../validation`).

- [ ] **Step 3: Implement validation.ts**

```ts
import { Schedule } from './schedule';
import { reverseCalc } from './engine';

/** [min, max] minutes per duration. */
export const BOUNDS = {
  contingency: [0, 360],
  travel: [0, 720],
  prep: [0, 360],
  sleep: [0, 960],
} as const;

/** Max sane total chain span (arrival → fall-asleep), in minutes. ~26h covers a long sleep + commute + buffers. */
export const MAX_CHAIN_SPAN = 26 * 60;

type DurationField = keyof typeof BOUNDS;

export type ValidationIssue =
  | { kind: 'out-of-range'; field: DurationField }
  | { kind: 'infeasible' }
  | { kind: 'chain-too-long' }
  | { kind: 'past-wake' }
  | { kind: 'sleep-debt' };

export function validate(s: Schedule, nowMs: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  (Object.keys(BOUNDS) as DurationField[]).forEach((f) => {
    const [min, max] = BOUNDS[f];
    if (s[f] < min || s[f] > max) issues.push({ kind: 'out-of-range', field: f });
  });

  if ([s.contingency, s.travel, s.prep, s.sleep].some((v) => v < 0)) {
    issues.push({ kind: 'infeasible' });
  }

  if (s.contingency + s.travel + s.prep + s.sleep > MAX_CHAIN_SPAN) {
    issues.push({ kind: 'chain-too-long' });
  }

  const { wake, fallAsleep } = reverseCalc(s);
  if (wake <= nowMs) issues.push({ kind: 'past-wake' });
  else if (fallAsleep <= nowMs) issues.push({ kind: 'sleep-debt' });

  return issues;
}

/** The safety gate: which issue kinds block arming an alarm. sleep-debt is a nudge, not a blocker. */
const BLOCKING: ReadonlyArray<ValidationIssue['kind']> = [
  'out-of-range',
  'infeasible',
  'chain-too-long',
  'past-wake',
];

/** True when the schedule is safe to arm (no blocking issues). The UI must gate the arm button on this. */
export function isArmable(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => BLOCKING.includes(i.kind));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- validation`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/validation.ts src/domain/__tests__/validation.test.ts
git commit -m "feat(domain): schedule validation"
```

### Task C6: Domain barrel + full suite green

**Files:**
- Create: `src/domain/index.ts`

- [ ] **Step 1: Create the barrel**

```ts
export * from './schedule';
export * from './engine';
export * from './datetime';
export * from './editResolver';
export * from './validation';
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS — all domain tests green (smoke + schedule + engine + datetime + editResolver + validation).

- [ ] **Step 3: Commit**

```bash
git add src/domain/index.ts && git commit -m "feat(domain): public barrel export"
```

---

## Done-when

- `npm test` is green across the domain suite.
- The Expo app boots via `expo start` and a dev-client APK installs on your Android phone.
- `spike/RESULTS.md` records a clear **GO / NO-GO** verdict with the per-condition device matrix and the chosen alarm approach.

On **GO**, proceed to **Plan 2 (AlarmService + ChainScreen / M1)**, which wires the proven alarm approach behind `src/alarm/AlarmService.ts` and connects the domain engine to the UI from the spec's §9 layout.
