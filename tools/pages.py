#!/usr/bin/env python3
"""Builds the extra pages (first visit, pumpkin patch, strawberry picking, school field trips, Wise Pie)
from the short page sources in pages/ and the header, footer and icons of index.html.

  python3 tools/pages.py            write the pages and sitemap.xml
  python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build     (full rebuild)

Each source in pages/<slug>.html starts with a small block of settings between --- lines:

  ---
  title: Page title for Google and the browser tab
  description: One or two sentences for search results
  crumb: Short name for the breadcrumb (only used if you add a visible breadcrumb trail; see compose())
  schema: LocalBusiness            (optional extra schema.org type: Event is NOT used, dates change)
  image: assets/og-share.png       (optional)
  ---
  <section>...the page itself...</section>

Change SITE below if the website is published somewhere other than wiseacresorganic.com.
"""
import html, json, os, re, sys
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.wiseacresorganic.com/'
OG_IMAGE = 'assets/og-share.png'
OG_IMAGE_ALT = 'Illustration of a fall farm: a tractor pulling a wagon of children past a pumpkin patch, a red barn and a scarecrow, with the words Welcome to Wise Acres! Organic u-pick fun for the whole family'   # keep identical to og:image:alt in index.html

PAGES_DIR = os.path.join(ROOT, 'pages')


def strip_i18n(s):
    return re.sub(r'\sdata-(?:t|ta-[a-z-]+)="t[0-9a-f]{8}"', '', s)


def chrome():
    try:
        return _chrome()
    except (AttributeError, ValueError):
        sys.exit('index.html is missing a part that tools/pages.py copies into every extra page: the <head>, the skip link, the announcement bar, '
                 '<header class="site-header">, <div class="footer-field"> ... </footer>, <nav class="action-bar">, the icon sprite or the <script src="js/..."> tags. '
                 'Put it back the way it was, then run this again. Nothing was changed.')


def _chrome():
    src = strip_i18n(open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read())
    head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
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
    return dict(head=head, skip=skip, announce=to_home(announce), header=to_home(header), footer=to_home(footer), action=to_home(action), sprite=sprite, scripts=scripts)


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


def faq_items(body):
    soup = BeautifulSoup(body, 'html.parser')
    out = []
    for d in soup.select('[data-faq] details'):
        q = d.find('summary').get_text(' ', strip=True)
        a = ' '.join(x.get_text(' ', strip=True) for x in d.select('.answer p, .answer li'))
        if q and a:
            out.append({'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}})
    return out


def compose(c, slug, meta, body):
    url = SITE + slug + '.html'
    title, desc = meta['title'], meta['description']
    image = SITE + meta.get('image', OG_IMAGE)
    head = c['head']
    head = re.sub(r'<title>.*?</title>', f'<title>{html.escape(title)}</title>', head, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(desc, quote=True)}">', head)
    head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{html.escape(title, quote=True)}">', head)
    head = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{html.escape(desc, quote=True)}">', head)
    head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
    head = re.sub(r'\s*<(?:link rel="canonical"|meta property="og:(?:url|image(?::[a-z]+)?)"|meta name="twitter:(?:card|image:alt)")[^>]*>', '', head)
    # The Search Console tag belongs on the home page only (see README), so do not copy its placeholder comment or a pasted tag.
    head = re.sub(r'\s*<!-- GOOGLE SEARCH CONSOLE.*?-->', '', head, flags=re.S)
    head = re.sub(r'\s*<meta name="google-site-verification"[^>]*>', '', head)
    extra = (f'\n  <link rel="canonical" href="{url}">\n  <meta property="og:url" content="{url}">\n  <meta property="og:image" content="{image}">')
    if image == SITE + OG_IMAGE:   # width, height and description are for the default share picture only
        extra += (f'\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">'
                  f'\n  <meta property="og:image:alt" content="{OG_IMAGE_ALT}">')
    extra += '\n  <meta name="twitter:card" content="summary_large_image">'
    if image == SITE + OG_IMAGE:
        extra += f'\n  <meta name="twitter:image:alt" content="{OG_IMAGE_ALT}">'
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
    open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8').write(f'User-agent: *\nAllow: /\nDisallow: /print/\n\nSitemap: {SITE}sitemap.xml\n')
    print('wrote sitemap.xml, robots.txt')


if __name__ == '__main__':
    main()
