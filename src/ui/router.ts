export type Route = 'start' | 'sessions' | 'stats';

type RouteListener = (route: Route) => void;

let listener: RouteListener | null = null;

function parseHash(): Route {
  const hash =  window.location.hash.slice(1);
  console.log('parsed hash:', hash);
  switch (hash) {
    case 'sessions': return 'sessions';
    case 'stats':    return 'stats';
    default:         return 'start';
  }
}

export function initRouter(onRouteChange: RouteListener) {
  listener = onRouteChange;

  // Initial render
  listener(parseHash());

  // Listen for back/forward + manual hash changes
  window.addEventListener('hashchange', () => {
    if (listener) {
      listener(parseHash());
    }
  });
}

export function navigate(route: Route) {
  window.location.hash = `${route}`;
}

export function getCurrentRoute(): Route {
  return parseHash();
}