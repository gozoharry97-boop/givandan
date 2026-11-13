// Écrans 5 à 7 : récap d'échantillon, relais expert, commande
import { api } from '../api';
import { shipSample } from '../lab';
import {
  bindQuit,
  cap,
  clearDraft,
  criteriaChips,
  draft,
  errorBox,
  esc,
  flowHeader,
  go,
  icon,
  toast,
} from '../ui';

// Désactive le bouton pendant l'envoi ; renvoie de quoi le rétablir en cas d'erreur
function busy(button: HTMLButtonElement, label: string): () => void {
  const html = button.innerHTML;
  button.disabled = true;
  button.textContent = label;
  return () => {
    button.disabled = false;
    button.innerHTML = html;
  };
}

// ---------- Écran 5 · Récap de la demande d'échantillon (pré-rempli, modifiable)
export async function sample(root: HTMLElement, code: string) {
  const [flavor, client] = await Promise.all([api.flavor(code), api.client()]);
  const current = draft();
  const need = current.text || `Échantillon de ${flavor.name}`;
  root.innerHTML = `
    ${flowHeader(3, current.text ? '#/propositions' : '#/')}
    <section class="flow narrow">
      <p class="eyebrow">Récapitulatif</p>
      <h1>Votre demande d’échantillon</h1>
      <p class="lead">Tout est pré-rempli à partir de votre demande. Vérifiez, modifiez si besoin, puis envoyez.</p>
      <form class="card form" novalidate>
        <div class="recap-ref">
          <span class="item-icon">${icon('flask')}</span>
          <div><strong>${esc(flavor.name)}</strong><small>${esc(flavor.code)} · ${esc(cap(flavor.family))}</small></div>
          ${current.text ? '<a class="link" href="#/propositions">Changer</a>' : ''}
        </div>
        <label>Votre besoin<textarea name="need" rows="3" required>${esc(need)}</textarea></label>
        ${current.analysis ? `<div><p class="label">Critères retenus</p>${criteriaChips(current.analysis.criteria)}</div>` : ''}
        <div><p class="label">Quantité</p><p>Échantillon standard de laboratoire, défini par Givaudan.</p></div>
        <label>Adresse de livraison<textarea name="address" rows="2" required>${esc(client.address)}</textarea></label>
        <p class="field-help">Envoyé au nom de ${esc(client.name)}, ${esc(client.company)} · ${esc(client.email)}</p>
        <div data-error></div>
        <button class="btn btn-primary btn-lg" type="submit">Envoyer la demande ${icon('arrow')}</button>
      </form>
    </section>`;
  bindQuit(root);

  const form = root.querySelector('form')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const address = String(data.get('address')).trim();
    const text = String(data.get('need')).trim();
    const error = root.querySelector('[data-error]')!;
    if (!address || !text) {
      error.innerHTML =
        '<p class="field-error">Le besoin et l’adresse sont nécessaires.</p>';
      return;
    }
    const restore = busy(form.querySelector('button')!, 'Envoi…');
    try {
      const created = await api.createRequest({
        kind: 'sample',
        need: text,
        flavorId: flavor.id,
        criteria: current.analysis?.criteria,
        address,
      });
      clearDraft();
      await shipSample(flavor);
      toast('Demande d’échantillon envoyée à Givaudan');
      go(`#/suivi/demande/${created.id}`);
    } catch (e) {
      error.innerHTML = errorBox(e);
      restore();
    }
  });
}

