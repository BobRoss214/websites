# The claude.ai preview: how to rebuild it, test it and publish it

This folder is NOT part of the website. It holds the tools that make the private preview page on claude.ai
(an "Artifact") that the site builder shows to Mrs. Cathy and Rob.

The preview is one folder of files: `index.html` (the home page), one file for every other page of the site
(`first-visit.html`, `pumpkin-patch.html`, ... and, once they exist, `account.html`, `farm-desk.html`, `kitchen.html`), and the photos
(`assets/photos/...`). Every page file carries its own styles and scripts inside it. The viewer shows one page at a time in a frame; a link from
one page to another opens the other file in the same frame.

## The one command

Before you start, the built pages must be fresh and merged. In the site folder:

```
python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build     # all three, never pages.py alone
git status                                                                                  # nothing should have changed
```

Then, from the site folder, in the background with a log (it waits for the shared lock `/tmp/wa-heavy.lock`, so it can take a while on a busy computer):

```
work-notes/preview/make-preview.sh OUT_DIR > /tmp/preview-make.log 2>&1 &
```

`OUT_DIR` must be OUTSIDE the site folder. To publish from it with the Artifact tool, put it inside the session's scratchpad folder
(for example `<scratchpad>/artifact`). The default is `/tmp/preview-out`.

The command does four things and ends with `READY TO PUBLISH` or `NOT READY` (and an exit code: 0 only for ready):

1. Builds the preview into `OUT_DIR` with the demo and tour switched on (`build-artifact.py`).
2. Builds it again into `OUT_DIR-bare` WITHOUT the switches. That copy is what the real site shows.
3. Checks the first one (`arttest.mjs`): sizes, links, the Sign in button and the Take a tour button on every page, a family request that travels from
   `account.html` to `farm-desk.html` and back, the kitchen, "Start over", the whole tour from the first card to the last (across pages), and a frame
   that refuses all storage. `PREVIEW_TEST_ARGS="--quick"` leaves out the tour walk.
4. Checks the second one: nothing of the demo or the tour may show anywhere.

It takes about 5 minutes when the computer is quiet and 15 to 30 minutes when many helpers are testing at once (it waits for the shared lock first).
Add `PREVIEW_TEST_ARGS="--shots /tmp/preview-shots"` to get pictures of the home page, the family page, the desk, the kitchen and the tour in the pretend viewer.

The pieces can be run on their own:

```
python3 work-notes/preview/build-artifact.py --out DIR                # build (add --no-flags for the copy without the switches; --repo DIR for another site folder)
node work-notes/preview/arttest.mjs --dir DIR [--only static,home,flags,flow,tour,blocked] [--quick] [--shots PICTURE_DIR]
node work-notes/preview/globals-check.mjs DIR                         # two scripts that fight over one top-level name (the build runs it)
```

(`export NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers; unset WA_URL` first; `make-preview.sh` does it for you.)

To look at the result yourself before publishing, serve the folder and open it in a browser (the home page is a fragment, so it has no frame around it here):

```
python3 -m http.server 8099 --bind 127.0.0.1 --directory OUT_DIR      # then open http://127.0.0.1:8099/index.html
```

## Publish (the main session does this; helpers never publish)

With the Artifact tool, to the preview's existing link (`https://claude.ai/artifact/BxpyJpFX8bKixnoHnta2wW`):

- `url`: that link
- `file_path`: `OUT_DIR/index.html`
- `root`: `OUT_DIR`
- `files`: the list in `OUT_DIR/publish-files.json` (every page except the home page, and the photos; about 40 to 45 files)
- do NOT pass `capabilities`, `icon` or `title`: the page keeps its `downloads` capability (the calendar buttons need it), its icon and its title.

`OUT_DIR/build-info.json` and `publish-files.json` say what was built; they are not published. After a publish, `list_files` on the artifact should show the same
files and sizes as `build-info.json`. The page's first lines carry a comment such as `preview build: commit 1a2b3c4; demo and tour flags ON`, so you can always see
which commit is published (it says "plus unsaved changes" when the site folder was not clean: build from a clean folder).

