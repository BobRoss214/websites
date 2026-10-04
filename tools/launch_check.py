#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Launch-day check for the Wise Acres website.

It opens the live address the way a visitor's browser does and tells you, in plain words, what works (PASS), what
needs a decision or a setting from you (WARN) and what is broken (FAIL). Nothing is changed and nothing is sent
anywhere except ordinary page requests to the address you give it.

    python3 tools/launch_check.py https://www.wiseacresorganic.com/
    python3 tools/launch_check.py http://127.0.0.1:8000/          (a practice run on your own computer)

Options:   --quick     only the pages and the headers (about 10 seconds)
           --json      print the result as JSON (for other programs) instead of text
           --live      treat the address as the real site even if it is on this computer (a rehearsal)
           --insecure  do not check the padlock (HTTPS certificate); only for a test address
           --timeout N seconds to wait for each answer (default 20)

The exit code is 0 when there is no FAIL, 1 when something FAILED (or the address does not answer), 2 for a wrong command.
Needs Python 3.8 or newer and nothing else (no installs). Works on Windows, macOS and Linux.
"""
from __future__ import annotations

import argparse
import gzip
import functools
import http.client
import ipaddress
import json
import os
import random
import re
import socket
import ssl
import struct
import sys
import textwrap
import threading
import time
import zlib
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from html.parser import HTMLParser
from urllib.parse import quote, urldefrag, urljoin, urlsplit

VERSION = '1.0'
UA = 'WiseAcresLaunchCheck/' + VERSION + ' (the owner checking her own site)'
PASS, WARN, FAIL = 'PASS', 'WARN', 'FAIL'

# Old addresses of the farm's previous website (docs/LAUNCH_CHECKLIST.md, step 3.6). Redirecting them is the owner's decision.
OLD_ADDRESSES = ['/wiseacres', '/faq', '/food', '/the-greenhouse', '/about', '/contact', '/flowers', '/schooltours', '/parties/', '/summer/', '/posts/']

# What the host should say for each kind of file. FAIL kinds break the page when the type is wrong (the browser refuses the file).
EXPECT_TYPE = {
    '.html': ('text/html',), '.css': ('text/css',), '.js': ('text/javascript', 'application/javascript', 'application/x-javascript'),
    '.json': ('application/json',), '.svg': ('image/svg+xml',), '.woff2': ('font/woff2', 'application/font-woff2', 'application/x-font-woff2'),
    '.webp': ('image/webp',), '.png': ('image/png',), '.jpg': ('image/jpeg',), '.jpeg': ('image/jpeg',), '.ico': ('image/x-icon', 'image/vnd.microsoft.icon', 'image/ico'),
    '.webmanifest': ('application/manifest+json', 'application/json'), '.xml': ('application/xml', 'text/xml'), '.txt': ('text/plain',),
}
HARD_TYPES = {'.html', '.css', '.js', '.svg'}
TEXT_EXT = {'.html', '.css', '.js', '.json', '.svg', '.webmanifest', '.xml', '.txt'}
SECURITY_HEADERS = [
    ('x-content-type-options', 'X-Content-Type-Options: nosniff', lambda v: 'nosniff' in v.lower()),
    ('referrer-policy', 'Referrer-Policy', lambda v: bool(v.strip())),
    ('x-frame-options', 'X-Frame-Options (or a frame-ancestors rule)', lambda v: bool(v.strip())),
    ('permissions-policy', 'Permissions-Policy', lambda v: bool(v.strip())),
]
FORBIDDEN_IN_SITEMAP = ('/tests/', '/docs/', '/print/', '/tools/', '/pages/', '/lang/', '/404')
EXPOSED_TEST_PATHS = ['/docs/LAUNCH_CHECKLIST.md', '/docs/QUESTIONS_FOR_THE_FARM.md', '/tests/README.md', '/tools/pages.py', '/README.md']


# ------------------------------------------------------------------------------------------------ small helpers
def human(n):
    n = float(n)
    if n < 1024:
        return '%d bytes' % n
    if n < 1024 * 1024:
        return '%.0f KB' % (n / 1024)
    return '%.1f MB' % (n / 1024 / 1024)


def is_local_host(host):
    h = (host or '').lower()
    if h in ('localhost', '::1') or h.endswith('.localhost') or h.endswith('.local'):
        return True
    m = re.match(r'^(\d+)\.(\d+)\.(\d+)\.(\d+)$', h)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return a == 127 or a == 10 or (a == 192 and b == 168) or (a == 172 and 16 <= b <= 31)
    return False


@functools.lru_cache(maxsize=256)   # one look-up for each name, not one for every page of the check
def private_address(host):
    """True when the name is, or points to, an address inside a private network or this computer (127.x, 10.x, 192.168.x, 169.254.x, fe80::, ::1...).
    A site on the internet that sends the check there (a redirect) is not followed: that is how a page makes a program fetch things from the
    router or the company network. A name that cannot be looked up is not private: the fetch then fails with its own message."""
    host = (host or '').strip('[]')
    try:
        found = [ipaddress.ip_address(host.split('%')[0])]
    except ValueError:
        try:
            found = [ipaddress.ip_address(a[4][0].split('%')[0]) for a in socket.getaddrinfo(host, None)]
        except (OSError, ValueError, UnicodeError):
            return False
    return any((not a.is_global) or a.is_multicast for a in found)   # not a public address: private, this computer, link-local, shared (100.64/10), reserved


def origin_of(url):
    sp = urlsplit(url)
    return '%s://%s' % (sp.scheme, sp.netloc.lower())


def without_login(address):
    """What was typed as an address with any user name and password taken out (name:secret@host): this tool never needs one and must never print one."""
    return re.sub(r'(?i)^(\s*(?:[a-z][a-z0-9+.-]*://)?)[^/?#\s]*@', r'\1', address)


def ext_of(url):
    path = urlsplit(url).path
    base = path.rsplit('/', 1)[-1]
    return ('.' + base.rsplit('.', 1)[-1].lower()) if '.' in base else ''


def gzip_size(data):
    try:
        return len(gzip.compress(data, 6))
    except Exception:
        return len(data)


# ------------------------------------------------------------------------------------------------ fetching
class FetchError(Exception):
    def __init__(self, kind, message):
        Exception.__init__(self, message)
        self.kind = kind
        self.message = message


class Resp(object):
    def __init__(self, url):
        self.url = url
        self.status = 0
        self.headers = {}
        self.body = b''
        self.wire = 0
        self.ttfb = 0.0
        self.total = 0.0
        self.encoding = ''
        self.undecoded = False
        self.truncated = False   # the answer was longer than the limit (or unpacked to more than it): only the first part was kept

    def header(self, name, default=''):
        return self.headers.get(name.lower(), default)

    @property
    def ctype(self):
        return self.header('content-type').split(';')[0].strip().lower()

    @property
    def location(self):
        return self.header('location')

    def text(self):
        raw = self.body
        m = re.search(r'charset=([\w-]+)', self.header('content-type'), re.I)
        for enc in ([m.group(1)] if m else []) + ['utf-8', 'latin-1']:
            try:
                return raw.decode(enc)
            except Exception:
                continue
        return raw.decode('utf-8', 'replace')


class Fetcher(object):
    def __init__(self, timeout=20.0, insecure=False):
        self.timeout = timeout
        self.deadline = max(60.0, timeout * 3)   # for a whole answer: a server that sends one byte at a time must not hold the check for ever
        self.ctx = ssl.create_default_context()
        if insecure:
            self.ctx.check_hostname = False
            self.ctx.verify_mode = ssl.CERT_NONE
        self.cache = {}
        self.lock = threading.Lock()
        self.count = 0

    def request(self, url, accept='gzip', method='GET', maxbytes=30000000):
        key = (method, url, accept)
        with self.lock:
            if key in self.cache:
                return self.cache[key]
        resp = self._do(url, accept, method, maxbytes)
        with self.lock:
            self.cache[key] = resp
            self.count += 1
        return resp

    def _do(self, url, accept, method, maxbytes):
        sp = urlsplit(url)
        host = sp.hostname
        if sp.scheme not in ('http', 'https') or not host:
            raise FetchError('other', 'only http:// and https:// addresses are followed (this one is %s)' % (sp.scheme + ':' if sp.scheme else 'not a web address'))
        https = sp.scheme == 'https'
        port = sp.port or (443 if https else 80)
        path = quote(sp.path or '/', safe="/%:@!$&'()*+,;=-._~")
        if sp.query:
            path += '?' + sp.query
        r = Resp(url)
        conn = None
        t0 = time.perf_counter()
        try:
            if https:
                conn = http.client.HTTPSConnection(host, port, timeout=self.timeout, context=self.ctx)
            else:
                conn = http.client.HTTPConnection(host, port, timeout=self.timeout)
            conn.connect()
            conn.request(method, path, headers={'User-Agent': UA, 'Accept': '*/*', 'Accept-Encoding': accept, 'Connection': 'close'})
            resp = conn.getresponse()
            r.ttfb = time.perf_counter() - t0
            chunks, got = [], 0
            while method != 'HEAD' and got <= maxbytes:
                if time.perf_counter() - t0 > self.deadline:
                    raise FetchError('timeout', 'the answer did not finish within %d seconds' % int(self.deadline))
                piece = resp.read1(min(65536, maxbytes + 1 - got))   # read1: what has arrived, so the clock above is looked at even when the bytes come one by one
                if not piece:
                    break
                chunks.append(piece)
                got += len(piece)
            raw = b''.join(chunks)
            r.total = time.perf_counter() - t0
            r.status = resp.status
            hdrs = {}
            for k, v in resp.getheaders():
                k = k.lower()
                hdrs[k] = (hdrs[k] + ', ' + v) if k in hdrs else v
            r.headers = hdrs
        except socket.gaierror as e:
            raise FetchError('dns', 'the name %s is not known yet (%s)' % (host, e))
        except ssl.SSLCertVerificationError as e:
            raise FetchError('cert', 'the HTTPS certificate is not accepted (%s)' % (getattr(e, 'verify_message', None) or e))
        except ssl.SSLError as e:
            raise FetchError('tls', 'the secure connection could not be set up (%s)' % e)
        except FetchError:
            raise
        except (socket.timeout, TimeoutError):
            raise FetchError('timeout', 'no answer within %d seconds' % int(self.timeout))
        except ConnectionRefusedError:
            raise FetchError('refused', 'nothing is listening at %s port %d' % (host, port))
        except (http.client.HTTPException, ConnectionError, OSError) as e:
            raise FetchError('other', 'the connection failed (%s)' % (str(e) or e.__class__.__name__))
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
        r.wire = len(raw)
        enc = r.headers.get('content-encoding', '').strip().lower()
        r.encoding = enc
        body = raw
        limit = maxbytes   # an answer that unpacks to more than the limit is cut there (a few KB can unpack to gigabytes)
        def inflate(wbits):
            d = zlib.decompressobj(wbits)
            out = d.decompress(raw, limit + 1)
            return out[:limit], len(out) > limit
        try:
            if enc in ('gzip', 'x-gzip'):
                body, r.truncated = inflate(16 + zlib.MAX_WBITS)
            elif enc == 'deflate':
                try:
                    body, r.truncated = inflate(zlib.MAX_WBITS)
                except zlib.error:
                    body, r.truncated = inflate(-zlib.MAX_WBITS)
            elif enc == 'br':
                body = b''
                r.undecoded = True
        except Exception:
            body = raw
            r.undecoded = True
        r.body = body
        return r

    def follow(self, url, max_hops=5, **kw):
        chain = []
        cur = url
        seen = set()
        start_private = private_address(urlsplit(url).hostname)   # a practice run on this computer may redirect inside it; a site on the internet may not
        for hop in range(max_hops + 1):
            r = self.request(cur, **kw)
            chain.append(r)
            if r.status in (301, 302, 303, 307, 308) and r.location and hop < max_hops:
                nxt = urldefrag(urljoin(cur, r.location))[0]
                nsp = urlsplit(nxt)
                if nsp.scheme not in ('http', 'https') or not nsp.hostname:
                    raise FetchError('other', 'the address redirects to %s, which is not a web address (only http:// and https:// are followed)' % (nxt[:60].replace(chr(10), ' ')))
                if nsp.username is not None or nsp.password is not None:
                    raise FetchError('other', 'the address redirects to an address with a user name or password in it, which is not followed')
                if not start_private and private_address(nsp.hostname):
                    raise FetchError('other', 'the address redirects to %s, which is inside a private network (this computer or a home or office network), not on the internet. It was not followed' % nsp.hostname)
                if nxt in seen:
                    break
                seen.add(cur)
                cur = nxt
                continue
            break
        return chain[-1], chain


# ------------------------------------------------------------------------------------------------ the report
class Report(object):
    def __init__(self, as_json):
        self.items = []
        self.section = ''
        self.as_json = as_json

    def head(self, title):
        self.section = title
        if not self.as_json:
            print('')
            print('== %s ==' % title)
            sys.stdout.flush()

    def add(self, level, key, message, todo='', detail=None):
        self.items.append({'level': level, 'key': key, 'section': self.section, 'message': message, 'todo': todo, 'detail': detail})
        if not self.as_json:
            first = textwrap.wrap(message, 90, initial_indent='%s  ' % level, subsequent_indent='      ')
            print('\n'.join(first))
            if todo and level != PASS:
                print('\n'.join(textwrap.wrap('What to do: ' + todo, 90, initial_indent='      ', subsequent_indent='      ')))
            sys.stdout.flush()

    def keys(self, level=None):
        return [i['key'] for i in self.items if level is None or i['level'] == level]

    def count(self, level):
        return sum(1 for i in self.items if i['level'] == level)


# ------------------------------------------------------------------------------------------------ reading a page
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class PageParser(HTMLParser):
    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.title = ''
        self.metas = []
        self.links = []
        self.scripts = []
        self.refs = []          # (kind, url) of files the page loads
        self.anchors = []
        self.styles = []
        self.texts = []         # (text, hidden)
        self.attr_texts = []
        self.ids = set()
        self.htmllang = ''
        self._stack = []
        self._script = None
        self._style = None
        self._title = False

    def _hidden(self):
        return any(h for _, h in self._stack)

    def handle_starttag(self, tag, attrs):
        a = {}
        for k, v in attrs:
            a[k.lower()] = '' if v is None else v
        if a.get('id'):
            self.ids.add(a['id'])
        for k in ('alt', 'title', 'aria-label', 'placeholder'):
            if a.get(k):
                self.attr_texts.append(a[k])
        if tag == 'html':
            self.htmllang = a.get('lang', '')
        if tag == 'title':
            self._title = True
        elif tag == 'meta':
            self.metas.append(a)
            if a.get('content') and (a.get('name') or a.get('property')):
                self.attr_texts.append(a['content'])
        elif tag == 'link':
            self.links.append(a)
            rel = a.get('rel', '').lower().split()
            href = a.get('href', '')
            if href:
                if 'stylesheet' in rel:
                    self.refs.append(('css', href))
                elif any(x in rel for x in ('icon', 'apple-touch-icon', 'shortcut', 'mask-icon')):
                    self.refs.append(('icon', href))
                elif 'manifest' in rel:
                    self.refs.append(('manifest', href))
                elif 'modulepreload' in rel:
                    self.refs.append(('js', href))
                elif 'preload' in rel:
                    self.refs.append((a.get('as', 'other') if a.get('as') in ('font', 'image', 'style', 'script') else 'other', href))
        elif tag == 'script':
            self._script = (a, [])
            if a.get('src'):
                self.refs.append(('js', a['src']))
        elif tag == 'style':
            self._style = []
        elif tag == 'img':
            kind = 'img-lazy' if a.get('loading', '').lower() == 'lazy' else 'img'
            if a.get('src'):
                self.refs.append((kind, a['src']))
            for u in self._srcset(a.get('srcset', '')):
                self.refs.append((kind, u))
        elif tag == 'source':
            for u in self._srcset(a.get('srcset', '')) + ([a['src']] if a.get('src') else []):
                self.refs.append(('img', u))
        elif tag in ('video', 'audio', 'iframe', 'embed', 'object'):
            for k in ('src', 'poster', 'data'):
                if a.get(k):
                    self.refs.append(('other', a[k]))
        elif tag == 'form' and a.get('action'):
            self.refs.append(('form', a['action']))
        elif tag == 'a' and a.get('href'):
            self.anchors.append(a['href'])
        if a.get('style'):
            self.styles.append(a['style'])
        if tag not in VOID:
            self._stack.append((tag, 'hidden' in a))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == 'title':
            self._title = False
        if tag == 'script' and self._script is not None:
            self.scripts.append((self._script[0], ''.join(self._script[1])))
            self._script = None
        if tag == 'style' and self._style is not None:
            self.styles.append(''.join(self._style))
            self._style = None
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i][0] == tag:
                del self._stack[i:]
                break

    def handle_data(self, data):
        if self._script is not None:
            self._script[1].append(data)
        elif self._style is not None:
            self._style.append(data)
        elif self._title:
            self.title += data
        elif data.strip():
            self.texts.append((data, self._hidden()))

    @staticmethod
    def _srcset(value):
        out = []
        for part in value.split(','):
            part = part.strip()
            if part:
                out.append(part.split()[0])
        return out

    def meta(self, key):
        for m in self.metas:
            if m.get('property', '').lower() == key or m.get('name', '').lower() == key:
                return m.get('content', '')
        return ''

    @property
    def canonical(self):
        for ln in self.links:
            if 'canonical' in ln.get('rel', '').lower().split():
                return ln.get('href', '')
        return ''


CSS_URL = re.compile(r'url\(\s*(["\']?)(.*?)\1\s*\)', re.I)
# 'single' or "double" quoted text (js/content.js tells the owner to use double quotes when the text has an apostrophe): group 1 holds the words of the first, group 2 of the second
QUOTED_TEXT = r'''(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")'''


def quoted_text(match):
    """The words of a QUOTED_TEXT match, whichever quote marks were used ('' when there was no match)."""
    if not match:
        return ''
    return match.group(1) if match.group(1) is not None else (match.group(2) or '')


def css_urls(text):
    return [m.group(2).strip() for m in CSS_URL.finditer(text) if m.group(2).strip()]


def image_size(data):
    """(width, height) of a PNG or JPEG, or None."""
    try:
        if data[:8] == b'\x89PNG\r\n\x1a\n':
            return struct.unpack('>II', data[16:24])
        if data[:2] == b'\xff\xd8':
            i = 2
            while i < len(data) - 9:
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                    i += 2
                    continue
                seglen = struct.unpack('>H', data[i + 2:i + 4])[0]
                if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                    h, w = struct.unpack('>HH', data[i + 5:i + 9])
                    return (w, h)
                i += 2 + seglen
    except Exception:
        return None
    return None


# ------------------------------------------------------------------------------------------------ the checks
class Checker(object):
    def __init__(self, base, report, fetcher, quick, live=False):
        self.base = base.rstrip('/')          # origin, no trailing slash
        sp = urlsplit(self.base)
        self.host = sp.hostname or ''
        self.https = sp.scheme == 'https'
        self.live = live
        self.local = is_local_host(self.host) and not live
        self.r = report
        self.f = fetcher
        self.quick = quick
        self.pages = {}                        # url -> (Resp, PageParser)
        self.sitemap_urls = []
        self.claimed = ''                      # origin the pages say they live at
        self.hostinfo = ('unknown', 'your host')
        self.softok = False                    # the host answers 200 for pages that do not exist
        self.started = time.time()
        self.page_urls = []

    # ---------------------------------------------------------------------------- helpers
    def u(self, path):
        return self.base + (path if path.startswith('/') else '/' + path)

    def fix_local(self, url):
        """A practice run: the pages name the real address; fetch them from the address we were given."""
        if self.claimed and url.startswith(self.claimed):
            return self.base + url[len(self.claimed):]
        return url

    def host_note(self):
        kind, name = self.hostinfo
        notes = {
            'github': 'GitHub Pages does not read the _headers or _redirects files, so those settings cannot be made there (docs/LAUNCH_CHECKLIST.md, section 1).',
            'python': 'This is a plain test server on a computer. It does not compress files and does not read the _headers or _redirects files; Cloudflare Pages and Netlify do.',
            'cloudflare': 'Cloudflare Pages reads _headers when the file is in the top folder of what was uploaded.',
            'netlify': 'Netlify reads _headers when the file is in the folder that is published.',
        }
        return notes.get(kind, 'This host may not read the _headers file: copy its lines into the host settings (docs/LAUNCH_CHECKLIST.md, step 3.5).')

    def detect_host(self, headers):
        s = headers.get('server', '').lower()
        if 'cloudflare' in s or 'cf-ray' in headers:
            self.hostinfo = ('cloudflare', 'Cloudflare')
        elif 'netlify' in s or 'x-nf-request-id' in headers:
            self.hostinfo = ('netlify', 'Netlify')
        elif 'github' in s or 'x-github-request-id' in headers:
            self.hostinfo = ('github', 'GitHub Pages')
        elif 'simplehttp' in s or s.startswith('python') or 'werkzeug' in s:
            self.hostinfo = ('python', 'a plain test server')
        elif s:
            self.hostinfo = ('other', headers.get('server', ''))

    def error_text(self, e):
        k = e.kind
        if k == 'dns':
            return ('The address does not answer yet: DNS may still be updating (this can take a few hours, sometimes a day, after the domain is pointed at the host). '
                    'Wait and run this check again. If it still fails tomorrow, look at the domain record again (docs/LAUNCH_CHECKLIST.md, step 3.3). Detail: ' + e.message + '.')
        if k == 'refused':
            return 'The address does not answer: ' + e.message + '. Check the address and the port, and that the site is running.'
        if k in ('cert', 'tls'):
            low = e.message.lower()
            if 'self-signed' in low or 'self signed' in low:
                hint = 'This is a test certificate (made by the person running the test server). To look at the site anyway, add --insecure.'
            elif 'hostname' in low or 'mismatch' in low:
                hint = 'The certificate was issued for another name. The domain probably is not added to the host yet (docs/LAUNCH_CHECKLIST.md, step 3.3): add it and wait until the host says Active.'
            elif 'expired' in low:
                hint = 'The certificate has expired. Cloudflare Pages and Netlify renew it by themselves; on another host ask them to renew it.'
            else:
                hint = ('A new domain needs a certificate from the host, which can take from a few minutes to some hours; in the host\'s dashboard the domain should say Active. '
                        'If every https:// site fails like this on your computer, your Python has no certificates (on a Mac run "Install Certificates.command" in the Python folder).')
            return 'The padlock (HTTPS) is not ready: ' + e.message + '. ' + hint
        if k == 'timeout':
            return 'The address did not answer in time: ' + e.message + '. Try again in a minute, or use --timeout 60 on a slow connection.'
        return 'The address could not be reached: ' + e.message + '. Check the spelling and your internet connection.'

    def get(self, url, **kw):
        return self.f.request(url, **kw)

    def follow(self, url, **kw):
        return self.f.follow(url, **kw)

    # ---------------------------------------------------------------------------- 0. does the address answer
    def reach(self):
        r = self.r
        r.head('0. Does the address answer?')
        try:
            final, chain = self.follow(self.u('/'))
        except FetchError as e:
            r.add(FAIL, 'reach', self.error_text(e), 'Nothing else can be checked until the address answers.')
            return False
        self.detect_host(chain[0].headers)
        if len(chain) > 1:
            last = urlsplit(final.url)
            new_base = '%s://%s' % (last.scheme, last.netloc.rpartition('@')[2])
            if new_base.lower() != self.base.lower() and final.status == 200:
                r.add(PASS, 'reach-redirect', 'The address you gave sends visitors on to %s (%d redirect%s). That address is checked from here on.' % (new_base, len(chain) - 1, '' if len(chain) == 2 else 's'))
                self.base = new_base
                sp = urlsplit(self.base)
                self.host = sp.hostname or ''
                self.https = sp.scheme == 'https'
                self.local = is_local_host(self.host) and not self.live
        if final.status != 200:
            r.add(FAIL, 'reach', 'The front page answers %d, not 200 (OK).' % final.status, 'Check that index.html is in the top folder of what was uploaded, then run this check again.')
            return False
        kind, name = self.hostinfo
        r.add(PASS, 'reach', 'The front page answers (200 OK in %.2f s). The host looks like: %s.' % (final.ttfb, name if kind != 'unknown' else 'not recognised'))
        if self.local:
            r.add(PASS, 'dry-run', 'This is a practice run on a computer, not the real address: the https and www checks are skipped, and the host-name checks only warn.')
        return True

    # ---------------------------------------------------------------------------- 1. pages
    def pages_section(self):
        r = self.r
        r.head('1. Pages and addresses')
        home_url = self.u('/')
        home, _ = self.follow(home_url)
        hp = PageParser()
        hp.feed(home.text())
        self.pages[home_url] = (home, hp)
        canon = hp.canonical
        self.claimed = origin_of(canon) if canon.startswith('http') else ''
        given = origin_of(home_url)

        # https and www
        if not self.local:
            if not self.https:
                r.add(WARN, 'https-given', 'You gave an address that starts with http:// . The real address should start with https:// (the padlock).', 'Run the check with the https:// address.')
            self.redirect_variants()
        # which address do the pages say they live at
        if self.claimed:
            if self.claimed.lower() == given.lower():
                r.add(PASS, 'domain', 'The front page names the same address you gave (%s) in its canonical, share and structured-data tags.' % given)
            elif self.local:
                r.add(WARN, 'domain', 'Practice run: the pages say their address is %s, not %s. That is right for the real site and fine for now. On the real address this must match.' % (self.claimed, given),
                      'Nothing to do for a practice run.')
            else:
                r.add(FAIL, 'domain', 'The site still points at %s but you are checking %s. Google and share previews would use the wrong address.' % (self.claimed, given),
                      'Change the address in the site files (tools/pages.py SITE, the home page tags, tools/qr_links.json; docs/DECISION_PLAYBOOK.md, d38), rebuild, upload again.')
        else:
            r.add(FAIL, 'domain', 'The front page has no canonical address tag (<link rel="canonical">).', 'Ask Claude to check the home page tags.')

        # sitemap
        sm = self.get(self.u('/sitemap.xml'))
        urls = []
        if sm.status != 200:
            r.add(FAIL, 'sitemap-fetch', 'sitemap.xml answers %d, so Google cannot find the list of pages.' % sm.status, 'Upload sitemap.xml (it is in the top folder of the site).')
        else:
            urls = re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', sm.text())
            if not urls:
                r.add(FAIL, 'sitemap-fetch', 'sitemap.xml has no pages in it.', 'Run python3 tools/pages.py to write it again, then upload.')
            else:
                r.add(PASS, 'sitemap-fetch', 'sitemap.xml lists %d pages.' % len(urls))
                if sm.ctype and not any(t in sm.ctype for t in ('xml',)):
                    r.add(WARN, 'sitemap-type', 'sitemap.xml is sent as %s, not as XML.' % sm.ctype, 'Usually harmless; Google still reads it.')
        self.sitemap_urls = urls
        bad_host = [u for u in urls if origin_of(u).lower() != (self.claimed or given).lower()]
        if urls and bad_host:
            r.add(FAIL if not self.local else WARN, 'sitemap-hosts', 'The sitemap names another address than the pages do: %s' % ', '.join(bad_host[:3]),
                  'Run python3 tools/pages.py (it writes sitemap.xml from SITE) and upload again.')
        if len(set(urls)) != len(urls):
            r.add(WARN, 'sitemap-dupes', 'The same page is listed twice in sitemap.xml.', 'Run python3 tools/pages.py to write it again.')
        forbidden = [u for u in urls if any(f in urlsplit(u).path for f in FORBIDDEN_IN_SITEMAP)]
        if forbidden:
            r.add(FAIL, 'sitemap-forbidden', 'The sitemap lists pages that are not for visitors: %s' % ', '.join(forbidden), 'Remove them from sitemap.xml (run python3 tools/pages.py).')
        homepaths = [urlsplit(u).path or '/' for u in urls]
        if urls and '/' not in homepaths:
            r.add(FAIL, 'sitemap-home', 'The front page is not in sitemap.xml.', 'Run python3 tools/pages.py to write it again, then upload.')
        # linked pages versus listed pages
        linked = set()
        for href in hp.anchors:
            full = urldefrag(urljoin(home_url, href))[0]
            sp = urlsplit(full)
            if sp.netloc.lower() != urlsplit(self.base).netloc.lower():
                continue
            path = sp.path
            if (path.endswith('.html') or path == '/') and not any(f in path for f in FORBIDDEN_IN_SITEMAP):
                linked.add(path)
        def short(p):   # /wise-pie.html and /wise-pie are the same page for this comparison
            p = re.sub(r'\.html$', '', p)
            return '/' if p in ('', '/index') else p
        listed = set(homepaths)
        listed_s = set(short(p) for p in listed)
        linked_s = set(short(p) for p in linked)
        if urls:
            missing_listed = sorted(p for p in linked if short(p) not in listed_s and short(p) != '/')
            extra = sorted(p for p in listed if short(p) not in linked_s and short(p) != '/')
            if missing_listed:
                r.add(WARN, 'sitemap-linked', 'The home page links to pages that are not in the sitemap: %s' % ', '.join(missing_listed), 'Run python3 tools/pages.py to write the sitemap again.')
            if extra:
                r.add(WARN, 'sitemap-unlinked', 'The sitemap lists pages the home page does not link to: %s' % ', '.join(extra), 'Check that these pages are meant to be public.')
            if not missing_listed and not extra:
                r.add(PASS, 'sitemap-linked', 'The sitemap lists exactly the pages the home page links to.')

        # every page in the sitemap
        ok_pages = 0
        for u in urls:
            fetch = self.fix_local(u)
            path = urlsplit(u).path or '/'
            try:
                resp = self.get(fetch)
            except FetchError as e:
                r.add(FAIL, 'page:' + path, 'Could not load %s: %s.' % (u, e.message), 'Run the check again in a minute; if it keeps failing, check the host.')
                continue
            problems = []
            if resp.status in (301, 302, 303, 307, 308):
                dest = urljoin(fetch, resp.location)
                try:
                    lead, _chain = self.follow(fetch, max_hops=3)
                    if lead.status == 200:
                        lp = PageParser()
                        lp.feed(lead.text())
                        self.pages[fetch] = (lead, lp)
                        self.page_urls.append(fetch)
                except FetchError:
                    pass
                r.add(FAIL, 'page-redirect:' + path, '%s answers with a redirect to %s instead of showing the page. The sitemap, the canonical tag and the real address disagree.' % (u, dest),
                      ('This host sends the .html address to a shorter one (Cloudflare Pages does this). Either apply the clean-address patch (docs/DECISION_PLAYBOOK.md, d05, OPT-C) '
                       'and rebuild, or change the sitemap and canonical tags to the shorter address (checklist 3.7).') if resp.location.rstrip('/') != fetch.rstrip('/') else
                      'Check the host\'s redirect settings (a redirect to the same address is a loop).')
                continue
            if resp.status != 200:
                r.add(FAIL, 'page:' + path, '%s answers %d instead of 200 (OK).' % (u, resp.status), 'Upload that page (%s is in the top folder of the site) and run this check again.' % (path.lstrip('/') or 'index.html'))
                continue
            p = PageParser()
            p.feed(resp.text())
            self.pages[fetch] = (resp, p)
            self.page_urls.append(fetch)
            ok_pages += 1
            if not self.local and not fetch.startswith('https://'):
                problems.append('is not served over https')
            can = self.fix_local(p.canonical) if p.canonical else ''
            if not p.canonical:
                r.add(FAIL, 'canonical:' + path, '%s has no canonical address tag.' % u, 'Run python3 tools/pages.py and upload again.')
            elif can != fetch:
                r.add(FAIL, 'canonical:' + path, 'The canonical address of %s says %s. It should be the address the page is really served at.' % (u, p.canonical),
                      'Google would index the other address. Rebuild the pages (python3 tools/pages.py) and upload again; check SITE in tools/pages.py.')
            robots_meta = p.meta('robots').lower()
            if 'noindex' in robots_meta or 'noindex' in resp.header('x-robots-tag').lower():
                r.add(FAIL, 'noindex-page:' + path, '%s tells Google not to list it (noindex).' % u, 'Remove the noindex tag or header from this page; only the 404 and print pages should have it.')
        if urls and ok_pages == len(urls):
            r.add(PASS, 'pages-200', 'All %d pages in the sitemap load with 200 (OK), without a redirect, and name themselves as their canonical address.' % ok_pages)
        self.page_urls = [u for u in self.page_urls]
        if home_url not in self.page_urls:
            self.page_urls.insert(0, home_url)

        self.robots_check(given)
        self.not_found_check()
        self.hygiene_check()

    def redirect_variants(self):
        r = self.r
        host = self.host
        alt = host[4:] if host.startswith('www.') else 'www.' + host
        if host.count('.') < 1 or re.match(r'^[\d.]+$', host):
            return
        want = '%s://%s/' % ('https', host)
        variants = [('http://%s/' % host, 'the plain http:// address')]
        if not host.endswith(('.pages.dev', '.netlify.app', '.github.io', '.workers.dev', '.vercel.app')):
            variants += [('https://%s/' % alt, 'the other spelling (%s)' % alt), ('http://%s/' % alt, 'the plain http:// address of the other spelling')]
        lines = []
        reported = set()      # one line for each problem, not one for every way of typing it
        for url, label in variants:
            try:
                final, chain = self.follow(url, max_hops=4)
            except FetchError as e:
                if ('err', urlsplit(url).netloc) in reported or ('err', alt) in reported and urlsplit(url).netloc == alt:
                    continue
                reported.add(('err', urlsplit(url).netloc))
                if url.startswith('http://' + host):
                    r.add(WARN, 'http-redirect', 'http://%s/ does not answer (%s). Visitors who type the address without https:// get an error.' % (host, e.message),
                          'Turn on "Always use HTTPS" at the host so the plain address redirects to https.')
                else:
                    r.add(WARN, 'www', 'The other spelling of the address (%s) does not answer (%s). Visitors who type it get an error.' % (url.split('/')[2], e.message),
                          'Add that spelling in the host and in the domain record (checklist step 3.3), and redirect it to %s.' % host)
                continue
            fin = urlsplit(final.url)
            hops = len(chain) - 1
            good = final.status == 200 and fin.scheme == 'https' and fin.netloc.lower() == host.lower()
            if good and hops <= 2:
                lines.append('%s -> %s (%d redirect%s)' % (url, final.url, hops, '' if hops == 1 else 's'))
            elif good:
                r.add(WARN, 'redirect-hops', '%s needs %d redirects to reach %s.' % (url, hops, final.url), 'One redirect is best; set the host to redirect straight to the final address.')
            elif final.status == 200 and fin.netloc.lower() != host.lower():
                if ('copy', fin.netloc.lower()) in reported:
                    continue
                reported.add(('copy', fin.netloc.lower()))
                r.add(WARN, 'www', '%s serves its own copy of the site instead of redirecting to %s. Two addresses show the same pages.' % (url, host),
                      'Make the host redirect the other spelling to %s (the canonical tags already name %s, so Google will cope).' % (host, self.claimed or host))
            elif final.status == 200 and fin.scheme != 'https':
                r.add(FAIL, 'http-redirect', '%s shows the site over plain http with no redirect to https. Visitors get no padlock.' % url,
                      'Turn on "Always use HTTPS" at the host (Cloudflare: SSL/TLS, Edge Certificates; Netlify: HTTPS settings).')
            else:
                r.add(FAIL, 'www', '%s ends at %s (status %d), not at %s.' % (url, final.url, final.status, want), 'Fix the redirect for that address in the host settings.')
        if lines:
            r.add(PASS, 'http-redirect', 'Every way of typing the address ends at the one real address: ' + '; '.join(lines) + '.')

    def robots_check(self, given):
        r = self.r
        rob = self.get(self.u('/robots.txt'))
        if rob.status != 200:
            r.add(FAIL, 'robots-file', 'robots.txt answers %d.' % rob.status, 'Upload robots.txt (it is in the top folder of the site).')
            return
        text = rob.text()
        groups = {}
        cur = []
        naming = False   # the last rule line was a User-agent line: the next User-agent line joins the same group (they share the rules that follow)
        for line in text.splitlines():
            line = line.split('#')[0].strip()
            if not line or ':' not in line:
                continue
            k, v = [x.strip() for x in line.split(':', 1)]
            k = k.lower()
            if k == 'user-agent':
                cur = (cur if naming else []) + [v.lower()]
                naming = True
                groups.setdefault(v.lower(), [])
            elif k in ('disallow', 'allow') and cur:
                naming = False
                for ua in cur:
                    groups[ua].append((k, v))
        rules = groups.get('*', [])
        blocks_all = any(k == 'disallow' and v == '/' for k, v in rules)
        if blocks_all:
            r.add(FAIL, 'robots-allow', 'robots.txt blocks the whole site from search engines (Disallow: /).', 'Remove that line from robots.txt (python3 tools/pages.py writes the right file) and upload again.')
        else:
            r.add(PASS, 'robots-allow', 'robots.txt lets search engines read the site.')
        dis = set(v.rstrip('/') for k, v in rules if k == 'disallow')
        lacking = [d for d in ('/tests', '/docs', '/print') if d not in dis]
        if lacking:
            r.add(FAIL, 'robots-disallow', 'robots.txt does not keep these folders out of search engines: %s' % ', '.join(lacking), 'Run python3 tools/pages.py (it writes the right robots.txt) and upload again.')
        else:
            r.add(PASS, 'robots-disallow', 'robots.txt keeps /tests/, /docs/ and /print/ out of search engines.')
        m = re.search(r'^\s*sitemap:\s*(\S+)', text, re.I | re.M)
        if not m:
            r.add(WARN, 'robots-sitemap', 'robots.txt does not name the sitemap.', 'Run python3 tools/pages.py and upload robots.txt again.')
        elif self.fix_local(m.group(1)) != self.u('/sitemap.xml') and not self.local:
            r.add(FAIL, 'robots-sitemap', 'robots.txt points at another sitemap address: %s' % m.group(1), 'Check SITE in tools/pages.py, run it, and upload again.')

    def not_found_check(self):
        r = self.r
        tag = '%08x' % random.getrandbits(32)
        results = []
        for path in ('/launch-check-%s.html' % tag, '/launch-check-%s' % tag):
            try:
                resp = self.get(self.u(path))
            except FetchError as e:
                r.add(FAIL, '404-status', 'The "page not found" test failed to load: %s.' % e.message)
                return
            results.append(resp)
        first = results[0]
        soft = [x for x in results if x.status == 200]
        redirected = [x for x in results if x.status in (301, 302, 303, 307, 308)]
        if soft:
            self.softok = True
            r.add(FAIL, '404-status', 'A made-up address answers 200 (OK) instead of 404. Google would list pages that do not exist, and broken links would never show as broken.',
                  'Turn off any "single page app" or "always show the front page" fallback at the host; the host should serve 404.html with a 404 status.')
            return
        if redirected:
            self.softok = True
            r.add(FAIL, '404-status', 'A made-up address is redirected (status %d) instead of answering 404.' % redirected[0].status, 'The host should answer 404 and show 404.html; look for a catch-all redirect rule.')
            return
        if first.status != 404:
            r.add(FAIL, '404-status', 'A made-up address answers %d instead of 404.' % first.status, 'The host should answer 404 and show 404.html.')
            return
        r.add(PASS, '404-status', 'An address that does not exist answers 404 (not found), as it should.')
        p = PageParser()
        p.feed(first.text())
        friendly = 'not found' in p.title.lower() and any(h in ('/', '/index.html') for h in p.anchors)
        if friendly:
            r.add(PASS, '404-friendly', 'The 404 answer is the friendly "page not found" page of the site.')
        else:
            r.add(WARN, '404-friendly', 'The 404 answer is not the site\'s friendly "page not found" page.', 'Upload 404.html in the top folder of the site.')
        if 'noindex' in p.meta('robots').lower() or 'noindex' in first.header('x-robots-tag').lower():
            r.add(PASS, '404-noindex', 'The 404 page tells Google not to list it (noindex).')
        else:
            r.add(WARN, '404-noindex', 'The 404 page does not say noindex, so Google might list it.', 'Check that 404.html has <meta name="robots" content="noindex">.')
        self.pages['404'] = (first, p)

    def hygiene_check(self):
        r = self.r
        if self.softok:
            r.add(WARN, 'hygiene', 'The check for owner notes that should not be online was skipped, because this host answers 200 for every address.')
            return
        exposed = []
        for path in EXPOSED_TEST_PATHS:
            try:
                resp = self.get(self.u(path))
            except FetchError:
                continue
            if resp.status == 200:
                exposed.append(path)
        pg = []
        try:
            resp = self.get(self.u('/pages/first-visit.html'))
            if resp.status == 200:
                pg.append('/pages/first-visit.html')
        except FetchError:
            pass
        if exposed:
            r.add(FAIL, 'hygiene', 'These files are online but are only notes for the owner and helpers: %s' % ', '.join(exposed),
                  'Upload only the website files: not docs/, tests/, tools/ or README.md (docs/LAUNCH_CHECKLIST.md, section 2). Delete them from the host and upload again.')
        else:
            r.add(PASS, 'hygiene', 'The notes folders (docs, tests, tools) and README.md are not online.')
        if pg:
            r.add(WARN, 'hygiene-pages', 'The folder pages/ is online (%s). It holds the page sources; the same pages already exist in the top folder.' % ', '.join(pg),
                  'Leave out the pages/ folder when you upload (checklist section 2).')

    # ---------------------------------------------------------------------------- 2. headers
    def headers_section(self):
        r = self.r
        r.head('2. Headers, compression and caching')
        home = self.pages.get(self.u('/'))
        if not home:
            return
        resp = home[0]
        # compression: a browser-like request first, to see which kind the host offers
        try:
            probe = self.get(self.u('/'), accept='gzip, deflate, br')
            offered = probe.encoding or 'none'
        except FetchError:
            offered = resp.encoding or 'none'
        # headers from _headers
        missing = []
        for key, label, test in SECURITY_HEADERS:
            v = resp.header(key)
            if key == 'x-frame-options' and not v and 'frame-ancestors' in resp.header('content-security-policy').lower():
                v = 'csp'
            if not v or not test(v):
                missing.append(label)
        if not missing:
            r.add(PASS, 'sec-headers', 'The security headers from the _headers file are present (nosniff, referrer policy, frame protection, permissions policy).')
        else:
            r.add(WARN, 'sec-headers', 'These security headers are missing: %s. %s' % ('; '.join(missing), self.host_note()),
                  'Put _headers in the top folder of what you upload, or copy its lines into the host\'s own header settings (checklist step 3.5). The site works without them, but they are part of the plan.')
        # the headers asked for other folders
        pr = None
        try:
            pr = self.get(self.u('/print/qr-signs.html'))
        except FetchError:
            pass
        if pr is not None and pr.status == 200:
            if 'noindex' in pr.header('x-robots-tag').lower() or 'noindex' in pr.text().lower():
                r.add(PASS, 'print-noindex', 'The printable QR signs page (/print/qr-signs.html) tells Google not to list it.')
            else:
                r.add(WARN, 'print-noindex', 'The printable QR signs page can be listed by Google.', 'It needs the X-Robots-Tag line of _headers (see the security headers above).')
        csp = resp.header('content-security-policy')
        if csp:
            r.add(PASS, 'csp', 'A Content-Security-Policy is set.')
        elif resp.header('content-security-policy-report-only'):
            r.add(WARN, 'csp', 'The Content-Security-Policy is still in trial mode (Report-Only).', 'When the trial shows no problems, switch it on (checklist, step 3.5). This is optional.')
        # compression
        self.compression_summary(offered)

    def compression_summary(self, offered):
        r = self.r
        rows = []
        notc = []
        for url in self.page_urls:
            resp = self.pages[url][0]
            rows.append((url, resp))
        if not rows:
            return
        tot_before = tot_after = 0
        pieces = []
        for url, resp in rows:
            before = len(resp.body) if not resp.undecoded else resp.wire
            after = resp.wire
            compressed = resp.encoding in ('gzip', 'x-gzip', 'br', 'deflate')
            tot_before += before
            tot_after += after
            name = urlsplit(url).path.lstrip('/') or 'index.html'
            if compressed:
                pieces.append('%s %s -> %s' % (name, human(before), human(after)))
            elif before > 1024:
                notc.append((name, before, gzip_size(resp.body)))
        if notc:
            lines = ', '.join('%s %s (would be %s)' % (n, human(b), human(g)) for n, b, g in notc[:4])
            r.add(FAIL, 'compression', 'The host sends pages without compressing them: %s. Visitors on phones wait several times longer. %s' % (lines, self.host_note()),
                  'Cloudflare Pages and Netlify compress automatically. On another host turn on gzip or brotli for text files (HTML, CSS, JavaScript, JSON).')
        else:
            r.add(PASS, 'compression', 'Pages are compressed (%s): %s. Together %s -> %s.%s' % (rows[0][1].encoding or offered, '; '.join(pieces[:3]) + (' ...' if len(pieces) > 3 else ''), human(tot_before), human(tot_after),
                                                                                                    ' Brotli is also offered.' if offered == 'br' else ''))

    # ---------------------------------------------------------------------------- 3. assets
    def collect_assets(self):
        """All same-address files the pages load: url -> {kinds, by:set(pages)}."""
        assets = {}
        external = {}

        def add(url, kind, page):
            kind = 'img' if kind == 'img-lazy' else kind
            if not url or url.startswith(('data:', 'javascript:', 'mailto:', 'tel:', '#', 'blob:')):
                return
            full = urldefrag(urljoin(page, url))[0]
            sp = urlsplit(full)
            if sp.netloc.lower() == urlsplit(self.base).netloc.lower():
                a = assets.setdefault(full, {'kinds': set(), 'by': set()})
                a['kinds'].add(kind)
                a['by'].add(page)
            else:
                external.setdefault(full, set()).add(page)

        pages = [(u, self.pages[u]) for u in self.page_urls if u in self.pages]
        if '404' in self.pages:
            pages.append((self.u('/404.html'), self.pages['404']))
        for u in ('/print/qr-signs.html',):
            try:
                rr = self.get(self.u(u))
                if rr.status == 200:
                    pp = PageParser()
                    pp.feed(rr.text())
                    pages.append((self.u(u), (rr, pp)))
            except FetchError:
                pass
        for pu, (resp, p) in pages:
            for kind, url in p.refs:
                add(url, kind, pu)
            for m in p.metas:
                if m.get('property', '').lower() in ('og:image', 'og:image:secure_url') or m.get('name', '').lower() == 'twitter:image':
                    add(m.get('content', ''), 'share', pu)
            for st in p.styles:
                for url in css_urls(st):
                    add(url, 'font' if ext_of(url) in ('.woff2', '.woff', '.ttf') else 'img', pu)
        return assets, external, pages

    def expand(self, assets):
        """CSS url(...) files, the manifest's icons, the language files and the gallery photos."""
        extra = []
        for url, a in list(assets.items()):
            if 'css' in a['kinds']:
                try:
                    rr = self.get(url)
                except FetchError:
                    continue
                if rr.status == 200:
                    for ref in css_urls(rr.text()):
                        extra.append((urldefrag(urljoin(url, ref))[0], 'font' if ext_of(ref) in ('.woff2', '.woff', '.ttf') else 'img', url))
            if 'manifest' in a['kinds']:
                try:
                    rr = self.get(url)
                    if rr.status == 200:
                        for ic in json.loads(rr.text()).get('icons', []):
                            extra.append((urldefrag(urljoin(url, ic.get('src', '')))[0], 'icon', url))
                except Exception:
                    pass
        # the language files and the photo list are named in the scripts
        try:
            ij = self.get(self.u('/js/i18n.js'))
            if ij.status == 200:
                codes = [c for c in re.findall(r"code:\s*'([a-z]{2,3})'", ij.text()) if c != 'en']
                for c in codes:
                    extra.append((self.u('/lang/%s.js' % c), 'js', self.u('/js/i18n.js')))
        except FetchError:
            pass
        try:
            cj = self.get(self.u('/js/content.js'))
            if cj.status == 200:
                for src in re.findall(r'^\s*(?:\{\s*)?src:\s*["\']([^"\']+)["\']', cj.text(), re.M):
                    if src.startswith(('assets/', '/assets/')):
                        extra.append((self.u('/' + src.lstrip('/')), 'img', self.u('/js/content.js')))
        except FetchError:
            pass
        for url, kind, by in extra:
            sp = urlsplit(url)
            if sp.netloc.lower() == urlsplit(self.base).netloc.lower():
                a = assets.setdefault(url, {'kinds': set(), 'by': set()})
                a['kinds'].add(kind)
                a['by'].add(by)

    def assets_section(self):
        r = self.r
        r.head('3. Files, share pictures and structured data')
        assets, external, pages = self.collect_assets()
        self.expand(assets)
        self.assets = assets

        def fetch_one(url):
            try:
                final, chain = self.follow(url, max_hops=4)
                return url, final, chain, None
            except FetchError as e:
                return url, None, None, e
        with ThreadPoolExecutor(max_workers=6) as ex:
            results = list(ex.map(fetch_one, sorted(assets)))
        self.asset_results = {}
        missing, chains, errors, types_bad, types_soft = [], [], [], [], []
        kinds_count = {}
        for url, final, chain, err in results:
            a = assets[url]
            by = sorted(set(urlsplit(x).path or '/' for x in a['by']))
            name = urlsplit(url).path
            if err is not None:
                errors.append('%s (%s)' % (name, err.message))
                continue
            self.asset_results[url] = (final, chain)
            hops = len(chain) - 1
            if final.status != 200:
                missing.append('%s -> %d (used by %s)' % (name, final.status, ', '.join(by[:2])))
                continue
            if hops >= 2:
                chains.append((name, hops, 'FAIL'))
            elif hops == 1:
                chains.append((name, hops, 'WARN'))
            ext = ext_of(final.url) or ext_of(url)
            want = EXPECT_TYPE.get(ext)
            if want and final.ctype not in want:
                (types_bad if ext in HARD_TYPES else types_soft).append('%s is %s (should be %s)' % (name, final.ctype or 'unknown', want[0]))
            for k in a['kinds']:
                kinds_count[k] = kinds_count.get(k, 0) + 1
        total = len(assets)
        if missing:
            r.add(FAIL, 'asset-missing', '%d file%s the pages need could not be loaded: %s' % (len(missing), '' if len(missing) == 1 else 's', '; '.join(missing[:6]) + (' ...' if len(missing) > 6 else '')),
                  'Upload the missing files (the folders css, js, lang and assets must be uploaded whole), then run this check again.')
        if errors:
            r.add(FAIL, 'asset-error', '%d file%s did not load: %s' % (len(errors), '' if len(errors) == 1 else 's', '; '.join(errors[:4])), 'Run the check again; if it repeats, look at the host.')
        if not missing and not errors:
            parts = ', '.join('%d %s' % (n, k) for k, n in sorted(kinds_count.items()))
            r.add(PASS, 'assets-ok', 'All %d files the pages load answer 200 (OK): %s.' % (total, parts))
        hard = [c for c in chains if c[2] == 'FAIL']
        soft = [c for c in chains if c[2] == 'WARN']
        if hard:
            r.add(FAIL, 'asset-chain', 'These files go through a chain of redirects: %s' % ', '.join('%s (%d redirects)' % (n, h) for n, h, _ in hard[:5]), 'Point the page at the final address of the file, or fix the host redirect.')
        if soft:
            r.add(WARN, 'asset-redirect', '%d file%s redirect once before loading (for example %s). Every redirect costs the visitor time.' % (len(soft), '' if len(soft) == 1 else 's', soft[0][0]),
                  'Usually a host setting (www or https redirect); one redirect is acceptable.')
        if types_bad:
            r.add(FAIL, 'content-types', 'The host sends the wrong file type for: %s. Browsers refuse such scripts and styles.' % '; '.join(types_bad[:4]), 'Check the host settings for file types (MIME types).')
        elif types_soft:
            r.add(WARN, 'content-types', 'The host sends an unusual file type for: %s.' % '; '.join(types_soft[:4]), 'Usually harmless; check the host settings for file types.')
        else:
            r.add(PASS, 'content-types', 'Every file type is right (HTML, CSS, JavaScript, fonts, pictures, icons, manifest).')

        self.compression_assets()
        self.cache_check()
        self.share_images(pages)
        self.structured_data(pages)
        self.mixed_content(pages, external)

    def compression_assets(self):
        r = self.r
        text_rows = []
        notc = []
        for url, (final, chain) in self.asset_results.items():
            if final.status != 200:
                continue
            ext = ext_of(final.url) or ext_of(url)
            if ext not in TEXT_EXT or ext == '.svg' and len(final.body) < 1500:
                continue
            before = len(final.body) if not final.undecoded else final.wire
            if before <= 1024:
                continue
            if final.encoding in ('gzip', 'x-gzip', 'br', 'deflate'):
                text_rows.append((ext, before, final.wire))
            else:
                notc.append((urlsplit(url).path, before, gzip_size(final.body)))
        if notc:
            big = sorted(notc, key=lambda x: -x[1])[:4]
            r.add(FAIL, 'compression-files', '%d code and text files are sent without compression: %s. %s' % (len(notc), ', '.join('%s %s (would be %s)' % (n, human(b), human(g)) for n, b, g in big), self.host_note()),
                  'Turn on gzip or brotli for text files at the host (Cloudflare Pages and Netlify do it automatically).')
        elif text_rows:
            by_ext = {}
            for ext, b, a in text_rows:
                x = by_ext.setdefault(ext, [0, 0, 0])
                x[0] += 1
                x[1] += b
                x[2] += a
            r.add(PASS, 'compression-files', 'Code and text files are compressed: ' + '; '.join('%d %s %s -> %s' % (v[0], k, human(v[1]), human(v[2])) for k, v in sorted(by_ext.items())) + '.')

    def cache_check(self):
        r = self.r

        def maxage(cc):
            m = re.search(r'max-age=(\d+)', cc or '')
            return int(m.group(1)) if m else None
        long_bad, code_bad = [], []
        n_long = n_code = 0
        for url, (final, chain) in self.asset_results.items():
            if final.status != 200:
                continue
            path = urlsplit(url).path
            cc = final.header('cache-control')
            age = maxage(cc)
            if path.startswith('/assets/'):
                n_long += 1
                if not (('immutable' in cc) or (age is not None and age >= 31536000 // 2)):
                    long_bad.append((path, cc or 'no Cache-Control'))
            elif path.startswith(('/css/', '/js/', '/lang/')):
                n_code += 1
                if age is not None and age > 86400 * 7:
                    code_bad.append((path, cc))
        if n_long:
            if long_bad:
                r.add(WARN, 'cache-assets', 'Pictures and fonts are not cached for long (%d of %d, for example %s: %s). Every visit downloads them again, which is slower and costs bandwidth. %s' % (len(long_bad), n_long, long_bad[0][0], long_bad[0][1], self.host_note()),
                      'The _headers file asks for Cache-Control: public, max-age=31536000, immutable on /assets/* (checklist step 3.5).')
            else:
                r.add(PASS, 'cache-assets', 'Pictures and fonts are cached for a long time (%d files), so repeat visits are fast.' % n_long)
        if code_bad:
            r.add(WARN, 'cache-code', 'Some code files are cached for more than a week (%s: %s). After an update, visitors could keep seeing the old site.' % code_bad[0], 'Use a short cache time for css, js and lang (the _headers file asks for one hour).')
        elif n_code:
            r.add(PASS, 'cache-code', 'Style and script files have a short cache time, so an update shows within hours.')
        # html
        long_html = []
        for url in self.page_urls:
            resp = self.pages[url][0]
            age = maxage(resp.header('cache-control'))
            if age is not None and age > 86400:
                long_html.append(urlsplit(url).path)
        if long_html:
            r.add(WARN, 'cache-html', 'Pages are cached for more than a day (%s). A change you make would not show for a long time.' % ', '.join(long_html[:3]), 'Pages should have a short cache time (no-cache, or at most an hour) at the host.')
        else:
            r.add(PASS, 'cache-html', 'Pages are not cached for long, so a change you make shows quickly.')

    def share_images(self, pages):
        r = self.r
        seen = {}
        hosts = {}
        for pu, (resp, p) in pages:
            if '404' in pu or '/print/' in pu:
                continue
            for key in ('og:image', 'twitter:image'):
                v = p.meta(key)
                if not v:
                    r.add(FAIL, 'share-image', '%s has no %s tag, so shared links show no picture.' % (urlsplit(pu).path or '/', key), 'Run python3 tools/pages.py and upload again.')
                    continue
                full = urljoin(pu, v)
                seen.setdefault(full, set()).add(pu)
                hosts.setdefault(origin_of(full).lower(), set()).add(key + ' of ' + (urlsplit(pu).path or '/'))
        bad_size, big, bad_host = [], [], []
        ok = 0
        for url in sorted(seen):
            fetch = self.fix_local(url)
            if origin_of(fetch).lower() != urlsplit(self.base).scheme + '://' + urlsplit(self.base).netloc.lower() and not self.local:
                bad_host.append(url)
                continue
            try:
                resp = self.get(fetch)
            except FetchError as e:
                bad_size.append('%s (%s)' % (urlsplit(url).path, e.message))
                continue
            if resp.status != 200:
                bad_size.append('%s (answers %d)' % (urlsplit(url).path, resp.status))
                continue
            dims = image_size(resp.body)
            name = urlsplit(url).path
            if dims is None:
                bad_size.append('%s (cannot read its size)' % name)
            elif tuple(dims) != (1200, 630):
                bad_size.append('%s is %dx%d, not 1200x630' % (name, dims[0], dims[1]))
            else:
                ok += 1
            if len(resp.body) > 300 * 1024:
                big.append('%s %s' % (name, human(len(resp.body))))
        if bad_host:
            r.add(FAIL, 'share-image-host', 'Share pictures live on another address than the site: %s' % ', '.join(bad_host[:3]), 'Rebuild the pages with the right SITE (tools/pages.py) and upload again.')
        if bad_size:
            r.add(FAIL, 'share-image-size', 'Share pictures that are wrong or missing: %s. Facebook, WhatsApp and text messages show a broken or cropped preview.' % '; '.join(bad_size[:4]), 'Replace the picture with a 1200 x 630 pixel one (docs/LAUNCH_CHECKLIST.md, step 3.11).')
        if big:
            r.add(WARN, 'share-image-bytes', 'Share pictures over 300 KB: %s. Some apps skip big pictures.' % ', '.join(big), 'Make the picture smaller (checklist step 3.11).')
        if ok and not bad_size and not bad_host:
            r.add(PASS, 'share-image-size', 'All %d share pictures are 1200 x 630 pixels%s.' % (ok, '' if big else ' and under 300 KB'))
        # one domain in every address tag
        alltags = set()
        for pu, (resp, p) in pages:
            if '404' in pu or '/print/' in pu:
                continue
            for v in (p.canonical, p.meta('og:url'), p.meta('og:image'), p.meta('twitter:image')):
                if v.startswith('http'):
                    alltags.add(origin_of(v).lower())
        if len(alltags) > 1:
            r.add(FAIL, 'domain-mixed', 'The pages name more than one address in their canonical and share tags: %s.' % ', '.join(sorted(alltags)),
                  'Check SITE in tools/pages.py and the home page tags, rebuild, and upload again (docs/DECISION_PLAYBOOK.md, d38).')
        elif len(alltags) == 1:
            only = list(alltags)[0]
            if only == (urlsplit(self.base).scheme + '://' + urlsplit(self.base).netloc).lower() or self.local:
                r.add(PASS, 'domain-tags', 'The canonical, og:url, og:image and twitter:image tags all use one address: %s.' % only)

    def structured_data(self, pages):
        r = self.r
        n = 0
        bad = []
        hosts = set()

        def walk(o):
            # only the top level of each block: nested links (a booking address, a social page) legitimately point elsewhere
            roots = o if isinstance(o, list) else [o]
            for root in list(roots):
                if isinstance(root, dict) and isinstance(root.get('@graph'), list):
                    roots += root['@graph']
            for root in roots:
                if not isinstance(root, dict):
                    continue
                for k in ('url', '@id', 'image', 'logo'):
                    v = root.get(k)
                    if isinstance(v, str) and v.startswith('http'):
                        hosts.add(origin_of(v).lower())
        for pu, (resp, p) in pages:
            for a, text in p.scripts:
                if a.get('type', '').lower() == 'application/ld+json':
                    n += 1
                    try:
                        walk(json.loads(text))
                    except ValueError as e:
                        bad.append('%s (%s)' % (urlsplit(pu).path or '/', e))
        if bad:
            r.add(FAIL, 'jsonld', 'The structured data (JSON-LD) for Google is broken in: %s. Google ignores it.' % '; '.join(bad[:3]), 'Run python3 tools/pages.py and upload again; ask Claude if it repeats.')
        elif n:
            r.add(PASS, 'jsonld', 'The structured data for Google (%d block%s of JSON-LD) is valid.' % (n, '' if n == 1 else 's'))
        else:
            r.add(WARN, 'jsonld', 'No structured data (JSON-LD) was found on the pages.', 'Google shows less about the farm without it; ask Claude to check the home page.')
        if hosts and self.claimed:
            other = sorted(h for h in hosts if h != self.claimed.lower())
            if other:
                r.add(FAIL, 'jsonld-domain', 'The structured data names another address than the pages: %s.' % ', '.join(other), 'Change the address in the home page structured data (docs/DECISION_PLAYBOOK.md, d38) and upload again.')

    def mixed_content(self, pages, external):
        r = self.r
        if not self.https:
            r.add(PASS, 'mixed', 'Mixed content check skipped: this is a practice run over plain http.')
            return
        bad = []
        links = []
        for pu, (resp, p) in pages:
            for kind, url in p.refs:
                if url.lower().startswith('http://'):
                    bad.append('%s loads %s' % (urlsplit(pu).path or '/', url))
            for st in p.styles:
                for url in css_urls(st):
                    if url.lower().startswith('http://'):
                        bad.append('%s loads %s' % (urlsplit(pu).path or '/', url))
            for href in p.anchors:
                if href.lower().startswith('http://'):
                    links.append(href)
        for url, (final, chain) in getattr(self, 'asset_results', {}).items():
            if final.status == 200 and ext_of(url) == '.css':
                for ref in css_urls(final.text()):
                    if ref.lower().startswith('http://'):
                        bad.append('%s loads %s' % (urlsplit(url).path, ref))
        if bad:
            r.add(FAIL, 'mixed', 'Some pages load things over plain http://, which browsers block or mark as unsafe: %s' % '; '.join(bad[:4]), 'Change those addresses to https:// (or remove them) and upload again.')
        else:
            r.add(PASS, 'mixed', 'No page loads anything over plain http:// (no mixed content).')
        if links:
            r.add(WARN, 'http-links', '%d link%s on the pages point to http:// addresses (for example %s).' % (len(links), '' if len(links) == 1 else 's', links[0]), 'Use the https:// version of those links if the other site has one.')

    # ---------------------------------------------------------------------------- 4. old addresses
    def old_addresses(self):
        r = self.r
        r.head('4. Old farm addresses (your decision)')
        if self.softok:
            r.add(WARN, 'old-skipped', 'The old addresses were not checked because this host answers 200 for every address.')
            return
        ok, gone = [], []
        for path in OLD_ADDRESSES:
            try:
                first = self.get(self.u(path))
            except FetchError as e:
                r.add(WARN, 'old:' + path, '%s could not be checked (%s).' % (path, e.message))
                continue
            if first.status in (301, 302, 303, 307, 308):
                try:
                    final, chain = self.follow(self.u(path), max_hops=4)
                except FetchError:
                    final, chain = first, [first]
                if final.status == 200:
                    ok.append((path, final.url))
                else:
                    r.add(WARN, 'old:' + path, '%s redirects, but the page it leads to answers %d.' % (path, final.status), 'Fix the destination of this redirect (checklist step 3.6).')
            elif first.status == 200:
                r.add(WARN, 'old:' + path, '%s answers 200 (it shows a page).' % path, 'If this is not meant, remove it; otherwise nothing to do.')
            else:
                gone.append(path)
        if ok:
            r.add(PASS, 'old-redirects', 'Old addresses that are forwarded to a page: ' + ', '.join('%s -> %s' % (p, urlsplit(u).path or '/') for p, u in ok) + '.')
        if gone:
            r.add(WARN, 'old-gone', 'These old addresses show "page not found": %s. People who still have them bookmarked, and Google, land on an error.' % ', '.join(gone),
                  'It is your decision. To forward them to the new pages, use one of the redirect patches (docs/DECISION_PLAYBOOK.md, d30; checklist step 3.6). Leaving them is fine if the new site replaces nothing.')

    # ---------------------------------------------------------------------------- 5. content and settings
    def content_section(self):
        r = self.r
        r.head('5. Leftovers and settings only you can make')
        warn_words = [('Draft pricing', 'Draft pricing'), ('confirm before publishing', 'confirm before publishing'), ('Prices coming soon', 'Prices coming soon')]
        fail_words = [('TODO', re.compile(r'\bTODO\b')), ('lorem ipsum', re.compile(r'\blorem\b', re.I)), ('example.com', re.compile(r'example\.(com|org|net)\b', re.I)),
                      ('YOUR_ / PASTE IT HERE', re.compile(r'YOUR_[A-Z0-9_]+|YOURNAME|PASTE IT HERE'))]
        counts = {w: 0 for w, _ in warn_words}
        where = {}
        hits = {}
        demo_visible = []
        sitecheck = []
        for url in self.page_urls:
            resp, p = self.pages[url]
            name = urlsplit(url).path.lstrip('/') or 'index.html'
            alltext = ' '.join(t for t, h in p.texts) + ' ' + ' '.join(p.attr_texts)
            for w, needle in warn_words:
                c = alltext.count(needle)
                if c:
                    counts[w] += c
                    where.setdefault(w, set()).add(name)
            for w, rx in fail_words:
                m = rx.findall(alltext)
                if m:
                    hits.setdefault(w, set()).add(name)
            for t, hid in p.texts:
                if not hid and re.search(r'Preview example only|These spots are not real', t):
                    demo_visible.append(name)
            if 'wa-problems' in p.ids or any(re.search(r'Site check: \d+ thing', t) for t, h in p.texts):
                sitecheck.append(name)
        if hits:
            r.add(FAIL, 'placeholders-fail', 'Leftover placeholder text on the pages: %s.' % '; '.join('%s in %s' % (w, ', '.join(sorted(v))) for w, v in sorted(hits.items())), 'Remove the placeholder text (ask Claude) and upload again.')
        else:
            r.add(PASS, 'placeholders-fail', 'No leftover TODO, lorem ipsum, example.com or YOUR_ placeholders on the pages.')
        if demo_visible:
            r.add(FAIL, 'demo-label', 'A preview/example label is visible to visitors on: %s.' % ', '.join(sorted(set(demo_visible))), 'Remove the demo setting (ask Claude).')
        for w, _ in warn_words:
            if counts[w]:
                r.add(WARN, 'placeholder:' + w, 'The pages still say "%s" %d time%s (%s). Visitors see this unfinished text.' % (w, counts[w], '' if counts[w] == 1 else 's', ', '.join(sorted(where[w]))),
                      {'Draft pricing': 'Give the real prices for company events, or a "Custom quote" (docs/DECISION_PLAYBOOK.md, d02).',
                       'confirm before publishing': 'Give the real prices for company events (docs/DECISION_PLAYBOOK.md, d02).',
                       'Prices coming soon': 'Send the price list, or remove the lines (docs/DECISION_PLAYBOOK.md, d54).'}[w])
        if not any(counts.values()):
            r.add(PASS, 'placeholders-warn', 'No "Draft pricing", "confirm before publishing" or "Prices coming soon" left on the pages.')
        # the Site check box
        feat = None
        try:
            feat = self.get(self.u('/js/features.js'))
        except FetchError:
            pass
        guard = bool(feat and feat.status == 200 and re.search(r'\[\?&\]check', feat.text()))
        if sitecheck:
            r.add(FAIL, 'site-check', 'The yellow "Site check" box is part of the page HTML on: %s. Visitors would see it.' % ', '.join(sitecheck), 'Remove it (ask Claude).')
        elif feat is not None and feat.status == 200 and not guard:
            r.add(FAIL, 'site-check', 'The rule that hides the yellow "Site check" box from visitors was not found in js/features.js. Visitors might see it.', 'Ask Claude to check js/features.js.')
        else:
            r.add(PASS, 'site-check', 'The yellow "Site check" box is not shown to visitors (it only appears when ?check is added to the address). To look at it yourself, open %s/?check' % self.base)
        # js/content.js as served
        try:
            cj = self.get(self.u('/js/content.js'))
        except FetchError:
            cj = None
        if cj is None or cj.status != 200:
            r.add(WARN, 'settings', 'js/content.js could not be read, so the owner settings were not checked.')
            return
        src = cj.text()
        idx = src.find('window.WISE_ACRES = {')
        conf = src[idx:] if idx >= 0 else src

        def setting(name, rx):
            m = re.search(r'^\s*' + name + r'\s*:\s*' + rx, conf, re.M)
            return m
        # season switcher
        m = setting('seasonPicker', r'(true|false)')
        if m and m.group(1) == 'true':
            r.add(WARN, 'setting-season', 'Owner setting: the "See the farm in a different season" switcher is ON for visitors (seasonPicker: true in js/content.js).',
                  'It is meant for previewing. Set seasonPicker: false before the real launch (checklist step 3.8) and upload js/content.js again.')
        elif m:
            r.add(PASS, 'setting-season', 'Owner setting: the season switcher is off for visitors (seasonPicker: false).')
        # analytics
        m = re.search(r'analytics\s*:\s*\{([^}]*)\}', conf)
        prov = quoted_text(re.search(r'\bprovider\s*:\s*' + QUOTED_TEXT, m.group(1))) if m else ''
        if prov in ('', 'none'):
            r.add(PASS, 'setting-analytics', 'Owner setting: analytics is OFF (no visitor counts are collected). That is the default (checklist, decision D5).')
        elif prov in ('plausible', 'goatcounter', 'umami', 'cloudflare'):
            r.add(PASS, 'setting-analytics', 'Owner setting: analytics is ON with %s. Check that the site is listed in that service and that the privacy sentence on the site is true.' % prov)
        else:
            r.add(WARN, 'setting-analytics', 'Owner setting: analytics provider "%s" is not one the site knows.' % prov, 'Use none, plausible, goatcounter, umami or cloudflare (js/analytics.js explains each).')
        # email signup
        action = quoted_text(re.search(r'^\s*signup\s*:\s*\{[^}]*?\baction\s*:\s*' + QUOTED_TEXT, conf, re.M))
        if action:
            r.add(PASS, 'setting-signup', 'Owner setting: the email signup form is connected to Mailchimp. Sign up once with your own address to be sure.')
        else:
            r.add(WARN, 'setting-signup', 'Owner setting: the email signup form is not connected yet, so visitors see a plain "Join the email list" button.', 'Optional: send the Mailchimp form code to Claude (docs/QUESTIONS_FOR_THE_FARM.md, question 26).')
        # review link
        review = quoted_text(re.search(r'^\s*reviewUrl\s*:\s*' + QUOTED_TEXT, conf, re.M))
        if review.strip():
            r.add(PASS, 'setting-review', 'Owner setting: the Google review link is set (%s).' % review)
        else:
            r.add(WARN, 'setting-review', 'Owner setting: the Google review link is not set, so "Leave a Google review" buttons only open the farm on Google Maps.', 'Paste your review link (Google Business Profile, Ask for reviews) into js/content.js (checklist step 3.12).')
        # exact farm spot
        m = setting('farmPoint', r'(null|\{[^}]*\})')
        if m and m.group(1) != 'null':
            lat = re.search(r'lat\s*:\s*(-?[\d.]+)', m.group(1))
            lon = re.search(r'lon\s*:\s*(-?[\d.]+)', m.group(1))
            try:
                la, lo = float(lat.group(1)), float(lon.group(1))
                good = 34.5 <= la <= 35.6 and -81.3 <= lo <= -79.9
            except Exception:
                la = lo = None
                good = False
            if good:
                r.add(PASS, 'setting-farmpoint', 'Owner setting: the farm\'s exact spot is set (%s, %s), so the Drive time box is faster and more exact.' % (la, lo))
            else:
                r.add(FAIL, 'setting-farmpoint', 'Owner setting: farmPoint is set but does not look like Indian Trail, NC (%s). The two numbers may be swapped or mistyped.' % m.group(1), 'Check the two numbers copied from Google Maps (latitude about 35.1, longitude about -80.6) and fix js/content.js.')
        else:
            r.add(WARN, 'setting-farmpoint', 'Owner setting: the farm\'s exact spot is not set, so the Drive time box has to search for the address on every first press.',
                  'Send the two numbers from Google Maps (docs/QUESTIONS_FOR_THE_FARM.md, question 35).')
        # a leftover notice
        # (a text in single or double quotes, or in the five languages: notice: { en: '...', es: '...' }, which is how js/content.js says to write it)
        m = setting('notice', r'''(?:'([^']*)'|"([^"]*)"|\{[^}]*?\ben\s*:\s*(?:'([^']*)'|"([^"]*)"))''')
        text = next((g for g in m.groups() if g), '') if m else ''
        if text.strip():
            r.add(WARN, 'setting-notice', 'Owner setting: a notice bar is switched on for every visitor: "%s".' % text[:80], 'Remove it from js/content.js when it is no longer true.')
        # demo data
        demo = [n for n, t in (('js/content.js', src),) if re.search(r'\bdemo\s*:\s*true', conf)]
        try:
            fm = self.get(self.u('/js/farm-map-data.js'))
            if fm.status == 200 and re.search(r'"demo"\s*:\s*true', fm.text()):
                demo.append('js/farm-map-data.js')
        except FetchError:
            pass
        if demo:
            r.add(FAIL, 'demo-data', 'Preview/demo data is switched on in %s. Visitors would see example spots or an example map.' % ', '.join(demo), 'Remove the demo setting (ask Claude).')

    # ---------------------------------------------------------------------------- 6. timings
    def timing_section(self):
        r = self.r
        r.head('6. Speed')
        assets = getattr(self, 'assets', {})
        rows = []
        slow, heavy = [], []
        for url in self.page_urls:
            resp, p = self.pages[url]
            name = urlsplit(url).path.lstrip('/') or 'index.html'
            weight = resp.wire
            later = 0
            seen = set()
            for kind, ref in p.refs + [('img', c) for st in p.styles for c in css_urls(st)]:
                full = urldefrag(urljoin(url, ref))[0]
                if full in seen:
                    continue
                seen.add(full)
                res = self.asset_results.get(full) if hasattr(self, 'asset_results') else None
                if res and res[0].status == 200:
                    if kind == 'img-lazy':
                        later += res[0].wire
                        continue
                    weight += res[0].wire
                    if kind == 'css':
                        for cref in css_urls(res[0].text()):
                            cf = urldefrag(urljoin(full, cref))[0]
                            if cf not in seen:
                                seen.add(cf)
                                rr = self.asset_results.get(cf)
                                if rr and rr[0].status == 200:
                                    weight += rr[0].wire
            rows.append((name, resp.ttfb, resp.wire, weight, later))
            if resp.ttfb > 1.5:
                slow.append('%s %.1f s' % (name, resp.ttfb))
            if weight > 1.5 * 1024 * 1024:
                heavy.append('%s %s' % (name, human(weight)))
        if not rows:
            return
        if slow:
            r.add(WARN, 'timing-ttfb', 'These pages are slow to start (over 1.5 seconds before the first byte): %s.' % ', '.join(slow), 'Try again later in case of a one-off. If it stays slow, ask the host about the region or plan.')
        else:
            r.add(PASS, 'timing-ttfb', 'Pages start quickly: the first byte arrives within %.2f s on all %d pages (slowest %.2f s).' % (max(x[1] for x in rows), len(rows), max(x[1] for x in rows)))
        if heavy:
            r.add(WARN, 'timing-weight', 'These pages are heavy when they open (over 1.5 MB with their styles, scripts, fonts and the pictures that load at once): %s.' % ', '.join(heavy), 'Large pictures are the usual cause; ask Claude to shrink them.')
        else:
            big = max(rows, key=lambda x: x[3])
            r.add(PASS, 'timing-weight', 'No page is heavy when it opens: the largest is %s (%s) with its styles, scripts, fonts and first pictures; pictures further down load only as the visitor scrolls (up to %s more).' % (human(big[3]), big[0], human(max(x[4] for x in rows))))
        if not self.r.as_json:
            r.add(PASS, 'timing-table', 'Per page (first byte; the page; when it opens; pictures that load later): ' + '; '.join('%s %.2f s, %s, %s, +%s' % (n, t, human(w), human(tw), human(lt)) for n, t, w, tw, lt in rows[:8]) + '.')


# ------------------------------------------------------------------------------------------------ main
def normalize_address(text):
    t = text.strip()
    if not re.match(r'^[a-z][a-z0-9+.-]*://', t, re.I):
        t = 'https://' + t
    try:
        sp = urlsplit(t)
        sp.port
    except ValueError:
        return None
    host = sp.hostname or ''
    if sp.scheme not in ('http', 'https') or not host or not (re.match(r'^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$', host) or ':' in host and re.match(r'^[0-9A-Fa-f:.]+$', host)):
        return None
    return '%s://%s' % (sp.scheme, sp.netloc.rpartition('@')[2].lower()), (sp.path not in ('', '/'))   # without "name:password@": the fetcher never sends it, and it must not be printed


def summary_text(rep, checker, address, quick):
    f, w, p = rep.count(FAIL), rep.count(WARN), rep.count(PASS)
    local = checker.local
    elapsed = time.time() - checker.started
    out = '%d checks passed, %d warning%s, %d failure%s (%d requests, %.0f s). ' % (p, w, '' if w == 1 else 's', f, '' if f == 1 else 's', checker.f.count, elapsed)
    if f:
        out += ('NOT READY: something is broken, so fix the FAIL lines first (top to bottom: the first ones often cause the later ones) and run this check again. ')
        if w:
            out += 'The warnings can wait until the failures are gone. '
    elif w:
        out += ('Nothing is broken. The warnings are things only you can decide or set (prices, links, optional services) or small improvements; read each "What to do" and decide which ones matter before you announce the site. ')
    else:
        out += 'Everything checked out. '
    if local:
        out += 'This was a practice run on your own computer, so run it again on the real address (https://...) once the site is online. '
    if quick:
        out += 'This was the quick check (pages and headers only); run it without --quick for the files, old addresses and settings. '
    return out.strip()


def run(argv):
    ap = argparse.ArgumentParser(prog='launch_check.py', description='Check the live Wise Acres website the way a visitor sees it.')
    ap.add_argument('address', help='the address of the site, for example https://www.wiseacresorganic.com/ (or http://127.0.0.1:8000/ for a practice run)')
    ap.add_argument('--quick', action='store_true', help='only the pages and the headers')
    ap.add_argument('--json', action='store_true', help='print the result as JSON')
    ap.add_argument('--live', action='store_true', help='treat the address as the real site even if it is on this computer (a rehearsal)')
    ap.add_argument('--insecure', action='store_true', help='do not check the HTTPS certificate (test addresses only)')
    ap.add_argument('--timeout', type=float, default=20.0, help='seconds to wait for each answer (default 20)')
    try:
        args = ap.parse_args(argv)
    except SystemExit as e:
        return 2 if e.code else 0
    norm = normalize_address(args.address)
    if not norm:
        print('That does not look like a web address: %s\nGive the full address, for example https://www.wiseacresorganic.com/' % without_login(args.address), file=sys.stderr)
        return 2
    base, had_path = norm
    rep = Report(args.json)
    fetcher = Fetcher(timeout=args.timeout, insecure=args.insecure)
    chk = Checker(base, rep, fetcher, args.quick, args.live)
    if not args.json:
        print('Wise Acres launch check %s for %s' % (VERSION, base + '/'))
        print('(PASS = fine, WARN = needs a decision or a setting from you, FAIL = broken, fix it before you announce the site)')
    if had_path and not args.json:
        print('Note: only the address of the site (%s/) is used; the rest of what you typed is ignored.' % base)
    code = 0
    try:
        if chk.reach():
            chk.pages_section()
            chk.headers_section()
            if not args.quick:
                chk.assets_section()
                chk.old_addresses()
                chk.content_section()
                chk.timing_section()
    except KeyboardInterrupt:
        print('\nStopped.')
        return 1
    except BrokenPipeError:
        return 1
    except FetchError as e:
        rep.add(FAIL, 'abort', chk.error_text(e), 'Run the check again.')
    except Exception as e:  # a bug in the checker must never look like a good result
        rep.add(FAIL, 'checker-error', 'The checker itself hit a problem (%s: %s). The results above are incomplete.' % (e.__class__.__name__, e), 'Run it again; if it repeats, send this message to Claude.')
    if rep.count(FAIL):
        code = 1
    text = summary_text(rep, chk, base, args.quick)
    if args.json:
        print(json.dumps({'address': base + '/', 'quick': args.quick, 'dry_run': chk.local, 'host': chk.hostinfo[1], 'counts': {'pass': rep.count(PASS), 'warn': rep.count(WARN), 'fail': rep.count(FAIL)},
                          'results': rep.items, 'summary': text, 'exit_code': code}, indent=1, ensure_ascii=False))
    else:
        print('')
        print('== Summary ==')
        print('\n'.join(textwrap.wrap(text, 90)))
    return code


def main():
    try:
        sys.stdout.reconfigure(errors='replace')
        sys.stderr.reconfigure(errors='replace')
    except Exception:
        pass
    try:
        return run(sys.argv[1:])
    except BrokenPipeError:   # the output was piped into something that closed (for example "| head")
        try:
            sys.stdout = open(os.devnull, 'w')
        except Exception:
            pass
        return 1


if __name__ == '__main__':
    sys.exit(main())
