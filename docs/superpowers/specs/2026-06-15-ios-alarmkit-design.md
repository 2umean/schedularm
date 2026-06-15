# schedularm — iOS AlarmKit Support (design spec)

**Date:** 2026-06-15
**Status:** Approved (brainstorming) → ready for implementation plan
**Goal:** Add a genuinely reliable iOS version of the reverse-alarm app by implementing the iOS native alarm path against Apple's **AlarmKit** (iOS 26), fulfilling the existing `AlarmService` contract with the smallest, safest change. The existing RN UI, domain engine, i18n, and theme are reused as-is.

---

## Context

The app is Expo SDK 56 / RN 0.85 / TS. Alarm reliability on Android is a bespoke Kotlin Expo module (`modules/schedularm-alarm`) that fights the Android gauntlet (exact-alarm permission, full-screen intent, overlay, POST_NOTIFICATIONS, battery-optimization, OEM killers) and renders a custom full-screen "Soft Sky" `AlarmActivity`.

The project was architected for iOS from the start:
- `app.config.ts` already sets `ios.deploymentTarget: '26.0'` and ships `NSAlarmKitUsageDescription` in `infoPlist`.
- `modules/schedularm-alarm/ios/SchedularmAlarmModule.swift` is a deliberate **no-op stub** that keeps `requireNativeModule('SchedularmAlarm')` resolving so shared JS doesn't crash on iOS.
- `src/alarm/AlarmService.ts` is the single seam; every method early-returns on non-Android today (`if (!isAndroid) return;`), and `getHealth()` returns `{ reasons: [], isArmReliable: false, isAggressiveOEM: false }` on iOS.

This milestone fills in the iOS native module against AlarmKit and adapts the seam/health/onboarding for iOS.

## Key platform insight

iOS **inverts** the Android reliability/UI tradeoff:
- **Reliability is easier:** once the user grants a single AlarmKit authorization, the OS guarantees the alarm fires through silent mode and Focus, presents a full-screen lock-screen alert, gives a system Live Activity / Dynamic Island for the running alarm, and survives reboot — with no background execution, no foreground service, no boot receiver, no Doze/battery/overlay/OEM handling.
- **UI is more constrained:** AlarmKit presents its **own system-styled alarm UI**. We can set a tint (Soft Sky) and localized title + Stop-button label, but there is **no** custom gradient ring screen like Android's `AlarmActivity`.

## Approved decisions

1. **Full AlarmKit parity** — the reliable core wake alarm, not a notifications-based best-effort.
2. **Approach 1 (minimal, seam-symmetric)** — the iOS module satisfies the existing JS contract; do **not** refactor the working Android seam into a cross-platform strategy abstraction (YAGNI).
3. **Defer the leave-home Live Activity** — iOS v1 is the core wake alarm only. The leave-home info is still delivered by the existing cross-platform `expo-notifications` push alert. A live countdown (Dynamic Island / lock-screen Live Activity via ActivityKit) is a later milestone.
4. **Must-dismiss** — the AlarmKit alert offers **Stop only**, no snooze, matching the Android safety intent.
5. **Testing** — physical iPhone on iOS 26 + a paid Apple Developer account are available; on-device acceptance is in scope (same loop as the Android S24+).

---

## Architecture

### 1. iOS native module (AlarmKit) — `modules/schedularm-alarm/ios/SchedularmAlarmModule.swift`

Replace the no-op stub with a real AlarmKit-backed module exposing the **same function names** the Android module exposes (so `index.ts` and `AlarmService` need no contract change):

- **Authorization** — `AlarmManager.shared.requestAuthorization()` (async) and read `authorizationState` (`notDetermined` / `authorized` / `denied`). Gated by the existing `NSAlarmKitUsageDescription`.
- **`scheduleAlarm(epochMs, leaveEpochMs)`** — build an AlarmKit alarm with a fixed schedule at the wake instant (`epochMs`) and an alert presentation: localized title (`ring_greeting`), a single **Stop** button (`ring_dismiss`), Soft Sky tint. Schedule via `AlarmManager.shared`; **persist the returned alarm UUID** (so `dismiss` can cancel). `leaveEpochMs` is **ignored on iOS** for v1.
- **`dismiss()`** — cancel the scheduled alarm by the persisted UUID.
- **Permission/status functions** — implement the Android-named status functions so JS resolves uniformly; on iOS they derive from AlarmKit authorization (see Health below). The Android-only gates (exact alarm, full-screen intent, overlay, battery optimization, manufacturer) return iOS-appropriate constants (e.g. `true`/empty) so they never produce a false "at-risk" on iOS.

**No iOS equivalent** is built for `AlarmForegroundService`, `BootReceiver`, `AlarmReceiver`, `AlarmActivity`, or the OEM/battery/overlay code — the OS owns all of that.

**Risk:** AlarmKit is new (iOS 26). Design is against its public contract; exact Swift API (schedule signature, presentation/attributes types) is pinned against the iOS 26 SDK at implementation time. The EAS build is the compiler (same model as the Kotlin module).

### 2. Seam — `src/alarm/AlarmService.ts`

Replace the binary `isAndroid` early-returns with a two-way platform split so iOS gets real behavior:

