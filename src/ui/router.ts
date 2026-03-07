export type Route = 'start' | 'sessions' | 'stats';

type RouteListener = (route: Route) => void;

let listener: RouteListener | null = null;

function parseHash(): Route {
  const hash =  window.location.hash.slice(1);
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
  const current = parseHash();
  window.location.hash = `${route}`;

  // Hashchange does not fire when navigating to the current hash;
  // force a route callback so views can rerender after in-place actions.
  if (route === current && listener) {
    listener(route);
  }
}

export function getCurrentRoute(): Route {
  return parseHash();
}


