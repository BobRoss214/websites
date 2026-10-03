#!/usr/bin/env python3
"""Make the folder to upload: deploy/ holds exactly the files a visitor needs, and nothing else.

  python3 tools/make_deploy_folder.py              rebuild if needed, check, and write deploy/
  python3 tools/make_deploy_folder.py --check      only say whether the pages and translations are up to date (writes nothing)
  python3 tools/make_deploy_folder.py --out DIR    put the folder somewhere else (it must be new, empty, or an old deploy folder)
  python3 tools/make_deploy_folder.py --no-rebuild copy the files as they are, without the rebuild and the translation check
                                                   (for a computer without beautifulsoup4; not recommended)
  python3 tools/make_deploy_folder.py --force      build the folder even though the facts disagree or a translation is missing
                                                   (it says so, and FILES.txt says so too; do not upload such a folder without knowing why)

Then upload the CONTENTS of deploy/ (step 3.2 of docs/LAUNCH_CHECKLIST.md: drag the deploy folder onto the upload box).

What it does, in order:
  1. Rebuilds the pages and translations in a temporary copy of the site (tools/pages.py, tools/i18n.py extract,
     tools/i18n.py build). If that changes any file, your folder was not rebuilt after the last edit: those files are
     updated in your folder too, and listed. (--check only lists them.)
  2. Stops if the facts disagree (tools/check_facts.py: a price, an hour, a phone number, an e-mail address, the address, an age or the
     year written two ways) or if any translation is missing (tools/i18n.py missing, for every language). Each red thing is one plain line
     with how to fix it. --force builds the folder anyway, says so, and writes that into FILES.txt.
  3. Warns (does not stop) about settings in js/content.js that the launch checklist says to set before launch.
  4. Copies the upload set into deploy/ (an old deploy/ is replaced), checks that every file the pages point to is there,
     and writes deploy/FILES.txt: every file with its size and sha256 fingerprint, and one fingerprint for the whole folder
     (the same files always give the same fingerprint, so two uploads can be compared).

Needs Python 3.8 or newer, and beautifulsoup4 for the rebuild (pip install beautifulsoup4), like the other tools.
Exit code: 0 ready (warnings allowed; with --force also when checks were red), 1 not ready (a problem is printed), 2 a Python package is missing.
A broken link inside the folder is never overridden by --force.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# What a visitor needs: every .html page in the top folder (the six pages and 404.html), these files, and these folders.
TOP_FILES = ['robots.txt', 'sitemap.xml', 'manifest.webmanifest', '_headers', '_redirects']   # _redirects only if you made one (checklist 3.6)
FOLDERS = ['assets', 'css', 'js', 'lang', 'print']
# Inside those folders, left out on purpose (path relative to the site folder, with / even on Windows):
LEFT_OUT_INSIDE = [
    ('lang/src/', 'the translations as you edit them; the pages load lang/<language>.js, which tools/i18n.py builds from them'),
    ('lang/en.json', 'the list of English texts for translators (made by tools/i18n.py)'),
    ('lang/js-strings.json', 'the list of texts the code writes, for translators (made by tools/i18n.py)'),
    ('assets/qr/', 'the QR codes as separate files for a print shop; print/qr-signs.html has its own copy of each'),
]
# In the top folder, left out, with the reason given to the owner:
LEFT_OUT_TOP = {
    'docs': 'notes and questions for the farm, not for visitors',
    'tests': 'automatic checks for developers',
    'tools': 'the programs that build the pages and translations',
    'review': 'the sheets a friend uses to check a language (made by tools/review_sheet.py)',
    'pages': 'the page sources that tools/pages.py turns into the pages',
    'README.md': 'instructions for whoever edits the site',
    '.git': 'the change history',
    '.gitignore': 'a developer note about which files to ignore',
    'deploy': 'this folder',
}
JUNK = re.compile(r'(^|/)(\.[^/]*|Thumbs\.db|desktop\.ini|__pycache__)(/|$)|\.(pyc|orig|rej|bak|swp|tmp|py|md)$|~$', re.I)
# Not copied into the temporary rebuild copy (big, or not needed to build)
SKIP_COPY = {'.git', 'deploy', 'node_modules', '.visual', '__pycache__', 'tests'}

TEXT_EXT = ('.html', '.css', '.js', '.json', '.svg', '.txt', '.xml', '.webmanifest')


def say(msg=''):
    print(msg, flush=True)


def rel(path, base):
    return os.path.relpath(path, base).replace(os.sep, '/')


def same_text(a, b):
    """Same file, ignoring Windows/Unix line endings."""
    if a == b:
        return True
    return a.replace(b'\r\n', b'\n') == b.replace(b'\r\n', b'\n')


def walk(base, skip=()):
    for d, dirs, files in os.walk(base):
        dirs[:] = sorted(x for x in dirs if x not in skip)
        for f in sorted(files):
            yield os.path.join(d, f)


def read(path):
    with open(path, 'rb') as f:
        return f.read()


# ---------------------------------------------------------------- 1. rebuild in a temporary copy
def rebuild_copy(tmp):
    """Copies the site into tmp and runs the three rebuild commands there. Returns the copy's folder."""
    site = os.path.join(tmp, 'site')
    shutil.copytree(ROOT, site, ignore=lambda d, names: [n for n in names if n in SKIP_COPY])
    py = sys.executable or 'python3'
    for args in (['tools/pages.py'], ['tools/i18n.py', 'extract'], ['tools/i18n.py', 'build']):
        r = subprocess.run([py] + args, cwd=site, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, encoding='utf-8', errors='replace')
        if r.returncode != 0:
            err = (r.stderr or r.stdout or '').strip()
            if ('No module named' in err and 'bs4' in err) or 'beautifulsoup4 package' in err:
                say('Cannot rebuild: Python is missing the package beautifulsoup4, which the site tools need.')
                say('  Fix: ' + py + ' -m pip install beautifulsoup4    (or run this again with --no-rebuild: see the top of this file)')
                sys.exit(2)
            say('The rebuild stopped at: python3 ' + ' '.join(args))
            say('  ' + err.replace('\n', '\n  '))
            say('Nothing was written to deploy/. Fix that first (or ask Claude), then run this again.')
            sys.exit(1)
    return site


