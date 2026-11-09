// Append only. Index i is applied when PRAGMA user_version === i.
export const migrations: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE subjects (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    source TEXT NOT NULL,
    source_ref TEXT,
    tier INTEGER NOT NULL,
    title TEXT NOT NULL,
    article TEXT NOT NULL,
    task TEXT NOT NULL,
    guide_questions TEXT NOT NULL DEFAULT '[]',
    keywords TEXT NOT NULL DEFAULT '[]',
    structure TEXT,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    tier INTEGER NOT NULL,
    is_mock INTEGER NOT NULL DEFAULT 0,
    cr TEXT NOT NULL DEFAULT '',
    pe TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    result TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    corrected_at TEXT
  );
  -- Un seul sujet en cours (draft ou correcting) à la fois.
  CREATE UNIQUE INDEX sessions_one_active
    ON sessions ((status IN ('draft', 'correcting')))
    WHERE status IN ('draft', 'correcting');

  CREATE TABLE llm_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    model TEXT NOT NULL,
    ref_id TEXT,
    ok INTEGER NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    latency_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX llm_calls_created_at ON llm_calls (created_at);
  `,
  // Plan 2 (index 1): login, dictionary cache, cards, news dedup, lookups + exam mode on sessions.
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('student', 'viewer')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE definitions (
    key TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    definition TEXT NOT NULL,
    exemple TEXT NOT NULL,
    fr TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    term TEXT NOT NULL,
    term_key TEXT NOT NULL UNIQUE,
    definition TEXT NOT NULL,
    example TEXT,
    fr TEXT NOT NULL,
    audio_path TEXT,
    fsrs TEXT NOT NULL,
    suspended INTEGER NOT NULL DEFAULT 0,
    source_kind TEXT NOT NULL DEFAULT 'word' CHECK (source_kind IN ('word', 'irregular_verb')),
    origin TEXT NOT NULL DEFAULT 'kept' CHECK (origin IN ('kept', 'correction')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE card_contexts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    sentence TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('reading', 'listening')),
    source_id TEXT NOT NULL,
    source_title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (card_id, source_id, sentence)
  );

  CREATE TABLE review_logs (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
    reviewed_at TEXT NOT NULL,
    elapsed_ms INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX review_logs_reviewed_at ON review_logs (reviewed_at);

  CREATE TABLE news_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    title_key TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at TEXT,
    fetched_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX news_items_title_key ON news_items (title_key);
  CREATE INDEX news_items_url ON news_items (url);

  ALTER TABLE sessions ADD COLUMN lookups TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE sessions ADD COLUMN exam_mode INTEGER NOT NULL DEFAULT 0;
  `,
  // Plan 3 (index 2): listenings + listening_attempts (compréhension orale).
  `
  CREATE TABLE listenings (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    source TEXT NOT NULL,              -- generated | upload
    source_ref TEXT,                   -- id du sujet RSS, thème ou nom du fichier importé
    format TEXT NOT NULL,
    level TEXT NOT NULL,
    title TEXT NOT NULL,
    context TEXT NOT NULL,             -- mise en situation en français
    script TEXT NOT NULL,              -- JSON Segment[]
    audio_path TEXT NOT NULL,          -- relatif à DATA_DIR/audio
    duration_sec INTEGER NOT NULL,
    voices TEXT NOT NULL DEFAULT '[]',
    tts TEXT,                          -- JSON TtsInfo
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TEXT NOT NULL
  );
  CREATE INDEX listenings_status ON listenings (status, created_at);

  CREATE TABLE listening_attempts (
    id TEXT PRIMARY KEY,
    listening_id TEXT NOT NULL REFERENCES listenings(id),
    plays INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    result TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    corrected_at TEXT
  );
  -- Un seul exercice en cours par audio.
  CREATE UNIQUE INDEX listening_attempts_one_active
    ON listening_attempts (listening_id) WHERE status IN ('draft', 'correcting');
  `,
  // Plan 4 (index 3): grammaire, placement, réécriture.
  `
  CREATE TABLE grammar_sets (
    id TEXT PRIMARY KEY,
    point TEXT NOT NULL,
    level TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX grammar_sets_point ON grammar_sets (point, created_at);

  CREATE TABLE grammar_items (
    id TEXT PRIMARY KEY,
    set_id TEXT NOT NULL REFERENCES grammar_sets(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    format TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    accepted TEXT NOT NULL,
    explanation TEXT NOT NULL,
    flagged_at TEXT
  );
  CREATE INDEX grammar_items_set ON grammar_items (set_id, position);

  CREATE TABLE grammar_attempts (
    id TEXT PRIMARY KEY,
    set_id TEXT NOT NULL REFERENCES grammar_sets(id),
    point TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '[]',
    score REAL,
    started_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE INDEX grammar_attempts_point ON grammar_attempts (point, finished_at);

  CREATE TABLE grammar_mastery (
    point TEXT PRIMARY KEY,
    scores TEXT NOT NULL DEFAULT '[]',
    mastered_at TEXT,
    next_review_at TEXT
  );

  CREATE TABLE placements (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'in_progress',
    content TEXT NOT NULL,
    answers TEXT,
    result TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );

  CREATE TABLE rewrites (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    pe TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX rewrites_session ON rewrites (session_id, created_at);
  `,
  // 4 : leçon avant la série de grammaire. Les séries pré-générées sans leçon et jamais commencées
  // sont supprimées : le cron nocturne les régénère avec leçon.
  `
  ALTER TABLE grammar_sets ADD COLUMN lesson TEXT;
  DELETE FROM grammar_items WHERE set_id IN (
    SELECT s.id FROM grammar_sets s WHERE NOT EXISTS (SELECT 1 FROM grammar_attempts a WHERE a.set_id = s.id)
  );
  DELETE FROM grammar_sets WHERE NOT EXISTS (SELECT 1 FROM grammar_attempts a WHERE a.set_id = grammar_sets.id);
  `,
];
