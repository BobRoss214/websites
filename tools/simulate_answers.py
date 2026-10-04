#!/usr/bin/env python3
"""Pretend the farm owner answered, and see what tools/apply_answers.py does. For whoever keeps the site, not for the farm owner.

  python3 tools/simulate_answers.py plan-all  --out DIR             what the tool says about EVERY option of EVERY decision (no copy, no tests)
  python3 tools/simulate_answers.py singles   --out DIR --jobs 3    every answer that has steps, one at a time, with every check; each result is compared
                                                                    with tools/rehearse_answers.py (the same steps, tried on their own) as the oracle
  python3 tools/simulate_answers.py bundle    --out DIR --size 20 --seed 1    a random bundle of answers, all at once, with every check
  python3 tools/simulate_answers.py contradict --out DIR            answers that contradict each other: the tool must refuse them
  python3 tools/simulate_answers.py willsend  --out DIR             answers that say "I will send ...": the tool must say what is still missing

The pretend answers are written the way the dashboard writes them ({"d01": {"status": "answered", "answer": "<the words of the option>", "answeredAt": ...}}).
With --decisions DIR (a folder with one d01.json per decision, as the dashboard keeps them) the words are the page's own; without it they are the playbook's.
The made-up values the recipes type (a price, a link) are given as "the owner's values", so a result can be compared with the oracle word for word.
Nothing here touches the site folder. Results go to --out: one folder per run (APPLY_REPORT.md, the patch, a one-line result), and RESULTS.md at the end.
"""
import argparse
import concurrent.futures
import datetime
import filecmp
import json
import os
import random
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
SITE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import apply_answers as aa                                                         # noqa: E402


def facts(site):
    recipes, skipped = aa.load_recipes(site)
    rules = aa.load_rules(site)
    playbook = aa.parse_playbook(site)
    return recipes, skipped, rules, playbook


def option_words(playbook, dash, id_, letter):
    """The words of the option: the dashboard's own when we have its documents, else the playbook's."""
    pb = playbook.get(id_) or {}
    labels = pb.get('options') or {}
    if dash and id_ in dash and isinstance(dash[id_].get('options'), list) and len(dash[id_]['options']) == len(labels):
        return dash[id_]['options'][ord(letter) - 65]
    return labels.get(letter, letter)


def made_up_values(rules, recipes, key):
    """The recipes' own made-up values, given back as the owner's values (so the result equals the oracle's)."""
    vals = {}
    for d in (recipes.get(key, {}).get('owner_values') or rules.get('inputs', {}).get(key) or []):
        if d.get('type') != 'derived':
            vals[d['name']] = d['invented']
    return vals


def make_doc(playbook, dash, id_, letter, when, values=None, note='', form='doc'):
    words = option_words(playbook, dash, id_, letter)
    if form == 'letter':
        return letter if not values else {'answer': letter, 'values': values}
    d = dict(dash.get(id_, {})) if dash else {}
    d.update({'status': 'answered', 'answer': words, 'answeredAt': when})
    if note:
        d['note'] = note
    if values:
        d['values'] = values
    return d


def write_answers(path, docs, shape):
    if shape == 'bundle':
        data = {'decisions': docs, 'meta': {'project': 'wise-acres'}, 'agents': {}, 'events': {}}
    elif shape == 'list':
        data = [dict(v if isinstance(v, dict) else {'answer': v}, id=k) for k, v in docs.items()]
    else:
        data = docs
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def tree_diff(a, b):
    """Names of the files that differ between two folders (the .git folder and python caches left out)."""
    out = []

    def walk(rel):
        da, db = os.path.join(a, rel), os.path.join(b, rel)
        names = set()
        for d in (da, db):
            if os.path.isdir(d):
                names.update(n for n in os.listdir(d) if n not in ('.git', '__pycache__', 'node_modules'))
        for n in sorted(names):
            r = os.path.join(rel, n)
            pa, pb = os.path.join(a, r), os.path.join(b, r)
            if os.path.isdir(pa) and os.path.isdir(pb):
                walk(r)
            elif os.path.isfile(pa) and os.path.isfile(pb):
                if not filecmp.cmp(pa, pb, shallow=False):
                    out.append(r)
            else:
                out.append(r)
    walk('')
    return out


