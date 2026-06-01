package expo.modules.schedularmalarm

import android.app.Activity
import android.app.KeyguardManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen, must-dismiss alarm UI shown over the lock screen.
 * Layout is built in code so the module needs no bundled drawable/layout assets.
 */
class AlarmActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    setContentView(buildView())
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      (getSystemService(KEYGUARD_SERVICE) as KeyguardManager)
        .requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun buildView(): LinearLayout {
    val match = ViewGroup.LayoutParams.MATCH_PARENT
    val wrap = ViewGroup.LayoutParams.WRAP_CONTENT

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#0B1021"))
      layoutParams = ViewGroup.LayoutParams(match, match)
      setPadding(64, 64, 64, 64)
    }
    val title = TextView(this).apply {
      text = "schedularm"
      textSize = 36f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
    }
    val subtitle = TextView(this).apply {
      text = "Time to go."
      textSize = 18f
      setTextColor(Color.parseColor("#9AA4C2"))
      gravity = Gravity.CENTER
      setPadding(0, 16, 0, 64)
    }
    val dismiss = Button(this).apply {
      text = "Dismiss"
      setOnClickListener { dismissAlarm() }
      layoutParams = LinearLayout.LayoutParams(wrap, wrap)
    }
    root.addView(title)
    root.addView(subtitle)
    root.addView(dismiss)
    return root
  }

  private fun dismissAlarm() {
    AlarmController.dismiss(applicationContext)
    finish()
  }

  // Must-dismiss: ignore Back so the alarm can't be swiped/backed away.
  @Suppress("OVERRIDE_DEPRECATION", "MissingSuperCall")
  override fun onBackPressed() {
    // no-op
  }
}
