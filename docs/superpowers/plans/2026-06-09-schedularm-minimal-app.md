# schedularm — Plan 2: Minimal Usable App (AlarmService + ChainScreen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the proven M0 alarm spike into the first usable app: enter an arrival time, watch the reverse-calc chain build live, arm the real wake-up alarm, and see an "armed" banner — with sticky duration presets and the Samsung/OEM hardening (battery whitelist + full-screen-over-lock) the M0 spike proved is required.

**Architecture:** Three TypeScript layers over the existing bespoke Kotlin alarm module. (1) A thin `AlarmService` seam (`src/alarm/`) is the **only** caller of `modules/schedularm-alarm`; it exposes `arm/dismiss/getHealth` and a pure `deriveHealth()` policy. (2) A pure `scheduleReducer` (`src/state/`) drives schedule state via the already-tested `src/domain` engine; `useSchedule`/`useArming` hooks wrap it for React. (3) A single `ChainScreen` renders the spec §9 bottom-anchored chain, gated on first run by an OEM-battery `OnboardingScreen`. New **domain/policy logic is TDD'd in Jest (node)**; native Kotlin and React UI are concrete-implement + on-device verification.

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19, TypeScript, Luxon (already in), Jest + ts-jest (already in). New deps: `@react-native-async-storage/async-storage` (sticky presets + armed-state restore) and `@react-native-community/datetimepicker` (time entry). Native: existing `modules/schedularm-alarm` Kotlin, extended for overlay + battery + manufacturer.

**Source spec:** `docs/superpowers/specs/2026-05-29-reverse-alarm-design.md` (§6 domain, §7 alarm layer, §8 safety, §9 screen, §10 persistence).
**Predecessor:** `docs/superpowers/plans/2026-05-29-schedularm-foundation.md` (Plan 1 — DONE: scaffold + 28-test domain engine + M0 spike).
**M0 outcome:** `spike/RESULTS.md` — GO on feasibility; **two OPEN Samsung items carried here**: (a) full-screen-over-lock auto-launch (needs `SYSTEM_ALERT_WINDOW` + overlay-gated direct `startActivity`); (b) reboot re-arm + battery whitelist onboarding.

**Scope (this plan):** AlarmService seam · ChainScreen + live chain · arm flow + armed banner · sticky presets · OEM battery onboarding · full-screen-over-lock hardening.
**Deferred (Plans 3/4):** leave-home notification, bedtime nudge, capped snooze, i18n (KO strings), accessibility, Settings screen, iOS AlarmKit path.

---

## File Structure

| File | Responsibility | Tested |
|---|---|---|
| `src/storage/presets.ts` | Sticky duration presets (AsyncStorage): seed defaults, load with clamp, save | ✅ node |
| `src/storage/armedSchedule.ts` | Persist the armed `Schedule` so the armed banner survives relaunch | ✅ node |
| `src/alarm/alarmHealth.ts` | **Pure** policy: map native permission snapshot + manufacturer → at-risk reasons | ✅ node |
| `src/alarm/AlarmService.ts` | Thin seam over `modules/schedularm-alarm`; the ONLY caller of the native module | device |
| `src/state/scheduleReducer.ts` | **Pure** schedule state machine over `src/domain` (arrival + 4 durations + edits) | ✅ node |
| `src/hooks/useSchedule.ts` | React glue: reducer + presets load + now-tick + derived/validation selectors | device |
| `src/hooks/useArming.ts` | React glue: arm/disarm, armed-state restore, health refresh | device |
| `src/ui/format.ts` | **Pure** display helpers: clock+day label, duration "H:MM", picked-time→instant | ✅ node |
| `src/ui/components/StatusBanner.tsx` | Combined armed/health banner (green armed / red at-risk) | device |
| `src/ui/components/TimeRow.tsx` | One chain time row (icon, label, clock, day, tap-to-edit) | device |
| `src/ui/components/DurationPill.tsx` | One duration pill (icon, value, tap-to-edit) | device |
| `src/ui/components/TimeEditorModal.tsx` | Modal time picker for arrival / derived-time edits | device |
| `src/ui/components/DurationEditorModal.tsx` | Modal stepper for a duration | device |
| `src/ui/screens/ChainScreen.tsx` | The §9 bottom-anchored chain + arm button | device |
| `src/ui/screens/OnboardingScreen.tsx` | First-run permission sequence + OEM battery whitelist (blocking on aggressive OEM) | device |
| `App.tsx` (modify) | Route first-run/at-risk → Onboarding, else ChainScreen (no nav library) | device |
| `modules/schedularm-alarm/*` (extend) | Overlay + battery + manufacturer checks/routes; overlay-gated full-screen fallback | device |

> **No navigation library.** The app is 2 screens + modals; `App.tsx` conditionally renders Onboarding vs ChainScreen, and editors are React Native `<Modal>`s. (YAGNI — don't add react-navigation.)

> **Why no AlarmService unit test:** `AlarmService.ts` imports `react-native` (`Platform`) and the native module, which don't load in the node test env. All real logic lives in the **pure** `alarmHealth`, `scheduleReducer`, `format`, and `presets` modules (TDD'd); `AlarmService` is a thin adapter verified on device. This keeps "TDD for new domain logic" honest without dragging RN into node.

---

## Phase A — Pure logic (full TDD, no device, no native)

> These four modules are pure TypeScript over the existing `src/domain`. They run in the same Jest/node setup Plan 1 established. Build them first — they're the testable core of Plan 2.

### Task A1: Install storage + datetimepicker deps

**Files:**
- Modify: `package.json` (via `expo install`)

- [ ] **Step 1: Install the two native deps (SDK-compatible versions)**

Run:
```bash
cd /Users/umean/Documents/dev/agent/schedularm
npx expo install @react-native-async-storage/async-storage @react-native-community/datetimepicker
```
Expected: both added to `dependencies` at versions Expo SDK 56 supports.

> NOTE: both are **native** modules — the running dev client must be **rebuilt** before the UI works on-device (done in Task B6). They do NOT block the Phase A/C node tests, which mock AsyncStorage and never import the picker.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json && git commit -m "chore: add async-storage + datetimepicker"
```

### Task A2: Sticky duration presets (AsyncStorage)

**Files:**
- Create: `src/storage/presets.ts`
- Test: `src/storage/__tests__/presets.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- presets`
Expected: FAIL (cannot find module `../presets`).

- [ ] **Step 3: Implement presets.ts**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- presets`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/storage/presets.ts src/storage/__tests__/presets.test.ts
git commit -m "feat(storage): sticky duration presets"
```

### Task A3: Armed-schedule persistence

**Files:**
- Create: `src/storage/armedSchedule.ts`
- Test: `src/storage/__tests__/armedSchedule.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- armedSchedule`
Expected: FAIL (cannot find module `../armedSchedule`).

- [ ] **Step 3: Implement armedSchedule.ts**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- armedSchedule`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/storage/armedSchedule.ts src/storage/__tests__/armedSchedule.test.ts
git commit -m "feat(storage): armed-schedule persistence"
```

### Task A4: Alarm health policy (pure)

**Files:**
- Create: `src/alarm/alarmHealth.ts`
- Test: `src/alarm/__tests__/alarmHealth.test.ts`

This maps the native permission snapshot (extended in Phase B) + device manufacturer to at-risk reasons. It is pure, so it's written and tested now; the native fields it consumes are added in Task B4.

- [ ] **Step 1: Write the failing tests**

```ts
import { deriveHealth, NativePermissionSnapshot } from '../alarmHealth';

const allGranted: NativePermissionSnapshot = {
  canPostNotifications: true,
  canScheduleExactAlarms: true,
  canUseFullScreenIntent: true,
  canDrawOverlays: true,
  isBatteryOptimizationIgnored: true,
};

test('all gates granted on a non-aggressive OEM → reliable, no reasons', () => {
  const h = deriveHealth(allGranted, 'Google');
  expect(h.isArmReliable).toBe(true);
  expect(h.reasons).toEqual([]);
  expect(h.isAggressiveOEM).toBe(false);
});

