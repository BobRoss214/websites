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

Change SITE below if the website is published somewhere other than wiseacresorganic.com.
"""
import html, json, os, re, struct, sys
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.wiseacresorganic.com/'
OG_IMAGE = 'assets/og-share.png'

PAGES_DIR = os.path.join(ROOT, 'pages')


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

{c['sprite']}

  {chr(10).join('  ' + s for s in scripts).strip()}
</body>
</html>
'''
    return doc


def main():
    c = chrome()
    slugs = []
    for f in sorted(os.listdir(PAGES_DIR)):
        if not f.endswith('.html'):
            continue
        slug = f[:-5]
        if not re.fullmatch(r'[a-z0-9-]+', slug):
            sys.exit(f'pages/{f}: a page file name may only use small letters, numbers and dashes (it becomes the web address and goes into sitemap.xml).')
        meta, body = parse_source(os.path.join(PAGES_DIR, f))
        out = compose(c, slug, meta, body)
        open(os.path.join(ROOT, slug + '.html'), 'w', encoding='utf-8').write(out)
        slugs.append(slug)
        print('wrote', slug + '.html')
    urls = [SITE] + [SITE + s + '.html' for s in slugs]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>\n'
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write(sm)
    open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8').write(f'User-agent: *\nAllow: /\nDisallow: /print/\nDisallow: /tests/\nDisallow: /docs/\n\nSitemap: {SITE}sitemap.xml\n')
    print('wrote sitemap.xml, robots.txt')


if __name__ == '__main__':
    main()
