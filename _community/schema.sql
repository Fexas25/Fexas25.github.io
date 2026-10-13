CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, message TEXT NOT NULL, created INTEGER NOT NULL, visitor TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS messages_public ON messages(approved, id);
CREATE INDEX IF NOT EXISTS messages_rate ON messages(visitor, created);
CREATE TABLE IF NOT EXISTS translations (hash TEXT PRIMARY KEY, text TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS quotas (bucket TEXT PRIMARY KEY, used INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS private_documents(id TEXT PRIMARY KEY, title TEXT NOT NULL, document TEXT NOT NULL, key_hash TEXT NOT NULL, revision TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS private_attempts(bucket TEXT PRIMARY KEY, used INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS private_attempts_expiry ON private_attempts(expires);

CREATE TABLE IF NOT EXISTS message_replies (message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE, body TEXT NOT NULL, updated INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS documents (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, document TEXT NOT NULL,
 metadata TEXT NOT NULL, visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
 key_hash TEXT NOT NULL DEFAULT '', revision TEXT NOT NULL, updated INTEGER NOT NULL,
 public_url TEXT NOT NULL UNIQUE, source_path TEXT UNIQUE, deleted_at INTEGER NOT NULL DEFAULT 0
);
