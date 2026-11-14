#!/bin/bash
# make_real_branch.sh: make the branch `real-update` for the REAL website (a scratch clone; nothing is pushed, /home/user/websites and /tmp/integ-clone are only read).
#
#   sh /tmp/helpers/make_real_branch.sh <integ-ref> <out-dir>
#
#   <integ-ref>   a branch, tag or commit of the integ clone (/tmp/integ-clone), for example  HEAD  or  integ  or a short hash. It is turned into a full hash and printed.
#   <out-dir>     a folder that does not exist yet (or is empty): the scratch clone is made there. Under /tmp, outside both repos.
#
# What it does (the builder's rule: the tour and the Store's pretend ingredient lists are for the preview only; the real tip already carries the first, hidden demo):
#   1. clones the real repo (default branch, its tip is the live site) into <out-dir>, and points `origin` at GitHub with the push URL switched OFF
#      (a plain `git push` fails on purpose: the push is a separate, deliberate step, see PUSH_PLAN.md)
#   2. makes the branch `real-update` on top of the real tip, in a few commits. Each commit is a whole working site: the integ tree at a milestone of its history
#      (the end of 9 Nov, the Beer/Store merge, the last winter merge, the final state), with the preview-only files and lines taken out, and the full pipeline
#      (tools/pages.py, tools/i18n.py extract, tools/i18n.py build, and `jsstrings` between the last two, as tools/doctor.py does) run on it. Milestones that are
#      not found are skipped; the last commit is always the final state.
#         always taken out: the tour (js/tour*.js, css/tour*.css and every <script>/<link> line for them), the Store's pretend lists js/shop-sample.js and its line,
#         and (default; KEEP_SHOP_LOADER=1 keeps them) the dormant Store loader js/shop-pop.js, js/shop-pop-box.js, css/shop-pop.css and the line for the loader.
#         the pretend account/desk/kitchen demo, two ways (DEMO=tip or DEMO=integ):
#           A  DEMO=tip (default)  the demo is the one the real tip has, byte for byte: js/demo-*.js, css/demo*.css, pages/{account,farm-desk,kitchen}.html (the sources),
#                                  docs/ACCOUNT_DEMO.md and its two tests come from the tip; integ's newer demo files (js/demo-live.js, css/demo-visits.css ...) and
#                                  tests are left out; the <script src="js/demo-header.js"> lines stay. The built pages account.html, farm-desk.html and kitchen.html
#                                  are made again by tools/pages.py (they carry the site's header and footer, which changed).
#           B  DEMO=integ          the demo is integ's newer one (adds js/demo-live.js, css/demo-visits.css, the new desk and kitchen); nothing of it is taken out
#   3. checks: nothing preview-only is left (files, script and link lines), nothing that stays loads a removed file, the pipeline leaves a clean tree
#      (a second run changes nothing), every new commit ends with the two trailers
#   4. prints the diffstat against the real tip, the files added / removed / changed, and the check commands to run in <out-dir>
#   5. builds the upload folder with tools/make_deploy_folder.py (it copies EVERY file of js/ and css/ and every top-level .html, so a preview file left in the branch
#      would be uploaded: they are out of the branch), checks none of the removed files is in it, prints the files with their sizes
#   6. runs the quick tests that need no browser; every one that fails is run again on integ itself, to say whether the real set caused it
#      Tests/notes follow the removal (PREVIEW_TESTS=follow): the tests of the removed features, their README rows, docs/TOUR.md and the README paragraph about the
#      pop-up go, and ONE static check is added to tests/code-rules.test.mjs of the real branch: no page and no js/ or css/ file is a preview-only file.
# Files for the notes (outside the repo): <out-dir>.info/  (removed.txt, name-status.txt, diffstat.txt, files-*.txt, pipeline-*.log, run-checks.sh)
#
# Exit code: 0 all fine; 2 bad arguments or missing tool; 3 the real tip is not part of integ's history (see ALLOW_DIVERGED); 4 a preview-only thing is left;
#            5 the pipeline stopped or the tree is not stable after it; 6 a stay-file loads a removed file; 7 trailers missing; 8 the demo is not what DEMO says.
# Environment (all optional):
#   INTEG_REPO=/tmp/integ-clone   REAL_REPO=/home/user/websites   REAL_BRANCH=claude/wise-acres-redesign-w9m4bi   NEW_BRANCH=real-update
#   DEMO=tip|integ        see above (default tip)
#   ONE_COMMIT=1          one commit with the final state only (no milestones)
#   KEEP_SHOP_LOADER=1    keep the dormant Store loader (js/shop-pop.js, js/shop-pop-box.js, css/shop-pop.css and the script line); only js/shop-sample.js goes
#   PREVIEW_TESTS=follow|keep   follow (default): the tests and notes of the removed features go with them (see PUSH_PLAN.md, "tests"); keep: tests/ and docs/ stay as in integ
#   (a second run into the same <out-dir> deletes the clone the first run made, found by a marker inside its .git, and makes it again; any other folder is refused)
#   RUN_TESTS=1|0|all     1 (default): run the quick tests that need no browser, and again on integ for every one that fails; 0: none; all: every test that needs no browser
#   ALLOW_DIVERGED=1      go on although the real tip is not an ancestor of the integ ref (the real repo got commits that integ does not have: they would be overwritten)
#   KEEP_SNAPSHOTS=1      keep the scratch folders <out-dir>.info/snap-*

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi   # `sh make_real_branch.sh` runs dash on this computer
set -u
set -o pipefail

REF="${1:-}"; OUT_ARG="${2:-}"
case "$REF" in -h|--help|"") sed -n '2,/^[^#]/{/^#/p}' "$0" | sed 's/^# \{0,1\}//'; [ -n "$REF" ] && exit 0; exit 2;; esac
[ -n "$OUT_ARG" ] || { echo "usage: sh make_real_branch.sh <integ-ref> <out-dir>   (--help says more)"; exit 2; }

INTEG="${INTEG_REPO:-/tmp/integ-clone}"
REAL="${REAL_REPO:-/home/user/websites}"
BRANCH="${REAL_BRANCH:-claude/wise-acres-redesign-w9m4bi}"
NEW="${NEW_BRANCH:-real-update}"
DEMO="${DEMO:-tip}"
PREVIEW_TESTS="${PREVIEW_TESTS:-follow}"
TRAILERS=$'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_016TmrCsikkBKpN9HzniSTFT'
export PYTHONDONTWRITEBYTECODE=1 LC_ALL=C.UTF-8
export GIT_OPTIONAL_LOCKS=0   # a git command that only reads (status, log) must not even refresh the index of /tmp/integ-clone or /home/user/websites
export NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}"
export KEEP_SHOP_LOADER="${KEEP_SHOP_LOADER:-}"

die() { local code="$1"; shift; echo; echo "STOP: $*"; exit "$code"; }
say() { printf '\n==== %s\n' "$*"; }
case "$DEMO" in tip|integ) ;; *) die 2 "DEMO must be tip or integ, not '$DEMO'";; esac
case "$PREVIEW_TESTS" in follow|keep) ;; *) die 2 "PREVIEW_TESTS must be follow or keep, not '$PREVIEW_TESTS'";; esac
OUT="$(realpath -m -- "$OUT_ARG")"   # no folder is made before the checks below have said the place is fine
INFO="$OUT.info"

