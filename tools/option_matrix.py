#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Option matrix: tries the optional patches in patches/optional/ TOGETHER, on throw-away copies of the site.

Every optional patch (winter, redirects, clean page addresses, shorter cache, Reserve window, phone number) was tested alone.
Nobody had tested them in combination. This program applies every combination that makes sense for each host (Cloudflare Pages,
Netlify, GitHub Pages) to a fresh copy of the site, rebuilds, runs the tests, runs tools/launch_check.py against a pretend host
that behaves like the chosen host, and prints one PASS or FAIL line per combination with the first check that failed.

    D=$(mktemp -d) && git archive HEAD | tar -x -C "$D" && cd "$D"      (a clean copy of the committed site)
    python3 tools/option_matrix.py .                    (all combinations: slow, see below)
    python3 tools/option_matrix.py . --list             (only list the combinations)
    python3 tools/option_matrix.py . --only cloudflare,winter-A      (the combinations whose name contains both words; --only again = or)
    python3 tools/option_matrix.py . --settings filled  (the 3 most different combinations with the owner's settings filled in:
                                                        review link, farm spot, email signup and language field, seasonPicker false)

It refuses to run (so it can never change your real site folder) unless the folder you start it from is a temporary copy: it
must be inside the computer's temporary folder, and, if it is a git folder, it must have no uncommitted changes. The base folder
you give it is only read; every copy is made in a new temporary folder, which is removed at the end (--keep keeps it).

What it runs for each combination (host choices and patch choices are taken from the header of every patch file):
  every combination   apply (git apply, strict), the rebuild commands, the rebuild repeated (must change nothing), i18n missing for
                      es hi zh vi and no loose text (orphans), tests public-site, docs and consistency, then tools/launch_check.py against
                      a pretend copy of the host
  --heavy pairs       the slower tests (pipeline, deploy, farm-seasons, live, dated) on a small set of combinations that together
                      put every pair of options side by side at least once; hero and features on the 3 most different ones
  --heavy all         the slower tests on every different set of files (hours)
  --heavy none        none of them

The pretend hosts are small web servers written in this file. They follow what the hosts' own documentation says (Cloudflare Pages
sends /x.html on to /x with a 308; Netlify and GitHub Pages show both; GitHub Pages ignores _headers and _redirects). With
--wrangler PATH, Cloudflare combinations use Cloudflare's own test server (wrangler pages dev) instead.

Needs Python 3.8 or newer and git. The tests need Node and the packages in tests/README.md (a missing browser shows as SKIP).
Exit code: 0 every combination passed, 1 something failed, 2 a wrong command or a refusal.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import hashlib
import http.server
import itertools
import json
import mimetypes
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import unquote, urlsplit

HOSTS = ['cloudflare', 'netlify', 'github']
HOST_NAMES = {'cloudflare': 'Cloudflare Pages', 'netlify': 'Netlify', 'github': 'GitHub Pages'}
PATCH_DIR = os.path.join('patches', 'optional')
REBUILD = [['tools/pages.py'], ['tools/i18n.py', 'extract'], ['tools/i18n.py', 'jsstrings'], ['tools/i18n.py', 'build']]
LANGS = ['es', 'hi', 'zh', 'vi']
CHEAP_TESTS = ['public-site', 'docs', 'consistency']
HEAVY_TESTS = ['pipeline', 'deploy', 'farm-seasons', 'live', 'dated']
EXTREME_TESTS = ['hero', 'features']
FILLED_TESTS = ['print-qr', 'messages']
COPY_SKIP = {'.git', 'node_modules', 'deploy', '__pycache__', '.visual', '.wrangler'}
OLD_ADDRESSES_KEPT = ['/wiseacres', '/faq', '/food', '/the-greenhouse', '/about', '/contact', '/flowers', '/schooltours', '/parties/']   # /summer/ and /posts/ are left out on purpose (decision D3)

# What "the owner filled in her settings" means (js/content.js): the values are made up, only their shape matters.
FILLED_SETTINGS = [
    (r"^  reviewUrl: '',", "  reviewUrl: 'https://g.page/r/CmatrixTest0000000/review',"),
    (r"^  farmPoint: null,", "  farmPoint: { lat: 35.0647, lon: -80.6670 },"),
    (r"^  signup: \{ action: '', interests: \{\}, tags: '', languageField: '' \},",
     "  signup: { action: 'https://example.us1.list-manage.com/subscribe/post?u=0123456789abcdef&id=0123456789', interests: {}, tags: '', languageField: 'MMERGE6' },"),
]


def say(msg=''):
    print(msg, flush=True)


class Refused(Exception):
    pass


# ------------------------------------------------------------------------------------------------ the patches
class Opt(object):
    def __init__(self, path):
        self.path = path
        self.file = os.path.basename(path)
        head = read_header(path)
        self.head = head
        self.id = head.get('Option', '')
        words = (head.get('Group') or self.id).split()
        self.group = words[0].lower() if words else ''
        self.order = int(re.match(r'\d+', head.get('Order', '99') or '99').group(0))
        self.profile = (head.get('Profile') or '').split()[0].lower() if (head.get('Profile') or '').split() else ''   # "filled": only tried in the settings-filled run
        self.conflicts = set(t for t in re.split(r'[\s,;]+', head.get('Conflicts', '')) if t and t.lower() not in ('none', 'nothing'))
        self.needs_files = re.findall(r'\b(?:tools|tests|js|css|docs|lang)/[\w./-]+\.\w+', head.get('Requires', ''))   # files a patch edits that must already be in the site
        text = head.get('Host', '')
        self.hosts = set(HOSTS) if re.match(r'\s*any\b', text, re.I) else set(h for h in HOSTS if h in text.lower())


