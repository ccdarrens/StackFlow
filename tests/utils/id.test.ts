import { describe, expect, it, vi } from 'vitest';

describe('generateId', () => {
  it('delegates to crypto.randomUUID', async () => {
    const randomUUID = vi.fn(() => 'uuid-123');
    vi.stubGlobal('crypto', { randomUUID });

    const { generateId } = await import('../../src/utils/id');

    expect(generateId()).toBe('uuid-123');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
