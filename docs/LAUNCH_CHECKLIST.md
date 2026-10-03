# Launch checklist: putting the Wise Acres website online

For the farm owner, and for anyone helping, who has never put a website online. Plain English, in order. Written on 2 October 2026 for the files in this folder. Updated on 3 October 2026 for the Drive time box (steps 3.5 and 3.13, decision D11 and the tests in section 5). Checked again on 3 October 2026 against the files at commit `979437f`: the file counts and sizes, steps 3.8, 3.9 and 3.13, the list of questions in section 4 and the tests in section 6 were corrected.

**Not part of the upload.** This file lives in `docs/`, which stays on your computer (see section 2).

## How to read this page

Three words you will meet:

- **Host.** A company whose computers keep the site's files and hand them to visitors, all day and night. Putting the site online means giving the files to a host.
- **Domain.** The name, `wiseacresorganic.com`. You rent it from a company called a registrar.
- **DNS.** The list kept by the company that looks after your domain. It says which host answers when someone types your name. HTTPS is the padlock in the browser: it means the connection is private.

Every statement about a host company carries a tag that says how sure we are:

- **[read]** The helper read the company's own documentation text on 2 October 2026 (the sources are listed at the end).
- **[tested here]** The helper ran it on 2 October 2026 on a test computer, using the company's own free test program or a real browser. Nothing was uploaded to any real host.
- **[not opened]** The company's website is blocked from the test computer, so this comes from a search-engine summary of the company's page, or from a forum. Check it on the company's own page before you rely on it. These are the facts most likely to be out of date.

"Ask Claude" means: ask the helper who maintains this site to make the change. You never have to edit code yourself.

## The short version

1. Use **Cloudflare Pages** on the free plan, with its drag-and-drop upload. Section 1 says why, and what to do if you would rather use Netlify.
2. Upload a copy of the folder **without** `docs/`, `tools/`, `pages/` and `README.md` (section 2).
3. Make the owner decisions in section 4. Ask for `seasonPicker: false` before the real upload.
4. Point `www.wiseacresorganic.com` at the host with one DNS record. Leave every other record alone, because your email depends on them (step 3.3).
5. Check the padlock and the headers (3.4, 3.5). Decide about the old-address redirects (3.6).
6. Before you give Google the sitemap, ask Claude to change the page addresses from `/wise-pie.html` to `/wise-pie` (3.7). This is the one real catch of the recommended host.
7. Add the site to Google Search Console and put its address in your Google Business Profile (3.10, 3.12).
8. Run the tests in section 5, then keep the weekly routine in season.

## 1. Where to put the site

The site is plain files. There is no database and no build step, so any host that serves files will do. The README names three. They are compared below.

| | **Cloudflare Pages** (recommended) | **Netlify** (second choice) | **GitHub Pages** (not recommended) |
|---|---|---|---|
| **Cost for this site** | Free plan. Requests for static files (which is all this site is) are "free and unlimited". Limits that matter: 20,000 files per site, 25 MiB per file; this site has 112 files, the biggest is 0.44 MB. **[read]** | Free plan with a monthly allowance of "credits". The pages say that when you reach the limit "projects pause until the next billing cycle". Reported prices: 300 credits a month on Free, 20 credits for each GB sent to visitors, 15 credits for each upload that goes live. **[not opened]** | Free. Soft limits: site up to 1 GB, 100 GB of traffic a month, 10 builds an hour. **[read]** But see the business-use rule in the last row. |
| **Custom domain: steps** | In the project: Custom domains, Set up a domain. Then at your registrar add a `CNAME` record for `www` pointing at `<project>.pages.dev`. For the bare domain (`wiseacresorganic.com` without `www`) the whole domain must be moved to Cloudflare's nameservers. **[read]** | Add the domain on the site's page, then at your registrar a `CNAME` for `www` pointing at `<site>.netlify.app`. For the bare domain: an `ALIAS`/`ANAME` record to `apex-loadbalancer.netlify.com`, or an `A` record to `75.2.60.5`. Netlify "strongly recommend[s]" `www` as the main address. **[not opened]** | Add the domain in the repository's Settings, Pages. Then `CNAME` for `www` pointing at `<user>.github.io`; for the bare domain four `A` records (`185.199.108.153` to `185.199.111.153`). **[read]** Needs a GitHub account and a repository that holds the site. |
| **HTTPS (the padlock)** | The pages read mention certificates only in a note about CAA records, so confirm by opening `https://` once the domain says Active. **[read]** | "We will automatically provision a certificate with Let's Encrypt." **[not opened]** | "All GitHub Pages sites, including sites that are correctly configured with a custom domain, support HTTPS". You tick "Enforce HTTPS". **[read]** |
| **`_headers` works** (security headers, the tested Content-Security-Policy) | Yes. File `_headers` in the top folder; up to 100 rules and 2,000 characters a line. Our file was applied by Cloudflare's own test server. **[read] [tested here]** | Yes, if `_headers` is in the folder you publish. **[not opened]** (Netlify's own Content-Security-Policy page shows an example.) | No. Nothing in the GitHub pages read mentions it, and GitHub community threads say custom headers cannot be set. **[read] [not opened]** |
| **`_redirects` works** (the old farm addresses) | Yes. Redirects are 302 unless you write 301, so our file writes 301. Up to 2,000. All 22 rules of our file worked in Cloudflare's own test server. **[read] [tested here]** | Yes; the default is 301. Our file was accepted by Netlify's own open-source parser. **[not opened] [tested here]** | No server-side redirects. The only workaround is a small page per old address, which Google treats less firmly. Not tested here. |
| **What happens to `/wise-pie.html`** (our pages are written with `.html`) | Redirected (308) to `/wise-pie`; the page still works, and `?lang=es` is kept. **[read] [tested here]** But the site's canonical tags and sitemap name the `.html` address, so they disagree with where the visitor ends up. See step 3.7. | Both `/wise-pie` and `/wise-pie.html` are served, without a redirect, unless the "Pretty URLs" setting is on (leave it off). A Netlify support-forum answer. **[not opened]** | Not checked. |
| **What you cannot do** | You cannot turn the `.html` redirect off on Pages. **[not opened]** The bare domain needs the nameserver move. If you choose drag-and-drop you "cannot switch to Git integration later" (you can start a new project). **[read]** Cloudflare's own overview page says: "Start new projects with Workers." Pages still works and is documented. Workers can switch the `.html` redirect off (a setting called `html_handling`, shown in a configuration file), and a Workers site works only on a domain whose nameservers are on Cloudflare, so this page does not use it. **[read]** | On the free plan the site stops when the credits are used up, and nothing is billed instead. **[not opened]** | No custom headers, so no Content-Security-Policy and no way to set `X-Frame-Options`. No redirects, so the old addresses cannot be forwarded. Plus GitHub's rule: Pages "is not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions...". A farm that sells visits and pizza is a business; whether this site counts is GitHub's decision, not ours. **[read]** |

