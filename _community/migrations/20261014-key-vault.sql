CREATE TABLE IF NOT EXISTS admin_key_vault (kind TEXT NOT NULL, id TEXT NOT NULL, key_hash TEXT NOT NULL, ciphertext TEXT NOT NULL, PRIMARY KEY(kind,id));
