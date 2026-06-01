package expo.modules.schedularmalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Receives the exact alarm broadcast and starts the ringing foreground service,
 * and handles the notification "Dismiss" action.
 */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      AlarmConstants.ACTION_ALARM_DISMISS -> AlarmController.dismiss(context)
      else -> startRinging(context) // ACTION_ALARM_FIRE
    }
  }

  private fun startRinging(context: Context) {
    val serviceIntent = Intent(context, AlarmForegroundService::class.java)
    // An exact-alarm receiver is temporarily allowlisted to start a FGS.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }
  }
}