def run_tool(site, args, out, timeout=3000):
    t0 = time.time()
    cmd = [sys.executable, os.path.join(site, 'tools', 'apply_answers.py'), '--site', site, '--out', out] + args
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, encoding='utf-8', errors='replace', timeout=timeout)
    return p.returncode, p.stdout, round(time.time() - t0, 1)


def one_line(out):
    for l in out.split('\n'):
        if l.startswith('Checks:'):
            return l.strip()
    return out.strip().split('\n')[-1][:160]


def do_singles(a, site, recipes, skipped, rules, playbook, dash):
    import rehearse_answers as ra
    ra.ROOT = site
    keys = sorted(k for k in recipes if not (recipes[k].get('model') or rules.get('manual', {}).get(k)))
    if a.only:
        keys = [k for k in keys if k in a.only.split(',')]
    patch_keys = sorted(k for k in rules.get('patches', {}) if not k.startswith('_'))
    work = [(k, 'recipe') for k in keys] + [(k, 'patch') for k in patch_keys if not a.only or k in a.only.split(',')]
    when = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    os.makedirs(a.out, exist_ok=True)
    if a.shuffle:
        random.Random(a.shuffle).shuffle(work)                                  # a run that is stopped early has still looked at a mixed sample

    def job(item):
        key, kind = item
        id_, letter = key.split('=')
        d = os.path.join(a.out, key.replace('=', '-'))
        os.makedirs(d, exist_ok=True)
        vals = made_up_values(rules, recipes, key)
        docs = {id_: make_doc(playbook, dash, id_, letter, when, vals)}
        extra = []
        if kind == 'patch' and key == 'd30=A':
            extra = ['--host', 'cloudflare']
        f = os.path.join(d, 'answers.json')
        write_answers(f, docs, 'doc')
        gate = a.gate if kind == 'recipe' or a.gate != 'steps' else 'rebuild'
        gate = 'none' if gate == 'steps' else gate
        code, out, secs = run_tool(site, [f] + extra + ['--gate', gate] + (['--skip', a.skip] if a.skip else []) + ['--keep', os.path.join(d, 'tree')], os.path.join(d, 'out'))
        row = {'key': key, 'kind': kind, 'exit': code, 'secs': secs, 'line': one_line(out), 'oracle': '', 'diff': [], 'gate': gate}
        with open(os.path.join(d, 'tool.log'), 'w', encoding='utf-8', newline='\n') as h:
            h.write(out)
        if kind == 'recipe' and os.path.isdir(os.path.join(d, 'tree')) and not a.no_oracle:
            keep = os.path.join(d, 'oracle')
            res = ra.replay(key, recipes[key], quick=True, keep=keep, steps_only=(gate == 'none'))
            row['oracle'] = 'steps ok' if not res['problems'] else 'oracle problem: ' + '; '.join(res['problems'])[:120]
            ot = os.path.join(keep, key.replace('=', '-'))
            if os.path.isdir(ot):
                row['diff'] = tree_diff(os.path.join(d, 'tree'), ot)
            shutil.rmtree(keep, ignore_errors=True)
        shutil.rmtree(os.path.join(d, 'tree'), ignore_errors=True)
        with open(os.path.join(d, 'row.json'), 'w', encoding='utf-8', newline='\n') as h:
            json.dump(row, h)
        print('%-8s exit %s %5.0fs  %s%s' % (key, code, secs, (row['line'] if row['line'].startswith('Checks') else out.split('\n')[0])[:70], ('  DIFF vs oracle: %s' % ', '.join(row['diff'][:4])) if row['diff'] else ''))
        sys.stdout.flush()
        return row
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, a.jobs)) as ex:
        rows = list(ex.map(job, work))
    return rows


