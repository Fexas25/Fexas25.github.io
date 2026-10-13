"""Exercise SQL backup recovery with synthetic data, never production contents."""
import hashlib
import json
from pathlib import Path
import sqlite3

source = sqlite3.connect(':memory:')
source.executescript((Path(__file__).resolve().parents[1] / '_community/schema.sql').read_text(encoding='utf-8-sig'))
key = 'synthetic-access-key'
image = 'data:image/png;base64,c3ludGhldGljLWltYWdl'
for index, (folder, visibility, deleted) in enumerate([('_posts', 'private', 0), ('_projects', 'public', 0), ('_posts', 'private', 123)]):
    ident = f'synthetic-{index}'
    source.execute('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?)', (
        ident, 'Synthetic document', json.dumps({'folder': folder, 'text': f'Body ![image]({image})'}),
        json.dumps({'folder': folder, 'tags': ['example']}), visibility,
        hashlib.sha256(f'{ident}:{key}'.encode()).hexdigest() if visibility == 'private' else '',
        'revision-2', 123, f'/document/{index}', None, deleted))
source.execute("INSERT INTO messages VALUES(1,'Visitor','Message',123,'visitor-hash',1)")
source.execute("INSERT INTO message_replies VALUES(1,'Reply',124,2)")
source.commit()
restored = sqlite3.connect(':memory:')
restored.executescript('\n'.join(source.iterdump()))
for table in ('documents', 'messages', 'message_replies'):
    assert source.execute(f'SELECT * FROM {table} ORDER BY 1').fetchall() == restored.execute(f'SELECT * FROM {table} ORDER BY 1').fetchall(), table
row = restored.execute("SELECT document,key_hash FROM documents WHERE id='synthetic-0'").fetchone()
assert image in json.loads(row[0])['text']
assert row[1] == hashlib.sha256(f'synthetic-0:{key}'.encode()).hexdigest()
assert restored.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
assert not restored.execute('PRAGMA foreign_key_check').fetchall()
print('SQL restore preserves documents, visibility, keys, images, trash and replies.')
