#!/usr/bin/env python3
"""Checks the commands that the notes tell a person to type: do they exist, and do they work on Windows too?

  python3 tools/check_doc_commands.py            check README.md, docs/*.md, print/owner-cheat-sheet*.html, the help text of every tool and the
                                                 "After:" lines of patches/optional/*.patch; say what is wrong, one line each (exit code 1 if anything is)
  python3 tools/check_doc_commands.py --list     also list every command that was found, with the file and line
  python3 tools/check_doc_commands.py --no-help  do not run the tools with --help (quicker; the options are then read from the tools' own text only)
  python3 tools/check_doc_commands.py --root DIR check another copy of the site (for example a throw-away copy)

It finds the commands in fenced blocks and in `backtick` pieces of text: the lines that start with python3, python, py, node, git, curl and so on.
For each command it asks: does the program or test file it names exist; does each --option appear in that tool (its --help text or its own
text); does every file it names exist; and is it safe to type in cmd and in PowerShell as well as in a Mac or Linux terminal (two commands joined
with && or ; , a $ inside double quotes, single quote marks, a name=value in front, a command that only a Mac or Linux has, a line that ends in \\).
Nothing the notes show is ever run, except  tool --help  (in a throw-away copy of the site, so a tool that ignores --help changes nothing here).
A command that only has to be read, never typed (an example with a <placeholder>, or one marked "do not type"), is still checked for its program and option names.
Needs Python 3.8 or newer, nothing else.
"""
import argparse
import glob
import html
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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# What starts a command in a note. (A line that starts with one of these words is read as a command.)
PROGRAMS = ('python3', 'python', 'py', 'node', 'git', 'curl', 'curl.exe', 'pip', 'pip3', 'npm', 'cd', 'source', 'ls', 'cat', 'rm', 'cp', 'mv', 'chmod',
            'sudo', 'bash', 'grep', 'head', 'tail')
ONLY_MAC_OR_LINUX = ('source', 'ls', 'cat', 'rm', 'cp', 'mv', 'chmod', 'sudo', 'export', 'bash', 'grep', 'head', 'tail')
# (the word "export" alone is also a word of tools/review_sheet.py: it starts a command only as  export NAME=value )
START = re.compile(r'^(?:[$>] |PS> |PS [^>]*> |[A-Za-z]:\\[^>]*> )?((?:[A-Z_][A-Z0-9_]*=\S+\s+)*)(' + '|'.join(re.escape(p) for p in PROGRAMS) + r'|export(?=\s+[A-Z_][A-Z0-9_]*=))(?=\s|$)')
# In running text (a help text, a patch header) a command is not marked, so it is cut where the sentence goes on.
STOP_WORDS = {'then', 'and', 'or', 'to', 'for', 'in', 'on', 'with', 'that', 'which', 'is', 'are', 'the', 'a', 'it', 'you', 'will', 'also', 'after', 'before', 'when',
              'if', 'as', 'but', 'not', 'so', 'from', 'by', 'at', 'this', 'run', 'makes', 'writes', 'writes', 'shows', 'says', 'prints', 'all', 'every', 'each'}
DIRS = ('tools/', 'tests/', 'docs/', 'patches/', 'print/', 'assets/', 'js/', 'css/', 'lang/', 'pages/')
TOP_FILES = ('index.html', 'first-visit.html', 'pumpkin-patch.html', 'strawberry-picking.html', 'school-field-trips.html', 'wise-pie.html', '404.html', 'README.md', '_headers',
             'robots.txt', 'sitemap.xml', 'manifest.webmanifest')
FILE_EXT = re.compile(r'\.(py|mjs|js|json|md|html|css|patch|txt|svg|xml|bat|webmanifest|csv|xlsx)$', re.I)
PLACEHOLDER = re.compile(r'[<>\[\]{}*]|\.\.\.|…|^[A-Z][A-Z0-9_]{1,}$|^[A-Z]+\.[a-z]+$|^NAME|<')


