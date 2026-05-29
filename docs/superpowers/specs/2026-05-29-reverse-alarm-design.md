# schedularm — Reverse-Calculation Alarm App · Design Spec

**Date:** 2026-05-29
**Status:** Draft for review (revised after adversarial review)
**Author:** brainstormed with Claude

---

## 1. Purpose

A mobile alarm app for **airline crew (cabin crew, pilots) and other shift workers** who must arrive at a place by a hard deadline. The user enters **one** time — when they must arrive — and the app **reverse-calculates** every preceding milestone back to the time they must fall asleep, then arms the alarm that wakes them and the reminder that gets them out the door.

The problem it solves: crew constantly recompute "if I report at 06:00, when do I leave, when do I wake, when must I be asleep?" — by hand, while tired, often the night before. This app does that arithmetic and arms the alarm in one step.

The **wake-up alarm is safety-critical** — the failure mode is *sleeping through a duty*. Reliability of that alarm, and never failing silently, is the product's central engineering concern.

## 2. Target users

- Cabin crew and pilots on irregular, early, schedule-driven duties — the most timezone-exposed user population there is (frequent layovers, device clock auto-changing).
- Secondarily, any shift worker with the same "work backwards from arrival" need.

## 3. Core concept — the 8 fields

The schedule is a single subtractive chain. The user normally enters only **Arrival**; the rest derive.

| # | Field (EN / KO) | Type | Source |
|---|---|---|---|
| 1 | **Arrival** / 도착 시간 | time | **User enters** (the anchor / hard deadline) |
| 2 | **Contingency** / 여유 시간 | duration | Sticky preset |
| 3 | **Travel** / 이동 시간 | duration | Sticky preset |
| 4 | **Leave-home** / 집에서 나가는 시간 | time | Derived |
| 5 | **Prep** / 준비 시간 | duration | Sticky preset |
| 6 | **Wake-up** / 기상 시간 | time | Derived |
| 7 | **Sleep** / 수면 시간 | duration | Sticky preset |
| 8 | **Fall-asleep** / 취침 시간 | time | Derived (typically the night before) |

**Derivation:**
```
leaveHome  = Arrival   − Contingency − Travel
wake       = leaveHome − Prep
fallAsleep = wake      − Sleep
```

Every field is **also directly editable**; see §6 (edit semantics).

## 4. v1 scope (locked decisions)

| Decision | v1 choice |
|---|---|
| Platforms | **iOS + Android** |
| Stack | **React Native + Expo (dev build / CNG), TypeScript** |
| Time handling | **Single device zone, but DST-aware** (no multi-zone planning; see §6 DST policy + §7 timezone-change) |
| Presets | **Sticky last-value** for Contingency, Travel, Prep, Sleep |
| Events | **One active event at a time** (the persisted unit is one `Schedule`; see Glossary) |
| **Wake-up** alert | **Full ringing alarm** (must dismiss) ¹ |
| **Leave-home** alert | **Strong time-sensitive notification** (sound + banner; not a full alarm) |
| **Fall-asleep** alert | **Bedtime nudge** notification |
| **Snooze** (wake-up) | **Capped** — 5-min snooze, disabled once a further snooze would push wake past `leaveHome − prepFloor` (the leave-home backstop; see §7) |
| Editing model | **Arrival protected** — derived-time edits adjust a specific duration; warn on infeasible (§6) |
| iOS reliability floor | **AlarmKit on iOS 26+**; **labeled best-effort** notification on iOS ≤25 (decided: ship best-effort, clearly labeled) |
| Localization | **Bilingual KO + EN, device-locale driven** (§12) |

¹ "Full ringing alarm (must dismiss)" applies on **iOS 26+ and Android**. On **iOS ≤25** there is no guaranteed must-dismiss alarm — the wake-up degrades to a clearly-labeled best-effort notification (see §7, §11.1).

### Out of scope for v1 (YAGNI)

- Named duty profiles (short-haul / long-haul) — sticky last-value only; data model leaves room (`schemaVersion`, §10) to add later.
- Multiple simultaneous upcoming events / roster import.
- Multi-timezone *planning* (tagging arrival in a different zone than the device). **Note:** timezone *change while an alarm is armed* IS in v1 scope (§7) — it is the core safety case for this user base.
- Cloud sync / accounts / backend — all data is local.
- Calendar / roster-system integrations.

