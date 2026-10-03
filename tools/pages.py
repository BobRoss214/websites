#!/usr/bin/env python3
"""Builds the extra pages (first visit, pumpkin patch, strawberry picking, school field trips, Wise Pie)
from the short page sources in pages/ and the header, footer and icons of index.html.

  python3 tools/pages.py            write the pages, sitemap.xml and robots.txt
  python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build     (full rebuild)

Each source in pages/<slug>.html starts with a small block of settings between --- lines:

  ---
  title: Page title for Google and the browser tab
  description: One or two sentences for search results
  crumb: Short name for the breadcrumb (not used today: the pages have no visible breadcrumb trail; see compose())
  image: assets/og-pumpkin-patch.png       (optional: this page's own share picture, 1200 x 630; without it the page uses assets/og-share.png)
  image_alt: Illustration of ...           (needed when there is an image: what the picture shows, in one line; it is the only copy)
  ---
  <section>...the page itself...</section>

Only title, description, image and image_alt are used (crumb is kept for a future breadcrumb trail); any other line in the block is ignored.
The share picture's size is read from the file itself. The home page's picture and its description live in index.html (og:image, og:image:alt).
The farm map's scripts (js/map-art.js, js/farm-map-data.js) are added only to a page whose source contains data-farm-map.

To keep the pages light for slow phones this also writes, from the same sources:
  - js/footer-art.js   the few lines of js/hero.js that draw the footer's row of crops (generated: edit js/hero.js, not this file). The extra pages load it instead
                       of the whole hero engine, which they do not use (they have no hero picture). The home page loads js/hero.js, as before.
  - the icon sprite    each extra page gets only the drawings (<symbol>s) it uses: the ones its HTML points at, the icons the scripts draw, the footer art,
                       and (on a page with the farm map) the map's drawings. The home page keeps the whole sprite: it is the one source copy.
                       tests/pipeline.test.mjs and tests/sprite.test.mjs check that every drawing a page points at is in that page.

Change SITE below if the website is published somewhere other than wiseacresorganic.com.
"""
import html, json, os, re, struct, sys
try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit('This needs the beautifulsoup4 package. Type this once, then run the command again:\n'
             '    python3 -m pip install beautifulsoup4\n'
             '(On Windows type python instead of python3. See "Commands: one-time setup" in README.md.)')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.wiseacresorganic.com/'
OG_IMAGE = 'assets/og-share.png'

PAGES_DIR = os.path.join(ROOT, 'pages')
JS_DIR = os.path.join(ROOT, 'js')
CSS_DIR = os.path.join(ROOT, 'css')
FOOTER_ART = 'js/footer-art.js'

# The top-level names of js/hero.js that the footer art needs (see footerArt() there), in no particular order: the code is taken from hero.js in its own order.
# If footerArt() ever uses another helper of hero.js, add its name here: tests/sprite.test.mjs fails (the footer art of an extra page no longer matches the home page's) until you do.
FOOTER_PARTS = ['W', 'doc', '$', '$$', 'rand', 'INK', 'f1', 'use', 'sunflower', 'pickable', 'blades', 'blueBerry', 'BUSH_RIPE', 'BUSH_GREEN', 'bush',
                'leafUse', 'bale', 'corn', 'snowman', 'footerEl', 'footerArt', 'applyOnly']
# What hero.js does on a page without the hero picture (its last lines): the footer art, and the season's lines and buttons.
FOOTER_TAIL = ["    const id = W.seasons.active || W.seasons.current();", "    applyOnly(id);", "    if (footerEl) footerEl.innerHTML = footerArt(id);"]


