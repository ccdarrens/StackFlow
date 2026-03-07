import type { SessionService } from '../services/sessionService';
import { renderStartView } from './views/startView';
import { renderSessionsView } from './views/sessionsView';
import { renderStatsView } from './views/statsView';

import type { Route } from './router';

export async function renderApp(route: Route, service: SessionService) {
  
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = '';  // clear page

  switch (route) {
    case 'sessions':
      root.appendChild(await renderSessionsView(service));
      break;

    case 'stats':
      root.appendChild(await renderStatsView(service));
      break;

    default:
      root.appendChild(await renderStartView(service));
  }
}

