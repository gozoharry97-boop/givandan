// Effets « laboratoire » : tubes à essai, animation de composition, envoi de l'échantillon.
// Chaque temps de l'animation correspond à une étape réelle de l'assistant.
import type { Criteria, Flavor, Search } from './api';
import { cap, esc, icon } from './ui';

// Couleur du liquide selon la famille d'arôme
const FAMILY_COLORS: Record<string, string> = {
  'fruits rouges': '#e4415e',
  agrumes: '#f2c230',
  vanille: '#efdcaa',
  chocolat: '#7a4a2e',
  café: '#5b3a28',
  'fruits tropicaux': '#f59e2b',
  'fruits à noyau': '#f4a07a',
  menthe: '#7ccb9a',
  caramel: '#c98a3c',
  pomme: '#a9cf46',
  herbes: '#6fa35a',
};
const DECOR = Object.values(FAMILY_COLORS);

export function familyColor(family?: string): string {
  return (family && FAMILY_COLORS[family]) || '#dae15a';
}

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let uid = 0;

// Tube en verre avec bouchon, liquide coloré et étiquette portant le code de la référence
export function tubeSvg(opts: {
  color: string;
  code: string;
  level?: number;
  best?: boolean;
}): string {
  const id = `t${++uid}`;
  const level = opts.level ?? 0.7;
  const top = 196 - level * 150;
  return `<svg class="tube" viewBox="0 0 64 220" aria-hidden="true">
    <defs>
      <clipPath id="${id}c"><path d="M17 30 H47 V180 A15 15 0 0 1 17 180 Z"/></clipPath>
      <linearGradient id="${id}g" x1="0" x2="1">
        <stop offset="0" stop-color="${opts.color}" stop-opacity=".75"/>
        <stop offset=".5" stop-color="${opts.color}"/>
        <stop offset="1" stop-color="${opts.color}" stop-opacity=".8"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#${id}c)">
      <g class="liquid" style="--top:${top}px">
        <rect x="17" y="${top}" width="30" height="220" fill="url(#${id}g)"/>
        <ellipse cx="32" cy="${top}" rx="15" ry="2.5" fill="#fff" opacity=".35"/>
        <circle class="bubble" cx="26" cy="186" r="2.2" fill="#fff" style="--d:0s"/>
        <circle class="bubble" cx="36" cy="190" r="1.6" fill="#fff" style="--d:.35s"/>
        <circle class="bubble" cx="31" cy="184" r="1.2" fill="#fff" style="--d:.7s"/>
      </g>
    </g>
    <path d="M17 30 H47 V180 A15 15 0 0 1 17 180 Z" fill="rgb(255 255 255 / 8%)" stroke="rgb(255 255 255 / 60%)" stroke-width="1.5"/>
    <path d="M23 42 V172" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
    <rect x="12" y="26" width="40" height="6" rx="3" fill="rgb(255 255 255 / 75%)"/>
    <rect class="cork" x="19" y="6" width="26" height="22" rx="4" fill="${opts.best ? '#dae15a' : '#c0c0c0'}"/>
    <rect x="21" y="66" width="22" height="86" rx="3" fill="#faf9f6" opacity=".94"/>
    <text x="32" y="109" transform="rotate(-90 32 109)" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="600" letter-spacing=".4" fill="#0b1215" font-family="Jost, Futura, sans-serif">${esc(opts.code)}</text>
  </svg>`;
}

