import { DefaultSessionService } from '../services/sessionService';
import { LocalStorageRepository } from '../storage/localStorageRepository';
import { renderApp } from './render';
import { initRouter } from './router';
import type { Route } from './router';

const repository = new LocalStorageRepository();
const service = new DefaultSessionService(repository);

export function initApp() {
  initRouter((route: Route) => {
    renderApp(route, service);
  });
}
