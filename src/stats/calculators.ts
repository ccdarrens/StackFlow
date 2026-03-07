import type { Session } from '../models/session';

export interface SessionTotals {
  invested: number;
  returned: number;
  expenses: number;

  grossProfit: number;
  netProfit: number;

  roi?: number;      // tournament only
  netRoi?: number;   // optional
}

// -----------------------
// Lifetime Stats
// -----------------------
export interface LifetimeStats {
  totalGrossProfit: number;
  totalNetProfit: number;
  totalExpenses: number;
  totalDurationMs: number;

  hourlyGross?: number; // profit per hour on gross
  hourlyNet?: number; // profit per hour on net
}

export function calculateSessionTotals(session: Session): SessionTotals {

  let invested = 0;
  let returned = 0;
  let expenses = 0;

  for (const event of session.events) {
    switch (event.type) {
      case 'investment':
        invested += event.amount;
        break;

      case 'return':
        returned += event.amount;
        break;

      case 'expense':
        expenses += event.amount;
        break;
    }
  }

  const grossProfit = returned - invested;
  const netProfit = grossProfit - expenses;

  let roi: number | undefined;
  let netRoi: number | undefined;

  if (session.mode === 'tournament' && invested > 0) {
    roi = grossProfit / invested;
    netRoi = netProfit / invested;
  }

  return {
    invested,
    returned,
    expenses,
    grossProfit,
    netProfit,
    roi,
    netRoi,
  };
}

export function calculateLifetimeStats(sessions: Session[]): LifetimeStats {
  let totalGrossProfit = 0;
  let totalNetProfit = 0;
  let totalExpenses = 0;
  let totalDurationMs = 0;

  for (const s of sessions) {
    if (!s.startedAt || !s.endedAt) {
      continue;
    }
    const totals = calculateSessionTotals(s);
    totalGrossProfit += totals.grossProfit;
    totalNetProfit += totals.netProfit;
    totalExpenses += totals.expenses;
    totalDurationMs += s.endedAt - s.startedAt;
  }

  const totalHours = totalDurationMs / (1000 * 60 * 60);
  const hourlyGross = totalHours > 0 ? totalGrossProfit / totalHours : undefined;
  const hourlyNet = totalHours > 0 ? totalNetProfit / totalHours : undefined;

  return { 
    totalGrossProfit, 
    totalNetProfit, 
    totalExpenses, 
    totalDurationMs, 
    hourlyGross, 
    hourlyNet 
  };
}