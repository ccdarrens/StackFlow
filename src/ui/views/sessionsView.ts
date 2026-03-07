import Chart from 'chart.js/auto';
import type { SessionService } from '../../services/sessionService';
import type { Session } from '../../models/session';
import { calculateSessionTotals } from '../../stats/calculators';
import { navigate } from '../router';

type SessionFilterType = 'all' | 'cash' | 'tournament';
type DateRangeFilter = 'all' | 'last_7_days' | 'last_month' | 'last_3_months' | 'last_year' | 'year_to_date';
type ExportFormat = 'json' | 'csv';

interface SessionsFilters {
  type: SessionFilterType;
  location: string;
  dateRange: DateRangeFilter;
}

const SESSIONS_FILTERS_KEY = 'stackflow.sessions.filters.v1';

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
      dateRange === 'last_7_days' ||
      dateRange === 'last_month' ||
      dateRange === 'last_3_months' ||
      dateRange === 'last_year' ||
      dateRange === 'year_to_date'
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

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
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

function profitClass(value: number): string {
  if (value > 0) return 'sessions-profit-positive';
  if (value < 0) return 'sessions-profit-negative';
  return 'sessions-profit-neutral';
}

function getDateRangeStartMs(range: DateRangeFilter): number | null {
  const now = new Date();

  switch (range) {
    case 'all':
      return null;
    case 'last_7_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start.getTime();
    }
    case 'last_month': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      return start.getTime();
    }
    case 'last_3_months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      return start.getTime();
    }
    case 'last_year': {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return start.getTime();
    }
    case 'year_to_date': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return start.getTime();
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

  const rangeStartMs = getDateRangeStartMs(filters.dateRange);
  if (rangeStartMs !== null && session.startedAt < rangeStartMs) {
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
  const completed = (await service.getCompletedSessions())
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
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_month">Last Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_year">Last Year</option>
            <option value="year_to_date">Year to Date</option>
          </select>
        </div>

        <div class="sessions-filter-export">
          <button id="sessionsExportMenuButton" class="sessions-export-icon-btn" type="button" aria-label="Export sessions">&#8595;</button>
          <div id="sessionsExportMenu" class="sessions-export-menu" hidden>
            <button type="button" data-format="json">JSON</button>
            <button type="button" data-format="csv">CSV</button>
          </div>
        </div>
      </div>

      <div class="sessions-grid-wrap">
        <div class="sessions-grid sessions-grid-header">
          <div>Profit</div>
          <div>Date</div>
          <div>Hours</div>
          <div>Location</div>
          <div>Type</div>
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
        <h3>Profit by Day of the Week (Daytime vs Nighttime)</h3>
        <div class="sessions-chart-wrap">
          <canvas id="sessionsDayOfWeekChart"></canvas>
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
  const exportMenu = container.querySelector('#sessionsExportMenu') as HTMLDivElement;
  const exportMenuItems = Array.from(container.querySelectorAll('#sessionsExportMenu button')) as HTMLButtonElement[];
  const body = container.querySelector('#sessionsGridBody') as HTMLDivElement;
  const empty = container.querySelector('#sessionsEmpty') as HTMLParagraphElement;
  const cumulativeCanvas = container.querySelector('#sessionsCumulativeChart') as HTMLCanvasElement;
  const dayOfWeekCanvas = container.querySelector('#sessionsDayOfWeekChart') as HTMLCanvasElement;
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
  let itmChart: Chart | null = null;
  let roiByBuyinChart: Chart | null = null;

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
              labels: {
                color: '#F3EFE3'
              }
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
    const daytime = [0, 0, 0, 0, 0, 0, 0];
    const nighttime = [0, 0, 0, 0, 0, 0, 0];

    for (const session of sessions) {
      const totals = calculateSessionTotals(session);
      const sessionDate = new Date(session.startedAt);
      const dayIndex = sessionDate.getDay();
      const hour = sessionDate.getHours();
      const isDaytime = hour >= 6 && hour < 18;

      if (isDaytime) {
        daytime[dayIndex] += totals.grossProfit / 100;
      } else {
        nighttime[dayIndex] += totals.grossProfit / 100;
      }
    }

    if (!dayOfWeekChart) {
      dayOfWeekChart = new Chart(dayOfWeekCanvas, {
        type: 'bar',
        data: {
          labels: dayLabels,
          datasets: [
            {
              label: 'Daytime',
              data: daytime,
              backgroundColor: 'rgba(127, 215, 143, 0.75)',
              borderColor: '#7fd78f',
              borderWidth: 1,
              stack: 'profit'
            },
            {
              label: 'Nighttime',
              data: nighttime,
              backgroundColor: 'rgba(201, 162, 39, 0.75)',
              borderColor: '#c9a227',
              borderWidth: 1,
              stack: 'profit'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#F3EFE3'
              }
            }
          },
          scales: {
            x: {
              stacked: true,
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            },
            y: {
              stacked: true,
              ticks: { color: '#F3EFE3' },
              grid: { color: 'rgba(243, 239, 227, 0.1)' }
            }
          }
        }
      });
      return;
    }

    dayOfWeekChart.data.datasets[0].data = daytime;
    dayOfWeekChart.data.datasets[1].data = nighttime;
    dayOfWeekChart.update();
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
              labels: {
                color: '#F3EFE3'
              }
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
              labels: {
                color: '#F3EFE3'
              }
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

    if (itmChart) {
      itmChart.destroy();
      itmChart = null;
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

  for (const item of exportMenuItems) {
    item.addEventListener('click', () => {
      const format = (item.dataset.format as ExportFormat | undefined) ?? 'json';
      hideExportMenu();
      runExport(format);
    });
  }

  document.addEventListener('click', hideExportMenu);

  const renderRows = () => {
    const activeFilters = getActiveFilters();
    saveFilters(activeFilters);

    const filtered = getFilteredSessions(activeFilters);

    let totalGross = 0;
    let totalNet = 0;
    let totalExpenses = 0;
    let totalHours = 0;

    if (filtered.length === 0) {
      body.innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;

      body.innerHTML = filtered.map(session => {
        const totals = calculateSessionTotals(session);
        const hours = sessionHours(session);

        totalGross += totals.grossProfit;
        totalNet += totals.netProfit;
        totalExpenses += totals.expenses;
        totalHours += hours;

        return `
          <div class="sessions-grid sessions-grid-row">
            <div class="sessions-profit ${profitClass(totals.grossProfit)}">${formatMoney(totals.grossProfit)}</div>
            <div>${formatDate(session.startedAt)}</div>
            <div>${formatHours(hours)}</div>
            <div>${(session.location ?? '-')}</div>
            <div>${session.mode === 'cash' ? 'Cash' : 'Tournament'}</div>
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

    grossProfitEl.textContent = formatMoney(totalGross);
    netProfitEl.textContent = formatMoney(totalNet);
    expensesEl.textContent = formatMoney(totalExpenses);
    totalHoursEl.textContent = formatHours(totalHours);
    grossPerHourEl.textContent = formatMoney(grossPerHour);
    netPerHourEl.textContent = formatMoney(netPerHour);

    exportMenuButton.disabled = filtered.length === 0;

    updateCumulativeChart(filtered);
    updateDayOfWeekChart(filtered);
    updateTournamentItmChart(filtered);
    updateTournamentRoiByBuyinChart(filtered);
  };

  typeSelect.addEventListener('change', renderRows);
  locationSelect.addEventListener('change', renderRows);
  dateRangeSelect.addEventListener('change', renderRows);

  renderRows();

  return container;
}




