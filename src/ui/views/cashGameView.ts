import type { SessionService } from '../../services/sessionService';
import type { Session } from '../../models/session';
import { calculateSessionTotals } from '../../stats/calculators';
import { navigate } from '../router';

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatDateTimeLocal(now: Date): string {
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDollarsToCents(rawValue: string): number | null {
  const normalized = rawValue.replace(/[$,\s]/g, '');
  if (!normalized) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function openAddonSheet(service: SessionService): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="addonTitle">
      <h2 id="addonTitle">Add Addon</h2>
      <form id="addonForm" class="sheet-form">
        <label for="addonAt">Date & Time</label>
        <input id="addonAt" type="datetime-local" required />

        <label for="addonAmount">Addon Amount ($)</label>
        <input id="addonAmount" type="text" inputmode="decimal" placeholder="e.g. 50" required />

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
  const addonAtInput = backdrop.querySelector('#addonAt') as HTMLInputElement;
  const addonAmountInput = backdrop.querySelector('#addonAmount') as HTMLInputElement;
  const errorEl = backdrop.querySelector('#addonError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelAddon') as HTMLButtonElement;
  const saveButton = backdrop.querySelector('#saveAddon') as HTMLButtonElement;

  addonAtInput.value = formatDateTimeLocal(new Date());

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
    }
  };

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
  };

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

    const startedAt = addonAtInput.value ? new Date(addonAtInput.value).getTime() : Number.NaN;
    if (!Number.isFinite(startedAt)) {
      errorEl.textContent = 'Please enter a valid date and time.';
      return;
    }

    const amountCents = parseDollarsToCents(addonAmountInput.value.trim());
    if (amountCents === null) {
      errorEl.textContent = 'Please enter a valid addon amount (example: 50 or 50.25).';
      return;
    }

    saveButton.disabled = true;

    try {
      await service.addInvestment(amountCents, 'addon', startedAt);
      close();
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save addon.';
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
      <h1>Active Cash Session</h1>
      <p>Stakes: ${session.stakes ?? '-'}</p>
      <p>Location: ${session.location ?? '-'}</p>
      <p>Duration: <span id="activeDuration">${formatDuration(Date.now() - start)}</span></p>
      <hr/>
      <p>Invested: $${(totals.invested / 100).toFixed(2)}</p>
      <p>Returned: $${(totals.returned / 100).toFixed(2)}</p>
      <p>Expenses: $${(totals.expenses / 100).toFixed(2)}</p>
      <h2>Gross: $${(totals.grossProfit / 100).toFixed(2)}</h2>
      <h2>Net: $${(totals.netProfit / 100).toFixed(2)}</h2>
      <hr/>
      <div id="actions">
        <button id="addon">Addon</button>
        <button id="tip">Tip ($1)</button>
        <button id="food">Food ($5)</button>
        <button id="cashOut">Cash Out ($200)</button>
      </div>
      <button id="endSession">End Session</button>
  `;

  const durationEl = container.querySelector('#activeDuration')!;
  setInterval(() => {
    durationEl.textContent = formatDuration(Date.now() - start);
  }, 1000);

  container.querySelector('#addon')!
    .addEventListener('click', () => {
      openAddonSheet(service);
    });

  container.querySelector('#tip')!
    .addEventListener('click', async () => {
      await service.addExpense(100, 'tip', 'tipped the dealer');
      navigate('start');
    });

  container.querySelector('#food')!
    .addEventListener('click', async () => {
      await service.addExpense(500, 'food', 'bought food');
      navigate('start');
    });

  container.querySelector('#cashOut')!
    .addEventListener('click', async () => {
      await service.addReturn(20000, 'cashout');
      navigate('start');
    });

  container.querySelector('#endSession')!
    .addEventListener('click', async () => {
      await service.endSession();
      navigate('start');
    });
  return container;
}
