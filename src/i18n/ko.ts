import type { en } from './en';

/** Korean catalog — the PRIMARY voice of the app. Mirrors en.ts exactly. */
export const ko: typeof en = {
  day: { 'same-day': '오늘', 'prev-day': '어젯밤', 'next-day': '내일', other: '' },
  chain: {
    fallAsleep: '잠들기',
    wakeUp: '기상',
    leaveHome: '집에서 출발',
    arriveBy: '도착',
    alarmBadge: '알람',
    arm: '알람 켜기 ✈',
    disarm: '알람 끄기',
    emptyTitle: '언제까지 도착해야 하나요?',
    emptySub: '탭해서 설정 — 거꾸로 계산해 드려요',
    wordmark: 'SCHEDULARM ✈',
  },
  banner: {
    armed: '✓ 알람 설정됨 · 기상 {{wake}} · 출발 {{leave}}',
    ready: '🛏 도착 시간을 설정해 주세요',
    atRisk: '⚠ 알람이 울리지 않을 수 있어요 — 눌러서 해결',
  },
  reason: {
    'notifications-denied': '알림이 꺼져 있어요 — 알람이 알려드릴 수 없어요',
    'exact-alarm-denied': '정확한 알람이 차단돼 있어요 — 제시간에 울리지 않을 수 있어요',
    'full-screen-denied': '전체 화면 알람이 꺼져 있어요 — 잠금 화면 위에 표시되지 않아요',
    'overlay-denied': '‘다른 앱 위에 표시’가 꺼져 있어요 — 전체 화면 대신 배너로만 표시돼요',
    'battery-not-whitelisted': '배터리 최적화가 알람을 종료시킬 수 있어요 — 눌러서 해결',
    'alarm-auth-denied': '알람 권한이 꺼져 있어요 — 알람이 깨울 수 있도록 허용해 주세요',
  },
  issue: {
    infeasible: '불가능한 일정이에요 — 음수 시간이 생겨요.',
    'past-wake': '기상 시간이 이미 지났어요.',
    'sleep-debt': '주의: 잘 시간이 얼마 안 남았어요.',
    'chain-too-long': '전체 일정이 비현실적으로 길어요.',
    'out-of-range': '{{field}} 시간이 허용 범위를 벗어났어요.',
  },
  duration: { contingency: '여유', travel: '이동', prep: '준비', sleep: '수면' },
  timeField: { arrival: '도착', wake: '기상', leaveHome: '출발', fallAsleep: '잠들기' },
  editor: { setTime: '{{field}} 시간 설정', cancel: '취소', set: '설정' },
  onboarding: {
    title: '알람이 꼭 울리도록 설정할게요',
    subtitle: 'schedularm은 안전 알람이에요. 휴대폰이 알람을 조용히 종료하지 못하도록 설정해 주세요.',
    oemWarning: '이 휴대폰 브랜드는 알람을 강제 종료하는 것으로 알려져 있어요 — 배터리 단계는 필수예요.',
    enable: '허용하기',
    required: '필수',
    continueReady: '계속하기 ✈',
    continueBlocked: '필수 단계를 완료해 주세요',
    recheck: '다시 확인 ↻',
    notif: { title: '알림 & 정확한 알람', desc: '알람이 제시간에 울리고 표시되도록 해요.' },
    fullScreen: { title: '잠금 화면 위에 표시', desc: '배너가 아니라 화면 전체를 깨워요.' },
    overlay: { title: '다른 앱 위에 표시', desc: '전체 화면을 막는 휴대폰에서 강제로 띄우는 보조 장치예요.' },
    battery: { title: '배터리 최적화 해제', desc: '해제하지 않으면 백그라운드에서 알람이 종료돼요.' },
  },
  alerts: {
    fallAsleep: { title: '🌙 잠들 시간이에요', body: '{{wake}} 기상을 위해 지금 주무세요.' },
    leaveHome: { title: '🚪 지금 출발하세요', body: '{{leave}}까지 출발해야 제시간에 도착해요.' },
  },
};
