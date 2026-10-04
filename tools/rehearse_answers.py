#!/usr/bin/env python3
"""Rehearse the farm owner's answers: follow the steps of docs/DECISION_PLAYBOOK.md for one answer on a THROW-AWAY COPY of the site, run the
standard steps and the checks, and say what worked. Stdlib only; needs Python 3.8 or newer, and Node for the test checks.

  python3 tools/rehearse_answers.py --list                     the answers it can replay, with what each one changes
  python3 tools/rehearse_answers.py d03=A d17=B                replay these answers (each on its own fresh copy)
  python3 tools/rehearse_answers.py --all --jobs 3             every answer in tools/rehearse_answers.json
  python3 tools/rehearse_answers.py d18=A --browser            also run the browser test named in the answer (one at a time; needs Playwright)
  python3 tools/rehearse_answers.py d18=A --keep /tmp/x        keep the changed copy in /tmp/x to look at it
  python3 tools/rehearse_answers.py --quick d03=A              steps and rebuild only, no tests (a few seconds)
  python3 tools/rehearse_answers.py --json out.json --all      also write the full result as JSON

It never changes the site folder: every answer is copied to a temporary folder first (without .git, node_modules and deploy), changed there, and
the copy is deleted afterwards. Nothing is decided: the values it types as "her answer" (a price, a link, a date) are made up for the rehearsal.

What one replay does, in order
  1. The steps of the answer, written down in tools/rehearse_answers.json as the playbook words them: open a file, find the place named by words
     ("index.html at data-t=...", "from A to B"), change the text. A place that is not found, or found a different number of times than the
     playbook says, is a WRONG STEP.
  2. The standard steps ("The standard steps" in the playbook): python3 tools/pages.py, python3 tools/i18n.py extract, jsstrings, then
     "missing" for es, hi, zh and vi. The number of English sentences and JavaScript texts that need a translation is compared with the number the
     playbook gives ("Strings: ..."); a different number is a note. Then stand-in translations are added (the English words, standing in for the
     helper's real ones), i18n build, and "missing" must say 0 for every language.
  3. The checks: the notes test (docs), validity, consistency, files-audit, launch-check, plain-lint and public-site (no browser), and, with
     --browser, the browser tests named in the answer (live, dated, languages ...), one at a time, each on its own port (WA_REHEARSE_PORT, default 48167, plus one for each test run).
A check that fails is reported with its first failing line. A failure of the notes test (docs) is a FOLLOW-UP, not a wrong step: the notes name README rows, files and
ids (data-t="...") that an answer deletes or changes, so whoever applies the answer also updates those notes (the test lists them).

Recipe format (tools/rehearse_answers.json): {"d03=A": {"what": "...", "steps": [...], "strings": {"ui": 0, "js": 0}, "translations": {"zh": {"English": "words"}},
 "commands": ["python3 tools/test_pages.py"], "browser": ["languages"], "tests": [...]}}
Steps (each one is a dict with "op"):
  sub          file, at, find, to, [n=1 lines that hold "at"], [count=1 times "find" is in each such line, or "all"], [after=0 lines below]
                                                                                                                   change words inside the line(s)
  sub_all      file, find, to, n                                                                                  change words anywhere in the file (n times)
  delete_lines file, from, [to | count], [keep_to=false], [before=0]                                              delete the lines from the one holding "from" to the one holding "to" (or count lines)
  delete_line  file, at, [n=1]                                                                                   delete the line(s) holding "at"
  insert_after file, at, text | text_from{file,match}, [offset=0]                                               add the text (a line, or a line copied from a note) after the line holding "at"
  delete_block file, from, [tag=div]                                                                             delete a whole element from the line with its opening tag to the line that closes it
  json_edit    file, list, match, remove | set                                                                   change a list item of a JSON file (the saved map), as the Farm Map Marker does
  cut          file, at, start, end                                                                              delete the element (start ... end) around the place "at", inside a long line
  delete_file  file                                                                                              delete a file (a photo)
  readme_row   name                                                                                              delete the README table row that starts with name
  lang_value   lang, key, value, [section=ui|js]                                                                 set one translation by hand (instead of the stand-in)
  run          cmd                                                                                               a command from the playbook, for example python3 tools/make_qr.py
"""
import argparse
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time

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
RECIPES = os.path.join(HERE, 'rehearse_answers.json')
PY = os.environ.get('WA_PYTHON') or sys.executable or 'python3'
LANGS = ['es', 'hi', 'zh', 'vi']
FAST = ['docs', 'consistency', 'files-audit', 'plain-lint', 'public-site']                                       # no browser, a few seconds each
SLOW = ['validity', 'launch-check']                                                                           # no browser, 10 and 40 seconds
CHECKS = FAST + SLOW
BROWSER_LOCK = threading.Lock()                                                                                # one browser at a time
PORT = [int(os.environ.get('WA_REHEARSE_PORT') or 48167)]