test('Samsung is flagged as an aggressive OEM (case-insensitive)', () => {
  expect(deriveHealth(allGranted, 'samsung').isAggressiveOEM).toBe(true);
  expect(deriveHealth(allGranted, 'SAMSUNG').isAggressiveOEM).toBe(true);
});

test('a missing exact-alarm gate is critical (blocks reliable arming)', () => {
  const h = deriveHealth({ ...allGranted, canScheduleExactAlarms: false }, 'Google');
  expect(h.reasons).toContain('exact-alarm-denied');
  expect(h.isArmReliable).toBe(false);
});

test('a missing notification gate is critical', () => {
  const h = deriveHealth({ ...allGranted, canPostNotifications: false }, 'Google');
  expect(h.reasons).toContain('notifications-denied');
  expect(h.isArmReliable).toBe(false);
});

test('a missing full-screen gate is critical', () => {
  const h = deriveHealth({ ...allGranted, canUseFullScreenIntent: false }, 'Google');
  expect(h.reasons).toContain('full-screen-denied');
  expect(h.isArmReliable).toBe(false);
});

test('overlay denied is a degrade, NOT critical (alarm still rings, banner-only over lock)', () => {
  const h = deriveHealth({ ...allGranted, canDrawOverlays: false }, 'Google');
  expect(h.reasons).toContain('overlay-denied');
  expect(h.isArmReliable).toBe(true);
});

