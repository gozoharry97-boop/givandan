// Écrans 2 à 4 : dicter le besoin, l'affiner en quelques questions, voir les propositions
import { api, type Analysis, type Proposal } from '../api';
import {
  bindQuit,
  cap,
  criteriaChips,
  draft,
  errorBox,
  esc,
  flowHeader,
  glossary,
  go,
  icon,
  setDraft,
} from '../ui';
import { familyColor, reducedMotion, runLab, tubeSvg } from '../lab';
import { dictate, voiceSupported, type Dictation } from '../voice';

const EXAMPLES = [
  'Un arôme fruits rouges naturel pour ma boisson protéinée en poudre',
  'Une vanille pour un produit laitier prêt à boire',
  'Un goût agrumes pour une eau aromatisée',
];

// ---------- Écran 2 · Dictée
export function dictation(root: HTMLElement, params: URLSearchParams) {
  const current = draft();
  const voice = voiceSupported();
  root.innerHTML = `
    ${flowHeader(0, '#/')}
    <section class="flow">
      <h1>Décrivez votre besoin</h1>
      <p class="lead">Parlez comme à un collègue : le goût, le type de produit, vos contraintes. Pas besoin de connaître les références.</p>
      <div class="dictation">
        <label class="sr-only" for="need">Votre besoin</label>
        <textarea id="need" rows="5" placeholder="Ex. : un arôme fruits rouges naturel pour ma boisson protéinée en poudre">${esc(current.text)}</textarea>
        ${
          voice
            ? `<button class="mic" type="button" data-mic aria-pressed="false">${icon('mic', 28)}<span>Appuyer pour parler</span></button>`
            : '<p class="muted">La dictée n’est pas disponible sur ce navigateur : écrivez votre demande.</p>'
        }
        <p class="listening" data-status aria-live="polite"></p>
      </div>
      <div class="examples">
        <p class="muted">Exemples</p>
        ${EXAMPLES.map((e) => `<button class="chip chip-button" type="button" data-example="${esc(e)}">${esc(e)}</button>`).join('')}
      </div>
      <div data-error></div>
      <div class="actions">
        <button class="btn btn-primary btn-lg" type="button" data-next>Continuer ${icon('arrow')}</button>
      </div>
    </section>`;
  bindQuit(root);

  const textarea = root.querySelector<HTMLTextAreaElement>('#need')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const mic = root.querySelector<HTMLButtonElement>('[data-mic]');
  let session: Dictation | null = null;
  let before = '';

  function setListening(on: boolean) {
    if (!mic) return;
    mic.classList.toggle('on', on);
    mic.setAttribute('aria-pressed', String(on));
    mic.innerHTML = on
      ? `${icon('stop', 28)}<span>Terminer la dictée</span>`
      : `${icon('mic', 28)}<span>Appuyer pour parler</span>`;
    status.textContent = on ? 'Je vous écoute…' : '';
  }

  function start() {
    before = textarea.value.trim();
    session = dictate({
      onText: (text, interim) => {
        textarea.value = [before, text + interim]
          .filter(Boolean)
          .join(' ')
          .trim();
      },
      onEnd: () => {
        session = null;
        setListening(false);
      },
      onError: (message) => {
        status.textContent = message;
      },
    });
    setListening(Boolean(session));
  }

  mic?.addEventListener('click', () => (session ? session.stop() : start()));
  if (voice && params.get('voix') === '1') start();

  root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((b) =>
    b.addEventListener('click', () => {
      textarea.value = b.dataset.example ?? '';
      textarea.focus();
    }),
  );

  root
    .querySelector('[data-next]')!
    .addEventListener('click', async (event) => {
      session?.stop();
      const text = textarea.value.trim();
      const error = root.querySelector<HTMLElement>('[data-error]')!;
      if (text.length < 3) {
        error.innerHTML =
          '<p class="field-error">Décrivez votre besoin en quelques mots pour continuer.</p>';
        textarea.focus();
        return;
      }
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      button.innerHTML = 'Analyse en cours…';
      try {
        // Nouvelle lecture : on repart des seuls mots du client
        const analysis = await api.analyze({ text });
        setDraft({ text, analysis });
        go(analysis.question ? '#/affiner' : '#/propositions');
      } catch (e) {
        error.innerHTML = errorBox(e);
        button.disabled = false;
        button.innerHTML = `Continuer ${icon('arrow')}`;
      }
    });
}

// ---------- Jauge de précision
function gauge(value: number): string {
  const r = 44;
  const c = 2 * Math.PI * r;
  const label =
    value >= 100
      ? 'Demande précise'
      : value >= 60
        ? 'Presque prête'
        : 'À préciser';
  return `<div class="gauge" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-label="Précision de la demande">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="${r}" class="gauge-track"/>
      <circle cx="50" cy="50" r="${r}" class="gauge-fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - value / 100)}"/>
    </svg>
    <div class="gauge-value"><strong>${value}<small>%</small></strong><span>${label}</span></div>
  </div>`;
}