class StepError(Exception):
    pass


def run(cmd, cwd, env=None, timeout=600):
    p = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, encoding='utf-8', errors='replace',
                       env=env, timeout=timeout)
    return p.returncode, p.stdout


def py(args):
    return '%s %s' % (PY, args)


# ------------------------------------------------------------------------------------------------------------------------ the steps


def rd(work, f):
    with open(os.path.join(work, f), encoding='utf-8') as h:
        return h.read()


def wr(work, f, text):
    with open(os.path.join(work, f), 'w', encoding='utf-8', newline='\n') as h:
        h.write(text)


def nth_replace(line, find, to, count, where):
    c = line.count(find)
    if c == 0:
        raise StepError('%s: "%s" is not in the line' % (where, find[:60]))
    if count != 'all' and c != count:
        raise StepError('%s: "%s" is in the line %d times, the step says %d' % (where, find[:60], c, count))
    return line.replace(find, to)


def op_sub(work, s):
    lines = rd(work, s['file']).split('\n')
    at, n = s['at'], s.get('n', 1)
    hits = [i for i, l in enumerate(lines) if at in l]
    if len(hits) != n:
        raise StepError('%s at "%s": found on %d line(s), the playbook says %d' % (s['file'], at[:50], len(hits), n))
    for i in hits:
        j = i + s.get('after', 0)                                          # after: the words to change are this many lines below the place
        lines[j] = nth_replace(lines[j], s['find'], s['to'], s.get('count', 1), '%s at "%s"' % (s['file'], at[:40]))
    wr(work, s['file'], '\n'.join(lines))


def op_sub_all(work, s):
    t = rd(work, s['file'])
    c = t.count(s['find'])
    if c != s.get('n', 1):
        raise StepError('%s: "%s" is in the file %d times, the playbook says %d' % (s['file'], s['find'][:50], c, s.get('n', 1)))
    wr(work, s['file'], t.replace(s['find'], s['to']))


def op_delete_lines(work, s):
    lines = rd(work, s['file']).split('\n')
    a = [i for i, l in enumerate(lines) if s['from'] in l]
    if len(a) != 1:
        raise StepError('%s from "%s": found on %d line(s)' % (s['file'], s['from'][:50], len(a)))
    b = [i for i, l in enumerate(lines) if s.get('to', '') in l and i >= a[0]] if 'to' in s else [a[0]]
    if not b:
        raise StepError('%s to "%s": not found after the start' % (s['file'], s['to'][:50]))
    end = b[0] - (1 if s.get('keep_to') else 0)
    start = a[0] - s.get('before', 0)                                       # before: start this many lines above the one that holds "from"
    if s.get('count'):
        end = start + s['count'] - 1
    wr(work, s['file'], '\n'.join(lines[:start] + lines[end + 1:]))


def op_delete_line(work, s):
    lines = rd(work, s['file']).split('\n')
    hits = [i for i, l in enumerate(lines) if s['at'] in l]
    if len(hits) != s.get('n', 1):
        raise StepError('%s at "%s": found on %d line(s), the playbook says %d' % (s['file'], s['at'][:50], len(hits), s.get('n', 1)))
    wr(work, s['file'], '\n'.join(l for i, l in enumerate(lines) if i not in hits))


def op_insert_after(work, s):
    lines = rd(work, s['file']).split('\n')
    hits = [i for i, l in enumerate(lines) if s['at'] in l]
    if len(hits) != 1:
        raise StepError('%s at "%s": found on %d line(s)' % (s['file'], s['at'][:50], len(hits)))
    text = s.get('text')
    if text is None:                                                       # the text is copied from a note, as the owner would copy it
        src = [l for l in rd(work, s['text_from']['file']).split('\n') if re.search(s['text_from']['match'], l)]
        if len(src) != 1:
            raise StepError('%s: %d lines match "%s"' % (s['text_from']['file'], len(src), s['text_from']['match']))
        text = src[0]
    at = hits[0] + 1 + s.get('offset', 0)                                    # offset: how many more lines to pass before adding the text
    lines[at:at] = text.split('\n')
    wr(work, s['file'], '\n'.join(lines))


