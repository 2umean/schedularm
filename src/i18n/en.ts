/** English catalog — the FALLBACK locale. ko.ts must mirror this key set exactly. */
export const en = {
  day: { 'same-day': 'today', 'prev-day': 'last night', 'next-day': 'tomorrow', other: '' },
  chain: {
    fallAsleep: 'Fall asleep',
    wakeUp: 'Wake up',
    leaveHome: 'Leave home',
    arriveBy: 'Arrive by',
    alarmBadge: 'ALARM',
    arm: 'Arm alarm ✈',
    disarm: 'Disarm',
    emptyTitle: 'When do you need to arrive?',
    emptySub: 'Tap to set — we’ll plan backwards',
    wordmark: 'SCHEDULARM ✈',
  },
  banner: {
    armed: '✓ Armed · Wake {{wake}} · Leave {{leave}}',
    ready: '🛏 Ready — set your arrival time',
    atRisk: '⚠ Your alarm may NOT ring — tap to fix',
  },
  reason: {
    'notifications-denied': 'Notifications are off — the alarm can’t alert you',
    'exact-alarm-denied': 'Exact alarms are blocked — your alarm may not fire on time',
    'full-screen-denied': 'Full-screen alarms are off — it won’t show over the lock screen',
    'overlay-denied': '“Appear on top” is off — the alarm shows as a banner, not full-screen',
    'battery-not-whitelisted': 'Battery optimization may kill the alarm — tap to fix',
  },
  issue: {
    infeasible: 'This timing is impossible — a step would take negative time.',
    'past-wake': 'The wake-up time has already passed.',
    'sleep-debt': 'Heads up: not much time left to sleep.',
    'chain-too-long': 'The total span is unrealistically long.',
    'out-of-range': 'The {{field}} duration is out of range.',
  },
  duration: { contingency: 'contingency', travel: 'travel', prep: 'prep', sleep: 'sleep' },
  timeField: { arrival: 'arrival', wake: 'wake-up', leaveHome: 'leave-home', fallAsleep: 'fall-asleep' },
  editor: { setTime: 'Set {{field}} time', cancel: 'Cancel', set: 'Set' },
  onboarding: {
    title: 'Let’s make sure your alarm can wake you',
    subtitle: 'schedularm is a safety alarm. These settings stop your phone from silently killing it.',
    oemWarning: 'Your phone’s brand is known to kill alarms — the battery step is required.',
    enable: 'Enable',
    required: 'REQUIRED',
    continueReady: 'Continue ✈',
    continueBlocked: 'Finish the required steps',
    recheck: 'Re-check ↻',
    notif: { title: 'Notifications & exact alarms', desc: 'So the alarm can fire on time and show up.' },
    fullScreen: { title: 'Show over the lock screen', desc: 'So the alarm takes over the screen, not just a banner.' },
    overlay: { title: 'Appear on top', desc: 'Forces full-screen on phones that suppress it.' },
    battery: { title: 'Disable battery optimization', desc: 'Otherwise your phone kills the alarm in the background.' },
  },
  alerts: {
    fallAsleep: { title: '🌙 Time to fall asleep', body: 'Sleep now to be rested for your {{wake}} wake-up.' },
    leaveHome: { title: '🚪 Leave home now', body: 'Leave by {{leave}} to arrive on time.' },
  },
};
// NOTE: deliberately NOT `as const` — ko.ts is typed `typeof en`, which must
// widen values to `string` (literal types would reject the Korean strings)
// while still enforcing the exact key structure at compile time.
