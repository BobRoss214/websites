#!/usr/bin/env python3
"""The site doctor: one command that says, in plain words, what is wrong with the website and what to type to fix it.

  python3 tools/doctor.py              check everything (about 10 seconds), print a checklist, end with READY TO UPLOAD or NOT READY
  python3 tools/doctor.py --deploy DIR look for the upload folder somewhere else than deploy/ (the same as --out of make_deploy_folder.py)

On Windows type  python  instead of  python3.  It can be started from any folder: it always looks at the website folder it sits in.

What it checks, in this order:
  1. Setup          Python 3.8 or newer; beautifulsoup4 (needed to rebuild the pages and translations); Node.js (optional).
  2. The site files The built pages and translations are up to date (rebuilt in a temporary copy and compared), every language is complete,
                    the facts agree (a price, an hour, a phone number ... written two ways), every file the pages point to is there, every
                    script and style sheet that index.html names is there and not empty, and js/content.js has no typo (with its line number). A Google Search Console tag, once pasted,
                    is a real line of index.html and not words inside the comment that explains where it goes.
  3. Settings       Launch settings that are still empty (review link, analytics, farm point, signup). These are not red.
  4. Upload folder  deploy/ exists, is not out of date compared with the site, and matches its own FILES.txt; and one line each
                    says whether _headers and _redirects, the two files the host reads, are in it (a file saved as _redirects.txt is red).

Every red line says what is wrong, where (the file and words to search for), and the exact command or edit that fixes it.
It NEVER changes a file of the site (it only reads; the rebuild happens in a temporary copy that is deleted) and never uses the network.
The exit code is 0 when nothing is red, 1 when something is.
Needs only Python 3.8 or newer. Node.js is used when it is there (a more careful look at js/content.js), and is not needed.
"""
import sys

if sys.version_info < (3, 8):
    print('RED   Python %d.%d is too old: the site tools need Python 3.8 or newer.' % sys.version_info[:2])
    print('      Fix: install a newer Python from https://www.python.org/downloads/ and run this again.')
    sys.exit(1)

sys.dont_write_bytecode = True   # an import must not leave a __pycache__ folder in the site: this tool changes nothing
import argparse, concurrent.futures, hashlib, os, re, shutil, subprocess, tempfile, time

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

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'

PY = sys.executable or 'python3'
CMD = 'python3' if os.name != 'nt' else 'python'   # how the commands are written on the screen

try:
    sys.stdout.reconfigure(errors='replace')   # a file name with an accent must not stop the report on a Windows console
except Exception:
    pass

# ---------------------------------------------------------------- the report
SECTIONS = []   # [title, [item, ...]], each item {kind: ok|red|look, text, where, fix}


def section(title):
    SECTIONS.append([title, []])


def add(kind, text, where=None, fix=None, after=False, cmd=None):
    """after: the fix is for later (rebuilding and making the upload folder only helps once the other red lines are fixed). cmd: the one command to run next."""
    SECTIONS[-1][1].append({'kind': kind, 'text': text, 'where': where, 'fix': fix, 'after': after, 'cmd': cmd})


def color(kind):
    if os.environ.get('NO_COLOR') or not sys.stdout.isatty() or (os.name == 'nt' and not os.environ.get('WT_SESSION')):
        return '', ''
    return {'ok': ('\033[32m', '\033[0m'), 'red': ('\033[1;31m', '\033[0m'), 'look': ('\033[33m', '\033[0m')}[kind]


def show(elapsed):
    print('Wise Acres site doctor: looking at ' + ROOT + ' (nothing is changed)')
    for title, items in SECTIONS:
        print('')
        print(title)
        for it in items:
            tag = {'ok': 'OK  ', 'red': 'RED ', 'look': 'look'}[it['kind']]
            a, b = color(it['kind'])
            print('  %s%s%s  %s' % (a, tag, b, it['text']))
            if it['where']:
                print('        Where: ' + it['where'])
            if it['fix']:
                print('        Fix:   ' + it['fix'])
    reds = [it for _, items in SECTIONS for it in items if it['kind'] == 'red']
    print('')
    print('(checked in %.0f seconds)' % elapsed)
    if reds:
        lead = next((r for r in reds if not r['after']), reds[0])   # what has to be done by hand comes before rebuilding and making the upload folder
        first = lead['cmd'] or re.split(r'   ', (lead['fix'] or '').strip())[0]
        is_command = first.startswith(CMD + ' ') or first.startswith('python3 ') or first.startswith('python ')
        n = len(reds)
        print('NOT READY: %d thing%s to fix. Next: %s' % (n, '' if n == 1 else 's', first if is_command else 'do what the first RED line says under Fix, then run %s tools/doctor.py again.' % CMD))
        return 1
    print('READY TO UPLOAD: upload what is inside deploy/ (docs/LAUNCH_CHECKLIST.md, step 3.2). Afterwards: %s tools/launch_check.py https://YOUR-ADDRESS/' % CMD)
    return 0


