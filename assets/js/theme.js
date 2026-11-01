// Light / dark / follow-system theme. The early inline script in index.html
// sets data-theme before first paint; this module keeps it in sync.
import { settings, saveSettings } from './store.js';
import { state, h } from './core.js';
import { icon } from './icons.js';

const THEMES = ['system', 'light', 'dark'];
const ICONS = { system: 'system', light: 'sun', dark: 'moon' };
const BAR = { light: '#f2f3f7', dark: '#0e0f13' };

export function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') root.dataset.theme = settings.theme;
  else delete root.dataset.theme;
  // Unlockable accent colour and flashcard pattern; the defaults need no attribute.
  if (settings.accent && settings.accent !== 'indigo') root.dataset.accent = settings.accent;
  else delete root.dataset.accent;
  if (settings.cardStyle && settings.cardStyle !== 'plain') root.dataset.card = settings.cardStyle;
  else delete root.dataset.card;

  // Status bar / browser chrome color follows the effective theme.
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((m) => {
    if (settings.theme === 'system') m.setAttribute('content', m.media.includes('dark') ? BAR.dark : BAR.light);
    else m.setAttribute('content', BAR[settings.theme]);
  });
}

export function themeControl() {
  const t = state.t;
  const labels = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark };
  return h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t.theme },
    THEMES.map((th) =>
      h('label', {},
        h('input', {
          type: 'radio',
          name: 'theme',
          value: th,
          checked: settings.theme === th,
          onchange: () => {
            settings.theme = th;
            saveSettings();
            applyTheme();
          },
        }),
        h('span', {}, icon(ICONS[th], { size: 16 }), labels[th]),
      ),
    ),
  );
}