def strip_comment(text):
    """The command without a  # comment  after it (a # inside quote marks stays)."""
    quote = ''
    for i, c in enumerate(text):
        if quote:
            if c == quote:
                quote = ''
        elif c in '\'"':
            quote = c
        elif c == '#' and i > 0 and text[i - 1].isspace():
            return text[:i].rstrip()
    return text


class Cmd:
    """One command found in a note: where, the words, and what is wrong with it."""

    def __init__(self, where, line, text, kind, context='', prose=False, made=(), doc=''):
        self.where, self.line, self.text, self.kind, self.context, self.doc = where, line, strip_comment(text), kind, context, doc
        self.prose, self.made = prose, set(made)     # prose: written inside a sentence; made: files that a patch adds itself
        self.broken, self.windows = [], []


# ------------------------------------------------------------------------------------------------ reading the notes
def split_pieces(text):
    """The command cut where && || ; | start a new one (outside quote marks): [(piece, joiner before it)]."""
    out, cur, quote, i, join = [], '', '', 0, ''
    while i < len(text):
        c = text[i]
        if quote:
            cur += c
            if c == quote:
                quote = ''
        elif c in '\'"':
            quote = c
            cur += c
        elif text.startswith('&&', i) or text.startswith('||', i):
            out.append((cur, join))
            cur, join = '', text[i:i + 2]
            i += 1
        elif c == ';':
            out.append((cur, join))
            cur, join = '', ';'
        elif c == '|':
            out.append((cur, join))
            cur, join = '', '|'
        else:
            cur += c
        i += 1
    out.append((cur, join))
    return [(p.strip(), j) for p, j in out if p.strip()]


def tokens(piece):
    """[(word, quote mark or '')] with the quote marks taken off."""
    out, i = [], 0
    while i < len(piece):
        if piece[i].isspace():
            i += 1
            continue
        word, quote, mark = '', '', ''
        while i < len(piece) and (quote or not piece[i].isspace()):
            c = piece[i]
            if quote:
                if c == quote:
                    quote = ''
                else:
                    word += c
            elif c in '\'"':
                quote = c
                mark = mark or c
            else:
                word += c
            i += 1
        out.append((word, mark))
    return out


def is_command(text):
    """Starts with a program word and has something after it (a lone  grep  or  python3  in a sentence is a word, not a command)."""
    m = START.match(text.strip())
    return bool(m) and bool(text.strip()[m.end():].strip())


def commands_in_markdown(rel, text):
    """Every command in a .md file: lines of fenced blocks and `pieces of text` that start with a program word."""
    found, fenced, lines = [], False, text.split('\n')
    i, block_from = 0, 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith('```'):
            fenced = not fenced
            block_from = i
            i += 1
            continue
        if fenced:
            cmd, n = line.strip(), i
            while cmd.endswith('\\') and i + 1 < len(lines):    # a line that goes on
                i += 1
                cmd = cmd[:-1].rstrip() + ' ' + lines[i].strip()
            if is_command(cmd) or re.match(r'^[A-Za-z_]\w*=\S', cmd):
                end = next((k for k in range(n, len(lines)) if lines[k].strip().startswith('```')), n)     # the words before and after the block say who it is for
                c = Cmd(rel, n + 1, cmd, 'block', ' '.join(lines[max(0, block_from - 5):end + 4]), doc=text)
                if lines[n].strip().endswith('\\'):
                    c.windows.append('a line that ends in \\ goes on in bash only (cmd uses ^, PowerShell uses a backtick): put the command on one line')
                if not START.match(cmd) and not re.search(r'Mac|Linux', c.context):
                    c.windows.append('a NAME=value line, with $( ) or mktemp or tar, is written for bash: cmd and PowerShell do not read it (say that it is for Mac or Linux, or give Windows steps)')
                found.append(c)
        else:
            for m in re.finditer(r'`([^`\n]+)`', line):
                if is_command(m.group(1)):
                    found.append(Cmd(rel, i + 1, m.group(1).strip(), 'text', ' '.join(lines[max(0, i - 1):i + 2]), doc=text))
            bare = re.sub(r'`[^`\n]*`', lambda m: ' ' * len(m.group(0)), line)     # a command written in a sentence, without backticks
            found += commands_in_prose(rel, i + 1, bare, 'prose')
        i += 1
    return found


