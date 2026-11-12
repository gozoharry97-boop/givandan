// Logique de l'assistant : comprendre la demande, poser la bonne question,
// proposer des références du catalogue. Règle d'or : rien n'est inventé.
// Les raisons affichées viennent toutes de la fiche catalogue.

export type Format = 'poudre' | 'liquide';

export type Criteria = {
  family?: string;
  format?: Format;
  // true : naturel exigé ; false : peu importe ; absent : pas encore demandé
  natural?: boolean;
  application?: string;
  notes: string[];
  // Demande sur mesure (création) : relais vers un expert
  custom: boolean;
  // Questions que le client a choisi d'ignorer
  skipped: QuestionKey[];
};

export type QuestionKey = 'family' | 'format' | 'natural' | 'application';

export type Question = {
  key: QuestionKey;
  label: string;
  hint: string;
  options: { value: string; label: string; detail?: string }[];
};

export type Flavor = {
  id: number;
  code: string;
  name: string;
  family: string;
  notes: string[];
  is_natural: boolean;
  formats: string[];
  applications: string[];
  strengths: string[];
  packagings: string[];
  description: string;
  source: string;
};

export type Proposal = {
  flavor: Flavor;
  score: number;
  reasons: string[];
  best: boolean;
};

export const FAMILIES: Record<string, string[]> = {
  'fruits rouges': [
    'fruits rouges',
    'fruit rouge',
    'fraise',
    'framboise',
    'cerise',
    'cassis',
    'groseille',
    'myrtille',
    'mure',
  ],
  agrumes: [
    'agrume',
    'citron',
    'orange',
    'pamplemousse',
    'yuzu',
    'mandarine',
    'lime',
  ],
  vanille: ['vanille'],
  chocolat: ['chocolat', 'cacao'],
  café: ['cafe', 'espresso', 'moka'],
  'fruits tropicaux': [
    'tropical',
    'exotique',
    'mangue',
    'passion',
    'ananas',
    'coco',
  ],
  'fruits à noyau': ['peche', 'abricot', 'prune'],
  menthe: ['menthe'],
  caramel: ['caramel'],
  pomme: ['pomme'],
  herbes: ['basilic', 'herbe', 'botanique'],
};

export const APPLICATIONS: Record<string, string[]> = {
  'boisson protéinée': ['proteine', 'proteinee', 'whey', 'sportif', 'shake'],
  'eau aromatisée': ['eau aromatisee', 'eau'],
  soda: ['soda', 'petillant', 'gazeuse'],
  'boisson énergisante': ['energisante', 'energy', 'energie'],
  'produit laitier': ['yaourt', 'lait', 'laitier', 'dessert lacte'],
  barre: ['barre', 'snack'],
  confiserie: ['bonbon', 'confiserie', 'chewing'],
  boulangerie: ['biscuit', 'gateau', 'boulangerie', 'patisserie'],
};

const FORMAT_WORDS: Record<Format, string[]> = {
  poudre: [
    'poudre',
    'sachet',
    'shaker',
    'stick',
    'a melanger',
    'a reconstituer',
  ],
  liquide: ['pret a boire', 'bouteille', 'canette', 'liquide', 'brique', 'rtd'],
};

const CUSTOM_WORDS = [
  'sur mesure',
  'creation',
  'exclusif',
  'unique',
  'inedit',
  'personnalise',
];

const WEIGHTS: Record<QuestionKey, number> = {
  family: 40,
  format: 25,
  natural: 15,
  application: 20,
};

// Minuscules, sans accents : « Protéinée » et « proteinee » se valent
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function has(text: string, words: string[]): boolean {
  // Mot entier, pluriel et féminin acceptés : « lime » ne doit pas trouver « limitée »
  return words.some((w) => new RegExp(`\\b${w}(s|e|es|x)?\\b`).test(text));
}

export function emptyCriteria(): Criteria {
  return { notes: [], custom: false, skipped: [] };
}

// Lecture déterministe du texte : fonctionne même sans IA
export function extractCriteria(text: string): Partial<Criteria> {
  const t = normalize(text);
  const found: Partial<Criteria> = {};
  const families = Object.entries(FAMILIES).filter(([, words]) =>
    has(t, words),
  );
  if (families.length === 1) found.family = families[0][0];
  // Plusieurs familles citées (« cassis et basilic ») : c'est une création
  if (families.length > 1) found.custom = true;
  for (const [format, words] of Object.entries(FORMAT_WORDS)) {
    if (has(t, words)) found.format = format as Format;
  }
  if (/\bnaturel/.test(t) || t.includes('clean label')) found.natural = true;
  for (const [application, words] of Object.entries(APPLICATIONS)) {
    if (has(t, words)) {
      found.application = application;
      break;
    }
  }
  if (has(t, CUSTOM_WORDS)) found.custom = true;
  found.notes = families.flatMap(([, words]) =>
    words.filter((w) => has(t, [w])),
  );
  return found;
}

// Fusionne sans écraser ce que le client a déjà précisé
export function mergeCriteria(
  base: Criteria,
  extra: Partial<Criteria>,
): Criteria {
  return {
    family: base.family ?? extra.family,
    format: base.format ?? extra.format,
    natural: base.natural ?? extra.natural,
    application: base.application ?? extra.application,
    notes: [...new Set([...base.notes, ...(extra.notes ?? [])])],
    custom: base.custom || Boolean(extra.custom),
    skipped: base.skipped,
  };
}

