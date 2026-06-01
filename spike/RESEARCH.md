# M0 Spike — Alarm Approach (web-verified 2026)

**Decision: BESPOKE Expo local module (Kotlin), not a library.**

Why: every dedicated RN alarm library is dead/archived/stale; `expo-notifications` can't do a full-screen ring or looping `USAGE_ALARM` audio; the only live option (`react-native-notify-kit`, a single-maintainer Notifee fork) still makes *you* write the looping-audio FGS and the manifest wiring anyway. The v1 spec already locked the Android ring path to bespoke Kotlin behind `src/alarm/AlarmService.ts`, and this spike is the go/no-go gate for exactly that path — so validate the real thing. (notify-kit stays a documented same-day fallback only.)

**Correction to the v1 spec note:** use foreground-service type **`systemExempted`** (+ `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`), not `specialUse` — Android docs list "an app holding SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM running a FGS to continue alarms" as the `systemExempted` case. (`specialUse` also builds but risks a Play policy mismatch.)

## Build steps

1. **Scaffold:** `npx create-expo-module@latest --local schedularm-alarm` → `modules/schedularm-alarm/` (autolinks into the dev build, no manual `android/` edits). Keep iOS stubbed (Android-first spike).
2. **JS-facing API** (`SchedularmAlarmModule.kt` via Expo Modules `Function` DSL): `scheduleAlarm(epochMs)` and `dismiss()`. `scheduleAlarm` persists `epochMs` to `SharedPreferences` (for boot re-arm) and calls `AlarmManager.setAlarmClock(AlarmClockInfo(triggerAtMs, showPI), firePI)` — the only API that is **both exact AND Doze-exempt**.
3. **Fire path** (`AlarmReceiver` BroadcastReceiver): build an `IMPORTANCE_HIGH`, `CATEGORY_ALARM` notification with `setFullScreenIntent(pi, true)` → `AlarmActivity`, and `startForegroundService(AlarmForegroundService)`.
4. **Full-screen UI** (`AlarmActivity`): declare `android:showWhenLocked="true"` + `android:turnScreenOn="true"` in the **config plugin** (manifest flags beat runtime calls on aggressive OEMs); also `KeyguardManager.requestDismissKeyguard()` in `onCreate`. Trivial full-screen view + a single **Dismiss** button → `dismiss()`.
5. **Looping audio FGS** (`AlarmForegroundService`): `MediaPlayer` with `isLooping = true` and `AudioAttributes` `USAGE_ALARM` + `CONTENT_TYPE_SONIFICATION` (plays at alarm volume, ignores silent/DND). **Use the system default alarm sound** (`RingtoneManager.getActualDefaultRingtoneUri(ctx, TYPE_ALARM)`) — no bundled asset needed. `foregroundServiceType="systemExempted"`. `dismiss()` stops the player + `stopForeground`/`stopSelf` + cancels the notification.
6. **Boot re-arm** (`BootReceiver`): on `BOOT_COMPLETED` (+ `LOCKED_BOOT_COMPLETED`, OEM `QUICKBOOT_POWERON`) read persisted `epochMs` and re-call `setAlarmClock`.
7. **Config plugin** (`modules/schedularm-alarm/plugin/withSchedularmAlarm.ts`, using `withAndroidManifest`): inject permissions `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` (`maxSdkVersion="32"`), `USE_FULL_SCREEN_INTENT`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `POST_NOTIFICATIONS`, `VIBRATE`; the `<service ... foregroundServiceType="systemExempted">`; the `<activity ... showWhenLocked turnScreenOn exported=false>`; the exported `<receiver>` with `BOOT_COMPLETED`. Register in `app.config.ts` `plugins`.
8. **Build the dev client** (NOT Expo Go): EAS cloud dev build `eas build --profile development --platform android` (preferred — no local Android SDK needed) or `npx expo run:android` locally.
9. **Runtime permission gate:** before scheduling, check `canScheduleExactAlarms()` and `canUseFullScreenIntent()`; route to `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` / `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` if denied (silent drop otherwise).
10. **Device matrix (the actual go/no-go)** — prove all five: (a) full-screen UI over the **locked** screen, (b) looping must-dismiss `USAGE_ALARM` audio for 5+ min ignoring silent/DND, (c) exact fire under **Doze** (`adb shell dumpsys deviceidle force-idle`), (d) survival across **force-stop/app-kill**, (e) **re-arm after reboot**.

## Top risks to watch on-device
- **OEM battery managers** (Xiaomi/MIUI, Samsung One UI) defer/kill the alarm regardless of correct API — the #1 real-world risk. Needs per-app autostart/no-battery-restriction onboarding; test on real MIUI/One UI, not just a Pixel/emulator.
- **Sustained looping FGS audio** for 5+ min on Android 14/15 is the single weakest-proven box — verify empirically.
- **`canUseFullScreenIntent()`** may be denied → ring shows as heads-up only, not full-screen over lock.
- **`SCHEDULE_EXACT_ALARM` denial** silently drops the alarm — prefer the auto-granted `USE_EXACT_ALARM` (core alarm-app declaration).
- **Doze:** a pass on an awake device is NOT a pass — force Doze.