def commands_in_html(rel, text):
    found = []
    for m in re.finditer(r'<(code|pre)\b[^>]*>(.*?)</\1>', text, re.S):
        body = html.unescape(re.sub(r'<[^>]+>', '', m.group(2))).strip()
        for part in body.split('\n'):
            if is_command(part):
                found.append(Cmd(rel, text.count('\n', 0, m.start()) + 1, part.strip(), 'text', ''))
    return found


def commands_in_prose(rel, line_no, text, kind, made=()):
    """A command written inside a sentence: the program, a tool or test file, then what looks like its options and one or two words."""
    found = []
    for m in re.finditer(r'(?<![\w./-])(python3|python|py -3|node)\s+((?:tools|tests)[/\\][\w./\\-]+\.(?:py|mjs))', text):
        rest = text[m.end():].split('`')[0]
        words = []
        for w in rest.split():
            bare = w.rstrip('.,;:)')
            if w in ('&&', '||', ';') or len(words) >= 6 or (not words and w.startswith('(')):
                break
            low = bare.lower()
            if (bare.startswith('-') or re.match(r'^[a-z0-9_=<>./:*-]+$', bare) or bare.startswith('[')) and low not in STOP_WORDS and (bare.startswith('-') or not words or len(bare) > 1):
                words.append(bare)
            else:
                break
            if w != bare:
                break
        found.append(Cmd(rel, line_no, ' '.join([m.group(1), m.group(2)] + words), kind, text, True, made))
        if re.match(r'\s*&&\s', rest):
            found[-1].windows.append('joins commands with &&: PowerShell (Windows 10 and 11) and cmd do not read it; write the commands on separate lines')
    for m in re.finditer(r'(?<![\w./-])git apply((?: (?:--[a-z-]+(?:=\S+)?|-R|\S*patches/\S+\.patch))+)', text.split('`')[0]):
        found.append(Cmd(rel, line_no, ('git apply' + m.group(1)).rstrip('.,;)'), kind, text, True, made))
    return found


