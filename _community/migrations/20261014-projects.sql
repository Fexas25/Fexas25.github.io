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
