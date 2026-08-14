/**
 * sound.ts — kısa, üretimde gömülü (base64 gerektirmeyen) WebAudio tonları.
 * Harici ses dosyası indirmeye gerek yok, bu yüzden network erişimi
 * olmayan build ortamlarında da çalışır.
 *
 * Kullanıcı tercihleri (ses / konuşma) global anahtarlardan okunur.
 * ProfilePage üzerinden değiştirilebilir.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let unlockInstalled = false;

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function setSpeechEnabled(_enabled: boolean): void {
  // Preference is retained for compatibility; app feedback intentionally uses tones only.
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export async function unlockAudio(): Promise<boolean> {
  if (!soundEnabled || typeof window === 'undefined') return false;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

export function initializeAudioManager(): () => void {
  if (unlockInstalled || typeof window === 'undefined') return () => {};
  unlockInstalled = true;
  const unlock = () => { void unlockAudio(); };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('touchend', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
  return () => {
    unlockInstalled = false;
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('touchend', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
}

function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine') {
  if (!soundEnabled) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // iOS/browser autoplay policies can block WebAudio until a user gesture.
  }
}

export function playIncomeSound() {
  [659, 880, 1175].forEach((frequency, index) =>
    setTimeout(() => playTone(frequency, 120, index === 2 ? 'sine' : 'triangle'), index * 75)
  );
}

export function playExpenseSound() {
  [494, 392, 294].forEach((frequency, index) =>
    setTimeout(() => playTone(frequency, 135, index === 2 ? 'sawtooth' : 'triangle'), index * 80)
  );
}

export function playWorkStartSound() {
  playTone(523, 90, 'square');
  setTimeout(() => playTone(784, 140, 'sine'), 85);
}

export function playWorkEndSound() {
  playTone(659, 100, 'sine');
  setTimeout(() => playTone(392, 170, 'triangle'), 90);
}

export function playCelebrationSound() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 200), i * 120));
}
