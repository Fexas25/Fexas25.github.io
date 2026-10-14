"""Serve the built site to concurrent browser tests on loopback only."""
import argparse
import json
import re
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--directory', required=True)
args = parser.parse_args()


class TestServer(ThreadingHTTPServer):
    # Several mobile pages request their scripts/images at the same instant.
    request_queue_size = 128


class TestHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.media_remaining = None
        if not urlsplit(self.path).path.startswith('/assets/music/'):
            return super().send_head()
        path = Path(self.translate_path(self.path))
        if not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        start, end = 0, size - 1
        value = self.headers.get('Range')
        if value:
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', value)
            if match and any(match.groups()):
                left, right = match.groups()
                start = int(left) if left else max(0, size - int(right))
                end = min(size - 1, int(right)) if left and right else size - 1
            else:
                start = size
            if start > end or start >= size:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
        self.send_response(206 if value else 200)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Length', str(end - start + 1))
        if value:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        source = path.open('rb')
        source.seek(start)
        self.media_remaining = end - start + 1
        return source

    def copyfile(self, source, output):
        if self.media_remaining is None:
            return super().copyfile(source, output)
        # Native WebKit requests byte ranges for MP3 metadata and seeking.
        # Match the production static host instead of sending the whole MP3.
        try:
            while self.media_remaining:
                chunk = source.read(min(65536, self.media_remaining))
                if not chunk:
                    break
                output.write(chunk)
                self.media_remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def documents(self):
        data=json.loads((Path(args.directory)/'search-index.json').read_text(encoding='utf-8'))
        return [dict(id=x['backendId'], title=x['title'], date=x['date'],tags=x['tags'],url=x['url'],folder='_cp' if x['category']=='writing' else '_posts' if x['category']=='moments' else '_projects',topic='notes',type='creative',visibility='public') for x in data if x.get('backendId')]

    def send_json(self,data,status=200):
        content=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)

    def do_POST(self):
        if self.path!='/documents/read':
            self.send_error(404);return
        data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
        doc=next((d for d in self.documents() if d['id']==data.get('id')),None)
        if not doc:self.send_json({'error':'not found'},404);return
        self.send_json(dict(**doc,document=dict(title=doc['title'],folder=doc['folder'],filename='test.md',text='---\ntitle: '+json.dumps(doc['title'])+'\n---\n\n浏览器测试正文。\n\n## 示例\n\n```js\nconst value = 1;\n```')))

    def do_GET(self):
        if self.path=='/documents':
            self.send_json({'documents':self.documents()});return
        # Local browser checks must never use production comments, CAPTCHA or AI quota.
        # Configured-service scenarios supply their own mocked route in Playwright.
        if urlsplit(self.path).path in ('/community-config.js', '/editor-config.js'):
            content = (b'window.MX_PUBLISH = Object.freeze({authOrigin:""});'
                       if urlsplit(self.path).path == '/editor-config.js'
                       else b'window.MX_DOCUMENTS_ORIGIN=location.origin;window.MX_COMMUNITY = Object.freeze({origin:"",siteKey:""});')
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        super().do_GET()


with TestServer(('127.0.0.1', 4173), partial(TestHandler, directory=args.directory)) as server:
    server.serve_forever()
