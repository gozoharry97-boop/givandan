import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import {
  APPLICATIONS,
  FAMILIES,
  STATUSES,
  applyAnswer,
  emptyCriteria,
  expertSummary,
  extractCriteria,
  mergeCriteria,
  nextQuestion,
  precision,
  questionCount,
  rank,
  type Criteria,
  type Flavor,
  type QuestionKey,
} from './assistant.js';

// En dev, la configuration vient de api/.env ; en production, de l'hébergeur
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on garde l'environnement tel quel
}

const { DATABASE_URL, AI_BASE_URL, AI_MODEL, AI_API_KEY = '' } = process.env;
// L'API de l'équipe Data/IA : si elle est configurée, elle remplace le fournisseur
const { DATA_AI_URL, DATA_AI_KEY = '' } = process.env;
const PORT = Number(process.env.PORT ?? 3000);

const db = new pg.Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json());

// ---------- Base de données
// Les scripts de db/init sont rejoués au démarrage (ils sont idempotents) :
// une base créée avant cette version reçoit les nouvelles tables sans tout effacer.
async function ensureSchema() {
  const dir = new URL('../../db/init/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.query(await readFile(new URL(file, dir), 'utf8'));
  }
}

const CLIENT_ID = 1; // Démo : un seul client connecté, Julien

async function flavors(): Promise<Flavor[]> {
  const { rows } = await db.query('SELECT * FROM flavors ORDER BY id');
  return rows;
}

async function logStatus(
  subject: 'request' | 'order',
  id: number,
  status: string,
) {
  await db.query(
    'INSERT INTO status_events (subject, subject_id, status) VALUES ($1, $2, $3)',
    [subject, id, status],
  );
}

function toCriteria(raw: unknown): Criteria {
  const c = (raw ?? {}) as Partial<Criteria>;
  return {
    ...emptyCriteria(),
    ...c,
    notes: Array.isArray(c.notes) ? c.notes.map(String) : [],
    skipped: Array.isArray(c.skipped) ? (c.skipped as QuestionKey[]) : [],
    custom: Boolean(c.custom),
  };
}

// ---------- IA
// Même appel pour Ollama, Mistral, OpenAI… : seule la configuration change
async function ask(
  question: string,
  system?: string,
  timeoutMs = 60_000,
): Promise<string> {
  const messages = system
    ? [
        { role: 'system', content: system },
        { role: 'user', content: question },
      ]
    : [{ role: 'user', content: question }];
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({ model: AI_MODEL, messages, temperature: 0 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`IA : ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

// L'API de l'équipe Data/IA, derrière son tunnel ngrok. Le contrat : son Swagger (/docs)
async function askDataTeam(question: string): Promise<string> {
  const response = await fetch(`${DATA_AI_URL}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': DATA_AI_KEY },
    body: JSON.stringify({ question }),
    // Machine en veille, tunnel coupé : on abandonne au bout de 30 secondes
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`IA Data : ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return data.answer;
}

const EXTRACT_PROMPT = `Tu extrais les critères d'une demande d'arôme pour un acheteur B2B.
Réponds uniquement par un objet JSON, sans texte autour, avec ces clés (null si absent) :
"family" parmi ${JSON.stringify(Object.keys(FAMILIES))},
"format" parmi ["poudre","liquide"],
"natural" (true si un arôme naturel est demandé, sinon null),
"application" parmi ${JSON.stringify(Object.keys(APPLICATIONS))},
"custom" (true si la demande est une création sur mesure ou mélange plusieurs familles).
N'invente rien : si l'information n'est pas dans la demande, mets null.`;

// Le LLM complète la lecture déterministe ; on ne garde que des valeurs connues.
// Sans IA configurée ou en cas d'erreur, la lecture déterministe suffit.
async function extractWithAI(text: string): Promise<Partial<Criteria>> {
  if (!AI_BASE_URL) return {};
  try {
    const raw = await ask(text, EXTRACT_PROMPT, 8_000);
    const json = JSON.parse(
      raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1),
    );
    const out: Partial<Criteria> = {};
    if (json.family in FAMILIES) out.family = json.family;
    if (json.format === 'poudre' || json.format === 'liquide')
      out.format = json.format;
    if (json.natural === true) out.natural = true;
    if (json.application in APPLICATIONS) out.application = json.application;
    if (json.custom === true) out.custom = true;
    return out;
  } catch (error) {
    console.warn(
      'Extraction IA indisponible, lecture déterministe seule :',
      error,
    );
    return {};
  }
}

// ---------- Routes
app.get('/api/health', async (_req, res) => {
  const { rows } = await db.query('SELECT version()');
  res.json({ status: 'ok', db: rows[0].version, ai: Boolean(AI_BASE_URL) });
});

app.get('/api/client', async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM clients WHERE id = $1', [
    CLIENT_ID,
  ]);
  res.json(rows[0]);
});

