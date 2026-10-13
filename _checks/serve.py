"""Serve the built site to concurrent browser tests on loopback only."""
import argparse
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
    def do_GET(self):
        # Local browser checks must never use production comments, CAPTCHA or AI quota.
        # Configured-service scenarios supply their own mocked route in Playwright.
        if urlsplit(self.path).path in ('/community-config.js', '/editor-config.js'):
            content = (b'window.MX_PUBLISH = Object.freeze({authOrigin:""});'
                       if urlsplit(self.path).path == '/editor-config.js'
                       else b'window.MX_COMMUNITY = Object.freeze({origin:"",siteKey:""});')
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        super().do_GET()


with TestServer(('127.0.0.1', 4173), partial(TestHandler, directory=args.directory)) as server:
    server.serve_forever()
