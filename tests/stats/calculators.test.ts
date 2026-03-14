import { describe, expect, it } from 'vitest';
import { calculateLifetimeStats, calculateSessionTotals } from '../../src/stats/calculators';
import { createEvent, createSession } from '../helpers/fixtures';

describe('calculateSessionTotals', () => {
  it('aggregates cash-session totals', () => {
    const session = createSession({
      mode: 'cash',
      events: [
        createEvent({ type: 'investment', amount: 10_000 }),
        createEvent({ id: 'e2', type: 'investment', amount: 5_000 }),
        createEvent({ id: 'e3', type: 'return', amount: 18_000 }),
        createEvent({ id: 'e4', type: 'expense', amount: 500, category: 'food' })
      ]
    });

    expect(calculateSessionTotals(session)).toEqual({
      invested: 15_000,
      returned: 18_000,
      expenses: 500,
      grossProfit: 3_000,
      netProfit: 2_500,
      roi: undefined,
      netRoi: undefined
    });
  });

  it('calculates tournament roi when there is an investment', () => {
    const session = createSession({
      mode: 'tournament',
      events: [
        createEvent({ type: 'investment', amount: 20_000 }),
        createEvent({ id: 'e2', type: 'return', amount: 35_000 }),
        createEvent({ id: 'e3', type: 'expense', amount: 1_000, category: 'travel' })
      ]
    });

    expect(calculateSessionTotals(session)).toEqual({
      invested: 20_000,
      returned: 35_000,
      expenses: 1_000,
      grossProfit: 15_000,
      netProfit: 14_000,
      roi: 0.75,
      netRoi: 0.7
    });
  });
});

describe('calculateLifetimeStats', () => {
  it('sums completed session metrics and hourly rates', () => {
    const sessions = [
      createSession({
        startedAt: 1_000,
        endedAt: 60 * 60 * 1000 + 1_000,
        events: [
          createEvent({ type: 'investment', amount: 10_000 }),
          createEvent({ id: 'e2', type: 'return', amount: 14_000 }),
          createEvent({ id: 'e3', type: 'expense', amount: 500, category: 'tip' })
        ]
      }),
      createSession({
        id: 'session-2',
        startedAt: 60 * 60 * 1000 + 1_000,
        endedAt: 3 * 60 * 60 * 1000 + 1_000,
        events: [
          createEvent({ id: 'e4', type: 'investment', amount: 5_000 }),
          createEvent({ id: 'e5', type: 'return', amount: 2_000 })
        ]
      }),
      createSession({
        id: 'session-3',
        startedAt: 4 * 60 * 60 * 1000,
        endedAt: undefined,
        events: [createEvent({ id: 'e6', type: 'investment', amount: 2_000 })]
      })
    ];

    expect(calculateLifetimeStats(sessions)).toEqual({
      totalGrossProfit: 1_000,
      totalNetProfit: 500,
      totalExpenses: 500,
      totalDurationMs: 3 * 60 * 60 * 1000,
      hourlyGross: 1000 / 3,
      hourlyNet: 500 / 3
    });
  });

  it('returns undefined hourly stats when there is no completed duration', () => {
    const sessions = [createSession({ endedAt: undefined })];

    expect(calculateLifetimeStats(sessions)).toEqual({
      totalGrossProfit: 0,
      totalNetProfit: 0,
      totalExpenses: 0,
      totalDurationMs: 0,
      hourlyGross: undefined,
      hourlyNet: undefined
    });
  });
});