## 5. Architecture

A **single React Native + Expo app** (one `package.json`, one TypeScript codebase — *not* a monorepo). Three internal layers with a deliberate seam around the safety-critical code.

```
┌──────────────────────────────────────────────┐
│ ③ UI  (React / src/ui)                         │
│    chain screen · presets · settings ·         │
│    live calc · onboarding · health banners     │
└───────────────┬────────────────────────────────┘
                │ calls
┌───────────────▼──────────────┐  ┌──────────────┐
│ ② AlarmService (src/alarm)   │  │ ① Domain      │
│    thin TS interface YOU own  │  │ (src/domain)  │
│    — the ONLY caller of the   │  │ pure TS:      │
│    native alarm code below.   │  │ engine,       │
│    + alarmHealth (at-risk)    │  │ editResolver, │
└───────────────┬──────────────┘  │ validation    │
                │ bridges to       │ (Jest-tested) │
┌───────────────▼───────────────┐ └──────────────┘
│ modules/native-alarm  (v1!)   │
│  Android: Kotlin ring Activity │
│   + foreground service +       │
│   AlarmManager + boot receiver │
│  iOS: AlarmKit Swift bridge    │
│  + Expo config plugin          │
└────────────────────────────────┘
```

> **Important correction (from review):** the Android ringing alarm is **not** something an off-the-shelf Expo library fully provides. `expo-notifications` cannot launch a custom full-screen ring Activity or loop alarm-attribute audio. So **`modules/native-alarm/` is a v1 deliverable, not an optional escape hatch.** You will write some Kotlin (Android ring path) and a small Swift bridge (iOS AlarmKit), wired into Expo via a **custom config plugin**. The UI and all scheduling/calc logic stay in TypeScript — still the bulk of the app — but this is explicitly *not* a zero-native build. An **M0 spike (§14)** decides whether a vetted community package can cover the Android path behind `AlarmService`; if not, the bespoke module is built.

### Repository layout

```
schedularm/
├─ app.config.ts          # Expo config: permissions + native plugins
├─ plugins/
│  └─ withNativeAlarm.ts   # custom config plugin (manifest, FGS, iOS target 26)
├─ eas.json               # cloud build profiles (dev build mandatory)
├─ package.json · tsconfig.json
├─ src/
│  ├─ domain/             # ① pure TS — no React, no native
│  │  ├─ schedule.ts      # model: Arrival instant + 4 durations (canonical)
│  │  ├─ engine.ts        # reverseCalc() pure functions
│  │  ├─ editResolver.ts  # arrival-protected edit resolution
│  │  ├─ validation.ts    # feasibility / sleep-debt / past-wake checks
│  │  ├─ datetime.ts      # instant math + DST resolution (wraps date lib)
│  │  └─ __tests__/       # Jest: midnight, DST, edits, boundaries
│  ├─ alarm/              # ② safety-critical seam
│  │  ├─ AlarmService.ts        # the interface YOU own
│  │  ├─ alarmService.native.ts # bridges modules/native-alarm
│  │  └─ alarmHealth.ts         # permission / at-risk checks
│  ├─ storage/presets.ts  # sticky last-value + active event (AsyncStorage)
│  ├─ ui/
│  │  ├─ screens/         # ChainScreen, Settings, Onboarding, Ring
│  │  └─ components/      # TimeRow, DurationPill, ArmedBanner, HealthBanner
│  ├─ i18n/               # ko.json, en.json, locale wiring
│  └─ hooks/useSchedule.ts# wires domain ↔ UI
├─ modules/native-alarm/  # v1 native module (Android ring + iOS AlarmKit)
└─ assets/
```

### Expo build constraints (from review)

- **Dev build is mandatory** — alarm native code cannot run in Expo Go.
- **All native config goes through config plugins.** Anything edited directly in `android/` or `ios/` is wiped by the next `expo prebuild --clean`. The custom `withNativeAlarm` plugin owns: Android permissions, the ring `<activity>` + `<service>` (+ `foregroundServiceType`) + receivers, and the **iOS deployment target = 26.0** for the AlarmKit path.
- **Play Console release declarations** are prerequisites: full-screen intent, exact alarm, and special-use foreground service.

