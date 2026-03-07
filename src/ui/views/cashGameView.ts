import type { SessionService } from '../../services/sessionService';
import type { Session } from '../../models/session';
import { calculateSessionTotals } from '../../stats/calculators';
import { navigate } from '../router';

export async function renderCashGameView(session: Session, service: SessionService): Promise<HTMLElement> {
  // TODO verify session is cash, show hours for duration
  const container = document.createElement('div');
  container.className = 'app-container';
  const start = session.startedAt;
  const totals = calculateSessionTotals(session);
  const diff = Date.now() - start;
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);

  container.innerHTML = `
      <h1>Active Cash Session</h1>
      <p>Stakes: ${session.stakes ?? '-'}</p>
      <p>Location: ${session.location ?? '-'}</p>
      <p>Duration: <span id="activeDuration">${min}:${sec.toString().padStart(2,'0')}</span></p>
      <hr/>
      <p>Invested: $${(totals.invested / 100).toFixed(2)}</p>
      <p>Returned: $${(totals.returned / 100).toFixed(2)}</p>
      <p>Expenses: $${(totals.expenses / 100).toFixed(2)}</p>      
      <h2>Gross: $${(totals.grossProfit / 100).toFixed(2)}</h2>
      <h2>Net: $${(totals.netProfit / 100).toFixed(2)}</h2>
      <hr/>
      <div id="actions">
        <button id="addon">Addon ($50)</button>
        <button id="tip">Tip ($1)</button>
        <button id="food">Food ($5)</button>
        <button id="cashOut">Cash Out ($200)</button>
      </div>
      <button id="endSession">End Session</button>
  `;

  const durationEl = container.querySelector('#activeDuration')!;
  setInterval(() => {
    const diff = Date.now() - start;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    console.log('Duration update', minutes, seconds);
    durationEl.textContent = `${minutes}:${seconds.toString().padStart(2,'0')}`;
  }, 1000);

  container.querySelector('#addon')!
    .addEventListener('click', async () => {
      await service.addInvestment(5000, 'addon');
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
