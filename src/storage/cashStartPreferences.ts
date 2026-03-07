export interface CashStartPreferences {
  lastLocation: string;
  lastStakes: string;
  lastBuyInDollars: string;
  locations: string[];
  stakes: string[];
  buyIns: string[];
}

const CASH_START_PREFS_KEY = 'stackflow.cash.start.preferences.v1';
const MAX_VALUES = 8;

const EMPTY_PREFS: CashStartPreferences = {
  lastLocation: '',
  lastStakes: '',
  lastBuyInDollars: '',
  locations: [],
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

export function loadCashStartPreferences(): CashStartPreferences {
  const raw = localStorage.getItem(CASH_START_PREFS_KEY);
  if (!raw) {
    return { ...EMPTY_PREFS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CashStartPreferences>;

    return {
      lastLocation: typeof parsed.lastLocation === 'string' ? parsed.lastLocation : '',
      lastStakes: typeof parsed.lastStakes === 'string' ? parsed.lastStakes : '',
      lastBuyInDollars: typeof parsed.lastBuyInDollars === 'string' ? parsed.lastBuyInDollars : '',
      locations: Array.isArray(parsed.locations) ? parsed.locations.filter(v => typeof v === 'string').slice(0, MAX_VALUES) : [],
      stakes: Array.isArray(parsed.stakes) ? parsed.stakes.filter(v => typeof v === 'string').slice(0, MAX_VALUES) : [],
      buyIns: Array.isArray(parsed.buyIns) ? parsed.buyIns.filter(v => typeof v === 'string').slice(0, MAX_VALUES) : []
    };
  } catch {
    return { ...EMPTY_PREFS };
  }
}

export function saveCashStartPreferences(input: {
  location: string;
  stakes: string;
  buyInDollars: string;
}): CashStartPreferences {
  const current = loadCashStartPreferences();

  const next: CashStartPreferences = {
    lastLocation: input.location.trim(),
    lastStakes: input.stakes.trim(),
    lastBuyInDollars: input.buyInDollars.trim(),
    locations: uniqueRecent(current.locations, input.location),
    stakes: uniqueRecent(current.stakes, input.stakes),
    buyIns: uniqueRecent(current.buyIns, input.buyInDollars)
  };

  localStorage.setItem(CASH_START_PREFS_KEY, JSON.stringify(next));
  return next;
}

export function saveCashLocationPreference(location: string): CashStartPreferences {
  const current = loadCashStartPreferences();

  const next: CashStartPreferences = {
    ...current,
    lastLocation: location.trim(),
    locations: uniqueRecent(current.locations, location)
  };

  localStorage.setItem(CASH_START_PREFS_KEY, JSON.stringify(next));
  return next;
}
