"""Serve the built site to concurrent browser tests on loopback only."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

parser = argparse.ArgumentParser()
parser.add_argument('--directory', required=True)
args = parser.parse_args()


class TestServer(ThreadingHTTPServer):
    # Several mobile pages request their scripts/images at the same instant.
    request_queue_size = 128


with TestServer(('127.0.0.1', 4173), partial(SimpleHTTPRequestHandler, directory=args.directory)) as server:
    server.serve_forever()