def do_bundle(a, site, recipes, skipped, rules, playbook, dash):
    rnd = random.Random(a.seed)
    when = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    ids = sorted(playbook)
    rnd.shuffle(ids)
    pick = []
    have = set(recipes) | set(k for k in rules.get('patches', {}) if not k.startswith('_'))
    for id_ in ids:
        letters = sorted(playbook[id_]['options'])
        with_steps = [L for L in letters if '%s=%s' % (id_, L) in have]
        if a.bias and with_steps and rnd.random() < 0.8:           # most of the answers are ones that change files (the plain random pick mostly gives "leave it as it is")
            letters = with_steps
        L = rnd.choice(letters)
        pick.append('%s=%s' % (id_, L))
        if len(pick) >= a.size:
            break
    docs = {}
    forms = ['doc', 'doc', 'doc', 'letter']
    for key in pick:
        id_, letter = key.split('=')
        vals = made_up_values(rules, recipes, key)
        docs[id_] = make_doc(playbook, dash, id_, letter, when, vals, form=rnd.choice(forms))
    os.makedirs(a.out, exist_ok=True)
    f = os.path.join(a.out, 'answers.json')
    write_answers(f, docs, rnd.choice(['bundle', 'doc', 'list']))
    code, out, secs = run_tool(site, [f, '--gate', a.gate] + (['--skip', a.skip] if a.skip else []), os.path.join(a.out, 'out'))
    with open(os.path.join(a.out, 'tool.log'), 'w', encoding='utf-8', newline='\n') as h:
        h.write(out)
    print(out)
    return [{'key': 'bundle seed %d (%s)' % (a.seed, ' '.join(pick)), 'kind': 'bundle', 'exit': code, 'secs': secs, 'line': one_line(out)}]


def do_contradict(a, site, recipes, skipped, rules, playbook, dash):
    when = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    sets = [
        ('d38=B d30=A d05=A', 'a different web address with old-address redirects'),
        ('d61=B d31=B', 'a photo credit for a photo that is removed'),
        ('d01=B d24=B', 'two winter patches that cannot be combined'),
        ('d07=A d48=B', 'two answers that edit the same test line'),
        ('d19=A d54=B', 'prices typed over two GreenHouse rows, and the same "Prices coming soon" rows deleted'),
        ('d26=B d54=B', 'a flowers sentence reworded, and the price-list line that holds it deleted (found by a random bundle: it first failed half way)'),
        ('d10=D d62=B', 'the Drive time box off and its note reworded'),
    ]
    rows = []
    os.makedirs(a.out, exist_ok=True)
    for n, (keys, why) in enumerate(sets):
        docs = {}
        for key in keys.split():
            id_, letter = key.split('=')
            docs[id_] = make_doc(playbook, dash, id_, letter, when, made_up_values(rules, recipes, key))
        f = os.path.join(a.out, 'contradict%d.json' % n)
        write_answers(f, docs, 'doc')
        code, out, secs = run_tool(site, [f, '--gate', 'none'], os.path.join(a.out, 'c%d' % n))
        refused = len(re.findall(r'\[refused\]', out))
        failed = len(re.findall(r'\[failed\]', out))
        rows.append({'key': keys, 'kind': 'contradict', 'exit': code, 'secs': secs, 'line': '%s: %d refused, %d failed plainly, exit %s' % (why[:90], refused, failed, code)})
        print(rows[-1]['key'], '->', rows[-1]['line'])
    return rows


def do_willsend(a, site, recipes, skipped, rules, playbook, dash):
    when = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    rows = []
    os.makedirs(a.out, exist_ok=True)
    keys = []
    for id_ in sorted(playbook):
        for L, lab in sorted(playbook[id_]['options'].items()):
            if aa.OWES.search(lab) or aa.UNDECIDED.search(lab):
                keys.append('%s=%s' % (id_, L))
    docs = {}
    for key in keys:
        id_, letter = key.split('=')
        docs[id_] = make_doc(playbook, dash, id_, letter, when)          # no values: the owner has not sent them
    f = os.path.join(a.out, 'answers.json')
    write_answers(f, docs, 'doc')
    code, out, secs = run_tool(site, [f, '--plan'], os.path.join(a.out, 'out'))
    with open(os.path.join(a.out, 'tool.log'), 'w', encoding='utf-8', newline='\n') as h:
        h.write(out)
    lines = [l for l in out.split('\n') if re.match(r'^  d\d+ ', l)]
    for l in lines:
        m = re.match(r'^  (d\d+)\s+(\S+)\s+\[(\w+)\]', l)
        if m:
            rows.append({'key': m.group(2), 'kind': 'willsend', 'exit': 0, 'secs': 0, 'line': m.group(3)})
        elif re.match(r'^  d\d+\s+\S+\s+will be applied', l):
            k = l.split()[1]
            rows.append({'key': k, 'kind': 'willsend', 'exit': 0, 'secs': 0, 'line': 'applies: the answer is complete in its words' if k == 'd23=A' else 'WILL BE APPLIED WITHOUT WHAT THE OWNER OWES'})
    print('%d answers say "I will ..." or "not sure"; %s' % (len(keys), out.split('\n')[0]))
    return rows


