export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatDateTimeLocal(now: Date): string {
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseDollarsToCents(rawValue: string, allowZero = false, maxDollars?: number): number | null {
  const normalized = rawValue.replace(/[$,\s]/g, '');
  if (!normalized) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  const minAllowed = allowZero ? 0 : Number.EPSILON;

  if (!Number.isFinite(amount) || amount < minAllowed) {
    return null;
  }

  if (maxDollars !== undefined && amount > maxDollars) {
    return null;
  }

  return Math.round(amount * 100);
}

export function formatMoney(cents: number, withPlus = false): string {
  const sign = cents < 0 ? '-' : (withPlus && cents > 0 ? '+' : '');
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function celebratePositiveResult(profitCents: number): void {
  if (profitCents <= 0) {
    return;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([100, 60, 140]);
  }

  try {
    const audio = new Audio('/audio/cha-ching.mp3');
    audio.preload = 'auto';
    audio.volume = 0.8;
    void audio.play().catch(() => undefined);
  } catch {
    // Best-effort effect only.
  }

  const overlay = document.createElement('div');
  overlay.className = 'cash-celebration';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.textContent = formatMoney(profitCents, true);
  document.body.appendChild(overlay);

  window.setTimeout(() => {
    overlay.remove();
  }, 1500);
}

export function attachSheetCloseHandlers(backdrop: HTMLDivElement, closeButton: HTMLButtonElement): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
    }
  };

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
  };

  closeButton.addEventListener('click', close);

  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) {
      close();
    }
  });

  document.addEventListener('keydown', onKeyDown);

  return close;
}
