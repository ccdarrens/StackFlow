import type { Session } from '../models/session';

export const STORAGE_KEY = 'stackflow_v2';

export interface SessionRepository {

  getAllSessions(): Promise<Session[]>;

  getSessionById(id: string): Promise<Session | undefined>;

  saveSession(session: Session): Promise<void>;

  deleteSession(id: string): Promise<void>;

  getActiveSession(): Promise<Session | null>;

  setActiveSession(id: string | null): Promise<void>;
}

export interface StorageRoot {
  sessions: Session[];
  activeSessionId: string | null;
}