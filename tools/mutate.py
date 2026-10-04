#!/usr/bin/env python3
"""Mutation sweep of the test suite: does a test notice when the site breaks?

  python3 tools/mutate.py --base TREE [--mutants tools/mutants.json] [--only a01,b02] [--browser] [--jobs 3] [--out results.json]

For every mutant in mutants.json (one small deliberate break: file, text to find, text to put there) the tree is copied into a throw-away folder, the
break is made, and the tests are run:
  1. the CHEAP tests the covers lines name for the changed file (what `node tests/run-all.mjs --files=FILE` suggests, without the slow ones);
  2. if nothing failed: the other cheap tests that need no browser (a catch here means the covers mapping has a hole);
  3. with --browser, if still nothing: the browser test(s) named in the mutant ("browser"), one at a time.
It prints one line per mutant: CAUGHT by which tests, or SURVIVED, and writes the table to --out (JSON). Nothing in TREE is changed.
Mutants are plain data (tools/mutants.json, made by hand): a stale one says NOT APPLIED instead of passing quietly."""
import argparse, json, os, random, re, shutil, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor

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

CHEAP_SLOW = {'pipeline', 'option-patches', 'review-sheet', 'launch-check', 'runner'}   # no browser, but minutes under load: only when the mutant asks for them
def sh(cmd, cwd, timeout):
    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout, env={**os.environ, 'WA_SLOW': os.environ.get('WA_SLOW', '')})
        return p.returncode, p.stdout + p.stderr, time.time() - t0
    except subprocess.TimeoutExpired as e:
        return 124, (e.stdout or b'').decode('utf8', 'replace') if isinstance(e.stdout, bytes) else (e.stdout or '') + '\nTIMEOUT', time.time() - t0

def apply(m, tree):
    for o in m['ops']:
        if 'write' in o:
            p = os.path.join(tree, o['write']); os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'wb').write(random.Random(1).randbytes(o['size'])); continue
        p = os.path.join(tree, o['file'])
        s = open(p, encoding='utf8').read()
        if o['count'] == 0: n = s + o['repl']                      # append
        elif o.get('regex'):
            n, k = re.subn(o['find'], o['repl'], s, count=o['count'], flags=re.S if 's' in o.get('flags', '') else 0)
            if not k: return 'regex did not match in ' + o['file']
        else:
            if o['find'] not in s: return 'text not found in ' + o['file'] + ': ' + o['find'][:50]
            n = s.replace(o['find'], o['repl'], o['count'])
        if n == s: return 'no change in ' + o['file']
        os.unlink(p); open(p, 'w', encoding='utf8', newline='\n').write(n)       # (a new file: a hard-linked copy would change the base too)
    return None

def names_for(words, tree):
    rc, out, _ = sh(['node', 'tests/run-all.mjs', *words, '--list'], tree, 120)
    return [l.split()[0] for l in out.splitlines() if re.match(r'^[a-z0-9-]+ +\[(browser|no browser)\]', l)]

def mapped(m, tree):
    files = sorted({o.get('file') or o['write'] for o in m['ops']})
    rc, out, _ = sh(['node', 'tests/run-all.mjs', '--files=' + ','.join(files)], tree, 120)
    cmd = next((l.strip() for l in out.splitlines() if l.strip().startswith('node tests/run-all.mjs ')), '')
    words = cmd.split()[2:]
    return (names_for(words, tree) if words else []), files

def run_tests(names, tree, timeout):
    if not names: return [], '', 0
    rc, out, secs = sh(['node', 'tests/run-all.mjs', *['=' + n for n in names]], tree, timeout)
    failed = []
    for l in out.splitlines():
        if l.startswith('Failed: '): failed = [x.strip() for x in l[8:].split(',')]
    first = next((l.strip()[:160] for l in out.splitlines() if l.startswith('FAIL ') or l.strip().startswith('FAIL ')), '')
    if rc == 124: failed = ['(timeout)']      # too slow for the time given (a busy computer): says nothing about the mutant
    elif rc != 0 and not failed: failed = ['(run did not finish)']
    return failed, first, secs