def more(names, n=6):
    names = list(names)
    return ', '.join(names[:n]) + (' and %d more' % (len(names) - n) if len(names) > n else '')


def run(args, cwd, timeout=120):
    """(exit code, text) of a command; never raises."""
    try:
        r = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, encoding='utf-8', errors='replace', timeout=timeout)
        return r.returncode, r.stdout or ''
    except (OSError, subprocess.SubprocessError) as e:
        return 127, str(e)


def last_line(text):
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    return lines[-1] if lines else ''


# ---------------------------------------------------------------- 1. setup
def check_setup():
    section('1. Setup')
    add('ok', 'Python %d.%d.%d (3.8 or newer is needed)' % sys.version_info[:3])
    try:
        import bs4   # noqa: F401
        have_bs4 = True
        add('ok', 'beautifulsoup4 is installed (the tools that rebuild the pages and translations need it)')
    except ImportError:
        have_bs4 = False
        add('red', 'beautifulsoup4 is not installed, so the pages and translations cannot be rebuilt or checked. You need it as soon as you edit a file in pages/ or lang/src/, and for the upload folder.',
            fix='%s -m pip install beautifulsoup4   (if pip answers "externally-managed-environment" on a new Mac or Linux computer, or you made a .venv folder and have not switched it on in this window: README, "Commands on Windows, Mac and Linux", step 4)' % CMD)
    node = shutil.which('node')
    version = ''
    if node:
        code, out = run([node, '--version'], ROOT, 20)
        version = out.strip() if code == 0 else ''
        if not version:
            node = None
    if node:
        add('ok', 'Node.js %s is installed (optional: it makes the check of js/content.js more careful, and runs the automatic tests)' % version)
    else:
        add('look', 'Node.js was not found. You do not need it to edit or upload the site. Without it, js/content.js is checked less carefully (brackets, quotes and commas only) and the automatic tests in tests/ cannot run (only a developer needs those).')
    return have_bs4, node


# ---------------------------------------------------------------- 2. the site files
REBUILD = ['tools/pages.py'], ['tools/i18n.py', 'extract'], ['tools/i18n.py', 'jsstrings'], ['tools/i18n.py', 'build']


def rebuilt_copy(tmp):
    """Copies the site into tmp (outside the site) and runs the rebuild commands there. Returns (folder, None) or (None, (command, message))."""
    import make_deploy_folder as mdf
    site = os.path.join(tmp, 'site')
    shutil.copytree(ROOT, site, ignore=lambda d, names: [n for n in names if n in mdf.SKIP_COPY])
    for args in REBUILD:
        code, out = run([PY, '-B'] + args, site)
        if code != 0:
            return None, (CMD + ' ' + ' '.join(args), out.strip())
    return site, None


def check_built(site, failure):
    """Are the built pages and translations up to date? Also the languages."""
    import make_deploy_folder as mdf
    if failure:
        cmd, out = failure
        add('red', 'The pages or translations cannot be rebuilt: "%s" stops with: %s' % (cmd, last_line(out) or 'no message'),
            where='the file named in that message (a file in pages/, or lang/src/<language>.json); the whole message: %s' % ' / '.join(l.strip() for l in out.strip().splitlines()[:4]),
            fix='%s   (after you fix what the message says; README, "Change one sentence and its translations")' % cmd)
        return
    stale = [f for f in mdf.stale_files(site) if f != 'lang/js-strings.json']   # that list is for translators and is not uploaded
    if stale:
        add('red', 'These built files are out of date (a page or a translation was edited and not rebuilt): ' + more(stale),
            where=more(stale),
            fix='%s tools/make_deploy_folder.py   (it rebuilds them and then makes the upload folder)' % CMD, after=True)
    else:
        add('ok', 'The pages and translations are up to date (rebuilt in a temporary copy and compared: nothing differs)')


