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
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'creative',
 kind TEXT NOT NULL CHECK(kind IN ('static','link')), external_url TEXT NOT NULL DEFAULT '',
 visibility TEXT NOT NULL CHECK(visibility IN ('public','private')), key_hash TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published')),
 version TEXT NOT NULL DEFAULT '', entry TEXT NOT NULL DEFAULT 'index.html',
 revision TEXT NOT NULL, updated INTEGER NOT NULL, deleted_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS project_uploads (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, created INTEGER NOT NULL, sealed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS project_files (
 upload_id TEXT NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL, mime TEXT NOT NULL, ready INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(upload_id,path)
);
CREATE TABLE IF NOT EXISTS project_sessions (
 token_hash TEXT PRIMARY KEY, project_id TEXT NOT NULL, key_hash TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS project_session_expiry ON project_sessions(expires);