- **`arm(schedule)`** (iOS): ensure AlarmKit authorized, schedule the AlarmKit alarm at the wake instant, **and** call `scheduleChainAlerts(schedule)`.
  - **Bug fix:** today `arm()` returns before `scheduleChainAlerts`, so on iOS the fall-asleep/leave-home push alerts are never scheduled even though they're cross-platform. The iOS path must wire them in.
- **`dismiss()`** (iOS): cancel the AlarmKit alarm + `cancelChainAlerts()`.
- **`isSupported`** — `true` on iOS (currently `isAndroid`).
- **`requestCritical()`** (iOS): triggers AlarmKit `requestAuthorization`.
- `requestOverlay()` / `requestBattery()` — no-ops on iOS (Android-only concepts).

### 3. Health model — `src/alarm/alarmHealth.ts` + the seam

iOS has one meaningful state: is AlarmKit authorized?
- authorized → `{ reasons: [], isArmReliable: true, isAggressiveOEM: false }`
- denied / notDetermined → `{ reasons: ['alarm-auth-denied'], isArmReliable: false, isAggressiveOEM: false }`

Add one new `HealthReason` value `'alarm-auth-denied'` and its `reason.*` catalog entry (en + ko), covered by the existing `satisfies Record<HealthReason, string>` guard. The iOS mapping (authorization state → `AlarmHealth`) is a **small pure function**, unit-tested like `deriveHealth`. None of Android's five gates apply on iOS.

### 4. Onboarding — `src/ui/screens/OnboardingScreen.tsx`

iOS needs **one** step ("Allow schedularm to set alarms" → `requestCritical()`), vs Android's up-to-four. The existing screen is **data-driven**: on iOS only `alarm-auth-denied` can appear and `isAggressiveOEM` is always false (battery step never renders), so the screen naturally renders a single step + the Continue gate. Add the one new string and let the data drive it — **do not fork the screen**.

### 5. Localization of the AlarmKit alert

AlarmKit alert strings are supplied from Swift as localized resources the **OS resolves by system language** (mirroring Android's `res/values/` + `res/values-ko/`). Add native iOS string files (`en.lproj/Localizable.strings` + `ko.lproj/Localizable.strings`, or the `.xcstrings` String Catalog equivalent) with:
- `ring_greeting` → "Good morning!" / "좋은 아침!" (alert title)
- `ring_dismiss` → "Dismiss alarm" / "알람 끄기" (Stop button)

AlarmKit's alert has a single title slot (no subtitle line), so the Android "Time to wake up" subtitle simply does not appear on iOS. Key names mirror the Android `strings.xml` for cross-platform legibility.

## Reused untouched

Domain engine + reverse-calc, ChainScreen, editors (Duration/Time), DurationPill/TimeRow/StatusBanner, theme tokens, `format.ts`, i18n infrastructure, `chainAlerts.ts` (cross-platform `expo-notifications`). These already render/run on iOS.

## Out of scope (this milestone)

- Leave-home **Live Activity** / Dynamic Island countdown (deferred; covered by the existing push notification).
- Any custom (non-system) iOS ring UI — AlarmKit owns the alert presentation.
- Snooze.
- Reworking the Android seam into a cross-platform strategy abstraction.

---

## Build, testing, acceptance

**Automated (jest):** stays green. New testable logic — the AlarmKit-authorization → `AlarmHealth` mapping and the `'alarm-auth-denied'` reason — added as a pure function with unit tests; catalog key-parity test auto-covers the new en/ko entry. The Swift module has no local unit test (EAS build = compiler; device = real gate).

**Build:** EAS `development` profile, `--platform ios`. First run sets up Apple credentials (distribution cert + provisioning profile via the Developer account; EAS manages once). Requires an **Xcode 26 / iOS 26 SDK** EAS build image — confirm availability early; if it lags, surface as a blocker.

**On-device acceptance (iPhone, iOS 26), Korean locale:**
1. First launch → one onboarding step → grant AlarmKit authorization; Continue unlocks.
2. Arm an alarm a few minutes out; lock the phone, set silent + enable a Focus.
3. At the instant: alarm fires through silence/Focus, Soft Sky-tinted system alert, Korean title (좋은 아침!), Stop dismisses.
4. Fall-asleep / leave-home push notifications fire (the bug-fix path).
5. Switch device to English → spot-check onboarding + alert fall back cleanly.

**Risks tracked:** (1) exact AlarmKit Swift API pinned at implementation; (2) EAS Xcode-26 image availability; (3) AlarmKit needs a real device (simulator can't fully validate); (4) one-time iOS credential setup.

## Done-when

- `npm test` green (incl. the new iOS health mapping + catalog parity for `alarm-auth-denied`); `npx tsc --noEmit` clean.
- iOS Swift module implements AlarmKit auth/schedule/cancel/status; `AlarmService` drives iOS arm/dismiss/health (+ chain-alerts wired into the iOS path); `AlarmService` remains the only native-module caller.
- EAS iOS build succeeds; on the iPhone (iOS 26, Korean): one-step authorization, the alarm fires through silent+Focus with the localized Soft Sky alert and dismisses, push alerts fire; English falls back cleanly.
- Android behavior unchanged (no regression to the safety-critical Kotlin path).
