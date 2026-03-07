import type { SessionService } from '../../services/sessionService';
import type { Session } from '../../models/session';
import type { ExpenseCategory } from '../../models/event';
import { calculateSessionTotals } from '../../stats/calculators';
import { navigate } from '../router';
import { attachSheetCloseHandlers, formatDateTimeLocal, formatDuration, parseDollarsToCents } from '../viewHelpers';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['tip', 'food', 'drink', 'travel', 'lodging', 'other'];

function openRebuyAddonSheet(service: SessionService): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rebuyAddonTitle">
      <h2 id="rebuyAddonTitle">Rebuy / Addon</h2>
      <form id="rebuyAddonForm" class="sheet-form">
        <label for="rebuyAddonAt">Date & Time</label>
        <input id="rebuyAddonAt" type="datetime-local" required />

        <label for="rebuyAddonAmount">Amount ($)</label>
        <input id="rebuyAddonAmount" type="text" inputmode="decimal" placeholder="e.g. 150" required />

        <label for="rebuyAddonNote">Note (Optional)</label>
        <input id="rebuyAddonNote" type="text" value="rebuy" />

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
        <label for="expenseAt">Date & Time</label>
        <input id="expenseAt" type="datetime-local" required />

        <label for="expenseAmount">Amount ($)</label>
        <input id="expenseAmount" type="text" inputmode="decimal" placeholder="e.g. 5" required />

        <label>Category</label>
        <div id="expenseCategoryPills" class="pill-row"></div>

        <label for="expenseNote">Note (Optional)</label>
        <input id="expenseNote" type="text" placeholder="Optional note" />

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

  let selectedCategory: ExpenseCategory = 'tip';

  expenseAtInput.value = formatDateTimeLocal(new Date());

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
        <label for="endSessionAt">Date & Time</label>
        <input id="endSessionAt" type="datetime-local" required />

        <label for="payoutAmount">Payout Amount ($)</label>
        <input id="payoutAmount" type="text" inputmode="decimal" value="0" required />

        <label for="payoutNote">Note (Optional)</label>
        <input id="payoutNote" type="text" placeholder="Optional note" />

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

    saveButton.disabled = true;

    try {
      await service.addReturn(payoutCents, note || undefined, timestamp);
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

export async function renderTournamentView(session: Session, service: SessionService): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'app-container';
  const start = session.startedAt;
  const totals = calculateSessionTotals(session);

  container.innerHTML = `
      <div class="sessions-card tournament-card">
        <h1>Active Tournament Session</h1>
        <div class="tournament-meta">
          <p>${session.stakes ?? '-'} @ ${session.location ?? '-'}</p>
          <p><strong>Duration:</strong> <span id="activeDuration">${formatDuration(Date.now() - start)}</span></p>
        </div>

        <div class="tournament-stats">
          <p>Invested: $${(totals.invested / 100).toFixed(2)}</p>
          <p>Expenses: $${(totals.expenses / 100).toFixed(2)}</p>
        </div>

        <div id="actions" class="session-actions-grid">
          <button id="rebuy" class="session-action-btn">Rebuy / Addon</button>
          <button id="expense" class="session-action-btn">Expense</button>
        </div>
        <button id="endSession" class="session-end-btn">End Session</button>
      </div>
  `;

  const durationEl = container.querySelector('#activeDuration')!;
  setInterval(() => {
    durationEl.textContent = formatDuration(Date.now() - start);
  }, 1000);

  container.querySelector('#rebuy')!
    .addEventListener('click', () => {
      openRebuyAddonSheet(service);
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