The Artifact allows 16 MB for a page or a file, 255 files and 64 MB in one publish, 511 files and 256 MB in all. The build and the test stop when a limit is passed.
Today (with the three demo pages) the preview is about 45 files and 15 MB.

## What the two switches do

The build puts this as the FIRST script of every page (the real site never has it):

```
window.WA_DEMO = true; window.WA_TOUR = true; window.WA_TOUR_INLINE = true;
```

- `WA_DEMO` turns on the pretend account: the "Sign in" button in the top bar, the demo bar on the three demo pages, and the pages' screens. Without it the three
  demo pages show only a polite box ("This is a demo page. It is not open to visitors.").
- `WA_TOUR` turns on the "Take a tour" button. The page address cannot carry `?demo` or `?tour` inside the viewer (it drops query strings), so these two lines are the only switch there.
- `WA_TOUR_INLINE` tells the tour that its styles (`css/tour.css`) and steps (`js/tour-steps*.js`) are already in the page, so it asks for no file. The build puts them in (flags build only).
- `--no-flags` leaves all three out, and leaves out the tour's styles and steps. That copy must show nothing of the demo or the tour; the test proves it.

The test also keeps a copy of the page the Artifact tool puts around `index.html` (`SKELETON_HEAD` in `arttest.mjs`, measured on the published preview on 3 Nov 2026:
a small style block and `</body></html>`, 546 bytes in all). If the tool changes it, publish once, read the first lines of the published `index.html`, and update that line.

## How the pages find each other

Nothing is rewritten. All page files sit side by side in one folder, so a plain relative link (`first-visit.html`, `account.html`, `index.html#visit`) opens the other
page inside the frame, as the five older pages already did. The demo bar's links (Family, Mrs. Cathy's desk, Kitchen), the "Sign in" button and the tour's trips
between pages work the same way. No link may use a query string; the test checks that, and that every link and picture points at a published file.

A page is found by itself when its file is in the site folder (every `*.html` except `index.html` and `404.html`). The build reads each page's own
`<link rel="stylesheet" href="css/...">` and `<script src="js/...">` tags, so new files named there come along without a change to the build. A script tag may not carry
`defer`, `async` or `type="module"` (the build stops and says so): it turns each tag into an inline script in the same place, which only keeps the order of a plain tag.
Each file stays its own script, exactly as on the real site (the old build joined the later ones into one script). Two files that both declare the same top-level name
(`const x`) would break the second one here just as on the real site; the build says CLASH with both file names and stops.

## What can go wrong in the viewer, and what the build does about it

| What | What the build does |
| --- | --- |
| The pretend account lives in browser storage, shared by the three demo page files (they are one artifact, one address for storage) | Nothing to do: it is shared. The test makes the account on one page and reads it on the other two. |
| A second tab with another page open | The store listens for the `storage` event. The test opens the desk, then sends a request from the family page in another tab, and the desk shows it by itself. Both tabs must show the same preview link, in the same browser. Two devices never share anything. |
| The frame refuses storage (some private windows, "block data from other sites", an old Safari setting) | A small preview-only piece (the first script after the flags) keeps the data of the tab in `window.name`, so the account still follows the visitor from page to page. Closing the tab forgets it. The test uses a frame with no storage at all. |
| A republish keeps the old pretend data in the browser | Press "Start over" in the demo bar after a publish that changes the demo. |
| The viewer refuses `alert`, `confirm`, `prompt`, `window.open`, `window.print` and downloads by `<a download>` | The demo and the tour use boxes of their own. Calendar files go through the viewer's own save box (`window.claude.use('downloads')`), set up in the preview-only code at the front of `js/i18n.js`. The test stands in for that box. |
| The viewer drops query strings and only passes a plain `#name` | `?demo` and `?tour` cannot be used; the flags above replace them. The tour keeps its place in storage, not in the address. |
| Observers ignore `rootMargin` in the viewer's frame | Already handled by the preview-only code (menu highlight, fade-ins). |
| Anything fetched later (a script or style file loaded by code) | Not possible to rely on: only published files exist. The build puts everything in the page, and the test fails on any request for a `js/` or `css/` file or any file that was not published. |

