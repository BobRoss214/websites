#!/usr/bin/env python3
"""Turn the farm owner's answers (the export of the dashboard) into file changes, test them on a COPY of the site, and say what happened.
For whoever keeps the site (Claude or a helper), not for the farm owner. Stdlib only; Python 3.8 or newer; Node for the tests; git.

  python3 tools/apply_answers.py answers.json                  read the answers, try them on a temporary copy, write APPLY_REPORT.md and a patch
  python3 tools/apply_answers.py answers.json --plan           only say what each answer would do (no copy, no tests)
  python3 tools/apply_answers.py d16=A d49=A                   the answers can also be typed as dNN=LETTER
  python3 tools/apply_answers.py answers.json --values v.json  the owner's own values (a price, a link) for the answers that need them
  python3 tools/apply_answers.py answers.json --in-place --yes put the result into the site folder (only after every check passed)

Nothing is decided here. The tool only follows the steps of docs/DECISION_PLAYBOOK.md (tools/rehearse_answers.json) for the answer the owner chose.
With no answers it does nothing. It never changes the site folder unless you say --in-place --yes, and then only with a patch that passed every check.
What the answers file can look like (all of these work): the whole database export {"decisions": {"d01": {...}}}, {"d01": {...}} (the documents),
a list of documents with an "id", a folder with one d01.json per decision, or the short form {"d01": "B", "d02": "Say Custom quote instead"}.
Read docs/APPLY_ANSWERS.md for the details.
"""
import argparse
import copy
import datetime
import difflib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
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
SITE_DEFAULT = os.path.dirname(HERE)
RULES_NAME = 'apply_answers_rules.json'
ID_RE = re.compile(r'^d\d{2,3}$')
PORT_DEFAULT = 48195

# ------------------------------------------------------------------------------------------------------------------------ words for people
STATUS_WORDS = {
    'applied': 'Applied',
    'included': 'Applied (already part of another answer)',
    'nothing': 'Nothing to change',
    'owner': 'The owner still has to send something',
    'undecided': 'She has not decided yet',
    'helper': 'Needs a person who knows the code',
    'held': 'Held back',
    'refused': 'Refused (the answers contradict each other)',
    'failed': 'Failed',
    'norecipe': 'No steps written yet',
    'unclear': 'The answer is not clear',
}
UNDECIDED = re.compile(r"not sure|not decided|decide in|\bI will ask\b|\bask (?:my|someone)\b|I need to check|I want to see|check first", re.I)
OWES = re.compile(r"\bI will (?:send|say|explain|describe|give|tell|change)\b|\bSend me\b|\bA different\b|\bSomething else\b|\bUse a different\b|\bAnother\b|\bDifferent\b", re.I)


class Problem(Exception):
    """A plain-words problem with the input or the rules (not a bug)."""


# ------------------------------------------------------------------------------------------------------------------------ loading
def load_ra(site):
    """The rehearsal library of THIS site folder (the recipes follow it automatically)."""
    path = os.path.join(site, 'tools')
    if path not in sys.path:
        sys.path.insert(0, path)
    import importlib
    ra = importlib.import_module('rehearse_answers')
    if os.path.dirname(os.path.abspath(ra.__file__)) != os.path.abspath(path):          # a different copy was imported earlier (tests)
        sys.modules.pop('rehearse_answers', None)
        ra = importlib.import_module('rehearse_answers')
    ra.ROOT = site
    ra.HERE = path
    ra.RECIPES = os.path.join(path, 'rehearse_answers.json')
    return ra


MAX_FILE = 20 * 1024 * 1024
ODD = re.compile('[\x00-\x1f\x7f\u2028\u2029\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]')


def clean(s):
    """Words from the owner (or from whoever can write to the database) are shown and kept as plain text: control characters and the marks that
    change how a line is drawn (right-to-left, hidden spaces) become a ?, so nothing can change the terminal window or hide words in the report."""
    return ODD.sub('?', re.sub(r'[\r\n\t]+', ' ', s))


def load_json(path, what):
    try:
        if os.path.isfile(path) and os.path.getsize(path) > MAX_FILE:
            raise Problem('%s: %s is bigger than 20 MB, which is not an answers file' % (what, path))
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise Problem('%s: there is no file %s' % (what, path))
    except IsADirectoryError:
        raise Problem('%s: %s is a folder, not a file' % (what, path))
    except (ValueError, RecursionError, UnicodeError) as e:
        raise Problem('%s: %s is not valid JSON (%s)' % (what, path, str(e)[:100]))


def load_recipes(site):
    data = load_json(os.path.join(site, 'tools', 'rehearse_answers.json'), 'recipes')
    skipped = data.pop('_skipped', {})
    return data, skipped


def load_rules(site):
    return load_json(os.path.join(site, 'tools', RULES_NAME), 'rules')


def parse_playbook(site):
    """{id: {'title', 'urgency', 'options': {letter: label}}} from docs/DECISION_PLAYBOOK.md."""
    try:
        with open(os.path.join(site, 'docs', 'DECISION_PLAYBOOK.md'), encoding='utf-8') as f:
            text = f.read()
    except FileNotFoundError:
        raise Problem('there is no docs/DECISION_PLAYBOOK.md in %s' % site)
    start = text.find('## Topic 1.')
    end = text.find('## What this page does not cover')
    body = text[start:end if end > start else len(text)] if start >= 0 else text
    out = {}
    for m in re.finditer(r'^### (d\d\d\d?)\. (.*?)\n(.*?)(?=^### d\d\d\d?\. |^## |\Z)', body, re.S | re.M):
        u = re.search(r'^- Urgency: (\d)', m.group(3), re.M)
        out[m.group(1)] = {'title': m.group(2).strip(), 'urgency': int(u.group(1)) if u else None,
                           'options': dict((l, lab.strip()) for l, lab in re.findall(r'^\*\*([A-Z])\. (.*?)\*\*', m.group(3), re.M))}
    return out


# ------------------------------------------------------------------------------------------------------------------------ the adapter: any export -> answers
class Answer(object):
    def __init__(self, id, text, note='', doc=None, values=None, answered_at=''):
        self.id, self.text, self.note, self.doc, self.values, self.answered_at = id, text, note, doc or {}, values or {}, answered_at
        self.letter = None
        self.how = ''


def _as_id(s):
    s = str(s or '').strip()
    s = re.sub(r'^.*/', '', s)
    s = re.sub(r'\.json$', '', s, flags=re.I).lower()
    return s if ID_RE.match(s) else None


def _text(v):
    return v.strip() if isinstance(v, str) else ('' if v is None else str(v).strip())


def _words(v, n=600):
    """The owner's words, kept as plain text and not longer than n letters."""
    return clean(_text(v))[:n]


def _from_entry(id_, v, problems):
    """One decision: a document from the dashboard, or the short form (a string, or {"answer": ..., "note": ..., "values": {...}})."""
    if isinstance(v, str):
        return Answer(id_, _words(v))
    if isinstance(v, bool) or v is None or isinstance(v, (int, float)):
        problems.append('%s: the answer is not text, so it was left out' % id_)
        return None
    if isinstance(v, list):
        problems.append('%s: a list is not an answer, so it was left out' % id_)
        return None
    if not isinstance(v, dict):
        return None
    d = v
    for wrap in ('data', 'fields', 'doc', 'document', 'value'):          # the wrappers an export can add
        if isinstance(d.get(wrap), dict) and not ('answer' in d or 'status' in d):
            d = d[wrap]
            break
    ans = _words(d.get('answer'))
    status = _text(d.get('status')).lower()
    if not (status == 'answered' or ans):                                  # the dashboard counts it as answered the same way
        return None
    if not ans:
        problems.append('%s: marked answered but the answer is empty, so it was left out' % id_)
        return None
    vals = d.get('values') if isinstance(d.get('values'), dict) else {}
    return Answer(id_, ans, _words(d.get('note'), 300), d, vals, _words(d.get('answeredAt'), 40))


