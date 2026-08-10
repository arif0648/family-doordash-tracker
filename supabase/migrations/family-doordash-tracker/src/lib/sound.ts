/**
 * sound.ts — kısa, üretimde gömülü (base64 gerektirmeyen) WebAudio tonları.
 * Harici ses dosyası indirmeye gerek yok, bu yüzden network erişimi
 * olmayan build ortamlarında da çalışır.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine') {
  const ctx = getCtx();
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
}

export function playIncomeSound() {
  playTone(880, 150);
  setTimeout(() => playTone(1174, 180), 100);
}

export function playExpenseSound() {
  playTone(440, 200, 'triangle');
}

export function playCelebrationSound() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 200), i * 120));
}

export function speak(text: string, enabled: boolean) {
  if (!enabled) return;
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'tr-TR';
  window.speechSynthesis.speak(utterance);
}
