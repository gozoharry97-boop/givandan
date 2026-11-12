// Écran 8 · Suivi (demande ou commande) et historique « Mes demandes »
import { api, type OrderRow, type RequestRow } from '../api';
import {
  clearDraft,
  date,
  esc,
  go,
  icon,
  isFinal,
  pill,
  statusLabel,
  timeline,
  toast,
} from '../ui';

// Cartes d'avis sur l'échantillon reçu
const FEEDBACK = [
  'Le goût me convient',
  'Bonne tenue dans mon produit',
  'Trop sucré',
  'Pas assez intense',
  'Note trop artificielle',
  'Je veux un ajustement',
];

const demoButton = (label: string) =>
  `<div class="demo"><span class="tag">Démo</span><p>Simule l’avancement côté Givaudan.</p><button class="btn btn-small btn-ghost" type="button" data-advance>${esc(label)}</button></div>`;

export async function requestTracking(root: HTMLElement, id: number) {
  const r = await api.request(id);
  const done = isFinal(r.kind, r.status);
  const title =
    r.kind === 'sample'
      ? (r.flavor_name ?? 'Échantillon')
      : 'Demande à un expert';
  const feedback = new Set(r.feedback ?? []);

  root.innerHTML = `
    <header class="page-head">
      <a class="btn-icon" href="#/demandes" aria-label="Retour à mes demandes">${icon('back')}</a>
      <div><p class="eyebrow">${r.kind === 'sample' ? `Échantillon · ${esc(r.flavor_code)}` : 'Relais expert'} · n° ${r.id}</p><h1>${esc(title)}</h1></div>
      ${pill(r.kind, r.status)}
    </header>
    <div class="tracking">
      <section class="card">${timeline(r.kind, r.status, r.events)}${done ? '' : demoButton('Étape suivante')}</section>
      <aside class="tracking-side">
        ${
          r.kind === 'sample' && r.status === 'received'
            ? `<section class="card">
                <p class="eyebrow">Votre avis</p>
                <h2>Qu’avez-vous pensé de l’échantillon ?</h2>
                <div class="feedback">${FEEDBACK.map(
                  (f) =>
                    `<button type="button" class="option option-small ${feedback.has(f) ? 'picked' : ''}" aria-pressed="${feedback.has(f)}" data-feedback="${esc(f)}">${esc(f)}</button>`,
                ).join('')}</div>
                <button class="btn btn-secondary" type="button" data-save>Enregistrer mon avis</button>
                <hr>
                <a class="btn btn-primary btn-lg" href="#/commande/${encodeURIComponent(r.flavor_code ?? '')}?demande=${r.id}">${icon('box', 18)}Commander cette référence</a>
              </section>`
            : ''
        }
        <section class="card">
          <p class="eyebrow">Votre demande</p>
          <p class="pre">${esc(r.need)}</p>
          ${r.address ? `<p class="eyebrow">Livraison</p><p>${esc(r.address)}</p>` : ''}
          <p class="muted">Envoyée le ${esc(date(r.created_at))}</p>
        </section>
      </aside>
    </div>`;

  root.querySelector('[data-advance]')?.addEventListener('click', async () => {
    const next = await api.advanceRequest(id);
    toast(`Nouvelle étape : ${statusLabel(r.kind, next.status)}`);
    await requestTracking(root, id);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-feedback]').forEach((b) =>
    b.addEventListener('click', () => {
      const value = b.dataset.feedback ?? '';
      if (feedback.has(value)) feedback.delete(value);
      else feedback.add(value);
      b.classList.toggle('picked');
      b.setAttribute('aria-pressed', String(feedback.has(value)));
    }),
  );
  root.querySelector('[data-save]')?.addEventListener('click', async () => {
    await api.feedback(id, [...feedback]);
    toast('Merci, votre avis est transmis à Givaudan');
  });
}

