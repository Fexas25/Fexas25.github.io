"""Check generated links/assets; optional external checks only emit advisories."""
import concurrent.futures
import os
import re
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(sys.argv[1]).resolve()
ORIGIN = 'https://fexas25.github.io'


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.refs = []
        self.ids = set()
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        if tag == 'a' and attrs.get('name'):
            self.ids.add(attrs['name'])
        for key in ('href', 'src', 'poster'):
            if attrs.get(key):
                self.refs.append((attrs[key], self.getpos()[0]))
        if attrs.get('srcset') and not attrs['srcset'].startswith('data:'):
            self.refs.extend((part.strip().split()[0], self.getpos()[0]) for part in attrs['srcset'].split(',') if part.strip())


pages = {path: Page(path.read_text(encoding='utf-8')) for path in ROOT.rglob('*.html')}
assert pages, 'No generated HTML pages found'
external = {}
errors = []
checked = 0
for source in [*pages, *ROOT.rglob('*.css')]:
    relative = source.relative_to(ROOT).as_posix()
    base = ORIGIN + '/' + relative
    refs = pages[source].refs if source in pages else [
        (m.group(1).strip(' \"\''), source.read_text(encoding='utf-8')[:m.start()].count('\n') + 1)
        for m in re.finditer(r'url\(([^)]+)\)', source.read_text(encoding='utf-8'))
    ]
    for ref, line in refs:
        if ref.startswith(('data:', 'mailto:', 'tel:', 'blob:')):
            continue
        url = urlsplit(urljoin(base, ref))
        if url.scheme not in ('http', 'https'):
            errors.append(f'{relative}:{line}: Unsupported URL {ref}')
            continue
        if url.netloc != urlsplit(ORIGIN).netloc:
            external.setdefault(url._replace(fragment='').geturl(), f'{relative}:{line}')
            continue
        checked += 1
        target = (ROOT / unquote(url.path).lstrip('/')).resolve()
        if not target.is_relative_to(ROOT):
            errors.append(f'{relative}:{line}: Path escapes site: {ref}')
            continue
        if target.is_dir():
            target = target / 'index.html'
        if not target.is_file():
            errors.append(f'{relative}:{line}: Missing target: {ref}')
        elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
            errors.append(f'{relative}:{line}: Missing anchor: {ref}')

if '--external' not in sys.argv:
    for error in errors:
        print('::error::' + error.replace('%', '%25').replace('\n', '%0A'))
    if errors:
        sys.exit(f'FAIL: {len(errors)} broken internal references')
    print(f'PASS: {len(pages)} HTML pages, {checked} internal links/assets/anchors; {len(external)} unique external URLs reported separately.')
else:
    def probe(item):
        url, source = item
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'MX-Website-Link-Check'}, method='GET')
            with urllib.request.urlopen(request, timeout=8) as response:
                response.read(1)
            return None
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            return f'{source}: {url} — {error}'

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        warnings = [result for result in pool.map(probe, external.items()) if result]
    for warning in warnings:
        print('::warning::' + warning.replace('%', '%25').replace('\n', '%0A'))
    summary = f'外链检查：{len(external)} 个地址，{len(warnings)} 个需要人工复核。限流、登录限制或网络失败也可能产生提示；本项不阻止部署。'
    print(summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as output:
            output.write('## 外链提示\n\n' + summary + '\n')
