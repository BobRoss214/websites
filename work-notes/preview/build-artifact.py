import re, base64, os, glob
SC = '/tmp/claude-0/-home-user-websites/0370289f-5c48-5314-b3f5-bb8be7afd39d/scratchpad'
R = '/home/user/websites/'
OUT = SC + '/artifact/'
PAGES = ['first-visit', 'pumpkin-patch', 'strawberry-picking', 'school-field-trips', 'wise-pie']


def read(p):
    return open(R + p, encoding='utf-8').read()


def font(m):
    b = base64.b64encode(open(R + 'assets/fonts/' + m.group(1), 'rb').read()).decode()
    return 'url("data:font/woff2;base64,' + b + '")'


css = '\n'.join(read('css/' + f) for f in ('styles.css', 'sections.css', 'hero.css', 'extras.css', 'features.css'))
css = re.sub(r'url\("\.\./assets/fonts/([^"]+)"\)', font, css)
css = css.replace('.site-header{position:sticky;top:0;', '.site-header{position:sticky;top:env(safe-area-inset-top,0px);')
css = css.replace('position:fixed;left:8px;right:8px;bottom:8px;', 'position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));')

dicts = '\n'.join(read('lang/%s.js' % c) for c in ('es', 'hi', 'zh', 'vi'))

# Preview-only extras. They are NOT in the real site: the signup form works in "demo" mode, and example
# weekly spots + an example farm map are shown, each clearly labelled as an example.
PREVIEW = r'''
// The preview runs in a frame from another origin. There the browser ignores `rootMargin` for an observer that has no root, so the
// menu highlight (it watches a band in the middle of the screen), the fade-ins and the farm-map pre-drawing all behave differently from
// the real page: the highlight goes to whichever section edge came into view last (Tomatoes when you click Pizza). Naming the document
// as the root brings the margins back (same result as on the real site). An old browser that cannot do it is left alone.
(function () {
  var Native = window.IntersectionObserver;
  if (!Native || Native.__waRoot) return;
  try { new Native(function () {}, { root: document }).disconnect(); } catch (e) { return; }
  function Observer(callback, options) {
    var o = {}, k;
    if (options) for (k in options) o[k] = options[k];
    if (!o.root) o.root = document;
    return new Native(callback, o);
  }
  Observer.prototype = Native.prototype; Observer.__waRoot = true;
  window.IntersectionObserver = Observer;
})();
(function () {
  var W = window.WISE_ACRES;
  function ymd(n) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() + n * 864e5)); }
  W.signup = W.signup || {}; W.signup.demo = true;
  // the preview viewer blocks plain downloads, so calendar files go through its own save dialog
  W.saveFile = function (name, blob) { try { window.claude.use('downloads').then(function (d) { if (d) d.save({ filename: name, data: blob }).catch(function () {}); }); } catch (e) {} };
  W.week = { demo: true, updated: ymd(0), note: 'Example note: this is where you tell families what is ripe this week.', crops: { tomatoes: 'peak', pumpkins: 'starting' },
    days: [ { date: ymd(1), farm: 'few', pizza: 'open', note: 'Example' }, { date: ymd(2), farm: 'full', pizza: 'full' }, { date: ymd(3), farm: 'closed', pizza: 'none' } ] };
})();
'''
DEMO_MAP = r'''
window.WISE_ACRES_MAP = { demo: true, size: { width: 380, height: 587 }, north: 'up', items: [
 { id: 'd1', type: 'area', kind: 'parking', label: 'Parking', note: 'Example note: what you type in the Farm Map Marker shows up here.', pts: [[205,300],[290,300],[290,365],[205,365]] },
 { id: 'd2', type: 'area', kind: 'strawberries', label: 'Strawberries', pts: [[110,425],[300,425],[300,520],[110,520]] },
 { id: 'd3', type: 'area', kind: 'pumpkins', label: 'Pumpkins', pts: [[40,330],[180,330],[180,400],[40,400]] },
 { id: 'd4', type: 'area', kind: 'maze', label: 'Corn maze', pts: [[215,190],[330,190],[330,265],[215,265]] },
 { id: 'd5', type: 'path', kind: 'road', label: 'Hartis Road', pts: [[0,560],[120,540],[260,550],[380,530]] },
 { id: 'd6', type: 'path', kind: 'wagonroute', label: 'Wagon ride route', arrow: true, pts: [[120,300],[130,250],[180,225],[240,235]] },
 { id: 'd7', type: 'pin', kind: 'checkin', label: 'Check-in', pts: [[170,292]] },
 { id: 'd8', type: 'pin', kind: 'entrance', label: 'Entrance or gate', pts: [[100,545]] },
 { id: 'd9', type: 'pin', kind: 'restrooms', label: 'Restrooms', pts: [[250,395]] },
 { id: 'd10', type: 'pin', kind: 'playground', label: 'Playground', pts: [[330,330]] },
 { id: 'd11', type: 'pin', kind: 'mazesign', label: 'Corn maze sign', pts: [[272,282]] },
] };
'''
def scripts_of(html):
    return re.findall(r'<script src="js/([^"]+)\.js"></script>', html)


def make_js(srcs):
    """head part = scripts before main.js (minus guard.js, which is for the Site check only), tail part = main.js and after."""
    k = srcs.index('main')
    head = [f for f in srcs[:k] if f not in ('guard',)]
    tail = srcs[k:]
    hj = []
    for f in head:
        if f == 'i18n':
            hj.append(PREVIEW + '\n' + dicts)
        hj.append(read('js/%s.js' % f))
    tj = [read('js/%s.js' % f) for f in tail]
    return '\n'.join(hj), '\n'.join(tj)


def esc(js):
    return js.replace('</script', '<\\/script')


# ---- main page (single file; the platform wraps it in a document skeleton) ----
html = read('index.html')
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
head_js, tail_js = make_js(scripts_of(html))
body = re.sub(r'\s*<script src="js/[^"]+"></script>', '', body)
ld = re.search(r'<script type="application/ld\+json">.*?</script>', html, re.S).group(0)
out = f'''<title>Wise Acres Organic Farm</title>
<style>
{css}
</style>
<script>
{esc(head_js)}
</script>
{body.strip()}
{ld}
<script>
{esc(tail_js)}
</script>
'''
open(OUT + 'index.html', 'w', encoding='utf-8').write(out)
print('index.html', len(out) // 1024, 'KB')

# ---- inner pages: self-contained full documents ----
for slug in PAGES:
    page = read(slug + '.html')
    head_js, tail_js = make_js(scripts_of(page))
    page = re.sub(r'\s*<link rel="preload"[^>]*>', '', page)
    page = re.sub(r'\s*<link rel="stylesheet" href="css/[^"]+">', '', page)
    page = page.replace('</head>', '<style>\n' + css + '\n</style>\n<script>\n' + esc(head_js) + '\n</script>\n</head>', 1)
    page = re.sub(r'\s*<script src="js/[^"]+"></script>', '', page)
    page = page.replace('</body>', '<script>\n' + esc(tail_js) + '\n</script>\n</body>', 1)
    open(OUT + slug + '.html', 'w', encoding='utf-8').write(page)
    print(slug + '.html', len(page) // 1024, 'KB')