def stale_files(site):
    """Files the rebuild changed (or made) compared with your folder."""
    out = []
    for p in walk(site, skip=SKIP_COPY):
        r = rel(p, site)
        mine = os.path.join(ROOT, r)
        if not os.path.exists(mine) or not same_text(read(p), read(mine)):
            out.append(r)
    return out


def missing_translations(site):
    """(language codes, one plain line for each language that is not complete, with how to fix it)."""
    py = sys.executable or 'python3'
    codes = sorted(f[:-5] for f in os.listdir(os.path.join(site, 'lang', 'src')) if f.endswith('.json'))
    bad = []
    for code in codes:
        r = subprocess.run([py, 'tools/i18n.py', 'missing', code], cwd=site, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, encoding='utf-8', errors='replace')
        m = re.search(r'(\d+) missing.*JavaScript: (\d+) missing', r.stdout or '')
        if r.returncode != 0 or not m:
            bad.append('Translations: the check for %s could not run (%s). Fix: run  python3 tools/i18n.py missing %s  and read what it says.' % (code, ((r.stderr or r.stdout or '').strip().split('\n') or [''])[-1], code))
        elif int(m.group(1)) or int(m.group(2)):
            bad.append('Translations missing: %s has %s page text(s) and %s text(s) written by the code with no translation yet. Fix: python3 tools/i18n.py missing %s --list shows them; add them to lang/src/%s.json (README, "Change one sentence and its translations") or ask Claude.' % (code, m.group(1), m.group(2), code, code))
    return codes, bad


