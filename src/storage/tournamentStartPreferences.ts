export interface TournamentStartPreferences {
  lastStakes: string;
  lastBuyInDollars: string;
  stakes: string[];
  buyIns: string[];
}

const TOURNAMENT_START_PREFS_KEY = 'stackflow.tournament.start.preferences.v1';
const MAX_VALUES = 8;

const EMPTY_PREFS: TournamentStartPreferences = {
  lastStakes: '',
  lastBuyInDollars: '',
  stakes: [],
  buyIns: []
};

function uniqueRecent(values: string[], nextValue: string): string[] {
  const normalized = nextValue.trim();
  if (!normalized) {
    return values;
  }

  const deduped = values.filter(v => v.trim().toLowerCase() !== normalized.toLowerCase());
  return [normalized, ...deduped].slice(0, MAX_VALUES);
}

export function loadTournamentStartPreferences(): TournamentStartPreferences {
  const raw = localStorage.getItem(TOURNAMENT_START_PREFS_KEY);
  if (!raw) {
    return { ...EMPTY_PREFS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TournamentStartPreferences>;

    return {
      lastStakes: typeof parsed.lastStakes === 'string' ? parsed.lastStakes : '',
      lastBuyInDollars: typeof parsed.lastBuyInDollars === 'string' ? parsed.lastBuyInDollars : '',
      stakes: Array.isArray(parsed.stakes) ? parsed.stakes.filter(v => typeof v === 'string').slice(0, MAX_VALUES) : [],
      buyIns: Array.isArray(parsed.buyIns) ? parsed.buyIns.filter(v => typeof v === 'string').slice(0, MAX_VALUES) : []
    };
  } catch {
    return { ...EMPTY_PREFS };
  }
}

export function saveTournamentStartPreferences(input: {
  stakes: string;
  buyInDollars: string;
}): TournamentStartPreferences {
  const current = loadTournamentStartPreferences();

  const next: TournamentStartPreferences = {
    lastStakes: input.stakes.trim(),
    lastBuyInDollars: input.buyInDollars.trim(),
    stakes: uniqueRecent(current.stakes, input.stakes),
    buyIns: uniqueRecent(current.buyIns, input.buyInDollars)
  };

  localStorage.setItem(TOURNAMENT_START_PREFS_KEY, JSON.stringify(next));
  return next;
}