### Why Cloudflare Pages

1. **The cost cannot surprise you.** A first visit to the home page, scrolling all the way down, downloads about 2.2 to 2.4 MB (measured on 3 October 2026 in a real browser, text files compressed; the high end is when every picture has loaded). October is when the farm is busiest. On Netlify's free plan, going by the prices above, the allowance would last very roughly 5,000 first visits a month (arithmetic on **[not opened]** prices, not a promise). When it ran out the site would go offline until the next month. On Cloudflare's free plan the pages are free and unlimited. **[read]**
2. **Everything the README set up works there**: `_headers`, `_redirects` and the friendly "page not found" page. **[tested here]**
3. **Your email is not touched.** One `CNAME` record for `www` changes nothing else. (Moving the whole domain to another company is the step that can break email.)
4. **The upload is drag and drop**, and later changes are "Create a new deployment" and drag again. There is also an instant rollback to an earlier version. **[read]**

**The price of this choice:** Cloudflare redirects `/wise-pie.html` to `/wise-pie`, and this site announces the `.html` form to Google. Everything still works for visitors. It is a small tidy-up for Claude (step 3.7), and it is not a reason to delay going live. If you do not want that, or you would like the least change to the files, use Netlify, accept the free-plan allowance (look at its usage page every week in October), and be ready to pay for a plan if the farm gets popular. If the farm already has a GitHub account and does not mind the limits above, GitHub Pages can show the pages but cannot do the headers or redirects in this checklist.

## 2. What to upload, and what to leave out

**Upload** these (everything the visitor needs):

| Item | What it is |
|---|---|
| `index.html`, `first-visit.html`, `pumpkin-patch.html`, `school-field-trips.html`, `strawberry-picking.html`, `wise-pie.html` | The home page and five more pages |
| `404.html` | The friendly "page not found" page |
| `robots.txt`, `sitemap.xml`, `manifest.webmanifest` | For search engines and for phones that bookmark the site |
| `_headers` | Security and cache rules. The name starts with an underscore and has **no** `.txt` at the end |
| `_redirects` | Only if you choose to use it (step 3.6). Same naming rule |
| `assets/`, `css/`, `js/`, `lang/`, `print/` | Pictures and fonts, styles, code, the translations, the printable QR signs |

**Leave out:**

| Item | Why |
|---|---|
| `docs/` | Notes and questions for the farm, with placeholders in them. Not for visitors |
| `tools/`, `pages/` | For whoever edits the site (they build the pages and translations) |
| `README.md` | Instructions for whoever edits the site |
| `.git` (a hidden folder, if you have one) | The change history of the files |

How to do it, with no tools:

1. Copy the whole site folder and call the copy `wise-acres-upload`.
2. In the copy, delete `docs`, `tools`, `pages` and `README.md`, and `.git` if you can see it.
3. What is left should be 16 items (17 with `_redirects`), 112 files (113 with `_redirects`), about 6.0 MB. Double-click `index.html` in the copy and check the site looks right.
4. Keep each uploaded folder, with the date in its name (`wise-acres-upload-2026-10-09`). If an upload goes wrong you can go back.

The helper checked on 2 October 2026, and again on 3 October 2026 with the files at commit `979437f`, that the site loads with all 8 pages and 5 languages from this reduced folder, with no missing file.

## 3. The steps, in order

Some steps change the files (marked **FILES**): `seasonPicker`, `_redirects`, the Content-Security-Policy line, the page addresses, analytics, the Search Console tag. Each time, upload the folder again. Only the newest upload is live, and each takes a few minutes. So the first upload (3.2) is a trial run on a temporary address; the real one comes after the FILES steps.

### 3.1 Account

- [ ] Decide who owns the account (section 4, D1). Create a free Cloudflare account with a farm email address that more than one person can read, not a helper's personal address.
- [ ] Turn on two-step sign-in if it is offered. Write down who holds the login.

### 3.2 Upload a trial copy

- [ ] In the Cloudflare dashboard open Workers & Pages, then Create application, Get started, **Drag and drop your files**. Name the project (for example `wise-acres`), drag in the `wise-acres-upload` folder, and press Deploy site. The site appears at `<project>.pages.dev`. **[read]** If you cannot find the drag-and-drop choice, stop and ask the helper. Do not use the command-line route alone.
- [ ] On that address check: the home page and each language; `/wise-pie.html` jumps to `/wise-pie` and shows the page; a made-up address such as `/nonsense` shows the friendly "page not found" page; adding `?check` to the home address shows no yellow "Site check" box at the bottom. **[tested here]**
- [ ] Do not give the `.pages.dev` address to anyone. See 3.5 for keeping it out of Google.
- Updating later: open the project, Create a new deployment, drag the folder again. **[read]**

### 3.3 Domain and DNS

**FILES: none. This is about the company that holds your domain.**

- [ ] Find out who controls `wiseacresorganic.com`: where it is registered, and who has the login (D2). If nobody knows, ask whoever built the current site. Do not continue without this.
- [ ] **Before changing anything**, open the DNS records page and take screenshots of every record. The `MX` and `TXT` records are what keep `cathy@wiseacresorganic.com` and other email working. Do not delete or edit them.
- [ ] In Cloudflare: your project, Custom domains, Set up a domain, type `www.wiseacresorganic.com`, Continue. **Do this first.** Cloudflare says that a record added at your registrar without this step "will result in your domain failing to resolve ... and display a 522 error". **[read]**
- [ ] At your registrar: add a `CNAME` record, name `www`, pointing at `<project>.pages.dev`. **[read]** If a `www` record already exists (it points at the old site), change it; do not add a second one. This is the moment visitors stop seeing the old site at that address. Do it on a quiet weekday, once everything in this section is ready, and do not cancel the old hosting until a week later.
- [ ] If your registrar has `CAA` records, Cloudflare must be allowed to issue certificates. The Cloudflare page lists the lines to add. **[read]**
- [ ] The bare domain `wiseacresorganic.com` (people type it, and the printed QR signs show it without `www`). Cloudflare Pages needs the whole domain on Cloudflare's nameservers for this. **[read]** The easy way is a "forward `wiseacresorganic.com` to `https://www.wiseacresorganic.com`" setting at your registrar, if it has one (not checked here, many do). The other way is to move the domain's DNS to Cloudflare. Only do that with the helper, after copying every existing record, email ones included. If you do, leave off any optional Cloudflare feature that rewrites pages or adds scripts: the tested security policy (3.5) was not run with them.
- [ ] Wait. GitHub's page says DNS changes "can take up to 24 hours" **[read]** (that is about DNS in general). Most are much faster.