def read_header(path):
    head = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith(('diff ', '--- ', '+++ ')):
                break
            m = re.match(r'^([A-Za-z]+):\s*(.*)$', line)
            if m:
                head[m.group(1)] = m.group(2).strip()
    return head


def load_options(base):
    folder = os.path.join(base, PATCH_DIR)
    if not os.path.isdir(folder):
        raise Refused('There is no %s in the base folder, so there is nothing to combine.' % PATCH_DIR)
    opts = []
    for name in sorted(os.listdir(folder)):
        if name.endswith('.patch'):
            o = Opt(os.path.join(folder, name))
            if not o.id or not o.hosts:
                raise Refused('%s has no usable "Option:" or "Host:" header line.' % name)
            opts.append(o)
    ids = [o.id for o in opts]
    if len(ids) != len(set(ids)):
        raise Refused('Two patches have the same Option: line.')
    waiting = [o for o in opts if any(not os.path.exists(os.path.join(base, f)) for f in o.needs_files)]
    for o in waiting:
        say('Left out: %s needs %s, which is not in this site yet.' % (o.id, ', '.join(f for f in o.needs_files if not os.path.exists(os.path.join(base, f)))))
    return sorted([o for o in opts if o not in waiting], key=lambda o: (o.order, o.id))


class Combo(object):
    def __init__(self, host, opts, settings='default'):
        self.host, self.opts, self.settings = host, list(opts), settings
        self.tree = tuple(o.id for o in self.opts)
        self.name = '+'.join([host] + (list(self.tree) or ['no-options'])) + ('@' + settings if settings != 'default' else '')
        self.extra_tests = []
        self.heavy = False


def all_combos(opts):
    opts = [o for o in opts if not o.profile]
    groups = {}
    for o in opts:
        groups.setdefault(o.group, []).append(o)
    out = []
    for host in HOSTS:
        for pick in itertools.product(*[[None] + g for g in groups.values()]):
            chosen = [o for o in pick if o]
            if any(host not in o.hosts for o in chosen):
                continue
            ids = set(o.id for o in chosen)
            if any(c in ids for o in chosen for c in o.conflicts):
                continue
            out.append(Combo(host, sorted(chosen, key=lambda o: (o.order, o.id))))
    return out


def trees_of(combos):
    seen, out = set(), []
    for c in combos:
        if c.tree not in seen:
            seen.add(c.tree)
            out.append(c)
    return out


def pair_cover(opts, combos):
    opts = [o for o in opts if not o.profile]
    """A small set of different sets of patches in which every pair of choices (including 'not chosen') meets at least once."""
    groups = []
    for o in opts:
        if o.group not in groups:
            groups.append(o.group)
    cand = []
    for c in trees_of(combos):
        ids = set(c.tree)
        row = []
        for g in groups:
            hit = [o.id for o in opts if o.group == g and o.id in ids]
            row.append(hit[0] if hit else None)
        cand.append((tuple(row), c))

    def pairs(row):
        return set((i, row[i], j, row[j]) for i in range(len(row)) for j in range(i + 1, len(row)))
    uncovered = set()
    for row, _ in cand:
        uncovered |= pairs(row)
    chosen = []
    while uncovered:
        row, c = max(cand, key=lambda rc: len(pairs(rc[0]) & uncovered))
        chosen.append(c)
        uncovered -= pairs(row)
    return chosen


def extreme_combos(opts, combos):
    """The 3 most different: nothing; the first choice of every group plus every single patch; the last choice of every group plus every single patch."""
    opts = [o for o in opts if not o.profile]
    groups = {}
    for o in opts:
        groups.setdefault(o.group, []).append(o)
    by_tree = {}
    for c in combos:
        by_tree.setdefault(c.tree, c)
    first = set(g[0].id for g in groups.values())
    last = set(g[-1].id for g in groups.values())
    out = []
    for ids in (set(), first, last):
        tree = tuple(o.id for o in opts if o.id in ids)
        c = by_tree.get(tree)
        if c is None:   # not allowed together: take the biggest allowed subset
            ok = [t for t in by_tree if set(t) <= ids]
            tree = max(ok, key=len) if ok else ()
            c = by_tree[tree]
        out.append(c)
    return out


# ------------------------------------------------------------------------------------------------ the guards
def is_under(path, parent):
    path, parent = os.path.realpath(path), os.path.realpath(parent)
    return path == parent or path.startswith(parent + os.sep)


def git_clean(folder):
    """None when the folder is not inside a git work tree, otherwise the list of changed files (empty = clean)."""
    try:
        r = subprocess.run(['git', '-C', folder, 'rev-parse', '--is-inside-work-tree'], capture_output=True, text=True)
    except OSError:
        return None
    if r.returncode != 0 or r.stdout.strip() != 'true':
        return None
    s = subprocess.run(['git', '-C', folder, 'status', '--porcelain'], capture_output=True, text=True)
    return [l for l in s.stdout.splitlines() if l.strip()]


