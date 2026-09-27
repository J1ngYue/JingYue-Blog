CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  recurring INTEGER NOT NULL DEFAULT 0,
  remind INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_date_idx ON events(date);

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL,
  note TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bills_date_idx ON bills(date);

CREATE TABLE IF NOT EXISTS reminder_log (
  event_id TEXT NOT NULL,
  target_date TEXT NOT NULL,
  PRIMARY KEY (event_id, target_date)
);