### 3.4 HTTPS (the padlock)

- [ ] Open `https://www.wiseacresorganic.com/`. A padlock should show and the site should load.
- [ ] Open `http://www.wiseacresorganic.com/` (no `s`). It should jump to `https://`. If it does not, tell the helper. Do not guess the setting.
- [ ] If the certificate has not appeared after a few hours, check the custom domain's status in the Cloudflare dashboard for an error message, and check the `CAA` point in 3.3.
- Compression is also the host's job (README step 3). Cloudflare "will also serve Gzip and Brotli responses whenever possible". **[read]**

### 3.5 Check the headers

Headers are hidden notes sent with every page. `_headers` already holds four security notes, the cache rules for pictures and code, and a "do not list in Google" note for the printable signs.

How to look, with no tools: open the live home page in Chrome, press F12, open the Network tab, reload, click the first row (`www.wiseacresorganic.com`), and read "Response Headers". With a terminal: `curl -sI https://www.wiseacresorganic.com/`.

- [ ] Home page shows: `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `x-frame-options: SAMEORIGIN`, `permissions-policy: camera=(), microphone=(), geolocation=()`. **[tested here]**
- [ ] A picture such as `/assets/og-share.png` shows `cache-control: public, max-age=31536000, immutable`. `/print/qr-signs` shows `x-robots-tag: noindex`. **[tested here]**
- Cloudflare also sends `Access-Control-Allow-Origin: *` on its own. That is normal for a public site. **[read]**

**Optional, Cloudflare only: keep the `.pages.dev` address out of Google.** Add these two blocks at the bottom of `_headers`. They apply only to `.pages.dev` addresses and not to your own domain. Cloudflare's page gives this example. **[read]** In Cloudflare's test server the `.pages.dev` address got `x-robots-tag: noindex` and the farm's domain did not. **[tested here]**

```
https://:project.pages.dev/*
  X-Robots-Tag: noindex

https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex
```

#### The Content-Security-Policy: ready, tested, and not yet in `_headers`

**What it is.** A rule that tells the browser exactly which places the pages may load code from. If a foreign script ever got into a page, the browser would refuse to run it. It is an extra safety net. The site works the same without it, and the other four security notes stay on either way.

**Why it is not in `_headers` yet:**

1. **It has been tested only on the helper's computer.** It was served with the real files in a real browser, on all 8 pages in all 5 languages, with every optional feature switched on (notice bar, reviews, week box and feed, signup, review link, visitor photos, entrance photo): 40 page loads, no violation, no page error. The Drive time box was tested separately under the same policy (section 6). The outside services (Mailchimp, the two map services of the Drive time box) were stand-ins, because the test computer cannot reach them. It has never run on the real host. **[tested here]**
2. **A wrong policy fails silently.** The browser blocks the item and the page just does not do it: the signup does nothing, the analytics count nothing, the Print button is dead. Visitors see no error and neither do you.
3. **Four things change the policy.** (a) Analytics: every provider needs its own addresses added (table in 3.9). (b) A live week feed on another website needs its address added. (c) The Mailchimp form: the policy allows only `*.list-manage.com`, and the real form code (question 26) has not been seen yet. (d) The Drive time box: the line below already allows its two map services, `https://nominatim.openstreetmap.org` and `https://router.project-osrm.org`, and nothing else. Without them the box would only ever say "The lookup is not working right now" (tested). If the farm ever swaps one of those services (3.13), the line must change with it.
4. **One inline click handler is allowed by a fingerprint.** The Print button on `print/qr-signs.html` has its code in the page, and the policy lists a fingerprint (hash) of exactly that text. If anyone edits that button's `onclick`, the fingerprint no longer matches and the button stops working. The fingerprint was recomputed on 2 October 2026 and matches, and the Print buttons were pressed again under the policy on 3 October 2026. **[tested here]**
5. **Known limit.** The pages use `style="..."` attributes, so the policy has to allow inline styles. It stops foreign scripts, not injected styling.

**The one-line change.** Open `_headers` in a plain text editor. Find the line that starts `  Permissions-Policy:` (two spaces first). Directly under it, add this single line, with the same two spaces at the start:

```
  Content-Security-Policy: default-src 'self'; script-src 'self' https://*.list-manage.com 'unsafe-hashes' 'sha256-MguIPR6qNR8D3B+eAlK+bIRTZe8t3wkOY4B/56Me9FU='; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'
```

