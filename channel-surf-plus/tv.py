#!/usr/bin/env python3
"""Channel Surf Plus: start the TV.

Run it with:   python3 tv.py

It serves the app at http://localhost:8642 (YouTube's player needs a real web
address; it refuses to play from a file you double-click), then opens the
browser full screen. Close the TV with Alt+F4; that also stops this program.

Options:
  --window             open in a normal window instead of full screen
  --no-browser         just run the server (open http://localhost:8642 yourself)
  --port N             use a different port (your API key must allow it too)
  --install-shortcut   put a "Channel Surf" icon on the desktop and in the app menu
"""
import argparse
import functools
import http.server
import os
import shutil
import socketserver
import stat
import subprocess
import sys
import threading
import time
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "app")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
        ".woff2": "font/woff2", ".svg": "image/svg+xml", ".json": "application/json",
    }

    def end_headers(self):
        # always serve the newest files; tell other sites only which site we are
        # (YouTube's player needs that), never the full address
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the terminal quiet
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def find_browser(window):
    """Prefer Chrome/Chromium (best YouTube support), then Firefox."""
    profile = os.path.join(os.path.expanduser("~"), ".config", "channel-surf-browser")
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            flags = [f"--user-data-dir={profile}-chrome", "--no-first-run", "--no-default-browser-check",
                     "--disable-translate", "--disable-features=Translate", "--password-store=basic",
                     "--disable-session-crashed-bubble", "--noerrdialogs", "--overscroll-history-navigation=0",
                     # the power button is a click anyway; this just makes sure sound is never blocked
                     "--autoplay-policy=no-user-gesture-required"]
            flags += ["--start-maximized"] if window else ["--kiosk"]
            return path, flags
    path = shutil.which("firefox")
    if path:
        os.makedirs(profile + "-firefox", exist_ok=True)
        flags = ["--new-instance", "--profile", profile + "-firefox"]
        if not window:
            flags.append("--kiosk")
        return path, flags
    return None, []


def install_shortcut():
    icon = os.path.join(APP, "icon.svg")
    entry = (
        "[Desktop Entry]\nType=Application\nName=Channel Surf\nComment=Turn on the TV\n"
        f'Exec=python3 "{os.path.join(HERE, "tv.py")}"\nIcon={icon}\nTerminal=false\n'
        "Categories=AudioVideo;Video;\nStartupNotify=false\n"
    )
    places = [os.path.join(os.path.expanduser("~"), ".local", "share", "applications")]
    try:
        desk = subprocess.run(["xdg-user-dir", "DESKTOP"], capture_output=True, text=True).stdout.strip()
    except OSError:
        desk = ""
    desk = desk or os.path.join(os.path.expanduser("~"), "Desktop")
    if os.path.isdir(desk):
        places.append(desk)
    for folder in places:
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, "channel-surf.desktop")
        with open(path, "w") as f:
            f.write(entry)
        os.chmod(path, os.stat(path).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        # GNOME asks before running desktop icons; mark ours as trusted
        subprocess.run(["gio", "set", path, "metadata::trusted", "true"], capture_output=True)
        print("Added", path)
    print('Done. Look for "Channel Surf" on the desktop or in the app menu.')
    print('If the desktop icon shows a warning, right-click it and choose "Allow Launching".')


def main():
    ap = argparse.ArgumentParser(description="Start Channel Surf Plus")
    ap.add_argument("--port", type=int, default=8642)
    ap.add_argument("--window", action="store_true", help="normal window instead of full screen")
    ap.add_argument("--no-browser", action="store_true", help="only start the server")
    ap.add_argument("--install-shortcut", action="store_true", help="add a desktop icon")
    args = ap.parse_args()
    if args.install_shortcut:
        install_shortcut()
        return

    url = f"http://localhost:{args.port}/"
    handler = functools.partial(Handler, directory=APP)
    try:
        httpd = Server(("127.0.0.1", args.port), handler)
    except OSError:
        # already running (someone double-clicked twice): just show the TV again
        print(f"Channel Surf is already running at {url}")
        if not args.no_browser:
            path, flags = find_browser(args.window)
            subprocess.Popen([path, *flags, url]) if path else webbrowser.open(url)
        return

    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print("Channel Surf Plus is on the air at", url)
    print("Close the TV with Alt+F4 (that stops this too), or press Ctrl+C here.")

    proc = None
    if not args.no_browser:
        path, flags = find_browser(args.window)
        if path:
            proc = subprocess.Popen([path, *flags, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            webbrowser.open(url)

    try:
        started = time.time()
        if proc:
            proc.wait()
            # if the browser handed us to a window that was already open, keep serving
            if time.time() - started < 5:
                while True:
                    time.sleep(3600)
        else:
            while True:
                time.sleep(3600)
    except KeyboardInterrupt:
        pass
    print("\nOff the air. Goodbye!")
    httpd.shutdown()


if __name__ == "__main__":
    main()
