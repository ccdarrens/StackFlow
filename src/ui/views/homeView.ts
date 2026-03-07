import type { SessionService } from '../../services/sessionService';
import { navigate } from '../router';

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
    .addEventListener('click', async () => {
      await service.createCashSession('1/3 NLH', 'Stones', 10000);
      navigate('start');
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