It is 374 characters long (Cloudflare's limit is 2,000 per line). **[read]** Both Cloudflare's and Netlify's own header parsers read the line and return it unchanged. **[tested here]**

**Recommended order:**

- [ ] **Trial run.** Add the line with `-Report-Only` right after `Content-Security-Policy` (so it starts `  Content-Security-Policy-Report-Only: default-src ...`). In this mode the browser blocks nothing. It only prints a message in the console for anything the policy would have blocked. Netlify's own page shows a Report-Only line in `_headers`, and MDN describes the header as one that reports without enforcing. **[not opened]** Upload.
- [ ] Open each of the 6 public pages in Chrome with F12 open on the Console tab. Scroll to the bottom, switch language, open a photo, tap the map, press every button that stays on the page, and press "Get drive time" with a real address. Any message that starts with `[Report Only] Refused to ...` means the policy needs a change: send it to Claude. If you see no messages at all, make sure the "Info" level is ticked in the console's level menu. With the real policy the helper saw none on 8 pages, and with a deliberately wrong policy the browser printed `[Report Only] Refused to load the image ...` for every item. **[tested here]**
- [ ] This only tells you what your own browser sees. The line has no report address, so nothing is collected from visitors.
- [ ] **Switch on.** Once the decisions on analytics, the week feed, the Mailchimp form and the Drive time box (section 4) are final and the line has been updated for them, delete `-Report-Only` from the name and upload again. Press the Print button on `/print/qr-signs` once to check it still prints.
- Skipping this at launch is fine. Do it a few weeks later.

### 3.6 Redirects for the old farm addresses

**FILES: `_redirects`.**

**What it is.** A text file called `_redirects` that sits in the top folder. Each line says: if someone opens this old address, send them to this page. A "301" tells browsers and Google that the move is permanent, so Google keeps what it already knows about the old address.

**Why it matters.** People have the old addresses in bookmarks, in other websites' links, and in Google's results. Without the file they land on "page not found".

**What exists.** An earlier research pass listed 13 old addresses (each also with a trailing slash where that form exists, which makes 22 lines) and wrote them as an optional patch, `redirects-optional.patch`. That patch is not part of the site files, so the file is printed below and you do not need the patch. It differs from that patch in two ways: the two page targets no longer end in `.html` (so Cloudflare does not redirect twice), and the comment no longer claims anything about GitHub. Only addresses that appeared in Google results are in it. That list was not rechecked on 2 October 2026 and may be incomplete.

| Old address | Goes to |
|---|---|
| `/wiseacres` | The "Visit" section of the home page |
| `/faq` | The FAQ section |
| `/food` | The Wise Pie page |
| `/the-greenhouse` | The GreenHouse section |
| `/about` | The About section |
| `/contact`, `/contact-us/` | The Contact section |
| `/flowers`, `/flowers-photographers/` | The Flowers section |
| `/schooltours`, `/school-tours/` | The School field trips page |
| `/parties`, `/parties-school-tours/` | The Groups section |

**Should you use it?** Use it if the new site takes over the address of the current `wiseacresorganic.com`. Skip it if the new site goes on a different domain. It does nothing if there are no old addresses to catch. Leave out `/summer/` and `/posts/` until the farm decides what should happen to those two old pages; for now they show "page not found". That is your decision (D3). If you have the old site's page list or sitemap, give it to Claude to compare.

```
# Old addresses of the previous wiseacresorganic.com site -> the matching page or section here.
# Read by Netlify and Cloudflare Pages. Test after deploying: curl -sI https://www.wiseacresorganic.com/faq
# Only addresses seen in Google results are here. /summer/ and /posts/ are left out on purpose until the farm decides what to do with them.
/wiseacres               /#visit                  301
/wiseacres/              /#visit                  301
/faq                     /#faq                    301
/faq/                    /#faq                    301
/food                    /wise-pie                301
/food/                   /wise-pie                301
/the-greenhouse          /#greenhouse             301
/the-greenhouse/         /#greenhouse             301
/about                   /#about                  301
/about/                  /#about                  301
/contact                 /#contact                301
/contact/                /#contact                301
/contact-us/             /#contact                301
/flowers                 /#flowers                301
/flowers/                /#flowers                301
/flowers-photographers/  /#flowers                301
/schooltours             /school-field-trips      301
/schooltours/            /school-field-trips      301
/school-tours/           /school-field-trips      301
/parties                 /#groups                 301
/parties/                /#groups                 301
/parties-school-tours/   /#groups                 301
```

- [ ] To use it: save the block as a file named `_redirects` (no `.txt`) in the top folder of the upload, and upload again.
- [ ] Test: open each old address in a browser. It should land on the right place. All 22 lines were tested in Cloudflare's own test server (each answers 301 and lands on a page that opens), and Netlify's open-source parser accepted the file. **[tested here]**
- On Netlify, the targets `/wise-pie` and `/school-field-trips` rely on Netlify serving the address without `.html`, which a Netlify support-forum answer says it does. **[not opened]**

### 3.7 `robots.txt` and `sitemap.xml`

**FILES: the page addresses, if you use Cloudflare.**

Both files are ready. `robots.txt` lets search engines in, keeps them out of `/print/`, and points at the sitemap. `sitemap.xml` lists the home page and the five other pages. Both use `https://www.wiseacresorganic.com/`.

- [ ] After launch open `https://www.wiseacresorganic.com/robots.txt` and `https://www.wiseacresorganic.com/sitemap.xml`. Both should show text.
- [ ] If the site will live at another address, ask Claude to change them (README, "Putting it online", item 2).
- [ ] **Cloudflare only: ask Claude to make the page addresses extension-less before you submit the sitemap.** Today each page names itself as `https://www.wiseacresorganic.com/wise-pie.html` in its canonical tag, its share address, its structured data and the sitemap. On Cloudflare that address redirects to `/wise-pie`, so the page tells Google to use an address that bounces to itself. Visitors never notice. How Google sorts this out was not checked here. The tidy fix is small: the two address-building lines in `tools/pages.py`, a rebuild of the five pages, and the five sitemap lines. Printed QR signs that end in `index.html#menu` and `first-visit.html#farm-map` keep working through the redirect, and the browser still scrolls to the right place. **[tested here]** On Netlify this step is not needed.

### 3.8 `seasonPicker: false`

**FILES: `js/content.js`.**

- [ ] In `js/content.js`, find `seasonPicker: true,` and change `true` to `false`. Or ask Claude to.
- [ ] What it does: the "See the farm in ..." switcher is a preview tool that lets a visitor click between seasons. With `false` the first screen simply follows today's date (the dates are in `js/season.js`). The file's own comment says to set it to `false` "when the site should simply follow the calendar". Without this change every visitor sees a switcher that shows the farm in other seasons.
- [ ] After uploading, check that the switcher is gone from the home page.

### 3.9 Analytics: on or off

**FILES: `js/content.js` (and the security line).**

**Recommended: off at launch.** It is off today (`analytics: { provider: 'none' }`). Reasons: nothing to set up; no analytics company is contacted (and the site contacts no other website until a visitor presses "Get drive time"), which `docs/WHAT_THE_SITE_STORES.md` records; no cookie or privacy question to answer; and it can be turned on later without losing anything but the earlier counts. Turn it on only if someone will actually look at the numbers (which buttons people press, which language they use).

If you do want it (decision D5):

- Pick one: Plausible, GoatCounter, Umami, or Cloudflare Web Analytics (page views only). Each needs a sign-up; the lines to paste are at the top of `js/analytics.js`. Ask Claude to paste them.
- It is skipped for visitors whose browser says "Do Not Track" or "Global Privacy Control".
- It changes the security policy. Each provider needs these addresses added to the line in 3.5 (tested only with stand-ins, not the real services):

| Feature | Add to `script-src` | Add to `connect-src` | Also |
|---|---|---|---|
| Plausible | `https://plausible.io` | `https://plausible.io` | |
| GoatCounter | `https://gc.zgo.at` | `https://YOURCODE.goatcounter.com` | the same address to `img-src` |
| Umami | the address you put in `src` | the same address | |
| Cloudflare Web Analytics | `https://static.cloudflareinsights.com` | `https://cloudflareinsights.com` | |
| Live week feed (`week.feed`) | | the feed's address | |
| Drive time box (already in the line in 3.5) | | `https://nominatim.openstreetmap.org` and `https://router.project-osrm.org` | swap these if you change service (3.13) |

- After switching it on, ask Claude to re-run the storage and outside-sites check and update `docs/WHAT_THE_SITE_STORES.md`.
- Some hosts have their own one-click analytics switch. Leave those off unless you want them, because they add scripts the site's own checks do not know about. If you turn one on, tell the helper.

### 3.10 Google Search Console and the verification tag

**FILES: `index.html`. Do this only after the site is live on the real domain.**

- [ ] Go to `search.google.com/search-console`, sign in with the farm's Google account (not a helper's), choose Add property, and pick the **URL prefix** box (not "Domain"). Type `https://www.wiseacresorganic.com/`.
- [ ] Choose the **HTML tag** way of verifying. Copy the whole line that starts `<meta name="google-site-verification"`.
- [ ] Send that line to Claude to paste into `index.html` where the comment says "GOOGLE SEARCH CONSOLE" (home page only; the other pages do not need it). Upload again. Press Verify.
- Google says the tag must be inside the `<head>` of the home page, and that it checks for it from time to time, so leave it there. **[not opened]**
- [ ] In the left menu choose Sitemaps, type `sitemap.xml` in the box (the start of the address is already filled in), and Submit. Google's page says "Submitting" a sitemap means telling Google where the file is. **[not opened]** On Cloudflare, do the address change in 3.7 first.
- [ ] A few days later look at the Pages report. A list of pages "with redirect" means 3.7 is not done yet.