def fact_problems(site):
    """One plain line for each fact that is written two ways (tools/check_facts.py --brief), or []."""
    script = os.path.join(site, 'tools', 'check_facts.py')
    if not os.path.isfile(script):
        return []
    py = sys.executable or 'python3'
    r = subprocess.run([py, 'tools/check_facts.py', '--brief'], cwd=site, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, encoding='utf-8', errors='replace')
    lines = [l[len('DIFFERENT '):].strip() for l in (r.stdout or '').splitlines() if l.startswith('DIFFERENT ')]
    if r.returncode not in (0, 1) or (r.returncode == 1 and not lines):
        return ['Facts: the check could not run (%s). Fix: run  python3 tools/check_facts.py  and read what it says.' % ((r.stderr or r.stdout or '').strip().split('\n') or [''])[-1]]
    return ['Facts disagree: %s. Fix: make every place say the same (the files and lines are named; README, "Change a fact everywhere"); python3 tools/check_facts.py lists every place.' % l for l in lines]


# ---------------------------------------------------------------- 3. settings the checklist says to set
def setting(src, name):
    """The value of a top-level setting in js/content.js (a line '  name: value,' inside WISE_ACRES), or None."""
    m = re.search(r'^  ' + re.escape(name) + r':\s*(.+?),?\s*(//.*)?$', src, re.M)
    return m.group(1).strip() if m else None


def settings_warnings(site_dir):
    path = os.path.join(site_dir, 'js', 'content.js')
    if not os.path.exists(path):
        return ['js/content.js is missing']
    src = read(path).decode('utf-8', 'replace')
    warn = []
    if setting(src, 'seasonPicker') == 'true':
        warn.append('seasonPicker is still true: every visitor sees the "See the farm in ..." season preview buttons. Set it to false before launch (checklist 3.8, decision D6).')
    if setting(src, 'farmPoint') in ('null', None):
        warn.append('farmPoint is not set: the Drive time box looks up the farm\'s address on every press (one more request to a free service). Set it before launch (checklist 3.13, decision D11, question 35).')
    if setting(src, 'reviewUrl') in ("''", '""', None):
        warn.append('reviewUrl is empty: "Leave a Google review" buttons open the farm on Google Maps. Can follow launch (checklist 3.12, question 27).')
    m = re.search(r"^  signup:\s*\{\s*action:\s*(''|\"\")", src, re.M)
    if m:
        warn.append('signup action is empty: the email signup button opens Mailchimp\'s own page. Can follow launch (question 26).')
    return warn


# ---------------------------------------------------------------- 4. the upload set
def upload_set(site):
    """(files to copy, left-out notes). Paths relative to the site folder, with /."""
    files, left = [], []
    for name in sorted(set(os.listdir(site)) | set(os.listdir(ROOT))):   # the copy has no tests/ or .git: name them from your folder
        p = os.path.join(site, name) if os.path.exists(os.path.join(site, name)) else os.path.join(ROOT, name)
        if os.path.isdir(p):
            if name in FOLDERS:
                continue
            left.append((name + '/', LEFT_OUT_TOP.get(name, 'not part of the website (not on the upload list in docs/LAUNCH_CHECKLIST.md, section 2)')))
        elif name.lower().endswith('.html') or name in TOP_FILES:
            files.append(name)
        else:
            left.append((name, LEFT_OUT_TOP.get(name, 'not part of the website (not on the upload list in docs/LAUNCH_CHECKLIST.md, section 2)')))
    for folder in FOLDERS:
        base = os.path.join(site, folder)
        if not os.path.isdir(base):
            continue
        for p in walk(base):
            r = rel(p, site)
            why = next((w for pre, w in LEFT_OUT_INSIDE if r == pre or (pre.endswith('/') and r.startswith(pre))), None)
            if why:
                continue
            if JUNK.search(r):
                left.append((r, 'not a website file (a hidden, backup or system file)'))
                continue
            files.append(r)
    for pre, why in LEFT_OUT_INSIDE:
        if os.path.exists(os.path.join(site, pre.rstrip('/'))):
            left.append((pre, why))
    return files, left


