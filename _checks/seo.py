"""Validate a production Jekyll output: python _checks/seo.py PATH_TO_BUILD."""
import json
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs


class Head(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.inside = False
        self.capture = None
        self.meta = {}
        self.links = {}
        self.titles = []
        self.schemas = []
        self.scripts = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'head':
            self.inside = True
        if not self.inside:
            return
        if tag == 'meta':
            key = attrs.get('name', attrs.get('property'))
            if key:
                assert key not in self.meta, f'Duplicate metadata: {key}'
                self.meta[key] = attrs.get('content', '')
        if tag == 'link':
            self.links.setdefault(attrs.get('rel'), []).append(attrs.get('href'))
        if tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs['src'])
        if tag == 'title':
            self.titles.append('')
            self.capture = self.titles
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.schemas.append('')
            self.capture = self.schemas

    def handle_endtag(self, tag):
        if tag in ('title', 'script'):
            self.capture = None
        if tag == 'head':
            self.inside = False

    def handle_data(self, data):
        if self.capture is not None:
            self.capture[-1] += data


root = Path(sys.argv[1])
origin = 'https://fexas25.github.io'
private_routes = {'/dad-birthday.html','/document/','/private/','/community-setup.html', '/editor.html', '/publishing-setup.html', '/404.html'}
sitemap = ET.parse(root / 'sitemap.xml')
urls = {node.text for node in sitemap.findall('.//{*}loc')}
assert len(urls) == len(sitemap.findall('.//{*}loc')), 'Duplicate sitemap entries'
seen = set()
article_count = 0
files = list(root.rglob('*.html'))
for file in files:
    html = file.read_text(encoding='utf-8')
    head = Head(html)
    for asset in head.scripts + head.links.get('stylesheet', []):
        parsed = urlsplit(asset)
        if not parsed.netloc or parsed.netloc == urlsplit(origin).netloc:
            version = parse_qs(parsed.query).get('v', [''])[0]
            assert version.isdigit(), f'{file}: unversioned asset {asset}'
    route = '/' + file.relative_to(root).as_posix()
    route = route.removesuffix('index.html') if route.endswith('/index.html') else route
    assert len(head.titles) == 1 and head.titles[0].strip(), file
    assert len(head.links.get('canonical', [])) == 1, file
    canonical = head.links['canonical'][0]
    backend = 'data-backend-id="' in html and 'data-backend-id=""' not in html
    if backend:
        assert canonical.startswith('https://mx-community.liuwanting830.workers.dev/read/'), file
    else:
        assert canonical.startswith(origin + '/') and unquote(urlsplit(canonical).path) == unquote(route), file
    assert canonical not in seen, file
    seen.add(canonical)
    assert head.meta['og:url'] == canonical, file
    assert head.meta['og:title'] == head.titles[0], file
    description = head.meta['description']
    assert 0 < len(description) <= 160 and '{{' not in description, file
    assert head.meta['og:description'] == head.meta['twitter:description'] == description, file
    assert head.meta['twitter:card'] == 'summary_large_image', file
    assert head.meta['og:locale'] == 'zh_CN', file
    image = head.meta['og:image']
    assert image == head.meta['twitter:image'] and image.startswith(origin + '/'), file
    assert (root / unquote(urlsplit(image).path).lstrip('/')).is_file(), image
    assert head.meta['og:image:alt'], file
    assert head.links['alternate'] == [origin + '/feed.xml'], file
    if route in private_routes or backend:
        assert head.meta['robots'] == 'noindex, follow', file
        assert canonical not in urls and not head.schemas, file
    else:
        assert 'noindex' not in head.meta['robots'] and canonical in urls, file
        assert len(head.schemas) == 1, file
        schema = json.loads(head.schemas[0])
        assert schema['url'] == canonical and schema['description'] == description, file
        if head.meta['og:type'] == 'article':
            article_count += 1
            assert schema['@type'] == 'BlogPosting' and schema['datePublished'], file
            assert schema['author']['name'] == 'MX', file
        if route == '/':
            assert schema['@type'] == 'WebSite', file
        if route == '/about/':
            assert schema['mainEntity']['sameAs'] == ['https://github.com/Fexas25', 'https://atcoder.jp/users/Fexas_01'], file
assert urls == {url for url in seen if url.startswith(origin+'/')} - {origin + route for route in private_routes}, urls - seen
robots = (root / 'robots.txt').read_text(encoding='utf-8')
assert 'Sitemap: ' + origin + '/sitemap.xml' in robots and 'Disallow:' not in robots
ET.parse(root / 'feed.xml')
print(f'PASS: {len(files)} pages, {article_count} articles, {len(urls)} sitemap URLs; canonical, descriptions, social tags, JSON-LD, existing images, noindex, robots and feed.')
