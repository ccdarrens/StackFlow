import { beforeEach, describe, expect, it } from 'vitest';
import {
  attachSheetCloseHandlers,
  formatDateTimeLocal,
  formatDuration,
  parseDollarsToCents
} from '../../src/ui/viewHelpers';

describe('viewHelpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('formats durations with or without days', () => {
    expect(formatDuration(3_723_000)).toBe('01:02:03');
    expect(formatDuration(90_061_000)).toBe('1d 01:01:01');
    expect(formatDuration(-1)).toBe('00:00:00');
  });

  it('formats a date for datetime-local inputs', () => {
    const date = new Date(2026, 2, 14, 9, 5);

    expect(formatDateTimeLocal(date)).toBe('2026-03-14T09:05');
  });

  it('parses dollar strings into cents with validation', () => {
    expect(parseDollarsToCents(' $1,234.56 ')).toBe(123_456);
    expect(parseDollarsToCents('0')).toBeNull();
    expect(parseDollarsToCents('0', true)).toBe(0);
    expect(parseDollarsToCents('12.345')).toBeNull();
    expect(parseDollarsToCents('100', false, 50)).toBeNull();
  });

  it('closes sheets on cancel button, backdrop click, and escape key', () => {
    const backdrop = document.createElement('div');
    const button = document.createElement('button');
    backdrop.appendChild(button);
    document.body.appendChild(backdrop);

    const close = attachSheetCloseHandlers(backdrop, button);

    expect(document.body.contains(backdrop)).toBe(true);

    button.click();
    expect(document.body.contains(backdrop)).toBe(false);

    document.body.appendChild(backdrop);
    attachSheetCloseHandlers(backdrop, button);
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.body.contains(backdrop)).toBe(false);

    document.body.appendChild(backdrop);
    close();
    document.body.appendChild(backdrop);
    attachSheetCloseHandlers(backdrop, button);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.contains(backdrop)).toBe(false);
  });
});
