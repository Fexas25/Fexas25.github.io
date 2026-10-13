"""Serve the built site to concurrent browser tests on loopback only."""
import argparse
import json
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
