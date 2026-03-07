import type { Session } from '../models/session';
import type { EventType, ExpenseCategory, SessionEvent } from '../models/event';
import { LocalStorageRepository } from '../storage/localStorageRepository';
import type { SessionRepository } from '../storage/repository';
import { hasEnded, isActive } from '../models/session';
import { generateId } from '../utils/id';

export interface SessionService {

  createCashSession(stakes?: string, location?: string, initialBuyInCents?: number, startedAtOverride?: number): Promise<Session>;

  createTournamentSession(stakes?: string, location?: string, buyInCents?: number, startedAtOverride?: number): Promise<Session>;

  addInvestment(amountCents: number, note?: string, overrideTimestamp?: number): Promise<Session>;

  addReturn(amountCents: number, note?: string, overrideTimestamp?: number): Promise<Session>;

  addExpense(amountCents: number, category: ExpenseCategory, note?: string, overrideTimestamp?: number): Promise<Session>;

  endSession(overrideTimestamp?: number): Promise<Session>;

  getActiveSession(): Promise<Session | null>;

  getAllSessions(): Promise<Session[]>;

  getCompletedSessions(): Promise<Session[]>;

  updateSessionRecord(sessionId: string, updates: { stakes?: string; location?: string; startedAt?: number; endedAt?: number | undefined }): Promise<Session>;

  deleteSessionRecord(sessionId: string): Promise<void>;
}

export class DefaultSessionService implements SessionService {

  constructor(private readonly repository: SessionRepository = new LocalStorageRepository()) {}

  // ---------------------------
  // Create Cash Session
  // ---------------------------

  async createCashSession(
    stakes?: string,
    location?: string,
    initialBuyInCents: number = 0,
    startedAtOverride?: number
  ): Promise<Session> {

    const existing = await this.repository.getActiveSession();
    if (existing) {
      throw new Error('An active session already exists');
    }

    const now = startedAtOverride ?? Date.now();

    if (!Number.isFinite(now) || now <= 0) {
      throw new Error('Invalid session start time');
    }

    const session: Session = {
      id: generateId(),
      mode: 'cash',
      stakes,
      location,
      events: [],
      startedAt: now,
      updatedAt: now
    };

    if (initialBuyInCents > 0) {
      session.events.push(this.createEvent('investment', initialBuyInCents, 'buyin'));
    }

    await this.repository.saveSession(session);
    await this.repository.setActiveSession(session.id);

    return session;
  }

  // ---------------------------
  // Create Tournament Session
  // ---------------------------

  async createTournamentSession(stakes?: string, location?: string, buyInCents: number = 0, startedAtOverride?: number): Promise<Session> {

    const existing = await this.repository.getActiveSession();
    if (existing) {
      throw new Error('An active session already exists');
    }

    const now = startedAtOverride ?? Date.now();

    if (!Number.isFinite(now) || now <= 0) {
      throw new Error('Invalid session start time');
    }

    const session: Session = {
      id: generateId(),
      mode: 'tournament',
      stakes,
      location,
      events: [],
      startedAt: now,
      updatedAt: now
    };

    if (buyInCents > 0) {
      session.events.push(this.createEvent('investment', buyInCents, 'buyin'));
    }

    await this.repository.saveSession(session);
    await this.repository.setActiveSession(session.id);

    return session;
  }

  async addReturn(amountCents: number, note?: string, overrideTimestamp?: number): Promise<Session> {
    const session = await this.requireActiveSession();
    if (!isActive(session)) {
      throw new Error('Cannot add return to closed session');
    }

    if (amountCents !== undefined && amountCents < 0) {
      throw new Error('Amount must be positive');
    }

    if (overrideTimestamp !== undefined && (!Number.isFinite(overrideTimestamp) || overrideTimestamp <= 0)) {
      throw new Error('Invalid return timestamp');
    }

    session.events.push(this.createEvent('return', amountCents, note, overrideTimestamp));
    session.updatedAt = Date.now();

    await this.repository.saveSession(session);

    return session;
  }

