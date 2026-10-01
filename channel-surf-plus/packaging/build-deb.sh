#!/bin/sh
# Builds the Ubuntu installer: dist/channel-surf_<version>_all.deb
# Double-clicking that file opens App Center; "Install" puts Channel Surf in the
# app list (and the dock), so nobody needs the Terminal.
#   sh packaging/build-deb.sh
set -e
cd "$(dirname "$0")/.."
VERSION=$(python3 -c 'import re; print(re.search(r"^VERSION = \"(.+)\"", open("tv.py").read(), re.M).group(1))')
OUT=dist/channel-surf_${VERSION}_all.deb
ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
chmod 755 "$ROOT"

# the program itself
mkdir -p "$ROOT/opt/channel-surf"
cp tv.py HOW-TO.md README.md "$ROOT/opt/channel-surf/"
cp -r app "$ROOT/opt/channel-surf/app"
find "$ROOT/opt/channel-surf" -name '__pycache__' -prune -exec rm -rf {} +

# a command, an entry in the app list, and an icon
mkdir -p "$ROOT/usr/bin" "$ROOT/usr/share/applications" "$ROOT/usr/share/icons/hicolor/scalable/apps" "$ROOT/usr/share/icons/hicolor/256x256/apps" "$ROOT/usr/share/pixmaps"
cat > "$ROOT/usr/bin/channel-surf" <<'EOF'
#!/bin/sh
exec python3 /opt/channel-surf/tv.py "$@"
EOF
chmod 755 "$ROOT/usr/bin/channel-surf"
cat > "$ROOT/usr/share/applications/channel-surf.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Channel Surf
GenericName=TV
Comment=YouTube, like cable TV
Exec=channel-surf
Icon=channel-surf
Terminal=false
Categories=AudioVideo;Video;TV;
Keywords=tv;youtube;cable;channels;
StartupNotify=false
StartupWMClass=channel-surf
Actions=window;resetpin;

[Desktop Action window]
Name=Open in a window (for setting up)
Exec=channel-surf --window

[Desktop Action resetpin]
Name=Forgot the Setup PIN
Exec=channel-surf --reset-pin
EOF
cp app/icon.svg "$ROOT/usr/share/icons/hicolor/scalable/apps/channel-surf.svg"
cp packaging/channel-surf-256.png "$ROOT/usr/share/icons/hicolor/256x256/apps/channel-surf.png"
cp packaging/channel-surf-256.png "$ROOT/usr/share/pixmaps/channel-surf.png"

# the package's description (what App Center shows)
mkdir -p "$ROOT/DEBIAN"
SIZE=$(du -sk "$ROOT/opt" "$ROOT/usr" | awk '{s+=$1} END {print s}')
cat > "$ROOT/DEBIAN/control" <<EOF
Package: channel-surf
Version: $VERSION
Architecture: all
Maintainer: Channel Surf <channel-surf@localhost>
Installed-Size: $SIZE
Depends: python3 (>= 3.8)
Recommends: zenity
Suggests: google-chrome-stable | chromium | firefox
Section: video
Priority: optional
Homepage: https://github.com/BobRoss214/websites
Description: YouTube, like old-fashioned cable TV
 Press power and a show is already on. Flip channels up and down, type a
 channel number, or check the TV guide on channel 1. Search, On Demand,
 chapters, comments and "watch on your phone" live in 1997-style cable box
 menus. Uses YouTube's official player and service, never blocks ads, and
 keeps everything on this computer.
EOF
cat > "$ROOT/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
command -v update-desktop-database >/dev/null && update-desktop-database -q /usr/share/applications || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t /usr/share/icons/hicolor || true
exit 0
EOF
cp "$ROOT/DEBIAN/postinst" "$ROOT/DEBIAN/postrm"
chmod 755 "$ROOT/DEBIAN/postinst" "$ROOT/DEBIAN/postrm"
find "$ROOT/opt" "$ROOT/usr/share" -type d -exec chmod 755 {} + && find "$ROOT/opt" "$ROOT/usr/share" -type f -exec chmod 644 {} +

mkdir -p dist
rm -f dist/channel-surf_*_all.deb
dpkg-deb --root-owner-group -Zxz --build "$ROOT" "$OUT" >/dev/null
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
