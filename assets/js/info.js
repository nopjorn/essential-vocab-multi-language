// Guide (คู่มือการเล่น) and changelog (มีอะไรใหม่) pages.
import { settings } from './store.js';
import { state, h, render, fetchJSON, pageHead, groupTitle } from './core.js';
import { GUIDE } from './guide.js';
import { icon } from './icons.js';
import { APP_VERSION, versionLabel } from './app-info.js';

export function renderHelp(anchor) {
  const t = state.t;
  const sections = GUIDE[settings.target] || GUIDE.th;
  const shown = render(
    pageHead(t.guideTitle),
    h('nav', { class: 'toc' }, sections.map((s) => h('a', { href: `#/help/${s.id}` }, s.title))),
    sections.map((s) =>
      h('section', { class: 'card guide', id: `guide-${s.id}` },
        h('h2', { class: 'guide-head' }, h('span', { class: `row-icon ${s.color}` }, icon(s.icon, { size: 18 })), s.title),
        h('ul', {}, s.items.map((it) =>
          typeof it === 'string' ? h('li', {}, it) : h('li', {}, h('b', {}, it.b), ' ', it.text))),
      )),
    h('p', { class: 'group-foot center' }, h('a', { href: '#/changelog' }, `${t.whatsNew} · ${versionLabel()}`)),
  );
  if (anchor) shown.then(() => document.getElementById(`guide-${anchor}`)?.scrollIntoView({ block: 'start' }));
}

export async function renderChangelog() {
  const t = state.t;
  const nav = state.navId;
  let log = [];
  try {
    log = await fetchJSON('data/changelog.json');
  } catch (err) {
    console.error(err);
  }
  if (nav !== state.navId) return;
  render(
    pageHead(t.whatsNew, { sub: `${t.currentVersion}: ${versionLabel()}`, back: { href: '#/settings', label: t.settingsTitle } }),
    log.map((v) => [
      groupTitle(`v${v.version}`, h('span', { class: 'muted' }, v.date)),
      h('section', { class: 'card changelog' },
        v.version === APP_VERSION ? h('span', { class: 'badge' }, t.current) : null,
        h('ul', {}, (v.changes[settings.target] || v.changes.th).map((c) => h('li', {}, c)))),
    ]),
  );
}
