// Short sound effects made with the Web Audio API, so there are no audio files to cache.
// iOS starts an AudioContext suspended; unlockSound() resumes it inside a user tap.
import { settings } from './store.js';

const Ctx = window.AudioContext || window.webkitAudioContext;
let ctx = null;

export function unlockSound() {
  if (!Ctx) return;
  try {
    ctx ||= new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

// [frequency Hz, start offset s, length s] per note
const SOUNDS = {
  ok: [[660, 0, 0.09], [990, 0.07, 0.14]],
  bad: [[220, 0, 0.12], [165, 0.1, 0.18]],
  combo: [[660, 0, 0.08], [830, 0.07, 0.08], [990, 0.14, 0.08], [1320, 0.21, 0.2]],
  done: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.3]],
  tap: [[520, 0, 0.05]],
};

// Unlockable sound packs (settings.soundPack): same notes, different voice.
// soft = mellow and an octave lower, retro = square wave like old game consoles.
const PACKS = {
  classic: { wave: 'sine', bad: 'triangle', pitch: 1, vol: 0.18 },
  soft: { wave: 'triangle', bad: 'triangle', pitch: 0.5, vol: 0.22 },
  retro: { wave: 'square', bad: 'square', pitch: 1, vol: 0.07 },
};

export function sfx(name, pack = settings.soundPack) {
  if (!settings.sound || !SOUNDS[name]) return;
  unlockSound();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const voice = PACKS[pack] || PACKS.classic;
  const wave = name === 'bad' ? voice.bad : voice.wave;
  for (const [f, at, len] of SOUNDS[name]) {
    const freq = f * voice.pitch;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    // quick attack and exponential release so notes don't click
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(voice.vol, now + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + len + 0.02);
  }
}

// Android vibrates; iOS Safari has no Vibration API, so the sound carries the feedback there.
export function buzz(ms = 50) {
  if (settings.sound && navigator.vibrate) navigator.vibrate(ms);
}
