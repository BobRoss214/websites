#!/usr/bin/env python3
"""Makes QR codes and printable signs for the farm.

  python3 tools/make_qr.py            write assets/qr/*.svg, print/qr-signs.html and print/qr-signs.hi.html, .zh.html, .vi.html
  python3 tools/make_qr.py --check    also scan every code back and make sure it opens the right address

To change where a sign points, or what it says, edit tools/qr_links.json and run this again.
Open print/qr-signs.html in a browser and use Print (or "Save as PDF"): one sign per page, English and Spanish.
print/qr-signs.hi.html, .zh.html and .vi.html are the same signs in Hindi, Chinese and Vietnamese (the language big, English small underneath);
their wording is in the "languages" part at the end of tools/qr_links.json.

The Google review sign needs your review link first: put it in js/content.js as  reviewUrl: 'https://...'
Until then that sign is skipped (it says so below).

Needs:  pip install segno        (and for --check:  pip install zxing-cpp pillow)
"""
import html, io, json, os, re, sys
from urllib.parse import urlencode

try:
    import segno
except ImportError:
    sys.exit('This needs the segno package:  pip install segno')

# The languages of the site, as the site's own language button names them: (code, html lang, the language's own name, its name in English)
SITE_LANGS = [('en', 'en', 'English', 'English'), ('es', 'es', 'Español', 'Spanish'), ('hi', 'hi', 'हिन्दी', 'Hindi'),
              ('zh', 'zh-Hans', '中文', 'Chinese'), ('vi', 'vi', 'Tiếng Việt', 'Vietnamese')]
EXTRA = [l for l in SITE_LANGS if l[0] in ('hi', 'zh', 'vi')]      # the languages that get a sheet of their own
# Names that stay English inside a translated sentence (the site marks them the same way: <wa-en>, see js/i18n.js)
NAMES = re.compile(r'Wise Acres Organic Farm|Wise Acres|Wise Pie|The GreenHouse|Instagram|Facebook|Google|QR|@wiseacresorganic|#wiseacresorganic|\d{4} Hartis Road, Indian Trail, NC')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_QR = os.path.join(ROOT, 'assets', 'qr')
OUT_PRINT = os.path.join(ROOT, 'print')


def review_url():
    src = open(os.path.join(ROOT, 'js', 'content.js'), encoding='utf-8').read()
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)          # /* comments */
    src = re.sub(r'(?m)^\s*//.*$', '', src)                   # lines the owner switched off with //
    m = re.search(r"""^\s*reviewUrl:\s*(['"])(.*?)\1""", src, re.M)
    return m.group(2).strip() if m else ''


