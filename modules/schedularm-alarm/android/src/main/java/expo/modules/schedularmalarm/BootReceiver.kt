package expo.modules.schedularmalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Re-arms the persisted alarm after a reboot. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_LOCKED_BOOT_COMPLETED,
      "android.intent.action.QUICKBOOT_POWERON",
      "com.htc.intent.action.QUICKBOOT_POWERON" -> reArm(context)
    }
  }

  private fun reArm(context: Context) {
    val epochMs = AlarmController.persistedAlarmAt(context)
    // Only re-arm an alarm still in the future; past-due is handled by the app
    // layer as a "missed alarm" warning.
    if (epochMs > 0L && epochMs > System.currentTimeMillis()) {
      AlarmController.scheduleAlarm(context, epochMs)
    }
  }
}