def image_size(rel):
    """(width, height) of a PNG or JPEG file in the site folder, read from its first bytes, or None when it cannot be read."""
    try:
        with open(os.path.join(ROOT, rel), 'rb') as f:
            data = f.read(65536)
    except OSError:
        return None
    if data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR':
        return struct.unpack('>II', data[16:24])
    if data[:2] == b'\xff\xd8':          # JPEG: walk the blocks until the "start of frame" one
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            length = struct.unpack('>H', data[i + 2:i + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack('>HH', data[i + 5:i + 9])
                return w, h
            i += 2 + length
    return None


def share_picture(c, slug, meta):
    """The page's own share picture (image: and image_alt: in its settings block), else the home page's.
    Returns (path, description ready to put inside a tag, (width, height) or None)."""
    rel = meta.get('image') or OG_IMAGE
    alt = html.escape(meta['image_alt'], quote=True) if meta.get('image_alt') else (c['og_alt'] if rel == OG_IMAGE else '')   # c['og_alt'] is already escaped (it is copied from index.html)
    if rel != OG_IMAGE and not os.path.exists(os.path.join(ROOT, rel)):
        sys.exit(f'pages/{slug}.html: image: {rel} is not in the site folder. Put the picture there, or take the image: line out to use {OG_IMAGE}.')
    if not alt:
        sys.exit(f'pages/{slug}.html: it has image: {rel} but no image_alt: line. Add one line saying only what the picture shows (it is read aloud and shown when the picture cannot load).')
    return rel, alt, image_size(rel)


def strip_i18n(s):
    return re.sub(r'\sdata-(?:t|ta-[a-z-]+)="t[0-9a-f]{8}"', '', s)


def chrome():
    try:
        return _chrome()
    except (AttributeError, ValueError):
        sys.exit('index.html is missing a part that tools/pages.py copies into every extra page: the <head> (with its og:image:alt tag), the skip link, the announcement bar, '
                 '<header class="site-header">, <div class="footer-field"> ... </footer>, <nav class="action-bar">, the icon sprite or the <script src="js/..."> tags. '
                 'Put it back the way it was, then run this again. Nothing was changed.')


def _chrome():
    src = strip_i18n(open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read())
    head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
    og_alt = re.search(r'<meta property="og:image:alt" content="([^"]*)">', head).group(1)   # the share picture's description: one copy, in index.html
    skip = re.search(r'\s*<a class="skip-link"[^>]*>.*?</a>', src, re.S).group(0).strip()
    announce = re.search(r'<div class="announce"[^>]*>.*?</div>\s*', src, re.S).group(0).strip()
    header = re.search(r'<header class="site-header".*?</header>', src, re.S).group(0)
    footer = src[src.index('<div class="footer-field"'):src.index('</footer>') + len('</footer>')]
    action = re.search(r'<nav class="action-bar".*?</nav>', src, re.S).group(0)
    sprite = src[src.index('<svg xmlns="http://www.w3.org/2000/svg" id="sprite"'):src.index('  <script src="js/main.js">')].rstrip()
    scripts = re.findall(r'<script src="js/[^"]+"></script>', src[src.index('</svg>\n\n  <script src="js/main.js">'):])

    def to_home(s):
        s = s.replace('href="#top"', 'href="index.html"')
        return re.sub(r'(?<!<use )href="#(?!main")', 'href="index.html#', s)   # not icons: <use href="#i-arrow"> must stay local to the page's own sprite
    return dict(head=head, og_alt=og_alt, skip=skip, announce=to_home(announce), header=to_home(header), footer=to_home(footer), action=to_home(action), sprite=sprite, scripts=scripts)


def parse_source(path):
    name = os.path.basename(path)
    raw = open(path, encoding='utf-8-sig').read()   # utf-8-sig: Windows editors add an invisible marker at the start
    m = re.match(r'\s*---[ \t]*\n(.*?)\n---[ \t]*\n', raw, re.S)
    if not m:
        sys.exit(f'pages/{name}: it must start with a block of settings between two lines of ---  (title: ..., description: ...). See the top of tools/pages.py.')
    meta = {}
    for line in m.group(1).splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip()] = v.strip()
    missing = [k for k in ('title', 'description') if not meta.get(k)]
    if missing:
        sys.exit(f'pages/{name}: the settings block is missing: {", ".join(missing)}.')
    return meta, raw[m.end():].strip() + '\n'


def sentence(text):
    """A list item has no full stop on the page, but run together in one answer it needs one: "...your visit If you cancel..." becomes "...your visit. If you cancel..."."""
    return text if re.search(r'[.!?\u2026:;)"\u201d\u2019]$', text) else text + '.'


def faq_items(body):
    soup = BeautifulSoup(body, 'html.parser')
    out = []
    for d in soup.select('[data-faq] details'):
        q = d.find('summary').get_text(' ', strip=True)
        a = ' '.join(sentence(x.get_text(' ', strip=True)) for x in d.select('.answer p, .answer li') if x.get_text(strip=True))
        if q and a:
            out.append({'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}})
    return out


def hero_statements(src):
    """js/hero.js inside its (() => { ... })(): a list of top-level pieces; a comment belongs to the piece after it."""
    lines = src.split('\n')
    start = next(i for i, l in enumerate(lines) if l.startswith('(() => {'))
    end = max(i for i, l in enumerate(lines) if l.startswith('})();'))
    pieces, cur = [], None
    for l in lines[start + 1:end]:
        top = l.startswith('  ') and not l.startswith('   ') and l.strip() != ''
        if top and not re.match(r'^  [\}\)\]\.\+`]', l):
            if cur is not None and all(re.match(r'^\s*(//|/\*|\*|\*/|$)', x) for x in cur):
                cur.append(l)     # the comment lines above belong to this piece
            else:
                cur = [l]
                pieces.append(cur)
        elif cur is None:
            cur = [l]
            pieces.append(cur)
        else:
            cur.append(l)
    return pieces


def piece_names(piece):
    first = next((l for l in piece if re.match(r'^  (const|let|function)\b', l)), '')
    m = re.match(r'^  function\s+([A-Za-z_$][\w$]*)', first)
    if m:
        return [m.group(1)]
    m = re.match(r'^  (?:const|let)\s+([A-Za-z_$][\w$]*)', first)
    if not m:
        return []
    names = [m.group(1)]
    head = first.split('(')[0].split('=>')[0]
    if ',' in head:
        names += re.findall(r',\s*([A-Za-z_$][\w$]*)\s*=', head)
    return names


def footer_art_source():
    """The text of js/footer-art.js, taken from js/hero.js; None when js/hero.js is not there (a throw-away copy made for a test)."""
    path = os.path.join(ROOT, 'js', 'hero.js')
    if not os.path.exists(path):
        return None
    src = open(path, encoding='utf-8').read()
    try:
        pieces = hero_statements(src)
    except (StopIteration, ValueError):
        sys.exit('tools/pages.py could not read js/hero.js to make js/footer-art.js (it expects the file to be one (() => { ... })(); block). Nothing was changed.')
    where = {}
    for i, pc in enumerate(pieces):
        for n in piece_names(pc):
            where.setdefault(n, i)
    lost = [n for n in FOOTER_PARTS if n not in where]
    if lost:
        sys.exit('tools/pages.py: js/hero.js no longer has ' + ', '.join(lost) + ', which the footer art needs (FOOTER_PARTS at the top of tools/pages.py). Nothing was changed.')
    if not all(t.strip() in src for t in FOOTER_TAIL):
        sys.exit('tools/pages.py: the last lines of js/hero.js (what a page without the hero does) are not what FOOTER_TAIL in tools/pages.py says. Update FOOTER_TAIL. Nothing was changed.')
    out = []
    for i in sorted({where[n] for n in FOOTER_PARTS}):
        out.append('\n'.join(pieces[i]).rstrip('\n'))
        if 'W' in piece_names(pieces[i]):
            out.append("  if (!W || !W.seasons) return;")
    body = '\n\n'.join(out)
    return ("/* Wise Acres: the footer art, for the pages that have no hero picture.\n"
            " * GENERATED by tools/pages.py from js/hero.js (the same code, only the parts the footer needs). Do not edit this file: edit js/hero.js and run\n"
            " *   python3 tools/pages.py\n"
            " * The home page loads js/hero.js instead. */\n"
            "(() => {\n  'use strict';\n\n" + body + "\n\n"
            "  /* ------------------------------------------------------------------ */\n"
            "  {\n" + '\n'.join(FOOTER_TAIL) + "\n  }\n})();\n")


def top_elements(txt):
    """The elements at the top level of txt, each as its own text (comments and the white space between them are left out)."""
    out, depth, start = [], 0, 0
    for m in re.finditer(r'<!--.*?-->|<(/?)([A-Za-z][\w:-]*)\b[^>]*?(/?)>', txt, re.S):
        if m.group(0).startswith('<!--'):
            continue
        if m.group(1):
            depth -= 1
            if depth == 0:
                out.append(txt[start:m.end()])
        else:
            if depth == 0:
                start = m.start()
            if m.group(3):
                if depth == 0:
                    out.append(txt[start:m.end()])
            else:
                depth += 1
    return out


def split_sprite(sprite):
    """(head, units): the <svg ...> tag, and every drawing in it (the parts of <defs> and the elements after it) as
    (in <defs>?, ids it contains, its text, ids it points at)."""
    head = sprite[:sprite.index('>') + 1]
    inner = sprite[len(head):sprite.rindex('</svg>')]
    units = []
    for el in top_elements(inner):
        children = top_elements(el[el.index('>') + 1:el.rindex('</defs>')]) if el.startswith('<defs') else [el]
        for t in children:
            units.append((el.startswith('<defs'), re.findall(r'\bid="([^"]+)"', t), t.strip(), set(re.findall(r'href="#([^"]+)"', t)) | set(re.findall(r'url\(#([^)]+)\)', t))))
    return head, units


def sprite_subset(sprite, need):
    """The sprite with only the drawings in `need` (and the drawings those use). The whole sprite when there is nothing to leave out."""
    head, units = split_sprite(sprite)
    owner = {i: k for k, u in enumerate(units) for i in u[1]}
    keep, todo = set(), [owner[i] for i in need if i in owner]
    while todo:
        k = todo.pop()
        if k in keep:
            continue
        keep.add(k)
        todo += [owner[i] for i in units[k][3] if i in owner]
    if len(keep) == len(units):
        return sprite
    d = ''.join('    ' + u[2] + '\n' for k, u in enumerate(units) if k in keep and u[0])
    o = ''.join('  ' + u[2] + '\n' for k, u in enumerate(units) if k in keep and not u[0])
    return head + '\n  <defs>\n' + d + '  </defs>\n\n' + o + '</svg>'


def js_icons(sprite, scripts, has_map):
    """The drawings JavaScript puts on an extra page that are not in its HTML: the icons (i-...) any script may add, the footer art's drawings, and on a page with
    the farm map everything the map and its legend draw. (The other drawings named in main.js, features.js and hero.js belong to parts of the home page
    that an extra page does not have; tests/sprite.test.mjs opens every page in every language and season and checks that nothing is missing.)"""
    ids = set(re.findall(r'\bid="([^"]+)"', sprite))
    found = set()
    for src in scripts:
        name = re.search(r'js/([^"]+)"', src).group(1)
        path = os.path.join(JS_DIR, name)
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8').read()
        words = set(re.findall(r"""['"`#(]([A-Za-z][\w-]*)""", text))
        every = name in ('footer-art.js', 'map-art.js', 'farm-map-data.js') or (has_map and name == 'features.js')
        found |= {w for w in words if w in ids and (every or w.startswith('i-'))}
    return found


def css_ids():
    out = set()
    if os.path.isdir(CSS_DIR):
        for f in os.listdir(CSS_DIR):
            if f.endswith('.css'):
                out |= set(re.findall(r'url\(\s*["\']?#([^)"\']+)', open(os.path.join(CSS_DIR, f), encoding='utf-8').read()))
    return out


def compose(c, slug, meta, body):
    url = SITE + slug + '.html'
    title, desc = meta['title'], meta['description']
    image_rel, image_alt, image_dims = share_picture(c, slug, meta)
    image = SITE + image_rel
    head = c['head']
    head = re.sub(r'<title>.*?</title>', f'<title>{html.escape(title)}</title>', head, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(desc, quote=True)}">', head)
    head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{html.escape(title, quote=True)}">', head)
    head = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{html.escape(desc, quote=True)}">', head)
    head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
    head = re.sub(r'\s*<(?:link rel="canonical"|meta property="og:(?:url|image(?::[a-z]+)?)"|meta name="twitter:(?:card|image(?::alt)?)")[^>]*>', '', head)
    # The Search Console tag belongs on the home page only (see README), so do not copy its placeholder comment or a pasted tag.
    head = re.sub(r'\s*<!-- GOOGLE SEARCH CONSOLE.*?-->', '', head, flags=re.S)
    head = re.sub(r'\s*<meta name="google-site-verification"[^>]*>', '', head)
    extra = (f'\n  <link rel="canonical" href="{url}">\n  <meta property="og:url" content="{url}">\n  <meta property="og:image" content="{image}">')
    if image_dims:
        extra += f'\n  <meta property="og:image:width" content="{image_dims[0]}">\n  <meta property="og:image:height" content="{image_dims[1]}">'
    extra += f'\n  <meta property="og:image:alt" content="{image_alt}">'
    extra += f'\n  <meta name="twitter:card" content="summary_large_image">\n  <meta name="twitter:image" content="{image}">\n  <meta name="twitter:image:alt" content="{image_alt}">'
    # No BreadcrumbList here on purpose: these pages have no visible breadcrumb trail, and structured data must match the page.
    # If you add a visible trail (Home > page), add the BreadcrumbList back using meta['crumb'].
    graph = [
        {'@type': 'WebPage', '@id': url, 'url': url, 'name': title, 'description': desc, 'isPartOf': {'@id': SITE + '#site'}, 'inLanguage': 'en-US'},
    ]
    faq = faq_items(body)
    if faq:
        graph.append({'@type': 'FAQPage', 'mainEntity': faq})
    ld = '\n  <script type="application/ld+json">\n' + json.dumps({'@context': 'https://schema.org', '@graph': graph}, indent=2, ensure_ascii=False).replace('<', '\\u003c') + '\n  </script>'
    # The farm map's drawing code and points are only loaded by a page that has a map (data-farm-map).
    scripts = [s for s in c['scripts'] if 'data-farm-map' in body or not re.search(r'js/(map-art|farm-map-data)\.js', s)]
    # A page without the hero picture does not need the hero engine, only its footer art (js/footer-art.js, written below by main()).
    if 'id="hero-scene"' not in body and os.path.exists(os.path.join(JS_DIR, 'hero.js')):
        scripts = [s.replace('js/hero.js', FOOTER_ART) for s in scripts]
    sprite = c['sprite']
    if os.path.isdir(JS_DIR):
        # Only the drawings this page uses. Everything the page's own HTML points at, what scripts draw into it, and what the style sheets point at.
        shown = '\n'.join([c['skip'], c['announce'], c['header'], body, c['footer'], c['action']])
        need = set(re.findall(r'<use\b[^>]*?\bhref="#([^"]+)"', shown)) | set(re.findall(r'url\(#([^)]+)\)', shown)) | css_ids()
        need |= js_icons(sprite, scripts, 'data-farm-map' in body)
        sprite = sprite_subset(sprite, need)
    doc = f'''<!doctype html>
<html lang="en" class="no-js">
<head>{head.rstrip()}{extra}{ld}
</head>
<body>
  {c['skip']}

  <!-- ================= ANNOUNCEMENT ================= -->
  {c['announce']}

  <!-- ================= HEADER ================= -->
  {c['header']}

  <main id="main" tabindex="-1">
{body}
  </main>

  {c['footer']}

  {c['action']}

{sprite}

  {chr(10).join('  ' + s for s in scripts).strip()}
</body>
</html>
'''
    return doc


def main():
    c = chrome()
    fa = footer_art_source()
    if fa is not None:
        open(os.path.join(ROOT, FOOTER_ART), 'w', encoding='utf-8', newline='\n').write(fa)
        print('wrote', FOOTER_ART)
    slugs = []
    for f in sorted(os.listdir(PAGES_DIR)):
        if not f.endswith('.html'):
            continue
        slug = f[:-5]
        if not re.fullmatch(r'[a-z0-9-]+', slug):
            sys.exit(f'pages/{f}: a page file name may only use small letters, numbers and dashes (it becomes the web address and goes into sitemap.xml).')
        meta, body = parse_source(os.path.join(PAGES_DIR, f))
        out = compose(c, slug, meta, body)
        open(os.path.join(ROOT, slug + '.html'), 'w', encoding='utf-8', newline='\n').write(out)
        slugs.append(slug)
        print('wrote', slug + '.html')
    urls = [SITE] + [SITE + s + '.html' for s in slugs]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>\n'
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8', newline='\n').write(sm)
    open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8', newline='\n').write(f'User-agent: *\nAllow: /\nDisallow: /print/\nDisallow: /tests/\nDisallow: /docs/\n\nSitemap: {SITE}sitemap.xml\n')
    print('wrote sitemap.xml, robots.txt')


if __name__ == '__main__':
    main()