def guard(base, cwd):
    tmp = tempfile.gettempdir()
    if not is_under(cwd, tmp):
        raise Refused('This folder is not a temporary copy: %s is not inside %s.\n'
                      'Make a clean copy first and start the program from there:\n'
                      '    D=$(mktemp -d) && git archive HEAD | tar -x -C "$D" && cd "$D"\n'
                      'Your real site folder is never touched by this program.' % (cwd, tmp))
    for label, folder in (('This folder', cwd), ('The base folder', base)):
        dirty = git_clean(folder)
        if dirty:
            raise Refused('%s has uncommitted changes (%d files, for example %s). The matrix tests what is committed: commit or stash first, or use a clean export.'
                          % (label, len(dirty), dirty[0].strip()))
    for must in ('tools/pages.py', 'tools/i18n.py', 'tests/run-all.mjs', 'js/content.js'):
        if not os.path.exists(os.path.join(base, must)):
            raise Refused('The base folder does not look like the website: %s is missing.' % must)


def base_label(base):
    r = subprocess.run(['git', '-C', base, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True)
    if r.returncode == 0 and git_clean(base) is not None:
        return 'git commit ' + r.stdout.strip()
    h = hashlib.sha256()
    for d, dirs, files in os.walk(base):
        dirs[:] = sorted(x for x in dirs if x not in COPY_SKIP)
        for f in sorted(files):
            p = os.path.join(d, f)
            h.update(os.path.relpath(p, base).encode())
            with open(p, 'rb') as fh:
                h.update(fh.read())
    return 'files fingerprint ' + h.hexdigest()[:12]


# ------------------------------------------------------------------------------------------------ pretend hosts
TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
}


def texty(ctype):
    return bool(re.match(r'(text/|application/(json|xml|manifest\+json)|image/svg)', ctype))


