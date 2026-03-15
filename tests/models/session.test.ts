import { describe, expect, it } from 'vitest';
import { getActiveBreak, getSessionBreakDurationMs, getSessionDurationMs, hasEnded, isActive } from '../../src/models/session';
import { createBreak, createSession } from '../helpers/fixtures';

describe('session model helpers', () => {
  it('treats a session without endedAt as active', () => {
    const session = createSession({ endedAt: undefined });

    expect(isActive(session)).toBe(true);
    expect(hasEnded(session)).toBe(false);
  });

  it('treats a session with endedAt as ended', () => {
    const session = createSession({ endedAt: 1_700_000_200_000 });

    expect(isActive(session)).toBe(false);
    expect(hasEnded(session)).toBe(true);
  });

  it('subtracts break time from session duration', () => {
    const session = createSession({
      startedAt: 1_000,
      endedAt: 61 * 60 * 1000 + 1_000,
      breaks: [
        createBreak({ id: 'break-1', startedAt: 10 * 60 * 1000, durationMinutes: 10 }),
        createBreak({ id: 'break-2', startedAt: 40 * 60 * 1000, durationMinutes: 5 })
      ]
    });

    expect(getSessionBreakDurationMs(session, session.endedAt)).toBe(15 * 60 * 1000);
    expect(getSessionDurationMs(session, session.endedAt)).toBe(46 * 60 * 1000);
  });

  it('returns the active break based on current time', () => {
    const session = createSession({
      breaks: [
        createBreak({ id: 'break-1', startedAt: 5_000, durationMinutes: 10 }),
        createBreak({ id: 'break-2', startedAt: 20_000, durationMinutes: 5 })
      ]
    });

    expect(getActiveBreak(session, 6_000)?.id).toBe('break-1');
    expect(getActiveBreak(session, 25_000)?.id).toBe('break-2');
    expect(getActiveBreak(session, 700_000)).toBeNull();
  });
});

