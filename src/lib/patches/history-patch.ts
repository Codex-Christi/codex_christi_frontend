// lib/history-patch.ts
type HistoryHandler = () => void;

const handlers = new Set<HistoryHandler>();
let isPatched = false;

export function patchHistory() {
  if (typeof window === 'undefined' || isPatched) return;

  const { pushState, replaceState } = window.history;

  window.history.pushState = function (data, unused, url) {
    const result = pushState.call(this, data, unused, url);
    handlers.forEach((handler) => handler());
    return result;
  };

  window.history.replaceState = function (data, unused, url) {
    const result = replaceState.call(this, data, unused, url);
    handlers.forEach((handler) => handler());
    return result;
  };

  window.addEventListener('popstate', () => {
    handlers.forEach((handler) => handler());
  });

  isPatched = true;
}

export function addHistoryHandler(handler: HistoryHandler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}
