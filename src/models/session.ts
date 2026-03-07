import type { SessionEvent } from './event';

export type SessionMode = 'cash' | 'tournament';

export interface Session {
  id: string;
  mode: SessionMode;
  stakes?: string;
  location?: string;
  events: SessionEvent[];
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