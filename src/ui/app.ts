import { DefaultSessionService } from '../services/sessionService';
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