// ---------- Écran 3 · Affiner
export function refine(root: HTMLElement) {
  const current = draft();
  if (!current.analysis) {
    go('#/dictee');
    return;
  }
  render(current.analysis);

  function render(analysis: Analysis) {
    const { question, progress } = analysis;
    root.innerHTML = `
      ${flowHeader(1, '#/dictee')}
      <section class="flow split">
        <aside class="split-side">
          <div class="card">
            <p class="eyebrow">Votre demande</p>
            <blockquote>« ${esc(current.text)} »</blockquote>
            <a class="link" href="#/dictee">${icon('edit', 16)}Modifier ma demande</a>
          </div>
          <div class="card gauge-card">
            ${gauge(analysis.precision)}
            <div><p class="eyebrow">Ce que j’ai compris</p>${criteriaChips(analysis.criteria)}</div>
          </div>
        </aside>
        <div class="split-main">
          ${
            question
              ? `<p class="eyebrow">${progress.remaining > 1 ? `Encore ${progress.remaining} questions` : 'Dernière question'}</p>
                 <h1>${esc(question.label)}</h1>
                 <p class="lead">${esc(question.hint)}</p>
                 <div class="options" role="list">
                   ${question.options
                     .map(
                       (
                         o,
                       ) => `<button class="option" type="button" role="listitem" data-value="${esc(o.value)}">
                       <strong>${esc(o.label)}</strong>${o.detail ? `<small>${esc(o.detail)}</small>` : ''}
                     </button>`,
                     )
                     .join('')}
                 </div>
                 <div data-error></div>
                 <div class="actions actions-between">
                   <button class="btn btn-ghost" type="button" data-skip>Ignorer cette question</button>
                   ${analysis.criteria.family ? `<a class="btn btn-secondary" href="#/propositions">Voir les propositions</a>` : ''}
                 </div>`
              : `<p class="eyebrow">Toutes les questions sont posées</p>
                 <h1>Votre demande est prête</h1>
                 <p class="lead">J’ai ce qu’il faut pour chercher dans le catalogue.</p>
                 <div class="actions"><a class="btn btn-primary btn-lg" href="#/propositions">Voir les propositions ${icon('arrow')}</a></div>`
          }
        </div>
      </section>`;
    bindQuit(root);
    if (!question) return;

    const answer = async (value: string | null) => {
      root
        .querySelectorAll<HTMLButtonElement>('button.option, [data-skip]')
        .forEach((b) => (b.disabled = true));
      try {
        const next = await api.analyze({
          criteria: analysis.criteria,
          answer: { key: question.key, value },
        });
        setDraft({ ...draft(), analysis: next, search: undefined });
        if (next.question) render(next);
        else go('#/propositions');
      } catch (e) {
        root.querySelector('[data-error]')!.innerHTML = errorBox(e);
      }
    };
    root.querySelectorAll<HTMLButtonElement>('button.option').forEach((b) =>
      b.addEventListener('click', () => {
        b.classList.add('picked');
        void answer(b.dataset.value ?? null);
      }),
    );
    root
      .querySelector('[data-skip]')!
      .addEventListener('click', () => void answer(null));
  }
}

// ---------- Écran 4 · Propositions
function proposalCard(p: Proposal, index: number): string {
  // index : rang dans le classement (0 = meilleure)
  const f = p.flavor;
  const terms = [
    f.is_natural ? 'Arôme naturel' : '',
    f.formats.includes('poudre') ? 'Poudre à mélanger' : '',
    f.formats.includes('liquide') ? 'Prêt à boire' : '',
    'Conditionnement',
  ];
  return `<article class="proposal ${p.best ? 'best selected' : ''}" id="ref-${esc(f.code)}" data-code="${esc(f.code)}">
    <header>
      ${p.best ? `<span class="tag tag-best">${icon('sparkle', 16)}Meilleure correspondance</span>` : `<span class="tag">Option ${index + 1}</span>`}
      <h2>${esc(f.name)}</h2>
      <p class="code">${esc(f.code)} · ${esc(cap(f.family))}</p>
    </header>
    <p>${esc(f.description)}</p>
    <div>
      <p class="eyebrow">Pourquoi cette référence</p>
      <ul class="reasons">${p.reasons.map((r) => `<li>${icon('check', 16)}${esc(r)}</li>`).join('')}</ul>
    </div>
    <details class="sheet">
      <summary>Voir la fiche</summary>
      <dl>
        <dt>Notes</dt><dd>${esc(f.notes.join(', '))}</dd>
        <dt>Formats</dt><dd>${esc(f.formats.map((x) => (x === 'poudre' ? 'Poudre' : 'Liquide')).join(', '))}</dd>
        <dt>Usages</dt><dd>${esc(f.applications.join(', '))}</dd>
        <dt>Conditionnements</dt><dd>${esc(f.packagings.join(', '))}</dd>
      </dl>
      <div class="terms"><p class="eyebrow">Comprendre les termes</p>${glossary(terms)}</div>
    </details>
    <p class="source">${icon('source', 16)}Source : ${esc(f.source)}, fiche ${esc(f.code)}</p>
    <p class="price">${icon('shield', 16)}Prix et délai confirmés par Givaudan</p>
    <a class="btn ${p.best ? 'btn-primary' : 'btn-secondary'}" href="#/echantillon/${encodeURIComponent(f.code)}">${icon('flask', 18)}Demander un échantillon</a>
  </article>`;
}

