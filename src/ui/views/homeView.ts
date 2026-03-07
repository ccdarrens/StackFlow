import type { SessionService } from '../../services/sessionService';
import { navigate } from '../router';
import {
  loadCashStartPreferences,
  saveCashLocationPreference,
  saveCashStartPreferences
} from '../../storage/cashStartPreferences';
import {
  loadTournamentStartPreferences,
  saveTournamentStartPreferences
} from '../../storage/tournamentStartPreferences';
import logoTransparent from '../../logo-transparent-bg.png';
import { attachSheetCloseHandlers, formatDateTimeLocal, parseDollarsToCents } from '../viewHelpers';

const MAX_LOCATION_LENGTH = 30;
const MAX_STAKES_LENGTH = 25;
const MAX_BUY_IN_DOLLARS = 10000000;

function formatDollarsFromCents(cents: number): string {
  return Number((cents / 100).toFixed(2)).toString();
}

function addPills(
  host: HTMLDivElement,
  values: string[],
  onPick: (value: string) => void,
  render?: (value: string) => string
): void {
  host.innerHTML = '';

  for (const value of values) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pill-btn';
    pill.textContent = render ? render(value) : value;
    pill.addEventListener('click', () => onPick(value));
    host.appendChild(pill);
  }
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
        <input id="cashLocation" type="text" placeholder="e.g. Stones" maxlength="30" />
        <div id="cashLocationPills" class="pill-row"></div>

        <label for="cashStakes">Stakes</label>
        <input id="cashStakes" type="text" placeholder="e.g. 1/3 NLH" maxlength="25" />
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

  const close = attachSheetCloseHandlers(backdrop, cancelButton);

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

    if (location.length > MAX_LOCATION_LENGTH) {
      errorEl.textContent = 'Location must be 30 characters or fewer.';
      return;
    }

    if (stakes.length > MAX_STAKES_LENGTH) {
      errorEl.textContent = 'Stakes must be 25 characters or fewer.';
      return;
    }

    const buyInCents = parseDollarsToCents(buyInInput.value.trim(), true, MAX_BUY_IN_DOLLARS);

    if (buyInCents === null) {
      errorEl.textContent = 'Please enter a valid buy-in amount up to $10,000,000 (example: 100 or 100.50).';
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

function openTournamentStartSheet(service: SessionService): void {
  const cashPrefs = loadCashStartPreferences();
  const tournamentPrefs = loadTournamentStartPreferences();

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="tournamentStartTitle">
      <h2 id="tournamentStartTitle">Start Tournament</h2>
      <form id="tournamentStartForm" class="sheet-form">
        <label for="tournamentStartAt">Start Date & Time</label>
        <input id="tournamentStartAt" type="datetime-local" required />

        <label for="tournamentLocation">Location</label>
        <input id="tournamentLocation" type="text" placeholder="e.g. Thunder Valley" maxlength="30" />
        <div id="tournamentLocationPills" class="pill-row"></div>

        <label for="tournamentStakes">Stakes</label>
        <input id="tournamentStakes" type="text" placeholder="e.g. $150 MTT" maxlength="25" />
        <div id="tournamentStakesPills" class="pill-row"></div>

        <label for="tournamentBuyIn">Buy-In ($)</label>
        <input id="tournamentBuyIn" type="text" inputmode="decimal" placeholder="e.g. 150" required />
        <div id="tournamentBuyInPills" class="pill-row"></div>

        <p id="tournamentStartError" class="sheet-error"></p>

        <div class="sheet-actions">
          <button type="button" id="cancelTournamentStart" class="ghost-btn">Cancel</button>
          <button type="submit" id="submitTournamentStart">Start</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  const form = backdrop.querySelector('#tournamentStartForm') as HTMLFormElement;
  const startAtInput = backdrop.querySelector('#tournamentStartAt') as HTMLInputElement;
  const locationInput = backdrop.querySelector('#tournamentLocation') as HTMLInputElement;
  const stakesInput = backdrop.querySelector('#tournamentStakes') as HTMLInputElement;
  const buyInInput = backdrop.querySelector('#tournamentBuyIn') as HTMLInputElement;
  const locationPills = backdrop.querySelector('#tournamentLocationPills') as HTMLDivElement;
  const stakesPills = backdrop.querySelector('#tournamentStakesPills') as HTMLDivElement;
  const buyInPills = backdrop.querySelector('#tournamentBuyInPills') as HTMLDivElement;
  const errorEl = backdrop.querySelector('#tournamentStartError') as HTMLParagraphElement;
  const cancelButton = backdrop.querySelector('#cancelTournamentStart') as HTMLButtonElement;
  const submitButton = backdrop.querySelector('#submitTournamentStart') as HTMLButtonElement;

  startAtInput.value = formatDateTimeLocal(new Date());
  locationInput.value = cashPrefs.lastLocation;
  stakesInput.value = tournamentPrefs.lastStakes;
  buyInInput.value = tournamentPrefs.lastBuyInDollars;

  addPills(locationPills, cashPrefs.locations, value => {
    locationInput.value = value;
    locationInput.focus();
  });

  addPills(stakesPills, tournamentPrefs.stakes, value => {
    stakesInput.value = value;
    stakesInput.focus();
  });

  addPills(
    buyInPills,
    tournamentPrefs.buyIns,
    value => {
      buyInInput.value = value;
      buyInInput.focus();
    },
    value => `$${value}`
  );

  const close = attachSheetCloseHandlers(backdrop, cancelButton);

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

    if (location.length > MAX_LOCATION_LENGTH) {
      errorEl.textContent = 'Location must be 30 characters or fewer.';
      return;
    }

    if (stakes.length > MAX_STAKES_LENGTH) {
      errorEl.textContent = 'Stakes must be 25 characters or fewer.';
      return;
    }

    const buyInCents = parseDollarsToCents(buyInInput.value.trim(), true, MAX_BUY_IN_DOLLARS);

    if (buyInCents === null) {
      errorEl.textContent = 'Please enter a valid buy-in amount up to $10,000,000 (example: 100 or 100.50).';
      return;
    }

    submitButton.disabled = true;

    try {
      await service.createTournamentSession(
        stakes || undefined,
        location || undefined,
        buyInCents,
        startedAtMillis
      );

      saveCashLocationPreference(location);
      saveTournamentStartPreferences({
        stakes,
        buyInDollars: formatDollarsFromCents(buyInCents)
      });

      close();
      navigate('start');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start tournament.';
      errorEl.textContent = message;
      submitButton.disabled = false;
    }
  });
}

export async function renderHomeView(service: SessionService): Promise<HTMLElement> {

  const container = document.createElement('div');
  container.className = 'app-container';

  container.innerHTML = `
    <div class="sessions-card home-card">
      <div class="home-header">
        <h1 class="home-brand">Stack Flow</h1>
        <img class="home-logo" src="${logoTransparent}" alt="Stack Flow logo" />
      </div>

      <div class="home-actions home-actions-vertical">
        <button id="startCash" class="session-action-btn">Start Cash Game</button>
        <button id="startTournament" class="session-action-btn">Start Tournament</button>
        <button id="viewSessions" class="session-action-btn">View Sessions</button>
      </div>
    </div>
  `;

  container.querySelector('#startCash')!
    .addEventListener('click', () => {
      openCashStartSheet(service);
    });

  container.querySelector('#startTournament')!
    .addEventListener('click', () => {
      openTournamentStartSheet(service);
    });

  container.querySelector('#viewSessions')!
    .addEventListener('click', async () => {
      navigate('sessions');
    });

  return container;
}





