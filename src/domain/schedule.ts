export const MINUTE_MS = 60_000;

/** A duration in whole minutes, >= 0. */
export type Minutes = number;

/** Canonical state — the ONLY source of truth. The 3 derived times are pure functions of this. */
export type Schedule = {
  arrival: number; // absolute instant, epoch ms, seconds/millis zeroed
  zone: string;    // IANA zone captured at entry, e.g. "Asia/Seoul"
  contingency: Minutes;
  travel: Minutes;
  prep: Minutes;
  sleep: Minutes;
};

export type DerivedSchedule = {
  arrival: number;
  leaveHome: number;
  wake: number;
  fallAsleep: number;
};