# ------------------------------------------------------------------ 0. the machine and the arguments
say "0. the machine and the arguments"
for c in git python3 node tar; do command -v "$c" >/dev/null 2>&1 || die 2 "missing program: $c"; done
python3 -c 'import bs4' 2>/dev/null || die 2 "python3 needs the beautifulsoup4 package (python3 -m pip install beautifulsoup4)"
[ -d "$INTEG/.git" ] || die 2 "$INTEG is not a git folder (INTEG_REPO)"
[ -d "$REAL/.git" ] || die 2 "$REAL is not a git folder (REAL_REPO)"
case "$OUT" in "$REAL"|"$REAL"/*|"$INTEG"|"$INTEG"/*) die 2 "the out folder must be outside both repos: $OUT";; /tmp/?*) ;; *) die 2 "the out folder must be under /tmp: $OUT";; esac
SHA="$(git -C "$INTEG" rev-parse --verify --quiet "$REF^{commit}")" || die 2 "unknown integ-ref: $REF (not a branch, tag or commit of $INTEG)"
mkdir -p -- "$(dirname "$OUT")" || die 2 "cannot make the folder for $OUT"
LOCK="/tmp/make_real_branch.$(printf '%s' "$OUT" | cksum | cut -d' ' -f1).lock"
exec 9> "$LOCK"
flock -n 9 || die 2 "another run of this script into $OUT is going (it holds $LOCK): wait for it"
if [ -e "$OUT" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then   # safe to run twice: a folder this script made (it carries a marker inside .git) is made again; any other folder is never touched
  if [ -f "$OUT/.git/made-by-make_real_branch" ]; then echo "NOTE: $OUT was made by an earlier run of this script: it is deleted and made again (nothing else is touched)"; rm -rf -- "$OUT" "$INFO"
  else die 2 "$OUT exists and was not made by this script: use another folder (nothing was changed)"; fi
fi
if [ -e "$INFO" ] && [ ! -f "$INFO/made-by-make_real_branch" ] && [ -n "$(ls -A "$INFO" 2>/dev/null)" ]; then die 2 "$INFO exists and was not made by this script (nothing was changed)"; fi
rm -rf -- "$INFO"; mkdir -p "$INFO"; echo "made by make_real_branch.sh" > "$INFO/made-by-make_real_branch"
SHORT="$(git -C "$INTEG" rev-parse --short "$SHA")"
echo "$(date '+%F %T'), load $(cut -d' ' -f1-3 /proc/loadavg) on $(nproc) cores; node $(node --version), $(python3 --version 2>&1)"
echo "integ ref '$REF' = $SHA ($(git -C "$INTEG" log -1 --format=%s "$SHA" | cut -c1-110))"
[ -z "$(git -C "$INTEG" status --porcelain 2>/dev/null)" ] || echo "NOTE: $INTEG has uncommitted changes; only commits are used"
if [ "$DEMO" = tip ]; then echo "demo: A (DEMO=tip): the pretend account demo stays exactly as the real tip has it; integ's newer demo files are left out"
else echo "demo: B (DEMO=integ): the pretend account demo is integ's newer one"; fi
echo "tests and notes of the removed features: $PREVIEW_TESTS; Store loader (js/shop-pop.js): $([ "${KEEP_SHOP_LOADER:-}" = 1 ] && echo kept || echo taken out)"

# ------------------------------------------------------------------ 1. a scratch clone of the real repo
say "1. the real repo (default branch $BRANCH) cloned into $OUT"
git clone -q --no-hardlinks "$REAL" "$OUT" || die 2 "git clone of $REAL failed"
git -C "$OUT" checkout -q "$BRANCH" || die 2 "the real repo has no branch $BRANCH"
echo "made by make_real_branch.sh on $(date +%F\ %T)" > "$OUT/.git/made-by-make_real_branch"
git -C "$OUT" config user.name  >/dev/null 2>&1 || git -C "$OUT" config user.name Claude
git -C "$OUT" config user.email >/dev/null 2>&1 || git -C "$OUT" config user.email noreply@anthropic.com
REAL_TIP="$(git -C "$OUT" rev-parse HEAD)"
GITHUB_URL="$(git -C "$REAL" config --get remote.origin.url 2>/dev/null || true)"
if [ -n "$GITHUB_URL" ]; then   # `git push` from the scratch clone fails on purpose; the plan names the one deliberate command
  git -C "$OUT" remote set-url origin "$GITHUB_URL"
  git -C "$OUT" config remote.origin.pushurl "PUSH-IS-OFF--see-PUSH_PLAN.md"
fi
TIP_DIR="$INFO/tip"; mkdir -p "$TIP_DIR"
git -C "$OUT" archive --format=tar "$REAL_TIP" | tar -x -C "$TIP_DIR" || die 2 "git archive of the real tip failed"
echo "real tip: $(git -C "$OUT" log -1 --format='%h (%ad): %s' --date=short | cut -c1-140)"
echo "          $(git -C "$OUT" ls-files | wc -l) files tracked; origin = ${GITHUB_URL:-?} (push switched off in this clone)"
if [ -n "$GITHUB_URL" ] && theirs="$(timeout 40 git ls-remote "$GITHUB_URL" "refs/heads/$BRANCH" 2>/dev/null | cut -f1)" && [ -n "$theirs" ]; then
  if [ "$theirs" = "$REAL_TIP" ]; then echo "GitHub says the same: $BRANCH is at ${theirs:0:7}"; else echo "WARNING: GitHub has $BRANCH at ${theirs:0:7}, not ${REAL_TIP:0:7}: the local real repo is behind or ahead; look at that before any push"; fi
else echo "NOTE: could not ask GitHub for the tip of $BRANCH (no network or no access); check it with git ls-remote before any push"; fi
git -C "$INTEG" cat-file -e "$REAL_TIP^{commit}" 2>/dev/null && git -C "$INTEG" merge-base --is-ancestor "$REAL_TIP" "$SHA"
anc=$?
if [ $anc -eq 0 ]; then echo "the real tip is part of integ's history ($(git -C "$INTEG" rev-list --count "$REAL_TIP..$SHA") commits on top of it): nothing in the real repo is lost by taking integ's tree"
elif [ "${ALLOW_DIVERGED:-}" = 1 ]; then echo "WARNING: the real tip is NOT part of integ's history; ALLOW_DIVERGED=1, so integ's tree replaces what the real repo has"
else die 3 "the real tip ${REAL_TIP:0:7} is not part of integ's history: the real repo has commits that integ has not (or this is a second push). Their changes would be overwritten. Look at 'git -C $OUT log --oneline' and bring them into integ, or set ALLOW_DIVERGED=1"; fi
git -C "$OUT" checkout -q -b "$NEW"

# ------------------------------------------------------------------ the helpers: strip, overlay, pipeline, tests of removed features
STRIP_PY="$INFO/strip.py"
cat > "$STRIP_PY" <<'PY'
# strip.py ROOT LISTFILE: take the preview-only files and the lines that load them out of ROOT (a folder with no .git). Prints what it did.
import glob, os, re, sys
root, listfile = sys.argv[1], sys.argv[2]
keep_loader = os.environ.get('KEEP_SHOP_LOADER') == '1'
GROUPS = [
    ('the tour',                              ['js/tour*.js', 'css/tour*.css']),
    ('the Store\'s pretend ingredient lists', ['js/shop-sample.js']),
]
if not keep_loader:
    GROUPS.append(('the Store\'s pop-up loader (dormant without the lists)', ['js/shop-pop.js', 'js/shop-pop-box.js', 'css/shop-pop.css']))
removed, by_group = [], []
for name, pats in GROUPS:
    n = 0
    for pat in pats:
        for p in sorted(glob.glob(os.path.join(root, pat))):
            if os.path.isfile(p):
                os.remove(p); removed.append(os.path.relpath(p, root).replace(os.sep, '/')); n += 1
    by_group.append((name, n))
js_names = r'tour[\w.-]*|shop-sample' + ('' if keep_loader else r'|shop-pop(?:-box)?')
css_names = r'tour[\w.-]*' + ('' if keep_loader else r'|shop-pop')
script_re = re.compile(r'^[ \t]*<script\b[^>\n]*\bsrc\s*=\s*["\']js/(?:' + js_names + r')\.js(?:\?[^"\']*)?["\'][^>\n]*>[ \t]*</script>[ \t]*\r?\n', re.M)
link_re = re.compile(r'^[ \t]*<link\b[^>\n]*\bhref\s*=\s*["\']css/(?:' + css_names + r')\.css(?:\?[^"\']*)?["\'][^>\n]*>[ \t]*\r?\n', re.M)
lines_out, files_edited = 0, []
for pat in ('*.html', 'pages/*.html', 'print/*.html'):
    for p in sorted(glob.glob(os.path.join(root, pat))):
        with open(p, encoding='utf-8', newline='') as f:
            text = f.read()
        new, n1 = script_re.subn('', text)
        new, n2 = link_re.subn('', new)
        if n1 + n2:
            with open(p, 'w', encoding='utf-8', newline='') as f:
                f.write(new)
            lines_out += n1 + n2; files_edited.append('%s (%d)' % (os.path.relpath(p, root).replace(os.sep, '/'), n1 + n2))
with open(listfile, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sorted(removed)) + ('\n' if removed else ''))
print('removed %d files: %s' % (len(removed), '; '.join('%s %d' % g for g in by_group)))
print('removed %d script/link lines from %d html files: %s' % (lines_out, len(files_edited), ', '.join(files_edited) or '-'))
PY

OVERLAY_PY="$INFO/overlay.py"
cat > "$OVERLAY_PY" <<'PY'
# overlay.py SNAP TIPDIR LISTFILE: (DEMO=tip) the pretend account demo is what the real tip has, byte for byte. The files that belong to the demo are taken from
# TIPDIR (the real tip) over the snapshot; a demo file that only integ has is taken out and written to LISTFILE (the list of files left out). The built pages
# account.html, farm-desk.html and kitchen.html are not copied: tools/pages.py makes them again from the sources, with the site's header and footer.
import filecmp, glob, os, shutil, sys
snap, tip, listfile = sys.argv[1:4]
OWNED = ['js/demo-*.js', 'css/demo*.css', 'pages/account.html', 'pages/farm-desk.html', 'pages/kitchen.html', 'tests/demo-*.test.mjs', 'docs/ACCOUNT_DEMO.md']
def found(base):
    out = set()
    for pat in OWNED:
        for p in glob.glob(os.path.join(base, pat)):
            if os.path.isfile(p):
                out.add(os.path.relpath(p, base).replace(os.sep, '/'))
    return out
tip_files, snap_files = found(tip), found(snap)
dropped = sorted(snap_files - tip_files)
for f in dropped:
    os.remove(os.path.join(snap, f))
changed, added = [], []
for f in sorted(tip_files):
    src, dst = os.path.join(tip, f), os.path.join(snap, f)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy2(src, dst); added.append(f)
    elif not filecmp.cmp(src, dst, shallow=False):
        shutil.copy2(src, dst); changed.append(f)
site_dropped = [f for f in dropped if not f.startswith(('tests/', 'docs/'))]
with open(listfile, 'a', encoding='utf-8') as fh:
    fh.write(''.join(f + '\n' for f in site_dropped))
print('demo as on the real tip: %d demo files, %d of them differ from integ and are put back (%s), %d that integ had deleted are put back (%s)' % (
    len(tip_files), len(changed), ' '.join(os.path.basename(f) for f in changed[:6]) + (' ...' if len(changed) > 6 else ''), len(added), ' '.join(added) or '-'))
print('left out because the real tip does not have them: %s' % (' '.join(dropped) or '-'))
PY

pipeline() {   # pipeline <dir> <log>: the full rebuild, in the order the notes ask for (never pages.py alone). The step `jsstrings` is the one tools/doctor.py and
  # tools/change_fact.py run between extract and build: without it lang/js-strings.json would still list the texts of the removed js/shop-pop-box.js.
  ( cd "$1" && python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py jsstrings && python3 tools/i18n.py build ) > "$2" 2>&1
}

TESTS_PY="$INFO/preview_tests.py"
cat > "$TESTS_PY" <<'PY'
# preview_tests.py ROOT REMOVED_LIST MODE [TIPDIR]
#   list    print the tests of the removed features: a "// covers:" line whose file names are mostly files that are not there (REMOVED_LIST), or a name that starts
#           with tour, demo, account, kitchen or shop-pop and covers such a file, or a test that opens a removed file (read('js/tour-steps-c.js')).
#           With TIPDIR (DEMO=tip): also every such name that the real tip did not have.
#   follow  make the tests and notes follow the removal, nothing else: delete those tests, their rows in tests/README.md and their lines in tests/timings.json, and
#           delete docs/TOUR.md (the docs test fails on a note that names a file that is not there).
import fnmatch, os, re, sys
root, removed_file, mode = sys.argv[1:4]
tipdir = sys.argv[4] if len(sys.argv) > 4 else ''
removed = [l.strip() for l in open(removed_file, encoding='utf-8') if l.strip()]
removed_set = set(removed)
tdir = os.path.join(root, 'tests')
kept = []
for d, _, names in os.walk(root):
    if '.git' in d.split(os.sep):
        continue
    kept += [os.path.relpath(os.path.join(d, n), root).replace(os.sep, '/') for n in names]
def names_removed(entry):
    if '*' not in entry:
        return entry in removed_set
    return any(fnmatch.fnmatch(p, entry) for p in removed) and not any(fnmatch.fnmatch(k, entry) for k in kept)
tip_tests = set()
if tipdir and os.path.isdir(os.path.join(tipdir, 'tests')):
    tip_tests = {f[:-len('.test.mjs')] for f in os.listdir(os.path.join(tipdir, 'tests')) if f.endswith('.test.mjs')}
PREVIEW_NAME = re.compile(r'^(tour|demo|account|kitchen|shop-pop)')
found = []
for f in sorted(os.listdir(tdir)) if os.path.isdir(tdir) else []:
    if not f.endswith('.test.mjs'):
        continue
    name = f[:-len('.test.mjs')]
    covers = []
    for line in open(os.path.join(tdir, f), encoding='utf-8').read().split('\n')[:12]:
        h = re.match(r'^//\s*covers\s*:\s*(.*?)\s*$', line)
        if h:
            covers += [x for x in re.split(r'[\s,]+', h.group(1)) if x]
    gone = [e for e in covers if names_removed(e)]
    naming = [e for e in covers if '*' not in e or names_removed(e)]
    source = open(os.path.join(tdir, f), encoding='utf-8').read()
    reads = [r for r in removed if re.search(r'read\w*\([^)\n]*[\'"]' + re.escape(r) + r'[\'"]', source)]   # the test reads a removed file (read('js/tour-steps-c.js'))
    if gone and (PREVIEW_NAME.match(name) or 2 * len(gone) >= len(naming)):
        found.append(name)
    elif reads:
        found.append(name)   # it opens a removed file: it cannot pass without it
    elif tipdir and PREVIEW_NAME.match(name) and name not in tip_tests:
        found.append(name)   # DEMO=tip: a test of the newer demo or of the tour; the real tip did not have it
if mode == 'list':
    print(' '.join(found))
    sys.exit(0)
for name in found:
    os.remove(os.path.join(tdir, name + '.test.mjs'))
print('tests taken out (%d): %s' % (len(found), ' '.join(found)))
readme = os.path.join(tdir, 'README.md')
if os.path.exists(readme):
    text = open(readme, encoding='utf-8', newline='').read()
    out, dropped = [], 0
    for line in text.split('\n'):
        m = re.match(r'^\|\s*`([a-z0-9-]+)`\s*\|', line)
        # a row goes when its test was taken out here, or when it is the row of a test of the removed features whose file is not there at all (DEMO=tip leaves integ's newer demo tests out before this step)
        if m and (m.group(1) in found or (PREVIEW_NAME.match(m.group(1)) and not os.path.exists(os.path.join(tdir, m.group(1) + '.test.mjs')))):
            dropped += 1
            continue
        out.append(line)
    if dropped:
        open(readme, 'w', encoding='utf-8', newline='').write('\n'.join(out))
    print('tests/README.md: %d rows taken out' % dropped)
top = os.path.join(root, 'README.md')   # the one sentence block of the Shop row that says the pop-up lists are in js/shop-sample.js (a removed file)
if os.path.exists(top):
    text = open(top, encoding='utf-8', newline='').read()
    new_text, n = re.subn(r' \*\*Ingredient pop-up \(preview only\)\.\*\*[^\n]*?(?= \|[ \t]*$)', '', text, flags=re.M)
    if n:
        open(top, 'w', encoding='utf-8', newline='').write(new_text)
        print('README.md: the paragraph about the preview-only ingredient pop-up taken out (%d)' % n)
tfile = os.path.join(tdir, 'timings.json')
if os.path.exists(tfile) and found:
    lines = open(tfile, encoding='utf-8', newline='').read().split('\n')
    keep_lines = [l for l in lines if not re.match(r'^\s*"(%s)"\s*:' % '|'.join(re.escape(n) for n in found), l)]
    if len(keep_lines) != len(lines):
        open(tfile, 'w', encoding='utf-8', newline='').write('\n'.join(keep_lines))
        print('tests/timings.json: %d entries taken out' % (len(lines) - len(keep_lines)))
p = os.path.join(root, 'docs', 'TOUR.md')
if os.path.exists(p):
    os.remove(p)
    print('note of the tour taken out: docs/TOUR.md')
import glob
for path in glob.glob(os.path.join(root, 'docs', '*.md')) + [os.path.join(root, 'README.md')]:   # a bullet "- `tests/NAME.test.mjs`: ..." of a test taken out goes too (docs/ACCOUNT_DEMO.md with DEMO=integ)
    if not os.path.exists(path):
        continue
    lines = open(path, encoding='utf-8', newline='').read().split('\n')
    keep = [l for l in lines if not ((m := re.match(r'^[-*] `tests/([a-z0-9-]+)\.test\.mjs`', l)) and m.group(1) in found)]
    if len(keep) != len(lines):
        open(path, 'w', encoding='utf-8', newline='').write('\n'.join(keep))
        print('%s: %d bullets about the tests taken out' % (os.path.relpath(path, root), len(lines) - len(keep)))
# one static check for the real website only (integ loads these files on purpose, so it cannot live there): no page and no js/ or css/ file is a preview-only file
keep_loader = os.environ.get('KEEP_SHOP_LOADER') == '1'
js_alt = r'tour[\w.-]*|shop-sample' + ('' if keep_loader else r'|shop-pop(?:-box)?')
css_alt = r'tour[\w.-]*' + ('' if keep_loader else r'|shop-pop')
GUARD = r'''
/* ---- added for the real website by make_real_branch.sh: the preview-only files are on no public page and not in js/ or css/ ---- */
const PREVIEW_ONLY = /(?:js\/(?:@@JS@@)\.js|css\/(?:@@CSS@@)\.css)/;
ok('(tried on a bad sample first) a page that loads the tour is found, one that does not is not', PREVIEW_ONLY.test('<script src="js/tour.js"></script>') && !PREVIEW_ONLY.test('<script src="js/main.js"></script>'));
const previewPages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).filter((f) => PREVIEW_ONLY.test(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '')));
ok('no public page names the tour or the Store\'s pretend lists (js/tour*.js, css/tour*.css, js/shop-sample.js, js/shop-pop*.js, css/shop-pop.css): they are for the preview only, and the tour would write wa-tour into the visitor\'s browser (docs/WHAT_THE_SITE_STORES.md)', previewPages.length === 0, previewPages.join(', '));
const previewFiles = ['js', 'css'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).map((f) => d + '/' + f)).filter((f) => PREVIEW_ONLY.test(f));
ok('none of those files is in js/ or css/ (tools/make_deploy_folder.py uploads every file of both)', previewFiles.length === 0, previewFiles.join(', '));
'''.replace('@@JS@@', js_alt).replace('@@CSS@@', css_alt)
cr = os.path.join(tdir, 'code-rules.test.mjs')
if os.path.exists(cr):
    text = open(cr, encoding='utf-8', newline='').read()
    i = text.rfind('await finish(')
    if i < 0 or 'PREVIEW_ONLY' in text:
        print('WARNING: the static check for the preview-only files was not added to tests/code-rules.test.mjs (%s)' % ('already there' if i >= 0 else 'no finish() found'))
    else:
        open(cr, 'w', encoding='utf-8', newline='').write(text[:i] + GUARD.lstrip('\n') + text[i:])
        print('tests/code-rules.test.mjs: one static check added (no page and no js/ or css/ file is a preview-only file)')
PY

# ------------------------------------------------------------------ the commit messages (plain words, then the two trailers)
footer() {   # footer <integ-short>
  printf '\nBuilt from the integ branch at %s, without the tour and the Store'"'"'s pretend ingredient lists (preview only), with the pages and translations made again.\n' "$1"
  if [ "$DEMO" = tip ]; then printf 'The pretend account demo stays as it is on the real tip (hidden unless the demo flag is on).\n'
  else printf 'The pretend account demo is the newer one from integ (hidden unless the demo flag is on).\n'; fi
  printf '\n%s\n' "$TRAILERS"
}
msg_file() {   # msg_file <name> <integ-short> <subject> <body lines...>
  local f="$INFO/msg-$1.txt" short="$2" subject="$3"; shift 3
  { printf '%s\n\n' "$subject"; printf '%s\n' "$@"; footer "$short"; } > "$f"
  echo "$f"
}

# ------------------------------------------------------------------ the milestones: <name>|<grep for a first-parent commit of integ>
MILESTONES=(
  "everything|^Hand-off note: Version 50"
  "store|^Merge beerwine: new Store group"
  "winter|^Merge wintertrees: winter picture: whole trees"
)
msg_for() {   # msg_for <name> <commit-short>: writes the message for a milestone, prints its file
  case "$1" in
    everything) msg_file everything "$2" "Everything built since 3 November, up to the end of 9 November" \
"The top menu is seven grouped drop-downs (Visit, Things to Do, GreenHouse, Store, Groups & Parties, About Us, Contact). The Store on a computer has two columns and tighter" \
"cards, with a clear gap above the farm bar and three cards across from 1264 px. The hero has more people at the sides of the spring field, a friend button that picks a" \
"friend you can see, sunflowers at the sides that can be snipped, calmer falling leaves, and a bee and butterfly that fly smoothly and no longer freeze or jump back." \
"Dates and words: u-pick tomatoes and basil run the fall dates (mid-September to the first weekend in November), a \"Next\" tag marks the season that starts next, the wagon" \
"ride is free for ages 3 and younger, \"small\" is out of \"small sunn hemp maze\", and Ava's and Vanessa's e-mail show where school tours, The GreenHouse and the pizza are." \
"Link and button names say the words you see. Wording fixes in the Spanish, Hindi, Chinese and Vietnamese texts." ;;
    store) msg_file store "$2" "Store: less empty space in the boxes, new group Beer, cider & wine" \
"The Store boxes hold less empty space: rows stay one height and a few long-note boxes are two wide. A new Store group, \"Beer, cider & wine\", lists the 16 drinks from the" \
"farm's chalkboard at \$6 each; the NA Brooklyn Hoppy Amber card says it is non-alcoholic. The Christmas trees in the winter picture are 1.5 times as tall and wide." ;;
    winter) msg_file winter "$2" "Winter: tree weekends, winter dates and winter words in five languages" \
"Christmas trees are sold only on the last weekend in November and the first weekend in December, Saturday and Sunday only (2026: 28-29 November and 5-6 December; worked out" \
"each year from the rule). Winter starts on the first tree day, and when no season is live the site opens on the next season. The farm is open only those two weekends, with no" \
"reservation and no rides. The GreenHouse is open and serves pizza 11 am to 8 pm on those weekends, with a small \"Not official yet\" label next to the pizza and the hours." \
"Tomatoes ended on 8 November, so nothing in winter mentions them. The winter words are on every page in English, Spanish, Hindi, Vietnamese and Chinese, reviewed and made" \
"plainer. In the winter picture whole trees show in 4:3 windows and no tree stands right behind another." ;;
  esac
}
final_message() {   # the last commit: what came after the last milestone (only the integ commits that touch files that are in the real tree), or the whole story when it is the only commit
  local prev="$1" f="$INFO/msg-final.txt" subj body paths gone='^(js/(tour|shop-sample|shop-pop)|css/(tour|shop-pop)|tests/(tour|shop-pop)|docs/TOUR\.md$)'
  if [ -z "$prev" ]; then
    subj="Everything built since 3 November: menu, Store, hero, winter, beer and wine, words"
    body="The real-site part of everything built on the integ branch since the last push (the top menu, the Store in two columns, the spring field and bee fixes, the tomatoes dates,
the Next tag, the Beer, cider & wine group, and the winter rules and words in five languages)."
  else
    [ "$DEMO" = tip ] && gone="$gone|^(js/demo-|css/demo|account\.html|farm-desk\.html|kitchen\.html|pages/(account|farm-desk|kitchen)\.html|tests/(demo-|account-|kitchen-)|docs/ACCOUNT_DEMO\.md)"
    paths="$(git -C "$INTEG" diff --name-only "$prev" "$SHA" | grep -v -E "$gone" | tr '\n' ' ')"
    if [ -z "$paths" ]; then subj="Last fixes, up to the final state"; body="(nothing in the real tree changed after the last milestone)"
    else
      if printf '%s\n' $paths | grep -qv -E '^(tests|docs|work-notes|tools|patches)/|^README\.md$'; then subj="Last fixes to the site, the tests and the notes after the winter work"
      else subj="Tests and notes brought up to date after the winter work (the site itself does not change)"; fi
      body="What came after, from the integ commits that touch these files ($paths); commits about the tour, the pretend demo or the pop-up are left out of this list:
$(git -C "$INTEG" log --no-merges --format='- %s' "$prev..$SHA" -- $paths | grep -v -i -E 'tour|pretend|demo|pop-up|ingredient|preview|kitchen' | cut -c1-150 | head -30)"
    fi
  fi
  { printf '%s\n\n%s\n' "$subj" "$body"; footer "$SHORT"; } > "$f"
  echo "$f"
}

# ------------------------------------------------------------------ one snapshot: integ tree at <sha>, stripped, rebuilt, committed
snapshot() {   # snapshot <label> <sha> <msg-file> <final:0|1>
  local label="$1" sha="$2" msg="$3" final="$4" snap="$INFO/snap-$1"
  rm -rf -- "$snap"; mkdir -p "$snap"
  git -C "$INTEG" archive --format=tar "$sha" | tar -x -C "$snap" || die 2 "git archive of $sha failed"
  python3 -I "$STRIP_PY" "$snap" "$INFO/removed-$label.txt" | sed 's/^/  /'
  if [ "$DEMO" = tip ]; then python3 -I "$OVERLAY_PY" "$snap" "$TIP_DIR" "$INFO/removed-$label.txt" | sed 's/^/  /'; fi
  if [ "$PREVIEW_TESTS" = follow ]; then python3 -I "$TESTS_PY" "$snap" "$INFO/removed-$label.txt" follow $([ "$DEMO" = tip ] && echo "$TIP_DIR") | sed 's/^/  /'; fi
  # the working tree of the clone becomes the snapshot (everything but .git goes first, ignored files too)
  find "$OUT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf -- {} +
  cp -a "$snap"/. "$OUT"/
  git -C "$OUT" add -A
  if ! pipeline "$OUT" "$INFO/pipeline-$label.log"; then tail -15 "$INFO/pipeline-$label.log" | cut -c1-200; die 5 "the pipeline stopped on the snapshot '$label' (see $INFO/pipeline-$label.log)"; fi
  git -C "$OUT" status --porcelain | awk 'substr($0,2,1)!=" "' > "$INFO/pipeline-changed-$label.txt"
  if [ -s "$INFO/pipeline-changed-$label.txt" ]; then
    echo "  the pipeline made again $(wc -l < "$INFO/pipeline-changed-$label.txt") files after the removal (they are part of the commit): $(sed 's/^...//' "$INFO/pipeline-changed-$label.txt" | head -12 | paste -sd' ' -)"
  else echo "  the pipeline changed nothing after the removal"; fi
  git -C "$OUT" add -A
  if git -C "$OUT" diff --cached --quiet; then echo "  nothing changed since the last commit: no commit for '$label'"; return 0; fi
  git -C "$OUT" commit -q -F "$msg" || { echo "  (signing failed? trying once without)"; git -C "$OUT" -c commit.gpgsign=false commit -q -F "$msg" || die 2 "git commit failed"; }
  echo "  commit $(git -C "$OUT" log -1 --format='%h %s' | cut -c1-120)"
  echo "  $(git -C "$OUT" show --shortstat --format= HEAD | sed 's/^ *//')"
  [ "$final" = 1 ] && cp "$INFO/removed-$label.txt" "$INFO/removed.txt"
  [ "${KEEP_SNAPSHOTS:-}" = 1 ] || { [ "$final" = 1 ] || rm -rf -- "$snap"; }
  return 0
}

# ------------------------------------------------------------------ 2. the commits
say "2. the commits on $NEW"
PLAN=()   # label|sha|msgfile
prev=""; FINAL_NAME=""
if [ "${ONE_COMMIT:-}" != 1 ]; then
  for m in "${MILESTONES[@]}"; do
    name="${m%%|*}"; pat="${m#*|}"
    ms="$(git -C "$INTEG" log --first-parent --format=%H -n1 --grep="$pat" "$SHA" 2>/dev/null)"
    if [ -z "$ms" ]; then echo "milestone '$name' ('$pat') not found in the first-parent history of $SHORT: skipped"; continue; fi
    if [ -n "$prev" ] && { [ "$ms" = "$prev" ] || ! git -C "$INTEG" merge-base --is-ancestor "$prev" "$ms"; }; then echo "milestone '$name' is not after the one before: skipped"; continue; fi
    if [ "$ms" = "$SHA" ]; then FINAL_NAME="$name"; break; fi   # this milestone is the final state itself: it gets its own message below
    PLAN+=("$name|$ms|$(msg_for "$name" "$(git -C "$INTEG" rev-parse --short "$ms")")"); prev="$ms"
  done
fi
if [ -n "$FINAL_NAME" ]; then PLAN+=("final|$SHA|$(msg_for "$FINAL_NAME" "$SHORT")"); else PLAN+=("final|$SHA|$(final_message "$prev")"); fi
echo "plan: $(for p in "${PLAN[@]}"; do l="${p%%|*}"; r="${p#*|}"; printf '%s=%s  ' "$l" "$(git -C "$INTEG" rev-parse --short "${r%%|*}")"; done)"
for p in "${PLAN[@]}"; do
  label="${p%%|*}"; rest="${p#*|}"; sha="${rest%%|*}"; msg="${rest#*|}"
  echo; echo "-- $label: integ $(git -C "$INTEG" rev-parse --short "$sha") ($(git -C "$INTEG" log -1 --format=%s "$sha" | cut -c1-90))"
  final=0; [ "$label" = final ] && final=1
  snapshot "$label" "$sha" "$msg" "$final"
done
[ -s "$INFO/removed.txt" ] || cp "$INFO/removed-final.txt" "$INFO/removed.txt" 2>/dev/null

# ------------------------------------------------------------------ 3. the checks
say "3. checks on the finished branch"
cd "$OUT" || exit 2
BAD=0
# 3a. the pipeline leaves a clean tree (a second run changes nothing)
if ! pipeline "$OUT" "$INFO/pipeline-again.log"; then tail -15 "$INFO/pipeline-again.log" | cut -c1-200; die 5 "the pipeline stopped on the finished branch"; fi
dirty="$(git status --porcelain)"
if [ -n "$dirty" ]; then echo "$dirty" | head -20; die 5 "git status is not clean after the full pipeline on the finished branch (the files above are changed by it)"; fi
echo "ok: git status is clean after the full pipeline (tools/pages.py, i18n.py extract, i18n.py jsstrings, i18n.py build)"
# 3b. nothing preview-only is left
left="$(git ls-files | grep -E '^js/tour|^css/tour|^js/shop-sample\.js$' || true)"
[ "${KEEP_SHOP_LOADER:-}" = 1 ] || left="$left$(git ls-files | grep -E '^js/shop-pop|^css/shop-pop' || true)"
if [ -n "$left" ]; then echo "STILL THERE: $left"; BAD=4; fi
lines="$(git grep -n -E '<(script|link)[^>]*(js/(tour|shop-sample)|css/tour)' -- '*.html' ':!docs' ':!work-notes' ':!tests' ':!patches' || true)"
[ "${KEEP_SHOP_LOADER:-}" = 1 ] || lines="$lines$(git grep -n -E '<(script|link)[^>]*(js/shop-pop|css/shop-pop)' -- '*.html' ':!docs' ':!work-notes' ':!tests' ':!patches' || true)"
if [ -n "$lines" ]; then echo "STILL LOADED by a page: $lines"; BAD=4; fi
[ $BAD -eq 0 ] && echo "ok: no tour or Store-sample file and no line that loads one is left in the tree ($(wc -l < "$INFO/removed.txt") files are out against integ)"
# 3b2. the demo is what DEMO says
OWNED_PATHS=('js/demo-*.js' 'css/demo*.css' 'pages/account.html' 'pages/farm-desk.html' 'pages/kitchen.html' 'docs/ACCOUNT_DEMO.md' 'tests/demo-data.test.mjs' 'tests/demo-store.test.mjs')
if [ "$DEMO" = tip ]; then
  if git diff --quiet "$REAL_TIP" HEAD -- "${OWNED_PATHS[@]}"; then echo "ok: the demo files (js/demo-*.js, css/demo*.css, the three page sources, docs/ACCOUNT_DEMO.md and its two tests) are byte for byte what the real tip has: $(git ls-tree -r --name-only "$REAL_TIP" | grep -cE '^(js/demo-[a-z-]+\.js|css/demo[a-z-]*\.css|pages/(account|farm-desk|kitchen)\.html|docs/ACCOUNT_DEMO\.md|tests/demo-(data|store)\.test\.mjs)$') files"
  else echo "THE DEMO FILES DIFFER FROM THE REAL TIP although DEMO=tip:"; git diff --stat "$REAL_TIP" HEAD -- "${OWNED_PATHS[@]}" | tail -12; BAD=8; fi
  echo "   the built demo pages are made again with the site's new header and footer: $(git diff --shortstat "$REAL_TIP" HEAD -- account.html farm-desk.html kitchen.html | sed 's/^ *//')"
else
  echo "demo B: $(git ls-files 'js/demo-*.js' | wc -l) demo scripts, $(git ls-files 'css/demo*.css' | wc -l) demo styles, $(git ls-files 'tests/demo-*.test.mjs' 'tests/account-*.test.mjs' 'tests/kitchen-*.test.mjs' | wc -l) demo tests (integ's)"
fi
# 3c. nothing that stays loads a removed file; a mention in a comment or a text is only counted
python3 -I - "$OUT" "$INFO/removed.txt" > "$INFO/leftovers.txt" <<'PY'
import os, re, subprocess, sys
root, removed_file = sys.argv[1:3]
removed = [l.strip() for l in open(removed_file, encoding='utf-8') if l.strip()]
tracked = subprocess.run(['git', 'ls-files'], cwd=root, stdout=subprocess.PIPE, universal_newlines=True).stdout.split('\n')
site = [p for p in tracked if p and not p.startswith(('tests/', 'docs/', 'work-notes/', 'patches/', 'tools/')) and p != 'README.md' and re.search(r'\.(html|js|css|json|txt|xml|webmanifest)$|^_headers$', p)]
other = [p for p in tracked if p and p not in site]
def lines_of(path):
    try: return open(os.path.join(root, path), encoding='utf-8', errors='replace').read().split('\n')
    except OSError: return []
fatal, mention, soft = [], [], {}
for gone in removed:
    names = [gone, os.path.basename(gone)] if gone.endswith(('.js', '.css')) else [gone]
    load = re.compile(r'(?:src|href)\s*=\s*["\']?[^"\' >]*(?:%s)|(?:import|fetch|importScripts|loadScript)\s*\([^)\n]*(?:%s)|\.src\s*=[^;\n]*(?:%s)' % ((re.escape(gone),) * 3))
    for p in site:
        for i, line in enumerate(lines_of(p)):
            if any(n in line for n in names):
                (fatal if load.search(line) else mention).append('%s:%d %s' % (p, i + 1, gone))
    for p in other:
        if p.endswith(('.md', '.mjs', '.py', '.json', '.js', '.sh')):
            c = sum(1 for line in lines_of(p) if any(n in line for n in names))
            if c: soft[p] = soft.get(p, 0) + c
print('SITE-FILES THAT LOAD A REMOVED FILE: %d' % len(fatal))
for b in fatal[:40]: print('  ' + b)
print('SITE-FILES THAT ONLY MENTION A REMOVED FILE (a comment or a text): %d' % len(mention))
for b in mention[:40]: print('  ' + b)
print('OTHER FILES (tests, docs, notes, tools) THAT NAME A REMOVED FILE: %d files' % len(soft))
for p, c in sorted(soft.items(), key=lambda x: (-x[1], x[0]))[:80]: print('  %s (%d)' % (p, c))
PY
n_site="$(sed -n 's/^SITE-FILES THAT LOAD A REMOVED FILE: //p' "$INFO/leftovers.txt")"
n_ment="$(sed -n 's/^SITE-FILES THAT ONLY MENTION A REMOVED FILE (a comment or a text): //p' "$INFO/leftovers.txt")"
n_other="$(sed -n 's/^OTHER FILES (tests, docs, notes, tools) THAT NAME A REMOVED FILE: \([0-9]*\) files/\1/p' "$INFO/leftovers.txt")"
if [ "${n_site:-0}" -gt 0 ]; then sed -n '1,25p' "$INFO/leftovers.txt"; echo "(whole list: $INFO/leftovers.txt)"; BAD=6; else echo "ok: no page, script, style or header file loads a removed file"; fi
echo "note: $n_ment lines in site files only mention a removed file (comments or texts); $n_other files in tests/, docs/, work-notes/, tools/ and README.md name one (list: $INFO/leftovers.txt)"
# 3d. the two trailers on every new commit
nbad=0
for c in $(git rev-list "$REAL_TIP..HEAD"); do
  tail="$(git log -1 --format=%B "$c" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}' | tail -n 2)"
  [ "$tail" = "$TRAILERS" ] || { echo "trailers missing or different on $(git log -1 --format='%h %s' "$c")"; nbad=$((nbad + 1)); }
done
if [ $nbad -gt 0 ]; then BAD=7; else echo "ok: the $(git rev-list --count "$REAL_TIP..HEAD") new commits end with the two trailers"; fi

# ------------------------------------------------------------------ 4. what changed against the real tip
say "4. the branch $NEW against the real tip ${REAL_TIP:0:7}"
git log --reverse --format='%h %s' "$REAL_TIP..HEAD" | cut -c1-150 | sed 's/^/commit /'
git diff --name-status -M0 "$REAL_TIP" HEAD > "$INFO/name-status.txt"
git diff --stat=140,100 "$REAL_TIP" HEAD > "$INFO/diffstat.txt"
awk '$1=="A"{print $2}' "$INFO/name-status.txt" > "$INFO/files-added.txt"
awk '$1=="D"{print $2}' "$INFO/name-status.txt" > "$INFO/files-removed.txt"
awk '$1=="M"{print $2}' "$INFO/name-status.txt" > "$INFO/files-changed.txt"
echo "$(git diff --shortstat "$REAL_TIP" HEAD)"
echo "files: $(wc -l < "$INFO/files-added.txt") added, $(wc -l < "$INFO/files-removed.txt") removed, $(wc -l < "$INFO/files-changed.txt") changed (full diffstat: $INFO/diffstat.txt)"
echo "diffstat of the website files (everything but tests, docs, work-notes, tools, patches and README.md; the whole diffstat is in $INFO/diffstat.txt):"
git diff --stat=140,90 "$REAL_TIP" HEAD -- . ':!tests' ':!docs' ':!work-notes' ':!tools' ':!patches' ':!README.md' | sed 's/^/  /'
echo "by folder (files changed, lines added, lines removed):"
git diff --numstat "$REAL_TIP" HEAD | awk '{split($3,a,"/"); k=(index($3,"/")?a[1]"/":"(top level)"); f[k]++; if($1!="-"){p[k]+=$1; m[k]+=$2}} END{for(k in f) printf "  %-14s %4d files  +%d  -%d\n", k, f[k], p[k], m[k]}' | sort
echo "added files ($(wc -l < "$INFO/files-added.txt")):";   sed 's/^/  + /' "$INFO/files-added.txt"
echo "removed files ($(wc -l < "$INFO/files-removed.txt")):"; sed 's/^/  - /' "$INFO/files-removed.txt"
echo "changed files, website part ($(grep -vcE '^(tests|docs|work-notes|tools|patches)/|^README\.md$' "$INFO/files-changed.txt")): $(grep -vE '^(tests|docs|work-notes|tools|patches)/|^README\.md$' "$INFO/files-changed.txt" | paste -sd' ' -)"
echo "changed files, tests/docs/notes/tools: tests $(grep -c '^tests/' "$INFO/files-changed.txt"), docs $(grep -c '^docs/' "$INFO/files-changed.txt"), work-notes $(grep -c '^work-notes/' "$INFO/files-changed.txt"), tools $(grep -c '^tools/' "$INFO/files-changed.txt"), patches $(grep -c '^patches/' "$INFO/files-changed.txt") (names: $INFO/files-changed.txt)"
echo "files left out of integ for the real site ($(wc -l < "$INFO/removed.txt")): $INFO/removed.txt"
STILL_PREVIEW="$(python3 -I "$TESTS_PY" "$OUT" "$INFO/removed.txt" list $([ "$DEMO" = tip ] && echo "$TIP_DIR"))"
echo "tests that still need a removed file (should be none with PREVIEW_TESTS=follow): ${STILL_PREVIEW:-none}"

# ------------------------------------------------------------------ 5. what goes on the website
say "5. what goes on the website: the upload folder (tools/make_deploy_folder.py), the files that change, their sizes"
if ( cd "$OUT" && python3 tools/make_deploy_folder.py --out "$INFO/deploy" ) > "$INFO/deploy.log" 2>&1; then
  grep -E '^(Pages and translations|Facts agree|Facts disagree|Translations|Ready|Not ready)' "$INFO/deploy.log" | sed 's#'"$INFO"'/##' | cut -c1-200
else tail -8 "$INFO/deploy.log" | cut -c1-200; echo "PROBLEM: tools/make_deploy_folder.py says the folder is not ready (log: $INFO/deploy.log)"; [ $BAD -eq 0 ] && BAD=5; fi
upload_list() { ( cd "$1" && python3 -I -c "import sys; sys.path.insert(0, 'tools'); import make_deploy_folder as m; f, l = m.upload_set('.'); print('\n'.join(sorted(f)))" ) 2>/dev/null; }
upload_list "$OUT" > "$INFO/upload-set.txt"; upload_list "$TIP_DIR" > "$INFO/upload-set-tip.txt"
: > "$INFO/upload-files.txt"
while read -r f; do [ -n "$f" ] && printf '%s %s\n' "$(git cat-file -s "HEAD:$f" 2>/dev/null || wc -c < "$OUT/$f")" "$f"; done < "$INFO/upload-set.txt" > "$INFO/upload-files.txt"
echo "files the host gets: $(wc -l < "$INFO/upload-set.txt") (the real tip: $(wc -l < "$INFO/upload-set-tip.txt")); $(awk '{s+=$1} END{printf "%.0f KB", s/1024}' "$INFO/upload-files.txt") in all (list with bytes: $INFO/upload-files.txt)"
echo "  new on the host against the tip: $(LC_ALL=C comm -13 "$INFO/upload-set-tip.txt" "$INFO/upload-set.txt" | paste -sd' ' - | cut -c1-200)"
echo "  gone from the host against the tip: $(LC_ALL=C comm -23 "$INFO/upload-set-tip.txt" "$INFO/upload-set.txt" | paste -sd' ' - | cut -c1-200)"
echo "  not in the upload set at all (stay in the repo only): tests/, docs/, tools/, work-notes/, patches/, pages/, README.md"
stray="$(LC_ALL=C comm -12 <(LC_ALL=C sort "$INFO/upload-set.txt") <(LC_ALL=C sort "$INFO/removed.txt"))"
if [ -n "$stray" ]; then echo "PROBLEM: a removed file is in the upload set: $stray"; [ $BAD -eq 0 ] && BAD=4
else echo "ok: none of the $(wc -l < "$INFO/removed.txt") removed files is in the upload set. tools/make_deploy_folder.py copies EVERY file of js/ and css/ and every top-level .html, so a preview file left in the branch would be uploaded: that is why they are out of the branch, not only out of the pages"; fi
echo "files of the website that change against the real tip (bytes before -> after), biggest first:"
while read -r f; do b="$(git cat-file -s "$REAL_TIP:$f" 2>/dev/null || echo 0)"; a="$(git cat-file -s "HEAD:$f" 2>/dev/null || echo 0)"; [ "$a" != "$b" ] && printf '%9s -> %9s  %s\n' "$b" "$a" "$f"; done < "$INFO/upload-set.txt" | sort -k3 -n -r | sed 's/^/  /' | head -45
echo "files that were taken out of integ for the website, with their size in integ (the tour, the Store's pretend lists and loader$([ "$DEMO" = tip ] && echo ", integ's newer demo files")):"
while read -r f; do [ -n "$f" ] && printf '  %7s  %s\n' "$(git -C "$INTEG" cat-file -s "$SHA:$f" 2>/dev/null || echo '?')" "$f"; done < "$INFO/removed.txt"

# ------------------------------------------------------------------ 6. the quick tests that need no browser
RUN_TESTS="${RUN_TESTS:-1}"
if [ "$RUN_TESTS" != 0 ]; then
  say "6. the tests that need no browser ($([ "$RUN_TESTS" = all ] && echo all || echo 'the quick ones')): nice -n 10 flock /tmp/wa-quick.lock node tests/run-all.mjs ..."
  export AXE_PATH="${AXE_PATH:-/tmp/axe-install/node_modules/axe-core/axe.min.js}" PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"; unset WA_URL
  if [ "$RUN_TESTS" = all ]; then NAMES="$(cd "$OUT" && node tests/run-all.mjs --list | sed -n 's/^\([a-z0-9-]*\) *\[no browser\].*/=\1/p' | tr '\n' ' ')"
  else NAMES="$(cd "$OUT" && node tests/run-all.mjs --list | sed -n 's/^\([a-z0-9-]*\) *\[no browser\] *quick .*/=\1/p' | tr '\n' ' ')"; fi
  ( cd "$OUT" && nice -n 10 flock /tmp/wa-quick.lock node tests/run-all.mjs $NAMES ) > "$INFO/tests-quick.log" 2>&1
  grep -E '^ +FAIL|^[0-9]+ test files|^Failed:' "$INFO/tests-quick.log" | cut -c1-250
  FAILED="$(sed -n 's/^Failed: //p' "$INFO/tests-quick.log" | tr -d ',')"
  if [ -n "$FAILED" ]; then
    echo "-- each failing test again on integ $SHORT itself (to see whether the real set caused it):"
    mkdir -p "$INFO/integ-copy"; git -C "$INTEG" archive --format=tar "$SHA" | tar -x -C "$INFO/integ-copy"
    CAUSED=""
    for t in $FAILED; do
      if ( cd "$INFO/integ-copy" && nice -n 10 flock /tmp/wa-quick.lock node tests/run-all.mjs "=$t" ) > "$INFO/tests-integ-$t.log" 2>&1; then echo "   $t: PASSES on integ, FAILS on the real set  <-- caused by the real set"; CAUSED="$CAUSED $t"
      else echo "   $t: fails on integ too (not caused by the real set)"; fi
    done
    if [ -n "$CAUSED" ]; then echo "PROBLEM: failing only on the real set:$CAUSED"; [ $BAD -eq 0 ] && BAD=9
    else echo "NOTE: integ itself is red for: $FAILED (the real set adds no failure of its own)"; fi
    rm -rf -- "$INFO/integ-copy"
  else echo "ok: every one of those tests passes"; fi
else echo; echo "(tests skipped: RUN_TESTS=0)"; fi

# ------------------------------------------------------------------ the check commands
cat > "$INFO/run-checks.sh" <<EOF
#!/bin/bash
# the checks for the real set in $OUT (made by make_real_branch.sh, DEMO=$DEMO); run from anywhere. A browser test waits for /tmp/wa-heavy.lock.
export NODE_PATH=/opt/node22/lib/node_modules AXE_PATH=/tmp/axe-install/node_modules/axe-core/axe.min.js PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
unset WA_URL
cd '$OUT' || exit 1
# 1. no browser (a few minutes): every test that needs none
NOBROWSER=\$(node tests/run-all.mjs --list | sed -n 's/^\\([a-z0-9-]*\\) *\\[no browser\\].*/=\\1/p' | tr '\\n' ' ')
nice -n 10 flock /tmp/wa-quick.lock node tests/run-all.mjs \$NOBROWSER
node tests/shop-list.make.mjs --check
python3 tools/make_deploy_folder.py --out /tmp/real-update-deploy
# 2. the speed promise for an old phone (page weight, files, elements)
nice -n 10 flock /tmp/wa-heavy.lock node tests/slow-phone.test.mjs
# 3. browser tests (each one waits for its turn; a full run of all of them is  node tests/run-all.mjs  and takes about an hour on a quiet computer)
for t in smoke live dated hero farm-seasons features time-bombs languages i18n-early i18n-a11y no-js keyboard touch shop menu-groups nav-highlight map axe privacy; do
  nice -n 10 flock /tmp/wa-heavy.lock node tests/run-all.mjs =\$t
done
EOF
chmod +x "$INFO/run-checks.sh"
echo; echo "check commands: sh $INFO/run-checks.sh   (or the lines in it, one at a time)"
sed 's/^/  | /' "$INFO/run-checks.sh"

say "RESULT"
[ "${KEEP_SNAPSHOTS:-}" = 1 ] || rm -rf -- "$INFO"/snap-* 2>/dev/null
echo "branch $NEW in $OUT: $(git rev-list --count "$REAL_TIP..HEAD") commits on the real tip ${REAL_TIP:0:7}, built from integ $SHORT, DEMO=$DEMO, tests: $PREVIEW_TESTS; notes and lists: $INFO/"
echo "NOTHING WAS PUSHED. The clone's push is switched off. The one deliberate push command is in PUSH_PLAN.md."
if [ $BAD -eq 0 ]; then echo "MAKE_REAL_BRANCH: OK"; exit 0; fi
echo "MAKE_REAL_BRANCH: PROBLEM (code $BAD): see the lines above"; exit $BAD