test('battery not whitelisted is critical ONLY on an aggressive OEM', () => {
  const onSamsung = deriveHealth({ ...allGranted, isBatteryOptimizationIgnored: false }, 'samsung');
  expect(onSamsung.reasons).toContain('battery-not-whitelisted');
  expect(onSamsung.isArmReliable).toBe(false);

  const onPixel = deriveHealth({ ...allGranted, isBatteryOptimizationIgnored: false }, 'Google');
  expect(onPixel.reasons).not.toContain('battery-not-whitelisted');
  expect(onPixel.isArmReliable).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- alarmHealth`
Expected: FAIL (cannot find module `../alarmHealth`).

- [ ] **Step 3: Implement alarmHealth.ts**

```ts
/** Snapshot from the native module (Android). All booleans default true on older OS. */
export type NativePermissionSnapshot = {
  canPostNotifications: boolean;
  canScheduleExactAlarms: boolean;
  canUseFullScreenIntent: boolean;
  canDrawOverlays: boolean;
  isBatteryOptimizationIgnored: boolean;
};

export type HealthReason =
  | 'notifications-denied'
  | 'exact-alarm-denied'
  | 'full-screen-denied'
  | 'overlay-denied'
  | 'battery-not-whitelisted';

export type AlarmHealth = {
  /** Ordered list of everything currently at risk (for banner + onboarding). */
  reasons: HealthReason[];
  /** True when no reason would silently break the ring. Gates the green/red banner. */
  isArmReliable: boolean;
  /** Build.MANUFACTURER is a known aggressive battery-killer (spec §8). */
  isAggressiveOEM: boolean;
};

/** Manufacturers that silently kill backgrounded alarms (spec §8, M0 RESULTS). */
const AGGRESSIVE_OEMS = [
  'samsung', 'xiaomi', 'redmi', 'poco', 'huawei', 'honor',
  'oneplus', 'oppo', 'vivo', 'realme', 'meizu',
];

export function deriveHealth(
  snapshot: NativePermissionSnapshot,
  manufacturer: string,
): AlarmHealth {
  const isAggressiveOEM = AGGRESSIVE_OEMS.includes((manufacturer ?? '').toLowerCase());
  const reasons: HealthReason[] = [];

  if (!snapshot.canPostNotifications) reasons.push('notifications-denied');
  if (!snapshot.canScheduleExactAlarms) reasons.push('exact-alarm-denied');
  if (!snapshot.canUseFullScreenIntent) reasons.push('full-screen-denied');
  if (!snapshot.canDrawOverlays) reasons.push('overlay-denied');
  if (isAggressiveOEM && !snapshot.isBatteryOptimizationIgnored) {
    reasons.push('battery-not-whitelisted');
  }

  // Critical = will silently drop the ring. overlay-denied only degrades the
  // lock-screen presentation (heads-up banner instead of auto full-screen).
  const CRITICAL: HealthReason[] = [
    'notifications-denied',
    'exact-alarm-denied',
    'full-screen-denied',
    'battery-not-whitelisted',
  ];
  const isArmReliable = !reasons.some((r) => CRITICAL.includes(r));

  return { reasons, isArmReliable, isAggressiveOEM };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- alarmHealth`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/alarm/alarmHealth.ts src/alarm/__tests__/alarmHealth.test.ts
git commit -m "feat(alarm): pure alarm-health policy"
```

---

## Phase B — Native hardening (Android, on-device verification)

> These tasks resolve the two OPEN M0 items from `spike/RESULTS.md`: full-screen-over-lock auto-launch and reboot re-arm + battery whitelist. They extend the existing `modules/schedularm-alarm` Kotlin and config plugin. No Jest here (no device in node); verification is the on-device matrix in Task B6.

### Task B1: Add overlay + battery + manufacturer permission checks to the native module

**Files:**
- Modify: `modules/schedularm-alarm/android/src/main/java/expo/modules/schedularmalarm/SchedularmAlarmModule.kt`

- [ ] **Step 1: Add new Function/AsyncFunction entries to the module definition**

In `definition()`, after the existing `Function("getPermissionsStatus") { permissionsStatus() }` line, add:
```kotlin
    Function("getManufacturer") { Build.MANUFACTURER ?: "" }

    Function("canDrawOverlays") { canDrawOverlays() }

    Function("isBatteryOptimizationIgnored") { isBatteryOptimizationIgnored() }

    AsyncFunction("requestOverlayPermission") { promise: Promise ->
      openSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
      promise.resolve(permissionsStatus())
    }

    AsyncFunction("requestDisableBatteryOptimization") { promise: Promise ->
      requestIgnoreBatteryOptimization()
      promise.resolve(permissionsStatus())
    }
```

- [ ] **Step 2: Add the supporting private checks**

After the existing `private fun canPostNotifications()` method, add:
```kotlin
  private fun canDrawOverlays(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true

  private fun isBatteryOptimizationIgnored(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return powerManager.isIgnoringBatteryOptimizations(context.packageName)
  }

  @android.annotation.SuppressLint("BatteryLife")
  private fun requestIgnoreBatteryOptimization() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
      data = Uri.parse("package:${context.packageName}")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    (appContext.currentActivity ?: context).startActivity(intent)
  }
```

- [ ] **Step 3: Extend the permissions snapshot map**

Replace the existing `permissionsStatus()` method body so the map includes the two new fields:
```kotlin
  private fun permissionsStatus(): Map<String, Any> = mapOf(
    "canScheduleExactAlarms" to canScheduleExactAlarms(),
    "canUseFullScreenIntent" to canUseFullScreenIntent(),
    "canPostNotifications" to canPostNotifications(),
    "canDrawOverlays" to canDrawOverlays(),
    "isBatteryOptimizationIgnored" to isBatteryOptimizationIgnored()
  )
```

- [ ] **Step 4: Add the PowerManager import**

At the top of the file, with the other `android.os.*` imports, add:
```kotlin
import android.os.PowerManager
```

- [ ] **Step 5: Commit**

```bash
git add modules/schedularm-alarm/android/src/main/java/expo/modules/schedularmalarm/SchedularmAlarmModule.kt
git commit -m "feat(alarm-native): overlay + battery + manufacturer checks"
```

### Task B2: Overlay-gated direct full-screen launch from the ringing service

**Files:**
- Modify: `modules/schedularm-alarm/android/src/main/java/expo/modules/schedularmalarm/AlarmForegroundService.kt`

This is M0 OPEN item #1: on Samsung the full-screen *intent* only shows a heads-up banner; with `SYSTEM_ALERT_WINDOW` granted we additionally `startActivity` directly from the foreground service.

- [ ] **Step 1: Call the fallback after going foreground**

In `onStartCommand`, add the launch call right after `startInForeground()`:
```kotlin
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startInForeground()
    launchFullScreenIfPermitted()
    acquireWakeLock()
    startAudio()
    startVibration()
    return START_STICKY
  }
```

- [ ] **Step 2: Add the overlay-gated launcher method**

Add this method to the class (e.g. just after `onStartCommand`):
```kotlin
  /**
   * On aggressive OEMs the full-screen INTENT only yields a heads-up banner over
   * the lock screen. With SYSTEM_ALERT_WINDOW ("Appear on top") granted, a FGS may
   * start an Activity from the background — so launch the ring screen directly as a
   * fallback. The full-screen intent still fires; whichever surfaces first wins.
   */
  private fun launchFullScreenIfPermitted() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return
    try {
      val intent = Intent(this, AlarmActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
      }
      startActivity(intent)
    } catch (e: Exception) {
      Log.e(AlarmConstants.TAG, "Direct AlarmActivity launch failed", e)
    }
  }
```

> `Settings` and `Log` are already imported in this file; no new imports needed.

- [ ] **Step 3: Commit**

```bash
git add modules/schedularm-alarm/android/src/main/java/expo/modules/schedularmalarm/AlarmForegroundService.kt
git commit -m "feat(alarm-native): overlay-gated direct full-screen launch"
```

### Task B3: Add SYSTEM_ALERT_WINDOW + battery permissions to the config plugin

**Files:**
- Modify: `modules/schedularm-alarm/plugin/withSchedularmAlarm.js`

- [ ] **Step 1: Add the two permissions to the PERMISSIONS array**

In the `PERMISSIONS` array, after the `VIBRATE` entry, add:
```js
  // "Appear on top" — enables the overlay-gated direct Activity launch (M0 fix #1).
  { name: 'android.permission.SYSTEM_ALERT_WINDOW' },
  // Lets the app request the battery-optimization exemption dialog (spec §8).
  { name: 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' },
```

- [ ] **Step 2: Sanity-check the plugin still parses**

Run: `node -e "require('./modules/schedularm-alarm/plugin/withSchedularmAlarm.js'); console.log('plugin ok')"`
Expected: prints `plugin ok` (no syntax error).

- [ ] **Step 3: Commit**

```bash
git add modules/schedularm-alarm/plugin/withSchedularmAlarm.js
git commit -m "feat(alarm-native): declare overlay + battery permissions"
```

### Task B4: Extend the native module's TypeScript surface

**Files:**
- Modify: `modules/schedularm-alarm/SchedularmAlarm.types.ts`
- Modify: `modules/schedularm-alarm/index.ts`

- [ ] **Step 1: Extend PermissionStatus**

In `SchedularmAlarm.types.ts`, add the two fields to the `PermissionStatus` type:
```ts
export type PermissionStatus = {
  /** AlarmManager.canScheduleExactAlarms() (API 31+); true on older OS. */
  canScheduleExactAlarms: boolean;
  /** NotificationManager.canUseFullScreenIntent() (API 34+); true on older OS. */
  canUseFullScreenIntent: boolean;
  /** POST_NOTIFICATIONS granted (API 33+); true on older OS. */
  canPostNotifications: boolean;
  /** Settings.canDrawOverlays() — enables the direct full-screen fallback. */
  canDrawOverlays: boolean;
  /** PowerManager.isIgnoringBatteryOptimizations() for this package. */
  isBatteryOptimizationIgnored: boolean;
};
```

- [ ] **Step 2: Add the new JS-facing functions**

In `index.ts`, after the existing `getPermissionsStatus` export, add:
```ts
/** Build.MANUFACTURER — used to detect aggressive battery-killing OEMs. */
export function getManufacturer(): string {
  return SchedularmAlarm.getManufacturer();
}

/** Whether the app can draw over other apps ("Appear on top"). */
export function canDrawOverlays(): boolean {
  return SchedularmAlarm.canDrawOverlays();
}

/** Whether this package is exempt from battery optimization. */
export function isBatteryOptimizationIgnored(): boolean {
  return SchedularmAlarm.isBatteryOptimizationIgnored();
}

/** Open the system "Appear on top" settings for this app. Re-read status after. */
export async function requestOverlayPermission(): Promise<PermissionStatus> {
  return SchedularmAlarm.requestOverlayPermission();
}

/** Show the battery-optimization-exemption dialog for this app. Re-read status after. */
export async function requestDisableBatteryOptimization(): Promise<PermissionStatus> {
  return SchedularmAlarm.requestDisableBatteryOptimization();
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (`getPermissionsStatus()` callers already match the widened type since they read individual fields.)

- [ ] **Step 4: Commit**

```bash
git add modules/schedularm-alarm/SchedularmAlarm.types.ts modules/schedularm-alarm/index.ts
git commit -m "feat(alarm-native): expose overlay/battery/manufacturer to JS"
```

### Task B5: The AlarmService seam

**Files:**
- Create: `src/alarm/AlarmService.ts`

The only TypeScript caller of `modules/schedularm-alarm`. Thin adapter; pure policy lives in `alarmHealth.ts` (already tested).

- [ ] **Step 1: Implement AlarmService.ts**

```ts
import { Platform } from 'react-native';

import * as native from '../../modules/schedularm-alarm';
import { Schedule, reverseCalc } from '../domain';
import { AlarmHealth, deriveHealth } from './alarmHealth';

const isAndroid = Platform.OS === 'android';

/**
 * The safety-critical seam. UI and hooks talk ONLY to this object, never to the
 * native module directly. iOS AlarmKit is deferred (a later plan) — on iOS, arming
 * is a no-op and health reports unreliable so the UI can label it best-effort.
 */
export const AlarmService = {
  isSupported: isAndroid,

  /** Arm the wake-up alarm for a schedule (fires at its derived wake instant). */
  arm(schedule: Schedule): void {
    if (!isAndroid) return;
    native.scheduleAlarm(reverseCalc(schedule).wake);
  },

  /** Cancel any ringing + scheduled alarm (also clears native boot re-arm). */
  dismiss(): void {
    if (!isAndroid) return;
    native.dismiss();
  },

  /** Current health snapshot (permissions + OEM). */
  getHealth(): AlarmHealth {
    if (!isAndroid) {
      return { reasons: [], isArmReliable: false, isAggressiveOEM: false };
    }
    return deriveHealth(native.getPermissionsStatus(), native.getManufacturer());
  },

  /** Route the user to fix the most critical silent-fail gate (notif/exact/FSI). */
  async requestCritical(): Promise<void> {
    if (!isAndroid) return;
    await native.requestPermissions();
  },

  /** Open "Appear on top" settings (overlay → full-screen-over-lock fallback). */
  async requestOverlay(): Promise<void> {
    if (!isAndroid) return;
    await native.requestOverlayPermission();
  },

  /** Show the battery-optimization-exemption dialog (aggressive-OEM onboarding). */
  async requestBattery(): Promise<void> {
    if (!isAndroid) return;
    await native.requestDisableBatteryOptimization();
  },
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/alarm/AlarmService.ts
git commit -m "feat(alarm): AlarmService seam over the native module"
```

### Task B6: Rebuild the dev client and run the hardening on-device matrix

**Files:** none (build + manual verification)

The native deps (Task A1) and Kotlin/manifest changes (B1–B3) require a fresh dev build.

- [ ] **Step 1: Build a new dev client**

Run: `eas build --profile development --platform android`
Expected: a downloadable APK. Install on the Samsung S24+ and run `npx expo start --dev-client`.

> The app still boots into the M0 spike screen (`App.tsx` is rewired in Task D7). That's fine — this task verifies the **native** hardening using the spike's "Ring in 2 min" / "Ring in 15 min (reboot test)" buttons, which call the same `scheduleAlarm`.

- [ ] **Step 2: Grant overlay + battery, then verify auto full-screen over lock**

On the S24+: grant "Appear on top" and set the app Unrestricted (battery) + Never-sleeping. Arm "Ring in 2 min", lock the screen, wait.
Expected (M0 fix #1): the ring screen now **auto-launches full-screen over the lock screen** (not just a banner). Record PASS/FAIL in `spike/RESULTS.md`.

- [ ] **Step 3: Verify reboot re-arm**

Arm "Ring in 15 min (reboot test)", reboot the phone, leave it locked.
Expected (M0 OPEN #2): at T+15 the alarm fires. Confirm via `adb logcat -s SchedularmAlarm` that `BootReceiver.reArm: re-armed` logged. Record PASS/FAIL in `spike/RESULTS.md`.

- [ ] **Step 4: Verify sustained loop / silent-DND / app-kill / Doze**

Per `spike/RESEARCH.md` step 10: silent+DND 5-min loop; force-stop survival; `adb shell dumpsys deviceidle force-idle` then fire. Record each in `spike/RESULTS.md`.

- [ ] **Step 5: Commit the updated results**

```bash
git add spike/RESULTS.md
git commit -m "test(spike): Samsung hardening matrix — full-screen + reboot re-arm"
```

> **Gate:** if auto full-screen over lock still fails with overlay granted, stop and debug (systematic-debugging) before building the UI — the safety promise depends on it.

---

## Phase C — Schedule state machine (pure, TDD) + hooks

### Task C1: scheduleReducer (pure state over the domain engine)

**Files:**
- Create: `src/state/scheduleReducer.ts`
- Test: `src/state/__tests__/scheduleReducer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { DateTime } from 'luxon';
import {
  scheduleReducer,
  initialState,
  toSchedule,
  ScheduleState,
} from '../scheduleReducer';
import { reverseCalc } from '../../domain';
import { SEED_DEFAULTS } from '../../storage/presets';

const at = (h: number, m: number) =>
  DateTime.fromObject({ year: 2026, month: 1, day: 6, hour: h, minute: m }, { zone: 'UTC' }).toMillis();
const start = (): ScheduleState => initialState(SEED_DEFAULTS, 'UTC');

test('initial state has no arrival and seeded durations', () => {
  const s = start();
  expect(s.arrival).toBeNull();
  expect(s.travel).toBe(SEED_DEFAULTS.travel);
  expect(toSchedule(s)).toBeNull();
});

test('set-arrival populates arrival and toSchedule yields a Schedule', () => {
  const s = scheduleReducer(start(), { type: 'set-arrival', instant: at(6, 0), zone: 'UTC' });
  expect(s.arrival).toBe(at(6, 0));
  expect(toSchedule(s)).not.toBeNull();
});

test('set-duration updates exactly one field immutably', () => {
  const before = start();
  const after = scheduleReducer(before, { type: 'set-duration', field: 'prep', minutes: 30 });
  expect(after.prep).toBe(30);
  expect(after.travel).toBe(before.travel);
  expect(before.prep).toBe(SEED_DEFAULTS.prep); // original untouched
});

test('edit-wake before an arrival is entered is a no-op', () => {
  const before = start();
  const after = scheduleReducer(before, { type: 'edit-wake', instant: at(3, 25) });
  expect(after).toEqual(before);
});

test('edit-wake adjusts prep and leaves arrival fixed (wiring to editResolver)', () => {
  const armed = scheduleReducer(start(), { type: 'set-arrival', instant: at(6, 0), zone: 'UTC' });
  // base derived wake = 06:00 − (15+60)m − 45m = 04:00; move wake 20 min earlier → prep +20
  const after = scheduleReducer(armed, { type: 'edit-wake', instant: at(3, 40) });
  expect(after.prep).toBe(SEED_DEFAULTS.prep + 20);
  expect(after.arrival).toBe(at(6, 0));
});

test('edit-arrival shifts the anchor; durations unchanged', () => {
  const armed = scheduleReducer(start(), { type: 'set-arrival', instant: at(6, 0), zone: 'UTC' });
  const after = scheduleReducer(armed, { type: 'edit-arrival', instant: at(7, 0) });
  const d = reverseCalc(toSchedule(after)!);
  expect(DateTime.fromMillis(d.arrival, { zone: 'UTC' }).toFormat('HH:mm')).toBe('07:00');
  expect(after.travel).toBe(SEED_DEFAULTS.travel);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- scheduleReducer`
Expected: FAIL (cannot find module `../scheduleReducer`).

- [ ] **Step 3: Implement scheduleReducer.ts**

```ts
import {
  Schedule,
  editArrival,
  editFallAsleep,
  editLeaveHome,
  editWake,
} from '../domain';
import { Durations } from '../storage/presets';

export type DurationField = keyof Durations;

export type ScheduleState = {
  arrival: number | null; // epoch ms, or null before entry
  zone: string;
  contingency: number;
  travel: number;
  prep: number;
  sleep: number;
};

export type ScheduleAction =
  | { type: 'set-arrival'; instant: number; zone: string }
  | { type: 'set-duration'; field: DurationField; minutes: number }
  | { type: 'edit-wake'; instant: number }
  | { type: 'edit-leave-home'; instant: number }
  | { type: 'edit-fall-asleep'; instant: number }
  | { type: 'edit-arrival'; instant: number };

export function initialState(durations: Durations, zone: string): ScheduleState {
  return { arrival: null, zone, ...durations };
}

/** Project state to a domain Schedule, or null if no arrival yet. */
export function toSchedule(state: ScheduleState): Schedule | null {
  if (state.arrival == null) return null;
  return {
    arrival: state.arrival,
    zone: state.zone,
    contingency: state.contingency,
    travel: state.travel,
    prep: state.prep,
    sleep: state.sleep,
  };
}

function writeBack(state: ScheduleState, s: Schedule): ScheduleState {
  return {
    ...state,
    arrival: s.arrival,
    zone: s.zone,
    contingency: s.contingency,
    travel: s.travel,
    prep: s.prep,
    sleep: s.sleep,
  };
}

/**
 * Edits use editResolver and accept the result even when infeasible (a negative
 * duration is displayed; validation gates arming — spec §6). Edits before an
 * arrival exists are no-ops.
 */
export function scheduleReducer(state: ScheduleState, action: ScheduleAction): ScheduleState {
  switch (action.type) {
    case 'set-arrival':
      return { ...state, arrival: action.instant, zone: action.zone };
    case 'set-duration':
      return { ...state, [action.field]: action.minutes };
    case 'edit-wake': {
      const s = toSchedule(state);
      return s ? writeBack(state, editWake(s, action.instant).schedule) : state;
    }
    case 'edit-leave-home': {
      const s = toSchedule(state);
      return s ? writeBack(state, editLeaveHome(s, action.instant).schedule) : state;
    }
    case 'edit-fall-asleep': {
      const s = toSchedule(state);
      return s ? writeBack(state, editFallAsleep(s, action.instant).schedule) : state;
    }
    case 'edit-arrival': {
      const s = toSchedule(state);
      return s ? writeBack(state, editArrival(s, action.instant).schedule) : state;
    }
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- scheduleReducer`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/scheduleReducer.ts src/state/__tests__/scheduleReducer.test.ts
git commit -m "feat(state): pure schedule reducer over the domain engine"
```

### Task C2: Display format helpers (pure, TDD)

**Files:**
- Create: `src/ui/format.ts`
- Test: `src/ui/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { DateTime } from 'luxon';
import { formatDuration, formatClockWithDay, pickedTimeToInstant } from '../format';

const at = (day: number, h: number, m: number) =>
  DateTime.fromObject({ year: 2026, month: 1, day, hour: h, minute: m }, { zone: 'UTC' }).toMillis();

test('formatDuration renders H:MM', () => {
  expect(formatDuration(480)).toBe('8:00');
  expect(formatDuration(45)).toBe('0:45');
  expect(formatDuration(70)).toBe('1:10');
});

test('formatClockWithDay shows the clock and a relative-day label', () => {
  const ref = at(6, 6, 0); // arrival 06:00 day 6
  expect(formatClockWithDay(at(6, 3, 45), ref, 'UTC')).toEqual({ clock: '03:45', day: 'today' });
  expect(formatClockWithDay(at(5, 19, 45), ref, 'UTC')).toEqual({ clock: '19:45', day: 'last night' });
  expect(formatClockWithDay(at(7, 3, 0), ref, 'UTC')).toEqual({ clock: '03:00', day: 'tomorrow' });
});

test('pickedTimeToInstant maps an HH:mm onto the same calendar day as a base instant', () => {
  const base = at(6, 3, 45); // some derived time on day 6
  const out = pickedTimeToInstant(base, 4, 15, 'UTC');
  expect(DateTime.fromMillis(out, { zone: 'UTC' }).toFormat('yyyy-MM-dd HH:mm')).toBe('2026-01-06 04:15');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- format`
Expected: FAIL (cannot find module `../format`).

- [ ] **Step 3: Implement format.ts**

```ts
import { DateTime } from 'luxon';
import { relativeDayLabel, toLocalClock } from '../domain';

/** Minutes → "H:MM" (e.g. 480 → "8:00", 45 → "0:45"). */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

export type ClockWithDay = { clock: string; day: string };

const DAY_TEXT: Record<string, string> = {
  'same-day': 'today',
  'prev-day': 'last night',
  'next-day': 'tomorrow',
  other: '',
};

/** Local clock + a human relative-day label, relative to a reference instant. */
export function formatClockWithDay(
  instantMs: number,
  referenceMs: number,
  zone: string,
): ClockWithDay {
  return {
    clock: toLocalClock(instantMs, zone),
    day: DAY_TEXT[relativeDayLabel(instantMs, referenceMs, zone)],
  };
}

/** Map a picked wall-clock HH:mm onto the same calendar day as `baseInstantMs`. */
export function pickedTimeToInstant(
  baseInstantMs: number,
  hour: number,
  minute: number,
  zone: string,
): number {
  return DateTime.fromMillis(baseInstantMs, { zone })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toMillis();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- format`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/format.ts src/ui/__tests__/format.test.ts
git commit -m "feat(ui): pure display format helpers"
```

### Task C3: useSchedule hook (glue)

**Files:**
- Create: `src/hooks/useSchedule.ts`

- [ ] **Step 1: Implement useSchedule.ts**

```ts
import { useEffect, useMemo, useReducer, useState } from 'react';
import { DateTime } from 'luxon';

import { isArmable, reverseCalc, validate } from '../domain';
import { loadPresets, savePresets, SEED_DEFAULTS } from '../storage/presets';
import {
  ScheduleAction,
  initialState,
  scheduleReducer,
  toSchedule,
} from '../state/scheduleReducer';

const NOW_TICK_MS = 60_000;

export function useSchedule() {
  const zone = DateTime.local().zoneName ?? 'UTC';
  const [state, dispatch] = useReducer(scheduleReducer, undefined, () =>
    initialState(SEED_DEFAULTS, zone),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Replace seed durations with the user's sticky presets on mount.
  useEffect(() => {
    let cancelled = false;
    loadPresets().then((d) => {
      if (cancelled) return;
      (Object.keys(d) as (keyof typeof d)[]).forEach((field) =>
        dispatch({ type: 'set-duration', field, minutes: d[field] }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-evaluate past-wake / sleep-debt as time passes.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const schedule = useMemo(() => toSchedule(state), [state]);
  const derived = useMemo(() => (schedule ? reverseCalc(schedule) : null), [schedule]);
  const issues = useMemo(
    () => (schedule ? validate(schedule, nowMs) : []),
    [schedule, nowMs],
  );
  const armable = schedule != null && isArmable(issues);

  /** Persist the current durations as the new sticky presets (call when arming). */
  const persistPresets = () =>
    savePresets({
      contingency: state.contingency,
      travel: state.travel,
      prep: state.prep,
      sleep: state.sleep,
    });

  return {
    state,
    zone,
    schedule,
    derived,
    issues,
    armable,
    nowMs,
    dispatch: dispatch as React.Dispatch<ScheduleAction>,
    persistPresets,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSchedule.ts
git commit -m "feat(hooks): useSchedule wires domain to UI"
```

### Task C4: useArming hook (glue)

**Files:**
- Create: `src/hooks/useArming.ts`

- [ ] **Step 1: Implement useArming.ts**

```ts
import { useCallback, useEffect, useState } from 'react';

import { AlarmService } from '../alarm/AlarmService';
import { AlarmHealth } from '../alarm/alarmHealth';
import { Schedule, reverseCalc } from '../domain';
import { clearArmed, loadArmed, saveArmed } from '../storage/armedSchedule';

export function useArming() {
  const [armed, setArmed] = useState<Schedule | null>(null);
  const [health, setHealth] = useState<AlarmHealth>(() => AlarmService.getHealth());

  const refreshHealth = useCallback(() => setHealth(AlarmService.getHealth()), []);

  // Restore a still-valid armed schedule so the banner survives relaunch.
  useEffect(() => {
    refreshHealth();
    loadArmed().then((s) => {
      if (s && reverseCalc(s).wake > Date.now()) {
        setArmed(s);
      } else if (s) {
        clearArmed();
      }
    });
  }, [refreshHealth]);

  const arm = useCallback(
    async (schedule: Schedule) => {
      AlarmService.arm(schedule);
      await saveArmed(schedule);
      setArmed(schedule);
      refreshHealth();
    },
    [refreshHealth],
  );

  const disarm = useCallback(async () => {
    AlarmService.dismiss();
    await clearArmed();
    setArmed(null);
  }, []);

  return { armed, health, arm, disarm, refreshHealth };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useArming.ts
git commit -m "feat(hooks): useArming arm/disarm + armed-state restore"
```

---

## Phase D — ChainScreen UI + flow

> React Native components. Not unit-tested (logic lives in the tested pure modules); verified on-device in Task D8. Keep them small and presentational.

### Task D1: StatusBanner (armed / at-risk)

**Files:**
- Create: `src/ui/components/StatusBanner.tsx`

- [ ] **Step 1: Implement StatusBanner.tsx**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlarmHealth, HealthReason } from '../../alarm/alarmHealth';

const REASON_TEXT: Record<HealthReason, string> = {
  'notifications-denied': 'Notifications are off — the alarm can’t alert you',
  'exact-alarm-denied': 'Exact alarms are blocked — your alarm may not fire on time',
  'full-screen-denied': 'Full-screen alarms are off — it won’t show over the lock screen',
  'overlay-denied': '“Appear on top” is off — the alarm shows as a banner, not full-screen',
  'battery-not-whitelisted': 'Battery optimization may kill the alarm — tap to fix',
};

type Props = {
  health: AlarmHealth;
  armedSummary: { wake: string; leave: string } | null;
  onFixPress: () => void;
};

export function StatusBanner({ health, armedSummary, onFixPress }: Props) {
  const atRisk = !health.isArmReliable || health.reasons.length > 0;

  if (atRisk) {
    return (
      <Pressable onPress={onFixPress} style={[styles.banner, styles.risk]}>
        <Text style={styles.riskTitle}>⚠ Your alarm may NOT ring — tap to fix</Text>
        {health.reasons.map((r) => (
          <Text key={r} style={styles.riskLine}>
            • {REASON_TEXT[r]}
          </Text>
        ))}
      </Pressable>
    );
  }

  return (
    <View style={[styles.banner, styles.ok]}>
      {armedSummary ? (
        <Text style={styles.okTitle}>
          ✓ Armed · Wake {armedSummary.wake} · Leave {armedSummary.leave}
        </Text>
      ) : (
        <Text style={styles.okTitle}>Ready — set your arrival time</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 12, padding: 16, marginBottom: 12 },
  ok: { backgroundColor: '#13351F' },
  okTitle: { color: '#3DDC84', fontSize: 16, fontWeight: '700' },
  risk: { backgroundColor: '#3A1320' },
  riskTitle: { color: '#FF7A8A', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  riskLine: { color: '#E2A8B2', fontSize: 13, lineHeight: 18 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/StatusBanner.tsx
git commit -m "feat(ui): StatusBanner armed/at-risk"
```

### Task D2: TimeRow

**Files:**
- Create: `src/ui/components/TimeRow.tsx`

- [ ] **Step 1: Implement TimeRow.tsx**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  icon: string;
  label: string;
  clock: string;
  day: string;
  emphasis?: 'anchor' | 'alarm' | 'muted';
  badge?: string; // e.g. "ALARM"
  onPress?: () => void;
};

export function TimeRow({ icon, label, clock, day, emphasis = 'muted', badge, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.labelCol}>
        <Text style={[styles.label, emphasis === 'anchor' && styles.anchorLabel]}>{label}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      <View style={styles.timeCol}>
        <Text style={[styles.clock, emphasis === 'anchor' && styles.anchorClock]}>{clock}</Text>
        <Text style={styles.day}>{day}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  icon: { fontSize: 20, width: 32 },
  labelCol: { flex: 1 },
  label: { color: '#C7CEE6', fontSize: 16 },
  anchorLabel: { color: '#FFFFFF', fontWeight: '700' },
  badge: { color: '#7E8AB0', fontSize: 11, marginTop: 2 },
  timeCol: { alignItems: 'flex-end' },
  clock: { color: '#E7ECFB', fontSize: 18, fontWeight: '600' },
  anchorClock: { color: '#3D6BFF', fontSize: 22, fontWeight: '800' },
  day: { color: '#7E8AB0', fontSize: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/TimeRow.tsx
git commit -m "feat(ui): TimeRow"
```

### Task D3: DurationPill

**Files:**
- Create: `src/ui/components/DurationPill.tsx`

- [ ] **Step 1: Implement DurationPill.tsx**

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';

import { formatDuration } from '../format';

type Props = {
  icon: string;
  minutes: number;
  onPress: () => void;
};

export function DurationPill({ icon, minutes, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.pill}>
      <Text style={styles.text}>
        {icon} {formatDuration(minutes)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1B2340',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 32,
    marginVertical: 2,
  },
  text: { color: '#AEB7DA', fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/DurationPill.tsx
git commit -m "feat(ui): DurationPill"
```

### Task D4: TimeEditorModal

**Files:**
- Create: `src/ui/components/TimeEditorModal.tsx`

- [ ] **Step 1: Implement TimeEditorModal.tsx**

```tsx
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  /** Seed clock shown when the picker opens, as a JS Date (local). */
  initial: Date;
  onCancel: () => void;
  onConfirm: (hour: number, minute: number) => void;
};

export function TimeEditorModal({ visible, title, initial, onCancel, onConfirm }: Props) {
  const [value, setValue] = useState<Date>(initial);

  const onChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (d) setValue(d);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <DateTimePicker
            value={value}
            mode="time"
            is24Hour
            display="spinner"
            onChange={onChange}
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.btn, styles.ghost]}>
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(value.getHours(), value.getMinutes())}
              style={[styles.btn, styles.primary]}
            >
              <Text style={styles.primaryText}>Set</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#161C33', borderRadius: 16, padding: 20 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  btn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  ghost: { backgroundColor: 'transparent' },
  ghostText: { color: '#9AA4C2', fontSize: 16 },
  primary: { backgroundColor: '#3D6BFF' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/TimeEditorModal.tsx
git commit -m "feat(ui): TimeEditorModal"
```

### Task D5: DurationEditorModal

**Files:**
- Create: `src/ui/components/DurationEditorModal.tsx`

- [ ] **Step 1: Implement DurationEditorModal.tsx**

```tsx
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '../format';

const STEP = 5; // minutes

type Props = {
  visible: boolean;
  title: string;
  initialMinutes: number;
  max: number;
  onCancel: () => void;
  onConfirm: (minutes: number) => void;
};

export function DurationEditorModal({
  visible,
  title,
  initialMinutes,
  max,
  onCancel,
  onConfirm,
}: Props) {
  const [minutes, setMinutes] = useState(initialMinutes);

  const adjust = (delta: number) =>
    setMinutes((m) => Math.min(max, Math.max(0, m + delta)));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.stepper}>
            <Pressable onPress={() => adjust(-STEP)} style={styles.step}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.value}>{formatDuration(minutes)}</Text>
            <Pressable onPress={() => adjust(STEP)} style={styles.step}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.btn, styles.ghost]}>
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(minutes)} style={[styles.btn, styles.primary]}>
              <Text style={styles.primaryText}>Set</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#161C33', borderRadius: 16, padding: 20 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    backgroundColor: '#2A3A66',
    borderRadius: 12,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  value: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  btn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  ghost: { backgroundColor: 'transparent' },
  ghostText: { color: '#9AA4C2', fontSize: 16 },
  primary: { backgroundColor: '#3D6BFF' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/DurationEditorModal.tsx
git commit -m "feat(ui): DurationEditorModal stepper"
```

### Task D6: ChainScreen assembly

**Files:**
- Create: `src/ui/screens/ChainScreen.tsx`

This is the spec §9 screen: bottom-anchored chain (fall-asleep at top → arrival at bottom), live derived times, validation messages, and the arm button. It composes `useSchedule` + `useArming` + the components above. It owns the editor-modal open/close state.

- [ ] **Step 1: Implement ChainScreen.tsx**

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AlarmService } from '../../alarm/AlarmService';
import { BOUNDS, resolveArrivalInstant, reverseCalc, ValidationIssue } from '../../domain';
import { useArming } from '../../hooks/useArming';
import { useSchedule } from '../../hooks/useSchedule';
import { DurationEditorModal } from '../components/DurationEditorModal';
import { DurationPill } from '../components/DurationPill';
import { StatusBanner } from '../components/StatusBanner';
import { TimeEditorModal } from '../components/TimeEditorModal';
import { TimeRow } from '../components/TimeRow';
import { formatClockWithDay, pickedTimeToInstant } from '../format';

type DurationField = 'contingency' | 'travel' | 'prep' | 'sleep';
type TimeField = 'arrival' | 'wake' | 'leaveHome' | 'fallAsleep';

const ISSUE_TEXT = (i: ValidationIssue): string => {
  switch (i.kind) {
    case 'infeasible':
      return 'This timing is impossible — a step would take negative time.';
    case 'past-wake':
      return 'The wake-up time has already passed.';
    case 'sleep-debt':
      return 'Heads up: not much time left to sleep.';
    case 'chain-too-long':
      return 'The total span is unrealistically long.';
    case 'out-of-range':
      return `The ${i.field} duration is out of range.`;
  }
};

export function ChainScreen() {
  const { state, zone, schedule, derived, issues, armable, nowMs, dispatch, persistPresets } =
    useSchedule();
  const { armed, health, arm, disarm, refreshHealth } = useArming();

  const [timeEditor, setTimeEditor] = useState<TimeField | null>(null);
  const [durationEditor, setDurationEditor] = useState<DurationField | null>(null);

  const ref = schedule?.arrival ?? nowMs;
  const fmt = (ms: number) => formatClockWithDay(ms, ref, zone);

  const armedSummary =
    armed != null
      ? {
          wake: formatClockWithDay(reverseCalc(armed).wake, ref, zone).clock,
          leave: formatClockWithDay(reverseCalc(armed).leaveHome, ref, zone).clock,
        }
      : null;

  const onArm = async () => {
    if (!schedule || !armable) return;
    await persistPresets(); // inline tweaks become sticky only on arm (spec §9)
    await arm(schedule);
  };

  const openTime = (field: TimeField) => setTimeEditor(field);
  const confirmTime = (hour: number, minute: number) => {
    if (!timeEditor) return;
    if (timeEditor === 'arrival') {
      const instant = schedule
        ? pickedTimeToInstant(schedule.arrival, hour, minute, zone)
        : resolveArrivalInstant(hour, minute, zone, nowMs);
      dispatch({ type: schedule ? 'edit-arrival' : 'set-arrival', instant, zone });
    } else if (derived) {
      const base =
        timeEditor === 'wake'
          ? derived.wake
          : timeEditor === 'leaveHome'
            ? derived.leaveHome
            : derived.fallAsleep;
      const instant = pickedTimeToInstant(base, hour, minute, zone);
      dispatch({
        type:
          timeEditor === 'wake'
            ? 'edit-wake'
            : timeEditor === 'leaveHome'
              ? 'edit-leave-home'
              : 'edit-fall-asleep',
        instant,
      });
    }
    setTimeEditor(null);
  };

  const confirmDuration = (minutes: number) => {
    if (!durationEditor) return;
    dispatch({ type: 'set-duration', field: durationEditor, minutes });
    setDurationEditor(null);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <StatusBanner
          health={health}
          armedSummary={armedSummary}
          onFixPress={async () => {
            await AlarmService.requestCritical();
            refreshHealth();
          }}
        />

        {issues.map((i, idx) => (
          <Text key={idx} style={styles.issue}>
            ⚠ {ISSUE_TEXT(i)}
          </Text>
        ))}

        {schedule && derived ? (
          <View style={styles.chain}>
            <TimeRow
              icon="🌙"
              label="Fall asleep"
              {...fmt(derived.fallAsleep)}
              onPress={() => openTime('fallAsleep')}
            />
            <DurationPill icon="😴" minutes={state.sleep} onPress={() => setDurationEditor('sleep')} />

            <TimeRow
              icon="⏰"
              label="Wake up"
              badge="ALARM"
              emphasis="alarm"
              {...fmt(derived.wake)}
              onPress={() => openTime('wake')}
            />
            <DurationPill icon="🚿" minutes={state.prep} onPress={() => setDurationEditor('prep')} />

            <TimeRow
              icon="🚪"
              label="Leave home"
              {...fmt(derived.leaveHome)}
              onPress={() => openTime('leaveHome')}
            />
            <View style={styles.pillRow}>
              <DurationPill icon="🚕" minutes={state.travel} onPress={() => setDurationEditor('travel')} />
              <DurationPill
                icon="🛟"
                minutes={state.contingency}
                onPress={() => setDurationEditor('contingency')}
              />
            </View>

            <TimeRow
              icon="📍"
              label="Arrive by"
              emphasis="anchor"
              {...fmt(derived.arrival)}
              onPress={() => openTime('arrival')}
            />
          </View>
        ) : (
          <Pressable style={styles.empty} onPress={() => openTime('arrival')}>
            <Text style={styles.emptyText}>＋ Set your arrival time</Text>
          </Pressable>
        )}

        {schedule ? (
          <Pressable
            onPress={armed ? disarm : onArm}
            disabled={!armed && !armable}
            style={[styles.arm, armed ? styles.disarm : armable ? styles.armActive : styles.armDisabled]}
          >
            <Text style={styles.armText}>{armed ? 'Disarm' : 'Arm alarm'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {timeEditor ? (
        <TimeEditorModal
          visible
          title={`Set ${timeEditor}`}
          initial={new Date()}
          onCancel={() => setTimeEditor(null)}
          onConfirm={confirmTime}
        />
      ) : null}

      {durationEditor ? (
        <DurationEditorModal
          visible
          title={`Set ${durationEditor}`}
          initialMinutes={state[durationEditor]}
          max={BOUNDS[durationEditor][1]}
          onCancel={() => setDurationEditor(null)}
          onConfirm={confirmDuration}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1021' },
  scroll: { padding: 20, paddingTop: 64 },
  issue: { color: '#FFB870', fontSize: 14, marginBottom: 6 },
  chain: { backgroundColor: '#11172B', borderRadius: 16, padding: 16 },
  pillRow: { flexDirection: 'row', gap: 8 },
  empty: {
    borderWidth: 1,
    borderColor: '#2A3A66',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: { color: '#7E8AB0', fontSize: 18 },
  arm: { marginTop: 24, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  armActive: { backgroundColor: '#3D6BFF' },
  armDisabled: { backgroundColor: '#27314F' },
  disarm: { backgroundColor: '#B5304A' },
  armText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
```

> **Cleanup note for the implementer:** the `reverseWake`/`reverseLeave` indirection above is intentionally awkward to keep the diff explicit. When you save, simplify it: move `import { reverseCalc, Schedule } from '../../domain'` to the top with the other imports, delete the four `reverse*` shims, and inline `reverseCalc(armed).wake` / `reverseCalc(armed).leaveHome` in `armedSummary`. The mid-file `import` is illegal at runtime — it must be hoisted. (KISS — don't ship the indirection.)

- [ ] **Step 2: Type-check after the cleanup**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (`resolveArrivalInstant`, `BOUNDS`, `ValidationIssue`, `reverseCalc`, `Schedule` are all exported from `src/domain`.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/ChainScreen.tsx
git commit -m "feat(ui): ChainScreen — live reverse-calc chain + arm flow"
```

### Task D7: OnboardingScreen (permission sequence + OEM battery)

**Files:**
- Create: `src/ui/screens/OnboardingScreen.tsx`
- Create: `src/storage/onboarding.ts`
- Test: `src/storage/__tests__/onboarding.test.ts`

- [ ] **Step 1: Write the failing test for the onboarding flag**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOnboarded, markOnboarded } from '../onboarding';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('isOnboarded is false before completion', async () => {
  expect(await isOnboarded()).toBe(false);
});

test('markOnboarded persists completion', async () => {
  await markOnboarded();
  expect(await isOnboarded()).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- onboarding`
Expected: FAIL (cannot find module `../onboarding`).

- [ ] **Step 3: Implement onboarding.ts**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDED_KEY = 'schedularm.onboarded.v1';

export async function isOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDED_KEY)) === 'true';
}

export async function markOnboarded(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- onboarding`
Expected: PASS, 2 tests.

- [ ] **Step 5: Implement OnboardingScreen.tsx**

```tsx
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';

import { AlarmService } from '../../alarm/AlarmService';
import { AlarmHealth } from '../../alarm/alarmHealth';

type Props = { onDone: () => void };

export function OnboardingScreen({ onDone }: Props) {
  const [health, setHealth] = useState<AlarmHealth>(() => AlarmService.getHealth());
  const refresh = () => setHealth(AlarmService.getHealth());

  const has = (r: AlarmHealth['reasons'][number]) => !health.reasons.includes(r);

  const Step = ({
    title,
    desc,
    done,
    onFix,
  }: {
    title: string;
    desc: string;
    done: boolean;
    onFix: () => void;
  }) => (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>
        {done ? '✓ ' : '○ '}
        {title}
      </Text>
      <Text style={styles.stepDesc}>{desc}</Text>
      {!done ? (
        <Pressable onPress={onFix} style={styles.fix}>
          <Text style={styles.fixText}>Enable</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Let’s make sure your alarm can wake you</Text>
      <Text style={styles.subtitle}>
        schedularm is a safety alarm. These permissions stop your phone from silently
        killing it. {health.isAggressiveOEM ? 'Your phone’s brand is known to kill alarms — the battery step is required.' : ''}
      </Text>

      <Step
        title="Notifications & exact alarms"
        desc="So the alarm can fire on time and show up."
        done={has('notifications-denied') && has('exact-alarm-denied')}
        onFix={async () => {
          await AlarmService.requestCritical();
          refresh();
        }}
      />
      <Step
        title="Show over the lock screen"
        desc="So the alarm takes over the screen, not just a banner."
        done={has('full-screen-denied')}
        onFix={async () => {
          await AlarmService.requestCritical();
          refresh();
        }}
      />
      <Step
        title="Appear on top"
        desc="The fallback that forces full-screen on phones that suppress it."
        done={has('overlay-denied')}
        onFix={async () => {
          await AlarmService.requestOverlay();
          refresh();
        }}
      />
      {health.isAggressiveOEM ? (
        <Step
          title="Disable battery optimization"
          desc="Required on your phone — otherwise the alarm gets killed in the background."
          done={has('battery-not-whitelisted')}
          onFix={async () => {
            await AlarmService.requestBattery();
            refresh();
          }}
        />
      ) : null}

      <Pressable
        onPress={onDone}
        disabled={!health.isArmReliable}
        style={[styles.continue, health.isArmReliable ? styles.continueOn : styles.continueOff]}
      >
        <Text style={styles.continueText}>
          {health.isArmReliable ? 'Continue' : 'Finish the required steps'}
        </Text>
      </Pressable>
      <Pressable onPress={refresh}>
        <Text style={styles.recheck}>Re-check</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0B1021', padding: 24, paddingTop: 72, gap: 12 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#9AA4C2', fontSize: 15, lineHeight: 21, marginBottom: 8 },
  step: { backgroundColor: '#161C33', borderRadius: 14, padding: 16, gap: 6 },
  stepTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  stepDesc: { color: '#9AA4C2', fontSize: 14, lineHeight: 19 },
  fix: { alignSelf: 'flex-start', backgroundColor: '#3D6BFF', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 18, marginTop: 6 },
  fixText: { color: '#FFFFFF', fontWeight: '700' },
  continue: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 16 },
  continueOn: { backgroundColor: '#3DDC84' },
  continueOff: { backgroundColor: '#27314F' },
  continueText: { color: '#0B1021', fontSize: 18, fontWeight: '800' },
  recheck: { color: '#7E8AB0', textAlign: 'center', padding: 12 },
});
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/OnboardingScreen.tsx src/storage/onboarding.ts src/storage/__tests__/onboarding.test.ts
git commit -m "feat(ui): OEM battery-whitelist onboarding"
```

### Task D8: Wire App.tsx (replace the spike) + remove the spike screen

**Files:**
- Modify: `App.tsx`
- Delete: `spike/AlarmSpike.tsx`

- [ ] **Step 1: Rewrite App.tsx as the onboarding gate**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AlarmService } from './src/alarm/AlarmService';
import { ChainScreen } from './src/ui/screens/ChainScreen';
import { OnboardingScreen } from './src/ui/screens/OnboardingScreen';
import { isOnboarded, markOnboarded } from './src/storage/onboarding';

type Route = 'loading' | 'onboarding' | 'chain';

export default function App() {
  const [route, setRoute] = useState<Route>('loading');

  useEffect(() => {
    isOnboarded().then((done) => {
      // Re-show onboarding if the device still has a critical at-risk gate
      // (e.g. an OEM reset the battery exemption after a firmware update — spec §8).
      const reliable = AlarmService.getHealth().isArmReliable;
      setRoute(done && reliable ? 'chain' : 'onboarding');
    });
  }, []);

  if (route === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B1021', justifyContent: 'center' }}>
        <ActivityIndicator color="#3D6BFF" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      {route === 'onboarding' ? (
        <OnboardingScreen
          onDone={async () => {
            await markOnboarded();
            setRoute('chain');
          }}
        />
      ) : (
        <ChainScreen />
      )}
      <StatusBar style="light" />
    </>
  );
}
```

- [ ] **Step 2: Delete the spike screen**

Run:
```bash
git rm spike/AlarmSpike.tsx
```
> Keep `spike/RESULTS.md` and `spike/RESEARCH.md` — they're the M0 record + the on-device release-gate checklist.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.tsx spike/AlarmSpike.tsx
git commit -m "feat(app): onboarding gate → ChainScreen; retire spike screen"
```

---

## Phase E — Full-suite + on-device acceptance

### Task E1: Green test suite + type check

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS — Plan 1 domain tests (28) + new pure tests (presets, armedSchedule, alarmHealth, scheduleReducer, format, onboarding) all green.

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "test: full suite green for Plan 2" || echo "nothing to commit"
```

### Task E2: On-device acceptance of the full flow

**Files:** none (manual; uses the Task B6 dev build + `npx expo start --dev-client`)

Walk the spec §9 + scope flow on the Samsung S24+:

- [ ] **Step 1: First-run onboarding**

Fresh install (or clear app data). Confirm onboarding appears, the **battery step is shown** (Samsung = aggressive OEM), each "Enable" routes to the right system screen, "Continue" stays disabled until critical gates pass.

- [ ] **Step 2: Enter arrival → live chain**

Tap "Set your arrival time", pick a time ~10 min out. Confirm the full chain renders bottom-anchored (Arrive by at the bottom, Fall asleep at top) with correct derived clock + day labels, and that editing a duration pill / a derived time updates the chain live per spec §6.

- [ ] **Step 3: Arm → armed banner → it rings**

Tap "Arm alarm". Confirm the green armed banner shows Wake + Leave times. Lock the phone. At wake time, confirm it **auto-launches full-screen and rings** until dismissed.

- [ ] **Step 4: Armed-state survives relaunch; disarm works**

Re-arm a future alarm, kill + reopen the app → armed banner restored. Tap "Disarm" → alarm cancelled (verify it does not fire).

- [ ] **Step 5: Sticky presets**

Change a duration, arm, force-stop, reopen → the changed duration is the new default. Change a duration but do NOT arm, reopen → the old preset is retained (inline tweak didn't stick).

- [ ] **Step 6: Record acceptance**

Append a short PASS/FAIL acceptance note to `spike/RESULTS.md` (or a new `docs/plan2-acceptance.md`), then commit.

```bash
git add -A && git commit -m "test: Plan 2 on-device acceptance"
```

---

## Done-when

- `npm test` is green: Plan 1 domain suite + Plan 2 pure suites (presets, armedSchedule, alarmHealth, scheduleReducer, format, onboarding).
- `npx tsc --noEmit` is clean.
- On the Samsung S24+: first-run onboarding (with the battery step) → enter arrival → live reverse-calc chain → arm → green armed banner → **auto full-screen ring over the lock screen** → dismiss; armed state survives relaunch; sticky presets behave per §9.
- The two OPEN M0 items (`spike/RESULTS.md`) — full-screen-over-lock auto-launch and reboot re-arm with battery whitelist — are verified PASS (Task B6).
- `AlarmService` is the only TypeScript caller of `modules/schedularm-alarm`.

Deferred to **Plan 3** (safety depth: full `alarmHealth` permission-state table, iOS ≤25 honesty notice, timezone-change-while-armed UI) and **Plan 4** (leave-home notification, bedtime nudge, capped snooze, Settings screen, i18n KO strings, accessibility).

---

## Self-Review (performed against the spec + scope)

**Scope coverage:** (1) AlarmService seam → Tasks B5, B1–B4. (2) ChainScreen wired to domain via useSchedule → C3, D6. (3) enter arrival → live chain → arm → armed banner → D6, D1, C4. (4) sticky presets (AsyncStorage) → A2, useSchedule.persistPresets, D6.onArm. (5) OEM battery onboarding + full-screen-over-lock hardening (SYSTEM_ALERT_WINDOW + overlay-gated startActivity) → B1–B3, B6, D7. Deferred items (leave-home/bedtime/snooze/i18n/a11y) are explicitly out and routed to Plans 3/4.

**TDD honored where it's domain logic:** presets, armedSchedule, alarmHealth, scheduleReducer, format, onboarding-flag are all written test-first (pure, node). Native Kotlin + React components are concrete-implement + on-device matrix (no node-testable logic; matches Plan 1's spike convention).

**Type consistency:** `Durations`/`SEED_DEFAULTS` (presets) reused by scheduleReducer + useSchedule; `NativePermissionSnapshot` (alarmHealth) is the widened native `PermissionStatus` (B4) consumed by AlarmService.getHealth; `AlarmHealth`/`HealthReason` shared by StatusBanner + OnboardingScreen + useArming; `reverseCalc`/`BOUNDS`/`resolveArrivalInstant`/`ValidationIssue`/`Schedule` all already exported from `src/domain/index.ts` (verified).

**Placeholder scan:** no TBD/TODO/"handle edge cases" steps; every code step carries complete code and every command has an expected result.
