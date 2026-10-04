#!/usr/bin/env python3
"""Plain-words check for the documents the farm owner reads (English only). Stdlib only; needs Python 3.8 or newer.

  python3 tools/plain_lint.py                 a short table for every owner-facing section, and the worst sentences
  python3 tools/plain_lint.py docs/OWNER_YEAR_CALENDAR.md      only that file (its owner-facing sections)
  python3 tools/plain_lint.py --all-sentences  list every sentence over 25 words, not only the worst 10
  python3 tools/plain_lint.py --strict        the same, and exit 1 when a limit below is broken (a test runs this)
  python3 tools/plain_lint.py --all-problems  with --strict or on its own: list every problem, not only the first 60
  python3 tools/plain_lint.py --list          which documents and sections it reads (and which it leaves out on purpose)
  python3 tools/plain_lint.py --root DIR      read the documents from another folder (the test uses this to prove that it fails on a bad sentence)
  python3 tools/plain_lint.py --self-test     checks the tool's own counting (no files read)

Thresholds (the limits that --strict enforces; change them here, in this header, and nowhere else):
  MAX_GRADE          the average reading grade (Flesch-Kincaid) of each owner-facing section may not be above this
  MAX_SENTENCE       no sentence may be longer than this many words
  A word from the [jargon] part of tools/plain_words.txt may not appear in an owner-facing section, unless a line in its [allow] part
  names that file and word. A word inside `backticks` or inside "double quotes" is not checked: it is a file name, a setting, a label on
  a screen or somebody else's words, and it is written as it is.
A sentence can be held back (the [hold] part of the same file: "file name :: the first words of the sentence as this tool prints them"). A held
sentence is not counted against the two limits above. It is for a line that cannot be rewritten alone, for example because a patch in
patches/optional/ carries the line as context: change the line together with the patch, then delete its [hold] entry. --strict also fails when a
[hold] entry matches no sentence (it was rewritten: delete the entry) or more than one.
The soft limits (they only show in the tables): WARN_SENTENCE (a long sentence), MAX_PARAGRAPH (a long unbroken paragraph), passive-voice
hints, nested brackets, "e.g." and "i.e.", capital-letter abbreviations that are not in [known], and a word from [terms] whose first use is not explained.

What it reads. FILES below says, for each document, which headings are owner-facing ("only") or which are not ("skip"): the pages written for
whoever edits the site (the playbook, the test notes, "For whoever edits the site") are left out on purpose. Inside a section it skips code blocks and
the headings themselves, counts every `code in backticks` as one word, and counts every table cell and every bullet as its own sentence.

How the numbers are made. Words are counted as written; syllables by a simple rule (good enough to compare one version of a sentence with
the next, not a dictionary). Flesch reading ease = 206.835 - 1.015 x (words per sentence) - 84.6 x (syllables per word). Grade = 0.39 x (words per
sentence) + 11.8 x (syllables per word) - 15.59. Plain English for a general reader sits at grade 6 to 8.
Under the table the tool prints the 10 longest sentences, each with something to try (a plainer word from the list, a split at ";", bullets,
the bracket text as its own sentence, who does it for a passive). A grade is an average: a page can sit at grade 5 and still hold a 70-word sentence,
which is why the sentence limit is separate.
"""
import argparse
import os
import re
import sys

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


MAX_GRADE = 9.0
MAX_SENTENCE = 40
WARN_SENTENCE = 25
MAX_PARAGRAPH = 120

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORDS_FILE = os.path.join(HERE, 'plain_words.txt')

# The owner-facing documents. only=[...]: just those headings (and what is under them); skip=[...]: everything except those headings.
# A heading is named by the start of its text. English files only: the Spanish copies are kept in step by hand and by tests/owner-calendar.test.mjs.
FILES = {
    'README.md': {'only': ['Start here (for the farm owner)', 'Day-to-day changes', 'A new year, a new season', 'Check your changes', 'Putting it online', 'Optional patches']},
    'docs/LAUNCH_CHECKLIST.md': {'skip': ['Sources']},
    'docs/QUESTIONS_FOR_THE_FARM.md': {'skip': ['For whoever edits the site', 'Translation notes']},
    'docs/OWNER_YEAR_CALENDAR.md': {'skip': []},
    'docs/WHAT_THE_SITE_STORES.md': {'skip': []},
    'docs/CREDITS_AND_LICENCES.md': {'skip': ['How the fonts were matched', 'How the icons were matched']},
    'docs/OPTION_PATCHES.md': {'skip': []},
    'docs/PROPOSAL_owner_page.md': {'skip': []},
}