def op_cut(work, s):
    """Delete one element that sits in the middle of a long line: from the nearest "start" before the place "at" to the next "end" after it."""
    text = rd(work, s['file'])
    if text.count(s['at']) != 1:
        raise StepError('%s at "%s": found %d times, the playbook says once' % (s['file'], s['at'][:50], text.count(s['at'])))
    i = text.index(s['at'])
    a = text.rfind(s['start'], 0, i)
    b = text.find(s['end'], i)
    if a < 0 or b < 0:
        raise StepError('%s at "%s": no %s ... %s around it' % (s['file'], s['at'][:40], s['start'], s['end']))
    wr(work, s['file'], text[:a] + text[b + len(s['end']):])


def op_delete_file(work, s):
    p = os.path.join(work, s['file'])
    if not os.path.isfile(p):
        raise StepError('%s: there is no such file' % s['file'])
    os.remove(p)


def op_delete_block(work, s):
    """Delete an element that runs over several lines: from the line holding "from" (the line with its opening tag) to the line that closes it."""
    tag = s.get('tag', 'div')
    lines = rd(work, s['file']).split('\n')
    a = [i for i, l in enumerate(lines) if s['from'] in l]
    if len(a) != 1:
        raise StepError('%s from "%s": found on %d line(s)' % (s['file'], s['from'][:50], len(a)))
    depth, end = 0, None
    for i in range(a[0], len(lines)):
        depth += len(re.findall(r'<%s[\s>]' % tag, lines[i])) - len(re.findall(r'</%s>' % tag, lines[i]))
        if depth <= 0:
            end = i
            break
    if end is None:
        raise StepError('%s from "%s": the <%s> is never closed' % (s['file'], s['from'][:40], tag))
    wr(work, s['file'], '\n'.join(lines[:a[0]] + lines[end + 1:]))


def op_json_edit(work, s):
    """The same change the Farm Map Marker makes: remove ("remove": true) or change ("set": {...}) the one item of a list whose fields match."""
    f = s['file']
    data = json.loads(rd(work, f))
    items = data[s['list']]
    hits = [it for it in items if all(it.get(k) == v for k, v in s['match'].items())]
    if len(hits) != 1:
        raise StepError('%s: %d items match %s' % (f, len(hits), s['match']))
    if s.get('remove'):
        items.remove(hits[0])
    else:
        hits[0].update(s['set'])
    wr(work, f, json.dumps(data, indent=1, sort_keys=True) + '\n')


def op_readme_row(work, s):
    lines = rd(work, 'README.md').split('\n')
    hits = [i for i, l in enumerate(lines) if l.startswith('|') and l[1:].split('|')[0].replace('**', '').strip().startswith(s['name'])]
    if len(hits) != 1:
        raise StepError('README row "%s": %d rows start with these words' % (s['name'], len(hits)))
    del lines[hits[0]]
    wr(work, 'README.md', '\n'.join(lines))


def op_lang_value(work, s):
    f = 'lang/src/%s.json' % s['lang']
    data = json.loads(rd(work, f))
    data.setdefault(s.get('section', 'ui'), {})[s['key']] = s['value']
    wr(work, f, json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + '\n')


def op_run(work, s):
    code, out = run(s['cmd'].replace('python3 ', PY + ' ', 1) if s['cmd'].startswith('python3 ') else s['cmd'], work)
    if code != 0:
        raise StepError('%s: exit %d: %s' % (s['cmd'], code, out.strip().split('\n')[-1][:160]))


OPS = {'delete_block': op_delete_block, 'json_edit': op_json_edit, 'cut': op_cut, 'delete_file': op_delete_file, 'sub': op_sub, 'sub_all': op_sub_all, 'delete_lines': op_delete_lines, 'delete_line': op_delete_line, 'insert_after': op_insert_after,
       'readme_row': op_readme_row, 'lang_value': op_lang_value, 'run': op_run}


# ------------------------------------------------------------------------------------------------------------------------ the standard steps