// Applique la réponse du client à une question (ou « ignorer »)
export function applyAnswer(
  criteria: Criteria,
  key: QuestionKey,
  value: string | null,
): Criteria {
  const next: Criteria = { ...criteria, skipped: [...criteria.skipped] };
  if (value === null) {
    if (!next.skipped.includes(key)) next.skipped.push(key);
    return next;
  }
  if (key === 'family' && value in FAMILIES) next.family = value;
  if (key === 'format' && (value === 'poudre' || value === 'liquide'))
    next.format = value;
  if (key === 'natural') next.natural = value === 'oui';
  if (key === 'application' && value in APPLICATIONS) next.application = value;
  return next;
}

function answered(criteria: Criteria, key: QuestionKey): boolean {
  return criteria[key] !== undefined || criteria.skipped.includes(key);
}

export function precision(criteria: Criteria): number {
  return (Object.keys(WEIGHTS) as QuestionKey[]).reduce(
    (sum, key) => sum + (answered(criteria, key) ? WEIGHTS[key] : 0),
    0,
  );
}

const QUESTIONS: Record<QuestionKey, Question> = {
  family: {
    key: 'family',
    label: 'Quel goût recherchez-vous ?',
    hint: 'Choisissez la famille la plus proche, vous pourrez préciser ensuite.',
    options: [
      'fruits rouges',
      'agrumes',
      'vanille',
      'chocolat',
      'fruits tropicaux',
      'café',
    ].map((f) => ({ value: f, label: f[0].toUpperCase() + f.slice(1) })),
  },
  format: {
    key: 'format',
    label: 'Votre produit est-il en poudre à mélanger ou prêt à boire ?',
    hint: 'Le type d’arôme recommandé n’est pas le même.',
    options: [
      {
        value: 'poudre',
        label: 'Poudre à mélanger',
        detail: 'Shaker, sachet, stick',
      },
      { value: 'liquide', label: 'Prêt à boire', detail: 'Bouteille, canette' },
    ],
  },
  natural: {
    key: 'natural',
    label: 'Souhaitez-vous un arôme naturel ?',
    hint: 'Utile si votre étiquette met en avant le naturel.',
    options: [
      {
        value: 'oui',
        label: 'Oui, naturel exigé',
        detail: 'Pour une étiquette « naturel »',
      },
      {
        value: 'non',
        label: 'Peu importe',
        detail: 'Plus de choix dans le catalogue',
      },
    ],
  },
  application: {
    key: 'application',
    label: 'Pour quel type de produit ?',
    hint: 'Certains arômes sont conçus pour un usage précis.',
    options: Object.keys(APPLICATIONS).map((a) => ({
      value: a,
      label: a[0].toUpperCase() + a.slice(1),
    })),
  },
};

export function nextQuestion(criteria: Criteria): Question | null {
  if (criteria.custom) return null;
  const order: QuestionKey[] = ['family', 'format', 'natural', 'application'];
  const key = order.find((k) => !answered(criteria, k));
  return key ? QUESTIONS[key] : null;
}

// Nombre de questions qui restent, pour afficher « Encore N questions »
export function questionCount(criteria: Criteria): {
  remaining: number;
  total: number;
} {
  const total = 4;
  if (criteria.custom) return { remaining: 0, total };
  const done = (Object.keys(WEIGHTS) as QuestionKey[]).filter((k) =>
    answered(criteria, k),
  ).length;
  return { remaining: total - done, total };
}

// Classement : uniquement des références du catalogue, avec des raisons tirées de la fiche
export function rank(flavors: Flavor[], criteria: Criteria): Proposal[] {
  const proposals: Proposal[] = [];
  for (const flavor of flavors) {
    if (criteria.family && flavor.family !== criteria.family) continue;
    if (criteria.natural === true && !flavor.is_natural) continue;
    let score = criteria.family ? 50 : 0;
    const reasons: string[] = [];
    if (criteria.family) reasons.push(`Profil ${flavor.family}`);
    if (criteria.format) {
      if (flavor.formats.includes(criteria.format)) {
        score += 20;
        reasons.push(
          criteria.format === 'poudre'
            ? 'Adapté aux produits en poudre'
            : 'Adapté aux produits prêts à boire',
        );
      } else {
        score -= 30;
      }
    }
    if (flavor.is_natural) {
      if (criteria.natural === true) score += 15;
      reasons.push('Arôme naturel');
    }
    if (
      criteria.application &&
      flavor.applications.includes(criteria.application)
    ) {
      score += 15;
      reasons.push(`Conçu pour : ${criteria.application}`);
    }
    const matched = flavor.notes.filter((n) =>
      criteria.notes.includes(normalize(n)),
    );
    score += matched.length * 5;
    if (matched.length) reasons.push(`Note ${matched.join(', ')}`);
    reasons.push(...flavor.strengths.slice(0, 1));
    if (score >= 50) proposals.push({ flavor, score, reasons, best: false });
  }
  proposals.sort((a, b) => b.score - a.score);
  const top = proposals.slice(0, 3);
  if (top[0]) top[0].best = true;
  return top;
}

// Ce que l'expert recevra : uniquement ce que le client a dit
export function expertSummary(text: string, criteria: Criteria) {
  return {
    need: text,
    product: criteria.application ?? 'Non précisé',
    constraints:
      [
        criteria.format &&
          (criteria.format === 'poudre' ? 'Poudre' : 'Prêt à boire'),
        criteria.natural === true && 'Naturel',
      ]
        .filter(Boolean)
        .join(' · ') || 'Non précisées',
  };
}

export const STATUSES = {
  sample: ['requested', 'prepared', 'shipped', 'received'],
  expert: ['sent', 'in_progress', 'answered'],
  order: ['sent', 'confirmed', 'shipped', 'delivered'],
} as const;
