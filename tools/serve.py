#!/usr/bin/env python3
"""Look at the site on your own computer, the way a visitor's browser gets it.

  python3 tools/serve.py                 start, and open the site in your browser
  python3 tools/serve.py --no-open       start, but do not open the browser (open the address it prints)
  python3 tools/serve.py --port 8080     use this port (default: 8000 if it is free, otherwise any free one; 0 = any free one)
  python3 tools/serve.py deploy          show another folder, for example the upload folder deploy/ (relative to the site folder)

Why use this and not a double-click on index.html: a page opened straight from the folder (a file:// address) is not given the line number when
js/content.js has a typo, other languages load less reliably, and some browsers refuse a few things. Here the pages come over http://localhost,
exactly like on the live site, so the yellow or green "Site check" box at the bottom of the page names the line of every mistake.

It shows only on your own computer (nobody else can reach it), nothing is written, and pages are never kept in the browser's memory, so after you
save a file a refresh (F5) shows the change at once. Close this window (or press Ctrl+C) to stop it.

Needs only Python 3.8 or newer: nothing to install. Works on Windows, Mac and Linux.
"""
import argparse, mimetypes, os, signal, sys, threading, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

# ---- Windows safety: these lines open every tool in tools/ (tests/windows-reality.test.mjs checks that they are the same in all of them).
try:   # an old Windows console, or output sent to a file (cp1252, cp437), cannot show every letter: show a ? for it instead of stopping
    sys.stdout.reconfigure(errors='replace')
except (AttributeError, ValueError, OSError):
    pass


def _stop_plainly(kind, err, tb):
    """A file saved in the old Windows format (Notepad's "ANSI"), or one that is read-only or open in another program, ends a tool with a plain message, not a traceback."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if issubclass(kind, UnicodeDecodeError):
        import glob
        for pat in ('*.html', 'pages/*.html', 'js/*.js', 'css/*.css', 'lang/*.json', 'lang/src/*.json', 'tools/*.json'):
            for path in sorted(glob.glob(os.path.join(root, pat))):
                with open(path, 'rb') as f:
                    raw = f.read()
                try:
                    raw.decode('utf-8')
                except UnicodeDecodeError as bad:
                    line = raw.split(b'\n')[raw.count(b'\n', 0, bad.start)]
                    print('%s is not saved as UTF-8: line %d has a character in the old Windows "ANSI" format (a dash, a curly quote or a letter with an accent):\n    %s\n'
                          'Open the file and save it again as UTF-8 (Notepad: File, Save As, then Encoding: UTF-8; VS Code: click the encoding at the bottom right, Save with Encoding, UTF-8). Then run this again.'
                          % (os.path.relpath(path, root).replace(os.sep, '/'), raw.count(b'\n', 0, bad.start) + 1, line.decode('utf-8', 'replace').strip()[:70].encode('ascii', 'replace').decode()), file=sys.stderr)
                    return
    elif issubclass(kind, PermissionError) and getattr(err, 'filename', None):
        print('I could not open or change %s: the file is read-only, or open in another program, or locked while OneDrive syncs it.\n'
              'Right-click it, Properties, and untick Read-only; close the programs that show it; wait a moment. Then run this again.' % err.filename, file=sys.stderr)
        return
    sys.__excepthook__(kind, err, tb)


sys.excepthook = _stop_plainly
# ---- end of the Windows safety lines

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREFERRED_PORT = 8000

# Fixed on purpose: on some Windows computers Python reads the types from the registry, which can call a .js file "text/plain", and then the
# browser refuses to run the script. The live site is sent with these types and with nosniff (see _headers), so it is the same here.
TYPES = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml',
    '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
}


def content_type(path):
    ext = os.path.splitext(path)[1].lower()
    return TYPES.get(ext) or mimetypes.guess_type(path)[0] or 'application/octet-stream'


def make_handler(folder):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'WiseAcresPreview'
        protocol_version = 'HTTP/1.1'

        def find(self, urlpath):
            """The file for an address, or None. No folder listings, no hidden files or folders, nothing outside the folder."""
            parts = [p for p in unquote(urlsplit(urlpath).path).replace('\\', '/').split('/') if p not in ('', '.')]
            if any(p == '..' or p.startswith('.') or '\x00' in p for p in parts):
                return None
            try:
                path = os.path.join(folder, *parts)
                if os.path.isdir(path):
                    path = os.path.join(path, 'index.html')
                elif not os.path.isfile(path) and os.path.isfile(path + '.html'):
                    path += '.html'   # /wise-pie for wise-pie.html, as the live site (Cloudflare) does
                real, base = os.path.realpath(path), os.path.realpath(folder)
                if not os.path.isfile(real) or not real.startswith(base + os.sep):   # not a file, or a link that leads outside the folder
                    return None
            except (OSError, ValueError, UnicodeError):   # letters or signs this computer cannot use in a file name (an address with an accent on a computer set to plain ASCII)
                return None
            return real

        def send(self, status, body, ctype, head_only=False):
            self.send_response(status)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            if not head_only:
                self.wfile.write(body)

        def serve(self, head_only):
            real = self.find(self.path)
            if real:
                with open(real, 'rb') as f:
                    body = f.read()
                self.send(200, body, content_type(real), head_only)
                return
            try:
                print('  not found: ' + unquote(urlsplit(self.path).path), flush=True)   # a missing picture or script is worth seeing
            except (OSError, ValueError):   # a closed window must not stop the answer
                pass
            page = os.path.join(folder, '404.html')
            if os.path.isfile(page):
                with open(page, 'rb') as f:
                    self.send(404, f.read(), TYPES['.html'], head_only)
            else:
                self.send(404, b'Not found', TYPES['.txt'], head_only)

        def do_GET(self):
            self.serve(False)

        def do_HEAD(self):
            self.serve(True)

        def log_message(self, fmt, *args):   # the browser asks for dozens of files per page: say nothing about the good ones
            pass

    return Handler


def may_share_port(os_name=None):
    """False on Windows. There, "reuse address" lets a second program take the same port while the first is still using it: two windows would both say
    http://localhost:8000/ and show different things. Without it, the busy port is refused and start() takes another one."""
    return (os_name or os.name) != 'nt'


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = may_share_port()

    def handle_error(self, request, client_address):   # a browser that gives up on a picture is not a problem to print
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def start(folder, port):
    """A server on 127.0.0.1 (this computer only). port None: 8000 if free, else any free port. Returns (server, port)."""
    handler = make_handler(folder)
    if port is None:
        try:
            srv = Server(('127.0.0.1', PREFERRED_PORT), handler)
        except OSError:
            srv = Server(('127.0.0.1', 0), handler)
    else:
        srv = Server(('127.0.0.1', port), handler)
    return srv, srv.server_address[1]


