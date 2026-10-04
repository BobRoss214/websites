#!/usr/bin/env python3
"""Reader sheets for the words that exist only if the farm picks an option.

The reader sheets of tools/review_sheet.py cover the site as it is today. An optional patch in patches/optional/ can add or change words in Spanish, Hindi,
Chinese and Vietnamese (the privacy page adds dozens, the winter options one sentence each), and nobody has read those. This tool finds them and writes a
small sheet per option, in the same plain format, for the friend who reads that language.

  python3 tools/review_option_texts.py                     every patch in patches/optional/: one sheet per language for each patch that has words, and an index
  python3 tools/review_option_texts.py --patch FILE        also this patch file (repeat it), for a patch that is not in patches/optional/ yet
  python3 tools/review_option_texts.py --only NAME         only the patches whose file name contains NAME (repeat it for more)
  python3 tools/review_option_texts.py --out DIR            where to write (default: review/options, which is not uploaded)
  python3 tools/review_option_texts.py --list              say what each patch header promises (Strings:) and which question it answers; builds nothing
  python3 tools/review_option_texts.py --jobs 3             how many patches to try at the same time (default 2)

For each patch, alone, in a throw-away copy of the site (your files are never touched): git apply (strict), the rebuild commands (pages.py, i18n.py extract, jsstrings,
build), i18n.py missing for es hi zh vi (must say 0), and the facts check of the translations (node tools/i18n_facts.mjs, when Node is installed). Then every text that is
NEW or CHANGED compared with the site as it is now is written to a sheet: for a text that replaces an older one, the older English is shown too ("replaces").
Files, in DIR:
  INDEX.txt, index.json     which sheet to hand out for which owner answer, and what was found (texts, missing translations, facts differences)
  <patch>/<code>.csv        opens in Excel or Google Sheets: id, where, English, current translation, replaces, turned on by, correction, note
  <patch>/<code>.html       the same table for reading or printing
A text that is not translated in a language is on the sheet with an empty "current translation", and the index says so. The reader writes corrections in the "correction"
column. Corrections of an option sheet are NOT imported into the site (the words are not in it yet): send them to Claude, who changes the translation lines inside the patch file.
Needs Python 3.8 or newer, git, and the packages of tools/pages.py (beautifulsoup4). Exit code: 0 done, 1 a patch could not be tried, 2 a wrong command.
"""
import collections
import concurrent.futures
import csv
import difflib
import html
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

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
import review_sheet as rs  # noqa: E402  (the sheet format, the language names and fonts)

PATCH_DIR = os.path.join(ROOT, 'patches', 'optional')
LANGS = ['es', 'hi', 'zh', 'vi']
HEADER = ['id', 'where', 'English', 'current translation', 'replaces', 'turned on by', 'correction', 'note']
REBUILD = [['pages.py'], ['i18n.py', 'extract'], ['i18n.py', 'jsstrings'], ['i18n.py', 'build']]


# ---------------------------------------------------------------- the patches
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


def question_titles():
    """{'d25': 'Spring Reserve buttons ...'} from the table "Every dashboard question" of docs/DECISION_PLAYBOOK.md (empty when the file is not there)."""
    try:
        with open(os.path.join(ROOT, 'docs', 'DECISION_PLAYBOOK.md'), encoding='utf-8') as f:
            text = f.read()
    except OSError:
        return {}
    return {m.group(1): m.group(2).strip() for m in re.finditer(r'^\| (d\d\d) \| ([^|]+?) \|', text, re.M)}


class Option(object):
    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.file = os.path.basename(path)
        self.head = read_header(path)
        self.id = self.head.get('Option') or self.file.replace('.patch', '')
        self.name = self.head.get('Name', self.id)
        self.answers = self.head.get('Answers', '')
        self.promise = self.head.get('Strings', '(no Strings: line)')


