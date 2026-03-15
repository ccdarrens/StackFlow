import type { SessionEvent } from './event';

export type SessionMode = 'cash' | 'tournament';

export interface SessionBreak {
  id: string;
  startedAt: number;
  durationMinutes: number;
}

export interface Session {
  id: string;
  mode: SessionMode;
  stakes?: string;
  location?: string;
  events: SessionEvent[];
  breaks?: SessionBreak[];
  startedAt: number;
  updatedAt: number;
  endedAt?: number; // time session ended
}

// Derived helpers (pure domain logic only)

export function hasEnded(session: Session): boolean {
  return !isActive(session);
}

export function isActive(session: Session): boolean {
  return !session.endedAt;
}

export function getSessionBreaks(session: Session): SessionBreak[] {
  return Array.isArray(session.breaks) ? session.breaks : [];
}

export function getActiveBreak(session: Session, now: number = Date.now()): SessionBreak | null {
  const activeBreaks = getSessionBreaks(session)
    .filter(item => {
      if (!Number.isFinite(item.startedAt) || !Number.isFinite(item.durationMinutes) || item.durationMinutes < 1) {
        return false;
      }

      const breakEnd = item.startedAt + item.durationMinutes * 60_000;
      return now >= item.startedAt && now < breakEnd;
    })
    .sort((left, right) => right.startedAt - left.startedAt);

  return activeBreaks[0] ?? null;
}

export function getSessionBreakDurationMs(session: Session, endTime: number = session.endedAt ?? Date.now()): number {
  if (!Number.isFinite(endTime) || endTime <= session.startedAt) {
    return 0;
  }

  const intervals = getSessionBreaks(session)
    .map(item => {
      if (!Number.isFinite(item.startedAt) || !Number.isFinite(item.durationMinutes) || item.durationMinutes < 1) {
        return null;
      }

      const breakStart = Math.max(session.startedAt, item.startedAt);
      const breakEnd = Math.min(endTime, item.startedAt + item.durationMinutes * 60_000);
      if (breakEnd <= breakStart) {
        return null;
      }

      return { start: breakStart, end: breakEnd };
    })
    .filter((item): item is { start: number; end: number } => item !== null)
    .sort((left, right) => left.start - right.start);

  if (intervals.length === 0) {
    return 0;
  }

  let total = 0;
  let currentStart = intervals[0].start;
  let currentEnd = intervals[0].end;

  for (let index = 1; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
      continue;
    }

    total += currentEnd - currentStart;
    currentStart = interval.start;
    currentEnd = interval.end;
  }

  total += currentEnd - currentStart;
  return total;
}

export function getSessionDurationMs(session: Session, endTime: number = session.endedAt ?? Date.now()): number {
  if (!Number.isFinite(endTime) || endTime <= session.startedAt) {
    return 0;
  }

  return Math.max(0, endTime - session.startedAt - getSessionBreakDurationMs(session, endTime));
}