// Comprend la demande et renvoie la prochaine question (ou aucune)
app.post('/api/assistant/analyze', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  let criteria = toCriteria(req.body?.criteria);
  if (text) {
    const local = extractCriteria(text);
    criteria = mergeCriteria(criteria, local);
    criteria = mergeCriteria(criteria, await extractWithAI(text));
  }
  const answer = req.body?.answer;
  if (answer?.key) {
    criteria = applyAnswer(criteria, answer.key, answer.value ?? null);
  }
  res.json({
    criteria,
    precision: precision(criteria),
    question: nextQuestion(criteria),
    progress: questionCount(criteria),
  });
});

// Recherche dans le catalogue (contrat openapi.yaml)
app.post('/api/catalog/search', async (req, res) => {
  const query = String(req.body?.query ?? '').trim();
  let criteria = toCriteria(req.body?.criteria);
  if (query) criteria = mergeCriteria(criteria, extractCriteria(query));
  const catalog = await flavors();
  const references = criteria.custom ? [] : rank(catalog, criteria);
  res.json({
    criteria,
    references,
    // Nombre de fiches parcourues, affiché pendant l'animation du labo
    scanned: catalog.length,
    expert: references.length === 0,
    summary: expertSummary(query, criteria),
  });
});

app.get('/api/catalog/:code', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM flavors WHERE code = $1', [
    req.params.code,
  ]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Référence inconnue' });
    return;
  }
  res.json(rows[0]);
});

const REQUEST_SQL = `SELECT r.*, f.code AS flavor_code, f.name AS flavor_name,
  (SELECT json_agg(e ORDER BY e.created_at) FROM status_events e
    WHERE e.subject = 'request' AND e.subject_id = r.id) AS events
  FROM requests r LEFT JOIN flavors f ON f.id = r.flavor_id`;

const ORDER_SQL = `SELECT o.*, f.code AS flavor_code, f.name AS flavor_name,
  (SELECT json_agg(e ORDER BY e.created_at) FROM status_events e
    WHERE e.subject = 'order' AND e.subject_id = o.id) AS events
  FROM orders o JOIN flavors f ON f.id = o.flavor_id`;

app.get('/api/requests', async (_req, res) => {
  const { rows } = await db.query(
    `${REQUEST_SQL} WHERE r.client_id = $1 ORDER BY r.created_at DESC`,
    [CLIENT_ID],
  );
  res.json(rows);
});