def read_answers(src, extra=()):
    """src: a path (a file or a folder), an already loaded object, or None. extra: ['d03=A', ...]. -> (answers, problems, open_count)"""
    problems, answers, seen_open = [], {}, [0]
    obj = None
    if isinstance(src, str):
        if os.path.isdir(src):
            obj = {}
            for n in sorted(os.listdir(src)):
                if n.lower().endswith('.json') and _as_id(n):
                    obj[_as_id(n)] = load_json(os.path.join(src, n), 'answers')
        else:
            obj = load_json(src, 'answers')
    elif src is not None:
        obj = src

    def add(id_, v):
        a = _from_entry(id_, v, problems)
        if a is None:
            if isinstance(v, dict):
                seen_open[0] += 1
            return
        if id_ in answers:
            problems.append('%s appears twice, the first one is used' % id_)
            return
        answers[id_] = a

    def walk(o, depth=0):
        if depth > 4:
            return
        if isinstance(o, dict):
            for k in ('decisions', 'answers', 'docs', 'documents', 'results', 'items', 'rows'):
                if k in o and isinstance(o[k], (dict, list)) and not _as_id(k):
                    walk(o[k], depth + 1)
                    return
            for k, v in o.items():
                m = re.match(r'^(d\d{2,3})\s*=\s*([A-Za-z])$', str(k))
                if m:                                                      # {"d03=A": true}
                    add(m.group(1).lower(), m.group(2))
                    continue
                id_ = _as_id(k)
                if id_:
                    add(id_, v)
                elif k not in ('meta', 'agents', 'events', 'questions', 'work', 'project', 'exportedAt', '_about', 'version'):
                    problems.append('"%s" in the answers file is not a decision id (like d01), so it was left out' % clean(str(k))[:40])
        elif isinstance(o, list):
            for el in o:
                if isinstance(el, str):
                    m = re.match(r'^\s*(d\d{2,3})\s*=\s*(.+?)\s*$', el)
                    if m:
                        add(m.group(1).lower(), m.group(2))
                    else:
                        problems.append('"%s" is not like d03=A, so it was left out' % clean(el)[:40])
                elif isinstance(el, dict):
                    id_ = _as_id(el.get('id') or el.get('doc_id') or el.get('docId') or el.get('_id') or el.get('name') or el.get('path') or el.get('ref'))
                    if id_:
                        add(id_, el)
                    else:
                        problems.append('an entry has no decision id (id, doc_id), so it was left out')
        else:
            problems.append('the answers file is not a list or a set of decisions')

    if obj is not None:
        walk(obj)
    for e in extra:
        m = re.match(r'^\s*(d\d{2,3})\s*=\s*(.+?)\s*$', e, re.I)
        if m:
            add(m.group(1).lower(), m.group(2))
        else:
            problems.append('"%s" is not like d03=A' % clean(e)[:40])
    return [answers[k] for k in sorted(answers)], problems, seen_open[0]


# ------------------------------------------------------------------------------------------------------------------------ the option the owner chose
def norm(s):
    s = _text(s).lower().replace('’', "'").replace('‘', "'")
    s = re.sub(r"[^a-z0-9' À-￿]+", ' ', s)
    s = s.replace("'", '')
    return re.sub(r'\s+', ' ', s).strip()


def score(a, b):
    if a == b:
        return 1.0
    r = difflib.SequenceMatcher(None, a, b).ratio()
    short, long_ = (a, b) if len(a) <= len(b) else (b, a)
    if len(short) >= 12 and short in long_:
        r = max(r, 0.9 * (len(short) / float(len(long_))) + 0.1)
    return r


def strip_brackets(s):
    return re.sub(r'\s*\([^)]*\)', '', _text(s)).strip()


def by_place(ans, labels):
    """The page's own list of options, when the export has it: the place of the chosen words in that list is the letter, but only when the two lists
    have the same length and nothing in the other options says they are in a different order. -> letter or None"""
    opts = ans.doc.get('options') if isinstance(ans.doc.get('options'), list) else None
    if not opts or len(opts) != len(labels):
        return None
    pos = [i for i, o in enumerate(opts) if norm(o) == norm(ans.text)]
    if len(pos) != 1:
        return None
    letters = sorted(labels)
    for j, o in enumerate(opts):
        if j == pos[0]:
            continue
        sc = sorted(((score(norm(strip_brackets(o)), norm(strip_brackets(labels[L]))), L) for L in letters), reverse=True)
        if sc[0][0] >= 0.82 and sc[0][1] != letters[j]:                    # another option clearly belongs to another place
            return None
    return letters[pos[0]]


def resolve_option(ans, labels, aliases):
    """Sets ans.letter and ans.how, or returns a plain sentence saying why not.  labels: {letter: playbook label}."""
    t = ans.text
    m = re.fullmatch(r'(?:option\s+)?([A-Za-z])[.):]?', t.strip(), re.I)
    if m:
        L = m.group(1).upper()
        if labels and L not in labels:
            return 'there is no option %s for this question (the playbook has %s)' % (L, ', '.join(sorted(labels)) or 'none')
        ans.letter, ans.how = L, 'letter'
        return None
    nt = norm(t)
    al = {norm(k): v for k, v in (aliases or {}).items()}
    if nt in al:
        if al[nt] is None:
            return 'the page offers "%s", which the playbook has no option for' % t[:100]
        ans.letter, ans.how = al[nt], 'same meaning (listed in the rules)'
        return None
    if not labels:
        return 'the playbook has no options for this question yet'
    scores = sorted(((score(nt, norm(lab)), L) for L, lab in labels.items()), reverse=True)
    best, second = scores[0], (scores[1] if len(scores) > 1 else (0.0, ''))
    if best[0] >= 0.999:
        ans.letter, ans.how = best[1], 'exact words'
        return None
    nb = norm(strip_brackets(t))                                              # the same words without the bracket
    sb = sorted(((score(nb, norm(strip_brackets(lab))), L) for L, lab in labels.items()), reverse=True)
    if sb[0][0] >= 0.999 and (len(sb) < 2 or sb[1][0] < 0.999):
        ans.letter, ans.how = sb[0][1], 'the same words without the bracket'
        return None
    if best[0] >= 0.82 and best[0] - second[0] >= 0.10:
        ans.letter, ans.how = best[1], 'close words (%d%% alike)' % int(round(best[0] * 100))
        return None
    L = by_place(ans, labels)
    if L:
        ans.letter, ans.how = L, 'its place in the list of the page'
        return None
    return 'the words "%s" do not match any option clearly enough (closest: %s, %d%% alike)' % (t[:100], '%s "%s"' % (best[1], labels[best[1]][:60]), int(round(best[0] * 100)))


