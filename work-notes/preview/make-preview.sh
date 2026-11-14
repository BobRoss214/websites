#!/bin/sh
# The one command that makes and checks the claude.ai preview (work-notes/preview/README.md says what to do before and after it).
#
#   work-notes/preview/make-preview.sh [OUT_DIR]
#
# 1. builds the preview into OUT_DIR (default /tmp/preview-out) with the demo and tour flags on,
# 2. builds it again into OUT_DIR-bare WITHOUT the flags (what the real site shows),
# 3. checks both with arttest.mjs (the second one must show nothing of the demo or the tour).
# OUT_DIR must be outside the site folder. To publish from it with the Artifact tool it must also be inside the session's scratchpad or working folder.
# Extra arguments for the check of the first build go in PREVIEW_TEST_ARGS, for example  PREVIEW_TEST_ARGS="--quick"  (leaves out the long tour walk)
# or  PREVIEW_TEST_ARGS="--shots /tmp/preview-shots"  (saves pictures). It opens several browser tabs: it waits for the shared lock /tmp/wa-heavy.lock
# (4 cores shared by many helpers). Run it in the background with a log, for example:
#   work-notes/preview/make-preview.sh /path/to/scratchpad/artifact > /tmp/preview-make.log 2>&1 &
# The last line says READY TO PUBLISH or NOT READY; the exit code is 0 only for READY.
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-/tmp/preview-out}
BARE="$OUT-bare"

export NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules}
export AXE_PATH=${AXE_PATH:-/tmp/claude-0/axe-core/axe.min.js}
export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}
unset WA_URL

if command -v flock >/dev/null 2>&1; then LOCK="flock /tmp/wa-heavy.lock"; else LOCK=""; fi

echo "== 1. build with the flags -> $OUT"
python3 "$HERE/build-artifact.py" --out "$OUT" || { echo "NOT READY: the build stopped (see above)"; exit 1; }
echo
echo "== 2. build without the flags -> $BARE"
python3 "$HERE/build-artifact.py" --no-flags --out "$BARE" || { echo "NOT READY: the build without flags stopped (see above)"; exit 1; }

bad=0
echo
echo "== 3. check the build with the flags"
# shellcheck disable=SC2086
$LOCK node "$HERE/arttest.mjs" --dir "$OUT" $PREVIEW_TEST_ARGS || bad=1
echo
echo "== 4. check the build without the flags (nothing of the demo or the tour may show)"
$LOCK node "$HERE/arttest.mjs" --dir "$BARE" --only static,home,flags || bad=1

echo
if [ "$bad" = 0 ]; then
  echo "READY TO PUBLISH: $OUT"
  echo "  Artifact tool: url = the preview's link, file_path = $OUT/index.html, root = $OUT,"
  echo "  files = the list in $OUT/publish-files.json  (the pages and pictures; build-info.json is not published)"
  exit 0
fi
echo "NOT READY: read the FAIL lines above. Nothing was published."
exit 1