// ---------- Écran 6 · Relais expert : le résumé que l'expert recevra
export async function expert(root: HTMLElement) {
  const current = draft();
  if (!current.text) {
    go('#/dictee');
    return;
  }
  const search =
    current.search ??
    (await api.search(current.text, current.analysis?.criteria));
  const { summary } = search;
  root.innerHTML = `
    ${flowHeader(3, '#/propositions')}
    <section class="flow narrow">
      <p class="eyebrow">Relais expert</p>
      <h1>Un expert Givaudan prend le relais</h1>
      <p class="lead">Voici ce qu’il recevra. Vous n’aurez rien à répéter.</p>
      <form class="card form" novalidate>
        <dl class="summary">
          <dt>Votre besoin</dt><dd>« ${esc(summary.need)} »</dd>
          <dt>Type de produit</dt><dd>${esc(cap(summary.product))}</dd>
          <dt>Contraintes</dt><dd>${esc(summary.constraints)}</dd>
        </dl>
        <label>Précisions pour l’expert <span class="optional">(facultatif)</span>
          <textarea name="details" rows="3" placeholder="Volumes envisagés, date de lancement, dosage visé…"></textarea>
        </label>
        <div data-error></div>
        <button class="btn btn-primary btn-lg" type="submit">Envoyer à un expert ${icon('arrow')}</button>
      </form>
    </section>`;
  bindQuit(root);

  const form = root.querySelector('form')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const details = String(new FormData(form).get('details') ?? '').trim();
    const restore = busy(form.querySelector('button')!, 'Envoi…');
    try {
      const created = await api.createRequest({
        kind: 'expert',
        need: details
          ? `${current.text}\n\nPrécisions : ${details}`
          : current.text,
        criteria: search.criteria,
      });
      clearDraft();
      toast('Votre demande est transmise à un expert');
      go(`#/suivi/demande/${created.id}`);
    } catch (e) {
      root.querySelector('[data-error]')!.innerHTML = errorBox(e);
      restore();
    }
  });
}

// ---------- Écran 7 · Commande d'une référence validée
export async function order(
  root: HTMLElement,
  code: string,
  params: URLSearchParams,
) {
  const [flavor, client] = await Promise.all([api.flavor(code), api.client()]);
  const requestId = Number(params.get('demande')) || undefined;
  root.innerHTML = `
    <header class="page-head">
      <a class="btn-icon" href="${requestId ? `#/suivi/demande/${requestId}` : '#/'}" aria-label="Retour">${icon('back')}</a>
      <div><p class="eyebrow">Commande</p><h1>${esc(flavor.name)}</h1></div>
    </header>
    <section class="flow narrow">
      <form class="card form" novalidate>
        <div class="recap-ref">
          <span class="item-icon">${icon('box')}</span>
          <div><strong>${esc(flavor.name)}</strong><small>${esc(flavor.code)}${requestId ? ' · échantillon validé' : ''}</small></div>
        </div>
        <div class="row">
          <label>Quantité (kg)<input name="quantity" type="number" inputmode="decimal" min="1" step="1" value="25" required /></label>
          <label>Conditionnement
            <select name="packaging" required>${flavor.packagings.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
          </label>
        </div>
        <label>Adresse de livraison<textarea name="address" rows="2" required>${esc(client.address)}</textarea></label>
        <label>Votre référence interne <span class="optional">(facultatif)</span><input name="ref" placeholder="Ex. : BC-2026-114" /></label>
        <div class="notice">${icon('shield')}<div><strong>Prix et date de livraison confirmés par Givaudan.</strong><br>Ils ne sont jamais calculés par l’assistant. Vous les recevez dans le suivi de commande.</div></div>
        <div data-error></div>
        <button class="btn btn-primary btn-lg" type="submit">Envoyer la commande ${icon('arrow')}</button>
      </form>
    </section>`;

  const form = root.querySelector('form')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const quantityKg = Number(data.get('quantity'));
    const address = String(data.get('address')).trim();
    const error = root.querySelector('[data-error]')!;
    if (!(quantityKg > 0) || !address) {
      error.innerHTML =
        '<p class="field-error">Indiquez une quantité supérieure à 0 et une adresse.</p>';
      return;
    }
    const restore = busy(form.querySelector('button')!, 'Envoi…');
    try {
      const created = await api.createOrder({
        flavorId: flavor.id,
        requestId,
        quantityKg,
        packaging: String(data.get('packaging')),
        address,
        internalRef: String(data.get('ref') ?? '').trim() || undefined,
      });
      toast('Commande envoyée à Givaudan');
      go(`#/suivi/commande/${created.id}`);
    } catch (e) {
      error.innerHTML = errorBox(e);
      restore();
    }
  });
}