def check_out(out):
    out = os.path.abspath(out)
    if os.path.abspath(ROOT) == out or os.path.abspath(ROOT).startswith(out + os.sep):
        say('--out cannot be the site folder or a folder above it.')
        sys.exit(1)
    if os.path.exists(out):
        if not os.path.isdir(out):
            say(out + ' is a file, not a folder. Choose another --out.')
            sys.exit(1)
        if os.listdir(out) and not os.path.exists(os.path.join(out, 'FILES.txt')):
            say(out + ' already has files in it and is not a folder made by this tool (no FILES.txt), so it was not touched. Choose another --out.')
            sys.exit(1)
    return out


def prepare_out(out):
    out = check_out(out)
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)
    return out


# ---------------------------------------------------------------- checking the links inside the folder
class Refs(HTMLParser):
    ATTRS = {'src', 'href', 'poster', 'data-src', 'xlink:href', 'action'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs, self.inline, self.meta, self._in = [], [], [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for k, v in attrs:
            if v and k in self.ATTRS and not (tag == 'use' and v.startswith('#')):
                self.refs.append(v)
            if v and k == 'srcset':
                self.refs += [x.strip().split(' ')[0] for x in v.split(',') if x.strip()]
            if v and k == 'style':
                self.inline.append(('css', v))
        if tag == 'meta' and (a.get('property') or a.get('name') or '') in ('og:image', 'twitter:image', 'og:url'):
            self.meta.append(a.get('content') or '')
        if tag in ('script', 'style'):
            self._in = 'js' if tag == 'script' else 'css'

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self._in = None

    def handle_data(self, data):
        if self._in:
            self.inline.append((self._in, data))


CSS_URL = re.compile(r'url\(\s*([\'"]?)([^\'")]+)\1\s*\)')
JS_COMMENT = re.compile(r'/\*[\s\S]*?\*/|(^|[ \t])//[^\n]*')   # comments hold examples ('assets/photos/entrance.jpg') that are not real files


def code_only(text):
    return JS_COMMENT.sub(lambda m: m.group(1) or '', text)


JS_PATH = re.compile(r'[\'"`]((?:\.\./)?(?:assets|css|js|lang|print)/[A-Za-z0-9_\-./]+\.(?:webp|png|jpe?g|gif|svg|woff2?|js|css|html|json|webmanifest|ico))[\'"`]')


def check_links(out, site_url):
    """Every file the pages, styles, code and manifest point to must be in the folder. Returns (problems, files nothing points to)."""
    have = set(rel(p, out) for p in walk(out))
    pointed, problems = set(), []
    host = urlsplit(site_url).netloc

    def target(ref, from_dir, from_file):
        ref = ref.strip()
        if not ref or ref.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'data:', 'sms:', 'about:')):
            return
        u = urlsplit(ref)
        if u.scheme in ('http', 'https') or ref.startswith('//'):
            if u.netloc != host:
                return
            path = u.path.lstrip('/')
        elif u.scheme:
            return
        else:
            path = u.path
            if not path:
                return
            path = path.lstrip('/') if path.startswith('/') else os.path.normpath(os.path.join(from_dir, path)).replace(os.sep, '/')
        path = unquote(path)
        if path in ('', '.') or path.endswith('/'):
            path = (path + 'index.html').lstrip('./') if path not in ('', '.') else 'index.html'
        if path.startswith('../'):
            problems.append('%s points outside the folder: %s' % (from_file, ref))
            return
        if path in have:
            pointed.add(path)
        elif path + '.html' in have:   # /wise-pie for /wise-pie.html (Cloudflare's pretty addresses)
            pointed.add(path + '.html')
        else:
            problems.append('%s points to %s, which is not in the folder' % (from_file, ref))

    langs = []
    for f in sorted(have):
        p = os.path.join(out, f)
        d = os.path.dirname(f)
        if f.endswith('.html'):
            parser = Refs()
            parser.feed(read(p).decode('utf-8', 'replace'))
            for r in parser.refs + parser.meta:
                target(r, d, f)
            for kind, text in parser.inline:
                if kind == 'css':
                    for m in CSS_URL.finditer(text):
                        target(m.group(2), d, f)
                else:
                    for m in JS_PATH.finditer(code_only(text)):
                        target(m.group(1), d, f)
        elif f.endswith('.css'):
            for m in CSS_URL.finditer(read(p).decode('utf-8', 'replace')):
                target(m.group(2), d, f)
        elif f.endswith('.js') and not f.startswith('lang/'):
            text = code_only(read(p).decode('utf-8', 'replace'))
            for m in JS_PATH.finditer(text):
                target(m.group(1), '', f)   # paths in the code are relative to the page, and the pages are in the top folder
            if f == 'js/i18n.js':
                langs = re.findall(r"\{\s*code:\s*'([a-z]{2})'", text)
        elif f.endswith('.webmanifest'):
            try:
                man = json.loads(read(p).decode('utf-8'))
            except ValueError:
                problems.append(f + ' is not valid JSON')
                continue
            for icon in man.get('icons', []):
                target(icon.get('src', ''), d, f)
            if man.get('start_url'):
                target(man['start_url'], d, f)
        elif f == 'sitemap.xml':
            for loc in re.findall(r'<loc>([^<]+)</loc>', read(p).decode('utf-8', 'replace')):
                target(loc, '', f)
    for code in langs:   # js/i18n.js loads lang/<code>.js for each language except English
        if code != 'en':
            target('lang/%s.js' % code, '', 'js/i18n.js')
    entry = {f for f in have if '/' not in f or f.startswith('print/')} | {'FILES.txt'}
    unused = sorted(have - pointed - entry)
    return sorted(set(problems)), unused


