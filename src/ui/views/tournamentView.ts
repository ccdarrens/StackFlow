import type { SessionService } from '../../services/sessionService';
import type { Session } from '../../models/session';
import { calculateSessionTotals } from '../../stats/calculators';
import { navigate } from '../router';

export async function renderTournamentView(session: Session, service: SessionService): Promise<HTMLElement> {
  // TODO verify session is tournament, show hours for duration
  const container = document.createElement('div');
  container.className = 'app-container';
  const start = session.startedAt;
  const totals = calculateSessionTotals(session);
  const diff = Date.now() - start;
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);

  container.innerHTML = `
      <h1>Active Tournament Session</h1>
      <p>Stakes: ${session.stakes ?? '-'}</p>
      <p>Location: ${session.location ?? '-'}</p>
      <p>Duration: <span id="activeDuration">${min}:${sec.toString().padStart(2,'0')}</span></p>
      <hr/>
      <p>Invested: $${(totals.invested / 100).toFixed(2)}</p>
      <p>Returned: $${(totals.returned / 100).toFixed(2)}</p>
      <p>Expenses: $${(totals.expenses / 100).toFixed(2)}</p>      
      <h2>Gross: $${(totals.grossProfit / 100).toFixed(2)}</h2>
      <h2>Net: $${(totals.netProfit / 100).toFixed(2)}</h2>
      <h2>ROI (Gross): ${((totals.roi ? totals.roi : 0) * 100).toFixed(1)} %</h2>
      <h2>ROI (Net): ${((totals.netRoi ? totals.netRoi : 0 ) * 100).toFixed(1)}%</h2>

      <hr/>
      <div id="actions">
        <button id="rebuy">Rebuy ($150)</button>
        <button id="tip">Tip ($1)</button>
        <button id="food">Food ($5)</button>
        <button id="payout">Payout ($800)</button>
      </div>
      <button id="endSession">End Session</button>
  `;

  const durationEl = container.querySelector('#activeDuration')!;
  setInterval(() => {
    const diff = Date.now() - start;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    durationEl.textContent = `${minutes}:${seconds.toString().padStart(2,'0')}`;
  }, 1000);

  container.querySelector('#rebuy')!
    .addEventListener('click', async () => {
      await service.addInvestment(15000, 'rebuy');
      navigate('start');
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

  container.querySelector('#payout')!
    .addEventListener('click', async () => {
      await service.addReturn(80000, 'payout');
      navigate('start');
    });

  container.querySelector('#endSession')!
    .addEventListener('click', async () => {
      await service.endSession();
      navigate('start');
    });
  return container;
}
