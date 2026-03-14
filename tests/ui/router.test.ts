import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('router', () => {
  beforeEach(() => {
    window.location.hash = '';
    vi.resetModules();
  });

  it('parses the current route from the hash', async () => {
    window.location.hash = '#stats';
    const { getCurrentRoute } = await import('../../src/ui/router');

    expect(getCurrentRoute()).toBe('stats');
  });

  it('initializes with the current route and reacts to hash changes', async () => {
    window.location.hash = '#sessions';
    const { initRouter } = await import('../../src/ui/router');
    const listener = vi.fn();

    initRouter(listener);
    expect(listener).toHaveBeenCalledWith('sessions');

    window.location.hash = '#stats';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(listener).toHaveBeenLastCalledWith('stats');
  });

  it('forces a listener callback when navigating to the current route', async () => {
    const { initRouter, navigate } = await import('../../src/ui/router');
    const listener = vi.fn();

    window.location.hash = '#start';
    initRouter(listener);
    listener.mockClear();

    navigate('start');

    expect(listener).toHaveBeenCalledWith('start');
  });
});
