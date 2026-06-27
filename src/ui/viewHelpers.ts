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

export function formatDateTimeLocalSeconds(now: Date): string {
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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

export function blurActiveElement(): void {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
}

export function attachDataEntryPillHandler(button: HTMLButtonElement, onPick: () => void): void {
  const keepFocusOffPill = (event: Event) => {
    event.preventDefault();
  };

  button.addEventListener('pointerdown', keepFocusOffPill);
  button.addEventListener('mousedown', keepFocusOffPill);
  button.addEventListener('click', () => {
    onPick();
    blurActiveElement();
  });
}

export function formatMoney(cents: number, withPlus = false): string {
  const sign = cents < 0 ? '-' : (withPlus && cents > 0 ? '+' : '');
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

let breakWarningAudio: HTMLAudioElement | null = null;

function getBreakWarningAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') {
    return null;
  }

  if (!breakWarningAudio) {
    breakWarningAudio = new Audio(`${import.meta.env.BASE_URL}audio/timer-alert.mp3`);
    breakWarningAudio.preload = 'auto';
    breakWarningAudio.volume = 0.8;
  }

  return breakWarningAudio;
}

function playBreakWarningFallback(): void {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);

    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, 300);
  } catch {
    // Best-effort effect only.
  }
}

export function primeBreakWarningSignal(): void {
  try {
    const audio = getBreakWarningAudio();
    if (!audio) {
      return;
    }

    audio.muted = true;
    audio.currentTime = 0;
    void audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  } catch {
    // Best-effort effect only.
  }
}

export function playBreakWarningSignal(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([120, 80, 120]);
  }

  try {
    const audio = getBreakWarningAudio();
    if (!audio) {
      playBreakWarningFallback();
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    void audio.play().catch(() => {
      playBreakWarningFallback();
    });
  } catch {
    playBreakWarningFallback();
  }
}

export function celebratePositiveResult(profitCents: number): void {
  if (profitCents <= 0) {
    return;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([100, 60, 140]);
  }

  try {
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/cha-ching.mp3`);
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