app.get('/api/requests/:id', async (req, res) => {
  const { rows } = await db.query(`${REQUEST_SQL} WHERE r.id = $1`, [
    Number(req.params.id),
  ]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  res.json(rows[0]);
});

// Demande d'échantillon (référence du catalogue) ou relais expert (création)
app.post('/api/requests', async (req, res) => {
  const kind = req.body?.kind;
  const need = String(req.body?.need ?? '').trim();
  const flavorId = req.body?.flavorId ? Number(req.body.flavorId) : null;
  if (!['sample', 'expert'].includes(kind) || !need) {
    res.status(400).json({ error: 'Type de demande ou besoin manquant' });
    return;
  }
  if (kind === 'sample' && !flavorId) {
    res.status(400).json({ error: 'Référence manquante pour un échantillon' });
    return;
  }
  const status = STATUSES[kind as 'sample' | 'expert'][0];
  const { rows } = await db.query(
    `INSERT INTO requests (client_id, kind, need, criteria, flavor_id, address, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      CLIENT_ID,
      kind,
      need,
      JSON.stringify(toCriteria(req.body?.criteria)),
      flavorId,
      req.body?.address ?? null,
      status,
    ],
  );
  await logStatus('request', rows[0].id, status);
  const created = await db.query(`${REQUEST_SQL} WHERE r.id = $1`, [
    rows[0].id,
  ]);
  res.status(201).json(created.rows[0]);
});

// Avis du client sur l'échantillon reçu
app.patch('/api/requests/:id', async (req, res) => {
  const feedback = Array.isArray(req.body?.feedback)
    ? req.body.feedback.map(String)
    : null;
  const { rowCount } = await db.query(
    'UPDATE requests SET feedback = $1, updated_at = now() WHERE id = $2',
    [feedback, Number(req.params.id)],
  );
  if (!rowCount) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  const { rows } = await db.query(`${REQUEST_SQL} WHERE r.id = $1`, [
    Number(req.params.id),
  ]);
  res.json(rows[0]);
});

// Démo : simule l'avancement côté Givaudan (préparation, expédition…)
async function advance(table: 'requests' | 'orders', id: number) {
  const { rows } = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) return null;
  const steps: readonly string[] =
    table === 'orders'
      ? STATUSES.order
      : STATUSES[row.kind as 'sample' | 'expert'];
  const next = steps[steps.indexOf(row.status) + 1];
  if (!next) return row;
  await db.query(
    `UPDATE ${table} SET status = $1, updated_at = now() WHERE id = $2`,
    [next, id],
  );
  await logStatus(table === 'orders' ? 'order' : 'request', id, next);
  return { ...row, status: next };
}

app.post('/api/requests/:id/advance', async (req, res) => {
  const row = await advance('requests', Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  res.json(row);
});

app.get('/api/orders', async (_req, res) => {
  const { rows } = await db.query(
    `${ORDER_SQL} WHERE o.client_id = $1 ORDER BY o.created_at DESC`,
    [CLIENT_ID],
  );
  res.json(rows);
});

app.get('/api/orders/:id', async (req, res) => {
  const { rows } = await db.query(`${ORDER_SQL} WHERE o.id = $1`, [
    Number(req.params.id),
  ]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Commande introuvable' });
    return;
  }
  res.json(rows[0]);
});

// Commande d'une référence. Prix et délai : jamais calculés ici, confirmés par Givaudan
app.post('/api/orders', async (req, res) => {
  const flavorId = Number(req.body?.flavorId);
  const quantity = Number(req.body?.quantityKg);
  const packaging = String(req.body?.packaging ?? '').trim();
  const address = String(req.body?.address ?? '').trim();
  if (!flavorId || !(quantity > 0) || !packaging || !address) {
    res.status(400).json({
      error: 'Référence, quantité, conditionnement et adresse requis',
    });
    return;
  }
  const { rows } = await db.query(
    `INSERT INTO orders (client_id, request_id, flavor_id, quantity_kg, packaging, address, internal_ref, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      CLIENT_ID,
      req.body?.requestId ? Number(req.body.requestId) : null,
      flavorId,
      quantity,
      packaging,
      address,
      req.body?.internalRef || null,
      STATUSES.order[0],
    ],
  );
  await logStatus('order', rows[0].id, STATUSES.order[0]);
  const created = await db.query(`${ORDER_SQL} WHERE o.id = $1`, [rows[0].id]);
  res.status(201).json(created.rows[0]);
});

app.post('/api/orders/:id/advance', async (req, res) => {
  const row = await advance('orders', Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: 'Commande introuvable' });
    return;
  }
  res.json(row);
});

// Anciennes routes de démarrage, conservées pour l'équipe Data/IA
app.get('/api/questions', async (_req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM questions ORDER BY id DESC LIMIT 10',
  );
  res.json(rows);
});

app.post('/api/questions', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) {
    res.status(400).json({ error: 'Question manquante' });
    return;
  }
  const answer = DATA_AI_URL
    ? await askDataTeam(question)
    : await ask(question);
  const { rows } = await db.query(
    'INSERT INTO questions (question, answer) VALUES ($1, $2) RETURNING *',
    [question, answer],
  );
  res.status(201).json(rows[0]);
});

// Erreurs : un message lisible, jamais de page HTML
app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  void next;
  console.error(error);
  res.status(500).json({ error: 'Erreur interne', detail: error.message });
});

await ensureSchema();
// Sans adresse, Node écoute sur toutes les interfaces : joignable hors du conteneur
app.listen(PORT, () => console.log(`API sur http://localhost:${PORT}`));
