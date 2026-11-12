// Plateforme de commande d'arômes Givaudan : coque de l'application et routage par ancre (#/…)
import './styles.css';
import { logo } from './logo';
import { clearDraft, errorBox, go, icon, loading } from './ui';
import { dictation, proposals, refine } from './views/flow';
import { expert, order, sample } from './views/forms';
import { home } from './views/home';
import { history, orderTracking, requestTracking } from './views/tracking';

type Nav = 'home' | 'new' | 'history';
type View = (
  root: HTMLElement,
  match: string[],
  params: URLSearchParams,
) => unknown;

// Chaque écran : son motif d'URL, son entrée de navigation, et s'il fait partie du parcours de demande
const ROUTES: { pattern: RegExp; view: View; nav: Nav; flow?: boolean }[] = [
  { pattern: /^\/$/, view: (root) => home(root), nav: 'home' },
  {
    pattern: /^\/dictee$/,
    view: (root, _m, p) => dictation(root, p),
    nav: 'new',
    flow: true,
  },
  {
    pattern: /^\/affiner$/,
    view: (root) => refine(root),
    nav: 'new',
    flow: true,
  },
  {
    pattern: /^\/propositions$/,
    view: (root) => proposals(root),
    nav: 'new',
    flow: true,
  },
  {
    pattern: /^\/echantillon\/([^/]+)$/,
    view: (root, m) => sample(root, decodeURIComponent(m[1])),
    nav: 'new',
    flow: true,
  },
  {
    pattern: /^\/expert$/,
    view: (root) => expert(root),
    nav: 'new',
    flow: true,
  },
  {
    pattern: /^\/commande\/([^/]+)$/,
    view: (root, m, p) => order(root, decodeURIComponent(m[1]), p),
    nav: 'history',
  },
  {
    pattern: /^\/suivi\/demande\/(\d+)$/,
    view: (root, m) => requestTracking(root, Number(m[1])),
    nav: 'history',
  },
  {
    pattern: /^\/suivi\/commande\/(\d+)$/,
    view: (root, m) => orderTracking(root, Number(m[1])),
    nav: 'history',
  },
  {
    pattern: /^\/demandes$/,
    view: (root, _m, p) => history(root, p),
    nav: 'history',
  },
];

const NAV: { key: Nav; href: string; label: string; icon: string }[] = [
  { key: 'home', href: '#/', label: 'Accueil', icon: 'home' },
  { key: 'new', href: '#/dictee', label: 'Nouvelle demande', icon: 'plus' },
  { key: 'history', href: '#/demandes', label: 'Mes demandes', icon: 'list' },
];

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <a class="skip" href="#view">Aller au contenu</a>
  <aside class="sidebar">
    <a class="brand" href="#/" aria-label="Accueil Givaudan">${logo()}</a>
    <p class="brand-sub">Commande d’arômes</p>
    <nav aria-label="Navigation principale">
      ${NAV.map((n) => `<a class="nav-link" data-nav="${n.key}" href="${n.href}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}
    </nav>
    <div class="sidebar-foot">
      <span class="avatar">J</span>
      <div><strong>Julien</strong><small>PME Boissons</small></div>
    </div>
  </aside>
  <header class="topbar">
    <a class="brand" href="#/" aria-label="Accueil Givaudan">${logo()}</a>
    <span class="avatar">J</span>
  </header>
  <main id="view" tabindex="-1"></main>
  <nav class="bottom-nav" aria-label="Navigation">
    ${NAV.map((n) => `<a data-nav="${n.key}" href="${n.href}">${icon(n.icon, 22)}<span>${n.label}</span></a>`).join('')}
  </nav>`;

const view = document.querySelector<HTMLElement>('#view')!;

// « Nouvelle demande » repart toujours d'une page blanche
app.querySelectorAll<HTMLAnchorElement>('[data-nav="new"]').forEach((a) =>
  a.addEventListener('click', (event) => {
    event.preventDefault();
    clearDraft();
    if (location.hash === '#/dictee') void render();
    else go('#/dictee');
  }),
);

async function render() {
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query);
  const route = ROUTES.find((r) => r.pattern.test(path));
  if (!route) {
    go('#/');
    return;
  }
  document.body.classList.toggle('in-flow', Boolean(route.flow));
  app.querySelectorAll<HTMLElement>('[data-nav]').forEach((a) => {
    if (a.dataset.nav === route.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  view.innerHTML = loading();
  try {
    await route.view(view, route.pattern.exec(path) ?? [], params);
  } catch (error) {
    view.innerHTML = `<section class="flow narrow">${errorBox(error)}<a class="btn btn-secondary" href="#/">Revenir à l’accueil</a></section>`;
  }
  window.scrollTo({ top: 0 });
  view.focus({ preventScroll: true });
}

window.addEventListener('hashchange', () => void render());
void render();