def load_config():
    """Reads tools/qr_links.json and stops with a plain message (not a Python error) when something is wrong."""
    path = os.path.join(ROOT, 'tools', 'qr_links.json')
    try:
        cfg = json.load(open(path, encoding='utf-8-sig'))
    except ValueError as e:
        sys.exit(f'tools/qr_links.json is not valid JSON ({e}). Check commas and quotes near that spot.')
    if not isinstance(cfg, dict) or not str(cfg.get('site', '')).startswith('https://'):
        sys.exit('tools/qr_links.json: "site" must be the website address starting with https://, for example "https://www.wiseacresorganic.com/".')
    cfg['site'] = cfg['site'].rstrip('/') + '/'          # "{site}index.html" needs exactly one slash
    signs = cfg.get('signs')
    if not isinstance(signs, list) or not signs:
        sys.exit('tools/qr_links.json: "signs" must be a list with at least one sign, so nothing was changed.')
    seen = set()
    for n, sign in enumerate(signs, 1):
        if not isinstance(sign, dict):
            sys.exit(f'tools/qr_links.json: sign number {n} is not a {{ ... }} block.')
        missing = [k for k in ('id', 'url', 'title_en', 'title_es', 'text_en', 'text_es') if not isinstance(sign.get(k), str)]
        if missing:
            sys.exit(f'tools/qr_links.json: sign number {n} ({sign.get("id", "no id")}) is missing: {", ".join(missing)}.')
        if not re.fullmatch(r'[a-z0-9-]+', sign['id']):
            sys.exit(f'tools/qr_links.json: the id "{sign["id"]}" may only use small letters, numbers and dashes.')
        if sign['id'] in seen:
            sys.exit(f'tools/qr_links.json: the id "{sign["id"]}" is used twice. Every sign needs its own id.')
        seen.add(sign['id'])
    langs = cfg.get('languages', {})
    if not isinstance(langs, dict):
        sys.exit('tools/qr_links.json: "languages" must be a { ... } block (Hindi, Chinese and Vietnamese wording), or left out.')
    for code, block in langs.items():
        if code not in [l[0] for l in EXTRA]:
            sys.exit(f'tools/qr_links.json: "languages" has "{code}", but only hi, zh and vi are known.')
        if not isinstance(block, dict) or not all(isinstance(block.get(k), str) and block[k].strip() for k in ('how', 'also')) or not isinstance(block.get('signs'), dict):
            sys.exit(f'tools/qr_links.json: the "{code}" part of "languages" needs "how", "also" and "signs".')
        for sign in signs:
            w = block['signs'].get(sign['id'])
            if not isinstance(w, dict) or not all(isinstance(w.get(k), str) and w[k].strip() for k in ('title', 'text')):
                sys.exit(f'tools/qr_links.json: the "{code}" wording for the sign "{sign["id"]}" needs a "title" and a "text" (or take the whole "{code}" part out).')
        stray = [i for i in block['signs'] if i not in seen]
        if stray:
            sys.exit(f'tools/qr_links.json: the "{code}" part has wording for {", ".join(stray)}, which is not a sign in the list.')
    return cfg


def resolve(sign, site, review):
    url = sign['url'].replace('{site}', site).replace('{reviewUrl}', review)
    if not url or not re.match(r'^https://', url):
        return None
    if sign.get('utm'):
        base, _, frag = url.partition('#')
        base += ('&' if '?' in base else '?') + urlencode({'utm_source': 'qr', 'utm_medium': 'sign', 'utm_campaign': sign['id']})
        url = base + ('#' + frag if frag else '')
    return url


def short(url):
    u = re.sub(r'^https://(www\.)?', '', url)
    u = re.sub(r'[?&]utm_[^&#]*', '', u)
    return u.rstrip('?&')


CSS = """
@font-face{font-family:"Fredoka";src:url("../assets/fonts/fredoka-latin-wght-normal.woff2") format("woff2");font-weight:300 700}
@font-face{font-family:"Nunito";src:url("../assets/fonts/nunito-latin-wght-normal.woff2") format("woff2");font-weight:200 1000}
@page{size:letter;margin:.4in}
*{box-sizing:border-box}
body{margin:0;background:#f4efe3;color:#3a2416;font:600 1.05rem/1.4 "Nunito",system-ui,sans-serif}
.bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;padding:12px 16px;background:#3a2416;color:#fff}
.bar button{font:700 1rem "Fredoka",system-ui,sans-serif;padding:.5em 1.2em;border:0;border-radius:999px;background:#ffc928;color:#3a2416;cursor:pointer}
.sign{width:7.7in;max-width:calc(100% - 24px);min-height:10.1in;margin:18px auto;padding:.45in .5in;display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff;border:8px solid #3a2416;border-radius:36px;box-shadow:0 10px 0 rgba(58,36,22,.25);page-break-after:always;break-after:page}
.sign:last-child{page-break-after:auto;break-after:auto}
.farm{margin:0;font:700 1.2rem "Fredoka",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d72a43}
h1{margin:.25em 0 0;font:700 3.2rem/1.05 "Fredoka",system-ui,sans-serif;text-wrap:balance}
h1 span{display:block;margin-top:.15em;font-size:2rem;color:#6a5140;font-weight:600}
.qr{margin:.3in 0 .2in;padding:.18in;background:#fff;border:6px solid #3a2416;border-radius:24px;line-height:0}
.qr{width:min(100%,calc(4.66in + 12px))}.qr svg{width:100%;height:auto}@media (max-width:560px){.sign{padding:.3in .2in}}
.how{margin:0 0 .15in;font:700 1.25rem "Fredoka",system-ui,sans-serif}
.how span,.text span,.also span{display:block;color:#6a5140;font-weight:600}
.text{margin:0;font-size:1.3rem}.also{margin:.12in 0 0;font-size:.95rem;color:#6a5140}
.url{margin:auto 0 0;padding-top:.2in;font:700 .95rem "Nunito",system-ui,sans-serif;color:#6a5140;overflow-wrap:anywhere}
@media print{body{background:#fff}.bar{display:none}.sign{width:auto;max-width:none;min-height:10in;margin:0;padding:.3in .4in;border-radius:28px;box-shadow:none}.qr{width:4.3in;margin:.15in 0 .12in}}
"""

