import type { SessionService } from '../../services/sessionService';
import type { Session } from '../../models/session';
import type { ExpenseCategory } from '../../models/event';
import { calculateSessionTotals } from '../../stats/calculators';
import { getActiveBreak, getSessionDurationMs } from '../../models/session';
import { navigate } from '../router';
import {
  attachSheetCloseHandlers,
  celebratePositiveResult,
  formatDateTimeLocal,
  formatDuration,
  parseDollarsToCents,
  playBreakWarningSignal,
  primeBreakWarningSignal
} from '../viewHelpers';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['tip', 'food', 'drink', 'travel', 'other'];
const LAST_EXPENSE_CATEGORY_KEY = 'stackflow.tournament.expenseCategory.v1';
const BREAK_DURATION_KEY_PREFIX = 'stackflow.tournament.breakDuration';
const DEFAULT_BREAK_MINUTES = 15;
const BREAK_WARNING_MS = 60_000;

function getBreakWarningKey(sessionId: string, breakId: string): string {
  return `stackflow.breakWarning.${sessionId}.${breakId}`;
}

function hasBreakWarningSent(sessionId: string, breakId: string): boolean {
  return localStorage.getItem(getBreakWarningKey(sessionId, breakId)) === 'true';
}

function markBreakWarningSent(sessionId: string, breakId: string): void {
  localStorage.setItem(getBreakWarningKey(sessionId, breakId), 'true');
}

