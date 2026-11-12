// Appels à l'API Express (contrat : openapi.yaml). Le proxy Vite envoie /api vers le port 3000.

export type QuestionKey = 'family' | 'format' | 'natural' | 'application';

export type Criteria = {
  family?: string;
  format?: 'poudre' | 'liquide';
  natural?: boolean;
  application?: string;
  notes: string[];
  custom: boolean;
  skipped: QuestionKey[];
};

export type Question = {
  key: QuestionKey;
  label: string;
  hint: string;
  options: { value: string; label: string; detail?: string }[];
};

export type Analysis = {
  criteria: Criteria;
  precision: number;
  question: Question | null;
  progress: { remaining: number; total: number };
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

export type Search = {
  criteria: Criteria;
  references: Proposal[];
  expert: boolean;
  summary: { need: string; product: string; constraints: string };
};

export type StatusEvent = { status: string; created_at: string };

export type RequestRow = {
  id: number;
  kind: 'sample' | 'expert';
  need: string;
  criteria: Criteria;
  flavor_id: number | null;
  flavor_code: string | null;
  flavor_name: string | null;
  address: string | null;
  status: string;
  feedback: string[] | null;
  created_at: string;
  events: StatusEvent[] | null;
};

export type OrderRow = {
  id: number;
  request_id: number | null;
  flavor_id: number;
  flavor_code: string;
  flavor_name: string;
  quantity_kg: string;
  packaging: string;
  address: string;
  internal_ref: string | null;
  status: string;
  created_at: string;
  events: StatusEvent[] | null;
};

export type Client = {
  id: number;
  name: string;
  company: string;
  email: string;
  address: string;
};

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `Erreur ${response.status}`);
  }
  return data as T;
}

export const api = {
  client: () => call<Client>('GET', '/client'),
  analyze: (body: {
    text?: string;
    criteria?: Criteria;
    answer?: { key: QuestionKey; value: string | null };
  }) => call<Analysis>('POST', '/assistant/analyze', body),
  search: (query: string, criteria?: Criteria) =>
    call<Search>('POST', '/catalog/search', { query, criteria }),
  flavor: (code: string) =>
    call<Flavor>('GET', `/catalog/${encodeURIComponent(code)}`),
  requests: () => call<RequestRow[]>('GET', '/requests'),
  request: (id: number) => call<RequestRow>('GET', `/requests/${id}`),
  createRequest: (body: {
    kind: 'sample' | 'expert';
    need: string;
    flavorId?: number;
    criteria?: Criteria;
    address?: string;
  }) => call<RequestRow>('POST', '/requests', body),
  feedback: (id: number, feedback: string[]) =>
    call<RequestRow>('PATCH', `/requests/${id}`, { feedback }),
  advanceRequest: (id: number) =>
    call<RequestRow>('POST', `/requests/${id}/advance`),
  orders: () => call<OrderRow[]>('GET', '/orders'),
  order: (id: number) => call<OrderRow>('GET', `/orders/${id}`),
  createOrder: (body: {
    flavorId: number;
    requestId?: number;
    quantityKg: number;
    packaging: string;
    address: string;
    internalRef?: string;
  }) => call<OrderRow>('POST', '/orders', body),
  advanceOrder: (id: number) => call<OrderRow>('POST', `/orders/${id}/advance`),
};