# ------------------------------------------------------------------------------------------------------------------------ the owner's own values
TYPES = {
    'price': (r'^\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?$|^\$\d+(?:\.\d{2})?$', 'a price like $45 or $4.50'),
    'url': (r'^https://[A-Za-z0-9][A-Za-z0-9._~:/?#\[\]@!$&()*+,;=%-]{3,300}$', 'a web address that starts with https://'),
    'email': (r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$', 'an email address'),
    'number': (r'^-?\d{1,6}(?:\.\d{1,6})?$', 'a number'),
    'date': (r'^\d{4}-\d{2}-\d{2}$', 'a date written year-month-day, each part in digits (four for the year, two for the month, two for the day)'),
    'text': (r'^.{1,300}$', 'a few words'),
}
BAD_CHARS = re.compile(r'[<>"\'`\\\x00-\x1f\x7f]')


def check_value(defn, v):
    """-> (clean value, None) or (None, plain message)."""
    if not isinstance(v, (str, int, float)) or isinstance(v, bool):
        return None, '%s: send it as text' % defn['name']
    s = str(v).strip()
    if not s:
        return None, '%s is empty' % defn['name']
    if BAD_CHARS.search(s):
        return None, '%s has a quote, a backslash, a < or > or a hidden character; type the plain words (the helper can add those by hand)' % defn['name']
    pat, what = TYPES.get(defn.get('type', 'text'), TYPES['text'])
    if defn.get('strip_slash'):
        s = s.rstrip('/')
    if not re.match(pat, s):
        return None, '%s should be %s (it is "%s")' % (defn['name'], what, s[:60])
    if defn.get('match') and not re.match(defn['match'], s):
        return None, '%s should look like "%s" (it is "%s")' % (defn['name'], defn['invented'], s[:60])
    if defn.get('type') == 'date':
        try:
            datetime.date(*[int(x) for x in s.split('-')])
        except ValueError:
            return None, '%s is not a real date (%s)' % (defn['name'], s)
    return s, None


def f_to_c(v):
    return str(int(round((float(v) - 32) * 5.0 / 9.0)))


DERIVE = {'f_to_c': f_to_c}


def substitute(recipe, defs, values):
    """A copy of the recipe where each made-up value is replaced by the owner's. -> (recipe, missing asks, problems)"""
    missing, problems, repl = [], [], []
    clean = {}
    for d in defs:
        if d.get('type') == 'derived':
            continue
        if d['name'] not in values:
            missing.append(d['ask'])
            continue
        v, bad = check_value(d, values[d['name']])
        if bad:
            problems.append(bad)
        else:
            clean[d['name']] = v
    for d in defs:
        if d.get('type') == 'derived' and d.get('from') in clean:
            try:
                clean[d['name']] = DERIVE[d['fn']](clean[d['from']])
            except (ValueError, KeyError):
                problems.append('%s could not be worked out from %s' % (d['name'], d['from']))
    if missing or problems:
        return None, missing, problems
    new = copy.deepcopy(recipe)
    ph = [(d['invented'], clean[d['name']]) for d in defs if d['name'] in clean]
    ph.sort(key=lambda p: -len(p[0]))

    def sub_text(s, escape):
        for old, nw in ph:
            s = s.replace(old, html.escape(nw, quote=False) if escape else nw)
        return s

    def sub_any(o, escape):
        if isinstance(o, str):
            return sub_text(o, escape)
        if isinstance(o, dict):
            return dict((sub_text(k, escape) if isinstance(k, str) else k, sub_any(v, escape)) for k, v in o.items())
        if isinstance(o, list):
            return [sub_any(x, escape) for x in o]
        return o

    new['_values'] = dict(clean)                                                 # kept for apply_fact_change (never written to a file)
    for st in new.get('steps', []):
        esc = st.get('file', '').endswith('.html')
        for f in ('to', 'text', 'value', 'set'):
            if f in st:
                st[f] = sub_any(st[f], esc)
    if new.get('translations'):
        new['translations'] = sub_any(new['translations'], False)
    return new, [], []


# ------------------------------------------------------------------------------------------------------------------------ items: one per answer
class Item(object):
    def __init__(self, ans, key, title, urgency):
        self.ans, self.key, self.title, self.urgency = ans, key, title, urgency
        self.id = ans.id
        self.status = 'pending'
        self.say = ''
        self.kind = None            # 'recipe' or 'patch'
        self.recipe = None
        self.patches = []
        self.files = []
        self.tests = []
        self.notes = []
        self.strings = []
        self.label = ''

    @property
    def number(self):
        return int(self.id[1:])

    def waiting(self):
        return self.status in ('owner', 'undecided', 'helper', 'held', 'norecipe', 'unclear')


def patch_headers(path):
    h = {}
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            m = re.match(r'^([A-Za-z]+):\s*(.*)$', line.rstrip('\n'))
            if not m:
                if h and not line.strip():
                    break
                continue
            h[m.group(1).lower()] = m.group(2)
    return h


def skip_kind(reason, label):
    r = reason.lower()
    if UNDECIDED.search(label):
        return 'undecided'
    if r.startswith('no change'):
        return 'nothing'
    if 'optional patch' in r:
        return 'patch'
    if r.startswith('her own') or "farm's own photos" in r or r.startswith('her '):
        return 'owner'
    return 'helper'


def build_items(answers, site, recipes, skipped, rules, playbook, args, values_all):
    items = []
    inputs = rules.get('inputs', {})
    manual = rules.get('manual', {})
    asks = rules.get('asks', {})
    patches = rules.get('patches', {})
    ok_notes = set(args.ok_note or [])
    host = {'cloudflare': 'A', 'netlify': 'B', 'other': 'C'}.get((args.host or '').lower())
    resolved = {}
    for a in answers:
        pb = playbook.get(a.id)
        title = (pb or {}).get('title') or clean(_text(a.doc.get('title')))[:120] or a.id
        urg = a.doc.get('urgency') if isinstance(a.doc.get('urgency'), int) else (pb or {}).get('urgency')
        if urg not in (1, 2, 3):
            urg = 3 if urg is None else 3
        it = Item(a, None, title, urg)
        items.append(it)
        labels = (pb or {}).get('options') or {}
        if not labels:                                                  # a decision with recipes but no entry yet: the letters of the recipes
            letters = sorted(set(k.split('=')[1] for k in list(recipes) + list(skipped) if k.startswith(a.id + '=')))
            labels = dict((L, '') for L in letters)
        if not labels:
            it.status, it.say = 'norecipe', 'The playbook (docs/DECISION_PLAYBOOK.md) has no entry for %s yet, so there are no steps for it. Her answer, as she wrote it: "%s". A helper has to write the steps (a recipe in tools/rehearse_answers.json) first.' % (a.id, a.text[:200])
            continue
        why = resolve_option(a, dict((L, lab) for L, lab in labels.items() if lab) or labels, (rules.get('aliases') or {}).get(a.id))
        if why:
            it.status = 'unclear'
            opts = '; '.join('%s: %s' % (L, lab[:70]) for L, lab in sorted(labels.items()) if lab)
            it.say = 'This answer could not be matched to an option: %s. Nothing was applied. The playbook options are: %s. If you know what she meant, give the letter (for example %s=%s) and run again.' % (why, opts, a.id, sorted(labels)[0])
            continue
        doc_opts = a.doc.get('options') if isinstance(a.doc.get('options'), list) else None
        if doc_opts and not re.fullmatch(r'(?:option\s+)?[A-Za-z][.):]?', a.text.strip(), re.I):          # the page's own list, when the export has it: the position must agree
            pos = [i for i, o in enumerate(doc_opts) if norm(o) == norm(a.text)]
            if pos and len(doc_opts) == len(labels) and pos[0] != ord(a.letter) - 65:
                it.status = 'unclear'
                it.say = 'The page lists "%s" as option %d but the playbook says that wording is option %s. The page and the playbook disagree about the order, so nothing was applied. A helper has to check both.' % (a.text[:80], pos[0] + 1, a.letter)
                continue
        key = '%s=%s' % (a.id, a.letter)
        it.key = key
        it.label = labels.get(a.letter, '')
        resolved[a.id] = a.letter
        if a.note and a.id not in ok_notes:
            it.status = 'held'
            it.say = 'She added a note: "%s". Read it first, because it may change the answer. If it does not, run again with --ok-note %s. (A note is never put on the site by this tool.)' % (a.note[:300], a.id)
            continue
        if key in recipes:
            model = recipes[key].get('model') or manual.get(key)
            defs = recipes[key].get('owner_values') or inputs.get(key)
            if model:
                it.status, it.say = 'owner', 'The owner still has to send: %s. The steps in tools/rehearse_answers.json (%s) show which files change, but the words must be hers, so nothing was applied.' % (model, key)
                if a.note:
                    it.say += ' She wrote: "%s".' % a.note[:300]
                continue
            if not (defs or recipes[key].get('checked') is True or key in set((rules.get('ready') or {}).get('keys', []))):
                it.status = 'helper'
                it.say = 'The steps for %s are new (or changed) and nobody has checked yet that they type no value that only the owner knows. A helper has to read them and add the key to "ready" in tools/%s (or give the recipe "checked": true).' % (key, RULES_NAME)
                continue
            vals = dict(values_all.get(key, {}))
            vals.update(values_all.get(a.id, {}))
            vals.update(a.values or {})
            if defs:
                rec, missing, bad = substitute(recipes[key], defs, vals)
                if missing or bad:
                    it.status = 'owner'
                    parts = []
                    if missing:
                        parts.append('The owner still has to send: ' + '; '.join(missing) + '.')
                    if bad:
                        parts.append('The value given is not usable: ' + '; '.join(bad) + '.')
                    parts.append('Give the values with --values (see docs/APPLY_ANSWERS.md); nothing was applied.')
                    if a.note:
                        parts.append('She wrote: "%s".' % a.note[:300])
                    it.say = ' '.join(parts)
                    continue
                it.recipe = rec
            else:
                it.recipe = recipes[key]
            it.kind = 'recipe'
            it.status = 'ready'
        elif key in skipped or key in patches:
            kind = skip_kind(skipped.get(key, ''), it.label)
            if key in patches:
                kind = 'patch'
            if kind == 'patch':
                spec = patches.get(key)
                names = None
                if isinstance(spec, dict) and 'by_host' in spec:
                    h = host or resolved.get('d05')
                    if not h:
                        it.status = 'held'
                        it.say = 'Which patch to use depends on the host (the answer to d05). d05 is not answered yet. Answer d05 first, or say --host cloudflare, netlify or other.'
                        continue
                    names = spec['by_host'].get(h)
                elif isinstance(spec, list):
                    names = spec
                if not names and 'not in patches/optional' in skipped.get(key, ''):
                    it.status = 'helper'
                    it.say = 'The playbook names an optional patch for this answer, but the patch is not on disk (patches/optional/; see "Patches on disk" in the playbook). A helper has to find or remake it.'
                    continue
                if not names:
                    if OWES.search(it.label):
                        it.status = 'owner'
                        it.say = 'The owner still has to send: %s.' % asks.get(key, 'what she said she would send ("%s")' % it.label)
                    else:
                        it.status = 'helper'
                        it.say = 'The playbook names an optional patch for this answer, but the rules do not say which file to use. A helper has to add it to tools/apply_answers_rules.json.'
                    continue
                missing = [n for n in names if not os.path.isfile(os.path.join(site, 'patches', 'optional', n + '.patch'))]
                if missing:
                    it.status = 'helper'
                    it.say = 'The patch file patches/optional/%s.patch is not there. A helper has to find or remake it.' % missing[0]
                    continue
                it.kind, it.patches, it.status = 'patch', names, 'ready'
            elif kind == 'nothing':
                it.status = 'nothing'
                why = skipped.get(key, '').rstrip('.')
                it.say = 'Her answer needs no change to the site.' + ('' if why.startswith('no change: there is nothing to replay') or not why else ' (%s)' % why)
                if OWES.search(it.label) and not UNDECIDED.search(it.label):
                    it.status, it.say = 'owner', 'She said "%s": the owner still has to send something. %s' % (it.label, asks.get(key, 'Ask her what it is.'))
            elif kind == 'undecided':
                it.status = 'undecided'
                it.say = 'She has not decided ("%s"). Nothing changes now; ask her again later.' % (a.text[:120])
            elif kind == 'owner':
                it.status = 'owner'
                it.say = 'The owner still has to send: %s.' % asks.get(key, 'what she said she would send ("%s")' % it.label)
                if a.note:
                    it.say += ' She wrote: "%s".' % a.note[:300]
            else:
                it.status = 'helper'
                it.say = 'This answer needs a change in the code that only a person can make (%s). The playbook has no file steps to follow for it.' % skipped.get(key, 'no steps').rstrip('.')
                if OWES.search(it.label):
                    it.say += ' The owner also still has to send: %s.' % asks.get(key, 'what she said she would send')
        else:
            it.status = 'norecipe'
            it.say = 'The playbook has this option (%s) but there are no steps for it in tools/rehearse_answers.json yet, and no reason why not. A helper has to add a recipe.' % key
        if it.key in rules.get('notes', {}):
            it.notes.append(rules['notes'][it.key])
    return items


# ------------------------------------------------------------------------------------------------------------------------ order and conflicts
def order_items(items, rules):
    """Urgency first, then the number; 'after' rules and patches-before-recipes keep dependent answers in a safe order."""
    todo = [i for i in items if i.status == 'ready']
    todo.sort(key=lambda i: (0 if i.kind == 'patch' else 1, i.urgency, i.number))
    after = dict((k, v) for k, v in (rules.get('after') or {}).items() if not k.startswith('_'))
    ids = dict((i.id, i) for i in todo)
    done, out, guard = set(), [], 0
    pending = list(todo)
    while pending:
        guard += 1
        for it in pending:
            deps = [d for d in after.get(it.id, []) if d in ids and d != it.id and (ids[d].kind == it.kind or it.kind == 'recipe')]
            if all(d in done for d in deps):
                out.append(it)
                done.add(it.id)
                pending.remove(it)
                break
        else:
            names = ', '.join(i.id for i in pending)
            raise Problem('the order rules in %s go in a circle (%s); a helper has to fix them' % (RULES_NAME, names))
    return out


def _sig(recipe):
    s = set()
    for st in recipe.get('steps', []):
        if st['op'] in ('sub', 'sub_all'):
            s.add((st.get('file'), 'find', st['find']))
    return s


def find_conflicts(items, recipes, skipped, rules, site):
    """Marks contradictory answers 'refused' and answers that are part of a bigger one 'included'. Returns nothing."""
    live = dict((i.key, i) for i in items if i.status == 'ready')

    def has(k):
        return k in live and live[k].status == 'ready'

    for k, small in (rules.get('includes') or {}).items():
        if k.startswith('_'):
            continue
        if has(k):
            for s in small:
                if has(s):
                    live[s].status = 'included'
                    live[s].say = 'Its steps are already part of %s, so they are not done twice.' % k
    pairs = [(r['a'], r['b'], r['why'], 'refused') for r in rules.get('refuse', [])] + [(r['a'], r['b'], r['why'], 'refused') for r in rules.get('unsupported', [])]
    for a, b, why, st in pairs:
        if has(a) and has(b):
            for x, y in ((a, b), (b, a)):
                live[x].status = st
                live[x].say = '%s and %s do not go together: %s Nothing from either was applied. Ask her, or take one of them out of the answers.' % (a, b, why)
    # the optional patches that cannot be combined (the headers say so)
    pat_items = [i for i in items if i.status == 'ready' and i.kind == 'patch']
    by_name = {}
    for i in pat_items:
        for n in i.patches:
            by_name.setdefault(n, []).append(i)
    meta = {}
    for n in by_name:
        meta[n] = patch_headers(os.path.join(site, 'patches', 'optional', n + '.patch'))
    for n, its in by_name.items():
        conf = [c.strip() for c in re.split(r'[,;]', meta[n].get('conflicts', '')) if c.strip() and c.strip().lower() != 'none']
        for c in conf:
            other = [m for m in by_name if m.startswith(c)]
            for o in other:
                for x in its + by_name[o]:
                    if x.status == 'ready':
                        x.status = 'refused'
                        x.say = 'The patch %s cannot be combined with %s (the header of the patch says so), and both were chosen: %s. Nothing from either was applied. Ask her, or take one of them out.' % (n, o, ', '.join(sorted(set(y.key for y in its + by_name[o]))))
    # two answers that choose the same patch: apply it once
    seen = set()
    for i in order_items([x for x in items if x.status == 'ready' and x.kind == 'patch'], rules):
        i.patches = [n for n in i.patches if n not in seen]
        seen.update(i.patches)
        if not i.patches:
            i.status = 'included'
            i.say = 'The patch it needs is already applied for another answer.'
    # steps that look for the same words in the same file (the second one would not find them)
    rec = [i for i in items if i.status == 'ready' and i.kind == 'recipe']
    for n, a in enumerate(rec):
        for b in rec[n + 1:]:
            if a.id == b.id:
                continue
            common = _sig(a.recipe) & _sig(b.recipe)
            if common and a.status == 'ready' and b.status == 'ready':
                f, _, find = sorted(common)[0]
                for x in (a, b):
                    x.status = 'refused'
                    x.say = '%s and %s both change the words "%s" in %s, and the steps of one do not expect the change of the other. Nothing from either was applied. A helper has to merge them by hand.' % (a.key, b.key, find[:60], f)


# ------------------------------------------------------------------------------------------------------------------------ the working copy
def git(work, *a, **kw):
    p = subprocess.run(['git', '-c', 'user.name=apply-answers', '-c', 'user.email=apply-answers@example.invalid', '-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false'] + list(a),
                       cwd=work, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, encoding='utf-8', errors='replace')
    if kw.get('check', True) and p.returncode != 0:
        raise RuntimeError('git %s failed: %s' % (' '.join(a[:3]), p.stdout.strip()[-300:]))
    return p


def commit_all(work, msg):
    git(work, 'add', '-A', '--', '.', ':!**/__pycache__/**')
    p = git(work, 'diff', '--cached', '--quiet', check=False)
    if p.returncode == 0:
        return False
    git(work, 'commit', '-q', '-m', msg)
    return True


def head(work):
    return git(work, 'rev-parse', 'HEAD').stdout.strip()


def changed_files(work, a, b):
    out = git(work, 'diff', '--name-only', a, b).stdout
    return [l for l in out.split('\n') if l.strip()]


def rollback(work):
    git(work, 'reset', '-q', '--hard', 'HEAD')
    git(work, 'clean', '-fdq', '--', '.', ':!**/__pycache__/**', check=False)


class StepFail(Exception):
    pass


def apply_fact_change(ra, work, it, rules):
    """THE place for fact changes (a price, a phone number, an email, hours). When the site has tools/change_fact.py and the rules name this answer under
    "fact_change", the change is made by that tool (no second copy of its logic here) and True is returned. Otherwise False: the caller follows the steps of
    the recipe, which is what happens today. To switch an answer over, add it to "fact_change" in tools/apply_answers_rules.json, for example
    "d16=C": {"kind": "price", "args": ["$31", "{price}"]}  ->  python3 tools/change_fact.py price "$31" "$35" --yes   ({name} is the owner's checked value)."""
    spec = (rules.get('fact_change') or {}).get(it.key)
    script = os.path.join(work, 'tools', 'change_fact.py')
    if not spec or it.kind != 'recipe' or not os.path.isfile(script):
        return False
    vals = (it.recipe or {}).get('_values', {})
    try:
        args = [a.format(**vals) for a in spec['args']]
    except (KeyError, IndexError, ValueError):
        raise StepFail('the rules for %s name a value the owner has not given' % it.key)
    code, out = ra.run([ra.PY, script, spec['kind']] + args + ['--yes'], work)
    if code != 0:
        raise StepFail('tools/change_fact.py failed for %s: %s' % (it.key, (out.strip().split('\n') or [''])[-1][:200]))
    return True


def apply_item(ra, work, it, rules=None):
    if it.kind == 'patch':
        for n in it.patches:
            p = os.path.join(work, 'patches', 'optional', n + '.patch')
            c = git(work, 'apply', '--check', p, check=False)
            if c.returncode != 0:
                raise StepFail('the patch %s does not apply any more (git apply --check says: %s). Do not force it; a helper has to redo it.' % (n, c.stdout.strip().split('\n')[0][:200]))
            git(work, 'apply', p)
        return
    if rules and apply_fact_change(ra, work, it, rules):
        return
    for i, st in enumerate(it.recipe.get('steps', [])):
        try:
            ra.OPS[st['op']](work, st)
        except ra.StepError as e:
            raise StepFail('step %d of %s: %s' % (i + 1, it.key, e))
        except Exception as e:
            raise StepFail('step %d of %s (recipe): %s: %s' % (i + 1, it.key, type(e).__name__, e))


def build_site(ra, work, merged, res):
    """The standard steps of the playbook (pages, extract, jsstrings, missing, stand-ins, build). Records the new sentences."""
    rec = {'stand_ins': {}}
    orig = ra.add_stand_ins

    def spy(w, lang, items, own=None):
        rec['stand_ins'][lang] = [(k, key, en, (own or {}).get(en)) for k, key, en in items]
        return orig(w, lang, items, own)
    ra.add_stand_ins = spy
    try:
        ok = ra.standard_steps(work, merged, res)
    finally:
        ra.add_stand_ins = orig
    return ok, rec['stand_ins']


def merged_recipe(items):
    m = {'translations': {}, 'commands': [], 'browser': []}
    for it in items:
        if it.kind != 'recipe':
            continue
        for lang, d in (it.recipe.get('translations') or {}).items():
            m['translations'].setdefault(lang, {}).update(d)
        for c in it.recipe.get('commands', []):
            if c not in m['commands']:
                m['commands'].append(c)
        for b in it.recipe.get('browser', []):
            if b not in m['browser']:
                m['browser'].append(b)
    return m


def extra_tests(items):
    names = []
    for it in items:
        if it.kind == 'recipe':
            for t in it.recipe.get('tests', []):
                if t not in names:
                    names.append(t)
    return names


def bisect_culprit(ra, base, commits, applied, test_name, args):
    """commits[k] is the state after applied[k] (k = 0 .. n-1). Finds the first answer after which test_name is red. -> item or None"""
    lo, hi = -1, len(applied) - 1
    n = 0
    while hi - lo > 1:
        mid = (lo + hi) // 2
        n += 1
        trial = os.path.join(base, 'trial%d' % n)
        os.makedirs(trial)
        p = subprocess.run('git archive %s | tar -x -C %s' % (commits[mid], trial), shell=True, cwd=os.path.join(base, 'site'), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        res = {'problems': [], 'notes': [], 'steps': [], 'tests': [], 'strings': None}
        ok = ra.standard_steps(trial, {'translations': merged_recipe(applied[:mid + 1]).get('translations')}, res)
        red = True
        if ok:
            r = ra.run_test(trial, test_name)
            red = not r['ok'] and not (test_name == 'consistency' and ra.only_stand_ins(r.get('out', '')))
        shutil.rmtree(trial, ignore_errors=True)
        if red:
            hi = mid
        else:
            lo = mid
    return applied[hi] if hi >= 0 else None


HOSTS = {'A': 'cloudflare', 'B': 'netlify', 'C': 'github'}                       # the answer to d05; "another host" is tried as the host that reads neither _headers nor _redirects


def patch_ids(work, applied):
    """The Option: names (redirects-A, clean-addresses-C ...) in the headers of the patches that were applied."""
    ids = []
    for it in applied:
        for n in (it.patches if it.kind == 'patch' else []):
            ids.append(patch_headers(os.path.join(work, 'patches', 'optional', n + '.patch')).get('option', n))
    return ids


def host_for_run(items, args, ids):
    """Which host the answers choose: d05, or --host, or Cloudflare when the patch for Cloudflare was applied. None when nobody said."""
    if 'clean-addresses-C' in ids:
        return 'cloudflare'
    for it in items:
        if it.id == 'd05' and it.ans.letter in HOSTS:
            return HOSTS[it.ans.letter]
    return {'cloudflare': 'cloudflare', 'netlify': 'netlify', 'other': 'github'}.get((args.host or '').lower())


def host_launch_check(work, host, ids):
    """The check tools/option_matrix.py makes for a host: the upload folder, a pretend copy of the host, tools/launch_check.py against it. The plain launch-check test
    cannot do this for a site whose pages are named without .html (clean-addresses-C): its server has no Cloudflare address rules. We call the matrix's own method
    (no second copy of its logic). -> (ok or None, words)"""
    path = os.path.join(work, 'tools')
    if not os.path.isfile(os.path.join(path, 'option_matrix.py')) or not os.path.isfile(os.path.join(path, 'launch_check.py')):
        return None, 'tools/option_matrix.py or tools/launch_check.py is not in this site, so the host check was skipped'
    import importlib.util
    import types
    spec = importlib.util.spec_from_file_location('option_matrix_of_the_copy', os.path.join(path, 'option_matrix.py'))
    om = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(om)
        me = types.SimpleNamespace(py=sys.executable, a=types.SimpleNamespace(wrangler=''), log=lambda *a, **k: None)
        combo = types.SimpleNamespace(host=host, opts=[types.SimpleNamespace(id=i) for i in ids], name=host)
        good, why = om.Matrix.launch_check(me, combo, work)
        if good is False and host == 'cloudflare' and 'clean-addresses-C' not in ids and 'page-redirect' in why:
            why += ' (Cloudflare Pages redirects /x.html to /x: on this host the answer to d05 must be A, which brings the patch clean-addresses-C)'
        return good, why
    except Exception as e:                                                         # a failed host check must not hide the other results
        return False, 'the host check could not run: %s: %s' % (type(e).__name__, str(e)[:160])


def run_all(site, items, order, args, ra, recipes, rules=None):
    """Applies the ordered items to a copy and tests the result. -> dict with the facts for the report."""
    base = tempfile.mkdtemp(prefix='wa-apply-')
    work = os.path.join(base, 'site')
    out = {'base': base, 'work': work, 'applied': [], 'failed': [], 'tests': [], 'problems': [], 'stand_ins': {}, 'patch': None, 'green': False, 'followups': [], 'culprit': None}
    try:
        ra.copy_site(work)
        git(work, 'init', '-q')
        git(work, 'config', 'gc.auto', '0')
        commit_all(work, 'start')
        start = head(work)
        commits = []
        applied = []
        for it in order:
            before = head(work)
            try:
                apply_item(ra, work, it, rules)
            except StepFail as e:
                rollback(work)
                it.status, it.say = 'failed', 'It could not be applied: %s. Nothing from it was kept.' % e
                if applied:
                    it.say += ' This can happen when another answer changed the same place first (applied before it: %s).' % ', '.join(a.key for a in applied)
                out['failed'].append(it)
                continue
            commit_all(work, 'answer ' + it.key)
            it.files = changed_files(work, before, head(work))
            applied.append(it)
            commits.append(head(work))
        out['applied'] = applied
        if not applied:
            return out
        merged = merged_recipe(applied)
        res = {'key': 'bundle', 'problems': [], 'notes': [], 'steps': [], 'tests': [], 'strings': None}
        ra.PORT[0] = int(args.port)
        ra.FULL[0] = (args.gate != 'quick')
        if not ra.FULL[0]:                                                       # the playbook's own rule: validity when a page or style file was edited, launch-check when a recipe says so
            merged['steps'] = [st for it in applied if it.kind == 'recipe' for st in it.recipe.get('steps', [])]
            merged['steps'] += [{'file': f} for it in applied if it.kind == 'patch' for f in it.files]       # a patch that changes a page or a style file needs the validity test too
            if any(it.recipe.get('launch') for it in applied if it.kind == 'recipe') or any(it.kind == 'patch' for it in applied):
                merged['launch'] = True
        ra.SKIP_CHECKS[:] = [x for x in (args.skip or '').split(',') if x]
        ids = patch_ids(work, applied)
        host = host_for_run(items, args, ids)
        if 'clean-addresses-C' in ids and 'launch-check' not in ra.SKIP_CHECKS:      # replaced by the host check below
            ra.SKIP_CHECKS.append('launch-check')
            out['problems_note'] = 'The plain launch-check test was replaced by the Cloudflare host check: the pages are named without .html and the test server has no Cloudflare address rules.'
        if args.gate == 'none':                                                  # the steps only (for the tests of the tool itself)
            ok, stand = True, {}
        else:
            ok, stand = build_site(ra, work, merged, res)
        out['stand_ins'] = stand
        out['problems'] = list(res['problems'])
        if ok and args.gate not in ('none', 'rebuild'):
            ra.checks(work, merged, res, False, bool(args.browser))
            for name in extra_tests(applied):                                    # tests a recipe names in addition to the global ones
                if name not in ra.CHECKS and name not in ra.SKIP_CHECKS:
                    r = ra.run_test(work, name)
                    res['tests'].append(dict((k, v) for k, v in r.items() if k != 'out'))
            if host and (ids or any(i.id == 'd05' for i in items)) and 'launch-check' not in [x for x in (args.skip or '').split(',') if x]:
                t0 = time.time()
                good, why = host_launch_check(work, host, ids)
                if good is None:
                    res['tests'].append({'name': 'launch-check on a pretend %s' % host, 'ok': True, 'skip': True, 'note': why, 'detail': '', 'secs': round(time.time() - t0, 1)})
                else:
                    res['tests'].append({'name': 'launch-check on a pretend %s' % host, 'ok': bool(good), 'note': why if good else '', 'detail': '' if good else why, 'secs': round(time.time() - t0, 1)})
        out['tests'] = res['tests']
        bad = [t for t in res['tests'] if not t['ok'] and not t.get('followup')]
        out['followups'] = [t for t in res['tests'] if t.get('followup')]
        out['green'] = ok and not bad and not res['problems']
        out['docs_out'] = res.get('docs_out', '')
        if not out['green'] and not args.no_bisect and applied:
            name = (bad[0]['name'] if bad else None)
            if name and name in ra.CHECKS:
                try:
                    out['culprit'] = bisect_culprit(ra, base, commits, applied, name, args)
                except Exception as e:                                                  # a failed search must not hide the red result
                    out['problems'].append('looking for the answer that made %s red failed: %s' % (name, e))
        commit_all(work, 'rebuild')
        p = git(work, 'diff', '--binary', start, 'HEAD').stdout if False else subprocess.run(['git', 'diff', '--binary', start, 'HEAD'], cwd=work, stdout=subprocess.PIPE).stdout
        out['patch'] = p
        out['files'] = changed_files(work, start, 'HEAD')
        out['binary'] = [l.split('\t')[-1] for l in git(work, 'diff', '--name-status', start, 'HEAD').stdout.split('\n') if l[:1] in 'DM' and re.search(r'\.(?:webp|png|jpe?g|gif|ico|woff2?|svgz)$', l, re.I)]
        if args.keep:
            shutil.copytree(work, args.keep, dirs_exist_ok=True)
        return out
    finally:
        shutil.rmtree(base, ignore_errors=True)


# ------------------------------------------------------------------------------------------------------------------------ the report
def say_tests(tests):
    lines = []
    for t in tests:
        mark = 'passed' if t['ok'] else ('FOLLOW-UP (notes to fix)' if t.get('followup') else 'FAILED')
        extra = (' (%s)' % t['note']) if t.get('note') else ''
        lines.append('- %s: %s%s%s' % (t['name'], mark, extra, ('. First problem: ' + t['detail']) if t.get('detail') else ''))
    return lines


def write_report(path, site, args, answers, items, order, result, problems, open_count, planned_only):
    L = []
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    by = {}
    for it in items:
        by.setdefault(it.status, []).append(it)
    L.append('# Apply report, %s' % now)
    L.append('')
    L.append('Site folder: %s. This report is for whoever keeps the site.' % site)
    L.append('Answers read: %d (%d other decisions were still open and were ignored).' % (len(answers), open_count))
    if planned_only:
        L.append('This was only a plan: nothing was copied, changed or tested.')
    L.append('')
    verdict = []
    if result is not None:
        if result['failed']:
            verdict.append('%d answer(s) could not be applied' % len(result['failed']))
        if result['applied'] and not result['green']:
            verdict.append('the checks found a problem')
        elif result['applied'] and result['followups']:
            verdict.append('everything passed except the notes test (the notes still name things that changed)')
        elif result['applied']:
            verdict.append('everything that was applied passed every check')
        elif not result['failed']:
            verdict.append('nothing was applied')
    elif not planned_only:
        verdict.append('nothing to apply')
    L.append('Result: %s.' % ('; '.join(verdict) if verdict else 'see the plan below'))
    L.append('')
    waiting = [i for i in items if i.waiting()]
    if problems:
        L.append('## Problems with the answers file')
        L.extend('- ' + p for p in problems)
        L.append('')
    sec = [('applied', 'Applied' if not planned_only else 'Would be applied, in this order')]
    ready = order if planned_only else (result['applied'] if result else [])
    L.append('## %s' % sec[0][1])
    if not ready:
        L.append('Nothing.')
    for n, it in enumerate(ready, 1):
        L.append('')
        L.append('%d. **%s %s: %s** (answer: "%s")' % (n, it.id, it.title, it.label or it.key, it.ans.text[:120]))
        if it.kind == 'patch':
            L.append('   - Optional patch: %s' % ', '.join('patches/optional/%s.patch' % p for p in it.patches))
        if it.files:
            L.append('   - Files changed: %s' % ', '.join(it.files[:25]) + (' and %d more' % (len(it.files) - 25) if len(it.files) > 25 else ''))
        if it.recipe and it.recipe.get('what'):
            L.append('   - What: %s' % it.recipe['what'])
        for nt in it.notes:
            L.append('   - Note: %s' % nt)
    for it in by.get('included', []):
        L.append('')
        L.append('- **%s %s: %s**: %s' % (it.id, it.title, it.label or it.key, it.say))
    L.append('')
    if result and result['failed']:
        L.append('## Failed')
        for it in result['failed']:
            L.append('- **%s %s (%s)**: %s' % (it.id, it.title, it.key, it.say))
        L.append('')
    for st, head_ in (('refused', 'Refused: answers that contradict each other'), ('owner', 'The owner still has to send something'), ('undecided', 'She has not decided yet'),
                      ('held', 'Held back'), ('unclear', 'Not clear'), ('helper', 'Needs a person who knows the code'), ('norecipe', 'No steps written yet')):
        if by.get(st):
            L.append('## %s' % head_)
            for it in by[st]:
                L.append('- **%s %s%s**: %s' % (it.id, it.title, (' (' + it.key + ')') if it.key else '', it.say))
            L.append('')
    if by.get('nothing'):
        L.append('## Nothing to change')
        L.append('These answers leave the site as it is. They are decided; no file changes.')
        for it in by['nothing']:
            L.append('- %s %s: %s (%s)' % (it.id, it.title, it.label or it.ans.text[:80], it.key))
        L.append('')
    if result and result['applied']:
        L.append('## Tests (on the copy, after all the answers above)')
        if args.gate in ('none', 'rebuild'):
            L.append('NOT RUN: this was a run with --gate %s, which is only for trying the tool. Do not publish it.' % args.gate)
        L.extend(say_tests(result['tests']))
        if result.get('problems_note'):
            L.append('- Note: ' + result['problems_note'])
        if result['problems']:
            L.extend('- PROBLEM: ' + p for p in result['problems'])
        if result.get('culprit'):
            L.append('- The first red check turned red when %s was added (answers before it were fine).' % result['culprit'].key)
        L.append('')
        ui = sorted(set((k, key, en) for lang in result['stand_ins'] for (k, key, en, own) in result['stand_ins'][lang]))
        L.append('## New or changed sentences to translate')
        if not ui:
            L.append('None. Every sentence already had its translation.')
        else:
            L.append('%d sentence(s) are new or changed. Until a native reader (or the helper) writes them, es, hi, zh and vi show STAND-INS: the English words. Replace each one in lang/src/<language>.json, then run python3 tools/i18n.py build.' % len(ui))
            hand = {}
            for lang, lst in result['stand_ins'].items():
                for (k, key, en, own) in lst:
                    if own:
                        hand.setdefault(lang, []).append(en)
            for k, key, en in ui:
                L.append('- %s: %s' % ('JS text' if k == 'js' else 'id ' + key, en[:160]))
            L.append('Languages with a stand-in to replace: es, hi, zh, vi.')
            if hand:
                L.append('Translations that came with the playbook steps (still need a native read): %s.' % '; '.join('%s: %d' % (l, len(v)) for l, v in sorted(hand.items())))
        L.append('')
        if result['followups'] and result.get('docs_out'):
            L.append('## Notes to fix by hand (the notes test names these)')
            L.append('The notes (docs) name words, ids or README rows that the answers changed. Update them before you publish; the tool cannot write prose.')
            shown = 0
            for line in result['docs_out'].split('\n'):
                if line.startswith('FAIL'):
                    for piece in re.split(r';\s+(?=\S+\.(?:md|html|mjs|js|py|json):\d+ )', re.sub(r'^.*?\bchecked\s+', '', line)):
                        if re.match(r'^\S+\.(?:md|html|mjs|js|py|json):\d+ ', piece) and shown < 40:
                            L.append('- ' + piece.strip()[:230])
                            shown += 1
            if shown == 0:
                L.append('- run: node tests/docs.test.mjs (it lists them)')
            L.append('')
        L.append('## The patch')
        L.append('%s (%d files, the rebuilt pages and translation files included). Apply it to the site folder with: git apply %s   (or patch -p1 < %s).' % (args._patch_name, len(result.get('files', [])), args._patch_name, args._patch_name))
        if result.get('binary'):
            L.append('The patch removes or changes picture files (%s). Use git apply: the plain patch program cannot delete picture files.' % ', '.join(result['binary'][:8]))
        L.append('If the site changed since this copy was made and the patch no longer applies, do not merge the generated files (lang/*.js, the pages in the main folder) by hand: run this tool again on the new site folder.')
        L.append('')
    elif not planned_only:
        L.append('## The patch')
        L.append('There is no patch: nothing was applied.')
        L.append('')
    path_dir = os.path.dirname(path)
    os.makedirs(path_dir, exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L).rstrip() + '\n')


def print_summary(items, order, result, planned_only, out_dir):
    counts = {}
    for it in items:
        counts[it.status] = counts.get(it.status, 0) + 1
    names = []
    for st in ('ready', 'applied', 'included', 'nothing', 'owner', 'undecided', 'helper', 'held', 'unclear', 'refused', 'failed', 'norecipe'):
        if counts.get(st):
            names.append('%d %s' % (counts[st], {'ready': 'to apply' if planned_only else 'applied', 'applied': 'applied', 'included': 'already included', 'nothing': 'need no change',
                                                   'owner': 'wait for the owner', 'undecided': 'undecided', 'helper': 'need a person', 'held': 'held back', 'unclear': 'not clear',
                                                   'refused': 'refused', 'failed': 'failed', 'norecipe': 'have no steps yet'}[st]))
    print('Answers: %s.' % (', '.join(names) or 'none'))
    for it in items:
        if it.status in ('ready',) or (result and it in result['applied']):
            print('  %-4s %-7s %s' % (it.id, it.key, 'will be applied' if planned_only else 'applied'))
        else:
            print('  %-4s %-7s [%s] %s' % (it.id, it.key or '?', it.status, it.say[:700].replace('\n', ' ')))


# ------------------------------------------------------------------------------------------------------------------------ in place
def check_clean(site):
    """Refuses when the site folder is a git folder with changes that are not saved. -> the extra git apply arguments"""
    top = subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=site, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, encoding='utf-8', errors='replace')
    extra = []
    if top.returncode == 0:
        st = subprocess.run(['git', 'status', '--porcelain', '--', '.'], cwd=site, stdout=subprocess.PIPE, universal_newlines=True, encoding='utf-8', errors='replace').stdout.strip()
        if st:
            raise Problem('the site folder has changes that are not saved (git status is not clean). Save or undo them first, so the answers can be told apart:\n' + st[:400])
        rel = os.path.relpath(os.path.realpath(site), os.path.realpath(top.stdout.strip()))
        if rel != '.':
            extra = ['--directory=' + rel]
    return extra


