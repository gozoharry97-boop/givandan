// Petits outils partagés par les écrans : échappement, icônes, libellés, brouillon.
import type { Analysis, Criteria, Search, StatusEvent } from './api';

export function esc(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] ?? c,
  );
}

export function cap(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function go(hash: string) {
  location.hash = hash;
}

// Icônes au trait, 24 × 24, couleur du texte
const ICONS: Record<string, string> = {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flask:
    '<path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7.5 15h9"/>',
  box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  repeat:
    '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"/>',
  source: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  shield:
    '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/>',
  forward: '<path d="M14 5l6 6-6 6M20 11H9a5 5 0 0 0-5 5v3"/>',
  sparkle:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
};

export function icon(name: keyof typeof ICONS | string, size = 20): string {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

// Notification discrète en bas d'écran
export function toast(message: string) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

export function errorBox(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `<div class="notice notice-error" role="alert">${icon('info')}<div><strong>Un souci est survenu.</strong><br>${esc(message)}</div></div>`;
}

export function date(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Étapes de suivi, dans l'ordre de l'API (STATUSES)
export const STEPS = {
  sample: [
    [
      'requested',
      'Demande envoyée',
      'Givaudan a reçu votre demande d’échantillon.',
    ],
    ['prepared', 'En préparation', 'Le laboratoire prépare votre échantillon.'],
    ['shipped', 'Expédié', 'Votre échantillon est en route.'],
    ['received', 'Reçu', 'Testez-le et donnez votre avis.'],
  ],
  expert: [
    [
      'sent',
      'Demande transmise',
      'Un expert Givaudan a reçu le résumé de votre besoin.',
    ],
    ['in_progress', 'En analyse', 'L’expert étudie votre demande.'],
    [
      'answered',
      'Réponse de l’expert',
      'L’expert vous recontacte avec une proposition.',
    ],
  ],
  order: [
    ['sent', 'Commande envoyée', 'Givaudan a reçu votre commande.'],
    [
      'confirmed',
      'Confirmée',
      'Prix et date de livraison confirmés par Givaudan.',
    ],
    ['shipped', 'Expédiée', 'Votre commande est en route.'],
    ['delivered', 'Livrée', 'Votre commande est arrivée.'],
  ],
} as const;

export type StepKind = keyof typeof STEPS;

export function statusLabel(kind: StepKind, status: string): string {
  return STEPS[kind].find(([key]) => key === status)?.[1] ?? status;
}

export function isFinal(kind: StepKind, status: string): boolean {
  const steps = STEPS[kind];
  return steps[steps.length - 1][0] === status;
}

export function timeline(
  kind: StepKind,
  status: string,
  events: StatusEvent[] | null,
) {
  const steps = STEPS[kind];
  const current = steps.findIndex(([key]) => key === status);
  return `<ol class="timeline">${steps
    .map(([key, label, detail], i) => {
      const event = events?.find((e) => e.status === key);
      const state = i < current ? 'done' : i === current ? 'current' : 'todo';
      return `<li class="step ${state}">
        <span class="dot">${i <= current ? icon('check', 14) : ''}</span>
        <div><strong>${esc(label)}</strong>
        <p>${esc(detail)}</p>
        ${event ? `<time>${esc(date(event.created_at))}</time>` : ''}</div>
      </li>`;
    })
    .join('')}</ol>`;
}

export function pill(kind: StepKind, status: string): string {
  const tone = isFinal(kind, status) ? 'pill-done' : 'pill-progress';
  return `<span class="pill ${tone}">${esc(statusLabel(kind, status))}</span>`;
}

// Ce que l'assistant a compris, en étiquettes lisibles
export function criteriaChips(criteria: Criteria): string {
  const chips: string[] = [];
  if (criteria.family) chips.push(cap(criteria.family));
  if (criteria.format)
    chips.push(
      criteria.format === 'poudre' ? 'Poudre à mélanger' : 'Prêt à boire',
    );
  if (criteria.natural === true) chips.push('Naturel');
  if (criteria.application) chips.push(cap(criteria.application));
  for (const note of criteria.notes)
    if (note !== criteria.family) chips.push(`Note ${note}`);
  if (!chips.length)
    return '<p class="muted">Rien d’identifié pour l’instant.</p>';
  return `<ul class="chips">${chips.map((c) => `<li class="chip">${esc(c)}</li>`).join('')}</ul>`;
}

// Explication des termes (vocabulaire du métier)
export const GLOSSARY: Record<string, string> = {
  'Arôme naturel':
    'Arôme obtenu à partir de matières d’origine naturelle. Il permet la mention « arôme naturel » sur l’étiquette.',
  'Poudre à mélanger':
    'Arôme sec, prévu pour les produits que le consommateur reconstitue : shaker, sachet, stick.',
  'Prêt à boire':
    'Arôme liquide, prévu pour une boisson déjà conditionnée : bouteille, canette.',
  Conditionnement:
    'Le contenant dans lequel Givaudan livre l’arôme (seau de 5 kg, fût de 25 kg…).',
  Échantillon:
    'Petite quantité envoyée pour tester l’arôme dans votre recette avant de commander.',
};

export function glossary(terms: string[]): string {
  return terms
    .filter((t) => GLOSSARY[t])
    .map(
      (t) =>
        `<details class="term"><summary>${icon('info', 16)}${esc(t)}</summary><p>${esc(GLOSSARY[t])}</p></details>`,
    )
    .join('');
}

// Brouillon du parcours en cours, conservé si l'on recharge la page
export type Draft = { text: string; analysis?: Analysis; search?: Search };
const KEY = 'givaudan.draft';
// Copie en mémoire : le parcours marche même si le stockage est bloqué
let memory: Draft = { text: '' };

export function draft(): Draft {
  try {
    const stored = sessionStorage.getItem(KEY);
    return stored ? (JSON.parse(stored) as Draft) : memory;
  } catch {
    return memory;
  }
}

export function setDraft(next: Draft) {
  memory = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée) : la copie en mémoire suffit
  }
}

export function clearDraft() {
  setDraft({ text: '' });
}

// Fil d'étapes du parcours de demande
const FLOW = ['Besoin', 'Précisions', 'Propositions', 'Demande'];

export function flowHeader(step: number, back?: string): string {
  return `<header class="flow-head">
    ${back ? `<a class="btn-icon" href="${back}" aria-label="Retour">${icon('back')}</a>` : '<span></span>'}
    <ol class="stepper" aria-label="Étape ${step + 1} sur ${FLOW.length}">
      ${FLOW.map((s, i) => `<li class="${i < step ? 'done' : i === step ? 'current' : ''}"><span>${esc(s)}</span></li>`).join('')}
    </ol>
    <button class="btn-quit" data-quit type="button">${icon('close', 18)}<span>Quitter</span></button>
  </header>`;
}

export function bindQuit(root: HTMLElement) {
  root.querySelector('[data-quit]')?.addEventListener('click', () => {
    clearDraft();
    go('#/');
  });
}

export function loading(label = 'Chargement…'): string {
  return `<div class="loading" role="status"><span class="spinner"></span>${esc(label)}</div>`;
}
