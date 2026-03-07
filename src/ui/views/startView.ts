import type { SessionService } from '../../services/sessionService';
import { renderHomeView } from './homeView';
import { renderCashGameView } from './cashGameView';
import { renderTournamentView } from './tournamentView';

export async function renderStartView(service: SessionService): Promise<HTMLElement> {

  const session = await service.getActiveSession();
  console.log('session', session);
  
  if (!session) {
    const el = await renderHomeView(service);
    console.log('No active session found', el);
    return el;
  } else if (session.mode == 'cash') {
    const el = await renderCashGameView(session, service);
    return el;
  } else if (session.mode == 'tournament') {
    const el = await renderTournamentView(session, service);
    return el;
  } else {
    throw new Error('Unknown session mode: ' + session.mode);
  }

}