def missing(work, lang):
    """(ui count, js count, [(kind, id or text, english)]) from  i18n.py missing <lang> --list"""
    code, out = run(py('tools/i18n.py missing %s --list' % lang), work)
    m = re.search(r'(\d+) missing, .*JavaScript: (\d+) missing', out)
    items = []
    for line in out.split('\n'):
        a = re.match(r'^(js) \| (.*?)(?:\s{2,}\(from .*)?$', line)
        b = re.match(r'^([A-Za-z]\w{4,12}) \| (.*)$', line)
        if a:
            items.append(('js', a.group(2), a.group(2)))
        elif b:
            items.append(('ui', b.group(1), b.group(2)))
    return (int(m.group(1)), int(m.group(2)), items) if m else (None, None, items)


def add_stand_ins(work, lang, items, own=None):
    f = 'lang/src/%s.json' % lang
    data = json.loads(rd(work, f))
    for kind, key, english in items:
        data.setdefault(kind, {}).setdefault(key, (own or {}).get(english, english))   # the helper's own words where the recipe has them
    wr(work, f, json.dumps(data, ensure_ascii=False, indent=1) + '\n')


def standard_steps(work, recipe, res):
    for cmd in ('tools/pages.py', 'tools/i18n.py extract', 'tools/i18n.py jsstrings'):
        code, out = run(py(cmd), work)
        if code != 0:
            res['problems'].append('%s failed: %s' % (cmd, out.strip().split('\n')[-1][:200]))
            return False
    need = {}
    for lang in LANGS:
        ui, js, items = missing(work, lang)
        need[lang] = (ui, js, items)
    ui, js = need['es'][0], need['es'][1]
    res['strings'] = {'ui': ui, 'js': js}
    want = recipe.get('strings')
    if want is not None and (want.get('ui') != ui or want.get('js') != js):
        res['notes'].append('the playbook says "Strings: %s UI + %s JS", the rebuild found %s UI + %s JS needing a translation' %
                            (want.get('ui'), want.get('js'), ui, js))
    for lang in LANGS:
        add_stand_ins(work, lang, need[lang][2], (recipe.get('translations') or {}).get(lang))
    code, out = run(py('tools/i18n.py build'), work)
    if code != 0:
        res['problems'].append('i18n build failed: %s' % out.strip().split('\n')[-1][:200])
        return False
    for lang in LANGS:
        ui2, js2, _ = missing(work, lang)
        if ui2 != 0 or js2 != 0:
            res['problems'].append('missing %s is %s UI + %s JS after the translations were added' % (lang, ui2, js2))
    return True


# ------------------------------------------------------------------------------------------------------------------------ the checks


def first_fail(out):
    for line in out.split('\n'):
        if line.startswith('FAIL') or '  FAIL' in line[:12]:
            return line.strip()[:260]
    return out.strip().split('\n')[-1][:260] if out.strip() else '(no output)'


def run_test(work, name, browser=False, port=None):
    env = dict(os.environ)
    if port:
        env['WA_PORT'] = str(port)
    t0 = time.time()
    try:
        code, out = run('node tests/%s.test.mjs' % name, work, env=env, timeout=900)
    except subprocess.TimeoutExpired:
        return {'name': name, 'ok': False, 'detail': 'timed out', 'secs': 900}
    skipped = 'SKIP' in out[:400] and code == 0
    return {'name': name, 'ok': code == 0, 'skip': skipped, 'detail': '' if code == 0 else first_fail(out), 'secs': round(time.time() - t0, 1), 'out': out}


ITEM = re.compile(r'(?:js )?"([^"]{10,})[^"]*" \u2192 "([^"]{10,})')


def only_stand_ins(out):
    """True when every failure of the consistency test is a "translated texts carry the English numbers" line whose flagged translations are the
    stand-ins (the English words themselves, which cannot carry a weekday or a month in another language), and nothing else failed."""
    fails = [l for l in out.split('\n') if l.startswith('FAIL')]
    if not fails:
        return False
    for line in fails:
        if 'translated texts carry the English numbers' not in line:
            return False
        items = ITEM.findall(line)
        if not items or any(a[:60] != b[:60] for a, b in items):
            return False
    return True


FOLLOW_UP = re.compile(r'README row')


SKIP_CHECKS = []
FULL = [False]


