import type { SessionEvent } from '../../src/models/event';
import type { Session, SessionMode } from '../../src/models/session';

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

export function createSession(overrides: Partial<Session> = {}): Session {
  const mode: SessionMode = overrides.mode ?? 'cash';

  return {
    id: overrides.id ?? 'session-1',
    mode,
    stakes: overrides.stakes,
    location: overrides.location,
    events: overrides.events ?? [],
    startedAt: overrides.startedAt ?? 1_700_000_000_000,
    updatedAt: overrides.updatedAt ?? 1_700_000_100_000,
    endedAt: overrides.endedAt
  };
}
