// App shell: routing, bottom tab bar, theme, version and update prompts.
// Routes: #/ home (practice setup) · #/progress[/<lang>] · #/help[/<section>] · #/settings · #/changelog · #/words/<lang>/<set>
import { settings, saveSettings, getLastVersion, setLastVersion } from './store.js';
import { state, h, fill, render, loadIndex, setUiLang, toast, fadeNextRender } from './core.js';
import { uiFor } from './i18n.js';
import { renderPractice, startPractice } from './practice.js';
import { renderProgress } from './progress.js';
import { renderWords } from './words.js';
import { renderSettings } from './settings.js';
import { renderHelp, renderChangelog } from './info.js';
import { needsWelcome, renderWelcome } from './welcome.js';
import { setExitHandler, onKeys } from './game.js';
import { applyTheme } from './theme.js';
import { icon } from './icons.js';
import { APP_VERSION } from './app-info.js';

const TABS = [
  ['', 'home', 'navHome'],
  ['progress', 'progress', 'navProgress'],
  ['help', 'guide', 'navHelp'],
  ['settings', 'settings', 'navSettings'],
];

function renderTabBar(active) {
  const t = state.t;
  document.title = t.appName;
  const tabs = TABS.map(([page, ic, key]) => {
    const on = page === active;
    return h('a', { href: `#/${page}`, class: `tab${on ? ' active' : ''}`, 'aria-current': on ? 'page' : null },
      icon(ic, { size: 26 }),
      h('span', { class: 'tab-label' }, t[key]));
  });
  // Start is the main action, so it sits in the middle of the bar on every tab.
  const start = h('button', { type: 'button', class: 'tab tab-start', onclick: startPractice },
    h('span', { class: 'start-fab', 'aria-hidden': 'true' }, icon('play', { size: 24, fill: true })),
    h('span', { class: 'tab-label' }, t.start));
  fill(document.getElementById('tabbar'), tabs.slice(0, 2), start, tabs.slice(2));
}

function route() {
  state.navId++;
  fadeNextRender();
  onKeys(null);
  document.body.classList.remove('in-game');
  setUiLang();
  if (needsWelcome()) {
    // Full screen like a game: no tab bar until the first-run choices are made.
    document.body.classList.add('in-game');
    return renderWelcome(() => {
      if (location.hash && location.hash !== '#/') location.hash = '#/';
      else route();
    });
  }
  const path = location.hash.replace(/^#\/?/, '');
  const [page = '', arg, arg2] = path.split('/');
  const tab = page === 'changelog' ? 'settings' : TABS.some(([p]) => p === page) ? page : '';
  renderTabBar(tab);
  document.getElementById('screen').dataset.page = tab || 'practice';
  if (page === 'progress') return renderProgress(arg);
  if (page === 'help') return renderHelp(arg);
  if (page === 'settings') return renderSettings();
  if (page === 'changelog') return renderChangelog();
  if (page === 'words') return renderWords(arg, arg2);
  return renderPractice();
}

function announceVersion() {
  const last = getLastVersion();
  if (last && last !== APP_VERSION) {
    const t = state.t;
    toast(t.updatedTo.replace('{v}', APP_VERSION), { action: t.whatsNew, onAction: () => (location.hash = '#/changelog') });
  }
  setLastVersion(APP_VERSION);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  // A controller already exists means this is an update, not the first install.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const t = state.t;
    toast(t.updateReady, { action: t.reload, onAction: () => location.reload(), sticky: true });
  });
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      // Home-screen apps on iOS can stay open for days: check for updates when brought back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('SW', e));
}

async function boot() {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  try {
    await loadIndex();
  } catch (err) {
    console.error(err);
    render(h('div', { class: 'card error' }, uiFor(settings.target).loadError));
    return;
  }
  if (!state.index.learn.some((l) => l.code === settings.lang)) {
    settings.lang = state.index.learn[0].code;
    saveSettings();
  }
  // Ask the browser not to evict our data under storage pressure (granted silently where supported).
  navigator.storage?.persist?.().catch(() => {});
  // Leaving a game redraws the page it was started from (games don't change the hash).
  setExitHandler(route);
  window.addEventListener('hashchange', route);
  route();
  announceVersion();
  registerServiceWorker();
}

boot();
