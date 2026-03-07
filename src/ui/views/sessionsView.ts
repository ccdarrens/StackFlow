import type { SessionService } from '../../services/sessionService';
import { calculateSessionTotals } from '../../stats/calculators';

export async function renderSessionsView(service: SessionService ): Promise<HTMLElement> {
  
  const completed = await service.getCompletedSessions();
  console.log('completed sessions:', completed);
  const container = document.createElement('div');
  
  container.innerHTML = `
    <div class="app-container">
      <h2>Past Sessions</h2>
      <div id="history"></div>
    </div>
  `;

  const historyDiv = container.querySelector('#history'); 
  console.log('history div:', historyDiv);
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
            <strong>${s.mode === 'cash' ? 'Cash' : 'Tournament'}</strong> |
            ${s.location} |
            ${new Date(s.startedAt).toLocaleDateString()} |
            ${hours} hrs |
            $${(totals.grossProfit / 100).toFixed(2)}
          </div>
        `;
      }).join('');
    }
  }
  return container;
}