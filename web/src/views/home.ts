// Écran 1 · Accueil : démarrer une demande, voir ce qui est en cours, recommander
import { api, type OrderRow, type RequestRow } from '../api';
import { clearDraft, date, esc, go, icon, isFinal, pill } from '../ui';
import { voiceSupported } from '../voice';

function requestCard(r: RequestRow): string {
  const title =
    r.kind === 'sample'
      ? (r.flavor_name ?? 'Échantillon')
      : 'Demande à un expert';
  return `<a class="item" href="#/suivi/demande/${r.id}">
    <span class="item-icon">${icon(r.kind === 'sample' ? 'flask' : 'user')}</span>
    <span class="item-body"><strong>${esc(title)}</strong>
    <small>${r.kind === 'sample' ? `Échantillon · ${esc(r.flavor_code)}` : 'Relais expert'} · ${esc(date(r.created_at))}</small></span>
    ${pill(r.kind, r.status)}
  </a>`;
}

function orderCard(o: OrderRow): string {
  return `<a class="item" href="#/suivi/commande/${o.id}">
    <span class="item-icon">${icon('box')}</span>
    <span class="item-body"><strong>${esc(o.flavor_name)}</strong>
    <small>Commande · ${esc(Number(o.quantity_kg))} kg · ${esc(date(o.created_at))}</small></span>
    ${pill('order', o.status)}
  </a>`;
}

export async function home(root: HTMLElement) {
  const [client, requests, orders] = await Promise.all([
    api.client(),
    api.requests(),
    api.orders(),
  ]);
  const running = [
    ...requests
      .filter((r) => !isFinal(r.kind, r.status))
      .map((r) => ({ at: r.created_at, html: requestCard(r) })),
    ...orders
      .filter((o) => !isFinal('order', o.status))
      .map((o) => ({ at: o.created_at, html: orderCard(o) })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);

  // Références déjà validées : échantillon reçu ou commande livrée
  const known = new Map<string, string>();
  for (const o of orders)
    if (o.status === 'delivered') known.set(o.flavor_code, o.flavor_name);
  for (const r of requests)
    if (r.kind === 'sample' && r.status === 'received' && r.flavor_code)
      known.set(r.flavor_code, r.flavor_name ?? r.flavor_code);
  const reorder = [...known].slice(0, 3);

  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">Bonjour ${esc(client.name)} · ${esc(client.company)}</p>
      <h1>Quel arôme recherchez-vous&nbsp;?</h1>
      <p class="lead">Décrivez votre besoin avec vos mots. L’assistant vous propose des références du catalogue Givaudan, et un expert prend le relais si besoin.</p>
      <div class="hero-actions">
        ${voiceSupported() ? `<a class="btn btn-primary btn-lg" href="#/dictee?voix=1">${icon('mic')}Dicter ma demande</a>` : ''}
        <a class="btn ${voiceSupported() ? 'btn-secondary' : 'btn-primary'} btn-lg" href="#/dictee">${icon('edit')}Écrire ma demande</a>
      </div>
      <p class="trust">${icon('shield', 18)}Prix et délais toujours confirmés par Givaudan. L’assistant ne les invente jamais.</p>
    </section>

    <div class="home-grid">
      <section class="panel">
        <div class="panel-head"><h2>En cours</h2><a class="link" href="#/demandes">Tout voir ${icon('arrow', 16)}</a></div>
        ${running.length ? `<div class="items">${running.map((r) => r.html).join('')}</div>` : '<p class="empty">Aucune demande en cours. Lancez votre première demande ci-dessus.</p>'}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Commander à nouveau</h2></div>
        ${
          reorder.length
            ? `<div class="items">${reorder
                .map(
                  ([
                    code,
                    name,
                  ]) => `<a class="item" href="#/commande/${encodeURIComponent(code)}">
                <span class="item-icon">${icon('repeat')}</span>
                <span class="item-body"><strong>${esc(name)}</strong><small>${esc(code)}</small></span>
                <span class="btn btn-small btn-secondary">Commander</span></a>`,
                )
                .join('')}</div>`
            : '<p class="empty">Les références que vous avez validées apparaîtront ici pour les commander en un geste.</p>'
        }
      </section>
    </div>`;

  // Partir d'une demande vierge
  root.querySelectorAll<HTMLAnchorElement>('.hero-actions a').forEach((a) =>
    a.addEventListener('click', (event) => {
      event.preventDefault();
      clearDraft();
      go(a.getAttribute('href') ?? '#/dictee');
    }),
  );
}