export async function proposals(root: HTMLElement) {
  const current = draft();
  if (!current.text) {
    go('#/dictee');
    return;
  }
  bindQuit(root);
  // L'animation du labo ne se joue qu'à la première recherche, pas en revenant en arrière
  const search =
    current.search ??
    (await runLab(
      root,
      current.analysis?.criteria ?? { notes: [], custom: false, skipped: [] },
      api.search(current.text, current.analysis?.criteria),
    ));
  setDraft({ ...current, search });

  if (search.expert) {
    root.innerHTML = `
      ${flowHeader(2, '#/dictee')}
      <section class="flow narrow">
        <span class="badge-icon">${icon('user', 28)}</span>
        <h1>Cette demande mérite un expert</h1>
        <p class="lead">${
          search.criteria.custom
            ? 'Vous décrivez une création sur mesure. Plutôt que de deviner, je transmets votre besoin à un expert Givaudan.'
            : 'Aucune référence du catalogue ne correspond assez à votre besoin. Plutôt que de proposer au hasard, je le transmets à un expert Givaudan.'
        }</p>
        <div class="card">${criteriaChips(search.criteria)}</div>
        <div class="actions">
          <a class="btn btn-ghost" href="#/dictee">${icon('edit', 18)}Modifier ma demande</a>
          <a class="btn btn-primary btn-lg" href="#/expert">Transmettre à un expert ${icon('arrow')}</a>
        </div>
      </section>`;
    bindQuit(root);
    return;
  }

  const count = search.references.length;
  // Sur le portoir, la meilleure référence au centre
  const ranked = search.references.map((p, rank) => ({ p, rank }));
  const order = count === 3 ? [ranked[1], ranked[0], ranked[2]] : ranked;
  root.innerHTML = `
    ${flowHeader(2, '#/affiner')}
    <section class="flow wide">
      <div class="flow-title">
        <div>
          <p class="eyebrow">${count} référence${count > 1 ? 's' : ''} du catalogue</p>
          <h1>Voici ce que je vous propose</h1>
          <p class="lead">Chaque raison vient de la fiche catalogue. Rien n’est inventé.</p>
        </div>
        <div class="card compact">${criteriaChips(search.criteria)}<a class="link" href="#/dictee">${icon('edit', 16)}Modifier ma demande</a></div>
      </div>
      <div class="rack-band cols-${count}">
        ${order
          .map(
            (
              { p, rank },
              i,
            ) => `<button type="button" class="tube-btn ${p.best ? 'best' : ''}" data-code="${esc(p.flavor.code)}" aria-controls="ref-${esc(p.flavor.code)}" aria-pressed="${p.best}" style="--i:${i}">
              ${tubeSvg({ color: familyColor(p.flavor.family), code: p.flavor.code, level: 0.8 - rank * 0.1, best: p.best })}
              <span class="tube-name">${esc(p.flavor.name)}</span>
              ${p.best ? `<span class="tube-best">${icon('sparkle', 14)}Meilleure correspondance</span>` : `<span class="tube-rank">Option ${rank + 1}</span>`}
            </button>`,
          )
          .join('')}
      </div>
      <div class="proposals cols-${count}">${order.map(({ p, rank }) => proposalCard(p, rank)).join('')}</div>
      <aside class="expert-link">
        ${icon('forward')}
        <div><strong>Aucune ne convient&nbsp;?</strong><p>Un expert Givaudan reprend votre demande, sans que vous ayez à la répéter.</p></div>
        <a class="btn btn-secondary" href="#/expert">Parler à un expert</a>
      </aside>
    </section>`;
  bindQuit(root);
  bindRack(root);
}

// Portoir : les tubes arrivent en se secouant, un tube touché se secoue et montre sa fiche
function bindRack(root: HTMLElement) {
  const tubes = [...root.querySelectorAll<HTMLButtonElement>('.tube-btn')];
  const shake = (b: HTMLElement) => {
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
  };
  tubes.forEach((b, i) => {
    setTimeout(() => shake(b), 450 + i * 180);
    b.addEventListener('mouseenter', () => shake(b));
    b.addEventListener('click', () => {
      shake(b);
      tubes.forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
      root
        .querySelectorAll<HTMLElement>('.proposal')
        .forEach((card) =>
          card.classList.toggle(
            'selected',
            card.dataset.code === b.dataset.code,
          ),
        );
      // Sur mobile, une seule fiche est visible : on l'amène à l'écran
      if (window.matchMedia('(max-width: 767px)').matches)
        root.querySelector('.proposal.selected')?.scrollIntoView({
          behavior: reducedMotion() ? 'auto' : 'smooth',
          block: 'nearest',
        });
    });
  });
}
