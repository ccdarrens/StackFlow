import { beforeEach, describe, expect, it } from 'vitest';
import { createSession } from '../helpers/fixtures';
import { LocalStorageRepository } from '../../src/storage/localStorageRepository';
import { STORAGE_KEY } from '../../src/storage/repository';

describe('LocalStorageRepository', () => {
  let repository: LocalStorageRepository;

  beforeEach(() => {
    localStorage.clear();
    repository = new LocalStorageRepository();
  });

  it('initializes empty storage when none exists', async () => {
    const sessions = await repository.getAllSessions();

    expect(sessions).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({
      sessions: [],
      activeSessionId: null
    }));
  });

  it('saves a new session and updates an existing one by id', async () => {
    const first = createSession({ id: 'session-1', stakes: '1/2' });
    const updated = createSession({ id: 'session-1', stakes: '2/5' });

    await repository.saveSession(first);
    await repository.saveSession(updated);

    await expect(repository.getAllSessions()).resolves.toEqual([updated]);
  });

  it('deletes a session and clears the active session if needed', async () => {
    const session = createSession({ id: 'active-session' });
    await repository.saveSession(session);
    await repository.setActiveSession(session.id);

    await repository.deleteSession(session.id);

    await expect(repository.getAllSessions()).resolves.toEqual([]);
    await expect(repository.getActiveSession()).resolves.toBeNull();
  });

  it('rejects setting an active session for an unknown id', async () => {
    await expect(repository.setActiveSession('missing')).rejects.toThrow('Cannot set active session: session not found');
  });

  it('resets invalid storage structure', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));

    await expect(repository.getAllSessions()).resolves.toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({
      sessions: [],
      activeSessionId: null
    }));
  });

  it('resets malformed json storage', async () => {
    localStorage.setItem(STORAGE_KEY, '{');

    await expect(repository.getAllSessions()).resolves.toEqual([]);
  });
});