# The sheets in another language: the language is big, English small underneath. Added after CSS, so these rules win.
LANG_CSS = """
.tr h1{font-size:2.9rem;line-height:1.3}
.tr h1 span{margin-top:.3em;font-size:1.3rem;line-height:1.3}
.tr .how{font-size:1.2rem;line-height:1.5}
.tr .text{font-size:1.5rem;line-height:1.5}
.tr .how span,.tr .text span{font-size:1rem;line-height:1.4}
.tr .also{font-size:1rem;line-height:1.5}
"""


def en_names(text):
    """Escapes the text and marks the names in it as English (<wa-en lang="en">) so a screen reader says them the English way."""
    return NAMES.sub(lambda m: '<wa-en lang="en">' + m.group(0) + '</wa-en>', html.escape(text))


def also_line(own, lead):
    """"This page is also in: <the other four languages>": the names are the site's own language button names."""
    names = ' · '.join(f'<bdi lang="{l[1]}">{l[2]}</bdi>' for l in SITE_LANGS if l[0] != own)
    return f'{lead} {names}'


def language_sheet(code, html_lang, name_en, block, done):
    """One sheet in Hindi, Chinese or Vietnamese: the language big, the English wording small underneath, the same codes."""
    pages = []
    for sign, url, raw in done:
        w = block['signs'][sign['id']]
        svg = raw.replace('<svg ', '<svg role="img" lang="en" aria-label="QR code: ' + html.escape(sign['title_en'], quote=True) + '" ', 1)
        also = ''
        if sign['url'].startswith('{site}'):
            also = f'\n    <p class="also" lang="{html_lang}">{also_line(code, html.escape(block["also"]))}</p>'
        # an address that is the same in both languages is printed once
        en_text = html.escape(sign['text_en'])
        small = '' if w['text'].strip() == sign['text_en'].strip() else f'<span lang="en">{en_text}</span>'
        pages.append(f'''  <section class="sign" id="{sign['id']}">
    <p class="farm">Wise Acres Organic Farm</p>
    <h1 lang="{html_lang}">{en_names(w['title'])}<span lang="en">{html.escape(sign['title_en'])}</span></h1>
    <div class="qr">{svg}</div>
    <p class="how" lang="{html_lang}">{en_names(block['how'])}<span lang="en">Point your phone camera at the square.</span></p>
    <p class="text" lang="{html_lang}">{en_names(w['text'])}{small}</p>{also}
    <p class="url">{html.escape(short(url))}</p>
  </section>''')
    return f'''<!doctype html>
<html lang="{html_lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="only light">
  <meta name="robots" content="noindex">
  <title>Wise Acres QR signs, {name_en} (print)</title>
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <style>{CSS}{LANG_CSS}</style>
</head>
<body class="tr">
  <div class="bar" lang="en"><span>One sign per page. Print on letter paper, or choose Save as PDF. Have a {name_en} speaker read the {name_en} first.</span><button type="button" onclick="window.print()">Print all signs</button></div>
{chr(10).join(pages)}
</body>
</html>
'''