def put_in_place(site, patch_path):
    extra = check_clean(site)
    pa = os.path.abspath(patch_path)
    c = subprocess.run(['git', 'apply', '--check'] + extra + [pa], cwd=site, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, encoding='utf-8', errors='replace')
    if c.returncode != 0:
        raise Problem('the patch does not apply to the site folder (the folder changed since the copy was made): ' + c.stdout.strip()[:300])
    a = subprocess.run(['git', 'apply'] + extra + [pa], cwd=site, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, encoding='utf-8', errors='replace')
    if a.returncode != 0:
        raise Problem('applying the patch failed half way: ' + a.stdout.strip()[:300])


# ------------------------------------------------------------------------------------------------------------------------ main
def main(argv=None):
    ap = argparse.ArgumentParser(description="Turn the owner's answers into file changes, test them on a copy, report.", formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog='Nothing is decided here. With no answers nothing happens. Read docs/APPLY_ANSWERS.md.')
    ap.add_argument('inputs', nargs='*', help='an answers file or folder, and/or answers like d03=A')
    ap.add_argument('--site', default=SITE_DEFAULT, help='the site folder (default: the one this tool is in)')
    ap.add_argument('--values', help='a JSON file with the owner\'s own values: {"d02": {"price_1": "$900", ...}}')
    ap.add_argument('--ok-note', action='append', help='apply this decision although the owner wrote a note (read the note first)')
    ap.add_argument('--host', help='cloudflare, netlify or other (when d05 is not answered)')
    ap.add_argument('--plan', action='store_true', help='only say what each answer would do')
    ap.add_argument('--out', help='where to write APPLY_REPORT.md and the patch (default: a new folder in the temporary folder)')
    ap.add_argument('--in-place', action='store_true', help='put the result into the site folder (needs --yes, and every check green)')
    ap.add_argument('--yes', action='store_true', help='yes, change the site folder')
    ap.add_argument('--allow-follow-ups', action='store_true', help='with --in-place: also when only the notes test (docs) is red')
    ap.add_argument('--gate', choices=['full', 'quick', 'rebuild', 'none'], default='full', help='full: every check (the default, the one to use before you publish). quick: the playbook\'s own rule (validity only if a page or style file changed, launch-check only if an answer says so). rebuild: only the standard steps, no checks. none: only the steps of the answers (these two are for trying the tool, not for publishing)')
    ap.add_argument('--skip', default='', help='checks to leave out, for example launch-check,validity (the slow ones)')
    ap.add_argument('--browser', action='store_true', help='also run the browser tests the answers name, one at a time')
    ap.add_argument('--port', default=PORT_DEFAULT, help='first port for browser tests (default %d)' % PORT_DEFAULT)
    ap.add_argument('--no-bisect', action='store_true', help='do not look for the answer that made a check red')
    ap.add_argument('--keep', help='keep the changed copy in this folder')
    a = ap.parse_args(argv)
    site = os.path.abspath(a.site)
    try:
        ra = load_ra(site)
        recipes, skipped = load_recipes(site)
        rules = load_rules(site)
        playbook = parse_playbook(site)
        src = [x for x in a.inputs if not re.match(r'^\s*d\d{2,3}\s*=', x)]
        extra = [x for x in a.inputs if re.match(r'^\s*d\d{2,3}\s*=', x)]
        if len(src) > 1:
            raise Problem('give one answers file (or folder); more than one was given: %s' % ', '.join(src))
        answers, problems, open_count = read_answers(src[0] if src else None, extra)
        values = load_json(a.values, 'values') if a.values else {}
        if not isinstance(values, dict):
            raise Problem('the values file must be a JSON object like {"d02": {"price_1": "$900"}}')
    except Problem as e:
        print('Problem: %s' % e)
        return 2
    for p in problems[:20]:
        print('Note: %s' % p)
    if len(problems) > 20:
        print('Note: and %d more like these' % (len(problems) - 20))
    if not answers:
        print('No answered decisions found (%d still open). Nothing to do, nothing was changed.' % open_count)
        return 0
    if a.in_place:
        if not a.yes:
            print('--in-place needs --yes as well. The site folder was not changed.')
            return 2
        try:
            check_clean(site)
        except Problem as e:
            print('The site folder was NOT changed: %s' % e)
            return 2
    out_dir = os.path.abspath(a.out) if a.out else os.path.join(tempfile.gettempdir(), 'wise-acres-apply-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    try:
        items = build_items(answers, site, recipes, skipped, rules, playbook, a, values)
        find_conflicts(items, recipes, skipped, rules, site)
        order = order_items(items, rules)
    except Problem as e:
        print('Problem: %s' % e)
        return 2
    a._patch_name = 'answers.patch'
    result = None
    code = 0
    if not a.plan and order:
        need = ['git'] + (['node'] if a.gate in ('full', 'quick') else [])
        gone = [n for n in need if not shutil.which(n)]
        if gone:
            print('Problem: %s is needed to try the answers on a copy and is not installed. Nothing was changed.' % ' and '.join(gone))
            return 2
        result = run_all(site, items, order, a, ra, recipes, rules)
        for it in order:
            if it in result['applied']:
                it.status = 'applied'
        if result['failed']:
            code = 1
        if result['applied'] and not result['green']:
            code = 1
    if any(i.status == 'refused' for i in items) and code == 0:
        code = 3
    os.makedirs(out_dir, exist_ok=True)
    patch_path = os.path.join(out_dir, a._patch_name)
    if result and result.get('patch') is not None and result['applied']:
        with open(patch_path, 'wb') as f:
            f.write(result['patch'])
    write_report(os.path.join(out_dir, 'APPLY_REPORT.md'), site, a, answers, items, order, result, problems, open_count, a.plan)
    print_summary(items, order, result, a.plan, out_dir)
    if result and result['applied']:
        for t in result['tests']:
            if not t['ok']:
                print('  %s %s: %s' % ('FOLLOW-UP' if t.get('followup') else 'RED', t['name'], t.get('detail', '')[:200]))
        for p in result['problems']:
            print('  PROBLEM: %s' % p)
        if result.get('culprit'):
            print('  The first red check turned red when %s was added.' % result['culprit'].key)
        if a.gate in ('none', 'rebuild'):
            print('Checks: not run (--gate %s). Do not publish this result.' % a.gate)
        else:
            print('Checks: %s.' % ('all green' if result['green'] and not result['followups'] else ('green except the notes test' if result['green'] else 'RED')))
    print('Report: %s' % os.path.join(out_dir, 'APPLY_REPORT.md'))
    if result and result['applied']:
        print('Patch:  %s' % patch_path)
    if a.in_place:
        if not result or not result['applied']:
            print('Nothing to put in the site folder.')
        elif code == 1 or not result['green']:
            print('The site folder was NOT changed: some answers failed or a check is red.')
            return 1
        elif result['followups'] and not a.allow_follow_ups:
            print('The site folder was NOT changed: the notes test (docs) is red. Fix the notes in the patch first, or use --allow-follow-ups.')
            return 4
        else:
            try:
                put_in_place(site, patch_path)
            except Problem as e:
                print('The site folder was NOT changed: %s' % e)
                return 2
            print('Done: the patch is applied to %s. Nothing was saved with git and nothing was uploaded.' % site)
    elif result and result['applied'] and code == 0:
        print('The site folder was not changed. To change it: python3 tools/apply_answers.py ... --in-place --yes   (or git apply %s)' % patch_path)
    if result and result['followups'] and code == 0:
        code = 4
    return code


if __name__ == '__main__':
    sys.exit(main())
