import type { SessionService } from '../../services/sessionService';
import { calculateLifetimeStats } from '../../stats/calculators';

export async function renderStatsView(service: SessionService ): Promise<HTMLElement> {
  
  const completed = await service.getCompletedSessions();
  const lifetime = calculateLifetimeStats(completed);
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="app-container">
      <h2>Lifetime Stats</h2>
      <p>Total Profit (Gross): $${(lifetime.totalGrossProfit / 100).toFixed(2)}</p>
      <p>Total Profit (Net): $${(lifetime.totalNetProfit / 100).toFixed(2)}</p>
      <p>Total Expenses: $${(lifetime.totalExpenses / 100).toFixed(2)}</p>
      <p>Total Duration: ${(lifetime.totalDurationMs / (1000*60*60)).toFixed(2)} hrs</p>
      ${lifetime.hourlyGross !== null && lifetime.hourlyGross !== undefined ? `<p>Hourly Gross: $${(lifetime.hourlyGross / 100).toFixed(2)}/hr</p>` : ''}
      ${lifetime.hourlyNet !== null && lifetime.hourlyNet !== undefined ? `<p>Hourly Net: $${(lifetime.hourlyNet / 100).toFixed(2)}/hr</p>` : ''}
    </div>
  `;

  return container;
}