def do_plan_all(a, site, recipes, skipped, rules, playbook, dash):
    when = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    os.makedirs(a.out, exist_ok=True)
    rows = []
    for id_ in sorted(set(playbook) | set(dash or {})):
        letters = sorted((playbook.get(id_) or {}).get('options') or {}) or ['A']
        for L in letters:
            key = '%s=%s' % (id_, L)
            f = os.path.join(a.out, 'p.json')
            write_answers(f, {id_: make_doc(playbook, dash, id_, L, when)}, 'doc')
            code, out, secs = run_tool(site, [f, '--plan'], os.path.join(a.out, 'p'))
            m = re.search(r'^  %s\s+\S+\s+(?:\[(\w+)\]|(will be applied))' % id_, out, re.M)
            rows.append({'key': key, 'kind': 'plan', 'exit': code, 'secs': secs, 'line': (m.group(1) or 'ready') if m else 'no line: ' + out.strip().split('\n')[-1][:80]})
    return rows


def write_results(a, rows, mode):
    L = ['# Simulated runs: %s' % mode, '', 'Made %s with tools/simulate_answers.py.' % datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), '', '| What | Exit | Seconds | Result | Differs from the oracle |', '|---|---|---|---|---|']
    for r in rows:
        L.append('| %s | %s | %s | %s | %s |' % (r['key'], r['exit'], r['secs'], r['line'].replace('|', '/'), (', '.join(r.get('diff', [])[:5]) or ('none' if r.get('oracle') else ''))))
    with open(os.path.join(a.out, 'RESULTS.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L) + '\n')
    with open(os.path.join(a.out, 'results.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(rows, f, indent=1)


def main():
    ap = argparse.ArgumentParser(description='Pretend the owner answered, and see what apply_answers.py does.')
    ap.add_argument('mode', choices=['plan-all', 'singles', 'bundle', 'contradict', 'willsend'])
    ap.add_argument('--site', default=SITE)
    ap.add_argument('--out', required=True)
    ap.add_argument('--decisions', default=os.environ.get('WA_DECISIONS', ''), help="a folder with the dashboard's decision documents (d01.json ...)")
    ap.add_argument('--jobs', type=int, default=1)
    ap.add_argument('--size', type=int, default=20)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--bias', action='store_true', help='bundle: pick mostly answers that change files')
    ap.add_argument('--only', default='', help='singles: only these keys, like d02=A,d16=C')
    ap.add_argument('--gate', choices=['full', 'quick', 'rebuild', 'steps'], default='full', help='full: every check; quick: the playbook\'s own rule; rebuild: steps and rebuild only; steps: only the steps, compared with the oracle')
    ap.add_argument('--skip', default='', help='checks to leave out (launch-check,validity)')
    ap.add_argument('--no-oracle', action='store_true')
    ap.add_argument('--shuffle', type=int, default=0, help='singles: a seed; mix up the order')
    a = ap.parse_args()
    site = os.path.abspath(a.site)
    recipes, skipped, rules, playbook = facts(site)
    dash = {}
    if a.decisions and os.path.isdir(a.decisions):
        for n in os.listdir(a.decisions):
            if n.endswith('.json') and aa._as_id(n):
                dash[aa._as_id(n)] = json.load(open(os.path.join(a.decisions, n), encoding='utf-8'))
    fn = {'plan-all': do_plan_all, 'singles': do_singles, 'bundle': do_bundle, 'contradict': do_contradict, 'willsend': do_willsend}[a.mode]
    rows = fn(a, site, recipes, skipped, rules, playbook, dash)
    write_results(a, rows, a.mode)
    bad = [r for r in rows if r.get('diff') or (r['kind'] in ('recipe', 'patch') and r['exit'] not in (0, 4))]
    print('\n%d run(s), %d with something to look at. Results: %s' % (len(rows), len(bad), os.path.join(a.out, 'RESULTS.md')))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
