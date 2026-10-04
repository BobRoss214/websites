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
  4. Copies the upload set into deploy/ (an old deploy/ is replaced), checks that every file the pages point to is there and that every font has its
     licence text next to it (assets/fonts/LICENSE-OFL-<Family>.txt: the font licence asks for it), and writes deploy/FILES.txt: every file with its size and sha256 fingerprint, and one fingerprint for the whole folder
     (the same files always give the same fingerprint, so two uploads can be compared), and says in one plain line each whether _headers and _redirects, the two files the host reads, are in it and where.

Needs Python 3.8 or newer, and beautifulsoup4 for the rebuild (pip install beautifulsoup4), like the other tools.
Exit code: 0 ready (warnings allowed; with --force also when checks were red), 1 not ready (a problem is printed), 2 a Python package is missing.
A broken link inside the folder, or a font without its licence text (nothing is written then), is never overridden by --force.
"""
import argparse, hashlib, json, os, re, shutil, stat, subprocess, sys, tempfile
from html.parser import HTMLParser
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
    'patches': 'the optional changes for you to decide on (patches/optional/README.md), not for visitors',
    '.venv': 'the Python packages you installed for the tools (README, "Commands on Windows, Mac and Linux")',
    'venv': 'the Python packages you installed for the tools (README, "Commands on Windows, Mac and Linux")',
    'deploy': 'this folder',
}
# A host rules file saved with an extra ending by a text program (Notepad adds .txt, TextEdit .rtf): the host does not read it
MISNAMED_HOST_FILE = re.compile(r'^(_headers|_redirects)\.(txt|rtf|docx?)$', re.I)
JUNK = re.compile(r'(^|/)(\.[^/]*|Thumbs\.db|desktop\.ini|__pycache__)(/|$)|\.(pyc|orig|rej|bak|swp|tmp|py|md)$|~$', re.I)
# Files that are uploaded although no page points to them: the licence texts and credits that travel with the fonts and the icons
# (docs/CREDITS_AND_LICENCES.md). They are not reported as "no page points to them".
LICENCE_FILE = re.compile(r'^assets/(fonts/LICENSE-[^/]+\.txt|LICENSE-[^/]+\.txt|CREDITS\.txt)$')
FONT_FILE = re.compile(r'\.(woff2?|ttf|otf)$', re.I)
# Not copied into the temporary rebuild copy (big, or not needed to build)
SKIP_COPY = {'.git', 'deploy', 'node_modules', '.visual', '__pycache__', 'tests', '.venv', 'venv', 'patches', 'review'}

TEXT_EXT = ('.html', '.css', '.js', '.json', '.svg', '.txt', '.xml', '.webmanifest')


def say(msg=''):
    print(msg, flush=True)


def run_tool(args, cwd):
    """Runs a tool of the temporary copy and returns the finished process. Its words come back as UTF-8 whatever this computer's window uses
    (an old Windows window would otherwise turn the accented letters into other letters)."""
    return subprocess.run([sys.executable or 'python3'] + args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True,
                          encoding='utf-8', errors='replace', env=dict(os.environ, PYTHONIOENCODING='utf-8'))


def quoted(path):
    """A path as it must be typed in a window: in quote marks when it has a space (C:\\Program Files\\...)."""
    return '"%s"' % path if ' ' in path else path


def rel(path, base):
    return os.path.relpath(path, base).replace(os.sep, '/')


def same_text(a, b):
    """Same file, ignoring Windows/Unix line endings and the BOM (the invisible marker Notepad's "UTF-8" puts first)."""
    if a == b:
        return True
    clean = lambda x: x[3:] if x.startswith(b'\xef\xbb\xbf') else x
    return clean(a).replace(b'\r\n', b'\n') == clean(b).replace(b'\r\n', b'\n')


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
        r = run_tool(args, site)
        if r.returncode != 0:
            err = (r.stderr or r.stdout or '').strip()
            if ('No module named' in err and 'bs4' in err) or 'beautifulsoup4 package' in err:
                say('Cannot rebuild: Python is missing the package beautifulsoup4, which the site tools need.')
                say('  Fix: ' + quoted(py) + ' -m pip install beautifulsoup4    (or run this again with --no-rebuild: see the top of this file)')
                say('  If pip answers "externally-managed-environment" (a new Mac or Linux computer), or you made a .venv folder and have not switched it on in this window:')
                say('  README, "Commands on Windows, Mac and Linux", step 4.')
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
    codes = sorted(f[:-5] for f in os.listdir(os.path.join(site, 'lang', 'src')) if f.endswith('.json'))
    bad = []
    for code in codes:
        r = run_tool(['tools/i18n.py', 'missing', code], site)
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
    r = run_tool(['tools/check_facts.py', '--brief'], site)
    lines = [l[len('DIFFERENT '):].strip() for l in (r.stdout or '').splitlines() if l.startswith('DIFFERENT ')]
    if r.returncode not in (0, 1) or (r.returncode == 1 and not lines):
        return ['Facts: the check could not run (%s). Fix: run  python3 tools/check_facts.py  and read what it says.' % ((r.stderr or r.stdout or '').strip().split('\n') or [''])[-1]]
    return ['Facts disagree: %s. Fix: make every place say the same (the files and lines are named; README, "Change a fact everywhere"). The command python3 tools/check_facts.py lists every place.' % l for l in lines]


# ---------------------------------------------------------------- 3. settings the checklist says to set
def setting(src, name):
    """The value of a top-level setting in js/content.js (a line '  name: value,' inside WISE_ACRES), or None."""
    m = re.search(r'^[ \t]*' + re.escape(name) + r':\s*(.+?),?\s*(//.*)?$', src, re.M)   # any indentation: an editor that re-indents the file (4 spaces, tabs) must not make a setting look missing
    return m.group(1).strip() if m else None


def settings_warnings(site_dir):
    path = os.path.join(site_dir, 'js', 'content.js')
    if not os.path.exists(path):
        return ['js/content.js is missing']
    src = read(path).decode('utf-8', 'replace')
    warn = []
    if setting(src, 'seasonPicker') == 'true':
        warn.append('seasonPicker is still true: every visitor sees the "See the farm in ..." buttons that show the farm in other seasons. Before launch, change true to false on that line of js/content.js (checklist, step 3.8).')
    if setting(src, 'farmPoint') in ('null', None):
        warn.append('farmPoint is not set: the Drive time box has to look the farm\'s address up on every press (one more request to a free service). Before launch, put the farm\'s two map numbers on that line of js/content.js (checklist, step 3.13; the owner dashboard card is "The farm\'s exact spot on the map").')
    if setting(src, 'reviewUrl') in ("''", '""', None):
        warn.append('reviewUrl is empty: the "Leave a Google review" buttons open the farm on Google Maps instead of the review box. This can follow the launch: paste the short review link from your Google Business Profile between the quote marks (checklist, step 3.12; the owner dashboard card is "Google review link").')
    m = re.search(r"^[ \t]*signup:\s*\{\s*action:\s*(''|\"\")", src, re.M)
    if m:
        warn.append('signup action is empty: the "Join the email list" button opens Mailchimp\'s own page instead of a form on the site. This can follow the launch: send Claude the Mailchimp form code (README, "Make the email signup work").')
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
            m = MISNAMED_HOST_FILE.match(name)
            left.append((name, ('named with an extra ending, so the host would not read it: rename it to %s (no %s at the end)' % (m.group(1).lower(), os.path.splitext(name)[1])) if m
                         else LEFT_OUT_TOP.get(name, 'not part of the website (not on the upload list in docs/LAUNCH_CHECKLIST.md, section 2)')))
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


def host_rule_lines(site, files, shown):
    """One plain line each for _headers and _redirects, the two files the host reads: [(kind, text, fix)].
    kind: 'ok' (it is in the upload folder), 'look' (it is not, and that can be fine), 'red' (it is not, and it should be; fix says what to do).
    site: the site folder; files: the upload set; shown: how the upload folder is named on screen, for example deploy."""
    try:
        names = set(os.listdir(site)) | set(os.listdir(ROOT))
    except OSError:
        names = set()
    out = []
    for name, what, fine_without in (('_headers', 'the security notes and the cache times', False),
                                     ('_redirects', 'the old farm addresses sent on to the new pages', True)):
        misnamed = sorted(n for n in names if MISNAMED_HOST_FILE.match(n) and n.lower().startswith(name))
        if name in files:
            out.append(('ok', '%s is in the upload folder, at its top (%s/%s): %s. Cloudflare Pages and Netlify read it.' % (name, shown, name, what), None))
        elif misnamed:
            out.append(('red', '%s is NOT in the upload folder: your site folder has "%s", and the host does not read a file with that ending.' % (name, misnamed[0]),
                        'rename it to %s (no %s at the end), then make the upload folder again' % (name, os.path.splitext(misnamed[0])[1])))
        elif fine_without:
            out.append(('look', '%s is not in the upload folder, because your site folder has no %s file. That is fine unless the new site takes over the old farm addresses; then follow checklist step 3.6.' % (name, name), None))
        else:
            out.append(('red', '%s is NOT in the upload folder, because your site folder has no %s file. Without it the host adds no security notes and no cache times.' % (name, name),
                        'put %s back from your backup (a saved copy of the folder), or ask Claude' % name))
    return out


def check_out(out):
    out = os.path.abspath(out)
    here = os.path.normcase(os.path.abspath(ROOT))   # normcase: Windows does not tell C:\\Site from c:\\site
    if here == os.path.normcase(out) or here.startswith(os.path.normcase(out) + os.sep):
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


def _writable(func, path, *rest):
    """shutil.rmtree calls this for a file it cannot delete. Windows refuses a read-only file: make it writable and try once more."""
    os.chmod(path, stat.S_IWRITE)
    func(path)


def remove_tree(path):
    shutil.rmtree(path, **{('onexc' if sys.version_info >= (3, 12) else 'onerror'): _writable})


def empty_folder(path):
    """Takes everything out of a folder but keeps the folder (Windows will not remove a folder that is open in a window).
    FILES.txt goes last, so a stop half-way still leaves a folder that this tool recognises as its own."""
    for name in sorted(os.listdir(path), key=lambda n: n == 'FILES.txt'):
        full = os.path.join(path, name)
        if os.path.isdir(full) and not os.path.islink(full):
            remove_tree(full)
        else:
            try:
                os.remove(full)
            except PermissionError:
                os.chmod(full, stat.S_IWRITE)
                os.remove(full)


def prepare_out(out):
    out = check_out(out)
    if os.path.isdir(out):
        try:
            empty_folder(out)
        except OSError as e:
            say('I could not empty ' + out + ' (' + str(e) + ').')
            say('A file in it is probably open in another program (a Windows Explorer window showing a preview, a browser, an upload page), or OneDrive is syncing it.')
            say('Close those, wait a moment and run this again, or choose another folder with --out. Nothing was uploaded or changed in your site.')
            sys.exit(1)
    os.makedirs(out, exist_ok=True)
    return out


def copy_for_upload(src, dst):
    """Copies one file. A text file is copied with Unix line endings and without the invisible marker some Windows editors put first,
    so the folder, and the fingerprint in FILES.txt, are the same whichever way the files on your computer were saved."""
    data = read(src)
    if src.lower().endswith(TEXT_EXT) or os.path.basename(src) in TOP_FILES:
        if data.startswith(b'\xef\xbb\xbf'):
            data = data[3:]
        data = data.replace(b'\r\n', b'\n')
    with open(dst, 'wb') as f:
        f.write(data)


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


def licence_problems(site, files):
    """A font in the upload set must have its licence text next to it: assets/fonts/LICENSE-OFL-<Family>.txt, holding the SIL Open Font License.
    `files` is the upload set (paths with /). Returns the problems, so nothing is written for a folder that would break the font licence."""
    problems = []
    fonts = sorted(f for f in files if f.startswith('assets/fonts/') and FONT_FILE.search(f))
    for f in fonts:
        family = os.path.basename(f).split('-')[0].lower()
        found = [n for n in files if n.lower() == 'assets/fonts/license-ofl-%s.txt' % family]
        if not found:
            problems.append('%s has no licence text: add assets/fonts/LICENSE-OFL-%s.txt (copy the LICENSE file of the font package, word for word; see docs/CREDITS_AND_LICENCES.md)' % (f, family.capitalize()))
        elif 'SIL OPEN FONT LICENSE' not in read(os.path.join(site, *found[0].split('/'))).decode('utf-8', 'replace').upper():
            problems.append('%s does not hold the SIL Open Font License text' % found[0])
    return problems


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
    unused = sorted(f for f in have - pointed - entry if not LICENCE_FILE.match(f))   # the licence texts are uploaded on purpose
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
        lic = licence_problems(site, files)
        if lic:   # --force does not change this, and nothing is written
            say('NOT READY: %d font(s) without their licence text (the font licence asks for it):' % len(lic))
            for p in lic:
                say('  ' + p)
            sys.exit(1)
        out = prepare_out(args.out)
        for f in files:
            dst = os.path.join(out, *f.split('/'))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            copy_for_upload(os.path.join(site, *f.split('/')), dst)
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', read(os.path.join(out, 'index.html')).decode('utf-8', 'replace')) if 'index.html' in files else None
        problems, unused = check_links(out, canon.group(1) if canon else 'https://www.wiseacresorganic.com/')
        total, whole = write_manifest(out, files, red if args.force else None)

        say('')
        shown = os.path.relpath(out, ROOT).replace(os.sep, '/') if os.path.abspath(out).startswith(os.path.abspath(ROOT) + os.sep) else out
        say('The two files the host reads:')
        for kind, line, fix in host_rule_lines(site, files, shown):
            say('  ' + ('WARNING: ' if kind == 'red' else '') + line + (' Fix: ' + fix + '.' if fix else ''))
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
            shutil.rmtree(out, ignore_errors=True)   # not left behind: a folder with a FILES.txt looks finished, and would be uploaded by mistake
            say('The half-made %s was removed again, so nothing broken can be uploaded. Fix the links above and run this again.' % out)
            sys.exit(1)
        say('Ready: %s holds %d files and FILES.txt, %s in all (folder fingerprint %s...).' % (out, len(files), mb(total), whole[:16]))
        if red:
            say('BUILT WITH --force: %d red check%s ignored (listed above and in FILES.txt). Do not upload this folder unless you know why.' % (len(red), ' was' if len(red) == 1 else 's were'))
        else:
            say('Upload what is INSIDE that folder (docs/LAUNCH_CHECKLIST.md, step 3.2).')
    finally:
        try:
            remove_tree(tmp)
        except OSError:
            pass   # a temporary folder that Windows will not delete now is deleted with the next clean-up of the Temp folder


if __name__ == '__main__':
    main()