## What the test cannot know (check these by eye in the real viewer after a publish)

The tests run in Chromium with a pretend viewer. They cannot open claude.ai. After a publish, open the link and look at:

1. The home page loads, fonts and photos show, the top bar has the small person button ("Sign in") next to the language button, and the "Take a tour" pill sits where it covers nothing.
2. Click Sign in. `account.html` opens inside the same frame. Create an account (the "Fill in sample details" link helps). A sample visit appears.
3. Press "Request a different day" and send. It says "Waiting for a reply from Mrs. Cathy".
4. In the demo bar press "Mrs. Cathy's desk". The request waits there. Answer Yes. Press "Family": the visit moved. Press "Kitchen": the pizza orders are there.
5. The browser's Back button goes back from page to page. Reload the page in the middle: the account is still there.
6. "Add to calendar": the viewer's save box appears (it may ask you to confirm).
7. Open the preview in two browser tabs. Send a request in one tab and watch the desk in the other: it should update by itself (if it does not, only a reload is missing; tell the builder).
8. "Take a tour": Start the tour, press Next all the way. The chapters about the account demo go to the three demo pages and come back. Close it half way and open it again: "Continue where I stopped".
9. A phone-width window: the Sign in button and the tour pill do not cover each other or the basket box.
10. "Start over" empties the demo.

## If the check says FAIL

| The FAIL line says | Likely cause and what to do |
| --- | --- |
| `build-info.json is not there` | The build did not run, or it stopped. Read the lines above it. |
| `ERROR: ... has the attribute(s) defer` | A script tag in a page has `defer`, `async` or `type="module"`. Use a plain `<script src="js/x.js"></script>`. |
| `CLASH: ...` | Two files declare the same top-level name. Make each file one `(function () { ... })();`. |
| `... points at a published file` | A link or picture names a file that is not in the preview (a page not built, a photo not in `assets/photos`). Run the three pipeline commands and build again. |
| `the FIRST script sets WA_DEMO ...` | Something else was put in front of the flags. It is a bug in `build-artifact.py`. |
| `no page asked for a css/ or js/ file` | A script loads a file by code. Tell its owner: in the preview everything must already be in the page (`WA_TOUR_INLINE` covers the tour). |
| `the "Sign in" button ...` or `the "Take a tour" button ...` | `js/demo-header.js` or `js/tour.js` is not on that page, or the flags script did not run first. |
| `farm-desk.html ... storage event` | The desk does not listen for changes made in another tab, or the two tabs are not sharing storage. |
| `LIMIT: ...` (in the build) | A file or the whole preview is over the Artifact's limits. |
| Many FAILs that say `did not finish starting` | A script threw an error at load. Look at the `pageerror` lines at the end. |

A failure that does not come back on a second run is most likely the busy computer (the test says so at the end); run it again alone, or set `WA_SLOW=10`.

## Files in this folder

| File | What it is |
| --- | --- |
| `make-preview.sh` | The one command (build with and without the switches, then check both). |
| `build-artifact.py` | Builds the preview folder. `--no-flags`, `--repo`, `--out`. Reads no absolute path: the site folder is the one this file sits in. |
| `arttest.mjs` | Checks a built folder in a pretend viewer (a frame from another address, the Artifact tool's own page around the home page). |
| `globals-check.mjs` | Finds two scripts of a page that fight over a top-level name. |
| `merge_art.py`, `apply_corrections.py` | Old helpers from the Shop drawings and the translation fixes; not part of the preview any more. |