def checks(work, recipe, res, quick, browser):
    if 'tests' in recipe:
        names = recipe['tests']
    elif FULL[0]:
        names = CHECKS
    else:                                                                  # validity when a page or style file was edited, launch-check when the recipe says so
        edited = any(s.get('file', '').endswith(('.html', '.css')) for s in recipe.get('steps', []))
        names = FAST + (['validity'] if edited else []) + (['launch-check'] if recipe.get('launch') else [])
    names = [n for n in names if n not in SKIP_CHECKS] if not quick else []
    for name in names:
        r = run_test(work, name)
        if not r['ok'] and name == 'docs':                                 # the notes name rows, paths and ids that the answer changed: a follow-up for whoever keeps the notes
            r['followup'] = True
        if not r['ok'] and name == 'consistency' and only_stand_ins(r['out']):
            r.update(ok=True, note='only the stand-in translations (the English words) are flagged: the helper writes the real ones with the same facts', detail='')
        res['tests'].append({k: v for k, v in r.items() if k != 'out'})
        if not r['ok'] and name == 'docs':
            res['docs_out'] = r['out']
    for extra in ([] if quick else recipe.get('commands', [])):               # other checks the playbook names, for example python3 tools/test_pages.py
        t0 = time.time()
        code, out = run(extra.replace('python3 ', PY + ' ', 1) if extra.startswith('python3 ') else extra, work)
        res['tests'].append({'name': extra, 'ok': code == 0, 'detail': '' if code == 0 else out.strip().split('\n')[-1][:260], 'secs': round(time.time() - t0, 1)})
    if browser:
        for name in recipe.get('browser', []):
            with BROWSER_LOCK:
                PORT[0] += 1
                r = run_test(work, name, True, PORT[0])
            res['tests'].append({k: v for k, v in r.items() if k != 'out'})


# ------------------------------------------------------------------------------------------------------------------------ one answer


def copy_site(dst):
    shutil.copytree(ROOT, dst, ignore=shutil.ignore_patterns('.git', 'node_modules', 'deploy', '__pycache__', '*.pyc'))


def replay(key, recipe, quick=False, browser=False, keep=None, steps_only=False):
    res = {'key': key, 'what': recipe.get('what', ''), 'steps': [], 'problems': [], 'notes': [], 'tests': [], 'strings': None}
    base = tempfile.mkdtemp(prefix='wa-rehearse-')
    work = os.path.join(base, 'site')
    try:
        copy_site(work)
        for i, step in enumerate(recipe.get('steps', [])):
            try:
                OPS[step['op']](work, step)
                res['steps'].append((True, step.get('say') or step['op']))
            except StepError as e:
                res['steps'].append((False, str(e)))
                res['problems'].append('step %d: %s' % (i + 1, e))
            except Exception as e:                                         # a mistake in the recipe itself
                res['steps'].append((False, '%s: %s' % (type(e).__name__, e)))
                res['problems'].append('step %d (recipe): %s' % (i + 1, e))
        if any(not ok for ok, _ in res['steps']):
            res['skipped_checks'] = 'a step failed: the checks were not run'
        elif steps_only:
            pass
        elif recipe.get('steps'):                                          # an answer with no step changes nothing: nothing to check
            if standard_steps(work, recipe, res):
                checks(work, recipe, res, quick, browser)
    finally:
        if keep:
            shutil.copytree(work, os.path.join(keep, key.replace('=', '-')), dirs_exist_ok=True) if os.path.isdir(work) else None
        shutil.rmtree(base, ignore_errors=True)
    return res


def coverage(recipes, skipped):
    """Every answer (dNN=X) of docs/DECISION_PLAYBOOK.md is either replayed or has a reason not to be; nothing is both; nothing names an answer that is not there."""
    with open(os.path.join(ROOT, 'docs', 'DECISION_PLAYBOOK.md'), encoding='utf-8') as f:
        text = f.read()
    body = text[text.index('## Topic 1.'):text.index('## What this page does not cover')]
    have = set()
    for m in re.finditer(r'^### (d\d\d)\. .*?(?=^### d\d\d\. |^## |\Z)', body, re.S | re.M):
        have.update('%s=%s' % (m.group(1), o) for o in re.findall(r'^\*\*([A-Z])\. ', m.group(0), re.M))
    both = sorted(set(recipes) & set(skipped))
    missing_ = sorted(have - set(recipes) - set(skipped))
    extra = sorted((set(recipes) | set(skipped)) - have)
    print('%d answers in the playbook: %d replayed, %d not replayed (with a reason).' % (len(have), len(set(recipes) & have), len(set(skipped) & have)))
    for label, items in (('in neither list (add a replay or a reason)', missing_), ('in both lists', both), ('not an answer of the playbook (renamed or removed?)', extra)):
        if items:
            print('%s: %s' % (label, ', '.join(items)))
    return 1 if (missing_ or both or extra) else 0