def main(argv=None):
    if sys.version_info < (3, 8):
        print('This needs Python 3.8 or newer (this is %d.%d).' % sys.version_info[:2])
        return 2
    ap = argparse.ArgumentParser(description='Look at the site on your own computer.')
    ap.add_argument('folder', nargs='?', default='.', help='the folder to show (default: the site folder; "deploy" shows the upload folder)')
    ap.add_argument('--port', type=int, default=None, help='the port (default: 8000 if free, otherwise any free one; 0 = any free one)')
    ap.add_argument('--no-open', action='store_true', help='do not open the browser')
    args = ap.parse_args(argv)

    folder = args.folder if os.path.isabs(args.folder) else os.path.join(ROOT, args.folder)
    folder = os.path.abspath(folder)
    if not os.path.isfile(os.path.join(folder, 'index.html')):
        print('There is no index.html in ' + folder + ', so there is nothing to show. Run this from the website folder:  python3 tools/serve.py')
        return 1
    try:
        srv, port = start(folder, args.port)
    except OSError as e:
        print('I could not start on port %s (%s). Try another one:  python3 tools/serve.py --port 0' % (args.port, e.strerror or e))
        return 1
    url = 'http://localhost:%d/' % port
    print('Wise Acres: the site on your own computer', flush=True)
    print('  Folder:   ' + folder, flush=True)
    print('  Address:  ' + url, flush=True)
    print('', flush=True)
    print('Close this window (or press Ctrl+C) to stop.', flush=True)
    print('After you save a change, refresh the page in the browser (F5). The "Site check" box at the bottom of the page says what to fix; add ?check to the address for more:  ' + url + '?check', flush=True)
    if not args.no_open:
        try:
            threading.Timer(0.4, lambda: webbrowser.open(url)).start()
        except Exception:
            print('(Your browser did not open by itself: type the address above into it.)', flush=True)
    def stop(*_):
        raise KeyboardInterrupt
    try:
        signal.signal(signal.SIGTERM, stop)   # "stop" from a program or a task manager ends it the same tidy way as Ctrl+C
    except (ValueError, OSError, AttributeError):
        pass
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
    print('Stopped.', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
