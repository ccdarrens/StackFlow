import type { Session } from '../models/session';
import {
  type SessionRepository,
  type StorageRoot,
  STORAGE_KEY
} from './repository';

export class LocalStorageRepository implements SessionRepository {

  // ---------------------------
  // Public API
  // ---------------------------

  async getAllSessions(): Promise<Session[]> {
    const root = this.loadRoot();
    return root.sessions;
  }

  async getSessionById(id: string): Promise<Session | undefined> {
    const root = this.loadRoot();
    return root.sessions.find(s => s.id === id);
  }

  async saveSession(session: Session): Promise<void> {
    const root = this.loadRoot();

    const existingIndex = root.sessions.findIndex(s => s.id === session.id);

    if (existingIndex >= 0) {
      root.sessions[existingIndex] = session;
    } else {
      root.sessions.push(session);
    }

    this.saveRoot(root);
  }

  async deleteSession(id: string): Promise<void> {
    const root = this.loadRoot();

    root.sessions = root.sessions.filter(s => s.id !== id);

    if (root.activeSessionId === id) {
      root.activeSessionId = null;
    }

    this.saveRoot(root);
  }

  async getActiveSession(): Promise<Session | null> {
    const root = this.loadRoot();

    if (!root.activeSessionId) return null;

    return root.sessions.find(s => s.id === root.activeSessionId) || null;
  }

  async setActiveSession(id: string | null): Promise<void> {
    const root = this.loadRoot();

    if (id !== null) {
      const exists = root.sessions.some(s => s.id === id);
      if (!exists) {
        throw new Error('Cannot set active session: session not found');
      }
    }

    root.activeSessionId = id;
    this.saveRoot(root);
  }

  // ---------------------------
  // Internal Helpers
  // ---------------------------

  private loadRoot(): StorageRoot {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const initial: StorageRoot = {
        sessions: [],
        activeSessionId: null
      };
      this.saveRoot(initial);
      return initial;
    }

    try {
      const parsed = JSON.parse(raw);

      // Basic structure validation
      if (
        typeof parsed !== 'object' ||
        !Array.isArray(parsed.sessions)
      ) {
        return this.resetStorage();
      }

      return parsed as StorageRoot;

    } catch {
      return this.resetStorage();
    }
  }

  private saveRoot(root: StorageRoot): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  }

  private resetStorage(): StorageRoot {
    const clean: StorageRoot = {
      sessions: [],
      activeSessionId: null
    };

    this.saveRoot(clean);
    return clean;
  }
}