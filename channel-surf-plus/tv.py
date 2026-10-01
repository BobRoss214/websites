#!/usr/bin/env python3
"""Channel Surf Plus: start the TV.

Run it with:   python3 tv.py

It serves the app at http://localhost:8642 (YouTube's player needs a real web
address; it refuses to play from a file you double-click), then opens the
browser full screen. Close the TV with Alt+F4, then press Ctrl+C here.

Options:
  --window       open in a normal window instead of full screen
  --no-browser   just run the server (open http://localhost:8642 yourself)
  --port N       use a different port (your API key must allow it too)
"""
import argparse
import functools
import http.server
import os
import shutil
import socketserver
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
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
        ".json": "application/json",
    }

    def end_headers(self):
        # always serve the newest files, and never send the page address to other sites
        # except YouTube's own check (the player needs to know which site it is on)
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
    url_flags = []
    profile = os.path.join(os.path.expanduser("~"), ".config", "channel-surf-browser")
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            flags = [f"--user-data-dir={profile}-chrome", "--no-first-run", "--disable-translate",
                     "--disable-features=Translate", "--password-store=basic"]
            flags += ["--start-maximized"] if window else ["--kiosk"]
            return path, flags
    path = shutil.which("firefox")
    if path:
        os.makedirs(profile + "-firefox", exist_ok=True)
        flags = ["--new-instance", "--profile", profile + "-firefox"]
        if not window:
            flags.append("--kiosk")
        return path, flags
    return None, url_flags


def main():
    ap = argparse.ArgumentParser(description="Start Channel Surf Plus")
    ap.add_argument("--port", type=int, default=8642)
    ap.add_argument("--window", action="store_true", help="normal window instead of full screen")
    ap.add_argument("--no-browser", action="store_true", help="only start the server")
    args = ap.parse_args()

    handler = functools.partial(Handler, directory=APP)
    try:
        httpd = Server(("127.0.0.1", args.port), handler)
    except OSError:
        print(f"Port {args.port} is busy. Is Channel Surf already running?")
        print(f"If so, just open http://localhost:{args.port} in your browser.")
        sys.exit(1)

    url = f"http://localhost:{args.port}/"
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print("Channel Surf Plus is on the air at", url)
    print("Close the TV window with Alt+F4. Press Ctrl+C here to stop.")

    if not args.no_browser:
        path, flags = find_browser(args.window)
        if path:
            subprocess.Popen([path, *flags, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            webbrowser.open(url)

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("\nOff the air. Goodbye!")
        httpd.shutdown()


if __name__ == "__main__":
    main()