export async function orderTracking(root: HTMLElement, id: number) {
  const o = await api.order(id);
  const done = isFinal('order', o.status);
  const confirmed = o.status !== 'sent';
  root.innerHTML = `
    <header class="page-head">
      <a class="btn-icon" href="#/demandes?onglet=commandes" aria-label="Retour à mes commandes">${icon('back')}</a>
      <div><p class="eyebrow">Commande n° ${o.id} · ${esc(o.flavor_code)}</p><h1>${esc(o.flavor_name)}</h1></div>
      ${pill('order', o.status)}
    </header>
    <div class="tracking">
      <section class="card">${timeline('order', o.status, o.events)}${done ? '' : demoButton('Étape suivante')}</section>
      <aside class="tracking-side">
        <section class="card">
          <dl class="summary">
            <dt>Quantité</dt><dd>${esc(Number(o.quantity_kg))} kg</dd>
            <dt>Conditionnement</dt><dd>${esc(o.packaging)}</dd>
            <dt>Livraison</dt><dd>${esc(o.address)}</dd>
            ${o.internal_ref ? `<dt>Votre référence</dt><dd>${esc(o.internal_ref)}</dd>` : ''}
            <dt>Prix et date</dt><dd>${confirmed ? 'Confirmés par Givaudan, envoyés par e-mail' : 'En attente de confirmation par Givaudan'}</dd>
          </dl>
        </section>
        ${done ? `<a class="btn btn-primary btn-lg" href="#/commande/${encodeURIComponent(o.flavor_code)}">${icon('repeat', 18)}Commander à nouveau</a>` : ''}
      </aside>
    </div>`;
  root.querySelector('[data-advance]')?.addEventListener('click', async () => {
    const next = await api.advanceOrder(id);
    toast(`Nouvelle étape : ${statusLabel('order', next.status)}`);
    await orderTracking(root, id);
  });
}

function requestRow(r: RequestRow): string {
  const title =
    r.kind === 'sample'
      ? (r.flavor_name ?? 'Échantillon')
      : 'Demande à un expert';
  return `<a class="item" href="#/suivi/demande/${r.id}">
    <span class="item-icon">${icon(r.kind === 'sample' ? 'flask' : 'user')}</span>
    <span class="item-body"><strong>${esc(title)}</strong><small>n° ${r.id} · ${esc(date(r.created_at))}</small></span>
    ${pill(r.kind, r.status)}</a>`;
}

function orderRow(o: OrderRow): string {
  return `<div class="item">
    <a class="item-link" href="#/suivi/commande/${o.id}">
      <span class="item-icon">${icon('box')}</span>
      <span class="item-body"><strong>${esc(o.flavor_name)}</strong><small>n° ${o.id} · ${esc(Number(o.quantity_kg))} kg · ${esc(o.packaging)} · ${esc(date(o.created_at))}</small></span>
      ${pill('order', o.status)}
    </a>
    <a class="btn btn-small btn-ghost" href="#/commande/${encodeURIComponent(o.flavor_code)}" aria-label="Commander à nouveau ${esc(o.flavor_name)}">${icon('repeat', 16)}<span>Recommander</span></a>
  </div>`;
}

export async function history(root: HTMLElement, params: URLSearchParams) {
  const [requests, orders] = await Promise.all([api.requests(), api.orders()]);
  const tab = params.get('onglet') === 'commandes' ? 'orders' : 'requests';
  root.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Historique</p><h1>Mes demandes</h1></div>
      <a class="btn btn-primary" href="#/dictee">${icon('plus', 18)}Nouvelle demande</a></header>
    <div class="tabs" role="tablist">
      <a role="tab" href="#/demandes" aria-selected="${tab === 'requests'}">Échantillons et experts <span class="count">${requests.length}</span></a>
      <a role="tab" href="#/demandes?onglet=commandes" aria-selected="${tab === 'orders'}">Commandes <span class="count">${orders.length}</span></a>
    </div>
    <section class="items">
      ${
        tab === 'requests'
          ? requests.map(requestRow).join('') ||
            '<p class="empty">Aucune demande pour l’instant.</p>'
          : orders.map(orderRow).join('') ||
            '<p class="empty">Aucune commande pour l’instant. Commandez une référence après avoir validé son échantillon.</p>'
      }
    </section>`;
  root.querySelector('.page-head .btn')?.addEventListener('click', (event) => {
    event.preventDefault();
    clearDraft();
    go('#/dictee');
  });
}