### Why this stack (summary)

Alarm reliability is **OS-bound, not framework-bound**: every framework funnels into the same OS primitives (AlarmKit on iOS 26+; `setAlarmClock` + full-screen intent + foreground service on Android). All candidate stacks hit the same ceiling, so the choice is driven by developer skill and contained dependency risk. The developer is a web developer; React Native + Expo keeps the bulk of the app (UI + domain logic, in React/TypeScript) in familiar territory, and the unavoidable native alarm code is isolated behind the `AlarmService` seam. (Full research in the Appendix.)

## 6. Domain model & calc engine

### Canonical state — the single source of truth

```ts
type Schedule = {
  arrival: Instant       // absolute moment (epoch ms + IANA zone captured at entry)
  contingency: Minutes   // duration
  travel: Minutes
  prep: Minutes
  sleep: Minutes
}
```

**There is no `overrides` field.** The three derived times are *always* pure functions of `arrival + 4 durations`. This makes a stale/out-of-sync derived time structurally impossible. (This corrects a contradiction in the prior draft.)

### Arrival date-binding (load-bearing for the correct alarm day)

A bare clock-time entry resolves to the **soonest future instant strictly after `now`**: today if that time is still later today, otherwise tomorrow. The exact boundary (`time == now`) resolves to **tomorrow** (treat as not-in-the-past). An **optional date picker** covers events further out. This rule lives in the engine and is unit-tested at the near-midnight / just-past boundary.

### Absolute-instant modeling + DST policy

Times are modeled as **absolute instants**, and duration subtraction is **elapsed real time** (epoch arithmetic), so a gap of N minutes stays N minutes even across a DST transition. The UI renders each instant as a local clock time + a relative-day label ("last night", "today"). DST resolution rules:

- **Subtraction** is done on instants, never on clock-face values (no `mod 24h`).
- A computed instant that maps to a **nonexistent local time** (spring-forward gap, e.g. 02:30 when clocks jump 02:00→03:00) **shifts forward by the gap** for display and for the OS fire time.
- A computed instant that maps to an **ambiguous local time** (fall-back, occurs twice) resolves to the **earlier occurrence**.
- The `datetime.ts` module wraps a DST-correct date library (**Luxon** — chosen for mature IANA/DST support in RN; alternatives `date-fns-tz` / `Temporal` polyfill) so this is centralized and testable.

> Worked example — 06:00 report: Fall-asleep `last-night 19:45` → (midnight) → Wake `today 03:45` → Leave `today 04:35` → Arrival `today 06:00`.

### Edit semantics — "Arrival protected"

| User edits | Behavior |
|---|---|
| A **duration** (Contingency/Travel/Prep/Sleep) | Set the duration; recompute all derived times below it. |
| **Wake-up** time | Solve **Prep** = leaveHome − newWake. Arrival, Contingency, Travel, Leave-home unchanged. |
| **Leave-home** time | Solve **Travel** = arrival − contingency − newLeaveHome. **Contingency held fixed** (a leave-home edit revises assumed travel time, not your safety buffer). |
| **Fall-asleep** time | Solve **Sleep** = wake − newFallAsleep. |
| **Arrival** time | The anchor moves; the whole chain shifts with it (durations unchanged). |

**Cascade rule:** editing a derived time adjusts **only the specific duration named in the absorber table above** (holding Contingency fixed for Leave-home edits); all other durations are unchanged, so every derived time **earlier in the chain (toward fall-asleep)** shifts by the **same delta**. *(Example: Wake-up +20 min → Prep −20 min; Arrival/Leave-home fixed; Fall-asleep also +20 min.)*

**Edit-then-edit:** because state is just arrival + 4 durations, editing a duration after a time edit simply sets that duration and recomputes — no stale state, by construction.

### Validation (in the engine; fail-fast, not silent)