### 3.11 The share images

- [ ] Every page has its own picture for when its address is pasted into Facebook, a text message or similar. All six are 1200 by 630 pixels and under 250 KB, drawn from the site's own artwork (not stretched photos), with the name "Wise Acres Organic Farm" and that page's own heading. No prices, dates or promises are in them. Look at each one before launch.

| Page | File | What the picture shows |
| --- | --- | --- |
| Home | `assets/og-share.png` (213 KB) | The fall farm from the top of the home page: sun, barn, wagon ride, pumpkin patch, scarecrow. "Organic u-pick fun for the whole family". |
| Strawberry picking | `assets/og-strawberry-picking.png` (211 KB) | The spring farm: children picking in strawberry rows, wagon ride, barn, sunflowers. "U-pick organic strawberries". |
| Pumpkin patch | `assets/og-pumpkin-patch.png` (227 KB) | A close view of the fall pumpkin patch: orange and white pumpkins, hay bales, scarecrow, wagon ride, barn. "Pumpkin patch at Wise Acres". |
| School field trips | `assets/og-school-field-trips.png` (189 KB) | A yellow school bus on the farm lane above blueberry rows where children pick, with sunflowers and the barn. "School field trips to an organic farm". |
| Wise Pie | `assets/og-wise-pie.png` (114 KB) | Three pizza slices and two paper cups on a red and white checked tablecloth, farm hills behind. "Real pizza from a 700-degree oven" (that is the heading of the page: if the wording on the page changes, ask for a new picture). |
| First visit | `assets/og-first-visit.png` (182 KB) | The farm map seen from above: parking lot, entrance arch, barn, farm stand, goat pen, fire pit, pumpkin patch, maze, playground. "Your first visit to Wise Acres". |