def verdict(res):
    bad = [t for t in res['tests'] if not t['ok'] and not t.get('followup')]
    follow = [t for t in res['tests'] if t.get('followup')]
    if res['problems'] or bad:
        return 'FAIL'
    return 'follow-up' if follow else ('pass' if res['steps'] or res['tests'] else 'no change')


def show(res):
    ok = sum(1 for o, _ in res['steps'] if o)
    print('%-8s %-9s steps %d/%d%s' % (res['key'], verdict(res), ok, len(res['steps']), ('  strings %s' % res['strings']) if res['strings'] else ''))
    for o, msg in res['steps']:
        if not o:
            print('           WRONG STEP: ' + msg)
    for p in res['problems']:
        if not p.startswith('step '):
            print('           PROBLEM: ' + p)
    for n in res['notes']:
        print('           note: ' + n)
    for t in res['tests']:
        if not t['ok']:
            print('           %s %s: %s' % ('FOLLOW-UP' if t.get('followup') else 'CHECK FAILED', t['name'], t['detail']))
    if res.get('skipped_checks'):
        print('           ' + res['skipped_checks'])


def main():
    ap = argparse.ArgumentParser(description="Rehearse the owner's answers on throw-away copies of the site.")
    ap.add_argument('answers', nargs='*', help='dNN=X (for example d03=A); several allowed')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--skipped', action='store_true', help='with --list: also the answers that are not replayed, and why')
    ap.add_argument('--coverage', action='store_true', help='check that every answer of the playbook is replayed or has a reason not to be')
    ap.add_argument('--steps-only', action='store_true', help='only check that every step still finds its place (about a second each, no rebuild, no tests)')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--quick', action='store_true', help='steps and rebuild only, no tests')
    ap.add_argument('--browser', action='store_true', help='also run the browser tests named in each answer, one at a time')
    ap.add_argument('--jobs', type=int, default=1)
    ap.add_argument('--full', action='store_true', help='run every no-browser check for every answer (validity and launch-check too: about a minute more each)')
    ap.add_argument('--skip', default='', help='checks to leave out, for example --skip launch-check,validity (they are the slow ones)')
    ap.add_argument('--keep', help='keep each changed copy under this folder')
    ap.add_argument('--json', help='write the results to this file')
    a = ap.parse_args()
    with open(RECIPES, encoding='utf-8') as f:
        recipes = json.load(f)
    skipped = recipes.pop('_skipped', {})                                   # the answers that are not replayed, with the reason
    if a.coverage:
        return coverage(recipes, skipped)
    if a.list:
        for k in sorted(recipes):
            print('%-8s %s' % (k, recipes[k].get('what', '')))
        if a.skipped:
            print('\nNot replayed:')
            for k in sorted(skipped):
                print('%-8s %s' % (k, skipped[k]))
        return 0
    FULL[0] = a.full
    SKIP_CHECKS.extend([x for x in a.skip.split(',') if x])
    keys = sorted(recipes) if a.all else a.answers
    unknown = [k for k in keys if k not in recipes]
    if unknown or not keys:
        print('no recipe for: %s (see --list)' % (', '.join(unknown) or 'nothing asked'))
        return 2
    if a.keep:
        os.makedirs(a.keep, exist_ok=True)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, a.jobs)) as ex:
        futs = {ex.submit(replay, k, recipes[k], a.quick, a.browser, a.keep, a.steps_only): k for k in keys}
        for fut in concurrent.futures.as_completed(futs):
            res = fut.result()
            results.append(res)
            show(res)
            sys.stdout.flush()
    bad = [r for r in results if verdict(r) == 'FAIL']
    print('\n%d answer(s) replayed: %d pass, %d follow-up only, %d with something wrong.' % (
        len(results), sum(1 for r in results if verdict(r) in ('pass', 'no change')), sum(1 for r in results if verdict(r) == 'follow-up'), len(bad)))
    if a.json:
        with open(a.json, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(sorted(results, key=lambda r: r['key']), f, indent=1, ensure_ascii=False)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