- **Out-of-range duration input** → **rejected** with a clear message (not silently clamped). Realistic per-duration bounds (e.g. Sleep ≤ 16h, Travel ≤ 12h, Prep ≤ 6h, Contingency ≤ 6h); also validate the total chain span is sane.
- **Infeasible (blocking)** → any absorbed duration would go **negative** (e.g. Wake-up set after Leave-home). The edit is **accepted and displayed**, but a red **non-color-only** infeasible warning shows and **the alarm will not arm** until resolved.
- **Past wake-up (blocking)** → computed Wake-up instant ≤ `now` means the alarm can't meaningfully fire → blocking warning / hard confirm.
- **Sleep-debt (non-blocking nudge)** → Fall-asleep instant ≤ `now` → "not enough sleep time" nudge; user may proceed.
- **Time reference:** validation is evaluated at edit time **and re-evaluated at arm time**.

## 7. Alarm & notification layer

All scheduling goes through `AlarmService`. Alarms are handed to the OS **up front** — no app code runs at fire time (mandatory on iOS; never depend on a dismissal callback).

### Delivery per alert

| Alert | iOS | Android |
|---|---|---|
| **Wake-up** (full alarm) | iOS 26+: **AlarmKit** system alarm (rings through Silent/Focus, survives kill, full-screen stop/snooze, **system alarm sound**). iOS ≤25: **best-effort** time-sensitive notification, explicitly labeled "not a guaranteed alarm". | `setAlarmClock` (exits Doze, status-bar icon) → high-importance full-screen-intent notification launches a `showWhenLocked`/`turnScreenOn` ring Activity → **foreground service** loops `USAGE_ALARM` ringtone + vibration + wake lock until dismissed. |
| **Leave-home** (strong notification) | Time-sensitive notification (sound + banner). | High-importance notification on its own channel (exact timing via the same exact-alarm scheduling). |
| **Fall-asleep** (nudge) | Time-sensitive notification (quiet). | High-importance notification. |

### Android requirements

- **Permissions:** `USE_EXACT_ALARM` (auto-granted to alarm apps, non-revocable) + `SCHEDULE_EXACT_ALARM` fallback; `USE_FULL_SCREEN_INTENT`; `FOREGROUND_SERVICE` **and** `FOREGROUND_SERVICE_SPECIAL_USE`; `RECEIVE_BOOT_COMPLETED`; `POST_NOTIFICATIONS`; `WAKE_LOCK`; `VIBRATE`.
- **Foreground service type:** `android:foregroundServiceType="specialUse"` on the `<service>`, with the `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` manifest property and a Play Console special-use justification. (Android 14+ requires the base permission **and** the type permission **and** the attribute, or `startForeground()` throws `MissingForegroundServiceTypeException` and the alarm dies. `mediaPlayback` is the wrong type for an alarm and risks Play rejection.)
- **Notification channels** (required since Android 8): distinct channels for (a) **wake-up ring trigger** — `IMPORTANCE_HIGH`, full-screen intent, `USAGE_ALARM` audio attributes; (b) **foreground-service** notification; (c) **leave-home** — high importance; (d) **bedtime nudge** — default importance. The leave-home/nudge exact timing depends on the exact-alarm permission.
- **Re-arm on `BOOT_COMPLETED` and `TIME_SET`** from the persisted `Schedule` — Android wipes alarms on reboot / clock change.
- Use the **system/default alarm sound** looped in the foreground service (custom bundled sounds truncate).

### iOS requirements

- `NSAlarmKitUsageDescription` in Info.plist; request AlarmKit authorization.
- **iOS deployment target = 26.0** for the AlarmKit code path (set via the config plugin; build-wide).
- **AlarmKit bridge:** no first-party Expo module exists; candidate community bridges (e.g. a Nitro AlarmKit module) are **young / single-maintainer** — treat as a risk (§11.5), pin versions, isolate behind `AlarmService`, and verify on a real iOS 26 device. Confirm during M0 whether AlarmKit's stop/snooze presentation requires an associated **Live Activity / ActivityKit** widget extension (and App Group); add it if so.
- **Time Sensitive Notifications** capability/entitlement for the leave-home + bedtime notifications.
- Use the **system alarm sound** (custom sounds stop after ~27–30s on iOS 26).
- iOS ≤25 fallback is clearly messaged as best-effort, never presented as a guaranteed alarm.

### Snooze (capped — locked)