def find_options(only, extra):
    paths = sorted(os.path.join(PATCH_DIR, f) for f in os.listdir(PATCH_DIR) if f.endswith('.patch')) if os.path.isdir(PATCH_DIR) else []
    paths += [os.path.abspath(p) for p in extra]
    opts = [Option(p) for p in paths]
    if only:
        opts = [o for o in opts if any(w.lower() in o.file.lower() or w.lower() in o.id.lower() for w in only)]
    seen = set()
    for o in opts:
        if o.id in seen:
            raise SystemExit('Two patches have the same Option: line (%s).' % o.id)
        seen.add(o.id)
    return opts


# ---------------------------------------------------------------- one throw-away copy
def run(cmd, cwd, timeout=900):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
        return r.returncode, (r.stdout or '') + (r.stderr or '')
    except (OSError, subprocess.TimeoutExpired) as e:
        return 99, str(e)


def make_copy(dest):
    shutil.copytree(ROOT, dest, ignore=shutil.ignore_patterns('.git', 'node_modules', 'deploy', 'review', '__pycache__', '.visual', 'timings.json'))


def try_tree(tree, patch=None):
    """Applies a patch (or none), rebuilds, counts what is missing, runs the facts check. Returns a dict."""
    res = dict(applied=True, problems=[], missing={}, facts=None)
    if patch:
        code, out = run(['git', 'apply', '--whitespace=nowarn', patch], tree)
        if code:
            res['applied'] = False
            res['problems'].append('git apply: ' + ' '.join(out.split())[:300])
            return res
    for step in REBUILD:
        code, out = run([sys.executable, os.path.join('tools', step[0])] + step[1:], tree)
        if code:
            res['problems'].append('%s stopped: %s' % (' '.join(step), ' '.join(out.split())[-300:]))
    for c in LANGS:
        code, out = run([sys.executable, os.path.join('tools', 'i18n.py'), 'missing', c], tree)
        m = re.search(r'(\d+) missing.*JavaScript: (\d+) missing', out)
        res['missing'][c] = (int(m.group(1)), int(m.group(2))) if m else (-1, -1)
    if shutil.which('node') and os.path.exists(os.path.join(tree, 'tools', 'i18n_facts.mjs')):
        code, out = run(['node', os.path.join('tools', 'i18n_facts.mjs'), '--lang', ','.join(LANGS)], tree, 300)
        res['facts'] = dict(code=code, lines=[l for l in out.splitlines() if l.strip()][:60])
    return res


