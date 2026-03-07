import { DefaultSessionService } from '../services/sessionService';
import { calculateLifetimeStats, calculateSessionTotals } from '../stats/calculators';
import { LocalStorageRepository } from '../storage/localStorageRepository';
import { renderApp } from './render';
import { initRouter } from './router';
import type { Route } from './router';

const repository = new LocalStorageRepository();
const service = new DefaultSessionService(repository);

export async function initApp() {
  console.log('app init');
}

function bootstrap() {
  initRouter((route: Route) => {
    renderApp(route, service);
  });
}
bootstrap();

// old render, keep till new model works
async function render() {

  const root = document.getElementById('app');
  if (!root) return;
 
  const active = await service.getActiveSession();
  console.log('active', active);

  if (!active) {
    root.innerHTML = `
      <div class="app-container">
        <h1>StackFlow</h1>
        <button id="startCash">Start Cash Game($100)</button>
        <button id="startTournament">Start Tournament ($150)</button>
        <hr/>
        <h2>Past Sessions</h2>
        <div id="history"></div>
      </div>
    `;

    document.getElementById('startCash')!
      .addEventListener('click', async () => {
        await service.createCashSession('1/3 NLH', 'Stones', 10000);
        render();
      });

    document.getElementById('startTournament')!
      .addEventListener('click', async () => {
        await service.createTournamentSession('$150 MTT', 'Thunder Valley', 15000);
        render();
      });

    const completed = await service.getCompletedSessions();
    const historyDiv = document.getElementById('history'); 
    if (historyDiv) {
      if (completed.length === 0) {
        historyDiv.innerHTML = `<p>No past sessions yet.</p>`;
      } else {
        historyDiv.innerHTML = completed.map(s => {
          const totals = calculateSessionTotals(s);

          const durationMs = s.endedAt! - s.startedAt;
          const hours = (durationMs / (1000 * 60 * 60)).toFixed(2);

          return `
            <div style="margin-bottom:10px;">
              <strong>${s.mode === 'cash' ? 'Cash' : 'Tournament'}</strong>
              |
              ${new Date(s.startedAt).toLocaleDateString()}
              |
              ${hours} hrs
              |
              $${(totals.grossProfit / 100).toFixed(2)}
            </div>
          `;
        }).join('');

        const lifetime = calculateLifetimeStats(completed);  
        const lifetimeDiv = document.createElement('div');
        lifetimeDiv.style.marginTop = '20px';
        lifetimeDiv.innerHTML = `
          <hr/>
          <h2>Lifetime Stats</h2>
          <p>Total Profit (Gross): $${(lifetime.totalGrossProfit / 100).toFixed(2)}</p>
          <p>Total Profit (Net): $${(lifetime.totalNetProfit / 100).toFixed(2)}</p>
          <p>Total Expenses: $${(lifetime.totalExpenses / 100).toFixed(2)}</p>
          <p>Total Duration: ${(lifetime.totalDurationMs / (1000*60*60)).toFixed(2)} hrs</p>
          ${lifetime.hourlyGross !== null && lifetime.hourlyGross !== undefined ? `<p>Hourly Gross: $${(lifetime.hourlyGross / 100).toFixed(2)}/hr</p>` : ''}
          ${lifetime.hourlyNet !== null && lifetime.hourlyNet !== undefined ? `<p>Hourly Net: $${(lifetime.hourlyNet / 100).toFixed(2)}/hr</p>` : ''}
        `;

        root.appendChild(lifetimeDiv);
      }
    }  

    return;
  }

  const totals = calculateSessionTotals(active);

  root.innerHTML = `
    <div class="app-container">
      <h1>Active ${active.mode === 'cash' ? 'Cash' : 'Tournament'} Session</h1>
      <p>Stakes: ${active.stakes ?? '-'}</p>
      <p>Location: ${active.location ?? '-'}</p>
      <p>Duration: <span id="activeDuration">0:00</span></p>
      <hr/>
      <p>Invested: $${(totals.invested / 100).toFixed(2)}</p>
      <p>Returned: $${(totals.returned / 100).toFixed(2)}</p>
      <p>Expenses: $${(totals.expenses / 100).toFixed(2)}</p>
      
      <h2>Gross: $${(totals.grossProfit / 100).toFixed(2)}</h2>
      <h2>Net: $${(totals.netProfit / 100).toFixed(2)}</h2>
      ${active.mode === 'tournament' && totals.roi !== undefined
        ? '<h2>ROI (Gross): ${(totals.roi * 100).toFixed(1)}%</h2>'
        : ''
      }
      ${active.mode === 'tournament' && totals.netRoi !== undefined
        ? '<h2>ROI (Net): ${(totals.netRoi * 100).toFixed(1)}%</h2>'
        : ''
      }
      <hr/>
      <div id="actions"></div>
      <button id="endSession">End Session</button>
    </div>
  `;

  const start = active.startedAt;
  const durationEl = document.getElementById('activeDuration')!;
  setInterval(() => {
    const diff = Date.now() - start;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    // TODO update to show hours
    durationEl.textContent = `${minutes}:${seconds.toString().padStart(2,'0')}`;
  }, 1000);
  const actionsDiv = document.getElementById('actions')!;

  if (active.mode === 'cash') {

    actionsDiv.innerHTML = `
      <button id="addon">Addon ($50)</button>
      <button id="tip">Tip ($1)</button>
      <button id="food">Food ($5)</button>
      <button id="cashOut">Cash Out ($200)</button>
    `;

    document.getElementById('addon')!
      .addEventListener('click', async () => {
        await service.addInvestment(5000, 'addon');
        render();
      });

    document.getElementById('tip')!
      .addEventListener('click', async () => {
        await service.addExpense(100, 'tip', 'tipped the dealer');
        render();
      });

    document.getElementById('food')!
      .addEventListener('click', async () => {
        await service.addExpense(500, 'food', 'bought food');
        render();
      });

    document.getElementById('cashOut')!
      .addEventListener('click', async () => {
        await service.addReturn(20000, 'cashout');
        render();
      });

  } else {

    actionsDiv.innerHTML = `
      <button id="rebuy">Rebuy ($150)</button>
      <button id="payout">Payout ($800)</button>
    `;

    document.getElementById('rebuy')!
      .addEventListener('click', async () => {
        await service.addInvestment(15000, 'rebuy');
        render();
      });

    document.getElementById('payout')!
      .addEventListener('click', async () => {
        await service.addReturn(80000, 'payout');
        render();
      });
  }

  document.getElementById('endSession')!
    .addEventListener('click', async () => {
      await service.endSession();
      render();
    });

}
