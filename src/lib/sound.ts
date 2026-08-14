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
let speechEnabled = true;
let cachedTurkishFemaleVoice: SpeechSynthesisVoice | null = null;

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function setSpeechEnabled(enabled: boolean): void {
  speechEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function isSpeechEnabled(): boolean {
  return speechEnabled;
}

function selectTurkishFemaleVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const turkishFemale = voices.find(
    (v) => (v.lang === 'tr-TR' || v.lang === 'tr') && /female|kadın|woman/i.test(v.name)
  );
  if (turkishFemale) return turkishFemale;

  const turkishFemaleName = voices.find(
    (v) => (v.lang === 'tr-TR' || v.lang === 'tr') && /ayşe|ayşe|ayla|zeynep|elin|elif|fatma|deniz|defne|selin|ceyda|cansu|büşra|merve|müge|nazlı|nur|özlem|serap|şebnem|ümmü|gülşen/i.test(v.name)
  );
  if (turkishFemaleName) return turkishFemaleName;

  const turkish = voices.find((v) => v.lang === 'tr-TR' || v.lang === 'tr');
  if (turkish) return turkish;

  const anyFemale = voices.find((v) => /female|kadın|woman/i.test(v.name));
  if (anyFemale) return anyFemale;

  const anyFemaleName = voices.find((v) => /ayşe|ayşe|ayla|zeynep|elin|elif|fatma|deniz|defne|selin|ceyda|cansu|büşra|merve|müge|nazlı|nur|özlem|serap|şebnem|ümmü|gülşen/i.test(v.name));
  if (anyFemaleName) return anyFemaleName;

  return null;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedTurkishFemaleVoice = selectTurkishFemaleVoice();
    if (cachedTurkishFemaleVoice) {
      console.log('[sound.ts] Selected Turkish female voice:', cachedTurkishFemaleVoice.name, 'lang:', cachedTurkishFemaleVoice.lang);
    } else {
      console.log('[sound.ts] No Turkish female voice available, will use browser default voice');
    }
  };
  cachedTurkishFemaleVoice = selectTurkishFemaleVoice();
  if (cachedTurkishFemaleVoice) {
    console.log('[sound.ts] Initial Turkish female voice:', cachedTurkishFemaleVoice.name, 'lang:', cachedTurkishFemaleVoice.lang);
  } else {
    console.log('[sound.ts] No Turkish female voice available initially, will use browser default voice');
  }
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine') {
  if (!soundEnabled) return;
  try {
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

export function speak(text: string, force?: boolean) {
  if (!soundEnabled) return;
  if (!speechEnabled && force !== true) return;
  if (force === false) return;
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'tr-TR';
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  const voice = cachedTurkishFemaleVoice || selectTurkishFemaleVoice();
  if (voice) {
    utterance.voice = voice;
    console.log('[sound.ts] Speaking with voice:', voice.name, 'lang:', voice.lang);
  } else {
    console.log('[sound.ts] Speaking with browser default voice (no Turkish female voice available)');
  }
  window.speechSynthesis.speak(utterance);
}