def phase1(m, base, work, cheap_all, skip_slow):
    tree = tempfile.mkdtemp(dir=work, prefix=m['id'] + '-')
    shutil.rmtree(tree); shutil.copytree(base, tree, ignore=shutil.ignore_patterns('node_modules', '.visual', '.git'))
    r = {'id': m['id'], 'cat': m['cat'], 'desc': m['desc'], 'tree': tree}
    bad = apply(m, tree)
    if bad: r['status'] = 'NOT APPLIED'; r['why'] = bad; return r
    maps, files = mapped(m, tree)
    r['files'] = files; r['mapped'] = maps
    want = set(m['expect']) | ({'pipeline'} if m['build'] else set())
    cheap = [n for n in maps if n in cheap_all and (n not in CHEAP_SLOW or n in want)]
    r['ran'] = cheap
    failed, first, secs = run_tests(cheap, tree, 1200)
    r['secs'] = round(secs)
    if failed == ['(timeout)']: r['status'] = 'TIMEOUT'; return r
    if failed: r.update(status='CAUGHT', by=failed, first=first, in_mapping=True); return r
    others = [n for n in cheap_all if n not in cheap and (n not in CHEAP_SLOW or n in want)]
    failed2, first2, secs2 = run_tests(others, tree, 1200)
    r['secs'] += round(secs2)
    if failed2 == ['(timeout)']: r['status'] = 'TIMEOUT'; return r
    if failed2: r.update(status='CAUGHT', by=failed2, first=first2, in_mapping=False, note='caught only by a test the covers mapping did not name'); return r
    r['status'] = 'SURVIVED (no-browser)'
    return r

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--base', required=True); ap.add_argument('--mutants', default=os.path.join(os.path.dirname(__file__), 'mutants.json'))
    ap.add_argument('--only', default=''); ap.add_argument('--browser', action='store_true'); ap.add_argument('--jobs', type=int, default=3)
    ap.add_argument('--out', default='mutation-results.json'); ap.add_argument('--keep', action='store_true')
    a = ap.parse_args()
    base = os.path.abspath(a.base)
    ms = json.load(open(a.mutants, encoding='utf-8'))
    if a.only: ms = [m for m in ms if m['id'] in a.only.split(',')]
    work = tempfile.mkdtemp(prefix='mutate-', dir=os.environ.get('MUTATE_TMP') or None)
    rc, out, _ = sh(['node', 'tests/run-all.mjs', '--list'], base, 120)
    cheap_all = [l.split()[0] for l in out.splitlines() if re.match(r'^[a-z0-9-]+ +\[no browser\]', l)]
    print(f'{len(ms)} mutants, cheap tests: {" ".join(cheap_all)}', flush=True)
    results = []
    by = {m['id']: m for m in ms}
    import queue, threading
    q = queue.Queue()
    def browser_worker():              # one browser test at a time, while the cheap tests of the other mutants still run
        while True:
            r = q.get()
            if r is None: return
            m = by[r['id']]
            failed, first, secs = run_tests(m['browser'], r['tree'], 1500)
            r['secs'] += round(secs); r['browser_ran'] = m['browser']
            if failed == ['(timeout)']: r['status'] = 'TIMEOUT'
            elif failed: r.update(status='CAUGHT', by=failed, first=first, in_mapping=all(n in r['mapped'] for n in failed))
            else: r['status'] = 'SURVIVED'
            print(f"{r['id']:4} {r['status']:22} {','.join(r.get('by', []))[:60]}  (browser {','.join(m['browser'])}, {round(secs)}s)", flush=True)
    bt = threading.Thread(target=browser_worker); bt.start()
    with ThreadPoolExecutor(a.jobs) as ex:
        futs = [ex.submit(phase1, m, base, work, cheap_all, True) for m in ms]
        from concurrent.futures import as_completed
        for f in as_completed(futs):
            r = f.result(); results.append(r)
            print(f"{r['id']:4} {r['status']:22} {','.join(r.get('by', []))[:60]}", flush=True)
            if a.browser and r['status'] == 'SURVIVED (no-browser)' and by[r['id']]['browser']: q.put(r)
    q.put(None); bt.join()
    results.sort(key=lambda r: r['id'])
    for r in results:
        if not a.keep: shutil.rmtree(r.get('tree', ''), ignore_errors=True); r.pop('tree', None)
    shutil.rmtree(work, ignore_errors=True)
    json.dump(results, open(a.out, 'w', encoding='utf-8', newline='\n'), indent=1)
    c = sum(r['status'] == 'CAUGHT' for r in results); s = sum(r['status'].startswith('SURV') for r in results)
    print(f'\n{len(results)} mutants: {c} caught, {s} survived, {sum(r["status"] == "NOT APPLIED" for r in results)} not applied')
main()