class PretendHost(object):
    """A small web server that answers like Cloudflare Pages, Netlify or GitHub Pages for the folder `root`."""

    def __init__(self, kind, root):
        self.kind, self.root = kind, root
        self.httpd = None
        self._rules = None
        self._redirects = None
        self.lock = threading.Lock()

    # -- the rule files
    def header_rules(self):
        if self.kind == 'github':
            return []
        if self._rules is None:
            rules, cur = [], None
            try:
                text = open(os.path.join(self.root, '_headers'), encoding='utf-8').read()
            except OSError:
                text = ''
            for line in text.split('\n'):
                if not line.strip() or line.strip().startswith('#'):
                    continue
                if re.match(r'\S', line):
                    pat = re.escape(line.strip()).replace(r'\*', '.*')
                    pat = re.sub(r'\\:[A-Za-z_]+', '[^/]+', pat)
                    cur = (re.compile('^' + pat + '$'), {})
                    rules.append(cur)
                elif cur and ':' in line:
                    k, v = line.split(':', 1)
                    cur[1][k.strip()] = v.strip()
            self._rules = rules
        return self._rules

    def redirect_rules(self):
        if self.kind == 'github':
            return []
        if self._redirects is None:
            rules = []
            try:
                text = open(os.path.join(self.root, '_redirects'), encoding='utf-8').read()
            except OSError:
                text = ''
            for line in text.split('\n'):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split()
                if len(parts) < 2:
                    continue
                status = int(parts[2].rstrip('!')) if len(parts) > 2 and re.match(r'^\d+!?$', parts[2]) else (302 if self.kind == 'cloudflare' else 301)
                rules.append((parts[0], parts[1], status))
            self._redirects = rules
        return self._redirects

    def redirect_for(self, path):
        for src, dst, status in self.redirect_rules():
            if '*' in src:
                m = re.match('^' + re.escape(src).replace(r'\*', '(.*)') + '$', path)
                if m:
                    return status, dst.replace(':splat', m.group(1))
            elif src == path or (self.kind == 'netlify' and src.rstrip('/') == path.rstrip('/') and path != '/'):
                return status, dst
        return None

    # -- the files
    def is_file(self, path):
        full = os.path.join(self.root, path.lstrip('/'))
        return os.path.isfile(full) and '..' not in path.split('/')

    def is_dir_with_index(self, path):
        full = os.path.join(self.root, path.strip('/'))
        return os.path.isfile(os.path.join(full, 'index.html')) and '..' not in path.split('/')

    def resolve(self, path):
        """('redirect', status, new path) or ('file', status, file path)."""
        kind = self.kind
        if kind != 'github':
            hit = self.redirect_for(path)
            if hit and not (kind == 'netlify' and self.is_file(path)):   # Netlify: a rule never covers a real file unless it ends in !
                return ('redirect', hit[0], hit[1])
        if kind == 'cloudflare':
            if path.endswith('/index.html'):
                return ('redirect', 308, path[:-len('index.html')])
            if path.endswith('.html') and self.is_file(path):
                return ('redirect', 308, path[:-len('.html')])
            if path != '/' and path.endswith('/') and not self.is_dir_with_index(path) and self.is_file(path[:-1] + '.html'):
                return ('redirect', 308, path[:-1])
        if path.endswith('/'):
            if self.is_file(path + 'index.html'):
                return ('file', 200, os.path.join(self.root, path.strip('/'), 'index.html'))
        elif self.is_file(path):
            return ('file', 200, os.path.join(self.root, path.lstrip('/')))
        elif self.is_file(path + '.html'):
            return ('file', 200, os.path.join(self.root, path.lstrip('/') + '.html'))
        elif self.is_dir_with_index(path):
            return ('redirect', 308 if kind == 'cloudflare' else 301, path + '/')
        nf = os.path.join(self.root, '404.html')
        return ('file', 404, nf if os.path.isfile(nf) else None)

    def answer(self, method, target, accept_encoding):
        sp = urlsplit(target)
        try:
            path = unquote(sp.path)
        except Exception:
            return 400, {}, b''
        res = self.resolve(path)
        fingerprints = {'cloudflare': {'Server': 'cloudflare', 'CF-RAY': '0000000000000000-AMS'}, 'netlify': {'Server': 'Netlify', 'X-NF-Request-ID': '01TESTHOST'},
                        'github': {'Server': 'GitHub.com', 'X-GitHub-Request-Id': 'TEST:0000'}}[self.kind]
        headers = dict(fingerprints)
        if res[0] == 'redirect':
            loc = res[2] + (('?' + sp.query) if sp.query and '?' not in res[2] else '')
            headers['Location'] = loc
            headers['Content-Length'] = '0'
            return res[1], headers, b''
        status, fpath = res[1], res[2]
        body = open(fpath, 'rb').read() if fpath else b'Not found'
        ext = os.path.splitext(fpath or '.txt')[1].lower()
        ctype = TYPES.get(ext) or mimetypes.guess_type(fpath or 'x.txt')[0] or 'application/octet-stream'
        headers['Content-Type'] = ctype
        headers['Cache-Control'] = 'max-age=600' if self.kind == 'github' else 'public, max-age=0, must-revalidate'
        for rx, hs in self.header_rules():
            if rx.match(path):
                headers.update(hs)
        if texty(ctype) and 'gzip' in (accept_encoding or ''):
            body = gzip.compress(body, 6, mtime=0)
            headers['Content-Encoding'] = 'gzip'
            headers['Vary'] = 'Accept-Encoding'
        headers['Content-Length'] = str(len(body))
        return status, headers, body

    # -- the server
    def start(self):
        host = self

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.1'

            def log_message(self, *a):
                pass

            def serve(self, head):
                status, headers, body = host.answer(self.command, self.path, self.headers.get('Accept-Encoding', ''))
                self.send_response(status)
                for k, v in headers.items():
                    self.send_header(k, v)
                self.end_headers()
                if not head:
                    self.wfile.write(body)

            def do_GET(self):
                self.serve(False)

            def do_HEAD(self):
                self.serve(True)

        class Server(http.server.ThreadingHTTPServer):
            daemon_threads = True

        self.httpd = Server(('127.0.0.1', 0), Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.origin = 'http://127.0.0.1:%d' % self.port
        return self

    def stop(self):
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()


class WranglerHost(object):
    """Cloudflare's own test server (wrangler pages dev), for the Cloudflare combinations when --wrangler PATH is given."""

    def __init__(self, root, wrangler, state):
        self.root, self.wrangler, self.state = root, wrangler, state
        self.proc = None

    def start(self):
        s = socket.socket()
        s.bind(('127.0.0.1', 0))
        self.port = s.getsockname()[1]
        s.close()
        os.makedirs(self.state, exist_ok=True)
        env = dict(os.environ, WRANGLER_SEND_METRICS='false', CI='1', NO_COLOR='1')
        self.log = open(os.path.join(self.state, 'wrangler.log'), 'wb')
        self.proc = subprocess.Popen([self.wrangler, 'pages', 'dev', self.root, '--port', str(self.port), '--ip', '127.0.0.1', '--persist-to', os.path.join(self.state, 'p')],
                                     cwd=self.state, env=env, stdout=self.log, stderr=subprocess.STDOUT, preexec_fn=getattr(os, 'setsid', None))
        end = time.time() + 90
        while time.time() < end:
            try:
                socket.create_connection(('127.0.0.1', self.port), 1).close()
                break
            except OSError:
                if self.proc.poll() is not None:
                    raise RuntimeError('wrangler stopped at once (see %s)' % os.path.join(self.state, 'wrangler.log'))
                time.sleep(0.5)
        else:
            raise RuntimeError('wrangler did not start within 90 seconds')
        self.origin = 'http://127.0.0.1:%d' % self.port
        return self

    def stop(self):
        if self.proc and self.proc.poll() is None:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
            except Exception:
                self.proc.terminate()
            try:
                self.proc.wait(10)
            except Exception:
                self.proc.kill()


# ------------------------------------------------------------------------------------------------ one combination
def run(cmd, cwd, timeout=900, env=None):
    t0 = time.time()
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=env)
        return r.returncode, (r.stdout or '') + (r.stderr or ''), time.time() - t0
    except subprocess.TimeoutExpired as e:
        return 124, 'TIMEOUT after %d s. %s' % (timeout, (e.stdout or b'')[-300:] if isinstance(e.stdout, bytes) else ''), time.time() - t0
    except OSError as e:
        return 127, 'could not start %s: %s' % (cmd[0], e), time.time() - t0


def tree_hash(root):
    h = hashlib.sha256()
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if x not in COPY_SKIP)
        for f in sorted(files):
            p = os.path.join(d, f)
            h.update(os.path.relpath(p, root).encode())
            with open(p, 'rb') as fh:
                h.update(fh.read())
    return h.hexdigest()


def parse_run_all(text):
    """The summary lines of tests/run-all.mjs -> {test: {'status', 'detail', 'secs', 'passed', 'failed'}}."""
    out = {}
    lines = [l.split('\r')[-1] for l in text.split('\n')]
    for i, line in enumerate(lines):
        m = re.match(r'^(PASS|FAIL|SKIP)\s+(\S+)\s+(.*?)(?:\s+\((\d+)s\))?\s*$', line)
        if not m:
            continue
        status, name, rest, secs = m.group(1), m.group(2), m.group(3), m.group(4)
        detail = rest
        if status == 'FAIL':
            nxt = [l.strip() for l in lines[i + 1:i + 14] if l.startswith('      ')]
            detail = (nxt[0] if nxt else rest)
        pm = re.match(r'(\d+) passed(?:, (\d+) FAILED)?', rest)
        out[name] = {'status': status, 'detail': detail[:300], 'secs': int(secs or 0), 'passed': int(pm.group(1)) if pm else 0, 'failed': int(pm.group(2) or 0) if pm else 0}
    return out