  async addExpense(amountCents: number, category: ExpenseCategory, note?: string, overrideTimestamp?: number): Promise<Session> {
    const session = await this.requireActiveSession();
    if (!isActive(session)) {
      throw new Error('Cannot add expense to closed session');
    }

    if (amountCents !== undefined && amountCents < 0) {
      throw new Error('Amount must be positive');
    }

    if (overrideTimestamp !== undefined && (!Number.isFinite(overrideTimestamp) || overrideTimestamp <= 0)) {
      throw new Error('Invalid expense timestamp');
    }

    session.events.push(this.createExpense(amountCents, category, note, overrideTimestamp));
    session.updatedAt = Date.now();

    await this.repository.saveSession(session);

    return session;
  }

  async addInvestment(amountCents: number, note?: string, overrideTimestamp?: number): Promise<Session> {
    const session = await this.requireActiveSession();
    if (!isActive(session)) {
      throw new Error('Cannot add investment to closed session');
    }

    if (amountCents !== undefined && amountCents < 0) {
      throw new Error('Amount must be positive');
    }

    if (overrideTimestamp !== undefined && (!Number.isFinite(overrideTimestamp) || overrideTimestamp <= 0)) {
      throw new Error('Invalid investment timestamp');
    }

    session.events.push(this.createEvent('investment', amountCents, note, overrideTimestamp));
    session.updatedAt = Date.now();

    await this.repository.saveSession(session);

    return session;
  }

  // ---------------------------
  // End Session
  // ---------------------------

  async endSession(overrideTimestamp?: number): Promise<Session> {

    const session = await this.requireActiveSession();

    if (!isActive(session)) {
      throw new Error('Session already ended');
    }

    const timestamp = overrideTimestamp ?? Date.now();

    session.updatedAt = Date.now();
    session.endedAt = timestamp;

    await this.repository.saveSession(session);
    await this.repository.setActiveSession(null);

    return session;
  }
  async updateSessionRecord(
    sessionId: string,
    updates: { stakes?: string; location?: string; startedAt?: number; endedAt?: number | undefined }
  ): Promise<Session> {
    const session = await this.repository.getSessionById(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    const next: Session = { ...session };

    if (updates.stakes !== undefined) {
      const stakes = updates.stakes.trim();
      next.stakes = stakes ? stakes : undefined;
    }

    if (updates.location !== undefined) {
      const location = updates.location.trim();
      next.location = location ? location : undefined;
    }

    if (updates.startedAt !== undefined) {
      if (!Number.isFinite(updates.startedAt) || updates.startedAt <= 0) {
        throw new Error('Invalid start date/time');
      }
      next.startedAt = updates.startedAt;
    }

    if (updates.endedAt !== undefined) {
      if (!Number.isFinite(updates.endedAt) || updates.endedAt <= 0) {
        throw new Error('Invalid end date/time');
      }
      next.endedAt = updates.endedAt;
    }

    if (next.endedAt !== undefined && next.endedAt < next.startedAt) {
      throw new Error('End date/time must be after start date/time');
    }

    next.updatedAt = Date.now();

    await this.repository.saveSession(next);
    return next;
  }

  async deleteSessionRecord(sessionId: string): Promise<void> {
    await this.repository.deleteSession(sessionId);
  }
  // ---------------------------
  // Retrieval
  // ---------------------------

  async getActiveSession(): Promise<Session | null> {
    return this.repository.getActiveSession();
  }

  async getAllSessions(): Promise<Session[]> {
    return this.repository.getAllSessions();
  }

  async getCompletedSessions(): Promise<Session[]> {
    const sessions = await this.repository.getAllSessions();
    return sessions.filter(s => hasEnded(s));
  }

  // ---------------------------
  // Private Helpers
  // ---------------------------

  private async requireActiveSession(): Promise<Session> {
    const session = await this.repository.getActiveSession();
    if (!session) {
      throw new Error('No active session');
    }
    return session;
  }

  private createEvent(type: EventType, amountCents: number, note?: string, overrideTimestamp?: number): SessionEvent {
    return {
      id: generateId(),
      type,
      amount: amountCents,
      timestamp: overrideTimestamp ?? Date.now(),
      note
    };
  }

  private createExpense(amountCents: number, category: ExpenseCategory, note?: string, overrideTimestamp?: number): SessionEvent {
    return {
      id: generateId(),
      type: 'expense',
      amount: amountCents,
      timestamp: overrideTimestamp ?? Date.now(),
      category,
      note
    };
  }

}



