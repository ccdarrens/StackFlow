import type { SessionService } from '../../services/sessionService';
import type { Session } from '../../models/session';
import type { ExpenseCategory } from '../../models/event';
import { calculateSessionTotals } from '../../stats/calculators';
import { navigate } from '../router';
import { attachSheetCloseHandlers, formatDateTimeLocal, formatDuration, parseDollarsToCents } from '../viewHelpers';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['tip', 'food', 'drink', 'travel', 'other'];
const LAST_EXPENSE_CATEGORY_KEY = 'stackflow.cash.expenseCategory.v1';

function openAddonSheet(service: SessionService): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="addonTitle">
      <h2 id="addonTitle">Add Addon</h2>
      <form id="addonForm" class="sheet-form">
        <label for="addonAmount">Addon Amount ($)</label>
        <input id="addonAmount" type="text" inputmode="decimal" placeholder="e.g. 50" required autofocus />

        <label for="addonNote">Note (Optional)</label>
        <input id="addonNote" type="text" placeholder="Optional note" />

        <label for="addonAt">Date & Time</label>
        <input id="addonAt" type="datetime-local" required />

        <p id="addonError" class="sheet-error"></p>

        <div class="sheet-actions">
          <button type="button" id="cancelAddon" class="ghost-btn">Cancel</button>
          <button type="submit" id="saveAddon">Save Addon</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  const form = backdrop.querySelector('#addonForm') as HTMLFormElement;
  const addonAmountInput = backdrop.querySelector('#addonAmount') as HTMLInputElement;
  const addonNoteInput = backdrop.querySelector('#addonNote') as HTMLInputElement;
  const addonAtInput = backdrop.querySelector('#addonAt') as HTMLInputElement;
  const errorEl = backdrop.querySelector('#addonError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelAddon') as HTMLButtonElement;
  const saveButton = backdrop.querySelector('#saveAddon') as HTMLButtonElement;

  addonAtInput.value = formatDateTimeLocal(new Date());
  addonAmountInput.focus();
  addonAmountInput.select();

  const close = attachSheetCloseHandlers(backdrop, cancelButton);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const amountCents = parseDollarsToCents(addonAmountInput.value.trim());
    if (amountCents === null) {
      errorEl.textContent = 'Please enter a valid addon amount (example: 50 or 50.25).';
      return;
    }

    const timestamp = addonAtInput.value ? new Date(addonAtInput.value).getTime() : Number.NaN;
    if (!Number.isFinite(timestamp)) {
      errorEl.textContent = 'Please enter a valid date and time.';
      return;
    }

    const note = addonNoteInput.value.trim() || 'addon';

    saveButton.disabled = true;

    try {
      await service.addInvestment(amountCents, note, timestamp);
      close();
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save addon.';
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
        <input id="expenseAmount" type="text" inputmode="decimal" placeholder="e.g. 5" required autofocus />

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
  expenseAmountInput.focus();
  expenseAmountInput.select();

  const renderCategoryPills = () => {
    categoryPills.innerHTML = '';

    for (const category of EXPENSE_CATEGORIES) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `pill-btn${category === selectedCategory ? ' pill-btn-active' : ''}`;
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

function openEndSessionSheet(service: SessionService): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="endSessionTitle">
      <h2 id="endSessionTitle">End Session</h2>
      <form id="endSessionForm" class="sheet-form">
        <label for="cashoutAmount">Cashout Amount ($)</label>
        <input id="cashoutAmount" type="text" inputmode="decimal" placeholder="e.g. 200" required autofocus />

        <label for="cashoutNote">Note (Optional)</label>
        <input id="cashoutNote" type="text" placeholder="Optional note" />

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
  const cashoutAmountInput = backdrop.querySelector('#cashoutAmount') as HTMLInputElement;
  const cashoutNoteInput = backdrop.querySelector('#cashoutNote') as HTMLInputElement;
  const errorEl = backdrop.querySelector('#endSessionError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelEndSession') as HTMLButtonElement;
  const saveButton = backdrop.querySelector('#saveEndSession') as HTMLButtonElement;

  endAtInput.value = formatDateTimeLocal(new Date());
  cashoutAmountInput.focus();
  cashoutAmountInput.select();
  const close = attachSheetCloseHandlers(backdrop, cancelButton);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const timestamp = endAtInput.value ? new Date(endAtInput.value).getTime() : Number.NaN;
    if (!Number.isFinite(timestamp)) {
      errorEl.textContent = 'Please enter a valid date and time.';
      return;
    }

    const cashoutCents = parseDollarsToCents(cashoutAmountInput.value.trim(), true);
    if (cashoutCents === null) {
      errorEl.textContent = 'Please enter a valid cashout amount (example: 0, 200, or 200.50).';
      return;
    }

    const note = cashoutNoteInput.value.trim();

    saveButton.disabled = true;

    try {
      await service.addReturn(cashoutCents, note || undefined, timestamp);
      await service.endSession(timestamp);
      close();
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to end session.';
      errorEl.textContent = message;
      saveButton.disabled = false;
    }
  });
}

export async function renderCashGameView(session: Session, service: SessionService): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'app-container';
  const start = session.startedAt;
  const totals = calculateSessionTotals(session);

  container.innerHTML = `
      <div class="sessions-card cash-card">
        <h1>Cash Session</h1>
        <div class="cash-meta">
          <p>${session.stakes ?? '-'} @ ${session.location ?? '-'}</p>
          <p><strong>Duration:</strong> <span id="activeDuration">${formatDuration(Date.now() - start)}</span></p>
        </div>

        <div class="cash-stats">
          <p>Invested: $${(totals.invested / 100).toFixed(2)}</p>
          <p>Expenses: $${(totals.expenses / 100).toFixed(2)}</p>
        </div>

        <div id="actions" class="session-actions-grid">
          <button id="addon" class="session-action-btn">Addon</button>
          <button id="expense" class="session-action-btn">Expense</button>
        </div>
        <button id="endSession" class="session-end-btn">End Session</button>
      </div>
  `;

  const durationEl = container.querySelector('#activeDuration')!;
  setInterval(() => {
    durationEl.textContent = formatDuration(Date.now() - start);
  }, 1000);

  container.querySelector('#addon')!
    .addEventListener('click', () => {
      openAddonSheet(service);
    });

  container.querySelector('#expense')!
    .addEventListener('click', () => {
      openExpenseSheet(service);
    });

  container.querySelector('#endSession')!
    .addEventListener('click', () => {
      openEndSessionSheet(service);
    });

  return container;
}








