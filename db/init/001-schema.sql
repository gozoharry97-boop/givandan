-- Schéma de la plateforme de commande intelligente.
-- Rejoué sans risque : chaque objet n'est créé que s'il n'existe pas encore.

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalogue d'arômes. Données synthétiques : le catalogue Givaudan est confidentiel.
CREATE TABLE IF NOT EXISTS flavors (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  notes TEXT[] NOT NULL DEFAULT '{}',
  is_natural BOOLEAN NOT NULL,
  formats TEXT[] NOT NULL,
  applications TEXT[] NOT NULL DEFAULT '{}',
  strengths TEXT[] NOT NULL DEFAULT '{}',
  packagings TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Catalogue synthétique de démonstration'
);

-- Le client de la démo (persona Julien)
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL
);

-- Demandes : échantillon (référence du catalogue) ou relais vers un expert
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients (id),
  kind TEXT NOT NULL CHECK (kind IN ('sample', 'expert')),
  need TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '{}',
  flavor_id INTEGER REFERENCES flavors (id),
  address TEXT,
  status TEXT NOT NULL,
  feedback TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients (id),
  request_id INTEGER REFERENCES requests (id),
  flavor_id INTEGER NOT NULL REFERENCES flavors (id),
  quantity_kg NUMERIC(10, 2) NOT NULL CHECK (quantity_kg > 0),
  packaging TEXT NOT NULL,
  address TEXT NOT NULL,
  internal_ref TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historique des statuts, pour dater chaque étape de la frise de suivi
CREATE TABLE IF NOT EXISTS status_events (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject TEXT NOT NULL CHECK (subject IN ('request', 'order')),
  subject_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