def load_items(tree):
    """{code: {id: Item}} for every text of the site in that copy, with the module of that copy (its own review_sheet.py)."""
    spec = importlib.util.spec_from_file_location('review_sheet_' + re.sub(r'\W', '_', tree), os.path.join(tree, 'tools', 'review_sheet.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    site = mod.Site()
    return {c: collections.OrderedDict((i.id, i) for i in mod.build_items(site, c)) for c in LANGS}


def compare(default, patched):
    """For one language: the rows of the patched copy that are new or changed, each with what it replaces. [(Item, replaces, status)]"""
    gone = [i for k, i in default.items() if k not in patched]
    rows = []
    for k, it in patched.items():
        old = default.get(k)
        if old is None:
            best, ratio = None, 0.0
            for g in gone:
                r = difflib.SequenceMatcher(None, rs.plain(g.english), rs.plain(it.english)).ratio()
                if r > ratio:
                    best, ratio = g, r
            rows.append((it, best.english if best is not None and ratio >= 0.55 else '', 'new'))
        elif old.current != it.current or old.english != it.english:
            rows.append((it, old.current if old.current != it.current else '', 'changed translation'))
    return rows


# ---------------------------------------------------------------- the sheets
def turned_on_by(opt, titles):
    ids = [] if 'placeholder' in opt.answers.lower() else re.findall(r'\bd\d\d\b', opt.answers)   # a question number that is only a placeholder names no question yet
    names = '; '.join('%s %s' % (d, titles[d]) for d in dict.fromkeys(ids) if d in titles)
    return ('Owner answer: %s' % opt.answers) + ((' (' + names + ')') if names else '') + '. Option: %s' % opt.id


def csv_sheet(rows, on):
    out = io.StringIO(newline='')
    w = csv.writer(out, lineterminator='\r\n', quoting=csv.QUOTE_MINIMAL)
    w.writerow(HEADER)
    for it, replaces, status in rows:
        w.writerow([it.id, rs.safe_cell(it.where), rs.safe_cell(rs.show(it.kind, it.english)), rs.safe_cell(rs.show(it.kind, it.current)),
                    rs.safe_cell(rs.show(it.kind, replaces) if replaces else ('(a changed translation)' if status != 'new' else '')), rs.safe_cell(on), '', ''])
    return b'\xef\xbb\xbf' + out.getvalue().encode('utf-8')


def html_sheet(code, rows, opt, on):
    name, own, html_lang = rs.LANG_NAMES.get(code, (code, code, code))
    body = []
    for n, (it, replaces, status) in enumerate(rows, 1):
        note = html.escape(rs.show(it.kind, replaces)) if replaces and status == 'new' else ('<i>a changed translation; it said before:</i> ' + html.escape(replaces) if replaces else '')
        body.append('<tr><td class="n">%d</td><td class="id">%s</td><td class="where">%s</td><td lang="en">%s</td><td lang="%s">%s</td><td class="old">%s</td><td class="write"></td><td class="write"></td></tr>'
                    % (n, html.escape(it.id), html.escape(it.where), rs.chips(rs.show(it.kind, it.english)), html_lang, rs.chips(rs.show(it.kind, it.current)) or '<b>(not translated yet)</b>', note))
    font = rs.FONTS.get(code, rs.FONTS['es'])
    return '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Wise Acres: check the %(name)s words of one option</title>
<style>
body{margin:0;padding:18px 22px;font:18px/1.5 system-ui,"Segoe UI",Roboto,Arial,sans-serif;color:#222;background:#fff}
h1{font-size:26px;margin:0 0 6px}
.how{max-width:62em;background:#f6f1e7;border:1px solid #d8cdb5;border-radius:10px;padding:10px 18px;margin:10px 0 18px}
.how li{margin:.25em 0}
table{border-collapse:collapse;width:100%%;table-layout:fixed;font-size:18px}
th,td{border:1px solid #999;padding:8px 10px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
thead th{background:#eee;font-size:16px}
td.n,td.id{font:14px/1.3 ui-monospace,Consolas,monospace;color:#555}
td.where,td.old{font-size:15px;color:#444}
td[lang="%(html_lang)s"]{font-family:%(font)s;font-size:20px;line-height:1.6}
td.write{height:3.6em}
.tag{display:inline-block;font:13px/1.2 ui-monospace,Consolas,monospace;background:#e6eefb;border:1px solid #9ab;border-radius:4px;padding:0 4px;margin:0 1px}
@media print{@page{size:landscape;margin:12mm}body{padding:0;font-size:14px}table{font-size:14px}td[lang="%(html_lang)s"]{font-size:16px}thead{display:table-header-group}tr{break-inside:avoid}.how{break-after:avoid}}
</style>
</head>
<body>
<h1>Wise Acres website, option "%(opt)s": please check the %(name)s words (%(own)s)</h1>
<div class="how">
<p><b>These words are on the website only if the farm chooses this option.</b> %(on)s Each row is one piece of text. Read the English and the %(name)s next to it.</p>
<ol>
<li>If the %(name)s is right and sounds natural, leave the row alone.</li>
<li>If something is wrong or sounds odd, write the better text in the <b>correction</b> column (the whole line, not only the changed word).</li>
<li>Keep the numbers, prices, times, names (Wise Acres, Wise Pie, The GreenHouse) and e-mail addresses as they are. Keep the blue marks, such as <span class="tag">&lt;a1&gt;</span> or <span class="tag">&lt;strong&gt;</span>.</li>
<li>The <b>replaces</b> column shows the older English this text takes the place of. Use the <b>note</b> column for a question or a remark.</li>
</ol>
</div>
<table>
<colgroup><col style="width:4%%"><col style="width:8%%"><col style="width:11%%"><col style="width:21%%"><col style="width:22%%"><col style="width:12%%"><col style="width:13%%"><col style="width:9%%"></colgroup>
<thead><tr><th scope="col">row</th><th scope="col">id</th><th scope="col">where</th><th scope="col">English</th><th scope="col">current %(name)s</th><th scope="col">replaces</th><th scope="col">correction</th><th scope="col">note</th></tr></thead>
<tbody>
%(rows)s
</tbody>
</table>
</body>
</html>
''' % {'name': name, 'own': own, 'html_lang': html_lang, 'font': font, 'rows': '\n'.join(body), 'opt': html.escape(opt.id), 'on': html.escape(on)}


# ---------------------------------------------------------------- one patch, start to end
def one_patch(opt, default_items, out_dir, keep=False):
    tmp = tempfile.mkdtemp(prefix='opt-texts-')
    info = dict(option=opt.id, file=opt.file, name=opt.name, answers=opt.answers, promise=opt.promise, applied=False, problems=[], missing={}, facts=None, texts={}, sheets=[], not_translated={}, english_only=[], english_only_words=[])
    try:
        tree = os.path.join(tmp, 'site')
        make_copy(tree)
        res = try_tree(tree, opt.path)
        info.update(applied=res['applied'], problems=res['problems'], missing=res['missing'], facts=res['facts'])
        if not res['applied']:
            return info
        patched = load_items(tree)
        relabel_moved_pages(patched, tree)
        titles = question_titles()
        on = turned_on_by(opt, titles)
        for c in LANGS:
            rows = compare(default_items[c], patched[c])
            info['texts'][c] = dict(new=sum(1 for r in rows if r[2] == 'new'), changed=sum(1 for r in rows if r[2] != 'new'))
            info['not_translated'][c] = [it.id for it, _, status in rows if status == 'new' and not it.current.strip()]
            if rows:
                folder = os.path.join(out_dir, opt.id)
                os.makedirs(folder, exist_ok=True)
                with open(os.path.join(folder, c + '.csv'), 'wb') as f:
                    f.write(csv_sheet(rows, on))
                with open(os.path.join(folder, c + '.html'), 'w', encoding='utf-8', newline='\n') as f:
                    f.write(html_sheet(c, rows, opt, on))
                info['sheets'].append('%s/%s.html' % (opt.id, c))
        # visible English-only words: a page the patch adds that is outside the translation system (the redirect pages)
        info['english_only'] = english_only_pages(tree)
        info['english_only_words'] = english_only_words(tree, info['english_only'])
        if info['english_only']:
            folder = os.path.join(out_dir, opt.id)
            os.makedirs(folder, exist_ok=True)
            with open(os.path.join(folder, 'english-only-pages.txt'), 'w', encoding='utf-8', newline='\n') as f:
                f.write('Pages that option "%s" adds outside the translation system: their words exist in English only.\n\n' % opt.id)
                f.write('\n'.join('%s: %s' % (p, w) for p, w in info['english_only_words']) + '\n')
        return info
    finally:
        if not keep:
            shutil.rmtree(tmp, ignore_errors=True)


def moved_pages(tree):
    """{folder: [text ids]} for the "this page has moved" pages of an old-address option: folders with an index.html that load js/moved.js (their words are translated through lang/src)."""
    out = {}
    for d in sorted(os.listdir(tree)):
        f = os.path.join(tree, d, 'index.html')
        if os.path.isfile(f) and d not in ('assets', 'css', 'js', 'lang', 'pages', 'print', 'tests', 'tools', 'docs', 'patches', 'review', 'deploy', 'node_modules') and not d.startswith('.'):
            with open(f, encoding='utf-8') as fh:
                raw = fh.read()
            if 'src="/js/moved.js"' in raw:
                out[d] = re.findall(r'data-t="(t[0-9a-f]{8})"', raw)
    return out


def relabel_moved_pages(items_by_lang, tree):
    """review_sheet.py only knows the pages of the top folder, so the words of the moved pages would read "Not found on a page". Say where they are."""
    where = collections.defaultdict(list)
    for folder, ids in moved_pages(tree).items():
        for i in ids:
            where[i].append(folder + '/')
    for items in items_by_lang.values():
        for k, it in items.items():
            if k in where and it.where.startswith('Not found on a page'):
                shown = where[k]
                it.where = '"This page has moved" page of an old web address: ' + ', '.join(shown[:3]) + (' and %d more' % (len(shown) - 3) if len(shown) > 3 else '')


def english_only_pages(tree):
    """Files the patch adds to the site (html pages outside lang/) with visible words and no data-t ids: they are English only. Returns the file names."""
    found = []
    for base, dirs, files in os.walk(tree):
        dirs[:] = [d for d in dirs if d not in ('tests', 'tools', 'docs', 'patches', 'assets', 'css', 'js', 'lang', 'review', 'print', 'pages')]
        for f in files:
            rel = os.path.relpath(os.path.join(base, f), tree).replace(os.sep, '/')
            if f.endswith('.html') and '/' in rel:
                with open(os.path.join(base, f), encoding='utf-8', errors='replace') as fh:
                    if 'data-t="' not in fh.read():   # a page whose words carry data-t ids is translated like any page
                        found.append(rel)
    return sorted(found)


def english_only_words(tree, pages):
    """[(page, the words a visitor sees on it: title and body text)] for the English-only pages."""
    out = []
    for rel in pages:
        with open(os.path.join(tree, *rel.split('/')), encoding='utf-8') as f:
            raw = f.read()
        title = re.search(r'<title>(.*?)</title>', raw, re.S)
        body = re.search(r'<body[^>]*>(.*?)</body>', raw, re.S)
        words = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', body.group(1) if body else ''))).strip()
        out.append((rel, '"%s" (title: %s)' % (words, re.sub(r'\s+', ' ', html.unescape(title.group(1))).strip() if title else '')))
    return out


def write_index(out_dir, infos, default_info):
    titles = question_titles()
    lines = ['Option reader sheets: which sheet to hand out for which owner answer', '',
             'Made by python3 tools/review_option_texts.py. A sheet exists only for an option that adds or changes words. Hand the sheet of the language to the friend who reads it;',
             'send the corrections to Claude (the words are inside the patch file until the option is applied).', '']
    for i in sorted(infos, key=lambda x: (x['answers'], x['option'])):
        total = sum(v['new'] + v['changed'] for v in i['texts'].values())
        answers = i['answers'] or '(no Answers: line)'
        names = '' if 'placeholder' in answers.lower() else ', '.join('%s %s' % (d, titles[d]) for d in dict.fromkeys(re.findall(r'\bd\d\d\b', answers)) if d in titles)
        lines.append('%s  [%s]%s' % (answers, i['option'], ('  ' + names) if names else ''))
        lines.append('    patch: %s ("%s")' % (i['file'], i['name']))
        if not i['applied']:
            lines.append('    COULD NOT BE TRIED: ' + '; '.join(i['problems']))
        elif total == 0:
            lines.append('    no new or changed words: nothing to hand out.')
        else:
            per = ', '.join('%s %d' % (c, i['texts'][c]['new'] + i['texts'][c]['changed']) for c in LANGS)
            lines.append('    words found: %s.  Hand out: %s' % (per, ', '.join(os.path.basename(s) + ' (' + s + ')' for s in i['sheets'])))
        if i['english_only']:
            lines.append('    BUT it adds %d page(s) outside the translation system, so their words are English only (see %s/english-only-pages.txt): e.g. %s' % (len(i['english_only']), i['option'], i['english_only_words'][0][1][:150]))
        lines.append('    the patch header says: ' + i['promise'])
        bad = {c: m for c, m in i['missing'].items() if m != (0, 0)}
        if bad:
            lines.append('    NOT TRANSLATED after the patch: ' + ', '.join('%s %s' % (c, ('%d page text(s) and %d script text(s)' % m) if m[0] >= 0 else 'could not be read') for c, m in bad.items()))
        if i['facts'] and (i['facts']['code'] != 0 or not re.search(r'\b0 difference', ' '.join(i['facts']['lines']))):
            lines.append('    FACTS CHECK (tools/i18n_facts.mjs) says: ' + ' | '.join(i['facts']['lines'][:3])[:300])
        for p in i['problems'] if i['applied'] else []:
            lines.append('    problem: ' + p)
        lines.append('')
    with open(os.path.join(out_dir, 'INDEX.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))
    with open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'default': default_info, 'options': sorted(infos, key=lambda x: x['option'])}, f, ensure_ascii=False, indent=1)
        f.write('\n')


def main(argv):
    only, extra, out_dir, jobs, listing = [], [], os.path.join(ROOT, 'review', 'options'), 2, False
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ('-h', '--help'):
            print(__doc__)
            return 0
        if a == '--list':
            listing = True
        elif a in ('--only', '--patch', '--out', '--jobs'):
            if i + 1 >= len(argv):
                print('%s needs a value after it. python3 tools/review_option_texts.py --help says more.' % a)
                return 2
            v = argv[i + 1]
            i += 1
            if a == '--only':
                only.append(v)
            elif a == '--patch':
                if not os.path.isfile(v):
                    print('There is no patch file %s.' % v)
                    return 2
                extra.append(v)
            elif a == '--out':
                out_dir = os.path.abspath(v)
            else:
                if not v.isdigit() or not 1 <= int(v) <= 8:
                    print('--jobs wants a number from 1 to 8.')
                    return 2
                jobs = int(v)
        else:
            print('Not understood: %s. python3 tools/review_option_texts.py --help says what it does.' % a)
            return 2
        i += 1
    opts = find_options(only, extra)
    if not opts:
        print('No patch found%s.' % (' that matches ' + ', '.join(only) if only else ' in patches/optional/'))
        return 2
    if listing:
        for o in opts:
            print('%-28s answers: %-40s strings: %s' % (o.id, o.answers[:40], o.promise[:110]))
        return 0
    if shutil.which('git') is None:
        print('This needs git (to apply a patch in a copy of the site).')
        return 2
    os.makedirs(out_dir, exist_ok=True)
    print('The site as it is now (the base the words are compared with) ...')
    default_items = load_items(ROOT)
    tmp = tempfile.mkdtemp(prefix='opt-texts-base-')
    try:
        base = os.path.join(tmp, 'site')
        make_copy(base)
        base_res = try_tree(base)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    default_info = dict(missing=base_res['missing'], facts=base_res['facts'], problems=base_res['problems'])
    infos = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
        futures = {pool.submit(one_patch, o, default_items, out_dir): o for o in opts}
        for fut in concurrent.futures.as_completed(futures):
            o = futures[fut]
            try:
                info = fut.result()
            except Exception as e:   # one patch must not stop the others
                info = dict(option=o.id, file=o.file, name=o.name, answers=o.answers, promise=o.promise, applied=False, problems=['stopped: %s' % e], missing={}, facts=None, texts={c: dict(new=0, changed=0) for c in LANGS}, sheets=[], not_translated={}, english_only=[], english_only_words=[])
            infos.append(info)
            total = sum(v['new'] + v['changed'] for v in info['texts'].values())
            print('%-28s %s' % (o.id, 'could not be tried: ' + '; '.join(info['problems'])[:160] if not info['applied'] else ('%d words found in 4 languages' % total if total else 'no new or changed words')))
    write_index(out_dir, infos, default_info)
    print('\nWritten: %s (INDEX.txt says which sheet goes with which owner answer)' % out_dir)
    return 1 if any(not i['applied'] for i in infos) else 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except BrokenPipeError:
        sys.exit(1)