def check_languages(site):
    """Complete translations for every language in lang/src/."""
    codes = sorted(f[:-5] for f in os.listdir(os.path.join(site, 'lang', 'src')) if f.endswith('.json'))
    if not codes:
        add('red', 'There are no translation files in lang/src/.', where='lang/src/', fix='put the files back from your backup, or ask Claude')
        return

    def one(code):
        return code, run([PY, '-B', 'tools/i18n.py', 'missing', code], site)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(codes)) as pool:
        results = list(pool.map(one, codes))
    done = []
    for code, (rc, out) in results:
        m = re.search(r'(\d+) translated, (\d+) missing.*JavaScript: (\d+) missing', out)
        if not m:
            add('red', 'The translation check for %s could not run: %s' % (code, last_line(out)), where='lang/src/%s.json' % code, fix='%s tools/i18n.py missing %s   and read what it says' % (CMD, code))
        elif int(m.group(2)) or int(m.group(3)):
            add('red', '%s is not complete: %s page text(s) and %s text(s) written by the code have no translation yet.' % (code, m.group(2), m.group(3)),
                where='lang/src/%s.json (the words are listed by the command below)' % code,
                fix='%s tools/i18n.py missing %s --list   shows them; add each one to lang/src/%s.json, then run %s tools/i18n.py build' % (CMD, code, code, CMD),
                cmd='%s tools/i18n.py missing %s --list' % (CMD, code))
        else:
            done.append('%s %s' % (code, m.group(1)))
    if done and len(done) == len(codes):
        add('ok', 'Every language is complete (texts translated: ' + ', '.join(done) + ')')


def check_facts():
    """The facts that must agree (prices, hours, phone, e-mail, address, ages, year): tools/check_facts.py."""
    script = os.path.join(ROOT, 'tools', 'check_facts.py')
    if not os.path.isfile(script):
        add('look', 'tools/check_facts.py is not in this folder, so the facts were not compared.')
        return
    code, out = run([PY, '-B', script, '--short'], ROOT)
    if code == 0:
        m = re.search(r'(\d+) of (\d+) facts agree everywhere', out)
        add('ok', 'The facts agree everywhere (%s compared: prices, hours, phone, e-mail, address, ages, year)' % (m.group(2) + ' facts' if m else 'all'))
        return
    block = out.split('WHAT TO DO NEXT')[-1] if 'WHAT TO DO NEXT' in out else ''
    lines = [l[4:].strip() for l in block.splitlines() if l.startswith('  - ')]
    if code != 1 or not lines:
        add('red', 'The facts check could not run: ' + (last_line(out) or 'no message'), fix='%s tools/check_facts.py   and read what it says' % CMD)
        return
    for l in lines:
        add('red', 'A fact is written two ways: ' + l,
            where='every place is listed, with its words, by the command below (the five pages in the top folder are built from pages/: edit pages/, never the built copy)',
            fix='%s tools/check_facts.py' % CMD)


def check_links(site, tmp):
    """Every file the pages point to is there. Returns the folder holding the files that would be uploaded (for the deploy check)."""
    import make_deploy_folder as mdf
    files, _ = mdf.upload_set(site)
    upload = os.path.join(tmp, 'upload')
    for f in files:
        dst = os.path.join(upload, *f.split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(site, *f.split('/')), dst)
    canon = None
    try:
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', mdf.read(os.path.join(upload, 'index.html')).decode('utf-8', 'replace'))
    except OSError:
        pass
    problems, _unused = mdf.check_links(upload, canon.group(1) if canon else 'https://www.wiseacresorganic.com/')
    if problems:
        first = problems[0]
        m = re.search(r'points to (\S+), which is not', first)
        add('red', '%d link(s) in the pages point to a file that is not there: %s' % (len(problems), more(problems, 3)),
            where='%s (search for %s in that file)' % (first.split(' points')[0], m.group(1) if m else 'the name'),
            fix='put the missing file back in its folder (from your backup), or correct the name in the page; then run %s tools/doctor.py again' % CMD)
    else:
        add('ok', 'Every file the pages point to is there (%d files would be uploaded)' % len(files))
    return upload, files