# ------------------------------------------------------------------------------------------------ what each tool knows
class Tools:
    """For each tool and test: its own text (the options it knows are written in it) and what its --help says."""

    def __init__(self, root, run_help):
        self.root, self.run_help, self.cache, self.tmp, self.problems = root, run_help, {}, None, {}

    def site_copy(self):
        if self.tmp is None:
            self.tmp = tempfile.mkdtemp(prefix='wa-doc-commands-')
            shutil.copytree(self.root, os.path.join(self.tmp, 'site'), symlinks=True,
                            ignore=shutil.ignore_patterns('.git', 'node_modules', '.venv', 'deploy', '__pycache__', '.visual', 'review'))
        return os.path.join(self.tmp, 'site')

    def info(self, rel):
        if rel in self.cache:
            return self.cache[rel]
        path = os.path.join(self.root, rel)
        with open(path, encoding='utf-8-sig', errors='replace') as f:
            source = f.read()
        info = {'source': source, 'help': '', 'help_ok': None}
        if self.run_help and rel.endswith('.py') and rel.startswith('tools/') and not os.path.basename(rel).startswith('test_'):
            try:
                r = subprocess.run([sys.executable, rel, '--help'], cwd=self.site_copy(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90,
                                   universal_newlines=True, encoding='utf-8', errors='replace', stdin=subprocess.DEVNULL)
                info['help'] = r.stdout
                doc = re.match(r'(?:#![^\n]*\n)?"""\s*(.*?)\n', source)
                first = (doc.group(1) if doc else '')[:30]
                info['help_ok'] = r.returncode == 0 and ('usage' in r.stdout.lower() or (bool(first) and first in r.stdout))
            except (OSError, subprocess.SubprocessError):
                info['help_ok'] = False
        info['choices'] = {m.group(1): set(m.group(2).split(',')) for m in re.finditer(r'(--[a-z][a-z0-9-]*)(?: [A-Z_]+)? \{([^}]*)\}', info['help'])}
        info['options'] = set(re.findall(r'(?<![\w-])--[a-z][a-z0-9-]*', source + '\n' + info['help'])) | ({'-h', '--help'} if rel.endswith('.py') else set())
        self.cache[rel] = info
        return info

    def clean(self):
        if self.tmp:
            shutil.rmtree(self.tmp, ignore_errors=True)


# ------------------------------------------------------------------------------------------------ checking one command
def looks_like_path(word):
    w = word.replace('\\', '/')
    return (w.startswith(DIRS) or w in TOP_FILES) and bool(FILE_EXT.search(w))


def check_path(c, root, word, why='names'):
    w = word.replace('\\', '/').strip()
    if PLACEHOLDER.search(w) or not looks_like_path(w):
        return
    if '*' in w:
        return
    if not os.path.exists(os.path.join(root, w)) and w not in c.made:
        c.broken.append('%s %s, which is not in the site folder' % (why, w))


def check_command(c, root, tools):
    """Fills c.broken (it cannot work) and c.windows (it would not work in every terminal)."""
    text = c.text
    m = START.match(text)
    if not m:
        return
    pieces = split_pieces(text)
    if len(pieces) > 1:
        joins = [j for p, j in pieces[1:] if j in ('&&', '||', ';')]
        if joins:
            c.windows.append('joins commands with %s: PowerShell (Windows 10 and 11) and cmd do not read it; write them on separate lines' % joins[0])
        if any(j == '|' and START.match(p) and START.match(p).group(2) in ONLY_MAC_OR_LINUX for p, j in pieces[1:]):
            c.windows.append('pipes into a Mac or Linux program (grep, head, tail ...) that Windows does not have')
    for k, (piece, join) in enumerate(pieces):
        pm = START.match(piece)
        if not pm:
            continue
        if pm.group(1).strip() and not (re.search(r'\$env:\w+', c.doc) and re.search(r'\bset [A-Z_]+=', c.doc)):
            c.windows.append('starts with %s: cmd and PowerShell do not read NAME=value in front of a command; set it on a line of its own or leave it out' % pm.group(1).strip())
        prog = pm.group(2)
        toks = tokens(piece[pm.end():])
        if prog in ONLY_MAC_OR_LINUX and not re.search(r'Mac|Linux|macOS|Terminal|bash', c.context + ' ' + c.text):
            c.windows.append('%s exists on Mac and Linux only (Windows: use the file window, or a different command)' % prog)
        for word, mark in toks:
            if mark == "'" and not re.match(r'^\$[\d.,]+$', word):   # (tools/change_fact.py takes the quote marks off a price itself)
                c.windows.append("'%s' in single quote marks: cmd keeps the quote marks as part of the word; use double quote marks" % word[:40])
            if mark == '"' and re.search(r'\$\w', word):
                c.windows.append('"%s": bash and PowerShell read $ in double quote marks as a name and drop it; single quote marks work there but not in cmd' % word[:40])
            if re.search(r'(?<![\w])(/tmp|/dev/null|~/|\$HOME|\$\()', word) or '`' in word:
                c.windows.append('"%s" is a Mac or Linux way of writing a place or a value' % word[:40])
        if prog in ('python3', 'python', 'py'):
            check_python(c, root, tools, toks)
        elif prog == 'node':
            check_node(c, root, tools, toks)
        elif prog == 'git':
            check_git(c, root, toks)
        elif prog == 'cd' and toks and toks[0][0].lower() == '/d' and not re.search(r'cd /d`?[^.\n]{0,80}powershell|powershell[^.\n]{0,80}cd /d', c.context, re.I):
            c.windows.append('cd /d works in cmd only: PowerShell does not know /d (it changes drive with a plain cd); say so')
        elif prog == 'curl' and 'curl.exe' not in c.context:
            c.windows.append('curl in PowerShell means something else (a web request command): write curl.exe there')


def check_python(c, root, tools, toks):
    words = [w for w, _ in toks]
    if words and words[0] == '-3':
        words = words[1:]
        toks = toks[1:]
    while words and words[0] in ('-I', '-B', '-u', '-X', '-W'):
        words, toks = words[1:], toks[1:]
    if not words:
        return
    if words[0] in ('-m', '-c', '--version', '-V', '--help', '-h'):
        return
    first = words[0].replace('\\', '/')
    if PLACEHOLDER.search(first) and not first.endswith('.py'):
        return
    if not first.endswith('.py'):
        return
    if not os.path.exists(os.path.join(root, first)) and first not in c.made:
        c.broken.append('names %s, which is not in the site folder%s' % (first, ' (the tools are in tools/)' if os.path.exists(os.path.join(root, 'tools', first)) else ''))
        return
    check_args(c, root, tools, first, toks[1:])


def check_node(c, root, tools, toks):
    words = [w for w, _ in toks]
    if not words:
        return
    first = words[0].replace('\\', '/')
    if PLACEHOLDER.search(first) and not first.endswith(('.mjs', '.js')):
        return
    if not first.endswith(('.mjs', '.js')):
        return
    if not os.path.exists(os.path.join(root, first)) and first not in c.made:
        c.broken.append('names %s, which is not in the site folder' % first)
        return
    check_args(c, root, tools, first, toks[1:])


def check_args(c, root, tools, tool, toks):
    info = tools.info(tool)
    if info['help_ok'] is False and tool.endswith('.py'):
        tools.problems[tool] = '%s does not show its help for --help: it does its work instead, or stops with an error (the notes name it, so a reader may try --help)' % tool
    run_all = tool.endswith('run-all.mjs')
    skip_next = False
    for n, (word, mark) in enumerate(toks):
        if skip_next:
            skip_next = False
            continue
        for opt in re.findall(r'(?<![\w-])--[a-z][a-z0-9-]*', word) if not mark else []:
            if opt not in info['options']:
                c.broken.append('uses %s, which %s does not have' % (opt, tool))
        if word.startswith('-') and not mark:
            if word in info.get('choices', {}) and n + 1 < len(toks):
                value, vmark = toks[n + 1]
                if not vmark and not PLACEHOLDER.search(value) and value not in info['choices'][word]:
                    c.broken.append('uses %s %s, and %s only takes %s' % (word, value, word, ', '.join(sorted(info['choices'][word]))))
                skip_next = True
            elif word in ('--out', '--site', '--base', '--root', '--values', '--port', '--today', '--days', '--only', '--mutants', '--jobs', '--date', '--until', '--shard') and '=' not in word:
                skip_next = True
            continue
        if mark or PLACEHOLDER.search(word):
            continue
        w = word.replace('\\', '/')
        if looks_like_path(w):
            if n > 0 and toks[n - 1][0] in ('--out', '>'):
                continue
            check_path(c, root, w)
            continue
        if run_all:
            name = w.lstrip('=')
            if re.match(r'^[a-z][a-z0-9-]*$', name) and not [t for t in os.listdir(os.path.join(root, 'tests')) if t.endswith('.test.mjs') and name in t] \
                    and 'tests/' + name + '.test.mjs' not in c.made:
                c.broken.append('names the test "%s", and no file in tests/ has that name' % name)
            continue
        if n == 0 and not c.prose and re.match(r'^[a-z][a-z0-9_-]*$', w) and tool.startswith('tools/'):
            if not re.search(r'(?<![\w-])' + re.escape(w) + r'(?![\w-])', info['source'] + info['help']):
                c.broken.append('says "%s" after %s, a word that the tool does not know' % (w, os.path.basename(tool)))


def check_git(c, root, toks):
    words = [w for w, _ in toks]
    if not words:
        return
    if words[0] in ('apply', 'mv'):
        for w, mark in toks[1:]:
            if not w.startswith('-') and not mark:
                check_path(c, root, w)
                if words[0] == 'mv':
                    break


# ------------------------------------------------------------------------------------------------ the whole site
def owner_notes(root):
    files = ['README.md'] + sorted('docs/' + os.path.basename(p) for p in glob.glob(os.path.join(root, 'docs', '*.md')))
    return files + (['tests/README.md'] if os.path.exists(os.path.join(root, 'tests', 'README.md')) else [])


def collect(root, tools):
    found = []
    for rel in owner_notes(root):
        with open(os.path.join(root, rel), encoding='utf-8-sig') as f:
            found += commands_in_markdown(rel, f.read())
    for p in sorted(glob.glob(os.path.join(root, 'print', 'owner-cheat-sheet*.html'))):
        rel = 'print/' + os.path.basename(p)
        with open(p, encoding='utf-8-sig') as f:
            found += commands_in_html(rel, f.read())
    for p in sorted(glob.glob(os.path.join(root, 'patches', 'optional', '*.patch'))):
        rel = 'patches/optional/' + os.path.basename(p)
        with open(p, encoding='utf-8-sig', errors='replace') as f:
            body = f.read()
        made = set(re.findall(r'^--- /dev/null\n\+\+\+ b/(\S+)', body, re.M))     # files the patch brings: a command in its "After:" line may name them
        if True:
            for n, line in enumerate(body.split('\n'), 1):
                if line.startswith(('diff ', '--- ', '+++ ', '@@')):
                    break
                if line.startswith('After:'):
                    found += commands_in_prose(rel, n, line[6:].strip(), 'patch', made)
    for p in sorted(glob.glob(os.path.join(root, 'tools', '*.py'))):
        rel = 'tools/' + os.path.basename(p)
        if os.path.basename(p).startswith('test_'):
            continue
        info = tools.info(rel)
        text = info['help'] if info['help_ok'] else info['source'].split('"""')[1] if info['source'].count('"""') >= 2 else ''
        for n, line in enumerate(text.split('\n'), 1):
            found += commands_in_prose(rel + ' (--help)', n, line, 'help')
    return found


# ------------------------------------------------------------------------------------------------ where the notes point to
def squash(text):
    return re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()


def readme_places(root):
    """The names a note can point to in README.md: its headings, the bold words that start a paragraph, the first cell of each table row."""
    with open(os.path.join(root, 'README.md'), encoding='utf-8-sig') as f:
        text = f.read()
    names = [m.group(1) for m in re.finditer(r'^#{1,6}\s+(.+?)\s*$', text, re.M)]
    names += [m.group(1) for m in re.finditer(r'^\*\*(.+?)\*\*', text, re.M)]
    names += [m.group(1) for m in re.finditer(r'^\|\s*([^|]+?)\s*\|', text, re.M)]
    return [squash(n) for n in names if squash(n)]


POINTER = re.compile(r'README(?:\.md)?\s*[,:]?\s*(?:the |in the )?(?:section|row|rows|paragraph)?\s*[\u201c"]([^"\u201d\n]{3,90})[\u201d"]')


def pointers(root, texts):
    """[(where, line, text, why)]: a note that points to a place in README by its name in quote marks, when README has no such place."""
    places, bad = readme_places(root), []
    for rel, text in texts:
        for n, line in enumerate(text.split('\n'), 1):
            for m in POINTER.finditer(line):
                name = squash(m.group(1))
                if name and not any(name in p for p in places):
                    bad.append((rel, n, m.group(0), 'points to the README place "%s", and README has no heading, paragraph or row with that name' % m.group(1)))
    return bad


# The notes that the farm owner is told to read and follow, with commands in them (README has its own section about Windows).
OWNER_NOTES = ('docs/OWNER_CHEAT_SHEET.md', 'docs/OWNER_CHEAT_SHEET.es.md', 'docs/OWNER_YEAR_CALENDAR.md', 'docs/OWNER_YEAR_CALENDAR.es.md', 'docs/LAUNCH_CHECKLIST.md',
               'docs/NOTICE_KIT.md', 'docs/CHECK_A_LANGUAGE.md', 'docs/READER_HANDOUT.md')


def owner_note_without_windows_word(rel, text):
    """A note for the farm owner that tells them to type python3 but never says what to type on Windows."""
    if rel not in OWNER_NOTES:
        return None
    if not re.search(r'(?<![\w])python3 (?:tools|-m)', text):
        return None
    if re.search(r'py -3|commands on windows|windows[^.\n]{0,90}\bpython\b|\bpython\b[^.\n]{0,60}windows', text, re.I):
        return None
    return 'tells the owner to type python3 but never says what to type on Windows (python, or py -3): add one sentence, or point to README, "Commands on Windows, Mac and Linux"'


def main(argv=None):
    ap = argparse.ArgumentParser(description='Checks the commands that the notes tell a person to type.')
    ap.add_argument('--list', action='store_true', help='list every command that was found')
    ap.add_argument('--no-help', action='store_true', help='do not run the tools with --help')
    ap.add_argument('--root', default=ROOT, help='the site folder to check (default: this one)')
    args = ap.parse_args(argv)
    root = os.path.abspath(args.root)
    tools = Tools(root, not args.no_help)
    try:
        found = collect(root, tools)
        for c in found:
            check_command(c, root, tools)
        texts = []
        for rel in owner_notes(root) + ['print/' + os.path.basename(p) for p in sorted(glob.glob(os.path.join(root, 'print', 'owner-cheat-sheet*.html')))] \
                + ['tools/' + os.path.basename(p) for p in sorted(glob.glob(os.path.join(root, 'tools', '*.py')))] \
                + ['patches/optional/' + os.path.basename(p) for p in sorted(glob.glob(os.path.join(root, 'patches', 'optional', '*.patch')))]:
            with open(os.path.join(root, rel), encoding='utf-8-sig', errors='replace') as f:
                body = f.read()
            if rel.endswith('.html'):
                body = html.unescape(re.sub(r'<[^>]+>', ' ', body))
            if rel.endswith('.patch'):
                body = body.split('\ndiff ')[0]
            texts.append((rel, body))
        lost = pointers(root, texts)
        for rel, body in texts:
            if rel.startswith('docs/'):
                why = owner_note_without_windows_word(rel, body)
                if why:
                    lost.append((rel, 1, rel, why))
    finally:
        tools.clean()
    bad = [c for c in found if c.broken or c.windows]
    for tool, why in sorted(tools.problems.items()):
        print('BROKEN   %s\n           -> %s' % (tool, why))
    for rel, n, text, why in lost:
        print('BROKEN   %s:%d  %s\n           -> %s' % (rel, n, text[:200], why))
    for c in found:
        if args.list and not (c.broken or c.windows):
            print('ok       %s:%d  %s' % (c.where, c.line, c.text[:400]))
    for c in bad:
        for why in c.broken:
            print('BROKEN   %s:%d  %s\n           -> %s' % (c.where, c.line, c.text[:300], why))
        for why in c.windows:
            print('WINDOWS  %s:%d  %s\n           -> %s' % (c.where, c.line, c.text[:300], why))
    kinds = {}
    for c in found:
        kinds[c.kind] = kinds.get(c.kind, 0) + 1
    n_broken = sum(1 for c in found if c.broken) + len(tools.problems) + len(lost)
    n_win = sum(1 for c in found if c.windows and not c.broken)
    print('%d commands found (%d in code blocks, %d in `backtick` pieces and print sheets, %d in sentences, %d in patch headers and tool help texts); %d things cannot work, %d more commands would fail in Windows cmd or PowerShell.'
          % (len(found), kinds.get('block', 0), kinds.get('text', 0), kinds.get('prose', 0), kinds.get('patch', 0) + kinds.get('help', 0), n_broken, n_win))
    return 1 if bad or tools.problems or lost else 0


if __name__ == '__main__':
    sys.exit(main())