// Fiole erlenmeyer de la première étape
function flaskSvg(color: string): string {
  return `<svg class="flask" viewBox="0 0 100 130" aria-hidden="true">
    <defs><clipPath id="flaskc"><path d="M40 12 H60 V52 L88 110 A9 9 0 0 1 80 124 H20 A9 9 0 0 1 12 110 L40 52 Z"/></clipPath></defs>
    <g clip-path="url(#flaskc)"><rect class="flask-liquid" x="0" y="0" width="100" height="130" fill="${color}"/></g>
    <path d="M40 12 H60 V52 L88 110 A9 9 0 0 1 80 124 H20 A9 9 0 0 1 12 110 L40 52 Z" fill="rgb(255 255 255 / 8%)" stroke="rgb(255 255 255 / 65%)" stroke-width="1.6"/>
    <rect x="36" y="8" width="28" height="6" rx="3" fill="rgb(255 255 255 / 75%)"/>
    <path d="M30 80 L22 104" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

function criteriaLabels(c: Criteria): string[] {
  const out: string[] = [];
  if (c.family) out.push(cap(c.family));
  if (c.format) out.push(c.format === 'poudre' ? 'Poudre' : 'Prêt à boire');
  if (c.natural) out.push('Naturel');
  if (c.application) out.push(cap(c.application));
  return out.length ? out : ['Votre demande'];
}

// Attente interrompue si l'utilisateur passe l'animation
function timer(skip: { done: boolean; wake?: () => void }) {
  return (ms: number) =>
    new Promise<void>((resolve) => {
      if (skip.done) return resolve();
      const t = setTimeout(resolve, ms);
      skip.wake = () => {
        clearTimeout(t);
        resolve();
      };
    });
}

// Animation « Le labo compose votre proposition » : 4 temps, entre 4 et 7 secondes
export async function runLab(
  root: HTMLElement,
  criteria: Criteria,
  pending: Promise<Search>,
): Promise<Search> {
  if (reducedMotion()) return pending;

  const color = familyColor(criteria.family);
  const labels = criteriaLabels(criteria);
  const start = performance.now();
  const skip: { done: boolean; wake?: () => void } = { done: false };
  const wait = timer(skip);

  root.innerHTML = `<section class="lab p1" aria-label="L’assistant compose votre proposition">
    <div class="lab-top">
      <p class="lab-status" aria-live="polite">Je lis votre demande…</p>
      <button class="lab-skip" type="button">Passer</button>
    </div>
    <div class="lab-scene">
      <div class="lab-read">
        <ul class="lab-chips">${labels.map((l, i) => `<li style="--i:${i}">${esc(l)}<span class="drop" style="--c:${color}"></span></li>`).join('')}</ul>
        ${flaskSvg(color)}
      </div>
      <div class="lab-search"><div class="lab-rack"></div><p class="lab-count"><strong>0</strong> fiches analysées</p></div>
      <div class="lab-verify"><div class="lab-final"></div>
        <ul class="lab-checks">
          <li style="--i:0">${icon('check', 16)}Raisons tirées des fiches</li>
          <li style="--i:1">${icon('check', 16)}Source vérifiée</li>
          <li style="--i:2">${icon('check', 16)}Aucun prix inventé</li>
        </ul>
      </div>
    </div>
    <ol class="lab-steps" aria-hidden="true"><li>Lecture</li><li>Recherche</li><li>Vérification</li><li>Proposition</li></ol>
  </section>`;

  const lab = root.querySelector<HTMLElement>('.lab')!;
  const status = lab.querySelector<HTMLElement>('.lab-status')!;
  lab.querySelector('.lab-skip')!.addEventListener('click', () => {
    skip.done = true;
    skip.wake?.();
  });
  const phase = (n: number, text: string) => {
    if (skip.done) return;
    lab.className = `lab p${n}`;
    status.textContent = text;
  };

  // 1 · Lecture : les critères tombent dans la fiole
  await wait(1200);

  // 2 · Recherche : le catalogue défile, les fiches qui ne conviennent pas s'éteignent
  const search = await pending;
  if (skip.done) return search;
  phase(2, 'Je parcours le catalogue…');
  const total = search.scanned || 22;
  const found = search.references.length;
  const spots = new Set(
    Array.from(
      { length: found },
      (_, i) => Math.round(((i + 1) * total) / (found + 1)) - 1,
    ),
  );
  const rack = lab.querySelector<HTMLElement>('.lab-rack')!;
  rack.innerHTML = Array.from({ length: total }, (_, i) => {
    const on = spots.has(i);
    const c = on ? color : DECOR[(i * 7) % DECOR.length];
    return `<span class="mini ${on ? 'match' : ''}" style="--i:${i};--c:${c};--lv:${40 + ((i * 37) % 45)}%"></span>`;
  }).join('');
  const counter = lab.querySelector<HTMLElement>('.lab-count strong')!;
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / 1100);
    counter.textContent = String(Math.round(k * total));
    if (k < 1 && !skip.done) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  await wait(1100);
  rack.classList.add('sorted');
  phase(
    2,
    found
      ? `${found} fiche${found > 1 ? 's' : ''} sur ${total} correspond${found > 1 ? 'ent' : ''}`
      : 'Aucune fiche ne convient assez',
  );
  await wait(1000);

  // 3 · Vérification : les tubes retenus se remplissent, les garanties s'affichent
  if (found) {
    lab.querySelector<HTMLElement>('.lab-final')!.innerHTML = search.references
      .map(
        (p, i) =>
          `<div class="final-tube" style="--i:${i}">${tubeSvg({ color: familyColor(p.flavor.family), code: p.flavor.code, level: 0.78 - i * 0.08, best: p.best })}</div>`,
      )
      .join('');
    phase(3, 'Je vérifie les sources…');
    // Rester sous 7 secondes au total
    const left = 6500 - (performance.now() - start);
    await wait(Math.max(400, Math.min(1300, left - 500)));
  }

  // 4 · Proposition : la scène s'efface vers le résultat
  phase(4, found ? 'Voici votre proposition' : 'Je passe la main à un expert');
  await wait(Math.max(0, Math.min(500, 7000 - (performance.now() - start))));
  return search;
}

// Idée B : le tube se bouche et part dans un colis vers le labo Givaudan
export async function shipSample(flavor: Flavor): Promise<void> {
  if (reducedMotion()) return;
  const overlay = document.createElement('div');
  overlay.className = 'ship';
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `<div class="ship-scene">
      <svg class="box-back" viewBox="0 0 200 120" aria-hidden="true"><rect x="20" y="30" width="160" height="90" rx="6" fill="#9c7a45"/></svg>
      <div class="ship-tube">${tubeSvg({ color: familyColor(flavor.family), code: flavor.code, level: 0.75, best: true })}</div>
      <svg class="box-front" viewBox="0 0 200 120" aria-hidden="true">
        <rect x="20" y="30" width="160" height="90" rx="6" fill="#c9a66b"/>
        <rect x="88" y="30" width="24" height="90" fill="#e2c68f"/>
        <text x="100" y="92" text-anchor="middle" font-size="11" font-weight="600" fill="#5b4320" font-family="Jost, Futura, sans-serif">GIVAUDAN</text>
      </svg>
      <svg class="box-lid" viewBox="0 0 200 40" aria-hidden="true"><rect x="14" y="8" width="172" height="24" rx="6" fill="#b8915a"/><rect x="88" y="8" width="24" height="24" fill="#e2c68f"/></svg>
    </div>
    <p>Votre demande part au labo Givaudan</p>`;
  document.body.append(overlay);
  await new Promise((r) => setTimeout(r, 2000));
  overlay.classList.add('out');
  await new Promise((r) => setTimeout(r, 250));
  overlay.remove();
}
