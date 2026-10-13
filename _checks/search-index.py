"""Check the generated search index against all published articles."""
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(sys.argv[1]).resolve()
entries = json.loads((root / 'search-index.json').read_text(encoding='utf-8'))
assert isinstance(entries, list), 'Search index must be an array'
seen = set()
for entry in entries:
    url = entry['url']
    assert url not in seen, f'Duplicate search URL: {url}'
    seen.add(url)
    parts = urlsplit(url)
    assert not parts.scheme and not parts.netloc and parts.path.startswith('/'), url
    target = (root / unquote(parts.path).lstrip('/')).resolve()
    assert target.is_relative_to(root), url
    if target.is_dir():
        target /= 'index.html'
    assert target.is_file(), f'Missing search target: {url}'
    assert isinstance(entry['title'], str) and entry['title'].strip(), url
    assert isinstance(entry['content'], str), url
    assert isinstance(entry['tags'], list) and all(isinstance(tag, str) and tag.strip() for tag in entry['tags']), f'Tags must be a list of text: {url}'
    assert entry['category'] in ['moments', 'writing', 'works', 'pages'], url
    if entry['date']:
        date.fromisoformat(entry['date'])

articles = set()
for file in root.rglob('*.html'):
    html = file.read_text(encoding='utf-8')
    if re.search(r'property="og:type"\s+content="article"', html):
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        assert canonical, file
        backend = re.search(r'data-backend-id="([^"]+)"', html)
        if backend:
            match = next((e for e in entries if e.get('backendId') == backend[1]), None)
            assert match and not match['content'], f'Bodyless legacy route missing from search: {file}'
            articles.add(match['url'])
        else:
            articles.add(urlsplit(canonical[1]).path)
assert articles <= seen, f'Published articles missing from search: {articles - seen}'
assert entries and articles, 'Expected published content in the search index'
print(f'PASS: search index has {len(entries)} valid targets and covers all {len(articles)} articles.')
