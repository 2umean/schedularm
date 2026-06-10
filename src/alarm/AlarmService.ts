import { Platform } from 'react-native';

import * as native from '../../modules/schedularm-alarm';
import { Schedule, reverseCalc } from '../domain';
import { AlarmHealth, deriveHealth } from './alarmHealth';
import { cancelChainAlerts, scheduleChainAlerts } from './chainAlerts';

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
    // Companion fall-asleep/leave-home push alerts — best-effort, never
    // allowed to affect the alarm itself (fire-and-forget, errors swallowed).
    void scheduleChainAlerts(schedule);
  },

  /** Cancel any ringing + scheduled alarm (also clears native boot re-arm). */
  dismiss(): void {
    if (!isAndroid) return;
    native.dismiss();
    void cancelChainAlerts();
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
