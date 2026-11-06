// Text-to-speech using the browser's built-in voices (Web Speech API).
// On iOS/iPadOS Safari the first speak() must happen inside a user tap;
// after that, programmatic speech works for the rest of the session.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];

function refreshVoices() {
  if (synth) voices = synth.getVoices();
}

if (synth) {
  refreshVoices();
  synth.addEventListener?.('voiceschanged', refreshVoices);
}

export const speechSupported = !!synth;

export function findVoice(langTag) {
  if (!voices.length) refreshVoices();
  const base = langTag.split('-')[0].toLowerCase();
  const tag = langTag.toLowerCase().replace('_', '-');
  const matches = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(base));
  if (!matches.length) return null;
  return (
    matches.find((v) => v.lang.toLowerCase().replace('_', '-') === tag && v.localService) ||
    matches.find((v) => v.lang.toLowerCase().replace('_', '-') === tag) ||
    matches[0]
  );
}

export function hasVoice(langTag) {
  return !!findVoice(langTag);
}

export function speak(text, langTag, rate = 0.9) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langTag;
  const v = findVoice(langTag);
  if (v) u.voice = v;
  u.rate = rate;
  synth.speak(u);
}

// Call once from a user gesture to unlock audio on iOS.
export function unlock() {
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth.speak(u);
}