# ---------------------------------------------------------------- FILES.txt
def write_manifest(out, files, forced=None):
    rows, whole = [], hashlib.sha256()
    total = 0
    for f in sorted(files):
        data = read(os.path.join(out, f))
        h = hashlib.sha256(data).hexdigest()
        rows.append('%10d  %s  %s' % (len(data), h, f))
        whole.update(('%s\0%s\n' % (f, h)).encode('utf-8'))
        total += len(data)
    note = ''
    if forced:
        note = 'NOTE: built with --force although these checks were red (do not upload it unless you know why):\n' + ''.join('  - ' + f + '\n' for f in forced) + '\n'
    text = ('The files to upload, made by tools/make_deploy_folder.py. Size in bytes, sha256 fingerprint, file.\n'
            'The fingerprint of the whole folder (last line) is the same whenever the files are the same.\n\n'
            + note
            + '\n'.join(rows) + '\n\n'
            + '%d files, %d bytes\n' % (len(rows), total)
            + 'sha256 of the whole folder: %s\n' % whole.hexdigest())
    with open(os.path.join(out, 'FILES.txt'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)
    return total, whole.hexdigest()


def mb(n):
    return '%.1f MB' % (n / 1e6)


def main():
    if sys.version_info < (3, 8):
        say('This needs Python 3.8 or newer (this is %d.%d).' % sys.version_info[:2])
        sys.exit(2)
    ap = argparse.ArgumentParser(description='Make deploy/: exactly the files to upload.')
    ap.add_argument('--out', default=os.path.join(ROOT, 'deploy'), help='where to put the folder (default: deploy/ in the site folder)')
    ap.add_argument('--check', action='store_true', help='only check that the pages and translations are up to date; write nothing')
    ap.add_argument('--no-rebuild', action='store_true', help='skip the rebuild and the translation check (not recommended)')
    ap.add_argument('--force', action='store_true', help='build the folder even though the facts disagree or a translation is missing (it says so, and FILES.txt says so)')
    args = ap.parse_args()

    if not args.check:
        check_out(args.out)   # before the slow part: say at once if --out is a folder this tool must not empty
    tmp = tempfile.mkdtemp(prefix='wa-deploy-')
    red = []   # one plain line for each check that is red: facts that disagree, translations that are missing
    try:
        if args.no_rebuild:
            say('Skipping the rebuild and the translation check (--no-rebuild): the files are copied as they are.')
            site = ROOT
            codes, bad = [], []
        else:
            say('Rebuilding the pages and translations in a temporary copy ...')
            site = rebuild_copy(tmp)
            changed = stale_files(site)
            if changed:
                say('These files were out of date (the folder was not rebuilt after the last edit):')
                for r in changed:
                    say('  ' + r)
                if args.check:
                    say('Not ready: run this again without --check to update them and make deploy/.')
                    sys.exit(1)
                for r in changed:
                    os.makedirs(os.path.dirname(os.path.join(ROOT, r)) or ROOT, exist_ok=True)
                    shutil.copyfile(os.path.join(site, r), os.path.join(ROOT, r))
                say('  ... updated in your folder.')
            else:
                say('Pages and translations are up to date.')
            codes, bad = missing_translations(site)
        red = fact_problems(site) + bad
        if red:
            if args.force:
                say('--force: building anyway, although %d check%s red. The folder will have these mistakes:' % (len(red), ' is' if len(red) == 1 else 's are'))
            else:
                say('NOT READY: %d check%s red.' % (len(red), ' is' if len(red) == 1 else 's are'))
            for line in red:
                say('  ' + line)
            if not args.force:
                say('Nothing was written to deploy/. Fix the lines above and run this again. To build the folder anyway, with these mistakes in it: add --force.')
                sys.exit(1)
        else:
            say('Facts agree everywhere.' + ('' if args.no_rebuild else ' Translations complete: ' + ', '.join(codes) + '.'))
        if args.check:
            say('Ready to make deploy/ (nothing was written: --check)' + (' with --force, although %d check(s) were red.' % len(red) if red else '.'))
            return

        warnings = settings_warnings(site)
        files, left = upload_set(site)
        out = prepare_out(args.out)
        for f in files:
            dst = os.path.join(out, *f.split('/'))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(os.path.join(site, *f.split('/')), dst)
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', read(os.path.join(out, 'index.html')).decode('utf-8', 'replace')) if 'index.html' in files else None
        problems, unused = check_links(out, canon.group(1) if canon else 'https://www.wiseacresorganic.com/')
        total, whole = write_manifest(out, files, red if args.force else None)

        say('')
        say('Left out (not needed by visitors):')
        for name, why in sorted(left):
            say('  %-22s %s' % (name, why))
        if unused:
            say('In the folder, but no page points to them (they are uploaded anyway): ' + ', '.join(unused))
        if warnings:
            say('')
            say('Settings to look at before launch (js/content.js); these do not stop the upload:')
            for w in warnings:
                say('  WARNING: ' + w)
        say('')
        if problems:
            say('NOT READY: %d broken link(s) inside the folder:' % len(problems))
            for p in problems[:40]:
                say('  ' + p)
            sys.exit(1)
        say('Ready: %s holds %d files and FILES.txt, %s in all (folder fingerprint %s...).' % (out, len(files), mb(total), whole[:16]))
        if red:
            say('BUILT WITH --force: %d red check%s ignored (listed above and in FILES.txt). Do not upload this folder unless you know why.' % (len(red), ' was' if len(red) == 1 else 's were'))
        else:
            say('Upload what is INSIDE that folder (docs/LAUNCH_CHECKLIST.md, step 3.2).')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