def check_assets():
    """Every script and style sheet that index.html names is there and not empty."""
    try:
        with open(os.path.join(ROOT, 'index.html'), 'rb') as f:
            html = f.read().decode('utf-8', 'replace')
    except OSError:
        add('red', 'index.html cannot be read.', where='index.html', fix='put index.html back from your backup')
        return
    refs = sorted(set(re.findall(r'<script[^>]+src="([^"#?]+)"', html) + re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"#?]+)"', html)))
    refs = [r for r in refs if not re.match(r'^(https?:)?//', r)]
    bad = []
    for r in refs:
        p = os.path.join(ROOT, *r.split('/'))
        if not os.path.isfile(p):
            bad.append((r, 'is missing'))
        elif os.path.getsize(p) == 0:
            bad.append((r, 'is empty (0 bytes)'))
    for r, why in bad:
        add('red', '%s %s, so the page loses what it does or how it looks.' % (r, why), where='index.html names it (search for %s)' % r,
            fix='put %s back from your backup (a saved copy of the folder), or ask Claude' % r)
    if not bad:
        add('ok', 'Every script and style sheet named in index.html is there and not empty (%d files)' % len(refs))


def check_search_console():
    """The Google Search Console tag, once the owner has pasted one: it must be a real line in the head of index.html, not words inside the HTML comment that explains where it goes."""
    try:
        with open(os.path.join(ROOT, 'index.html'), 'rb') as f:
            html = f.read().decode('utf-8', 'replace')
    except OSError:
        return   # check_assets has already said so
    comments = [m.span() for m in re.finditer(r'<!--.*?-->', html, re.S)]
    live, hidden = [], []
    for m in re.finditer(r'<meta\b[^>]*google-site-verification[^>]*>', html, re.I):
        c = re.search(r'content\s*=\s*["\']([^"\']*)["\']', m.group(0), re.I)
        code = c.group(1).strip() if c else ''
        (hidden if any(a <= m.start() < b for a, b in comments) else live).append(code)
    is_example = lambda code: not code or re.fullmatch(r'[Xx]+', code) is not None
    real_hidden = [c for c in hidden if not is_example(c) and c not in live]
    if real_hidden:
        add('red', 'The Google Search Console tag (content="%s...") is in index.html, but inside the explaining comment (<!-- ... -->), so Google cannot see it and "Verify" will fail.' % real_hidden[0][:12],
            where='index.html, the comment that starts "GOOGLE SEARCH CONSOLE" (search for GOOGLE SEARCH CONSOLE)',
            fix='cut the whole line that starts <meta name="google-site-verification" and paste it on a new line of its own BELOW that comment, after its closing -->, then run this again')
    elif [c for c in live if is_example(c)]:
        add('red', 'index.html has a google-site-verification line that still holds the example text (content="XXXXXXXX") or nothing, so Google cannot verify the site with it.',
            where='index.html (search for google-site-verification)', fix='replace it with the whole line Google Search Console gave you (README, "Google Search Console"), or delete the line if you have no tag yet')
    elif live:
        add('ok', 'The Google Search Console tag is in the head of index.html (the home page only, which is all Google needs)')


NODE_SCRIPT = r"""
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[1], 'utf8');
try {
  const w = {}; w.window = w;
  vm.runInNewContext(src, w, { filename: 'content.js' });
  if (!w.WISE_ACRES || !w.WISE_ACRES.hours) { console.log('NOHOURS'); process.exit(2); }
} catch (e) {
  const m = /content\.js:(\d+)/.exec(String(e.stack || ''));
  console.log('ERR ' + (m ? m[1] : '?') + ' ' + e.name + ': ' + e.message);
  process.exit(1);
}
"""


def js_problem(src):
    """A careful look at JavaScript data without Node: returns (line, message) for the first mistake, or None. Looks at quotes, comments, brackets and commas."""
    n, i, line = len(src), 0, 1
    stack = []          # [char, line, is_literal] for each open bracket
    prev = None         # (kind, text, line) of the last token
    VALUE_END = ('str', 'num', 'ident', 'close')
    VALUE_START = ('str', 'num', 'ident', 'open')
    KEYWORDS = {'var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'new', 'typeof', 'in', 'of', 'delete', 'void', 'this', 'true', 'false', 'null', 'undefined', 'window'}
    while i < n:
        c = src[i]
        inside_list = bool(stack and stack[-1][2])   # in a list or a block of settings (before this token opens or closes anything)
        if c == '\n':
            line += 1; i += 1; continue
        if c in ' \t\r\f\v﻿ ':
            i += 1; continue
        if c == '/' and src[i:i + 2] == '//':
            j = src.find('\n', i)
            i = n if j < 0 else j
            continue
        if c == '/' and src[i:i + 2] == '/*':
            j = src.find('*/', i + 2)
            if j < 0:
                return line, 'a comment that starts with /* is never closed with */'
            line += src.count('\n', i, j)
            i = j + 2
            continue
        if c in '\'"':
            j, start = i + 1, line
            while j < n and src[j] != c:
                if src[j] == '\\':
                    if src[j + 1:j + 2] == '\n':
                        line += 1
                    j += 2
                    continue
                if src[j] == '\n':
                    return line, 'a text in %s quote marks is not closed on this line (an apostrophe inside single quotes, as in \'We\'re open\', or a missing closing quote mark)' % ('single' if c == "'" else 'double')
                j += 1
            if j >= n:
                return start, 'a text in quote marks is never closed'
            tok = ('str', src[i:j + 1], line)
            i = j + 1
        elif c == '`':
            j = src.find('`', i + 1)
            if j < 0:
                return line, 'a text in backticks is never closed'
            tok = ('str', src[i:j + 1], line)
            line += src.count('\n', i, j)
            i = j + 1
        elif c in '‘’“”':
            return line, 'a curly quote mark (%s), often pasted from Word or an email, instead of a straight one (\' or ")' % c
        elif c.isdigit() or (c == '.' and src[i + 1:i + 2].isdigit()):
            j = i + 1
            while j < n and (src[j].isalnum() or src[j] in '._'):
                j += 1
            tok = ('num', src[i:j], line)
            i = j
        elif c.isalpha() or c in '_$':
            j = i + 1
            while j < n and (src[j].isalnum() or src[j] in '_$'):
                j += 1
            tok = ('ident', src[i:j], line)
            i = j
        elif c in '{[(':
            literal = c == '[' or (c == '{' and (prev is None or prev[1] in ('=', ':', ',', '(', '[', 'return', '?')))
            stack.append([c, line, literal])
            tok = ('open', c, line)
            i += 1
        elif c in '}])':
            want = {'}': '{', ']': '[', ')': '('}[c]
            if not stack:
                return line, 'a closing %s that has no opening %s' % (c, want)
            top = stack.pop()
            if top[0] != want:
                return line, 'a closing %s here, but the %s opened on line %d is not closed yet' % (c, top[0], top[1])
            tok = ('close', c, line)
            i += 1
        else:
            tok = ('punct', c, line)
            i += 1
        # a comma is missing between two values on different lines inside a list or a block of settings
        if prev and prev[0] in VALUE_END and tok[0] in VALUE_START and prev[2] != tok[2] and inside_list \
                and not (tok[0] == 'ident' and tok[1] in KEYWORDS) and not (prev[0] == 'ident' and prev[1] in KEYWORDS and prev[1] not in ('true', 'false', 'null')):
            return tok[2], 'a comma is probably missing at the end of line %d, before this one' % prev[2]
        prev = tok
    if stack:
        top = stack[-1]
        return top[1], 'the %s opened on this line is never closed' % top[0]
    return None


def check_content(node):
    path = os.path.join(ROOT, 'js', 'content.js')
    if not os.path.isfile(path):
        add('red', 'js/content.js is missing: the notice bar, hours, closures, photos and reviews would all be off.', where='js/content.js', fix='put the file back from your backup')
        return
    hint = 'Look at that line and the one above it: a missing comma at the end of a line, an apostrophe inside single quotes (write "We\'re open" with double quotes), or a curly quote mark are the usual causes. Undo your last change (Ctrl+Z) or put your saved copy back.'
    if node:
        code, out = run([node, '-e', NODE_SCRIPT, path], ROOT, 60)
        if code == 0:
            add('ok', 'js/content.js has no typo (read by Node.js: it runs and defines the hours)')
            return
        m = re.match(r'ERR (\S+) (.*)', out.strip())
        if m:
            where = 'js/content.js, line %s' % m.group(1) if m.group(1) != '?' else 'js/content.js'
            add('red', 'js/content.js has a typo: %s. Until it is fixed, the notice bar, hours, closures, photos and reviews are all off, and visitors see no message.' % m.group(2), where=where, fix=hint)
            return
        if out.strip().startswith('NOHOURS'):
            add('red', 'js/content.js runs but does not define the opening hours (hours: { ... }).', where='js/content.js (search for hours:)', fix='put the hours block back from your backup, or ask Claude')
            return
    try:
        with open(path, 'rb') as f:
            src = f.read().decode('utf-8')
    except (OSError, UnicodeDecodeError) as e:
        add('red', 'js/content.js cannot be read as text (%s). It must be saved as plain UTF-8 text, not from Word.' % e, where='js/content.js', fix='open it in Notepad or TextEdit (plain text) and save it again, or put your saved copy back')
        return
    p = js_problem(src)
    if p:
        add('red', 'js/content.js has a typo at line %d: %s. Until it is fixed, the notice bar, hours, closures, photos and reviews are all off, and visitors see no message. (Found without Node.js, which looks less carefully.)' % p,
            where='js/content.js, line %d' % p[0], fix=hint)
    else:
        add('ok', 'js/content.js looks fine (checked less carefully, without Node.js: brackets, quotes and commas only)')


# ---------------------------------------------------------------- 3. launch settings
def check_settings():
    import make_deploy_folder as mdf
    section('3. Settings to look at before launch (not red: the site works without them)')
    notes = list(mdf.settings_warnings(ROOT))
    try:
        with open(os.path.join(ROOT, 'js', 'content.js'), encoding='utf-8', errors='replace') as f:
            src = f.read()
        if re.search(r"^  analytics:\s*\{\s*provider:\s*'none'", src, re.M):
            notes.append("analytics is off: no visits are counted. That is fine for launch. To count visits later, ask Claude (README, \"Turn on analytics\"; checklist, step 3.9).")
        m = re.search(r"^  reviewUrl:\s*(['\"])(https?://.+?)\1", src, re.M)
        if m:   # the printable review sign carries the link: it is made only once reviewUrl is set, and again whenever it changes
            try:
                with open(os.path.join(ROOT, 'print', 'qr-signs.html'), encoding='utf-8', errors='replace') as f:
                    sheet = f.read()
            except OSError:
                sheet = ''
            if m.group(2) not in sheet and m.group(2).replace('&', '&amp;') not in sheet:
                notes.append('reviewUrl is set, but the printable review sign (print/qr-signs.html) does not carry that link yet, so a sign printed from it would not match the button. Ask Claude, or run: %s tools/make_qr.py (it needs: %s -m pip install segno).' % (CMD, CMD))
    except OSError:
        pass
    if notes:
        for w in notes:
            add('look', w)
    else:
        add('ok', 'The launch settings (season buttons, farm point, review link, signup, analytics) are all set.')


# ---------------------------------------------------------------- 4. the upload folder
def parse_files_txt(path):
    rows = {}
    note = []
    text = open(path, encoding='utf-8', errors='replace').read()
    for line in text.splitlines():
        m = re.match(r'^\s*(\d+)\s+([0-9a-f]{64})\s+(.+?)\s*$', line)
        if m:
            rows[m.group(3)] = (int(m.group(1)), m.group(2))
    forced = 'built with --force' in text
    if forced:
        note = [l.strip(' -') for l in text.splitlines() if l.startswith('  - ')]
    fp = re.search(r'sha256 of the whole folder: ([0-9a-f]{64})', text)
    return rows, (fp.group(1) if fp else None), note


def check_deploy(deploy, upload, upload_files):
    import make_deploy_folder as mdf
    section('4. The upload folder')
    shown = os.path.relpath(deploy, ROOT) if deploy.startswith(ROOT) else deploy
    host = mdf.host_rule_lines(ROOT, upload_files, shown)
    if not os.path.isdir(deploy) or not os.path.isfile(os.path.join(deploy, 'FILES.txt')):
        for kind, line, fix in host:
            if kind == 'red':   # a host file saved as _redirects.txt, or deleted: worth knowing before the upload folder is made
                add(kind, line, where='the top of the site folder', fix=fix)
        add('red', 'There is no upload folder yet (%s/ with its FILES.txt).' % shown, where=shown + '/',
            fix='%s tools/make_deploy_folder.py' % CMD, after=True)
        return
    rows, fingerprint, forced = parse_files_txt(os.path.join(deploy, 'FILES.txt'))
    have = {mdf.rel(p, deploy): p for p in mdf.walk(deploy)}
    have.pop('FILES.txt', None)
    # 1. does the folder match its own FILES.txt?
    off = []
    for f, (size, h) in sorted(rows.items()):
        p = have.get(f)
        if p is None:
            off.append('%s is missing' % f)
        else:
            data = mdf.read(p)
            if len(data) != size or hashlib.sha256(data).hexdigest() != h:
                off.append('%s was changed' % f)
    off += ['%s is not listed' % f for f in sorted(set(have) - set(rows))]
    whole = hashlib.sha256()
    for f in sorted(rows):
        whole.update(('%s\0%s\n' % (f, rows[f][1])).encode('utf-8'))
    if fingerprint and not off and whole.hexdigest() != fingerprint:
        off.append('the fingerprint on the last line was edited')
    if not rows:
        off.append('FILES.txt lists no files')
    if off:
        add('red', '%s/ does not match its own FILES.txt (someone changed a file inside it): %s' % (shown, more(off)), where=shown + '/FILES.txt',
            fix='%s tools/make_deploy_folder.py   (it makes the folder again from scratch)' % CMD, after=True)
    else:
        add('ok', '%s/ matches its FILES.txt (%d files, none changed or missing)' % (shown, len(rows)))
    # 2. is it out of date compared with the site as it is now?
    differ = []
    for f in sorted(upload_files):
        mine = os.path.join(upload, *f.split('/'))
        theirs = have.get(f)
        if theirs is None:
            differ.append('%s is not in it' % f)
        elif not mdf.same_text(mdf.read(mine), mdf.read(theirs)):
            differ.append('%s is older than the site' % f)
    differ += ['%s should not be in it' % f for f in sorted(set(have) - set(upload_files))]
    if differ:
        add('red', '%s/ is out of date: the site has changed since it was made: %s' % (shown, more(differ)), where=more([d.split(' ')[0] for d in differ]),
            fix='%s tools/make_deploy_folder.py' % CMD, after=True)
    else:
        add('ok', '%s/ is up to date (every file is what the site has now)' % shown)
    for kind, line, fix in host:
        add(kind, line, where='the top of the site folder' if kind == 'red' else None, fix=fix)
    if forced:
        add('red', '%s/ was built with --force although these checks were red: %s' % (shown, more(forced, 3)), where=shown + '/FILES.txt',
            fix='fix those first, then %s tools/make_deploy_folder.py (without --force)' % CMD)


# ---------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description='Say, in plain words, what is wrong with the site and what to type to fix it.')
    ap.add_argument('--deploy', default=os.path.join(ROOT, 'deploy'), help='where the upload folder is (default: deploy/ in the site folder)')
    args = ap.parse_args(argv)
    started = time.time()
    if not os.path.isfile(os.path.join(ROOT, 'index.html')) or not os.path.isdir(os.path.join(ROOT, 'tools')):
        print('RED   I cannot find index.html next to the tools folder, so this is not the website folder.')
        print('      Fix:  open a terminal in the website folder (the one that holds index.html) and run:  %s tools/doctor.py' % CMD)
        return 1
    try:
        import make_deploy_folder   # noqa: F401  (the helpers it has: the upload list, the link check, the launch settings)
    except ImportError:
        print('RED   tools/make_deploy_folder.py is missing, and this tool uses it. Put it back from your backup.')
        return 1
    have_bs4, node = check_setup()
    section('2. The site files')
    tmp = tempfile.mkdtemp(prefix='wa-doctor-')
    try:
        site, failure = (None, None)
        if have_bs4:
            site, failure = rebuilt_copy(tmp)
            check_built(site, failure)
            if site:
                check_languages(site)
        else:
            add('look', 'The pages, translations and language check were skipped (they need beautifulsoup4: see above).')
        check_facts()
        source = site or ROOT   # without a rebuild the files as they are are compared
        upload, upload_files = check_links(source, tmp) if (site or not failure) else (None, None)
        check_assets()
        check_content(node)
        check_search_console()
        check_settings()
        if upload:
            check_deploy(os.path.abspath(args.deploy), upload, upload_files)
        else:
            section('4. The upload folder')
            add('look', 'Not checked: the pages could not be rebuilt (see above).')
        return show(time.time() - started)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