Wake-up supports a **5-minute snooze**, but snooze is **disabled once a further snooze would push the wake time past `leaveHome − prepFloor`** — a minimum prep floor (e.g. 10 min) before the fixed leave-home time, the point beyond which leave-home is missed. (Note: the wake→leave-home gap is *Prep*, not Travel.) The ring screen always shows the leave-home deadline as context ("Leave by 04:35"). On iOS this is realized via AlarmKit's snooze; on Android via the ring Activity — `AlarmService` normalizes the cap logic so behavior is identical across platforms.

### Timezone change while armed (in v1 scope — core safety case)

When the device timezone changes (e.g. crew flies Seoul→LA and the phone auto-updates), the **armed alarm stays pinned to its original absolute instant**. On Android, the `TIME_SET` handler **re-arms from the stored instant without recomputing clock-face values**. The UI surfaces the shifted local clock time so the user understands when it will now ring locally. (Verified in the §13 on-device matrix.)

## 8. Safety — the app watches itself

Silent failure is the dangerous outcome, so the app actively self-monitors.

- **"Alarm armed" confirmation:** a persistent banner showing the armed wake-up + leave-home times, so the user can trust it before sleeping. Turns **red** if at risk.
- **Launch-time health check (`alarmHealth`):** on each launch and on return from background, verify notification permission, exact-alarm permission, full-screen-intent capability (`canUseFullScreenIntent()`), AlarmKit authorization (iOS), and Android battery-optimization exemption. Any at-risk state → prominent **"Your alarm may NOT ring — tap to fix"** banner.
- **Permission-state UX table** (each state → copy → recovery deep link):

  | State | User-facing copy (KO/EN) | Recovery |
  |---|---|---|
  | Notifications denied | "Alarms can't alert you — enable notifications" | open app notification settings |
  | Exact alarm denied (Android) | "Alarm may be delayed — allow exact alarms" | `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` |
  | Full-screen intent unavailable | "Alarm won't show over lock screen" | full-screen-intent settings |
  | AlarmKit denied (iOS 26+) | "Allow alarms so we can wake you" | app settings |
  | Battery optimization on (Android) | "Your phone may kill the alarm — disable battery optimization" | per-OEM deep link, else generic battery settings |
  | iOS ≤25 | "This iOS can't guarantee a ringing alarm — keep a backup alarm" | informational |

- **Android OEM battery-whitelist onboarding:** a **blocking first-run step** when `Build.MANUFACTURER` is a known aggressive killer (Samsung, Xiaomi/HyperOS, Huawei, **OnePlus**, Oppo/Vivo), guiding the user to disable battery optimization / enable autostart. Re-checked on every health pass — **OnePlus may reset the exemption on firmware update**.

## 9. Navigation & screen flow + main screen

### Screen inventory & flow

Single-stack navigation (no tabs). Launch flow:

```
Launch → (first run?) Onboarding [permissions sequence → OEM battery step]
       → Health check
       → ChainScreen (home)
ChainScreen → Settings (presets, locale)         [push]
ChainScreen → time/duration editors             [modal/inline]
Alarm fires → Ring screen (full-screen, dismiss/snooze)
```

**First-run permission sequence** (ordered): notifications → AlarmKit (iOS 26+) / exact-alarm (Android) → full-screen-intent (Android) → OEM battery step (Android). Each declined permission routes to the matching §8 at-risk state rather than blocking the app.

### Main screen (`ChainScreen`) layout

A single scrolling chain — **Arrival anchored at the bottom**, building upward to bedtime (matches "work backward from arrival"):

```
┌────────────────────────────┐
│ ✓ Armed · Wake 03:45 ·      │  ← armed/health banner (red if at risk)
│   Leave 04:35               │
├────────────────────────────┤
│ 🌙 Fall asleep   19:45 last │  ← derived (auto) rows
│      └ 😴 8:00 sleep         │  ← duration pill (tap to edit)
│ ⏰ Wake up       03:45 today │  ← derived · ALARM
│      └ 🚿 0:50 prep          │
│ 🚪 Leave home    04:35 today │  ← derived · notification
│      └ 🚕 1:10 · 🛟 0:15      │  ← travel · contingency
│ 📍 Arrive by     06:00 today │  ← ENTERED (anchor, highlighted)
├────────────────────────────┤
│        [ Re-arm alarms ]     │
└────────────────────────────┘
```