def main():
    check = '--check' in sys.argv
    cfg = load_config()
    site, review = cfg['site'], review_url()
    os.makedirs(OUT_QR, exist_ok=True)
    os.makedirs(OUT_PRINT, exist_ok=True)
    pages, made, bad, done = [], 0, 0, []
    for sign in cfg['signs']:
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,40}', str(sign.get('id', ''))):
            print(f"skipped  {sign.get('id')!r}: a sign id may only use a-z, 0-9 and - (it becomes a file name)")
            continue
        url = resolve(sign, site, review)
        if not url:
            raw = sign['url'].replace('{site}', site).replace('{reviewUrl}', review).strip()
            why = ('no address yet' if not raw else 'the address must start with https://  (it is: ' + raw[:60] + ')')
            print(f"skipped  {sign['id']}: {why}" + (' (set reviewUrl in js/content.js, between the quotes)' if sign['id'] == 'review' else ''))
            continue
        try:
            qr = segno.make(url, error='m')
        except Exception:
            sys.exit(f"The address for the sign '{sign['id']}' is too long for a QR code ({len(url)} letters). Use a shorter link.")
        qr.save(os.path.join(OUT_QR, sign['id'] + '.svg'), scale=10, border=4, dark='#000000', light='#ffffff', xmldecl=False, svgns=True)
        raw = qr.svg_inline(scale=10, border=4, dark='#000000', light='#ffffff', svgclass=None, lineclass=None, omitsize=True)
        inline = raw.replace('<svg ', '<svg role="img" aria-label="QR code: ' + html.escape(sign['title_en'], quote=True) + '" ', 1)
        # the two signs that open this website: say the page is also in the other languages
        also = ''
        if sign['url'].startswith('{site}'):
            also = f'\n    <p class="also">{also_line("en", "This page is also in:")}<span lang="es">{also_line("es", "Esta página también está en:")}</span></p>'
        pages.append(f'''  <section class="sign" id="{sign['id']}">
    <p class="farm">Wise Acres Organic Farm</p>
    <h1>{html.escape(sign['title_en'])}<span lang="es">{html.escape(sign['title_es'])}</span></h1>
    <div class="qr">{inline}</div>
    <p class="how">Point your phone camera at the square.<span lang="es">Apunta la cámara de tu teléfono al cuadrado.</span></p>
    <p class="text">{html.escape(sign['text_en'])}<span lang="es">{html.escape(sign['text_es'])}</span></p>{also}
    <p class="url">{html.escape(short(url))}</p>
  </section>''')
        done.append((sign, url, raw))
        made += 1
        line = f"made     {sign['id']:<11} {url}"
        if check:
            try:
                import zxingcpp
                from PIL import Image
            except ImportError:
                sys.exit('--check needs:  pip install zxing-cpp pillow')
            buf = io.BytesIO()
            qr.save(buf, kind='png', scale=8, border=4)
            buf.seek(0)
            got = [r.text for r in zxingcpp.read_barcodes(Image.open(buf))]
            if got != [url]:
                bad += 1
                line += f'   CHECK FAILED, scanned: {got}'
            else:
                line += '   scans OK'
        print(line)
    if not made:
        sys.exit('No sign could be made (every address was empty or did not start with https://), so print/qr-signs.html was not changed.')
    doc = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="only light">
  <meta name="robots" content="noindex">
  <title>Wise Acres QR signs (print)</title>
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <style>{CSS}</style>
</head>
<body>
  <div class="bar"><span>One sign per page. Print on letter paper, or choose Save as PDF. Have a Spanish speaker read the Spanish first.</span><button type="button" onclick="window.print()">Print all signs</button></div>
{chr(10).join(pages)}
</body>
</html>
'''
    open(os.path.join(OUT_PRINT, 'qr-signs.html'), 'w', encoding='utf-8', newline='\n').write(doc)
    print(f'\n{made} signs -> print/qr-signs.html, codes in assets/qr/')
    for code, html_lang, own, name_en in EXTRA:
        block = cfg.get('languages', {}).get(code)
        path = os.path.join(OUT_PRINT, f'qr-signs.{code}.html')
        if not block:
            print(f'no {name_en} wording in tools/qr_links.json, so print/qr-signs.{code}.html was not made' + (' (the old file is still there)' if os.path.exists(path) else ''))
            continue
        open(path, 'w', encoding='utf-8', newline='\n').write(language_sheet(code, html_lang, name_en, block, done))
        print(f'{made} signs -> print/qr-signs.{code}.html ({name_en}, English small underneath)')
    if bad:
        sys.exit(f'{bad} code(s) did not scan back correctly')


if __name__ == '__main__':
    main()
