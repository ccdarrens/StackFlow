import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultSessionService } from '../../src/services/sessionService';
import type { SessionRepository } from '../../src/storage/repository';
import type { Session } from '../../src/models/session';
import { createBreak, createSession } from '../helpers/fixtures';

class InMemoryRepository implements SessionRepository {
  public sessions: Session[] = [];
  public activeSessionId: string | null = null;

  async getAllSessions(): Promise<Session[]> {
    return this.sessions.map(session => structuredClone(session));
  }

  async getSessionById(id: string): Promise<Session | undefined> {
    const session = this.sessions.find(item => item.id === id);
    return session ? structuredClone(session) : undefined;
  }

  async saveSession(session: Session): Promise<void> {
    const index = this.sessions.findIndex(item => item.id === session.id);
    const next = structuredClone(session);

    if (index >= 0) {
      this.sessions[index] = next;
    } else {
      this.sessions.push(next);
    }
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions = this.sessions.filter(item => item.id !== id);
    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }
  }

  async getActiveSession(): Promise<Session | null> {
    if (!this.activeSessionId) {
      return null;
    }

    return this.getSessionById(this.activeSessionId) ?? null;
  }

  async setActiveSession(id: string | null): Promise<void> {
    this.activeSessionId = id;
  }
}

describe('DefaultSessionService', () => {
  let repository: InMemoryRepository;
  let service: DefaultSessionService;

  beforeEach(() => {
    repository = new InMemoryRepository();
    service = new DefaultSessionService(repository);
    vi.restoreAllMocks();
  });

  it('creates a cash session and marks it active', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const session = await service.createCashSession('1/3', 'Aria', 15_000);

    expect(session.mode).toBe('cash');
    expect(session.events).toHaveLength(1);
    expect(session.breaks).toEqual([]);
    expect(session.events[0]?.type).toBe('investment');
    expect(await service.getActiveSession()).toMatchObject({ id: session.id });
  });

  it('prevents creating a new session when one is already active', async () => {
    await service.createCashSession();

    await expect(service.createTournamentSession()).rejects.toThrow('An active session already exists');
  });

  it('adds investment, return, and expense events to the active session', async () => {
    const session = await service.createCashSession();

    await service.addInvestment(2_000, 'reload', 100);
    await service.addReturn(3_000, 'cashout', 200);
    await service.addExpense(500, 'tip', 'dealer', 300);

    const updated = await repository.getSessionById(session.id);
    expect(updated?.events.map(event => event.type)).toEqual(['investment', 'return', 'expense']);
  });

  it('adds a dedicated break to the active session', async () => {
    const session = await service.createTournamentSession(undefined, undefined, 0, 1_700_000_000_000);

    const updated = await service.addBreak(15, 1_700_000_060_000);

    expect(updated.breaks).toHaveLength(1);
    expect(updated.breaks?.[0]).toMatchObject({ durationMinutes: 15, startedAt: 1_700_000_060_000 });
    expect((await repository.getSessionById(session.id))?.breaks).toHaveLength(1);
  });

  it('rejects overlapping breaks', async () => {
    await repository.saveSession(createSession({
      id: 'active-1',
      startedAt: 1_000,
      breaks: [createBreak({ id: 'break-1', startedAt: 5 * 60 * 1000, durationMinutes: 15 })]
    }));
    await repository.setActiveSession('active-1');

    await expect(service.addBreak(10, 10 * 60 * 1000)).rejects.toThrow('Breaks cannot overlap');
  });

  it('ends the active session and clears the active id', async () => {
    const session = await service.createCashSession();

    const ended = await service.endSession(1_700_000_100_000);

    expect(ended.endedAt).toBe(1_700_000_100_000);
    expect(await service.getActiveSession()).toBeNull();
    expect(repository.activeSessionId).toBeNull();
    expect((await repository.getSessionById(session.id))?.endedAt).toBe(1_700_000_100_000);
  });

  it('records optional tournament results when ending a tournament', async () => {
    const session = await service.createTournamentSession();

    const ended = await service.endSession(1_700_000_100_000, {
      finishPosition: 12,
      totalEntries: 186
    });

    expect(ended).toMatchObject({
      id: session.id,
      finishPosition: 12,
      totalEntries: 186
    });
    expect(await service.getActiveSession()).toBeNull();
  });

  it('creates a completed session record with buyin and payout events', async () => {
    const created = await service.createCompletedSessionRecord({
      mode: 'tournament',
      startedAt: 100,
      endedAt: 200,
      stakes: 'Daily $120',
      location: 'Resorts World',
      buyInCents: 12_000,
      returnCents: 45_000,
      finishPosition: 3,
      totalEntries: 94
    });

    expect(created.events).toHaveLength(2);
    expect(created.breaks).toEqual([]);
    expect(created.finishPosition).toBe(3);
    expect(created.totalEntries).toBe(94);
    expect(created.events[0]?.note).toBe('buyin');
    expect(created.events[1]?.note).toBe('payout');
  });

  it('updates session record fields and timestamps', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(999_999);
    const session = createSession({ id: 'session-1', startedAt: 100, endedAt: 200, updatedAt: 300 });
    await repository.saveSession(session);

    const updated = await service.updateSessionRecord('session-1', {
      stakes: ' 2/5 ',
      location: ' Bellagio ',
      startedAt: 110,
      endedAt: 220
    });

    expect(updated).toMatchObject({
      stakes: '2/5',
      location: 'Bellagio',
      startedAt: 110,
      endedAt: 220,
      updatedAt: 999_999
    });
  });

  it('updates and clears tournament result fields', async () => {
    const session = createSession({ id: 'session-1', mode: 'tournament', startedAt: 100, endedAt: 200 });
    await repository.saveSession(session);

    const updated = await service.updateSessionRecord('session-1', {
      finishPosition: 7,
      totalEntries: 72
    });

    expect(updated.finishPosition).toBe(7);
    expect(updated.totalEntries).toBe(72);

    const cleared = await service.updateSessionRecord('session-1', {
      finishPosition: null,
      totalEntries: null
    });

    expect(cleared.finishPosition).toBeUndefined();
    expect(cleared.totalEntries).toBeUndefined();
  });

  it('filters completed sessions from all sessions', async () => {
    await repository.saveSession(createSession({ id: 'ended', endedAt: 100 }));
    await repository.saveSession(createSession({ id: 'active', endedAt: undefined }));

    await expect(service.getCompletedSessions()).resolves.toEqual([
      expect.objectContaining({ id: 'ended' })
    ]);
  });

  it('merges imported session records by always using the imported version on id matches', async () => {
    await repository.saveSession(createSession({ id: 'existing', stakes: '1/2', updatedAt: 100 }));

    const result = await service.mergeSessionRecords([
      createSession({ id: 'existing', stakes: '5/10', updatedAt: 50, breaks: [createBreak({ id: 'break-imported' })] }),
      createSession({ id: 'new-session', updatedAt: 200 })
    ]);

    expect(result).toEqual({ added: 1, overwritten: 1 });
    expect((await repository.getSessionById('existing'))?.stakes).toBe('5/10');
    expect((await repository.getSessionById('existing'))?.breaks?.[0]?.id).toBe('break-imported');
    expect((await repository.getSessionById('new-session'))?.id).toBe('new-session');
  });

  it('rejects invalid record updates', async () => {
    await repository.saveSession(createSession({ id: 'session-1', startedAt: 100, endedAt: 200 }));

    await expect(service.updateSessionRecord('session-1', { startedAt: -1 })).rejects.toThrow('Invalid start date/time');
    await expect(service.updateSessionRecord('session-1', { endedAt: 50 })).rejects.toThrow('End date/time must be after start date/time');
  });

  it('rejects invalid tournament result fields', async () => {
    await repository.saveSession(createSession({ id: 'tournament-1', mode: 'tournament', startedAt: 100, endedAt: 200 }));
    await repository.saveSession(createSession({ id: 'cash-1', mode: 'cash', startedAt: 100, endedAt: 200 }));

    await expect(service.updateSessionRecord('tournament-1', { finishPosition: 5 })).rejects.toThrow('Enter both finish position and total entries');
    await expect(service.updateSessionRecord('tournament-1', { finishPosition: 8, totalEntries: 7 })).rejects.toThrow('Finish position cannot be greater than total entries');
    await expect(service.updateSessionRecord('cash-1', { finishPosition: 1, totalEntries: 10 })).rejects.toThrow('Tournament results can only be recorded');
  });

  it('rejects tournament result fields on completed cash records', async () => {
    await expect(service.createCompletedSessionRecord({
      mode: 'cash',
      startedAt: 100,
      endedAt: 200,
      buyInCents: 10_000,
      returnCents: 12_000,
      finishPosition: 1,
      totalEntries: 10
    })).rejects.toThrow('Tournament results can only be recorded');
  });
});