- **Entered vs derived** are visually distinct (anchor highlighted; derived muted).
- **Tap any time row** to edit (opens a time editor); **tap any duration pill** to change it. Edits follow §6 semantics.
- **Relative-day labels** ("last night / today") make midnight-crossing obvious.
- **Validation messages** render inline on the affected row, with icon + text (not color alone).
- **Empty / first state:** before any arrival is entered, the screen prompts "Set your arrival time"; durations pre-fill from sticky presets (or seed defaults, §10).

### Preset edit model

Durations are edited **inline on the chain** (tap a pill) and in **Settings**. The single source of truth is the sticky preset value; an inline edit updates the current `Schedule` and **becomes the new sticky value when the alarm is armed** (so a one-off tweak that's never armed doesn't overwrite your defaults). Settings shows/edits the same sticky values directly.

## 10. Persistence

- **Backend: AsyncStorage** (per KISS — the payload is 4 durations + 1 event; MMKV's perf is irrelevant here and it adds a New-Architecture/dev-build constraint).
- **Sticky presets:** the four durations persist as last-armed value; **seed defaults** for first run (e.g. Contingency 0:15, Travel 1:00, Prep 0:45, Sleep 8:00).
- **Active event:** one `Schedule` persisted with enough data (including the captured zone + absolute instant) to re-arm after reboot / clock change.
- **`schemaVersion`** stored on persisted records; migrate-forward on read. v1 baseline = `1`.
- All storage is **local**; no backend in v1.

## 11. Key risks (from research)

1. **iOS ≤25 has no guaranteed must-dismiss alarm** in any framework — platform limitation. Mitigation: AlarmKit on 26+, clearly-labeled best-effort below, recommend the system Clock app as backup.
2. **Android OEM battery management** silently kills backgrounded apps and drops alarms — no API can override. Mitigation: blocking onboarding + health re-check (§8); OnePlus re-check after firmware update.
3. **No code runs at fire time** (esp. iOS) — hand the alarm to the system up front; never depend on a dismissal callback.
4. **System alarm sound, not custom** — custom sounds truncate (iOS ~30s; Android needs `USAGE_ALARM` looped in a foreground service).
5. **Native alarm code is a v1 dependency, not optional** — the Android ring path needs a bespoke module (or a vetted package, decided in M0), and the iOS AlarmKit bridge is young/single-maintainer. Mitigation: isolate behind `AlarmService`, pin versions, M0 spike validates reliability on real hardware before committing the rest.
6. **Android alarms wiped on reboot / clock change** — re-arm via `BOOT_COMPLETED` / `TIME_SET`.
7. **Permissions can be denied/revoked** — handle every state explicitly (§8 table); silent failure is the dangerous mode.
8. **DST / timezone-change** can shift a naive alarm by an hour — handled by instant math + DST resolution (§6) and the pinned-instant re-arm (§7); both are in the test matrix.

## 12. Localization (i18n)

v1 is **bilingual KO + EN, driven by device locale** (no in-app toggle in v1). All user-facing strings — field labels (§3), validation messages, safety banners, permission copy (§8) — have KO + EN entries in `src/i18n/`. Default to EN for unsupported locales.

## 13. Testing strategy

- **Domain engine (`src/domain`)** — exhaustive **Jest** unit tests, table-driven:
  - Standard reverse-calc; **midnight-crossing**.
  - **Arrival date-binding** boundary (time just-past vs just-future vs `== now`).
  - **Edit resolution** per field (correct absorber: Wake-up→Prep, Leave-home→Travel with Contingency fixed, Fall-asleep→Sleep) and the **cascade delta** to lower times.
  - **Negative-duration / infeasible** (accepted + blocks arming) and **past-wake** (blocking) and **sleep-debt** (nudge).
  - **DST**: spring-forward nonexistent time (shifts forward), fall-back ambiguous time (earlier occurrence), gap preserved across transition.
  - **Out-of-range** duration rejected (not clamped).
- **AlarmService boundary** — mocked in UI/component tests so app logic is testable without native.
- **On-device manual matrix** (the part automation can't cover):
  - Wake-up fires when: screen locked, app killed, device in Doze, silent mode, **after reboot** — on **2+ real Android OEMs** (incl. Samsung + a Xiaomi-class device) and an **iOS 26 device**; iOS ≤25 best-effort path checked on an older device.
  - **Timezone change while armed**: arm, change device zone, confirm it fires at the correct absolute moment and the UI shows the shifted local time.
  - **OnePlus** (or equivalent): re-verify battery exemption **persists after a firmware update**.

## 14. Build sequence (spike-first, de-risk the unknown)

The native alarm is the load-bearing uncertainty and can only be retired on hardware. Sequence accordingly:

- **M0 — Spike (go/no-go gate for the whole project).** Hardcode a single wake-up alarm ~2 min out, minimal UI, no domain logic. **Prove it rings** on a real iOS 26 device **and** a real Samsung/Xiaomi with screen locked + app killed + Doze + silent + after reboot. Decide here whether a community package suffices behind `AlarmService` or a bespoke native module is required. **Gate:** do not plan M2+ until M0 passes.
- **M1 — `AlarmService` + arm a real alarm** from a single entered time (no reverse calc yet).
- **M2 — Domain engine**: reverse-calc, arrival date-binding, arrival-protected edits, validation, DST — all Jest-tested.
- **M3 — Safety**: `alarmHealth` banner, permission-state flows, OEM onboarding, iOS ≤25 honesty notice.
- **M4 — Full feature set**: leave-home notification, bedtime nudge, capped snooze, presets polish, i18n, accessibility.

## 15. Open questions (remaining)

- **M0 outcome** decides Android implementation (vetted package vs bespoke module) and confirms the iOS AlarmKit bridge + whether a Live Activity extension is needed. Everything downstream depends on this gate.
- Final **seed default** duration values (§10) — confirm with a real crew member.

## Glossary

- **Schedule** — the canonical persisted unit: one `arrival` instant + 4 durations. The app holds exactly one active `Schedule` at a time. ("Event" = a `Schedule` plus its armed OS alarms; used informally.)

## Appendix — Verified platform facts (2026)

- **iOS 26 introduced AlarmKit (WWDC 2025):** any third-party app can schedule a system alarm that rings through Silent + Focus/DND, shows a full-screen stop/snooze UI, and fires when the app is closed — **no special Apple entitlement review**, only `NSAlarmKitUsageDescription` + a user-permission prompt. Requires iOS deployment target 26.
- **iOS ≤25:** no reliable way for a consumer app to ring through Silent/DND and force a dismiss. Critical Alerts is granted almost exclusively to medical/safety/security apps; the silent-audio hack dies on app-kill and risks App Store rejection (Guideline 2.5.4).
- **A normal local notification is not an alarm on iOS:** sound plays once and auto-silences, respects Silent/DND unless time-sensitive/critical, custom sounds < 30s, system keeps only the 64 soonest-pending. Fine for nudges; never for the wake-up.
- **Android reliable wake-up = `AlarmManager.setAlarmClock()`** — the only API the system leaves Doze to deliver on time; shows the status-bar alarm icon. Alarm-clock apps declare `USE_EXACT_ALARM` (auto-granted, non-revocable).
- **Android 14+ foreground service** for the ringer should be type **`specialUse`** (with `FOREGROUND_SERVICE_SPECIAL_USE`, the `foregroundServiceType` attribute, and a Play Console declaration); `mediaPlayback` is the wrong type and risks rejection. Missing the type → `MissingForegroundServiceTypeException`.
- **Android 14+ full-screen-intent** is auto-granted only to alarm/calling apps; requires a Play Console declaration; check `canUseFullScreenIntent()` at runtime.
- **#1 real cause of missed Android alarms is OEM battery management** (Samsung, Xiaomi/HyperOS, Huawei, OnePlus, Oppo/Vivo) — requires manual user whitelisting; OnePlus may reset it on firmware update.
- **Android alarms are erased on reboot and clock change** — must re-schedule on `BOOT_COMPLETED` / `TIME_SET`.
- **Loudest reliable ring = system/default alarm sound**: iOS 26 default loops over a minute (custom cuts off ~27–30s); Android must use `USAGE_ALARM` attributes in a foreground service to loop until dismissed.
- **Expo:** alarm native modules require a **dev build** (not Expo Go); all native config must be expressed via **config plugins** to survive `prebuild --clean`.