class Matrix(object):
    def __init__(self, args, base, opts):
        self.a, self.base, self.opts = args, base, opts
        self.out = args.out_dir
        self.work = os.path.join(self.out, 'work')
        self.logs = os.path.join(self.out, 'logs')
        os.makedirs(self.work, exist_ok=True)
        os.makedirs(self.logs, exist_ok=True)
        self.missing_cache = {}
        self.cache_lock = threading.Lock()
        self.py = sys.executable
        self.env = dict(os.environ)
        self.env.setdefault('WA_PYTHON', self.py)
        if args.node_path:
            self.env['NODE_PATH'] = args.node_path
        self.counter = 0
        self.stop = False

    # ---- helpers
    def log(self, combo, step, text):
        fn = re.sub(r'[^A-Za-z0-9_.+@-]', '_', combo.name)
        with open(os.path.join(self.logs, fn + '.log'), 'a', encoding='utf-8') as f:
            f.write('==== %s\n%s\n' % (step, text.rstrip()[-6000:]))

    def new_dir(self, combo):
        with self.cache_lock:
            self.counter += 1
            n = self.counter
        d = os.path.join(self.work, '%03d' % n)
        shutil.copytree(self.base, d, ignore=shutil.ignore_patterns(*sorted(COPY_SKIP)))
        return d

    def step(self, res, combo, name, fn):
        t0 = time.time()
        try:
            ok, detail = fn()
        except Exception as e:   # a harness bug must show up as a FAIL, never as a pass
            ok, detail = False, 'the matrix program hit an error: %s: %s' % (type(e).__name__, e)
        res['steps'].append({'name': name, 'status': 'PASS' if ok is True else ('SKIP' if ok is None else 'FAIL'), 'detail': detail, 'secs': round(time.time() - t0, 1)})
        self.log(combo, name, '%s: %s' % ('PASS' if ok is True else ('SKIP' if ok is None else 'FAIL'), detail))
        return ok

    # ---- the steps
    def apply(self, combo, d):
        for o in combo.opts:
            code, out, _ = run(['git', 'apply', '--whitespace=nowarn', os.path.join(d, PATCH_DIR, o.file)], d, 120)
            if code != 0:
                return False, '%s does not apply here: %s' % (o.file, ' '.join(out.split())[:200])
        return True, '%d patch%s applied (git apply, no fuzz)' % (len(combo.opts), '' if len(combo.opts) == 1 else 'es')

    def settings(self, combo, d):
        p = os.path.join(d, 'js', 'content.js')
        s = open(p, encoding='utf-8').read()
        for rx, new in FILLED_SETTINGS:
            s2, n = re.subn(rx, new.replace('\\', r'\\'), s, count=1, flags=re.M)
            if n != 1:
                return False, 'the settings line %r is not in js/content.js any more: the matrix needs updating' % rx[:40]
            s = s2
        open(p, 'w', encoding='utf-8', newline='\n').write(s)
        return True, 'reviewUrl, farmPoint, signup action and languageField filled in (made-up values); seasonPicker false comes from its patch'

    def rebuild(self, d, with_qr=False):
        cmds = [list(c) for c in REBUILD] + ([['tools/make_qr.py']] if with_qr else [])
        for c in cmds:
            code, out, _ = run([self.py] + c, d, 300)
            if code != 0:
                return False, '%s failed: %s' % (' '.join(c), ' '.join(out.split())[-250:])
        return True, 'rebuild done'

    def rebuild_stable(self, d):
        before = tree_hash(d)
        ok, detail = self.rebuild(d)
        if not ok:
            return ok, detail
        after = tree_hash(d)
        if before != after:
            return False, 'running the rebuild commands again changed files (the patch left something out of date)'
        return True, 'a second rebuild changes nothing'

    def missing(self, d):
        h = hashlib.sha256()
        for rel in ['lang/en.json', 'lang/js-strings.json'] + ['lang/src/%s.json' % l for l in LANGS]:
            with open(os.path.join(d, rel), 'rb') as f:
                h.update(f.read())
        key = h.hexdigest()
        with self.cache_lock:
            if key in self.missing_cache:
                return self.missing_cache[key]
        bad = []
        for lang in LANGS:
            code, out, _ = run([self.py, 'tools/i18n.py', 'missing', lang], d, 120)
            if not re.search(r', 0 missing, .*JavaScript: 0 missing', out):
                bad.append('%s: %s' % (lang, ' '.join(out.split())[:160]))
        res = (False, 'translations missing: ' + ' | '.join(bad)) if bad else (True, 'no translation missing in es, hi, zh, vi')
        with self.cache_lock:
            self.missing_cache[key] = res
        return res

    def orphans(self, d):
        code, out, _ = run([self.py, 'tools/i18n.py', 'orphans'], d, 120)
        if code != 0 or out.strip():
            return False, 'text without a translation id (orphans): ' + ' '.join(out.split())[:200]
        return True, 'no loose text left out of the translations'

    def tests(self, d, names, timeout):
        code, out, secs = run(['node', 'tests/run-all.mjs'] + names, d, timeout, self.env)
        if code == 127:
            return None, {}, 'node is not available'
        got = parse_run_all(out)
        return code, got, out

    def run_tests(self, res, combo, d, names, timeout=1500):
        code, got, out = self.tests(d, names, timeout)
        self.log(combo, 'tests ' + ' '.join(names), out if isinstance(out, str) else '')
        for n in names:
            g = got.get(n)
            if code is None:
                res['steps'].append({'name': n, 'status': 'SKIP', 'detail': 'node is not available', 'secs': 0})
            elif g is None:
                res['steps'].append({'name': n, 'status': 'FAIL', 'detail': 'the test did not report (run-all output: %s)' % ' '.join(str(out).split())[-200:], 'secs': 0})
            else:
                res['steps'].append({'name': n, 'status': g['status'], 'detail': g['detail'] if g['status'] != 'PASS' else '%d checks' % g['passed'], 'secs': g['secs']})

    def launch_check(self, combo, d):
        if not os.path.exists(os.path.join(d, 'tools', 'launch_check.py')):
            return None, 'tools/launch_check.py is not in this site yet, so the host check was skipped'
        site = os.path.join(os.path.dirname(d), os.path.basename(d) + '-site-' + combo.host)
        code, out, _ = run([self.py, 'tools/make_deploy_folder.py', '--no-rebuild', '--out', site], d, 300)
        if code != 0:
            return False, 'make_deploy_folder.py failed: ' + ' '.join(out.split())[-250:]
        host = None
        try:
            if combo.host == 'cloudflare' and self.a.wrangler:
                host = WranglerHost(site, self.a.wrangler, os.path.join(os.path.dirname(d), os.path.basename(d) + '-wrangler-' + combo.host)).start()
            else:
                host = PretendHost(combo.host, site).start()
            site_url = re.search(r"^SITE = '([^']+)'", open(os.path.join(d, 'tools', 'pages.py'), encoding='utf-8').read(), re.M).group(1).rstrip('/')
            for dp, _, files in os.walk(site):   # what a deploy to this address would look like
                for f in files:
                    if f.endswith(('.html', '.xml', '.txt')):
                        p = os.path.join(dp, f)
                        t = open(p, encoding='utf-8').read()
                        if site_url in t:
                            open(p, 'w', encoding='utf-8', newline='\n').write(t.replace(site_url, host.origin))
            code, out, _ = run([self.py, 'tools/launch_check.py', host.origin + '/', '--json', '--timeout', '20'], d, 600)
            try:
                j = json.loads(out)
            except ValueError:
                return False, 'launch_check.py gave no result (exit code %d): %s' % (code, ' '.join(out.split())[:200])
        finally:
            if host:
                host.stop()
        self.log(combo, 'launch_check results', '\n'.join('%s %s %s' % (r['level'], r['key'], r['message'][:160]) for r in j['results']))
        fails = [r for r in j['results'] if r['level'] == 'FAIL']
        if fails:
            return False, 'FAIL %s: %s' % (fails[0]['key'], fails[0]['message'][:170])
        ids = set(o.id for o in combo.opts)
        by = dict()
        for r in j['results']:
            by.setdefault(r['key'], []).append(r)
        if ids & set(['redirects-A', 'redirects-B']):
            hit = [r for r in by.get('old-redirects', []) if r['level'] == 'PASS']
            if not hit:
                seen = ', '.join(r['level'] for r in by.get('old-redirects', [])) or 'missing'
                return False, 'a redirects patch is on, but the check does not see the old addresses forwarded (old-redirects is %s)' % seen
            lost = [p for p in OLD_ADDRESSES_KEPT if (p + ' ->') not in hit[0]['message']]
            if lost:
                return False, 'old addresses not forwarded: %s' % ', '.join(lost)
        if ids & set(['clean-addresses-C']) and not [r for r in by.get('pages-200', []) if r['level'] == 'PASS']:
            return False, 'clean addresses are on, but pages-200 is not PASS'
        c = j['counts']
        return True, '0 FAIL, %d WARN, %d PASS on a pretend %s' % (c['warn'], c['pass'], HOST_NAMES[combo.host] if not (combo.host == 'cloudflare' and self.a.wrangler) else 'Cloudflare (wrangler)')

    # ---- the whole cheap tier for the combinations that share one set of patches (everything but the host check is the same for them)
    def cheap_group(self, group):
        first = group[0]
        common = {'steps': []}
        t0 = time.time()
        d = self.new_dir(first)
        stop = False
        if not self.step(common, first, 'apply', lambda: self.apply(first, d)):
            stop = True
        if not stop and first.settings == 'filled':
            self.step(common, first, 'settings', lambda: self.settings(first, d))
        if not stop and not self.step(common, first, 'rebuild', lambda: self.rebuild(d, with_qr=first.settings == 'filled')):
            stop = True
        if not stop:
            self.step(common, first, 'rebuild-stable', lambda: self.rebuild_stable(d))
            self.step(common, first, 'missing', lambda: self.missing(d))
            self.step(common, first, 'orphans', lambda: self.orphans(d))
            names = [t for t in CHEAP_TESTS if os.path.exists(os.path.join(d, 'tests', t + '.test.mjs'))]   # docs: only in a site that has the docs test
            # the docs name reviewUrl, farmPoint and signup.action by the setting's name, not by today's empty value, so the docs test runs with them filled in too
            self.run_tests(common, first, d, names, 300)
        out = []
        for c in group:
            res = {'name': c.name, 'host': c.host, 'options': list(c.tree), 'settings': c.settings, 'steps': [dict(x) for x in common['steps']], 'dir': d}
            if c is not first:
                for st in res['steps']:
                    self.log(c, st['name'], '%s: %s (same as for %s)' % (st['status'], st['detail'], first.name))
            if not stop:
                self.step(res, c, 'launch-check', lambda c=c: self.launch_check(c, d))
            res['secs'] = round(time.time() - t0)
            out.append((c, res))
        return out, d

    def heavy(self, res, combo, d):
        names = list(HEAVY_TESTS) + list(combo.extra_tests)
        self.run_tests(res, combo, d, names, 3600)


