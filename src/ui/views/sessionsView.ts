import Chart from 'chart.js/auto';
import type { SessionService } from '../../services/sessionService';
import type { Session } from '../../models/session';
import { calculateSessionTotals } from '../../stats/calculators';
import { navigate } from '../router';

type SessionFilterType = 'all' | 'cash' | 'tournament';
type DateRangeFilter = 'all' | 'this_year' | 'this_month' | 'last_30_days' | 'last_90_days' | 'last_month' | 'last_year';
type ExportFormat = 'json' | 'csv';

type SortKey = 'profit' | 'date' | 'hours' | 'location' | 'type';
type SortDirection = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

interface SessionsFilters {
  type: SessionFilterType;
  location: string;
  dateRange: DateRangeFilter;
}

const SESSIONS_FILTERS_KEY = 'stackflow.sessions.filters.v1';
const MANUAL_ADD_DEFAULTS_KEY = 'stackflow.sessions.manualAdd.v1';
const MAX_LOCATION_LENGTH = 30;
const MAX_STAKES_LENGTH = 25;
const MAX_BUY_IN_DOLLARS = 10000000;

type ManualMode = 'cash' | 'tournament';

interface ManualAddDefaults {
  mode: ManualMode;
  startedAtLocal: string;
  endedAtLocal: string;
  stakes: string;
  location: string;
  buyInDollars: string;
  returnDollars: string;
  cashStakes: string[];
  tournamentStakes: string[];
  cashLocations: string[];
  tournamentLocations: string[];
}

function defaultFilters(): SessionsFilters {
  return {
    type: 'all',
    location: '',
    dateRange: 'all'
  };
}

function loadFilters(): SessionsFilters {
  const raw = localStorage.getItem(SESSIONS_FILTERS_KEY);
  if (!raw) {
    return defaultFilters();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionsFilters>;

    const dateRange = parsed.dateRange;
    const normalizedDateRange: DateRangeFilter =
      dateRange === 'this_year' ||
      dateRange === 'this_month' ||
      dateRange === 'last_30_days' ||
      dateRange === 'last_90_days' ||
      dateRange === 'last_month' ||
      dateRange === 'last_year'
        ? dateRange
        : 'all';

    return {
      type: parsed.type === 'cash' || parsed.type === 'tournament' ? parsed.type : 'all',
      location: typeof parsed.location === 'string' ? parsed.location : '',
      dateRange: normalizedDateRange
    };
  } catch {
    return defaultFilters();
  }
}

function saveFilters(filters: SessionsFilters): void {
  localStorage.setItem(SESSIONS_FILTERS_KEY, JSON.stringify(filters));
}


function mergeUnique(values: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const raw of values) {
    const value = raw.trim();
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(value);
  }

  return merged;
}

function toLocalInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultManualAddDefaults(): ManualAddDefaults {
  const now = Date.now();
  return {
    mode: 'cash',
    startedAtLocal: toLocalInputValue(now),
    endedAtLocal: toLocalInputValue(now),
    stakes: '',
    location: '',
    buyInDollars: '',
    returnDollars: '0',
    cashStakes: [],
    tournamentStakes: [],
    cashLocations: [],
    tournamentLocations: []
  };
}

function loadManualAddDefaults(): ManualAddDefaults {
  const raw = localStorage.getItem(MANUAL_ADD_DEFAULTS_KEY);
  if (!raw) {
    return defaultManualAddDefaults();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ManualAddDefaults>;
    const defaults = defaultManualAddDefaults();

    return {
      mode: parsed.mode === 'tournament' ? 'tournament' : 'cash',
      startedAtLocal: typeof parsed.startedAtLocal === 'string' ? parsed.startedAtLocal : defaults.startedAtLocal,
      endedAtLocal: typeof parsed.endedAtLocal === 'string' ? parsed.endedAtLocal : defaults.endedAtLocal,
      stakes: typeof parsed.stakes === 'string' ? parsed.stakes : '',
      location: typeof parsed.location === 'string' ? parsed.location : '',
      buyInDollars: typeof parsed.buyInDollars === 'string' ? parsed.buyInDollars : '',
      returnDollars: typeof parsed.returnDollars === 'string' ? parsed.returnDollars : '0',
      cashStakes: Array.isArray(parsed.cashStakes) ? parsed.cashStakes.filter(item => typeof item === 'string') : [],
      tournamentStakes: Array.isArray(parsed.tournamentStakes) ? parsed.tournamentStakes.filter(item => typeof item === 'string') : [],
      cashLocations: Array.isArray(parsed.cashLocations) ? parsed.cashLocations.filter(item => typeof item === 'string') : [],
      tournamentLocations: Array.isArray(parsed.tournamentLocations) ? parsed.tournamentLocations.filter(item => typeof item === 'string') : []
    };
  } catch {
    return defaultManualAddDefaults();
  }
}

function saveManualAddDefaults(defaults: ManualAddDefaults): void {
  localStorage.setItem(MANUAL_ADD_DEFAULTS_KEY, JSON.stringify(defaults));
}

function parseDollarsToCents(rawValue: string, allowZero = false): number | null {
  const normalized = rawValue.replace(/[$,\s]/g, '');
  if (!normalized) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  const min = allowZero ? 0 : Number.EPSILON;
  if (!Number.isFinite(amount) || amount < min || amount > MAX_BUY_IN_DOLLARS) {
    return null;
  }

  return Math.round(amount * 100);
}
function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatProfitMoney(cents: number): string {
  const isNegative = cents < 0;
  const wholeDollars = Math.round(Math.abs(cents) / 100);
  return (isNegative ? '-' : '') + '$' + wholeDollars.toLocaleString();
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit'
  });
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatDateTimeLocal(value: number): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function escapeHtml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#39;');
}

function sessionHours(session: Session): number {
  if (!session.endedAt || session.endedAt <= session.startedAt) {
    return 0;
  }

  return (session.endedAt - session.startedAt) / (1000 * 60 * 60);
}

function formatHours(hours: number): string {
  return hours.toFixed(2);
}

function formatHoursClock(hours: number): string {
  const totalMinutes = Math.max(0, Math.floor(hours * 60));
  const hh = Math.floor(totalMinutes / 60).toString();
  const mm = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function profitClass(value: number): string {
  if (value > 0) return 'sessions-profit-positive';
  if (value < 0) return 'sessions-profit-negative';
  return 'sessions-profit-neutral';
}

function getDateRangeBounds(range: DateRangeFilter): { startMs: number | null; endMs: number | null } {
  const now = new Date();

  switch (range) {
    case 'all':
      return { startMs: null, endMs: null };
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { startMs: start.getTime(), endMs: null };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { startMs: start.getTime(), endMs: null };
    }
    case 'last_30_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { startMs: start.getTime(), endMs: null };
    }
    case 'last_90_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return { startMs: start.getTime(), endMs: null };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
    case 'last_year': {
      const start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
  }
}