function getBreakDurationPreferenceKey(session: Session): string {
  const location = (session.location ?? '').trim().toLowerCase() || 'unknown-location';
  const stakes = (session.stakes ?? '').trim().toLowerCase() || 'unknown-stakes';
  const scope = `${location}__${stakes}`.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${BREAK_DURATION_KEY_PREFIX}.${scope || 'default'}`;
}

function loadBreakDurationPreference(session: Session): number {
  const raw = localStorage.getItem(getBreakDurationPreferenceKey(session));
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_BREAK_MINUTES;
}

function saveBreakDurationPreference(session: Session, durationMinutes: number): void {
  localStorage.setItem(getBreakDurationPreferenceKey(session), String(durationMinutes));
}

function openRebuyAddonSheet(service: SessionService): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rebuyAddonTitle">
      <h2 id="rebuyAddonTitle">Rebuy / Addon</h2>
      <form id="rebuyAddonForm" class="sheet-form">
        <label for="rebuyAddonAmount">Amount ($)</label>
        <input id="rebuyAddonAmount" type="text" inputmode="decimal" placeholder="e.g. 150" required />

        <label for="rebuyAddonNote">Note (Optional)</label>
        <input id="rebuyAddonNote" type="text" value="rebuy" />

        <label for="rebuyAddonAt">Date & Time</label>
        <input id="rebuyAddonAt" type="datetime-local" required />

        <p id="rebuyAddonError" class="sheet-error"></p>

        <div class="sheet-actions">
          <button type="button" id="cancelRebuyAddon" class="ghost-btn">Cancel</button>
          <button type="submit" id="saveRebuyAddon">Save</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  const form = backdrop.querySelector('#rebuyAddonForm') as HTMLFormElement;
  const atInput = backdrop.querySelector('#rebuyAddonAt') as HTMLInputElement;
  const amountInput = backdrop.querySelector('#rebuyAddonAmount') as HTMLInputElement;
  const noteInput = backdrop.querySelector('#rebuyAddonNote') as HTMLInputElement;
  const errorEl = backdrop.querySelector('#rebuyAddonError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelRebuyAddon') as HTMLButtonElement;
  const saveButton = backdrop.querySelector('#saveRebuyAddon') as HTMLButtonElement;

  atInput.value = formatDateTimeLocal(new Date());
  amountInput.select();
  const close = attachSheetCloseHandlers(backdrop, cancelButton);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const timestamp = atInput.value ? new Date(atInput.value).getTime() : Number.NaN;
    if (!Number.isFinite(timestamp)) {
      errorEl.textContent = 'Please enter a valid date and time.';
      return;
    }

    const amountCents = parseDollarsToCents(amountInput.value.trim());
    if (amountCents === null) {
      errorEl.textContent = 'Please enter a valid amount (example: 150 or 150.50).';
      return;
    }

    const note = noteInput.value.trim() || 'rebuy';

    saveButton.disabled = true;
    primeBreakWarningSignal();

    try {
      await service.addInvestment(amountCents, note, timestamp);
      close();
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save rebuy/addon.';
      errorEl.textContent = message;
      saveButton.disabled = false;
    }
  });
}

function openExpenseSheet(service: SessionService): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="expenseTitle">
      <h2 id="expenseTitle">Add Expense</h2>
      <form id="expenseForm" class="sheet-form">
        <label for="expenseAmount">Amount ($)</label>
        <input id="expenseAmount" type="text" inputmode="decimal" placeholder="e.g. 5" required />

        <label>Category</label>
        <div id="expenseCategoryPills" class="pill-row"></div>

        <label for="expenseNote">Note (Optional)</label>
        <input id="expenseNote" type="text" placeholder="Optional note" />

        <label for="expenseAt">Date & Time</label>
        <input id="expenseAt" type="datetime-local" required />

        <p id="expenseError" class="sheet-error"></p>

        <div class="sheet-actions">
          <button type="button" id="cancelExpense" class="ghost-btn">Cancel</button>
          <button type="submit" id="saveExpense">Save Expense</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  const form = backdrop.querySelector('#expenseForm') as HTMLFormElement;
  const expenseAtInput = backdrop.querySelector('#expenseAt') as HTMLInputElement;
  const expenseAmountInput = backdrop.querySelector('#expenseAmount') as HTMLInputElement;
  const expenseNoteInput = backdrop.querySelector('#expenseNote') as HTMLInputElement;
  const categoryPills = backdrop.querySelector('#expenseCategoryPills') as HTMLDivElement;
  const errorEl = backdrop.querySelector('#expenseError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelExpense') as HTMLButtonElement;
  const saveButton = backdrop.querySelector('#saveExpense') as HTMLButtonElement;

  const savedCategory = localStorage.getItem(LAST_EXPENSE_CATEGORY_KEY);
  let selectedCategory: ExpenseCategory = EXPENSE_CATEGORIES.includes(savedCategory as ExpenseCategory)
    ? (savedCategory as ExpenseCategory)
    : 'tip';

  expenseAtInput.value = formatDateTimeLocal(new Date());
  expenseAmountInput.select();

  const renderCategoryPills = () => {
    categoryPills.innerHTML = '';

    for (const category of EXPENSE_CATEGORIES) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `pill-btn${category === selectedCategory ? ' pill-btn-active' : ''}`;
      pill.setAttribute('aria-pressed', category === selectedCategory ? 'true' : 'false');
      pill.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      pill.addEventListener('click', () => {
        selectedCategory = category;
        renderCategoryPills();
      });
      categoryPills.appendChild(pill);
    }
  };

  renderCategoryPills();

  const close = attachSheetCloseHandlers(backdrop, cancelButton);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const timestamp = expenseAtInput.value ? new Date(expenseAtInput.value).getTime() : Number.NaN;
    if (!Number.isFinite(timestamp)) {
      errorEl.textContent = 'Please enter a valid date and time.';
      return;
    }

    const amountCents = parseDollarsToCents(expenseAmountInput.value.trim());
    if (amountCents === null) {
      errorEl.textContent = 'Please enter a valid expense amount (example: 5 or 5.25).';
      return;
    }

    const note = expenseNoteInput.value.trim();

    saveButton.disabled = true;
    primeBreakWarningSignal();

    try {
      await service.addExpense(amountCents, selectedCategory, note || undefined, timestamp);
      localStorage.setItem(LAST_EXPENSE_CATEGORY_KEY, selectedCategory);
      close();
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save expense.';
      errorEl.textContent = message;
      saveButton.disabled = false;
    }
  });
}

function openBreakSheet(session: Session, service: SessionService): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="breakTitle">
      <h2 id="breakTitle">Start Break</h2>
      <form id="breakForm" class="sheet-form">
        <label for="breakDuration">Break Length (Minutes)</label>
        <input id="breakDuration" type="number" inputmode="numeric" min="1" step="1" value="${loadBreakDurationPreference(session)}" required />

        <label for="breakRemainingMinutes">Time Remaining</label>
        <div class="sheet-inline-fields">
          <input id="breakRemainingMinutes" type="number" inputmode="numeric" min="0" step="1" required />
          <span class="sheet-inline-separator">min</span>
          <input id="breakRemainingSeconds" type="number" inputmode="numeric" min="0" max="59" step="1" value="0" required />
          <span class="sheet-inline-separator">sec</span>
        </div>

        <p id="breakError" class="sheet-error"></p>

        <div class="sheet-actions">
          <button type="button" id="cancelBreak" class="ghost-btn">Cancel</button>
          <button type="submit" id="saveBreak">Start Break</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  const form = backdrop.querySelector('#breakForm') as HTMLFormElement;
  const durationInput = backdrop.querySelector('#breakDuration') as HTMLInputElement;
  const remainingMinutesInput = backdrop.querySelector('#breakRemainingMinutes') as HTMLInputElement;
  const remainingSecondsInput = backdrop.querySelector('#breakRemainingSeconds') as HTMLInputElement;
  const errorEl = backdrop.querySelector('#breakError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelBreak') as HTMLButtonElement;
  const saveButton = backdrop.querySelector('#saveBreak') as HTMLButtonElement;

  remainingMinutesInput.value = durationInput.value;
  durationInput.select();
  const close = attachSheetCloseHandlers(backdrop, cancelButton);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const durationMinutes = Number.parseInt(durationInput.value.trim(), 10);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      errorEl.textContent = 'Break length must be at least 1 minute.';
      return;
    }

    const remainingMinutes = Number.parseInt(remainingMinutesInput.value.trim(), 10);
    if (!Number.isInteger(remainingMinutes) || remainingMinutes < 0) {
      errorEl.textContent = 'Minutes remaining must be 0 or greater.';
      return;
    }

    const remainingSeconds = Number.parseInt(remainingSecondsInput.value.trim(), 10);
    if (!Number.isInteger(remainingSeconds) || remainingSeconds < 0 || remainingSeconds > 59) {
      errorEl.textContent = 'Seconds remaining must be between 0 and 59.';
      return;
    }

    const totalBreakSeconds = durationMinutes * 60;
    const remainingBreakSeconds = (remainingMinutes * 60) + remainingSeconds;
    if (remainingBreakSeconds < 1) {
      errorEl.textContent = 'Time remaining must be at least 1 second.';
      return;
    }

    if (remainingBreakSeconds > totalBreakSeconds) {
      errorEl.textContent = 'Time remaining cannot be longer than the full break.';
      return;
    }

    const elapsedBreakMs = (totalBreakSeconds - remainingBreakSeconds) * 1000;
    const timestamp = Date.now() - elapsedBreakMs;
    if (timestamp < session.startedAt) {
      errorEl.textContent = 'Calculated break start must be during the current session.';
      return;
    }

    saveButton.disabled = true;
    primeBreakWarningSignal();

    try {
      await service.addBreak(durationMinutes, timestamp);
      saveBreakDurationPreference(session, durationMinutes);
      close();
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start break.';
      errorEl.textContent = message;
      saveButton.disabled = false;
    }
  });
}
function openEndSessionSheet(session: Session, service: SessionService): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="endSessionTitle">
      <h2 id="endSessionTitle">Exit Tournament</h2>
      <form id="endSessionForm" class="sheet-form">
        <label for="payoutAmount">Payout Amount ($)</label>
        <input id="payoutAmount" type="text" inputmode="decimal" value="0" required />

        <label for="payoutNote">Note (Optional)</label>
        <input id="payoutNote" type="text" placeholder="Optional note" />

        <label for="endSessionAt">Date & Time</label>
        <input id="endSessionAt" type="datetime-local" required />

        <p id="endSessionError" class="sheet-error"></p>

        <div class="sheet-actions">
          <button type="button" id="cancelEndSession" class="ghost-btn">Cancel</button>
          <button type="submit" id="saveEndSession">End Session</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  const form = backdrop.querySelector('#endSessionForm') as HTMLFormElement;
  const endAtInput = backdrop.querySelector('#endSessionAt') as HTMLInputElement;
  const payoutAmountInput = backdrop.querySelector('#payoutAmount') as HTMLInputElement;
  const payoutNoteInput = backdrop.querySelector('#payoutNote') as HTMLInputElement;
  const errorEl = backdrop.querySelector('#endSessionError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelEndSession') as HTMLButtonElement;
  const saveButton = backdrop.querySelector('#saveEndSession') as HTMLButtonElement;

  endAtInput.value = formatDateTimeLocal(new Date());
  payoutAmountInput.select();
  const close = attachSheetCloseHandlers(backdrop, cancelButton);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const timestamp = endAtInput.value ? new Date(endAtInput.value).getTime() : Number.NaN;
    if (!Number.isFinite(timestamp)) {
      errorEl.textContent = 'Please enter a valid date and time.';
      return;
    }

    const payoutCents = parseDollarsToCents(payoutAmountInput.value.trim(), true);
    if (payoutCents === null) {
      errorEl.textContent = 'Please enter a valid payout amount (example: 0, 800, or 800.50).';
      return;
    }

    const note = payoutNoteInput.value.trim();
    const totals = calculateSessionTotals(session);
    const finalNetProfit = totals.returned + payoutCents - totals.invested - totals.expenses;

    saveButton.disabled = true;
    primeBreakWarningSignal();

    try {
      await service.addReturn(payoutCents, note || undefined, timestamp);
      await service.endSession(timestamp);
      close();
      if (finalNetProfit > 0) {
        celebratePositiveResult(finalNetProfit);
      }
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to end session.';
      errorEl.textContent = message;
      saveButton.disabled = false;
    }
  });
}

export async function renderTournamentView(session: Session, service: SessionService): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'app-container';
  const totals = calculateSessionTotals(session);
  const initialActiveBreak = getActiveBreak(session);
  const initialRemainingMs = initialActiveBreak
    ? Math.max(0, initialActiveBreak.startedAt + initialActiveBreak.durationMinutes * 60_000 - Date.now())
    : 0;

  container.innerHTML = `
      <div class="sessions-card tournament-card">
        <h1>Tournament</h1>
        <div class="tournament-meta">
          <p>${session.stakes ?? '-'} @ ${session.location ?? '-'}</p>
          <p><strong>Duration:</strong> <span id="activeDuration">${formatDuration(getSessionDurationMs(session, Date.now()))}</span></p>
          <p id="activeBreakStatus" class="session-break-status" ${initialActiveBreak ? '' : 'hidden'}>
            <strong>In Break:</strong> <span id="activeBreakRemaining">${formatDuration(initialRemainingMs)}</span> remaining
          </p>
        </div>

        <div class="tournament-stats">
          <p>Invested: $${(totals.invested / 100).toFixed(2)}</p>
          <p>Expenses: $${(totals.expenses / 100).toFixed(2)}</p>
        </div>

        <div id="actions" class="session-actions-grid">
          <button id="rebuy" class="session-action-btn">Rebuy / Addon</button>
          <button id="expense" class="session-action-btn">Expense</button>
          <button id="startBreak" class="session-action-btn" ${initialActiveBreak ? 'disabled' : ''}>${initialActiveBreak ? 'In Break' : 'Start Break'}</button>
        </div>
        <button id="endSession" class="session-end-btn">Exit Tournament</button>
      </div>
  `;

  const durationEl = container.querySelector('#activeDuration') as HTMLSpanElement;
  const activeBreakStatusEl = container.querySelector('#activeBreakStatus') as HTMLParagraphElement;
  const activeBreakRemainingEl = container.querySelector('#activeBreakRemaining') as HTMLSpanElement;
  const startBreakButton = container.querySelector('#startBreak') as HTMLButtonElement;

  const updateBreakState = () => {
    const now = Date.now();
    const activeBreak = getActiveBreak(session, now);

    durationEl.textContent = formatDuration(getSessionDurationMs(session, now));

    if (!activeBreak) {
      activeBreakStatusEl.classList.remove('session-break-status-warning');
      activeBreakStatusEl.hidden = true;
      startBreakButton.disabled = false;
      startBreakButton.textContent = 'Start Break';
      return;
    }

    const remainingMs = Math.max(0, activeBreak.startedAt + activeBreak.durationMinutes * 60_000 - now);
    activeBreakStatusEl.hidden = false;
    activeBreakStatusEl.classList.toggle('session-break-status-warning', remainingMs <= BREAK_WARNING_MS && remainingMs > 0);
    activeBreakRemainingEl.textContent = formatDuration(remainingMs);
    startBreakButton.disabled = true;
    startBreakButton.textContent = 'In Break';

    if (remainingMs <= BREAK_WARNING_MS && remainingMs > 0 && !hasBreakWarningSent(session.id, activeBreak.id)) {
      playBreakWarningSignal();
      markBreakWarningSent(session.id, activeBreak.id);
    }
  };

  updateBreakState();
  const intervalId = window.setInterval(() => {
    if (!container.isConnected) {
      window.clearInterval(intervalId);
      return;
    }

    updateBreakState();
  }, 1000);

  container.querySelector('#rebuy')!
    .addEventListener('click', () => {
      openRebuyAddonSheet(service);
    });

  container.querySelector('#expense')!
    .addEventListener('click', () => {
      openExpenseSheet(service);
    });

  startBreakButton.addEventListener('click', () => {
    if (startBreakButton.disabled) {
      return;
    }

    openBreakSheet(session, service);
  });

  container.querySelector('#endSession')!
    .addEventListener('click', () => {
      openEndSessionSheet(session, service);
    });

  return container;
}











