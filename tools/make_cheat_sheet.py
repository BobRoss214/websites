#!/usr/bin/env python3
"""Makes the printable owner cheat sheet from the two notes it is written in. Stdlib only; needs Python 3.8 or newer.

  python3 tools/make_cheat_sheet.py            write print/owner-cheat-sheet.html (English) and print/owner-cheat-sheet.es.html (Spanish)
  python3 tools/make_cheat_sheet.py --check    write nothing; say which printed page is out of date (exit code 1), or that both are current (0)

The words are in docs/OWNER_CHEAT_SHEET.md and docs/OWNER_CHEAT_SHEET.es.md. Change the wording there, never in the printed pages, and run this again.
Open print/owner-cheat-sheet.html in a browser and press Print: one sheet of Letter or A4 paper, printed on both sides (front: the start,
the translation box and jobs 1 to 5; back: jobs 6 to 12). The part "Notes for the team" at the end of each note is not printed.
The pages are not uploaded: tools/make_deploy_folder.py leaves them out. tests/owner-cheat-sheet.test.mjs fails when they are out of date.
"""
import html
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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# One entry for each language: the note, the printed page, and the few words the printed page adds around the note.
SHEETS = [
    {'lang': 'en', 'md': 'docs/OWNER_CHEAT_SHEET.md', 'out': 'print/owner-cheat-sheet.html',
     'title': 'Wise Acres cheat sheet (print)', 'farm': 'Wise Acres Organic Farm',
     'bar': 'One sheet, both sides. Print on Letter or A4 paper, or choose Save as PDF.', 'button': 'Print the sheet',
     'stop': 'Notes for the team', 'side': ['Front', 'Back'],
     'tag': 'The steps were done by hand on a practice copy of the site on 4 October 2026. The dates are examples: use your own.'},
    {'lang': 'es', 'md': 'docs/OWNER_CHEAT_SHEET.es.md', 'out': 'print/owner-cheat-sheet.es.html',
     'title': 'Hoja de ayuda de Wise Acres (para imprimir)', 'farm': 'Wise Acres Organic Farm',
     'bar': 'Una hoja, por los dos lados. Impriman en papel carta o A4, o elijan Guardar como PDF.', 'button': 'Imprimir la hoja',
     'stop': 'Notas para el equipo', 'side': ['Frente', 'Dorso'],
     'tag': 'Cada paso se hizo a mano en una copia de práctica del sitio el 4 de octubre de 2026. Las fechas son ejemplos: usen las suyas.'},
]
SPLIT_AFTER_JOB = 5      # the front holds the start, box T and jobs 1 to 5; the back holds jobs 6 to 12

CSS = '''@font-face{font-family:"Fredoka";src:url("../assets/fonts/fredoka-latin-wght-normal.woff2") format("woff2");font-weight:300 700}
@font-face{font-family:"Nunito";src:url("../assets/fonts/nunito-latin-wght-normal.woff2") format("woff2");font-weight:200 1000}
@page{margin:.25in}
*{box-sizing:border-box}
body{margin:0;background:#f4efe3;color:#3a2416;font:500 15px/1.4 "Nunito",system-ui,sans-serif}
.bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;padding:12px 16px;background:#3a2416;color:#fff}
.bar a{color:#ffc928;font-weight:700}
.bar button{font:700 1rem "Fredoka",system-ui,sans-serif;padding:.5em 1.2em;border:0;border-radius:999px;background:#ffc928;color:#3a2416;cursor:pointer}
.side{width:8in;max-width:calc(100% - 24px);margin:18px auto;padding:.3in .35in;background:#fff;border:2px solid #3a2416;border-radius:16px;columns:2 3.2in;column-gap:.25in;column-fill:balance}
.head{column-span:all;margin:0 0 .12in}
h1{margin:0;font:700 1.7em/1.1 "Fredoka",system-ui,sans-serif}
.farm{margin:0 0 .15em;font:700 .8em "Fredoka",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d72a43}
.tag{margin:.3em 0 0;color:#6a5140;font-size:.85em}
.job{break-inside:avoid;margin:0 0 .09in}
h2{margin:0 0 .2em;padding:.1em .5em;font:700 1.02em/1.25 "Fredoka",system-ui,sans-serif;background:#3a2416;color:#fff;border-radius:7px}
ol,ul{margin:0;padding-left:1.4em}
li{margin:0 0 .12em}
p{margin:0 0 .3em}
code{font:600 .86em ui-monospace,Menlo,Consolas,monospace;background:#f4efe3;border-radius:3px;padding:0 .15em;overflow-wrap:break-word;overflow-wrap:anywhere}
.foot{column-span:all;margin:.1in 0 0;text-align:center;color:#6a5140;font-size:.8em}
@media (max-width:560px){.side{columns:1;padding:.2in .15in}}
@media print{body{background:#fff;font-size:7.7pt;line-height:1.2}.bar{display:none}.side{width:auto;max-width:none;margin:0;padding:0;border:0;border-radius:0;break-after:page;page-break-after:always}.side:last-of-type{break-after:auto;page-break-after:auto}h2{-webkit-print-color-adjust:exact;print-color-adjust:exact}code{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'''


