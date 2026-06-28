import type { SessionEvent } from '../../src/models/event';
import type { Session, SessionBreak, SessionMode } from '../../src/models/session';

export function createEvent(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    id: overrides.id ?? 'event-1',
    type: overrides.type ?? 'investment',
    amount: overrides.amount ?? 1000,
    timestamp: overrides.timestamp ?? 1_700_000_000_000,
    category: overrides.category,
    note: overrides.note
  };
}

export function createBreak(overrides: Partial<SessionBreak> = {}): SessionBreak {
  return {
    id: overrides.id ?? 'break-1',
    startedAt: overrides.startedAt ?? 1_700_000_010_000,
    durationMinutes: overrides.durationMinutes ?? 15
  };
}

export function createSession(overrides: Partial<Session> = {}): Session {
  const mode: SessionMode = overrides.mode ?? 'cash';

  return {
    id: overrides.id ?? 'session-1',
    mode,
    stakes: overrides.stakes,
    location: overrides.location,
    finishPosition: overrides.finishPosition,
    totalEntries: overrides.totalEntries,
    events: overrides.events ?? [],
    breaks: overrides.breaks ?? [],
    startedAt: overrides.startedAt ?? 1_700_000_000_000,
    updatedAt: overrides.updatedAt ?? 1_700_000_100_000,
    endedAt: overrides.endedAt
  };
}