# ----------------------------------------------------------------------------------------------------------------- the word lists


def read_words(path=WORDS_FILE):
    """tools/plain_words.txt: parts [jargon] (word = plain replacement), [known] (abbreviations that need no explanation),
    [terms] (words to explain at first use; the text after = is how), [allow] (file :: word), [hold] (file :: first words of a sentence)."""
    parts = {'jargon': {}, 'known': set(), 'terms': {}, 'allow': set(), 'hold': []}
    part = None
    if not os.path.exists(path):
        return parts
    with open(path, encoding='utf-8') as f:
        for raw in f:
            line = raw.split('#', 1)[0].strip() if not raw.lstrip().startswith('[') else raw.strip()
            if not line:
                continue
            m = re.match(r'^\[(\w+)\]$', line)
            if m:
                part = m.group(1)
                continue
            if part in ('jargon', 'terms'):
                word, _, plain = line.partition('=')
                parts[part][word.strip().lower()] = plain.strip()
            elif part == 'known':
                parts['known'].add(line)
            elif part == 'allow':
                fname, _, word = line.partition('::')
                parts['allow'].add((fname.strip(), word.strip().lower()))
            elif part == 'hold':
                fname, _, start = line.partition('::')
                parts['hold'].append((fname.strip(), re.sub(r'\s+', ' ', start.strip())))
    return parts


# ----------------------------------------------------------------------------------------------------------------- reading a markdown file

ABBREV = re.compile(r'\b(e\.g\.|i\.e\.|etc\.|vs\.|approx\.|No\.|Mr\.|Mrs\.|Dr\.|St\.|a\.m\.|p\.m\.)', re.I)
TOKEN = re.compile(r"[A-Za-z][A-Za-z'’-]*|\d[\d,.:%$/-]*|§")