def inline(text):
    """The few things the notes use inside a line: `code`, **bold**, *italic*, [text](link) (a link prints as its text)."""
    parts = re.split(r'(`[^`]*`)', text)
    out = []
    for part in parts:
        if part.startswith('`') and part.endswith('`') and len(part) >= 2:
            out.append('<code>%s</code>' % html.escape(part[1:-1], quote=False))
            continue
        part = html.escape(part, quote=False)
        part = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', part)
        part = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', part)
        part = re.sub(r'(?<![\w*])\*([^*]+)\*(?![\w*])', r'<em>\1</em>', part)
        out.append(part)
    return ''.join(out)


def blocks(lines):
    """Lines of one section -> HTML: paragraphs, one bullet list or one numbered list."""
    html_out, para, items, kind = [], [], [], None

    def flush():
        nonlocal para, items, kind
        if para:
            html_out.append('<p>%s</p>' % inline(' '.join(para)))
        if items:
            tag = 'ol' if kind == 'num' else 'ul'
            html_out.append('<%s>%s</%s>' % (tag, ''.join('<li>%s</li>' % inline(i) for i in items), tag))
        para, items, kind = [], [], None

    for line in lines:
        m_num, m_li = re.match(r'^\d+\. (.*)$', line), re.match(r'^- (.*)$', line)
        if not line.strip():
            flush()
        elif m_num or m_li:
            k = 'num' if m_num else 'li'
            if para or (kind and kind != k):
                flush()
            kind = k
            items.append((m_num or m_li).group(1))
        elif items and line.startswith('  '):
            items[-1] += ' ' + line.strip()
        else:
            if items:
                flush()
            para.append(line.strip())
    flush()
    return '\n'.join(html_out)


def read_sections(cfg):
    """The note -> (title, [(heading, [lines])]), without anything before the title and without the part that is not printed."""
    with open(os.path.join(ROOT, cfg['md']), encoding='utf-8') as f:
        lines = f.read().split('\n')
    start = next(i for i, l in enumerate(lines) if l.startswith('# '))
    title = lines[start][2:].strip()
    sections, current = [], None
    for line in lines[start + 1:]:
        if line.startswith('## '):
            heading = line[3:].strip()
            if heading.startswith(cfg['stop']):
                break
            current = (heading, [])
            sections.append(current)
        elif current is not None:
            current[1].append(line)
    return title, sections


def make_page(cfg):
    title, sections = read_sections(cfg)
    sides, current = [], []
    for heading, lines in sections:
        current.append((heading, lines))
        m = re.match(r'^(\d+)\. ', heading)
        if m and int(m.group(1)) == SPLIT_AFTER_JOB:
            sides.append(current)
            current = []
    if current:
        sides.append(current)
    body = []
    for n, side in enumerate(sides):
        out = ['  <div class="side" id="side-%d">' % (n + 1)]
        if n == 0:
            out.append('    <div class="head"><p class="farm">%s</p><h1>%s</h1><p class="tag">%s</p></div>' % (html.escape(cfg['farm']), inline(title), html.escape(cfg['tag'])))
        for heading, lines in side:
            m = re.match(r'^(\d+)\. ', heading)
            ident = 'job-%s' % m.group(1) if m else ('box-' + heading.split('.')[0].lower() if re.match(r'^[A-Z]\. ', heading) else 'start')
            out.append('    <section class="job" id="%s"><h2>%s</h2>\n%s\n    </section>' % (ident, inline(heading), blocks(lines)))
        out.append('    <p class="foot">%s %d / %d</p>' % (html.escape(cfg['side'][min(n, len(cfg['side']) - 1)]), n + 1, len(sides)))
        out.append('  </div>')
        body.append('\n'.join(out))
    return ('<!doctype html>\n<html lang="%s">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '  <meta name="color-scheme" content="only light">\n  <meta name="robots" content="noindex">\n  <title>%s</title>\n'
            '  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">\n  <style>\n%s\n</style>\n</head>\n<body>\n'
            '  <div class="bar"><span>%s</span><button type="button" onclick="window.print()">%s</button></div>\n%s\n</body>\n</html>\n'
            % (cfg['lang'], html.escape(cfg['title']), CSS, html.escape(cfg['bar']), html.escape(cfg['button']), '\n'.join(body)))


def main(argv):
    if any(a in ('-h', '--help') for a in argv):
        print(__doc__)
        return 0
    unknown = [a for a in argv if a != '--check']
    if unknown:
        print('Not understood: %s. Use  python3 tools/make_cheat_sheet.py  or  python3 tools/make_cheat_sheet.py --check' % ' '.join(unknown))
        return 2
    check = '--check' in argv
    stale = 0
    for cfg in SHEETS:
        try:
            page = make_page(cfg)
        except FileNotFoundError:
            print('%s is missing, so %s was not made.' % (cfg['md'], cfg['out']))
            return 1
        path = os.path.join(ROOT, cfg['out'])
        have = open(path, encoding='utf-8', newline='').read() if os.path.exists(path) else None
        if check:
            if have != page:
                stale += 1
                print('%s is out of date: run  python3 tools/make_cheat_sheet.py' % cfg['out'])
        else:
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(page)
            print('%s: %s (from %s)' % ('written' if have != page else 'unchanged', cfg['out'], cfg['md']))
    if check and not stale:
        print('Both printed pages are current.')
    return 1 if stale else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
