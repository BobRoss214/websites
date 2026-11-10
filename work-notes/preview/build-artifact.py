#!/usr/bin/env python3
"""Builds the claude.ai preview of the Wise Acres site: one folder that is published as a multi-file Artifact.

  python3 work-notes/preview/build-artifact.py                       the preview, with the demo and tour switched on (flags)
  python3 work-notes/preview/build-artifact.py --no-flags --out DIR  the same pages WITHOUT the flags (to prove the demo and the tour stay hidden)
  python3 work-notes/preview/build-artifact.py --repo DIR --out DIR  another site folder / another output folder

What it makes in the output folder (default /tmp/preview-out; never inside the site folder):
  index.html          the home page as ONE fragment (the Artifact tool wraps it in a page of its own when it is published)
  <page>.html         every other built page of the site: all root *.html except index.html and 404.html that load js/main.js.
                      Found by themselves, so account.html, farm-desk.html and kitchen.html come in as soon as they exist.
  assets/...          the photos (and any other picture a page shows) the pages point at, because the Artifact serves only what is published
  build-info.json     what was built (commit, flags, pages, sizes, the list of files to publish). NOT published.
  publish-files.json  the `files` list for the Artifact tool, ready to paste (use root = the output folder, file_path = index.html). NOT published.

Every page is self-contained: each <link rel="stylesheet" href="css/..."> becomes an inline <style> and each <script src="js/..."> an inline
<script>, in the SAME place, so the order the real page runs in is kept. Fonts become data: addresses. The viewer lets pages load only their own
published files, so nothing is fetched later: the files that a script asks for by code (css/tour.css, js/tour-steps*.js, js/shop-pop-box.js, css/shop-pop.css)
are put in the page too, in front of the script that asks (the list LAZY below).

FLAGS (default on; --no-flags leaves them out): the FIRST script of every page is
    window.WA_DEMO = true; window.WA_TOUR = true; window.WA_TOUR_INLINE = true;
They are what makes the "Sign in" button and the "Take a tour" pill show. The real site never has them.
TOUR (flags on only): css/tour.css and every js/tour-steps*.js are put right in front of js/tour.js (WA_TOUR_INLINE tells the engine not to ask for
those files). Without flags the pages carry exactly what the real site carries, and the demo and the tour do nothing.
SHOP POP-UP ("What to buy": a card grows under the pointer, a click opens a box with the ingredients): js/shop-pop.js (a small loader) and js/shop-sample.js
(PRETEND ingredients) are plain <script src> tags of the home page, so they are inlined like every other script. The loader asks for js/shop-pop-box.js (the cards'
buttons and the box) only when the sample is on the page and the box has not already said it is there (window.WISE_ACRES.shopPop), and the box asks for
css/shop-pop.css when a card is first touched, unless a <style data-shop-pop-css> is already in the page. So the build puts both in front of the loader, in BOTH builds
(they belong to the site, not to the flags): the box script, which sets shopPop, and the style, with exactly that marker. A site folder without js/shop-sample.js (what the
real site gets until the farm gives its real lists) builds the same way and the pop-up just stays asleep: no control on any card (the test checks that state too).
build-info.json says what was put in (`lazy`) and which files only the build with the flags carries (`flags_only`: the tour's), so the test needs no list of its own.

Preview-only code (not in the real site): a storage fallback (window.name) for a frame that refuses localStorage, right after the flags; and, in front
of js/i18n.js, the IntersectionObserver fix for the viewer's frame, the sign-up form in demo mode, example weekly spots, and the viewer's own save
dialog for files.
Limits of the Artifact (checked): a page or file 16 MiB, a binary file 15 MiB, 255 files and 64 MiB in one publish, 511 files and 256 MiB in all.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIB = 1024 * 1024
LIMITS = {'page': 16 * MIB, 'text_file': 16 * MIB, 'binary_file': 15 * MIB, 'files_per_publish': 255, 'bytes_per_publish': 64 * MIB,
          'files_per_version': 511, 'bytes_per_version': 256 * MIB}
BINARY_EXT = {'.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif', '.ico', '.woff2', '.mp4', '.webm', '.pdf'}
PICTURE_EXT = ('.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif', '.svg')
NOT_PAGES = ('index.html', '404.html')
INFO_NAME = 'build-info.json'
PLAN_NAME = 'publish-files.json'      # the exact `files` list for the Artifact tool (with root = the output folder); like build-info.json it is NOT published

FLAGS = '<script>window.WA_DEMO = true; window.WA_TOUR = true; window.WA_TOUR_INLINE = true;</script>'

# ---- the lazy files (a new feature is one more line here, nothing else in this file) ----------------------------------------------------------
# The viewer serves only the files that were published, so a script that asks for a style or a script file by code (the tour opening, a Store card being touched)
# would find nothing. The build puts every such file in the page itself, right in front of the <script> tag of the script that asks for it, with the very marker that
# script looks for before it asks: a loader that finds its marker asks for no file at all (the test fails on any request for a js/ or css/ file). One entry for each
# file, or for a group of files:
#   script    the file that asks for it: its own <script src> tag in the page carries the blocks, or, for a file that is itself lazy, its own block. A list of files:
#             the first one that is in the site and mentions the marker or flag is the one that asks (a loader and the file it loads may be folded into one)
#   kind      'css' (a <style> block) or 'js' (a <script> block)
#   file      the site file; or  pattern  = a regular expression for the whole path of several files (sorted). A file the site does not have is skipped.
#   marker    the attribute put on the <style> or <script>, written as the loader looks for it, for example  data-shop-pop-css  ('' = none)
#   flag      instead of an attribute: the name of a global (window.WISE_ACRES.<flag>) that the lazy script sets when it runs and the loader looks at before it asks.
#             ('' = none: a flag of the page tells the loader, as WA_TOUR_INLINE does for the tour). The build says so (NOTE) when the loader never mentions the
#             marker or the flag, or the lazy script never mentions the flag: the copy in the page would not be seen and the file would be asked for.
#   optional  True: a missing file is no NOTE (a site that keeps the code in one file has no such file)
#   flags     True: only in the build WITH the flags (it is preview-only: the tour); False: in both builds (it belongs to the site)
LAZY = [
    dict(script='js/tour.js', kind='css', file='css/tour.css', marker='', flag='', optional=False, flags=True),
    dict(script='js/tour.js', kind='js', pattern=r'js/tour-steps[A-Za-z0-9-]*\.js', marker='', flag='', optional=False, flags=True),
    dict(script='js/shop-pop.js', kind='js', file='js/shop-pop-box.js', marker='', flag='shopPop', optional=True, flags=False),
    dict(script=['js/shop-pop-box.js', 'js/shop-pop.js'], kind='css', file='css/shop-pop.css', marker='data-shop-pop-css', flag='', optional=False, flags=False),
]

# ---- preview-only code ------------------------------------------------------------------------------------------------------------------
# 1. runs first (right after the flags): a frame that refuses storage gets a stand-in kept in window.name.
STORAGE_FALLBACK = r'''
// Preview only. Some browsers refuse storage inside the viewer's frame (a private window, or "block data from other sites"): just touching
// window.localStorage then throws. The pretend account lives in storage and is shared by separate page files, so keep the data of the tab in
// window.name instead: it follows the visitor from page to page. Nothing changes when storage works.
(function () {
  // localStorage is only read here (a write would wake the "storage" listener of every other open tab); sessionStorage is written (it tells no other tab)
  function works(kind) { try { var s = window[kind]; if (kind === 'localStorage') { void s.length; return true; } s.setItem('wa-probe', '1'); s.removeItem('wa-probe'); return true; } catch (e) { return false; } }
  var want = [];
  if (!works('localStorage')) want.push('localStorage');
  if (!works('sessionStorage')) want.push('sessionStorage');
  if (!want.length) return;
  var MARK = 'wa-preview-storage:', all = {}, kept = '';
  try {
    var n = String(window.name || '');
    if (n.indexOf(MARK) === 0) { var j = JSON.parse(n.slice(MARK.length)); all = (j && j.d) || {}; kept = (j && j.n) || ''; } else kept = n;
  } catch (e) { all = {}; }
  function save() { try { window.name = MARK + JSON.stringify({ n: kept, d: all }); } catch (e) {} }
  want.forEach(function (kind) {
    var data = all[kind] || (all[kind] = {}), has = Object.prototype.hasOwnProperty;
    var shim = {
      getItem: function (k) { return has.call(data, String(k)) ? data[String(k)] : null; },
      setItem: function (k, v) { data[String(k)] = String(v); save(); },
      removeItem: function (k) { delete data[String(k)]; save(); },
      clear: function () { Object.keys(data).forEach(function (k) { delete data[k]; }); save(); },
      key: function (i) { var ks = Object.keys(data); return i >= 0 && i < ks.length ? ks[i] : null; }
    };
    Object.defineProperty(shim, 'length', { get: function () { return Object.keys(data).length; } });
    try { Object.defineProperty(window, kind, { configurable: true, get: function () { return shim; } }); } catch (e) {}
  });
  window.WA_PREVIEW_STORAGE_FALLBACK = want.join(',');
})();
'''

# 2. goes in front of js/i18n.js (after js/content.js has made window.WISE_ACRES).
PREVIEW = r'''
// The preview runs in a frame from another origin. There the browser ignores `rootMargin` for an observer that has no root, so the
// menu highlight (it watches a band in the middle of the screen), the fade-ins and the farm-map pre-drawing all behave differently from
// the real page: the highlight goes to whichever section edge came into view last (Tomatoes when you click Pizza). Naming the document
// as the root brings the margins back (same result as on the real site). An old browser that cannot do it is left alone.
(function () {
  var Native = window.IntersectionObserver;
  if (!Native || Native.__waRoot) return;
  try { new Native(function () {}, { root: document }).disconnect(); } catch (e) { return; }
  function Observer(callback, options) {
    var o = {}, k;
    if (options) for (k in options) o[k] = options[k];
    if (!o.root) o.root = document;
    return new Native(callback, o);
  }
  Observer.prototype = Native.prototype; Observer.__waRoot = true;
  window.IntersectionObserver = Observer;
})();
// Preview-only extras. They are NOT in the real site: the signup form works in "demo" mode, and example weekly spots are shown,
// each clearly labelled as an example.
(function () {
  var W = window.WISE_ACRES;
  function ymd(n) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() + n * 864e5)); }
  W.signup = W.signup || {}; W.signup.demo = true;
  // the preview viewer blocks plain downloads, so calendar files go through its own save dialog
  W.saveFile = function (name, blob) { try { window.claude.use('downloads').then(function (d) { if (d) d.save({ filename: name, data: blob }).catch(function () {}); }); } catch (e) {} };
  W.week = { demo: true, updated: ymd(0), note: 'Example note: this is where you tell families what is ripe this week.', crops: { tomatoes: 'peak', pumpkins: 'starting' },
    days: [ { date: ymd(1), farm: 'few', pizza: 'open', note: 'Example' }, { date: ymd(2), farm: 'full', pizza: 'full' }, { date: ymd(3), farm: 'closed', pizza: 'none' } ] };
})();
'''

# ---- small helpers ----------------------------------------------------------------------------------------------------------------------
COMMENT = re.compile(r'(<!--.*?-->)', re.S)
TAG = re.compile(r'<script\b(?P<sa>[^>]*)>.*?</script>|<link\b(?P<la>[^>]*?)/?>', re.S | re.I)   # a whole <script ...>...</script>, or a <link ...>
ATTR = re.compile(r'([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'>]+)))?')


def attrs_of(text):
    out = {}
    for m in ATTR.finditer(text):
        out[m.group(1).lower()] = next((g for g in m.groups()[1:] if g is not None), '')
    return out


def esc_js(js):
    """Script text that cannot end its <script> early or start an HTML comment."""
    return re.sub(r'</(script)', r'<\\/\1', js, flags=re.I).replace('<!--', '<\\!--')


def fail(msg):
    sys.exit('ERROR: ' + msg)


def human(n):
    return '%.1f MB' % (n / MIB) if n >= MIB else '%d KB' % round(n / 1024)


class Builder:
    def __init__(self, repo, out, flags):
        self.repo, self.out, self.flags = repo, out, flags
        self.font_cache = {}
        self.used_css, self.used_js = set(), set()
        self.lazy = {}        # file -> what LAZY put in front of the script that asks for it (the script, the kind, the marker, the flag, the pages)
        self.warnings = []
        self.patched = {'sticky header': 0, 'bottom bar': 0}
        self._dicts = None
        self._commit = None

    # -- reading
    def path(self, rel):
        return os.path.join(self.repo, *rel.split('/'))

    def exists(self, rel):
        return os.path.isfile(self.path(rel))

    def read(self, rel):
        with open(self.path(rel), encoding='utf-8-sig') as f:
            return f.read()

    def warn(self, msg):
        if msg not in self.warnings:
            self.warnings.append(msg)

    # -- css
    def font_uri(self, m):
        name = m.group(1)
        if name not in self.font_cache:
            with open(self.path('assets/fonts/' + name), 'rb') as f:
                self.font_cache[name] = 'url("data:font/woff2;base64,' + base64.b64encode(f.read()).decode() + '")'
        return self.font_cache[name]

    def css_text(self, rel):
        css = self.read(rel)
        css = re.sub(r'url\("\.\./assets/fonts/([^"]+)"\)', self.font_uri, css)
        css = re.sub(r'url\((["\']?)\.\./assets/', r'url(\1assets/', css)   # any other picture: the page sits next to assets/ when it is published
        for key, old, new in (
            ('sticky header', '.site-header{position:sticky;top:0;', '.site-header{position:sticky;top:env(safe-area-inset-top,0px);'),
            ('bottom bar', 'position:fixed;left:8px;right:8px;bottom:8px;', 'position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));'),
        ):
            if old in css:
                self.patched[key] += css.count(old)
                css = css.replace(old, new)
        return css

    # -- the language dictionaries
    def dicts(self):
        if self._dicts is None:
            self._dicts = '\n'.join(self.read('lang/%s.js' % c) for c in ('es', 'hi', 'zh', 'vi'))
        return self._dicts

    # -- one <script src="js/..."> or <link> becomes inline text
    def style_block(self, rel, media='', marker=''):
        """A <style> with the text of css/... ; `marker` (for example  data-shop-pop-css) goes on the tag, as a loader that looks for it expects."""
        self.used_css.add(rel)
        attrs = (' ' + marker if marker else '') + (' media="%s"' % media.replace('"', '&quot;') if media and media.lower() != 'all' else '')
        return '<style' + attrs + '>\n' + self.css_text(rel) + '\n/*# sourceURL=' + rel + ' */\n</style>'

    def inline_script(self, rel, marker='', js=None):
        """A <script> with the text of js/... (or of `js`, a changed copy of it); the name of the file stays in the debugger as its sourceURL."""
        self.used_js.add(rel)
        return '<script%s>\n' % (' ' + marker if marker else '') + esc_js(self.read(rel) if js is None else js) + '\n//# sourceURL=' + rel + '\n</script>'

    def lazy_files(self, entry):
        """The site files that one entry of LAZY names and that are really there (sorted)."""
        if 'file' in entry:
            return [entry['file']] if self.exists(entry['file']) else []
        folder = entry['pattern'].split('/')[0]
        d = self.path(folder)
        return sorted(folder + '/' + f for f in os.listdir(d) if re.fullmatch(entry['pattern'], folder + '/' + f)) if os.path.isdir(d) else []

    def asker_of(self, e):
        """The script that asks for the file of entry `e` of LAZY (`script` is one file, or a list: the first that is in the site and mentions the marker or flag)."""
        cands = e['script'] if isinstance(e['script'], (list, tuple)) else [e['script']]
        needle = e['marker'].split('=')[0] or e['flag']
        for c in cands:
            if self.exists(c) and (not needle or needle in self.read(c)):
                return c
        return next((c for c in cands if self.exists(c)), cands[0])

    def lazy_blocks(self, script, page, depth=0):
        """The blocks that go right in front of `script`: the files it asks for by code (LAZY), already in the page, with the marker it looks for first.
        A lazy script brings the files it asks for itself, in front of its own block."""
        out = []
        for e in LAZY:
            if (e['flags'] and not self.flags) or self.asker_of(e) != script:
                continue
            files = self.lazy_files(e)
            if not files and 'file' in e and not e['optional']:
                self.warn('%s is in the page but %s, which it asks for, is not in the site folder' % (script, e['file']))
            for rel in files:
                needle = e['marker'].split('=')[0] or e['flag']
                if needle:
                    if needle not in self.read(script):
                        self.warn('%s never mentions "%s", which the preview puts on %s so that the loader sees the copy in the page: it would ask for the file, which is not '
                                  'published. Change the marker or the flag in LAZY (top of work-notes/preview/build-artifact.py) to the one the loader looks for.' % (script, needle, rel))
                    if e['flag'] and e['flag'] not in self.read(rel):
                        self.warn('%s never mentions "%s", which %s looks at before it asks for the file: the loader would ask for it all the same' % (rel, e['flag'], script))
                if e['kind'] == 'css':
                    out.append(self.style_block(rel, marker=e['marker']))
                else:
                    out.extend(self.lazy_blocks(rel, page, depth + 1) if depth < 3 else [])      # what this script asks for in its turn goes in front of it
                    out.append(self.inline_script(rel, e['marker']))
                got = self.lazy.setdefault(rel, {'script': script, 'kind': e['kind'], 'marker': e['marker'], 'flag': e['flag'], 'pages': set()})
                got['pages'].add(page)
        return out

    def script_block(self, rel, page=''):
        name = rel[3:-3]
        self.used_js.add(rel)
        if name == 'guard':
            return ''                                  # only for the "Site check" box, which the preview does not have
        js = self.read(rel)
        if name == 'i18n':
            js = PREVIEW + '\n' + self.dicts() + '\n' + js
        return '\n'.join(self.lazy_blocks(rel, page) + [self.inline_script(rel, js=js)])

    def flags_only_files(self):
        """Every file of the site that only the build WITH the flags carries (the lazy ones with flags=True), if the site has it."""
        found = set()
        for e in LAZY:
            if e['flags']:
                found.update(self.lazy_files(e))
        return sorted(found)

    def convert(self, text, page, collect=None):
        """Turns the stylesheet links and the script tags of `text` into inline ones, in place (comments are left alone).
        With `collect` (a list) the new blocks go into it, in order, and the text keeps nothing of them (used for the home page's <head>)."""
        parts = COMMENT.split(text)
        for i in range(0, len(parts), 2):
            parts[i] = self._convert_plain(parts[i], page, collect)
        return ''.join(parts)

    def _convert_plain(self, text, page, collect):
        def put(block):
            if collect is not None:
                if block:
                    collect.append(block)
                return ''
            return block

        def keep(m):
            return m.group(0) if collect is None else ''

        def link(m):
            a = attrs_of(m.group('la'))
            rel, href = a.get('rel', '').lower().split(), a.get('href', '')
            if 'preload' in rel:
                return put('')                          # the fonts are inline
            if 'stylesheet' in rel and href.startswith('css/') and 'alternate' not in rel:
                if not self.exists(href):
                    fail('%s points at %s, which is not in the site folder.' % (page, href))
                odd = sorted(k for k in a if k not in ('rel', 'href', 'media'))
                if odd:
                    self.warn('%s: <link rel="stylesheet" href="%s"> has the attribute(s) %s, which the preview does not keep' % (page, href, ', '.join(odd)))
                return put(self.style_block(href, a.get('media', '')))
            if 'stylesheet' in rel and not re.match(r'(https?:)?//', href):
                self.warn('%s: a stylesheet outside css/ is left as it is: %s' % (page, href))
            return keep(m)

        def script(m):
            a = attrs_of(m.group('sa'))
            src = a.get('src')
            if src is None:
                return keep(m)                          # inline script (the structured data): not touched
            if not src.startswith('js/'):
                self.warn('%s: a script outside js/ is left as it is: %s' % (page, src))
                return keep(m)
            extra = sorted(k for k in a if k != 'src')
            if extra:
                fail('%s: <script src="%s"> has the attribute(s) %s. The preview inlines scripts in place and would change what they do. '
                     'Use a plain <script src="..."></script>, or teach work-notes/preview/build-artifact.py about it.' % (page, src, ', '.join(extra)))
            if not self.exists(src):
                fail('%s points at %s, which is not in the site folder.' % (page, src))
            return put(self.script_block(src, page))

        def one(m):                                     # one pass, so the blocks keep the order of the tags in the page
            return script(m) if m.group('sa') is not None else link(m)

        return TAG.sub(one, text)

    # -- the pages
    def prelude(self):
        """What comes first on every page: the build stamp, then (flags on) the flags, then the storage fallback."""
        lines = [self.stamp()]
        if self.flags:
            lines.append(FLAGS)
        lines.append('<script>' + STORAGE_FALLBACK + '//# sourceURL=preview-storage-fallback.js\n</script>')
        return lines

    def build_home(self, src):
        head = re.search(r'<head>(.*?)</head>', src, re.S)
        body = re.search(r'<body>(.*)</body>', src, re.S)
        if not head or not body:
            fail('index.html has no <head> or no <body>.')
        assets = []
        self.convert(head.group(1), 'index.html', collect=assets)
        body_text = self.convert(body.group(1), 'index.html').strip()
        ld = re.search(r'<script type="application/ld\+json">.*?</script>', src, re.S)
        pre = self.prelude()
        return '\n'.join(['<title>Wise Acres Organic Farm</title>'] + pre + assets + [body_text] + ([ld.group(0)] if ld else [])) + '\n'

    def build_inner(self, name, src):
        page = self.convert(src, name)
        m = re.search(r'<meta charset="utf-8">', page, re.I) or re.search(r'<head>', page, re.I)
        if not m:
            fail('%s has no <head>.' % name)
        return page[:m.end()] + '\n' + '\n'.join(self.prelude()) + page[m.end():]

    def stamp(self):
        return '<!-- preview build: %s; demo and tour flags %s -->' % (self.commit_text(), 'ON' if self.flags else 'OFF')

    def commit_text(self):
        if self._commit is None:
            try:
                head = subprocess.run(['git', '-C', self.repo, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, timeout=20).stdout.strip()
                dirty = subprocess.run(['git', '-C', self.repo, 'status', '--porcelain', '--untracked-files=no'], capture_output=True, text=True, timeout=20).stdout.strip()
                self._commit = ('commit ' + head + (' plus unsaved changes' if dirty else '')) if head else 'commit unknown'
            except (OSError, subprocess.SubprocessError):
                self._commit = 'commit unknown'
        return self._commit


def discover_pages(repo, b):
    """Every built page of the site except index.html and 404.html: a root *.html that is a whole page (it has <html and <body).
    The list comes from the built files themselves (not from sitemap.xml: the demo pages are not in it)."""
    pages, skipped = [], []
    for n in sorted(os.listdir(repo)):
        if not n.endswith('.html') or n in NOT_PAGES or not os.path.isfile(os.path.join(repo, n)):
            continue
        with open(os.path.join(repo, n), encoding='utf-8-sig') as f:
            txt = f.read()
        if re.search(r'<html\b', txt, re.I) and re.search(r'<body\b', txt, re.I):
            pages.append(n)
            if 'src="js/main.js"' not in txt:
                b.warn('%s does not load js/main.js (it is a page of the preview all the same)' % n)
        else:
            skipped.append(n)
    for n in skipped:
        b.warn('%s is in the site folder but is not a whole page (no <html> and <body>): left out' % n)
    srcdir = os.path.join(repo, 'pages')
    if os.path.isdir(srcdir):
        for f in sorted(os.listdir(srcdir)):
            if f.endswith('.html') and f not in pages:
                b.warn('pages/%s has no built %s in the site folder: run  python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build' % (f, f))
    return pages


def referenced_assets(repo, texts):
    """Pictures to publish: everything under assets/photos, plus any other picture a page points at (not <link> or <meta> tags, not the structured data, not comments)."""
    found = set()
    for root, _dirs, files in os.walk(os.path.join(repo, 'assets', 'photos')):
        for f in files:
            if f.lower().endswith(PICTURE_EXT):
                found.add(os.path.relpath(os.path.join(root, f), repo).replace(os.sep, '/'))
    pat = re.compile(r'assets/[A-Za-z0-9_./%-]+')
    for t in texts:
        t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
        t = re.sub(r'<(?:link|meta)\b[^>]*>', '', t, flags=re.I)
        t = re.sub(r'<script type="application/ld\+json">.*?</script>', '', t, flags=re.S)   # the share picture named in the structured data is not shown
        for ref in pat.findall(t):
            ref = ref.rstrip('.')
            if ref.lower().endswith(PICTURE_EXT) and not ref.startswith('assets/fonts/') and os.path.isfile(os.path.join(repo, *ref.split('/'))):
                found.add(ref)
    return sorted(found)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Build the claude.ai preview of the site (see the top of this file).')
    ap.add_argument('--repo', default=os.path.dirname(os.path.dirname(HERE)), help='the site folder (default: the folder this file sits in)')
    ap.add_argument('--out', default='/tmp/preview-out', help='where to write the preview (default /tmp/preview-out; must be outside the site folder)')
    ap.add_argument('--no-flags', action='store_true', help='leave out WA_DEMO / WA_TOUR (and the tour files and the pretend ingredients): what the real site shows')
    ap.add_argument('--force', action='store_true', help='empty the output folder even if an earlier build did not make it')
    args = ap.parse_args(argv)

    repo, out = os.path.realpath(args.repo), os.path.realpath(args.out)
    if not os.path.isfile(os.path.join(repo, 'index.html')) or not os.path.isfile(os.path.join(repo, 'js', 'main.js')):
        fail('%s is not the site folder (index.html or js/main.js is missing).' % repo)
    if out == repo or out.startswith(repo + os.sep):
        fail('the output folder %s is inside the site folder. Choose one outside it (for example /tmp/preview-out).' % out)
    if repo.startswith(out + os.sep):
        fail('the output folder %s contains the site folder.' % out)
    if os.path.exists(out):
        mine = os.path.isfile(os.path.join(out, INFO_NAME))
        if os.listdir(out) and not mine and not args.force:
            fail('%s is not empty and an earlier build did not make it (no %s). Use another folder, or add --force to empty it.' % (out, INFO_NAME))
        for n in os.listdir(out):
            p = os.path.join(out, n)
            shutil.rmtree(p) if os.path.isdir(p) and not os.path.islink(p) else os.remove(p)
    os.makedirs(out, exist_ok=True)

    b = Builder(repo, out, flags=not args.no_flags)
    names = discover_pages(repo, b)
    texts, sizes = {}, {}

    with open(os.path.join(repo, 'index.html'), encoding='utf-8-sig') as f:
        texts['index.html'] = b.build_home(f.read())
    for n in names:
        with open(os.path.join(repo, n), encoding='utf-8-sig') as f:
            texts[n] = b.build_inner(n, f.read())
    for n, t in texts.items():
        with open(os.path.join(out, n), 'w', encoding='utf-8', newline='\n') as f:
            f.write(t)
        sizes[n] = os.path.getsize(os.path.join(out, n))

    assets = referenced_assets(repo, texts.values())
    for a in assets:
        dst = os.path.join(out, *a.split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(repo, *a.split('/')), dst)
        sizes[a] = os.path.getsize(dst)

    # ---- limits ----
    problems = []
    for p, n in sizes.items():
        ext = os.path.splitext(p)[1].lower()
        cap = LIMITS['binary_file'] if ext in BINARY_EXT else LIMITS['text_file']
        if p.endswith('.html'):
            cap = min(cap, LIMITS['page'])
        if n > cap:
            problems.append('%s is %s, over the %s limit' % (p, human(n), human(cap)))
    total = sum(sizes.values())
    if len(sizes) > LIMITS['files_per_publish']:
        problems.append('%d files, one publish takes at most %d (publish in several calls to the same url: later calls add to the files already there)' % (len(sizes), LIMITS['files_per_publish']))
    if total > LIMITS['bytes_per_publish']:
        problems.append('%s in all, one publish takes at most %s (publish in several calls to the same url)' % (human(total), human(LIMITS['bytes_per_publish'])))
    if len(sizes) > LIMITS['files_per_version'] or total > LIMITS['bytes_per_version']:
        problems.append('the whole artifact would pass %d files or %s' % (LIMITS['files_per_version'], human(LIMITS['bytes_per_version'])))

    for key, count in b.patched.items():
        if not count:
            b.warn('the preview tweak for the %s did not apply (its CSS text changed in the site): look at css_text() in build-artifact.py' % key)
    publish_files = sorted(p for p in sizes if p != 'index.html')
    info = {
        'built_with': 'work-notes/preview/build-artifact.py',
        'commit': b.commit_text(),
        'flags': b.flags,
        'repo': repo,
        'pages': [{'path': n, 'bytes': sizes[n], 'main': n == 'index.html'} for n in ['index.html'] + names],
        'assets': assets,
        'css_inlined': sorted(b.used_css),
        'js_inlined': sorted(b.used_js),
        # the files a script asks for by code, put in the page in front of it (the test checks the marker or flag is there and the loader mentions it)
        'lazy': [{'file': f, 'script': v['script'], 'kind': v['kind'], 'marker': v['marker'], 'flag': v['flag'], 'pages': sorted(v['pages'])} for f, v in sorted(b.lazy.items())],
        # every file that only the build with the flags carries (the tour's styles and steps), as far as the site folder has it
        'flags_only': b.flags_only_files(),
        'publish': {'page': 'index.html', 'root': out, 'files': publish_files},
        'totals': {'files': len(sizes), 'bytes': total, 'largest': max(sizes.items(), key=lambda kv: kv[1])},
        'limits': LIMITS,
        'warnings': b.warnings,
    }
    with open(os.path.join(out, INFO_NAME), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(info, f, indent=1)
        f.write('\n')
    with open(os.path.join(out, PLAN_NAME), 'w', encoding='utf-8', newline='\n') as f:
        json.dump([{'path': p} for p in publish_files], f, separators=(',', ':'))
        f.write('\n')

    # ---- two scripts fighting over a top-level name (each file is its own <script>, as on the real site) ----
    clash_text, clash_bad = '', False
    node = shutil.which('node')
    if node:
        r = subprocess.run([node, os.path.join(HERE, 'globals-check.mjs'), out], capture_output=True, text=True, timeout=300)
        clash_text, clash_bad = (r.stdout + r.stderr).strip(), r.returncode != 0
    else:
        b.warn('node was not found: the check for top-level name clashes (globals-check.mjs) was not run')

    # ---- report ----
    print('Preview built in %s  (%s, flags %s)' % (out, b.commit_text(), 'ON' if b.flags else 'OFF'))
    for n in ['index.html'] + names:
        print('  %-28s %s' % (n, human(sizes[n])))
    print('  %d pictures (assets/) %s' % (len(assets), human(sum(sizes[a] for a in assets))))
    print('  total: %d files, %s  (limits: %d files and %s in one publish; a page %s)' % (len(sizes), human(total), LIMITS['files_per_publish'], human(LIMITS['bytes_per_publish']), human(LIMITS['page'])))
    print('  to publish: file_path=%s/index.html  root=%s  files=%s (%d files)' % (out, out, os.path.join(out, PLAN_NAME), len(publish_files)))
    print('  css inlined: %s' % ', '.join(sorted(os.path.basename(c) for c in b.used_css)))
    new = sorted(os.path.basename(j) for j in b.used_js if re.match(r'js/(demo|tour)', j))
    print('  demo / tour scripts inlined: %s' % (', '.join(new) if new else 'none (they are not in the site yet)'))
    shop = sorted(f for f in b.used_js | b.used_css if re.match(r'(?:js|css)/shop-', f))
    how = lambda f: f + (' (%s, in front of %s)' % (('as <%s %s>' % ('style' if b.lazy[f]['kind'] == 'css' else 'script', b.lazy[f]['marker'])) if b.lazy[f]['marker'] else 'the loader sees WISE_ACRES.%s' % b.lazy[f]['flag'], b.lazy[f]['script'])
                         if f in b.lazy and (b.lazy[f]['marker'] or b.lazy[f]['flag']) else '')
    print('  shop pop-up files inlined: %s' % (', '.join(how(f) for f in shop) if shop else 'none (they are not in the site yet)'))
    skipped = [f for f in b.flags_only_files() if f not in b.used_js and f not in b.used_css]
    if skipped:
        print('  left out of this build on purpose (only the build with the flags has them): %s' % ', '.join(skipped))
    if clash_text:
        for line in clash_text.splitlines():
            print('  ' + ('CLASH: ' + line[len('CLASH in '):] if line.startswith('CLASH in ') else line))
    for w in b.warnings:
        print('  NOTE:', w)
    if problems:
        for p in problems:
            print('  LIMIT:', p)
        fail('the preview is over a limit of the Artifact.')
    if clash_bad:
        fail('two scripts use the same top-level name (see CLASH above). On the real site the second file would not run either. Make each file one ( ... )(); function.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
