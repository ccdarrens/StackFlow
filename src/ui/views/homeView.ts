import type { SessionService } from '../../services/sessionService';
import { navigate } from '../router';
import {
  loadCashStartPreferences,
  saveCashStartPreferences
} from '../../storage/cashStartPreferences';

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

function formatDollarsFromCents(cents: number): string {
  return Number((cents / 100).toFixed(2)).toString();
}

function openCashStartSheet(service: SessionService): void {
  const prefs = loadCashStartPreferences();

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="cashStartTitle">
      <h2 id="cashStartTitle">Start Cash Game</h2>
      <form id="cashStartForm" class="sheet-form">
        <label for="cashStartAt">Start Date & Time</label>
        <input id="cashStartAt" type="datetime-local" required />

        <label for="cashLocation">Location</label>
        <input id="cashLocation" type="text" placeholder="e.g. Stones" />
        <div id="cashLocationPills" class="pill-row"></div>

        <label for="cashStakes">Stakes</label>
        <input id="cashStakes" type="text" placeholder="e.g. 1/3 NLH" />
        <div id="cashStakesPills" class="pill-row"></div>

        <label for="cashBuyIn">Initial Buy-In ($)</label>
        <input id="cashBuyIn" type="text" inputmode="decimal" placeholder="e.g. 100" required />
        <div id="cashBuyInPills" class="pill-row"></div>

        <p id="cashStartError" class="sheet-error"></p>

        <div class="sheet-actions">
          <button type="button" id="cancelCashStart" class="ghost-btn">Cancel</button>
          <button type="submit" id="submitCashStart">Start</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  const form = backdrop.querySelector('#cashStartForm') as HTMLFormElement;
  const startAtInput = backdrop.querySelector('#cashStartAt') as HTMLInputElement;
  const locationInput = backdrop.querySelector('#cashLocation') as HTMLInputElement;
  const stakesInput = backdrop.querySelector('#cashStakes') as HTMLInputElement;
  const buyInInput = backdrop.querySelector('#cashBuyIn') as HTMLInputElement;
  const locationPills = backdrop.querySelector('#cashLocationPills') as HTMLDivElement;
  const stakesPills = backdrop.querySelector('#cashStakesPills') as HTMLDivElement;
  const buyInPills = backdrop.querySelector('#cashBuyInPills') as HTMLDivElement;
  const errorEl = backdrop.querySelector('#cashStartError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelCashStart') as HTMLButtonElement;
  const submitButton = backdrop.querySelector('#submitCashStart') as HTMLButtonElement;

  startAtInput.value = formatDateTimeLocal(new Date());
  locationInput.value = prefs.lastLocation;
  stakesInput.value = prefs.lastStakes;
  buyInInput.value = prefs.lastBuyInDollars;

  const addPills = (
    host: HTMLDivElement,
    values: string[],
    onPick: (value: string) => void,
    render?: (value: string) => string
  ) => {
    host.innerHTML = '';

    for (const value of values) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill-btn';
      pill.textContent = render ? render(value) : value;
      pill.addEventListener('click', () => onPick(value));
      host.appendChild(pill);
    }
  };

  addPills(locationPills, prefs.locations, value => {
    locationInput.value = value;
    locationInput.focus();
  });

  addPills(stakesPills, prefs.stakes, value => {
    stakesInput.value = value;
    stakesInput.focus();
  });

  addPills(
    buyInPills,
    prefs.buyIns,
    value => {
      buyInInput.value = value;
      buyInInput.focus();
    },
    value => `$${value}`
  );

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

    const startAt = startAtInput.value;
    const startedAtMillis = startAt ? new Date(startAt).getTime() : Number.NaN;

    if (!Number.isFinite(startedAtMillis)) {
      errorEl.textContent = 'Please enter a valid start date and time.';
      return;
    }

    const location = locationInput.value.trim();
    const stakes = stakesInput.value.trim();
    const buyInCents = parseDollarsToCents(buyInInput.value.trim());

    if (buyInCents === null) {
      errorEl.textContent = 'Please enter a valid buy-in amount (example: 100 or 100.50).';
      return;
    }

    submitButton.disabled = true;

    try {
      await service.createCashSession(
        stakes || undefined,
        location || undefined,
        buyInCents,
        startedAtMillis
      );

      saveCashStartPreferences({
        location,
        stakes,
        buyInDollars: formatDollarsFromCents(buyInCents)
      });

      close();
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start cash game.';
      errorEl.textContent = message;
      submitButton.disabled = false;
    }
  });
}

export async function renderHomeView(service: SessionService): Promise<HTMLElement> {

  const container = document.createElement('div');
  container.className = 'app-container';

  container.innerHTML = `
    <button id="startCash">Start Cash Game</button>
    <button id="startTournament">Start Tournament</button>
    <hr/>
    <button id="viewSessions">View Sessions</button>
    <button id="viewStats">View Stats</button>
  `;

  container.querySelector('#startCash')!
    .addEventListener('click', () => {
      openCashStartSheet(service);
    });

  container.querySelector('#startTournament')!
    .addEventListener('click', async () => {
      await service.createTournamentSession('$150 MTT', 'Thunder Valley', 15000);
      navigate('start');
    });

  container.querySelector('#viewSessions')!
    .addEventListener('click', async () => {
      console.log('veiw sessions clicked');
      navigate('sessions');
    });

  container.querySelector('#viewStats')!
    .addEventListener('click', async () => {
      console.log('veiw stats clicked');
      navigate('stats');
    });

  return container;
}