def verdict(res):
    bad = [s for s in res['steps'] if s['status'] == 'FAIL']
    if bad:
        return 'FAIL', '%s: %s' % (bad[0]['name'], bad[0]['detail'])
    if any(s['status'] == 'SKIP' for s in res['steps']):
        s = [s for s in res['steps'] if s['status'] == 'SKIP'][0]
        return 'PASS', '(%s skipped: %s)' % (s['name'], s['detail'][:60])
    return 'PASS', ''


def main(argv=None):
    ap = argparse.ArgumentParser(description='Try the optional patches together on throw-away copies of the site.', formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog='See the top of this file (or README.md, "Trying the optional patches together") for what is run.')
    ap.add_argument('base', nargs='?', default='.', help='a clean copy of the site (default: the current folder)')
    ap.add_argument('--list', action='store_true', help='only list the combinations')
    ap.add_argument('--only', action='append', default=[], help='only combinations whose name contains all of these words (comma separated), for example cloudflare,winter-A; give --only again for "or"')
    ap.add_argument('--heavy', choices=['pairs', 'all', 'none'], default='pairs', help='which combinations get the slower tests (default: pairs)')
    ap.add_argument('--only-heavy', action='store_true', help='only the combinations that get the slower tests (a quick way to run just those)')
    ap.add_argument('--settings', choices=['default', 'filled', 'both'], default='default', help='filled: the 3 most different combinations with reviewUrl, farmPoint, signup (and languageField) filled in and seasonPicker false')
    ap.add_argument('--jobs', type=int, default=2, help='how many combinations to prepare at the same time (default 2; the browser tests always run one at a time)')
    ap.add_argument('--wrangler', default='', help='path to wrangler: Cloudflare combinations then use its own test server')
    ap.add_argument('--node-path', default='', help='value for NODE_PATH when the tests cannot find playwright')
    ap.add_argument('--out-dir', default='', help='where to write RESULTS.txt, results.json and logs (default: a new temporary folder)')
    ap.add_argument('--keep', action='store_true', help='keep the copies after the run')
    a = ap.parse_args(argv)

    base = os.path.realpath(a.base)
    cwd = os.path.realpath(os.getcwd())
    try:
        if not a.list:
            guard(base, cwd)
        opts = load_options(base)
        if not os.path.isdir(os.path.join(base, 'tools')):
            raise Refused('The base folder does not look like the website: there is no tools/ folder.')
    except Refused as e:
        say('REFUSED: %s' % e)
        return 2
    if sys.version_info < (3, 8):
        say('Python 3.8 or newer is needed.')
        return 2

    combos = all_combos(opts)
    cover = pair_cover(opts, combos)
    extremes = extreme_combos(opts, combos)
    heavy_trees = set(c.tree for c in cover) | set(c.tree for c in extremes)
    if a.heavy == 'all':
        heavy_trees = set(c.tree for c in combos)
    if a.heavy == 'none':
        heavy_trees = set()
    chosen = []
    if a.settings in ('default', 'both'):
        chosen += combos
    if a.settings in ('filled', 'both'):
        for e in extremes:
            extra = [o for o in opts if o.profile == 'filled' and e.host in o.hosts and not any(c in set(x.id for x in e.opts) for c in o.conflicts)]
            f = Combo(e.host, sorted(e.opts + extra, key=lambda o: (o.order, o.id)), 'filled')
            f.heavy = True
            f.extra_tests = list(EXTREME_TESTS) + list(FILLED_TESTS)
            chosen.append(f)
    wanted = [[t.strip() for t in spec.split(',') if t.strip()] for spec in a.only]
    wanted = [w for w in wanted if w]
    if wanted:
        chosen = [c for c in chosen if any(all(t in c.name for t in w) for w in wanted)]
    seen_tree = set()
    for c in chosen:   # one combination per different set of patches gets the slower tests (the first one, so Cloudflare where it is allowed)
        if c.settings == 'default' and c.tree in heavy_trees and c.tree not in seen_tree:
            seen_tree.add(c.tree)
            c.heavy = True
            if c.tree in set(e.tree for e in extremes):
                c.extra_tests = list(EXTREME_TESTS)
    if a.only_heavy:
        chosen = [c for c in chosen if c.heavy]
    if not chosen:
        say('No combination matches.')
        return 2

    if a.list:
        say('%d combinations (%d different sets of patches) from %d patch files in %s:' % (len(chosen), len(set(c.tree for c in chosen)), len(opts), PATCH_DIR))
        for o in opts:
            say('  %-20s group %-10s hosts %-28s %s%s' % (o.id, o.group, ','.join(sorted(o.hosts)), o.file, '   (only in the --settings filled run)' if o.profile else ''))
        say('')
        for c in chosen:
            say('%s%s' % (c.name, '   [slower tests%s]' % (' + ' + ' '.join(c.extra_tests) if c.extra_tests else '') if c.heavy else ''))
        return 0

    a.out_dir = os.path.realpath(a.out_dir) if a.out_dir else tempfile.mkdtemp(prefix='option-matrix-')
    os.makedirs(a.out_dir, exist_ok=True)
    if is_under(a.out_dir, base) or is_under(base, a.out_dir):
        say('REFUSED: the results folder %s and the base folder %s overlap.' % (a.out_dir, base))
        return 2
    m = Matrix(a, base, opts)
    say('Base: %s (%s)' % (base, base_label(base)))
    say('%d combinations, %d with the slower tests. Results and logs: %s' % (len(chosen), len([c for c in chosen if c.heavy]), a.out_dir))
    results, kept = [], {}
    t0 = time.time()
    lock = threading.Lock()

    groups_run = {}
    for c in chosen:
        groups_run.setdefault((c.tree, c.settings), []).append(c)

    def work(group):
        if m.stop:
            return None
        try:
            done, d = m.cheap_group(group)
        except Exception as e:
            done, d = [(c, {'name': c.name, 'host': c.host, 'options': list(c.tree), 'settings': c.settings, 'steps': [{'name': 'matrix', 'status': 'FAIL', 'detail': 'the matrix program hit an error: %s: %s' % (type(e).__name__, e), 'secs': 0}]}) for c in group], None
        with lock:
            for c, r in done:
                v, why = verdict(r)
                say('%s  %-70s %s' % (v, c.name, why[:150]))
                results.append((c, r))
            keep = [c for c, _ in done if c.heavy]
            if keep and d:
                kept[keep[0].name] = d
            elif d and not a.keep:
                shutil.rmtree(d, ignore_errors=True)
                for h in HOSTS:
                    shutil.rmtree(d + '-site-' + h, ignore_errors=True)
        return done

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, a.jobs)) as ex:
            list(ex.map(work, list(groups_run.values())))
        # the slower tests, one combination at a time (they open browsers)
        heavies = [(c, r) for c, r in results if c.heavy and c.name in kept and not any(s['name'] in ('apply', 'rebuild') and s['status'] == 'FAIL' for s in r['steps'])]
        if heavies:
            say('')
            say('Slower tests on %d combinations (one at a time):' % len(heavies))
        for c, r in heavies:
            m.heavy(r, c, kept[c.name])
            v, why = verdict(r)
            say('%s  %-70s %s' % (v, c.name, why[:150]))
            if not a.keep:
                shutil.rmtree(kept[c.name], ignore_errors=True)
                for h in HOSTS:
                    shutil.rmtree(kept[c.name] + '-site-' + h, ignore_errors=True)
    except KeyboardInterrupt:
        m.stop = True
        say('Stopped.')

    # ---- the report
    order = {c.name: i for i, c in enumerate(chosen)}
    results.sort(key=lambda cr: order[cr[0].name])
    lines = []
    lines.append('OPTION MATRIX  base %s  %s' % (base_label(base), time.strftime('%Y-%m-%d %H:%M')))
    lines.append('%d combinations, %d seconds. PASS = every check that ran passed. The checks are listed per combination in logs/ and results.json.' % (len(results), time.time() - t0))
    lines.append('')
    lines.append('%-5s %-11s %-9s %-62s %s' % ('', 'host', 'settings', 'options', 'first failing check'))
    nfail = 0
    for c, r in results:
        v, why = verdict(r)
        nfail += v == 'FAIL'
        tag = v + ('+' if c.heavy and v == 'PASS' and any(s['name'] in HEAVY_TESTS for s in r['steps']) else '')
        lines.append('%-5s %-11s %-9s %-62s %s' % (tag, c.host, c.settings, ' '.join(c.tree) or '(no options)', why[:200]))
    lines.append('')
    if any(c.heavy for c, _ in results):
        lines.append('PASS+ = the slower tests (%s) ran too; hero and features ran on the 3 most different.' % ', '.join(HEAVY_TESTS))
    slow = [(c, r) for c, r in results if any(st['name'] in HEAVY_TESTS for st in r['steps'])]
    if slow:
        lines.append('')
        lines.append('THE SLOWER TESTS (every check of the combination, including the cheap ones above):')
        for c, r in slow:
            names = [st for st in r['steps'] if st['name'] in HEAVY_TESTS + EXTREME_TESTS + FILLED_TESTS]
            lines.append('  %s' % c.name)
            lines.append('      ' + ', '.join('%s %s%s' % (st['name'], st['status'], (' (' + st['detail'] + ')') if st['status'] == 'PASS' and st['detail'] else '') for st in names))
            for st in names:
                if st['status'] == 'FAIL':
                    lines.append('      FAIL %s: %s' % (st['name'], st['detail'][:200]))
    groups = {}
    for c, r in results:
        v, why = verdict(r)
        if v == 'FAIL':
            key = re.sub(r'127\.0\.0\.1:\d+', 'HOST', why)[:110]
            groups.setdefault(key, []).append(c)
    if groups:
        lines.append('')
        lines.append('FAILURES, grouped by the first failing check:')
        for k, v in sorted(groups.items(), key=lambda kv: -len(kv[1])):
            lines.append('  %3d x %s' % (len(v), k))
    lines.append('')
    lines.append('%d PASS, %d FAIL.' % (len(results) - nfail, nfail))
    text = '\n'.join(lines)
    with open(os.path.join(a.out_dir, 'RESULTS.txt'), 'w', encoding='utf-8') as f:
        f.write(text + '\n')
    with open(os.path.join(a.out_dir, 'results.json'), 'w', encoding='utf-8') as f:
        json.dump([r for _, r in results], f, indent=1)
    say('')
    say(text)
    if not a.keep:
        shutil.rmtree(m.work, ignore_errors=True)
    return 1 if nfail else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except BrokenPipeError:
        sys.exit(1)
