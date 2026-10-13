CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, message TEXT NOT NULL, created INTEGER NOT NULL, visitor TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS messages_public ON messages(approved, id);
CREATE INDEX IF NOT EXISTS messages_rate ON messages(visitor, created);
CREATE TABLE IF NOT EXISTS translations (hash TEXT PRIMARY KEY, text TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS quotas (bucket TEXT PRIMARY KEY, used INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS private_documents(id TEXT PRIMARY KEY, title TEXT NOT NULL, document TEXT NOT NULL, key_hash TEXT NOT NULL, revision TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS private_attempts(bucket TEXT PRIMARY KEY, used INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS private_attempts_expiry ON private_attempts(expires);
