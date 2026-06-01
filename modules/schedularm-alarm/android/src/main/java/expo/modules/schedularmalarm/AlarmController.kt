package expo.modules.schedularmalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build

/**
 * Single source of truth for arming / cancelling / silencing the alarm.
 * Reused by the JS module, the boot receiver and the full-screen activity.
 */
object AlarmController {

  /** Arm the exact, Doze-exempt alarm and persist it for boot re-arm. */
  fun scheduleAlarm(context: Context, epochMs: Long) {
    persist(context, epochMs)
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val info = AlarmManager.AlarmClockInfo(epochMs, showPendingIntent(context))
    // setAlarmClock is the only API that is BOTH exact AND Doze-exempt.
    alarmManager.setAlarmClock(info, firePendingIntent(context))
  }

  /** Cancel the pending OS alarm and forget it (so boot won't re-arm). */
  fun cancelScheduled(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(firePendingIntent(context))
    clear(context)
  }

  /** Stop the ringing foreground service (audio + notification). */
  fun stopRinging(context: Context) {
    context.stopService(Intent(context, AlarmForegroundService::class.java))
  }

  /** Full dismiss: silence the ring AND drop the schedule. */
  fun dismiss(context: Context) {
    stopRinging(context)
    cancelScheduled(context)
  }

  fun persistedAlarmAt(context: Context): Long =
    prefs(context).getLong(AlarmConstants.KEY_ALARM_AT, 0L)

  private fun persist(context: Context, epochMs: Long) =
    prefs(context).edit().putLong(AlarmConstants.KEY_ALARM_AT, epochMs).apply()

  private fun clear(context: Context) =
    prefs(context).edit().remove(AlarmConstants.KEY_ALARM_AT).apply()

  private fun prefs(context: Context): SharedPreferences {
    // Device-protected storage is readable during direct boot (LOCKED_BOOT_COMPLETED).
    val storageContext =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
        context.createDeviceProtectedStorageContext()
      else context
    return storageContext.getSharedPreferences(AlarmConstants.PREFS_NAME, Context.MODE_PRIVATE)
  }

  private fun pendingIntentFlags(): Int =
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  /** Broadcast fired AT alarm time → AlarmReceiver. */
  private fun firePendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmConstants.ACTION_ALARM_FIRE
    }
    return PendingIntent.getBroadcast(
      context, AlarmConstants.REQ_FIRE, intent, pendingIntentFlags()
    )
  }

  /** Shown when the user taps the upcoming-alarm icon → open the app. */
  private fun showPendingIntent(context: Context): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(context, AlarmActivity::class.java)
    return PendingIntent.getActivity(
      context, AlarmConstants.REQ_SHOW, launch, pendingIntentFlags()
    )
  }
}
