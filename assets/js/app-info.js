// Version info (from version.js, loaded as a classic script before the app)
// and platform checks.
export const APP_VERSION = self.APP_VERSION || '0.0.0';
export const APP_BUILD = self.APP_BUILD || 'dev';

export function versionLabel() {
  return APP_BUILD === 'dev' ? `v${APP_VERSION} (dev)` : `v${APP_VERSION} · build ${APP_BUILD}`;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isIPad() {
  return /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

// Where word mistakes are reported (GitHub issue form .github/ISSUE_TEMPLATE/word-fix.yml).
export const REPO_URL = 'https://github.com/nopjorn/essential-vocab-multi-language';

// A new issue with the form filled in as far as the app knows (language, set, word).
export function reportUrl({ lang, set, word = '' }) {
  const q = new URLSearchParams({ template: 'word-fix.yml', title: `แจ้งคำผิด: ${lang} › ${set}${word ? ` › ${word}` : ''}`, lang, set, word });
  return `${REPO_URL}/issues/new?${q}`;
}