function matchesFilters(session: Session, filters: SessionsFilters): boolean {
  if (filters.type !== 'all' && session.mode !== filters.type) {
    return false;
  }

  const location = (session.location ?? '').trim();
  if (filters.location && location !== filters.location) {
    return false;
  }

  const range = getDateRangeBounds(filters.dateRange);
  if (range.startMs !== null && session.startedAt < range.startMs) {
    return false;
  }
  if (range.endMs !== null && session.startedAt >= range.endMs) {
    return false;
  }

  return true;
}


function collectLocations(sessions: Session[]): string[] {
  const seen = new Set<string>();
  const locations: string[] = [];

  for (const session of sessions) {
    const location = (session.location ?? '').trim();
    if (!location) {
      continue;
    }

    const key = location.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    locations.push(location);
  }

  return locations.sort((a, b) => a.localeCompare(b));
}
function collectStakes(sessions: Session[]): string[] {
  const seen = new Set<string>();
  const stakes: string[] = [];

  for (const session of sessions) {
    const value = (session.stakes ?? '').trim();
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    stakes.push(value);
  }

  return stakes.sort((a, b) => a.localeCompare(b));
}

function csvCell(value: string | number | undefined): string {
  const raw = value === undefined ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildSessionsCsv(sessions: Session[]): string {
  const headers = [
    'id',
    'type',
    'location',
    'stakes',
    'started_at_iso',
    'ended_at_iso',
    'duration_hours',
    'event_count',
    'invested_cents',
    'returned_cents',
    'expenses_cents',
    'gross_profit_cents',
    'net_profit_cents',
    'roi_percent',
    'net_roi_percent'
  ];

  const lines = [headers.join(',')];

  for (const session of sessions) {
    const totals = calculateSessionTotals(session);
    const row = [
      csvCell(session.id),
      csvCell(session.mode === 'cash' ? 'Cash' : 'Tournament'),
      csvCell(session.location ?? ''),
      csvCell(session.stakes ?? ''),
      csvCell(new Date(session.startedAt).toISOString()),
      csvCell(session.endedAt ? new Date(session.endedAt).toISOString() : ''),
      csvCell(formatHours(sessionHours(session))),
      csvCell(session.events.length),
      csvCell(totals.invested),
      csvCell(totals.returned),
      csvCell(totals.expenses),
      csvCell(totals.grossProfit),
      csvCell(totals.netProfit),
      csvCell(totals.roi === undefined ? '' : (totals.roi * 100).toFixed(2)),
      csvCell(totals.netRoi === undefined ? '' : (totals.netRoi * 100).toFixed(2))
    ];

    lines.push(row.join(','));
  }

  return lines.join('\n');
}

function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function renderSessionsView(service: SessionService): Promise<HTMLElement> {
  let completed = (await service.getCompletedSessions())
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt);

  const locations = collectLocations(completed);
  const filters = loadFilters();

  if (filters.location && !locations.includes(filters.location)) {
    filters.location = '';
  }

  const container = document.createElement('div');
  container.className = 'app-container';

  container.innerHTML = `
    <div class="sessions-card">
      <div class="sessions-titlebar">
        <button id="sessionsBack" class="sessions-back-btn" type="button" aria-label="Back to start">&larr;</button>
        <h2>Past Sessions</h2>
      </div>

      <p id="sessionsNoRecords" class="sessions-empty sessions-empty-banner" hidden>No sessions have been created yet.</p>

      <div class="sessions-filters">
        <div class="sessions-filter-field">
          <label for="sessionsTypeFilter">Type</label>
          <select id="sessionsTypeFilter">
            <option value="all">All</option>
            <option value="cash">Cash</option>
            <option value="tournament">Tournament</option>
          </select>
        </div>

        <div class="sessions-filter-field">
          <label for="sessionsLocationFilter">Location</label>
          <select id="sessionsLocationFilter">
            <option value="">All</option>
            ${locations.map(location => `<option value="${location}">${location}</option>`).join('')}
          </select>
        </div>

        <div class="sessions-filter-field">
          <label for="sessionsDateRangeFilter">Date Range</label>
          <select id="sessionsDateRangeFilter">
            <option value="all">All</option>
            <option value="this_year">This Year</option>
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_90_days">Last 90 Days</option>
            <option value="last_month">Last Month</option>
            <option value="last_year">Last Year</option>

          </select>
        </div>

        <div class="sessions-filter-export">
          <button id="sessionsExportMenuButton" class="sessions-export-icon-btn" type="button" aria-label="Export sessions">&#8595;</button>
          <button id="sessionsManualAddButton" class="sessions-export-icon-btn" type="button" aria-label="Add session">+</button>
          <div id="sessionsExportMenu" class="sessions-export-menu" hidden>
            <button type="button" data-format="json">JSON</button>
            <button type="button" data-format="csv">CSV</button>
          </div>
        </div>
      </div>


      <div class="sessions-grid-wrap">
        <div class="sessions-grid sessions-grid-header">
          <div class="sessions-mode-col" aria-label="Mode"></div>
          <div><button type="button" class="sessions-sort-btn" data-sort-key="profit">Profit</button></div>
          <div><button type="button" class="sessions-sort-btn" data-sort-key="date">Date</button></div>
          <div><button type="button" class="sessions-sort-btn" data-sort-key="hours">Hrs</button></div>
          <div><button type="button" class="sessions-sort-btn" data-sort-key="location">Loc</button></div>
        </div>

        <div id="sessionsGridBody" class="sessions-grid-body"></div>
      </div>

      <div class="sessions-footer">
        <div class="sessions-footer-item">
          <span class="sessions-footer-label">Gross Profit</span>
          <span id="sessionsGrossProfit" class="sessions-profit sessions-profit-neutral">$0.00</span>
        </div>
        <div class="sessions-footer-item">
          <span class="sessions-footer-label">Net Profit</span>
          <span id="sessionsNetProfit" class="sessions-profit sessions-profit-neutral">$0.00</span>
        </div>
        <div class="sessions-footer-item">
          <span class="sessions-footer-label">Expenses</span>
          <span id="sessionsExpenses">$0.00</span>
        </div>
        <div class="sessions-footer-item">
          <span class="sessions-footer-label">Hours</span>
          <span id="sessionsTotalHours">0.00</span>
        </div>
        <div class="sessions-footer-item">
          <span class="sessions-footer-label">Gross / Hour</span>
          <span id="sessionsGrossPerHour">$0.00</span>
        </div>
        <div class="sessions-footer-item">
          <span class="sessions-footer-label">Net / Hour</span>
          <span id="sessionsNetPerHour">$0.00</span>
        </div>
      </div>

      <div class="sessions-chart-card">
        <h3>Cumulative Profit Over Time</h3>
        <div class="sessions-chart-wrap">
          <canvas id="sessionsCumulativeChart"></canvas>
        </div>
      </div>

      <div class="sessions-chart-card">
        <h3>Profit by Day of the Week</h3>
        <div class="sessions-chart-wrap">
          <canvas id="sessionsDayOfWeekChart"></canvas>
        </div>
      </div>


      <div class="sessions-chart-card">
        <h3>Profit by Time of Day</h3>
        <div class="sessions-chart-wrap">
          <canvas id="sessionsTimeOfDayChart"></canvas>
        </div>
      </div>
      <div id="sessionsCashWinrateByStakesCard" class="sessions-chart-card" hidden>
        <h3>Cash Game Winrate by Stakes</h3>
        <div class="sessions-chart-wrap">
          <canvas id="sessionsCashWinrateByStakesChart"></canvas>
        </div>
      </div>

      <div id="sessionsCashLengthProfitCard" class="sessions-chart-card" hidden>
        <h3>Cash Game Session Length vs Profit</h3>
        <div class="sessions-chart-wrap">
          <canvas id="sessionsCashLengthProfitChart"></canvas>
        </div>
      </div>

      <div id="sessionsTournamentItmCard" class="sessions-chart-card" hidden>
        <h3>Tournament In-the-Money %</h3>
        <div class="sessions-chart-wrap sessions-chart-wrap-small">
          <canvas id="sessionsTournamentItmChart"></canvas>
        </div>
      </div>

      <div id="sessionsTournamentRoiByBuyinCard" class="sessions-chart-card" hidden>
        <h3>Tournament ROI by Buy-in Level</h3>
        <div class="sessions-chart-wrap">
          <canvas id="sessionsTournamentRoiByBuyinChart"></canvas>
        </div>
      </div>

      <p id="sessionsEmpty" class="sessions-empty" hidden>No sessions found for the selected filters.</p>
    </div>
  `;

  const backButton = container.querySelector('#sessionsBack') as HTMLButtonElement;
  const typeSelect = container.querySelector('#sessionsTypeFilter') as HTMLSelectElement;
  const locationSelect = container.querySelector('#sessionsLocationFilter') as HTMLSelectElement;
  const dateRangeSelect = container.querySelector('#sessionsDateRangeFilter') as HTMLSelectElement;
  const exportMenuButton = container.querySelector('#sessionsExportMenuButton') as HTMLButtonElement;
  const manualAddButton = container.querySelector('#sessionsManualAddButton') as HTMLButtonElement;
  const exportMenu = container.querySelector('#sessionsExportMenu') as HTMLDivElement;
  const exportMenuItems = Array.from(container.querySelectorAll('#sessionsExportMenu button')) as HTMLButtonElement[];
  const sortButtons = Array.from(container.querySelectorAll('.sessions-sort-btn')) as HTMLButtonElement[];
  const body = container.querySelector('#sessionsGridBody') as HTMLDivElement;
  const noRecords = container.querySelector('#sessionsNoRecords') as HTMLParagraphElement;
  const empty = container.querySelector('#sessionsEmpty') as HTMLParagraphElement;
  const cumulativeCanvas = container.querySelector('#sessionsCumulativeChart') as HTMLCanvasElement;
  const dayOfWeekCanvas = container.querySelector('#sessionsDayOfWeekChart') as HTMLCanvasElement;
  const timeOfDayCanvas = container.querySelector('#sessionsTimeOfDayChart') as HTMLCanvasElement;
  const cashWinrateByStakesCard = container.querySelector('#sessionsCashWinrateByStakesCard') as HTMLDivElement;
  const cumulativeCard = cumulativeCanvas.closest('.sessions-chart-card') as HTMLDivElement;
  const dayOfWeekCard = dayOfWeekCanvas.closest('.sessions-chart-card') as HTMLDivElement;
  const timeOfDayCard = timeOfDayCanvas.closest('.sessions-chart-card') as HTMLDivElement;
  const cashWinrateByStakesCanvas = container.querySelector('#sessionsCashWinrateByStakesChart') as HTMLCanvasElement;
  const cashLengthProfitCard = container.querySelector('#sessionsCashLengthProfitCard') as HTMLDivElement;
  const cashLengthProfitCanvas = container.querySelector('#sessionsCashLengthProfitChart') as HTMLCanvasElement;
  const itmCard = container.querySelector('#sessionsTournamentItmCard') as HTMLDivElement;
  const itmCanvas = container.querySelector('#sessionsTournamentItmChart') as HTMLCanvasElement;
  const roiByBuyinCard = container.querySelector('#sessionsTournamentRoiByBuyinCard') as HTMLDivElement;
  const roiByBuyinCanvas = container.querySelector('#sessionsTournamentRoiByBuyinChart') as HTMLCanvasElement;
  const grossProfitEl = container.querySelector('#sessionsGrossProfit') as HTMLSpanElement;
  const netProfitEl = container.querySelector('#sessionsNetProfit') as HTMLSpanElement;
  const expensesEl = container.querySelector('#sessionsExpenses') as HTMLSpanElement;
  const totalHoursEl = container.querySelector('#sessionsTotalHours') as HTMLSpanElement;
  const grossPerHourEl = container.querySelector('#sessionsGrossPerHour') as HTMLSpanElement;
  const netPerHourEl = container.querySelector('#sessionsNetPerHour') as HTMLSpanElement;

  let cumulativeChart: Chart | null = null;
  let dayOfWeekChart: Chart | null = null;
  let timeOfDayChart: Chart | null = null;
  let cashWinrateByStakesChart: Chart | null = null;
  let cashLengthProfitChart: Chart | null = null;
  let itmChart: Chart | null = null;
  let roiByBuyinChart: Chart | null = null;

  let sortState: SortState = { key: 'date', direction: 'desc' };


  const compareSessions = (a: Session, b: Session): number => {
    let left: number | string;
    let right: number | string;

    switch (sortState.key) {
      case 'profit': {
        left = calculateSessionTotals(a).grossProfit;
        right = calculateSessionTotals(b).grossProfit;
        break;
      }
      case 'date': {
        left = a.startedAt;
        right = b.startedAt;
        break;
      }
      case 'hours': {
        left = sessionHours(a);
        right = sessionHours(b);
        break;
      }
      case 'location': {
        left = (a.location ?? '').toLowerCase();
        right = (b.location ?? '').toLowerCase();
        break;
      }
      case 'type': {
        left = a.mode;
        right = b.mode;
        break;
      }
    }

    const base = typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right)
      : Number(left) - Number(right);

    return sortState.direction === 'asc' ? base : -base;
  };

  const updateSortButtons = () => {
    for (const button of sortButtons) {
      const key = (button.dataset.sortKey as SortKey | undefined) ?? 'date';
      const isActive = key === sortState.key;
      const arrow = isActive ? (sortState.direction === 'asc' ? ' ^' : ' v') : '';
      const baseLabel = button.textContent?.replace(' ^', '').replace(' v', '') ?? '';
      button.textContent = `${baseLabel}${arrow}`;
      button.classList.toggle('sessions-sort-btn-active', isActive);
      button.setAttribute('aria-sort', isActive ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    }
  };
  const getActiveFilters = (): SessionsFilters => ({
    type: (typeSelect.value as SessionFilterType) || 'all',
    location: locationSelect.value,
    dateRange: (dateRangeSelect.value as DateRangeFilter) || 'all'
  });

  const getFilteredSessions = (activeFilters: SessionsFilters): Session[] => {
    return completed.filter(session => matchesFilters(session, activeFilters));
  };

  const runExport = (format: ExportFormat) => {
    const filtered = getFilteredSessions(getActiveFilters());
    if (filtered.length === 0) {
      return;
    }

    const now = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'json') {
      downloadTextFile(JSON.stringify(filtered, null, 2), `sessions-${now}.json`, 'application/json');
      return;
    }

    downloadTextFile(buildSessionsCsv(filtered), `sessions-${now}.csv`, 'text/csv;charset=utf-8');
  };

  const updateCumulativeChart = (sessions: Session[]) => {
    const chronological = sessions.slice().sort((a, b) => a.startedAt - b.startedAt);

    const labels: string[] = [];
    const cumulativeGross: number[] = [];
    const cumulativeNet: number[] = [];

    let grossRunning = 0;
    let netRunning = 0;

    for (const session of chronological) {
      const totals = calculateSessionTotals(session);
      grossRunning += totals.grossProfit;
      netRunning += totals.netProfit;

      labels.push(formatDate(session.startedAt));
      cumulativeGross.push(grossRunning / 100);
      cumulativeNet.push(netRunning / 100);
    }

    if (!cumulativeChart) {
      cumulativeChart = new Chart(cumulativeCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Cumulative Gross',
              data: cumulativeGross,
              borderColor: '#7fd78f',
              backgroundColor: 'rgba(127, 215, 143, 0.2)',
              tension: 0.25,
              pointRadius: 2,
              borderWidth: 2
            },
            {
              label: 'Cumulative Net',
              data: cumulativeNet,
              borderColor: '#c9a227',
              backgroundColor: 'rgba(201, 162, 39, 0.2)',
              tension: 0.25,
              pointRadius: 2,
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            },
            y: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            }
          }
        }
      });
      return;
    }

    cumulativeChart.data.labels = labels;
    cumulativeChart.data.datasets[0].data = cumulativeGross;
    cumulativeChart.data.datasets[1].data = cumulativeNet;
    cumulativeChart.update();
  };

  const updateDayOfWeekChart = (sessions: Session[]) => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const profits = [0, 0, 0, 0, 0, 0, 0];

    for (const session of sessions) {
      const totals = calculateSessionTotals(session);
      const dayIndex = new Date(session.startedAt).getDay();
      profits[dayIndex] += totals.grossProfit / 100;
    }

    const barBackgroundColors = profits.map(value =>
      value < 0 ? 'rgba(173, 94, 94, 0.75)' : 'rgba(127, 215, 143, 0.75)'
    );
    const barBorderColors = profits.map(value => (value < 0 ? '#ad5e5e' : '#7fd78f'));
    if (!dayOfWeekChart) {
      dayOfWeekChart = new Chart(dayOfWeekCanvas, {
        type: 'bar',
        data: {
          labels: dayLabels,
          datasets: [
            {
              label: 'Profit',
              data: profits,
              backgroundColor: barBackgroundColors,
              borderColor: barBorderColors,
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            },
            y: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            }
          }
        }
      });
      return;
    }

    dayOfWeekChart.data.datasets[0].data = profits;
    dayOfWeekChart.data.datasets[0].backgroundColor = barBackgroundColors;
    dayOfWeekChart.data.datasets[0].borderColor = barBorderColors;
    dayOfWeekChart.update();
  };
  const updateTimeOfDayChart = (sessions: Session[]) => {
    const labels = ['Daytime', 'Nighttime'];
    let daytimeProfit = 0;
    let nighttimeProfit = 0;

    for (const session of sessions) {
      const totals = calculateSessionTotals(session);
      const hour = new Date(session.startedAt).getHours();
      const isDaytime = hour >= 6 && hour < 18;

      if (isDaytime) {
        daytimeProfit += totals.grossProfit / 100;
      } else {
        nighttimeProfit += totals.grossProfit / 100;
      }
    }

    const values = [daytimeProfit, nighttimeProfit];
    const timeOfDayBackgroundColors = values.map(value =>
      value < 0 ? 'rgba(173, 94, 94, 0.75)' : 'rgba(127, 215, 143, 0.75)'
    );
    const timeOfDayBorderColors = values.map(value => (value < 0 ? '#ad5e5e' : '#7fd78f'));

    if (!timeOfDayChart) {
      timeOfDayChart = new Chart(timeOfDayCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Profit',
              data: values,
              backgroundColor: timeOfDayBackgroundColors,
              borderColor: timeOfDayBorderColors,
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            },
            y: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            }
          }
        }
      });
      return;
    }

    timeOfDayChart.data.datasets[0].data = values;
    timeOfDayChart.data.datasets[0].backgroundColor = timeOfDayBackgroundColors;
    timeOfDayChart.data.datasets[0].borderColor = timeOfDayBorderColors;
    timeOfDayChart.update();
  };


  const updateCashWinrateByStakesChart = (sessions: Session[]) => {
    const cashSessions = sessions.filter(session => session.mode === 'cash');

    if (cashSessions.length === 0) {
      cashWinrateByStakesCard.hidden = true;
      if (cashWinrateByStakesChart) {
        cashWinrateByStakesChart.destroy();
        cashWinrateByStakesChart = null;
      }
      return;
    }

    const byStakes = new Map<string, { gross: number; net: number }>();
    for (const session of cashSessions) {
      const key = (session.stakes ?? '').trim() || 'Unspecified';
      const totals = calculateSessionTotals(session);
      const existing = byStakes.get(key) ?? { gross: 0, net: 0 };
      existing.gross += totals.grossProfit;
      existing.net += totals.netProfit;
      byStakes.set(key, existing);
    }

    const labels = Array.from(byStakes.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const gross = labels.map(label => Number((byStakes.get(label)!.gross / 100).toFixed(2)));
    const net = labels.map(label => Number((byStakes.get(label)!.net / 100).toFixed(2)));

    cashWinrateByStakesCard.hidden = labels.length === 0;
    if (labels.length === 0) {
      if (cashWinrateByStakesChart) {
        cashWinrateByStakesChart.destroy();
        cashWinrateByStakesChart = null;
      }
      return;
    }

    if (!cashWinrateByStakesChart) {
      cashWinrateByStakesChart = new Chart(cashWinrateByStakesCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Gross Profit',
              data: gross,
              backgroundColor: 'rgba(127, 215, 143, 0.75)',
              borderColor: '#7fd78f',
              borderWidth: 1
            },
            {
              label: 'Net Profit',
              data: net,
              backgroundColor: 'rgba(201, 162, 39, 0.75)',
              borderColor: '#c9a227',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            },
            y: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            }
          }
        }
      });
      return;
    }

    cashWinrateByStakesChart.data.labels = labels;
    cashWinrateByStakesChart.data.datasets[0].data = gross;
    cashWinrateByStakesChart.data.datasets[1].data = net;
    cashWinrateByStakesChart.update();
  };
  const updateCashLengthVsProfitChart = (sessions: Session[]) => {
    const cashSessions = sessions.filter(session => session.mode === 'cash');

    if (cashSessions.length === 0) {
      cashLengthProfitCard.hidden = true;
      if (cashLengthProfitChart) {
        cashLengthProfitChart.destroy();
        cashLengthProfitChart = null;
      }
      return;
    }

    cashLengthProfitCard.hidden = false;

    const points = cashSessions.map(session => {
      const totals = calculateSessionTotals(session);
      return {
        x: Number(sessionHours(session).toFixed(2)),
        y: Number((totals.grossProfit / 100).toFixed(2))
      };
    });

    if (!cashLengthProfitChart) {
      cashLengthProfitChart = new Chart(cashLengthProfitCanvas, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Cash Sessions',
              data: points,
              backgroundColor: 'rgba(127, 215, 143, 0.8)',
              borderColor: '#7fd78f',
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Hours',
                color: '#F3EFE3'
              },
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            },
            y: {
              title: {
                display: true,
                text: 'Profit ($)',
                color: '#F3EFE3'
              },
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            }
          }
        }
      });
      return;
    }

    cashLengthProfitChart.data.datasets[0].data = points;
    cashLengthProfitChart.update();
  };

  const updateTournamentItmChart = (sessions: Session[]) => {
    const tournaments = sessions.filter(session => session.mode === 'tournament');

    if (tournaments.length === 0) {
      itmCard.hidden = true;

      if (itmChart) {
        itmChart.destroy();
        itmChart = null;
      }
      return;
    }

    itmCard.hidden = false;

    let inTheMoneyCount = 0;

    for (const session of tournaments) {
      const totals = calculateSessionTotals(session);
      if (totals.returned > 0) {
        inTheMoneyCount += 1;
      }
    }

    const notInTheMoneyCount = tournaments.length - inTheMoneyCount;
    const inTheMoneyPercent = (inTheMoneyCount / tournaments.length) * 100;
    const notInTheMoneyPercent = (notInTheMoneyCount / tournaments.length) * 100;

    const chartData = [
      Number(inTheMoneyPercent.toFixed(1)),
      Number(notInTheMoneyPercent.toFixed(1))
    ];

    if (!itmChart) {
      itmChart = new Chart(itmCanvas, {
        type: 'pie',
        data: {
          labels: ['In the Money', 'Not in the Money'],
          datasets: [
            {
              data: chartData,
              backgroundColor: ['#7fd78f', '#8d8d8d'],
              borderColor: ['#7fd78f', '#8d8d8d'],
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
      return;
    }

    itmChart.data.datasets[0].data = chartData;
    itmChart.update();
  };


  const updateTournamentRoiByBuyinChart = (sessions: Session[]) => {
    const tournaments = sessions.filter(session => session.mode === 'tournament');
    const grouped = new Map<number, { grossProfit: number; netProfit: number; invested: number }>();

    for (const session of tournaments) {
      const investments = session.events
        .filter(event => event.type === 'investment' && event.amount > 0)
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp);

      const buyInLevelCents = investments[0]?.amount;
      if (!buyInLevelCents) {
        continue;
      }

      const totals = calculateSessionTotals(session);
      if (totals.invested <= 0) {
        continue;
      }

      const existing = grouped.get(buyInLevelCents) ?? { grossProfit: 0, netProfit: 0, invested: 0 };
      existing.grossProfit += totals.grossProfit;
      existing.netProfit += totals.netProfit;
      existing.invested += totals.invested;
      grouped.set(buyInLevelCents, existing);
    }

    if (grouped.size === 0) {
      roiByBuyinCard.hidden = true;
      if (roiByBuyinChart) {
        roiByBuyinChart.destroy();
        roiByBuyinChart = null;
      }
      return;
    }

    roiByBuyinCard.hidden = false;

    const levels = Array.from(grouped.keys()).sort((a, b) => a - b);
    const labels = levels.map(level => formatMoney(level));
    const grossRoi = levels.map(level => {
      const data = grouped.get(level)!;
      return data.invested > 0 ? Number(((data.grossProfit / data.invested) * 100).toFixed(2)) : 0;
    });
    const netRoi = levels.map(level => {
      const data = grouped.get(level)!;
      return data.invested > 0 ? Number(((data.netProfit / data.invested) * 100).toFixed(2)) : 0;
    });

    if (!roiByBuyinChart) {
      roiByBuyinChart = new Chart(roiByBuyinCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Gross ROI %',
              data: grossRoi,
              backgroundColor: 'rgba(127, 215, 143, 0.75)',
              borderColor: '#7fd78f',
              borderWidth: 1
            },
            {
              label: 'Net ROI %',
              data: netRoi,
              backgroundColor: 'rgba(201, 162, 39, 0.75)',
              borderColor: '#c9a227',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            },
            y: {
              ticks: {
                color: '#F3EFE3',
                callback: value => `${value}%`
              },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            }
          }
        }
      });
      return;
    }

    roiByBuyinChart.data.labels = labels;
    roiByBuyinChart.data.datasets[0].data = grossRoi;
    roiByBuyinChart.data.datasets[1].data = netRoi;
    roiByBuyinChart.update();
  };


  const openManualAddSheet = () => {
    const defaults = loadManualAddDefaults();
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';

    const renderModeLabel = () => (currentMode === 'cash' ? 'Cashout Amount ($)' : 'Payout Amount ($)');
    let currentMode: ManualMode = defaults.mode;

    backdrop.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="manualAddTitle">
        <h2 id="manualAddTitle">Add Session</h2>
        <form id="manualAddForm" class="sheet-form">
          <label for="manualAddStartedAt">Start Date/Time</label>
          <input id="manualAddStartedAt" type="datetime-local" required value="${escapeHtml(defaults.startedAtLocal)}" />

          <label for="manualAddEndedAt">End Date/Time</label>
          <input id="manualAddEndedAt" type="datetime-local" required value="${escapeHtml(defaults.endedAtLocal)}" />

          <label>Mode</label>
          <div class="pill-row" id="manualAddModeToggle">
            <button type="button" class="pill-btn" data-manual-mode="cash">Cash</button>
            <button type="button" class="pill-btn" data-manual-mode="tournament">Tournament</button>
          </div>

          <label for="manualAddStakes">Stakes</label>
          <input id="manualAddStakes" type="text" maxlength="${MAX_STAKES_LENGTH}" value="${escapeHtml(defaults.stakes)}" />
          <div id="manualAddStakesPills" class="pill-row"></div>

          <label for="manualAddLocation">Location</label>
          <input id="manualAddLocation" type="text" maxlength="${MAX_LOCATION_LENGTH}" value="${escapeHtml(defaults.location)}" />
          <div id="manualAddLocationPills" class="pill-row"></div>

          <label for="manualAddBuyIn">Buy-in Amount ($)</label>
          <input id="manualAddBuyIn" type="text" inputmode="decimal" required value="${escapeHtml(defaults.buyInDollars)}" />

          <label id="manualAddReturnLabel" for="manualAddReturn">${renderModeLabel()}</label>
          <input id="manualAddReturn" type="text" inputmode="decimal" required value="${escapeHtml(defaults.returnDollars)}" />

          <p id="manualAddError" class="sheet-error"></p>

          <div class="sheet-actions">
            <button type="button" id="manualAddCancel" class="ghost-btn">Cancel</button>
            <button type="submit" id="manualAddSave" class="session-end-btn">Save Session</button>
          </div>
        </form>
      </div>
    `;

    container.appendChild(backdrop);

    const form = backdrop.querySelector('#manualAddForm') as HTMLFormElement;
    const startedAtInput = backdrop.querySelector('#manualAddStartedAt') as HTMLInputElement;
    const endedAtInput = backdrop.querySelector('#manualAddEndedAt') as HTMLInputElement;
    const stakesInput = backdrop.querySelector('#manualAddStakes') as HTMLInputElement;
    const locationInput = backdrop.querySelector('#manualAddLocation') as HTMLInputElement;
    const buyInInput = backdrop.querySelector('#manualAddBuyIn') as HTMLInputElement;
    const returnInput = backdrop.querySelector('#manualAddReturn') as HTMLInputElement;
    const returnLabel = backdrop.querySelector('#manualAddReturnLabel') as HTMLLabelElement;
    const stakesPillsHost = backdrop.querySelector('#manualAddStakesPills') as HTMLDivElement;
    const locationPillsHost = backdrop.querySelector('#manualAddLocationPills') as HTMLDivElement;
    const modeButtons = Array.from(backdrop.querySelectorAll('[data-manual-mode]')) as HTMLButtonElement[];
    const errorEl = backdrop.querySelector('#manualAddError') as HTMLParagraphElement;
    const cancelButton = backdrop.querySelector('#manualAddCancel') as HTMLButtonElement;
    const saveButton = backdrop.querySelector('#manualAddSave') as HTMLButtonElement;

    const close = () => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    const setActiveModeButton = () => {
      for (const button of modeButtons) {
        const mode = button.dataset.manualMode as ManualMode;
        const isActive = mode === currentMode;
        button.classList.toggle('pill-btn-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    };

    const renderModePills = () => {
      const sessionModeData = completed.filter(item => item.mode === currentMode);
      const modeStakes = currentMode === 'cash' ? defaults.cashStakes : defaults.tournamentStakes;
      const modeLocations = currentMode === 'cash' ? defaults.cashLocations : defaults.tournamentLocations;

      const stakesValues = mergeUnique([
        ...modeStakes,
        ...collectStakes(sessionModeData)
      ]);

      const locationValues = mergeUnique([
        ...modeLocations,
        ...collectLocations(sessionModeData)
      ]);

      stakesPillsHost.innerHTML = stakesValues
        .map(value => `<button type="button" class="pill-btn" data-manual-stakes="${escapeHtml(value)}">${escapeHtml(value)}</button>`)
        .join('');

      locationPillsHost.innerHTML = locationValues
        .map(value => `<button type="button" class="pill-btn" data-manual-location="${escapeHtml(value)}">${escapeHtml(value)}</button>`)
        .join('');

      const stakePills = Array.from(stakesPillsHost.querySelectorAll('[data-manual-stakes]')) as HTMLButtonElement[];
      const locationPills = Array.from(locationPillsHost.querySelectorAll('[data-manual-location]')) as HTMLButtonElement[];

      for (const pill of stakePills) {
        pill.addEventListener('click', () => {
          stakesInput.value = pill.dataset.manualStakes ?? '';
        });
      }

      for (const pill of locationPills) {
        pill.addEventListener('click', () => {
          locationInput.value = pill.dataset.manualLocation ?? '';
        });
      }
    };

    setActiveModeButton();
    renderModePills();

    for (const button of modeButtons) {
      button.addEventListener('click', () => {
        const mode = (button.dataset.manualMode as ManualMode | undefined) ?? 'cash';
        currentMode = mode;
        returnLabel.textContent = renderModeLabel();
        setActiveModeButton();
        renderModePills();
      });
    }

    cancelButton.addEventListener('click', close);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) {
        close();
      }
    });
    document.addEventListener('keydown', onKeyDown);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      errorEl.textContent = '';

      const startedAt = startedAtInput.value ? new Date(startedAtInput.value).getTime() : Number.NaN;
      const endedAt = endedAtInput.value ? new Date(endedAtInput.value).getTime() : Number.NaN;

      if (!Number.isFinite(startedAt)) {
        errorEl.textContent = 'Please enter a valid start date/time.';
        return;
      }

      if (!Number.isFinite(endedAt)) {
        errorEl.textContent = 'Please enter a valid end date/time.';
        return;
      }

      if (endedAt < startedAt) {
        errorEl.textContent = 'End date/time must be after start date/time.';
        return;
      }

      const buyInCents = parseDollarsToCents(buyInInput.value.trim(), true);
      if (buyInCents === null) {
        errorEl.textContent = 'Please enter a valid buy-in amount.';
        return;
      }

      const returnCents = parseDollarsToCents(returnInput.value.trim(), true);
      if (returnCents === null) {
        errorEl.textContent = 'Please enter a valid cashout/payout amount.';
        return;
      }

      saveButton.disabled = true;

      try {
        const stakes = stakesInput.value.trim();
        const location = locationInput.value.trim();

        await service.createCompletedSessionRecord({
          mode: currentMode,
          startedAt,
          endedAt,
          stakes,
          location,
          buyInCents,
          returnCents
        });

        defaults.mode = currentMode;
        defaults.startedAtLocal = startedAtInput.value;
        defaults.endedAtLocal = endedAtInput.value;
        defaults.stakes = stakes;
        defaults.location = location;
        defaults.buyInDollars = buyInInput.value.trim();
        defaults.returnDollars = returnInput.value.trim();

        if (currentMode === 'cash') {
          defaults.cashStakes = mergeUnique([stakes, ...defaults.cashStakes]);
          defaults.cashLocations = mergeUnique([location, ...defaults.cashLocations]);
        } else {
          defaults.tournamentStakes = mergeUnique([stakes, ...defaults.tournamentStakes]);
          defaults.tournamentLocations = mergeUnique([location, ...defaults.tournamentLocations]);
        }

        saveManualAddDefaults(defaults);

        close();
        navigate('sessions');
      } catch (error) {
        errorEl.textContent = error instanceof Error ? error.message : 'Failed to add session';
        saveButton.disabled = false;
      }
    });
  };
  const openSessionEditSheet = (session: Session) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';

    const eventItems = session.events
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(event => {
        const label = `${event.type} ${formatMoney(event.amount)} @ ${new Date(event.timestamp).toLocaleString()}`;
        const extras = [event.category ? `category: ${event.category}` : '', event.note ? `note: ${event.note}` : '']
          .filter(Boolean)
          .join(' | ');
        return `<li><span>${escapeHtml(label)}</span>${extras ? `<br /><small>${escapeHtml(extras)}</small>` : ''}</li>`;
      })
      .join('');

    const locationPills = collectLocations(completed)
      .map(value => `<button type="button" class="pill-btn" data-location-pill="${escapeHtml(value)}">${escapeHtml(value)}</button>`)
      .join('');
    const stakesPills = collectStakes(completed.filter(item => item.mode === session.mode))
      .map(value => `<button type="button" class="pill-btn" data-stakes-pill="${escapeHtml(value)}">${escapeHtml(value)}</button>`)
      .join('');
    const modeLabel = session.mode === 'cash' ? 'Cash' : 'Tournament';

    backdrop.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sessionEditTitle">
        <h2 id="sessionEditTitle">Edit ${modeLabel} Session</h2>
        <form id="sessionEditForm" class="sheet-form">
          <label for="sessionEditStakes">Stakes</label>
          <input id="sessionEditStakes" type="text" maxlength="25" value="${escapeHtml(session.stakes ?? '')}" />
          ${stakesPills ? `<div class="pill-row">${stakesPills}</div>` : ''}

          <label for="sessionEditLocation">Location</label>
          <input id="sessionEditLocation" type="text" maxlength="30" value="${escapeHtml(session.location ?? '')}" />
          ${locationPills ? `<div class="pill-row">${locationPills}</div>` : ''}

          <label for="sessionEditStartedAt">Start Date/Time</label>
          <input id="sessionEditStartedAt" type="datetime-local" required value="${formatDateTimeLocal(session.startedAt)}" />

          <label for="sessionEditEndedAt">End Date/Time</label>
          <input id="sessionEditEndedAt" type="datetime-local" required value="${session.endedAt ? formatDateTimeLocal(session.endedAt) : ''}" />

          <label>Events (Read-only)</label>
          <div class="session-edit-events">${eventItems ? `<ul>${eventItems}</ul>` : '<p>No events</p>'}</div>

          <p id="sessionEditError" class="sheet-error"></p>

          <div class="sheet-actions">
            <button id="sessionDeleteBtn" type="button" class="ghost-btn">Delete</button>
            <button id="sessionEditCancel" type="button" class="ghost-btn">Cancel</button>
            <button type="submit" class="session-end-btn">Update</button>
          </div>
        </form>
      </div>
    `;

    container.appendChild(backdrop);

    const form = backdrop.querySelector('#sessionEditForm') as HTMLFormElement;
    const stakesInput = backdrop.querySelector('#sessionEditStakes') as HTMLInputElement;
    const locationInput = backdrop.querySelector('#sessionEditLocation') as HTMLInputElement;
    const startedAtInput = backdrop.querySelector('#sessionEditStartedAt') as HTMLInputElement;
    const endedAtInput = backdrop.querySelector('#sessionEditEndedAt') as HTMLInputElement;
    const errorEl = backdrop.querySelector('#sessionEditError') as HTMLParagraphElement;
    const cancelBtn = backdrop.querySelector('#sessionEditCancel') as HTMLButtonElement;
    const deleteBtn = backdrop.querySelector('#sessionDeleteBtn') as HTMLButtonElement;
    const locationPillButtons = Array.from(backdrop.querySelectorAll('[data-location-pill]')) as HTMLButtonElement[];
    const stakesPillButtons = Array.from(backdrop.querySelectorAll('[data-stakes-pill]')) as HTMLButtonElement[];

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    const close = () => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
    };

    cancelBtn.addEventListener('click', close);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) {
        close();
      }
    });
    document.addEventListener('keydown', onKeyDown);

    for (const pill of locationPillButtons) {
      pill.addEventListener('click', () => {
        locationInput.value = pill.dataset.locationPill ?? '';
      });
    }

    for (const pill of stakesPillButtons) {
      pill.addEventListener('click', () => {
        stakesInput.value = pill.dataset.stakesPill ?? '';
      });
    }

    deleteBtn.addEventListener('click', async () => {
      errorEl.textContent = '';
      const confirmed = window.confirm('Delete this session record? This cannot be undone.');
      if (!confirmed) {
        return;
      }

      try {
        await service.deleteSessionRecord(session.id);
        close();
        navigate('sessions');
      } catch (error) {
        errorEl.textContent = error instanceof Error ? error.message : 'Failed to delete session';
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      errorEl.textContent = '';

      const startedAt = startedAtInput.value ? new Date(startedAtInput.value).getTime() : Number.NaN;
      const endedAt = endedAtInput.value ? new Date(endedAtInput.value).getTime() : Number.NaN;

      if (!Number.isFinite(startedAt)) {
        errorEl.textContent = 'Enter a valid start date/time';
        return;
      }

      if (!Number.isFinite(endedAt)) {
        errorEl.textContent = 'Enter a valid end date/time';
        return;
      }

      if (endedAt < startedAt) {
        errorEl.textContent = 'End date/time must be after start date/time';
        return;
      }

      try {
        await service.updateSessionRecord(session.id, {
          stakes: stakesInput.value.trim(),
          location: locationInput.value.trim(),
          startedAt,
          endedAt
        });
        close();
        navigate('sessions');
      } catch (error) {
        errorEl.textContent = error instanceof Error ? error.message : 'Failed to update session';
      }
    });
  };
  typeSelect.value = filters.type;
  locationSelect.value = filters.location;
  dateRangeSelect.value = filters.dateRange;

  const hideExportMenu = () => {
    exportMenu.hidden = true;
  };

  backButton.addEventListener('click', () => {
    if (cumulativeChart) {
      cumulativeChart.destroy();
      cumulativeChart = null;
    }

    if (dayOfWeekChart) {
      dayOfWeekChart.destroy();
      dayOfWeekChart = null;
    }

    if (timeOfDayChart) {
      timeOfDayChart.destroy();
      timeOfDayChart = null;
    }

    if (cashWinrateByStakesChart) {
      cashWinrateByStakesChart.destroy();
      cashWinrateByStakesChart = null;
    }

    if (cashLengthProfitChart) {
      cashLengthProfitChart.destroy();
      cashLengthProfitChart = null;
    }

    if (itmChart) {
      itmChart.destroy();
      itmChart = null;
    }

    if (roiByBuyinChart) {
      roiByBuyinChart.destroy();
      roiByBuyinChart = null;
    }

    navigate('start');
  });

  exportMenuButton.addEventListener('click', event => {
    event.stopPropagation();
    exportMenu.hidden = !exportMenu.hidden;
  });

  exportMenu.addEventListener('click', event => {
    event.stopPropagation();
  });

  manualAddButton.addEventListener('click', event => {
    event.stopPropagation();
    hideExportMenu();
    openManualAddSheet();
  });

  for (const item of exportMenuItems) {
    item.addEventListener('click', () => {
      const format = (item.dataset.format as ExportFormat | undefined) ?? 'json';
      hideExportMenu();
      runExport(format);
    });
  }

  container.addEventListener('click', hideExportMenu);

  const renderRows = () => {
    const activeFilters = getActiveFilters();
    saveFilters(activeFilters);

    const filtered = getFilteredSessions(activeFilters);
    const sortedSessions = filtered.slice().sort(compareSessions);

    let totalGross = 0;
    let totalNet = 0;
    let totalExpenses = 0;
    let totalHours = 0;

    if (completed.length === 0) {
      body.innerHTML = '';
      noRecords.hidden = false;
      empty.hidden = true;
    } else if (filtered.length === 0) {
      body.innerHTML = '';
      noRecords.hidden = true;
      empty.hidden = false;
    } else {
      noRecords.hidden = true;
      empty.hidden = true;

      body.innerHTML = sortedSessions.map(session => {
        const totals = calculateSessionTotals(session);
        const hours = sessionHours(session);
        const hourlyRate = hours > 0 ? totals.grossProfit / hours : 0;
        const location = (session.location ?? '').trim();
        const locationDisplay = location ? truncateText(location, 6) : '-';

        totalGross += totals.grossProfit;
        totalNet += totals.netProfit;
        totalExpenses += totals.expenses;
        totalHours += hours;

        return `
          <div class="sessions-grid sessions-grid-row sessions-grid-row-clickable" data-session-id="${session.id}" role="button" tabindex="0" aria-label="Edit session ${session.id}">
            <div class="sessions-mode-icon" aria-label="${session.mode === 'cash' ? 'Cash game' : 'Tournament'}" title="${session.mode === 'cash' ? 'Cash game' : 'Tournament'}">${session.mode === 'cash' ? '&#128181;' : '&#127942;'}</div>
            <div class="sessions-profit ${profitClass(totals.grossProfit)}">${session.mode === 'cash' ? `${formatProfitMoney(totals.grossProfit)} <span class='sessions-profit-hourly'>${(hourlyRate / 100).toFixed(2)} / hr</span>` : formatProfitMoney(totals.grossProfit)}</div>
            <div>${formatDate(session.startedAt)}</div>
            <div>${formatHoursClock(hours)}</div>
            <div title="${escapeHtml(location || '-')}">${escapeHtml(locationDisplay)}</div>
          </div>
        `;
      }).join('');
    }

    const grossPerHour = totalHours > 0 ? totalGross / totalHours : 0;
    const netPerHour = totalHours > 0 ? totalNet / totalHours : 0;

    grossProfitEl.className = `sessions-profit ${profitClass(totalGross)}`;
    netProfitEl.className = `sessions-profit ${profitClass(totalNet)}`;
    grossPerHourEl.className = `sessions-profit ${profitClass(grossPerHour)}`;
    netPerHourEl.className = `sessions-profit ${profitClass(netPerHour)}`;

    grossProfitEl.textContent = formatProfitMoney(totalGross);
    netProfitEl.textContent = formatProfitMoney(totalNet);
    expensesEl.textContent = formatMoney(totalExpenses);
    totalHoursEl.textContent = formatHours(totalHours);
    grossPerHourEl.textContent = formatMoney(grossPerHour);
    netPerHourEl.textContent = formatMoney(netPerHour);

    exportMenuButton.disabled = sortedSessions.length === 0;
    updateSortButtons();

    if (filtered.length === 0) {
      cumulativeCard.hidden = true;
      dayOfWeekCard.hidden = true;
      timeOfDayCard.hidden = true;
      cashWinrateByStakesCard.hidden = true;
      cashLengthProfitCard.hidden = true;
      itmCard.hidden = true;
      roiByBuyinCard.hidden = true;
      return;
    }

    cumulativeCard.hidden = false;
    dayOfWeekCard.hidden = false;
    timeOfDayCard.hidden = false;

    updateCumulativeChart(filtered);
    updateDayOfWeekChart(filtered);
    updateTimeOfDayChart(filtered);
    updateCashWinrateByStakesChart(filtered);
    updateCashLengthVsProfitChart(filtered);
    updateTournamentItmChart(filtered);
    updateTournamentRoiByBuyinChart(filtered);
  };


  body.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const row = target.closest('.sessions-grid-row-clickable') as HTMLDivElement | null;
    if (!row) {
      return;
    }

    const sessionId = row.dataset.sessionId;
    if (!sessionId) {
      return;
    }

    const session = completed.find(item => item.id === sessionId);
    if (!session) {
      return;
    }

    openSessionEditSheet(session);
  });

  body.addEventListener('keydown', event => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') {
      return;
    }

    const target = keyboardEvent.target as HTMLElement;
    const row = target.closest('.sessions-grid-row-clickable') as HTMLDivElement | null;
    if (!row) {
      return;
    }

    keyboardEvent.preventDefault();

    const sessionId = row.dataset.sessionId;
    if (!sessionId) {
      return;
    }

    const session = completed.find(item => item.id === sessionId);
    if (!session) {
      return;
    }

    openSessionEditSheet(session);
  });

  for (const button of sortButtons) {
    button.addEventListener('click', () => {
      const key = (button.dataset.sortKey as SortKey | undefined) ?? 'date';
      if (sortState.key === key) {
        sortState = {
          key,
          direction: sortState.direction === 'asc' ? 'desc' : 'asc'
        };
      } else {
        const defaultDirection: SortDirection = key === 'location' || key === 'type' ? 'asc' : 'desc';
        sortState = {
          key,
          direction: defaultDirection
        };
      }

      renderRows();
    });
  }
  typeSelect.addEventListener('change', renderRows);
  locationSelect.addEventListener('change', renderRows);
  dateRangeSelect.addEventListener('change', renderRows);

  renderRows();

  return container;
}
























