def clean_inline(text):
    text = re.sub(r'<!--.*?-->', ' ', text, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\[(?:read|tested here|not opened)\]', ' ', text.replace('**[', '[').replace(']**', ']'))   # the evidence tags of the launch checklist are not words of a sentence
    text = re.sub(r'`[^`]*`', ' § ', text)                 # a word, a path or a command in backticks counts as one word
    text = re.sub(r'!\[([^\]]*)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)   # a link keeps its words
    text = re.sub(r'https?://\S+', ' § ', text)
    text = re.sub(r'(\*\*|__|\*|(?<!\w)_(?=\w)|(?<=\w)_(?!\w))', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def split_sections(text):
    """[(level, heading, [lines])] in file order; lines before the first heading belong to a section with an empty heading."""
    out = [(0, '', [])]
    fence = False
    for line in text.split('\n'):
        if line.lstrip().startswith('```'):
            fence = not fence
            continue
        if fence:
            continue
        m = re.match(r'^(#{1,6}) +(.*)$', line)
        if m:
            out.append((len(m.group(1)), m.group(2).strip(), []))
        else:
            out[-1][2].append(line)
    return out


def wanted(heading, spec):
    h = heading.replace('`', '')
    if 'only' in spec:
        return any(h.startswith(x) for x in spec['only'])
    return not any(h.startswith(x) for x in spec.get('skip', []))


def owner_sections(text, spec):
    """Groups at heading level 2 (a level-2 heading with all its sub-headings): [(heading, [units])]. A unit is a paragraph, a bullet, a numbered step
    or a table cell; each is a list of sentences to count."""
    secs = split_sections(text)
    groups = []   # (heading, [(sub heading, lines)])
    for level, heading, lines in secs:
        if level <= 2:
            groups.append((heading, [(heading, lines)]))
        else:
            if not groups:
                groups.append(('', []))
            groups[-1][1].append((heading, lines))
    result = []
    for heading, subs in groups:
        if not wanted(heading, spec):
            continue
        units = []
        for sub, lines in subs:
            if sub and not wanted(sub, spec) and sub != heading:
                continue
            units += paragraphs(lines)
        if units:
            result.append((heading or '(top of the file)', units))
    return result


def paragraphs(lines):
    """Units of text: a paragraph (lines up to a blank line), each bullet or numbered step, each table cell. Returns [(kind, text)]."""
    units, buf = [], []

    def flush():
        if buf:
            t = clean_inline(' '.join(buf))
            if t:
                units.append(('p', t))
            buf.clear()
    for line in lines:
        s = line.rstrip()
        if not s.strip():
            flush()
            continue
        if re.match(r'^\s*\|', s):
            flush()
            if re.match(r'^\s*\|[\s:|-]+\|\s*$', s):
                continue
            for cell in s.strip().strip('|').split('|'):
                t = clean_inline(cell)
                if len(TOKEN.findall(t)) >= 3:
                    units.append(('cell', t))
            continue
        if re.match(r'^\s*([-*+]|\d+[.)])\s+', s):
            flush()
            buf.append(re.sub(r'^\s*([-*+]|\d+[.)])\s+', '', s))
            continue
        if re.match(r'^\s*>', s):
            s = re.sub(r'^\s*>\s?', '', s)
        buf.append(s.strip())
    flush()
    return units


def sentences(text):
    t = ABBREV.sub(lambda m: m.group(0).replace('.', '․'), text)
    parts = re.split(r'(?<=[.!?])["\')\]]*\s+(?=["(\[]?[A-Z0-9§]|\([a-z0-9]\) )', t)
    return [p.replace('․', '.').strip() for p in parts if TOKEN.search(p)]


def syllables(word):
    w = re.sub(r'[^a-z]', '', word.lower())
    if not w:
        return 1
    if len(w) <= 3:
        return 1
    w = re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$', '', w)
    w = re.sub(r'^y', '', w)
    return max(1, len(re.findall(r'[aeiouy]{1,2}', w)))


def count(sentence):
    words = TOKEN.findall(sentence)
    return len(words), sum(syllables(w) for w in words)


PASSIVE = re.compile(r"\b(is|are|was|were|be|been|being|gets?|got)\s+(?:\w+ly\s+)?(\w+ed|made|done|shown|written|known|given|seen|kept|sent|built|run|set|put|left|found|taken|chosen|held|read|hidden|written)\b", re.I)


def depth_of_brackets(s):
    d = m = 0
    for c in s:
        if c == '(':
            d += 1
            m = max(m, d)
        elif c == ')':
            d = max(0, d - 1)
    return m


def flesch(words, syll, sents):
    if not words or not sents:
        return 0.0, 0.0
    wps, spw = words / sents, syll / words
    return 206.835 - 1.015 * wps - 84.6 * spw, 0.39 * wps + 11.8 * spw - 15.59


# ----------------------------------------------------------------------------------------------------------------- the report


def analyse(path, spec, lists, root=ROOT):
    with open(os.path.join(root, path), encoding='utf-8') as f:
        text = f.read()
    jargon = lists['jargon']
    jrx = {w: re.compile(r'(?<![\w-])' + re.escape(w) + r'(?:s|es|ed|ing)?(?![\w-])', re.I) for w in jargon}
    known = lists['known']
    headings = [h.replace('`', '') for _, h, _ in split_sections(text)]
    named = list(spec.get('only', [])) + list(spec.get('skip', []))
    result = {'path': path, 'sections': [], 'sentences': [], 'abbr': {}, 'terms': {}, 'held': {}, 'unmatched': [n for n in named if not any(h.startswith(n) for h in headings)]}
    holds = [(i, start) for i, (fname, start) in enumerate(lists['hold']) if fname == path]
    first_seen = {}
    abbr_seen = set()
    for heading, units in owner_sections(text, spec):
        W = S = SY = n_long = n_over = n_jargon = n_passive = n_nested = n_eg = n_para = 0
        for kind, unit in units:
            sents = sentences(unit)
            uw = len(TOKEN.findall(unit))
            if kind == 'p' and uw > MAX_PARAGRAPH:
                n_para += 1
            uq = re.sub(r'["“][^"”]*["”]', ' ', unit)    # a quotation can run over several sentences: leave it out as a whole
            for ab in re.findall(r'(?<![A-Z] )\b[A-Z]{2,6}\b(?! [A-Z]{2,})', uq):    # a run of capitals ("READY TO UPLOAD") is a printed label, not an abbreviation
                if ab in abbr_seen:
                    continue
                abbr_seen.add(ab)
                if ab not in known and not re.search(r'\(%s\)|\b%s \(|\b%s, (?:the|a|an) |(?:short for|stands for|called) %s\b' % (ab, ab, ab, ab), uq):    # "(IP)", "OSRM (the ...)" and "OSRM, the ..." explain themselves
                    result['abbr'][ab] = (heading, unit)
            for s in sents:
                w, sy = count(s)
                if w == 0:
                    continue
                held = [i for i, start in holds if start in s]
                for i in held:
                    result['held'].setdefault(i, []).append(s)
                W += w
                S += 1
                SY += sy
                if w > WARN_SENTENCE:
                    n_long += 1
                if w > MAX_SENTENCE and not held:
                    n_over += 1
                unquoted = re.sub(r'["“][^"”]*["”]', ' ', s)    # words inside "double quotes" are a label on a screen or somebody else's words: left as they are
                found = [word for word, rx in jrx.items() if rx.search(unquoted) and (os.path.basename(path), word) not in lists['allow'] and (path, word) not in lists['allow']]
                if held:
                    found = []
                n_jargon += len(found)
                if PASSIVE.search(s):
                    n_passive += 1
                if depth_of_brackets(s) >= 2:
                    n_nested += 1
                n_eg += len(re.findall(r'\b(e\.g\.|i\.e\.)', s, re.I))
                for term in lists['terms']:
                    if term not in first_seen and re.search(r'(?<![\w-])' + re.escape(term) + r'(?:s|es)?(?![\w-])', s, re.I):
                        first_seen[term] = (heading, len(result['sentences']))
                result['sentences'].append({'section': heading, 'words': w, 'sent': s, 'jargon': found, 'passive': bool(PASSIVE.search(s)), 'syll': sy, 'held': bool(held)})
        ease, grade = flesch(W, SY, S)
        result['sections'].append({'name': heading, 'words': W, 'sents': S, 'wps': (W / S if S else 0), 'spw': (SY / W if W else 0), 'ease': ease, 'grade': grade,
                                   'long': n_long, 'over': n_over, 'jargon': n_jargon, 'passive': n_passive, 'nested': n_nested, 'eg': n_eg, 'para': n_para})
    cue = re.compile(r'\b(means|is the|is a|are the|is called|called|stands for|is when|that is|is what)\b|[:—(]', re.I)
    for term, (heading, idx) in first_seen.items():
        near = ' '.join(x['sent'] for x in result['sentences'][idx:idx + 2])    # the sentence that uses the word, and the one after it
        if not cue.search(near) and len(TOKEN.findall(result['sentences'][idx]['sent'])) > 2:    # "DNS." alone is a label: its explanation follows
            result['terms'][term] = (heading, result['sentences'][idx]['sent'])
    return result


def violations(res, lists):
    bad = []
    for name in res['unmatched']:
        bad.append('%s: tools/plain_lint.py (FILES) names the heading "%s", but the file has no such heading now: update FILES' % (res['path'], name))
    if not res['sections']:
        bad.append('%s: no owner-facing section was read: check FILES in tools/plain_lint.py' % res['path'])
    for i, (fname, start) in enumerate(lists['hold']):
        if fname != res['path']:
            continue
        n = len(res['held'].get(i, []))
        if n == 0:
            bad.append('%s: the [hold] entry "%s" matches no sentence now (it was rewritten, or is no longer in an owner-facing section): delete it from tools/plain_words.txt' % (res['path'], start[:60]))
        elif n > 1:
            bad.append('%s: the [hold] entry "%s" matches %d sentences: make it longer so that it names one' % (res['path'], start[:60], n))
    for sec in res['sections']:
        if sec['grade'] > MAX_GRADE and sec['sents'] >= 3:
            bad.append('%s, "%s": grade %.1f is above %.1f' % (res['path'], sec['name'], sec['grade'], MAX_GRADE))
    for s in res['sentences']:
        if s['words'] > MAX_SENTENCE and not s['held']:
            bad.append('%s, "%s": a sentence of %d words (limit %d): %s' % (res['path'], s['section'], s['words'], MAX_SENTENCE, s['sent'][:110]))
        for j in s['jargon']:
            bad.append('%s, "%s": the word "%s" (write "%s"): %s' % (res['path'], s['section'], j, lists['jargon'][j] or 'something plainer', s['sent'][:90]))
    return bad


def suggestion(s, lists):
    """What to try on a long sentence: a plainer word, a split at ";", a list for a long ":" run, the bracket text as its own sentence, a doer for a passive."""
    out = []
    for j in s['jargon']:
        out.append('"%s" -> %s' % (j, lists['jargon'][j] or 'a plainer word'))
    text = s['sent']
    if s['words'] > WARN_SENTENCE:
        semi = text.count(';')
        if semi:
            out.append('split at the %d ";" (each part can be its own sentence)' % semi)
        if text.count(',') >= 5 and not semi:
            out.append('%d commas: a list of short sentences or bullets reads easier' % text.count(','))
        if re.search(r'\([^()]{60,}\)', text):
            out.append('a long bracket: say it in its own sentence')
        if text.count(':') >= 1 and s['words'] > MAX_SENTENCE:
            out.append('over %d words: put what follows the ":" in bullets' % MAX_SENTENCE)
        if s['passive']:
            out.append('passive ("was checked"): say who does it')
    return '; '.join(out)


def show(res, lists, all_long):
    print('')
    print('== ' + res['path'])
    print('%-46s %6s %6s %5s %5s %5s %5s %4s %4s %4s %4s %4s' % ('section (level 2)', 'words', 'sents', 'w/s', 's/w', 'ease', 'grade', '>25', '>40', 'jarg', 'pass', 'para'))
    for sec in res['sections']:
        mark = '!' if (sec['grade'] > MAX_GRADE and sec['sents'] >= 3) or sec['over'] or sec['jargon'] else ' '
        print('%-46s %6d %6d %5.1f %5.2f %5.0f %5.1f %4d %4d %4d %4d %4d %s' % (sec['name'][:46], sec['words'], sec['sents'], sec['wps'], sec['spw'], sec['ease'], sec['grade'], sec['long'], sec['over'], sec['jargon'], sec['passive'], sec['para'], mark))
    W = sum(s['words'] for s in res['sections'])
    S = sum(s['sents'] for s in res['sections'])
    SY = sum(x['syll'] for x in res['sentences'])
    ease, grade = flesch(W, SY, S)
    print('%-46s %6d %6d %5.1f %5.2f %5.0f %5.1f' % ('whole file (owner-facing parts)', W, S, W / S if S else 0, SY / W if W else 0, ease, grade))
    ranked = sorted(res['sentences'], key=lambda s: (-(s['words'] > MAX_SENTENCE), -s['words'] - 12 * len(s['jargon'])))
    ranked = [s for s in ranked if s['words'] > WARN_SENTENCE or s['jargon']]
    shown = ranked if all_long else ranked[:10]
    if shown:
        print('')
        print('The %s %d sentences (%d words or more, or with a word from tools/plain_words.txt):' % ('worst' if not all_long else 'all', len(shown), WARN_SENTENCE + 1))
        for s in shown:
            hint = suggestion(s, lists)
            print('  [%d words] %s: %s%s' % (s['words'], s['section'][:30], s['sent'][:230] + ('...' if len(s['sent']) > 230 else ''), ('\n      try: ' + hint) if hint else ''))
    if res['held']:
        print('')
        print('Held back on purpose (the [hold] part of tools/plain_words.txt), %d sentence(s): %s' % (sum(len(v) for v in res['held'].values()), '; '.join('"%s..."' % lists['hold'][i][1][:40] for i in sorted(res['held']))))
    if res['abbr']:
        print('')
        print('Abbreviations that are not in [known] (explain them where they first appear, or add them to the list): ' + ', '.join(sorted(res['abbr'])))
    if res['terms']:
        print('Words from [terms] used before they are explained: ' + ', '.join('%s (%s)' % (t, v[0][:24]) for t, v in sorted(res['terms'].items())))
    eg = sum(s['eg'] for s in res['sections'])
    nest = sum(s['nested'] for s in res['sections'])
    para = sum(s['para'] for s in res['sections'])
    pas = sum(s['passive'] for s in res['sections'])
    print('Also: "e.g." / "i.e." x %d; sentences with brackets inside brackets x %d; paragraphs over %d words x %d; passive-voice hints x %d.' % (eg, nest, MAX_PARAGRAPH, para, pas))


# ----------------------------------------------------------------------------------------------------------------- self test


def self_test():
    bad = []

    def eq(name, got, want):
        if got != want:
            bad.append('%s: got %r, wanted %r' % (name, got, want))
    eq('syllables', [syllables(w) for w in ('farm', 'website', 'reservation', 'the', 'make', 'planned', 'February')], [1, 2, 4, 1, 1, 1, 3])
    eq('sentences', len(sentences('Open the file. Change the date (e.g. the last day). Then save it.')), 3)
    eq('code is one word', count(clean_inline('Run `python3 tools/pages.py` now.'))[0], 3)
    eq('link keeps words', clean_inline('See [the checklist](docs/X.md).'), 'See the checklist.')
    ease, grade = flesch(10, 14, 1)
    eq('flesch', (round(ease), round(grade)), (78, 5))
    eq('brackets', depth_of_brackets('a (b (c) d)'), 2)
    eq('table cells', [u[0] for u in paragraphs(['| a b c | x |', '|---|---|', '| one two three | 7 8 9 |'])], ['cell', 'cell', 'cell'])
    lists = read_words()
    if not lists['jargon']:
        bad.append('tools/plain_words.txt has no [jargon] part')
    for b in bad:
        print('SELF-TEST FAIL ' + b)
    print('self-test: %s' % ('ok' if not bad else '%d problem(s)' % len(bad)))
    return 1 if bad else 0


def show_list(root):
    for name, spec in FILES.items():
        path = os.path.join(root, name)
        if not os.path.exists(path):
            print('%s: not in this folder' % name)
            continue
        with open(path, encoding='utf-8') as f:
            text = f.read()
        read = [h for h, units in owner_sections(text, spec)]
        print('%s: %d section(s) read%s' % (name, len(read), (' (only: ' + '; '.join(spec['only']) + ')') if 'only' in spec else ((' (left out: ' + '; '.join(spec['skip']) + ')') if spec.get('skip') else ' (all of it)')))
        for h in read:
            print('    ' + h)
    return 0


def main():
    ap = argparse.ArgumentParser(description='Plain-words check for the owner-facing documents.')
    ap.add_argument('files', nargs='*', help='documents to check (default: every owner-facing document listed in this file)')
    ap.add_argument('--strict', action='store_true', help='exit 1 when a limit in the header is broken')
    ap.add_argument('--all-sentences', action='store_true', help='list every long sentence, not only the worst 10')
    ap.add_argument('--list', action='store_true', help='show which documents and sections are read')
    ap.add_argument('--root', help='read the documents from this folder instead of the site folder')
    ap.add_argument('--self-test', action='store_true', help="check the tool's own counting")
    ap.add_argument('--all-problems', action='store_true', help='list every problem, not only the first 60')
    ap.add_argument('--quiet', action='store_true', help='print only the problems (with --strict)')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    lists = read_words()
    root = os.path.abspath(a.root) if a.root else ROOT
    if a.list:
        return show_list(root)
    if a.files and a.root:
        names = [f.replace(os.sep, '/') for f in a.files]     # with --root, a name is a path inside that folder
    else:
        names = [os.path.relpath(os.path.abspath(f), root).replace(os.sep, '/') for f in a.files] if a.files else list(FILES)
    problems = []
    for name in names:
        if name not in FILES:
            print('%s is not in the owner-facing list in tools/plain_lint.py (FILES)' % name)
            problems.append(name + ': not listed')
            continue
        if not os.path.exists(os.path.join(root, name)):
            print('%s: no such file (skipped)' % name)
            continue
        res = analyse(name, FILES[name], lists, root)
        if not a.quiet:
            show(res, lists, a.all_sentences)
        problems += violations(res, lists)
    print('')
    if problems:
        print('%d thing(s) over the limits (grade %.1f, %d words a sentence, no word from [jargon]):' % (len(problems), MAX_GRADE, MAX_SENTENCE))
        shown = problems if a.all_problems else problems[:60]
        for p in shown:
            print('  ' + p)
        if len(shown) < len(problems):
            print('  ... and %d more (use --all-problems to see them)' % (len(problems) - len(shown)))
    else:
        print('Within the limits: grade %.1f or less in every owner-facing section, no sentence over %d words, no word from [jargon].' % (MAX_GRADE, MAX_SENTENCE))
    return 1 if (a.strict and problems) else 0


if __name__ == '__main__':
    sys.exit(main())
