import type { Session } from '../models/session';
import type { EventType, ExpenseCategory, SessionEvent } from '../models/event';
import { LocalStorageRepository } from '../storage/localStorageRepository';
import type { SessionRepository } from '../storage/repository';
import { hasEnded, isActive } from '../models/session';
import { generateId } from '../utils/id';

export interface SessionService {

  createCashSession(stakes?: string, location?: string, initialBuyInCents?: number, startedAtOverride?: number): Promise<Session>;

  createTournamentSession(stakes?: string, location?: string, buyInCents?: number): Promise<Session>;

  addInvestment(amountCents: number, note?: string): Promise<Session>;
  
  addReturn(amountCents: number, note?: string): Promise<Session>;

  addExpense(amountCents: number, category: ExpenseCategory, note?: string): Promise<Session>;

  endSession(overrideTimestamp?: number): Promise<Session>;

  getActiveSession(): Promise<Session | null>;

  getAllSessions(): Promise<Session[]>;

  getCompletedSessions(): Promise<Session[]>;
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

  async createTournamentSession(stakes?: string, location?: string, buyInCents: number = 0): Promise<Session> {

    const existing = await this.repository.getActiveSession();
    if (existing) {
      throw new Error('An active session already exists');
    }

    const now = Date.now();

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

  async addReturn(amountCents: number, note?: string): Promise<Session> {
    const session = await this.requireActiveSession();
    if (!isActive(session)) {
      throw new Error('Cannot add return to closed session');
    }

    if (amountCents !== undefined && amountCents < 0) {
      throw new Error('Amount must be positive');
    }

    session.events.push(this.createEvent('return', amountCents, note));
    session.updatedAt = Date.now();

    await this.repository.saveSession(session);

    return session;
  }

  async addExpense(amountCents: number, category: ExpenseCategory, note?: string): Promise<Session> {
    const session = await this.requireActiveSession();
    if (!isActive(session)) {
      throw new Error('Cannot add expense to closed session');
    }

    if (amountCents !== undefined && amountCents < 0) {
      throw new Error('Amount must be positive');
    }

    session.events.push(this.createExpense(amountCents, category, note));
    session.updatedAt = Date.now();

    await this.repository.saveSession(session);

    return session;
  }

  async addInvestment(amountCents: number, note?: string): Promise<Session> {
    const session = await this.requireActiveSession();
    if (!isActive(session)) {
      throw new Error('Cannot add investment to closed session');
    }

    if (amountCents !== undefined && amountCents < 0) {
      throw new Error('Amount must be positive');
    }

    session.events.push(this.createEvent('investment', amountCents, note));
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

  private createEvent(type: EventType, amountCents: number, note?: string): SessionEvent {
    return {
      id: generateId(),
      type,
      amount: amountCents,
      timestamp: Date.now(),
      note
    };
  }

    private createExpense(amountCents: number, category: ExpenseCategory, note?: string): SessionEvent {
    return {
      id: generateId(),
      type: 'expense',
      amount: amountCents,
      timestamp: Date.now(),
      category: category,
      note
    };
  }

}