- [ ] Where it is set: the home page in `index.html` (`og:image`, `og:image:alt`, `twitter:image`, `twitter:image:alt`, and the `"image"` line of the structured data). Each extra page in its own source file `pages/<page>.html`, in the settings block at the top: `image: assets/og-<page>.png` and `image_alt: ...`. `python3 tools/pages.py` then writes the picture's address, its width and height (read from the file) and its description into the page. A page with an `image:` line but no `image_alt:` line is refused, and a page with no `image:` line uses `assets/og-share.png`.
- [ ] The description of each picture (`image_alt:`) says only what is in the picture, and it lives only there (the home page's lives only in `index.html`; the Twitter line is a copy). If a picture changes, change its description.
- [ ] Decision D7: keep the drawings, or use real photos? The farm's photos are mostly 206 to 750 pixels wide, so a photo would need to be a new, large one (1200 pixels wide or more). To change a picture, ask Claude.
- [ ] Before launch you can replace a file under the same name. After launch, give a changed picture a new file name (for example `assets/og-pumpkin-patch-2.png`): `/assets/*` is cached for a year (see `_headers`), and Facebook, WhatsApp and iMessage keep old previews for days or weeks. For an extra page change its `image:` line in `pages/<page>.html`, then run `python3 tools/pages.py && python3 tools/i18n.py extract`. For the home page also change `OG_IMAGE` in `tools/pages.py`, the `og:image` and `twitter:image` lines and the `"image"` line of the structured data in `index.html`, and run the same rebuild.
- [ ] After launch, paste each page's address (the home page and the five extra pages) into a new text message or a Facebook post draft (not an old one: apps keep previews for days) and look at the picture and the title.

### 3.12 Your Google Business Profile

- [ ] Do this only after the site is live on the real domain.
- [ ] In your Business Profile choose Edit profile, enter the website's full address with `https://` (`https://www.wiseacresorganic.com/`), and Save. **[not opened]** Google's help page "Edit your Business Profile".
- [ ] Check that the hours, the phone number and the booking link on the profile match the site.
- [ ] Get the short review link from the profile (Ask for reviews) and send it to Claude for `reviewUrl` in `js/content.js` (question 27). Until then every "Leave a Google review" button opens the farm on Google Maps.

### 3.13 The Drive time box: free public services, and what to do if they refuse

**What it is.** In the Contact section a visitor can type an address and press "Get drive time" to see the miles and minutes to the farm or to The GreenHouse. Nothing is contacted until the button is pressed. What is sent, and to whom, is in `docs/WHAT_THE_SITE_STORES.md`, section 3.

**It uses two free public services, with no account, no key and no cost.** They are run by volunteers and non-profits, and they come with rules:

| | Address search: Nominatim | Routing: OSRM demo server |
|---|---|---|
| Run by | The OpenStreetMap Foundation | FOSSGIS e.V., a German non-profit **[read]** |
| Speed rule | "An absolute maximum of 1 request per second." **[not opened]** The box sends one search per press, and a second one for the farm's address 1.1 seconds later unless `farmPoint` is set. **[tested here]** | "Do not exceed 1 request per second." **[read]** One request per press. |
| Business use | The policy page could not be opened. Answers in the OpenStreetMap community forum say it does not forbid commercial projects. **[not opened]** | Its wiki page says the demo server "usage is restricted to reasonable, non-commercial use-cases". **[read]** An older policy page, kept as "still good practice", lets commercial products use it if they are public and credit the source. The current German terms were not opened. |
| How it knows who you are | The visitor's browser sends the site name as the referring site, which is what the policy asks for. **[tested here]** | "Valid User-Agent identifying application. ... If known, a valid HTTP Referer." The browser sends the site name (it cannot set a User-Agent of its own). **[read] [tested here]** |
| Credit required | OpenStreetMap: "Provide credit to OpenStreetMap by displaying our attribution notice." **[read]** The Nominatim policy asks for credit "as suitable for your medium". **[not opened]** | "Display the required attribution and display a link to 'fix the map'." An older page also asks to name OSRM as the source of the routes. **[read]** |
| Promise of service | None. It may refuse or block. **[not opened]** | "We provide no guarantees wrt. uptime, latency, or data updates." **[read]** |
| Reachable from a web page | Its program's default settings send the "any website may ask" header. **[read]** The live server was not called. | Its program code sends the same header. **[read]** The live server was not called. |

**What this means, in plain words:**

1. The routing server's own page calls the demo "non-commercial". A farm website that sells visits is a business, so there is a real chance that one day the service refuses it, and the farm would have no one to complain to. The free search is probably more relaxed, but its policy page could not be read.
2. If that happens, nothing breaks. The box says "The lookup is not working right now. Try the Google Maps button instead." and offers a Google Maps button. The town list above it does not change. **[tested here]**
3. Counting: at most two searches and one route request per press. A busy day with a few hundred presses is far below the "one request a second" rule, but a rule that says "the whole website, together" could be hit by a sudden crowd. (Community forum answers say the limit counts all of a website's visitors together; the policy page was not opened.)
4. The credit under each answer reads "© OpenStreetMap contributors", linked to OpenStreetMap's copyright page. The routing server also asks for the OSRM name and a "fix the map" link, so two more small links sit next to the credit: "Routing: OSRM" (OSRM's project page) and "Fix the map" (OpenStreetMap's page for reporting map mistakes). **[tested here]**

**Do these before launch:**

- [ ] **Set `farmPoint` in `js/content.js`** (the steps are in the comment "DRIVE TIME FROM A VISITOR'S ADDRESS"). It halves the number of requests, makes the answer about a second faster, and means the box no longer depends on OpenStreetMap having the farm's street address right. Check the two numbers by looking at them on a map. **[tested here: one search and one route request per press]**
- [ ] If you want a clear answer about business use, write to the routing server's operators at the address on their about page, `fossgis-routing-server@openstreetmap.de` **[read]**: say it is a small farm website, that the visitor presses a button, and that you send one request per press. Keep their reply.
- [ ] Press the button yourself on the live site (section 5). The real services were never called from the test computer.

**If the services refuse, or the farm gets busy, the choices are:**

| Choice | Cost | What the owner does | The catch |
|---|---|---|---|
| Switch the box off (ask Claude) | Free | Nothing | The town list and the Google, Apple Maps and Waze links stay. Visitors lose the miles and minutes from their own address |
| Mapbox for both steps | A free monthly allowance of 100,000 requests for directions and for temporary address search, then paid; a card-free trial of 10,000 a month at sign-up **[not opened]** | Make an account, make a public access token, and limit it to `https://www.wiseacresorganic.com/` (Mapbox lets a token be limited to listed web addresses **[not opened]**). The helper changes about 20 lines and the policy line (`https://api.mapbox.com`) | Mapbox's rules on showing its results were not checked |
| Google Maps Platform | A free allowance of 10,000 calls a month for each basic product since March 2025 **[not opened]** | Make a Google Cloud account **with a card** (billing is required), make a key, limit it to the site's address | A card on file, and Google's rules on showing its results were not checked |
| OpenRouteService (HeiGIT) for routing | Free key: 2,000 route requests a day and 40 a minute **[read]** | Make an account and a key | A key "must not be used client-side" **[read]**, so it needs a small server piece (for example a Cloudflare Pages function) that hides the key. More work, and not for a first-timer |
| Photon, for the address step only | Free. "You are welcome to use the API for your project as long as the number of requests stay in a reasonable limit. Extensive usage will be throttled or completely banned. We do not give guarantees" **[read]** | Nothing | Replaces Nominatim only. Routing still needs a service |
| Run your own server, or pay a company to | Money every month | A lot | Not worth it for a farm website |

**The helper's suggestion:** keep the free services at launch, set `farmPoint`, and watch the weekly test in section 5. If the box fails two weeks running, or the routing operators say no, move to Mapbox with a URL-limited token, and if that is not wanted, switch the box off. This is the owner's choice (D11). Whichever you choose, the helper must change the security policy line in 3.5 to match.

## 4. Before you go live: decisions only you can make

**The questions about the farm itself** are in [QUESTIONS_FOR_THE_FARM.md](QUESTIONS_FOR_THE_FARM.md) (Spanish copy: [QUESTIONS_FOR_THE_FARM.es.md](QUESTIONS_FOR_THE_FARM.es.md)). They are not repeated here. Which ones to answer before launch:

- **Before launch:** questions 1 to 9 (things that could mislead the public), question 2 especially (the school-tour form link opens the editor), questions 22 and 23 (the booking and pizza pre-order pages), and question 3 (the phone number). Also question 35 (the farm's exact spot for the Drive time box, step 3.13), question 39 (the photo of four people at a Foster Village table is already in the photo gallery, and the answer says whether it may stay) and question 40 (four gallery photos have greetings or an offer printed in them, and one shows prices).
- **Can follow launch:** question 26 (the Mailchimp form; until then the signup button opens Mailchimp's own page), question 27 (the review link; see 3.12), question 28 (the news links), question 30 (will `cathy@wiseacresorganic.com` be read and answered). Questions 36 and 43 are the Drive time decision D11 below; 37 (January to April), 38, 41 and 42 can follow launch too. The site works without them.

**The decisions about launching** are not in that file:

| # | Decision | What the helper suggests |
|---|---|---|
| D1 | Who owns each login: the host account, the domain registrar, the Google account for Search Console and the Business Profile, Mailchimp? Write down who has each. | The farm owns all of them. A helper is added as a user, never the owner. |
| D2 | Where is `wiseacresorganic.com` registered, who controls its DNS, and is `www.wiseacresorganic.com` the main address? | The site assumes `www`. If you prefer the bare name, ask Claude to change the address in the files (README, "Putting it online", item 2). |
| D3 | Does the new site replace the current `wiseacresorganic.com`? Use the old-address redirects (3.6)? What happens to `/summer/` and `/posts/`? | Use the redirects if it replaces it. The two leftover pages are your call. |
| D4 | When do you switch the `www` record, and when do you cancel the old hosting? | A quiet weekday; cancel a week or more later. |
| D5 | Analytics: off, or which one? | Off at launch (3.9). |
| D6 | `seasonPicker`: `false` before launch (3.8). | `false`. |
| D7 | Share images: keep the drawings or use photos (3.11)? | Your choice. |
| D8 | Languages: the Spanish, Hindi, Chinese and Vietnamese texts were written with AI help and no native speaker has read them (README, "Content status"). Launch all five, or only the ones that have been read? | Have someone read each before launch, or launch with only the languages that have been read. |
| D9 | Who updates the site each week in season, and how (3.2: Create a new deployment, drag the folder)? | One named person, plus a backup person. |
| D10 | Free plan or a paid plan if the farm gets busy? | Free to start. Cloudflare's static traffic is not limited. **[read]** |
| D11 | The Drive time box: keep it on the free public services, switch it off, or move to a service with a contract (3.13; questions 36 and 43)? Do you want the OSRM operators asked about business use? | Keep it, set `farmPoint` before launch, ask the operators, and watch it weekly. |

## 5. After launch

### The first hour (phone and computer)

- [ ] **Booking links.** Press every "Reserve" button. Each should open the Bookeo page from question 22 for the right visit. Press "Order pizza": it should open the page from question 23. Press the school-tour form link in a private window: it should open without asking you to sign in. Check Facebook, Instagram and the three directions links (Google, Apple Maps, Waze).
- [ ] **Signup.** If the Mailchimp form is connected (question 26), sign up with your own email address. The confirmation email should arrive, and the address should appear in Mailchimp under Audience, then All contacts. Then delete your test contact. If it is not connected, check the button opens Mailchimp's own page.
- [ ] **Language switch.** For English, Spanish, Hindi, Chinese and Vietnamese: pick the language in the menu, go to another page, come back. The language should stay and no text should be cut off. Open `/?lang=es` once. On a phone set to Spanish, the "Would you like this in Spanish?" question should appear.
- [ ] **A real phone, on mobile data (not Wi-Fi).** The home page should load within a few seconds. Try the menu button, the sticky Reserve / Directions / Email bar, rotating the phone, and the map. Do it on an iPhone and an Android phone if you can.
- [ ] **The padlock,** `https://` and `http://`, the `www` name and the bare name, and a made-up address (should show "page not found" in the farm's style).
- [ ] **The Site check box.** Add `?check` to the live home address. No yellow box at the bottom means nothing is wrong.
- [ ] **QR signs.** Open `/print/qr-signs`, press Print once, then scan every printed sign with your own phone.
- [ ] **Drive time box.** Type your own address and press "Get drive time". The miles should be close to what Google Maps says and the minutes within a few. Try an address in another town, and a nonsense address such as `zzzzzzzz` (a very short one such as `zzzz` only asks for a longer address): it should say it could not find it. Press "Open these directions in Google Maps". If it says "The lookup is not working right now", either the free services are refusing or the security policy lacks their two addresses (3.5, 3.13): tell the helper, with the time.
- [ ] **Old addresses,** if you used the redirects: open all 13.
- [ ] **Cookies.** Open the live site in a private window, press F12, then Application, then Cookies. None should be listed. Some host options can add their own cookies, and `docs/WHAT_THE_SITE_STORES.md` (section 8) asks for exactly this check.
- [ ] **Share and Google.** Paste the address into a new message and see the preview. Confirm Search Console shows the site as verified, the sitemap as "Success", and the Business Profile shows the new website.

If something is wrong: open the project's list of deployments in Cloudflare and roll back to the earlier one. **[read]** Then tell the helper.

### Every week in season (about 10 minutes)

- [ ] Update "This week at the farm" (`week` in `js/content.js`), the notice bar and any closures; and open the next pizza weekend if it is due (README, "Day-to-day changes"). Upload again; a hard refresh (Ctrl+F5, or Cmd+Shift+R on a Mac) shows the new version at once on your own screen, and other visitors may keep the old files for up to an hour.
- [ ] Open the live site on your phone. The "Open now" badges and the countdown should match real life.
- [ ] Press Reserve: the Bookeo page should show the days you expect.
- [ ] Add `?check` to the home address. No yellow box. Press "Get drive time" once with your own address; if it fails two weeks running, tell the helper (3.13).
- [ ] Read the farm email inbox for waitlist and contact messages, and make sure someone answers them.
- [ ] Google Business Profile: hours and holiday closures are set; reply to new reviews.
- [ ] Once a month: Search Console (Pages and Sitemaps) for errors, and, if you chose a plan with an allowance, the host's usage page.
- [ ] At each change of season: prices, hours and season dates (README), and a re-read of the translations.

## 6. What was tested, and what was not

**Tested on 2 October 2026** (for the files at commit `fcaff91`):

- The Content-Security-Policy line inside `_headers`, and the `_redirects` file, were read by Netlify's open-source parsers (`@netlify/headers-parser` 10.1.1, `@netlify/redirect-parser` 16.1.1): no errors, the policy came back unchanged, 22 redirects, all 301.
- The reduced upload folder (99 files at that commit) and the same two files were served by Cloudflare's own Pages test server (`wrangler pages dev`, version 4.146.0). It applied the headers, redirected `/wise-pie.html` to `/wise-pie` (keeping `?lang=es`), redirected every old address with a 301, answered `/nonsense` with the friendly page, and gave `.pages.dev` addresses the noindex note but not the farm's domain.
- A real Chromium browser loaded all 8 pages in all 5 languages from that test server with the policy on and every optional feature switched on (stand-ins for Mailchimp and the week feed): 40 page loads, 0 policy violations, 0 page errors, 0 failed requests. The only outside request was the Mailchimp signup call, which is intended. With the policy in report-only form and no problem, the console showed no `[Report Only]` message.

**Tested on 3 October 2026** (for the files at commit `2996b9f`, with the Drive time box):

- The Content-Security-Policy line was changed to allow exactly the two map services in `connect-src`. Netlify's header parser read the new `_headers` without error and returned the line unchanged.
- Cloudflare's local Pages server served the reduced upload folder with the new line. The Drive time test suite (stand-ins for the two services, answered through the real policy) passed 42 of 42 checks. They include a normal answer, hours and minutes, address not found, no route, service down, an empty box, a double press, markup typed as a place name, five languages and a phone width. Every browser request was recorded, and the browser sent the site name as the referring site and no cookie.
- Under the new policy, a fetch to `api.openstreetmap.org`, `routing.openstreetmap.de`, a look-alike host (`nominatim.openstreetmap.org.example.net`) and `example.org` was blocked, and the same two services were allowed. The old policy (`connect-src 'self'` only) blocked the box: it said "not working right now" and the browser reported a `connect-src` violation for the search.
- All 8 pages in all 5 languages again, with the new line: 40 page loads, 0 policy violations, 0 page errors, 0 failed requests; the only outside request was the Mailchimp signup call.
- With `farmPoint` set the box sent one search and one route request per press, and nothing was stored in the browser (local storage, session storage and cookies were identical before and after).

**Tested again on 3 October 2026** (for the files at commit `979437f`, which this page was checked against):

- The reduced upload folder (112 files, 5.96 MB) was served by Cloudflare's local Pages server with the Content-Security-Policy line from 3.5 added to `_headers`. A real Chromium browser loaded all 8 pages in all 5 languages with the optional features switched on (stand-ins for Mailchimp and the week feed): 40 page loads, 0 policy violations, 0 page errors, 0 failed requests; the only outside request was the Mailchimp signup call. Both Print buttons worked.
- The Drive time test suite, answered through the same policy, passed 45 of 45 checks. It now also checks that the three links under an answer ("© OpenStreetMap contributors", "Routing: OSRM", "Fix the map") open safely in a new tab.
- Analytics and the week feed, with stand-ins for the services: with only the line from 3.5, the script of each provider (Plausible, GoatCounter, Umami, Cloudflare) and a feed on another website were blocked (one violation each); with the addresses from the table in 3.9 added there were no violations and the requests went out.
- For the later files at commit `12eec95` (new share picture, two-column gallery on phones, the `add_photo.py` tool) the storage check gave the same result, and the English and Spanish pages (16 page loads, the optional features switched on, the policy line from 3.5 in `_headers`) again had 0 policy violations and 0 page errors; the only outside request was the Mailchimp signup call.
- The storage and outside-sites check was repeated: three browser entries (`wa.lang`, `wa.offer`, `wa.checklist`), no cookies, no IndexedDB, Cache Storage or service worker, and no request to another site except when "Get drive time" is pressed.
- First-visit size of the home page: on load 21 files, 0.9 MB (0.34 MB with text compressed). After scrolling the whole page: 46 to 52 files, 2.8 to 3.0 MB (2.2 to 2.4 MB with text compressed); the number of files depends on how fast the scrolling is, because pictures load only when they come near the screen.

**Not tested:**

- Nothing was uploaded to any real host and no real domain was touched.
- The real Nominatim and OSRM servers. The test computer cannot reach them (its network proxy answers 403). Their answers, their cross-site headers and their limits come from their documentation and program code. The first real lookup on the live site is the real test (section 5).
- Netlify's pages and prices could not be opened; every Netlify statement above is **[not opened]**.
- The real Mailchimp and analytics services (stand-ins only).
- How Google treats the `.html` canonical addresses on Cloudflare, and how long Google takes to notice the redirects.
- Whether Cloudflare's dashboard still shows the same button names. The names above come from its documentation text, and Cloudflare moves things around.

## Sources (read on 2 October 2026; the sources for the Drive time box on 3 October 2026)

**Read (the parts quoted above), from the host's own documentation source** (the public repository `cloudflare/cloudflare-docs`, branch `production`, folder `src/content/docs/pages/`): `configuration/serving-pages.mdx` (the `.html` redirect, 404 page, default headers), `configuration/headers.mdx`, `configuration/redirects.mdx`, `configuration/custom-domains.mdx`, `platform/limits.mdx`, `functions/pricing.mdx` (static requests free and unlimited), `get-started/direct-upload.mdx` (drag and drop), `index.mdx` (rollbacks) and the "Are you sure you want to use Pages?" note (`src/content/partials/pages/workers-for-new-projects.mdx`). The Workers pages `workers/static-assets/migration-guides/migrate-from-pages.mdx` and `workers/static-assets/routing/advanced/html-handling.mdx` were read for the Workers comparison.

**Read (the parts quoted above), from GitHub's documentation source** (`github/docs`, branch `main`, folder `content/pages/`): `getting-started-with-github-pages/github-pages-limits.md`, `what-is-github-pages.md`, `securing-your-github-pages-site-with-https.md`, and `configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site.md`.

**Read, for the Drive time box (raw files from the services' own public repositories):** Nominatim `docs/api/Search.md`, `docs/api/Output.md` and `settings/env.defaults` (`osm-search/Nominatim`); the OSRM wiki pages "Demo server" and "Api usage policy", `docs/http.md` and `src/server/request_handler.cpp` / `include/server/request_handler.hpp` (`Project-OSRM/osrm-backend`); the routing server's about page (`fossgis-routing-server/routing-chef`, `cookbooks/osrm/files/default/about.md`); the OpenStreetMap website's licence text (`openstreetmap/openstreetmap-website`, `config/locales/en.yml`); the OpenRouteService FAQ (`GIScience/openrouteservice`, `docs/frequently-asked-questions.md`); the Photon README (`komoot/photon`).

**Not opened (search-engine summaries of these pages, or forums):**

- Netlify: `docs.netlify.com/manage/routing/headers/`, `.../manage/routing/redirects/overview/`, `.../manage/domains/configure-domains/configure-external-dns/`, `.../manage/security/content-security-policy/`, `.../manage/accounts-and-billing/billing/billing-for-credit-based-plans/` (credit pricing), `.../start/quickstarts/netlify-drop-quickstart/`, `.../build/post-processing/overview/`, `www.netlify.com/pricing/`, and the support-forum answer `answers.netlify.com/t/pretty-urls-with-the-setting-turned-off/8743`.
- Cloudflare: community-forum threads on the `.html` redirect.
- GitHub: community discussions 54257 and 49832 on custom headers.
- Google: Search Console Help "Verify your site ownership" (`support.google.com/webmasters/answer/9008080`), "Sitemaps report" (`.../answer/7451001`), and Business Profile Help "Edit your Business Profile" (`support.google.com/business/answer/3039617`).
- MDN: `Content-Security-Policy-Report-Only`.
- Nominatim: the usage policy `operations.osmfoundation.org/policies/nominatim/` (blocked) and community-forum threads about it; the OpenStreetMap Foundation privacy policy (`osmfoundation.org/wiki/Privacy_Policy`).
- FOSSGIS: the German terms of use `fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/` (blocked).
- Mapbox pricing and token pages (`mapbox.com/pricing`, `docs.mapbox.com/accounts/guides/tokens/`) and Google Maps Platform pricing (`developers.google.com/maps/billing-and-pricing/`), as search summaries.
