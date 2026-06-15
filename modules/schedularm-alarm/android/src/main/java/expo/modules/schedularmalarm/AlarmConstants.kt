package expo.modules.schedularmalarm

/** Shared keys, actions and ids for the bespoke alarm pipeline. */
object AlarmConstants {
  const val TAG = "SchedularmAlarm"

  // Broadcast actions handled by AlarmReceiver.
  const val ACTION_ALARM_FIRE = "expo.modules.schedularmalarm.ACTION_ALARM_FIRE"
  const val ACTION_ALARM_DISMISS = "expo.modules.schedularmalarm.ACTION_ALARM_DISMISS"

  // Persistence (device-protected storage so boot re-arm works pre-unlock).
  const val PREFS_NAME = "schedularm_alarm_prefs"
  const val KEY_ALARM_AT = "alarm_at_epoch_ms"
  const val KEY_LEAVE_AT = "leave_at_epoch_ms"

  // Notification channel + id.
  const val CHANNEL_ID = "schedularm_alarm_channel"
  const val CHANNEL_NAME = "Alarms"
  const val NOTIFICATION_ID = 4711

  // PendingIntent request codes (stable so cancel() matches schedule()).
  const val REQ_FIRE = 1001
  const val REQ_SHOW = 1002
  const val REQ_DISMISS = 1003
  const val REQ_PERMISSION_NOTIFICATIONS = 1004
}
