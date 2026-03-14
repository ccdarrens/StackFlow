import { describe, expect, it } from 'vitest';
import { hasEnded, isActive } from '../../src/models/session';
import { createSession } from '../helpers/fixtures';

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
});
