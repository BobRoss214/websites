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

Signing in to YouTube is optional (it's only needed to like, subscribe, comment
and make playlists). This program does the signing in itself, so the lasting
sign-in stays in a private folder on this computer (~/.config/channel-surf/)
and never goes into the browser. The TV only asks for a short-lived pass when
it needs one.
"""
import argparse
import base64
import functools
import hashlib
import html
import http.client
import http.server
import json
import os
import re
import secrets
import shutil
import socketserver
import stat
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "app")

# What we ask Google for: permission to act on your YouTube account
# (like, subscribe, comment, playlists). Nothing else.
SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl"
STATE_LIFETIME = 10 * 60   # a sign-in has 10 minutes to come back from Google
MAX_WAITING = 20           # sign-ins started but not finished that we remember
REFRESH_EARLY = 120        # get a new pass when the old one has 2 minutes left
GOOGLE_TIMEOUT = 15        # seconds to wait for Google before giving up
MAX_BODY = 16 * 1024       # the most the TV page may send us in one go
CLIENT_ID_SHAPE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\.apps\.googleusercontent\.com")

NO_INTERNET = "Couldn't reach Google. Check that this computer is connected to the internet, then try again."


class SignInProblem(Exception):
    """Something went wrong. The message is written for the person at the TV."""

    def __init__(self, message, status=502):
        super().__init__(message)
        self.message = message
        self.status = status


class SignedOut(Exception):
    """Nobody is signed in (or Google has ended the sign-in)."""


def google_trouble(reply, status):
    """Turn Google's short error codes into something a person can act on."""
    code = str(reply.get("error") or "")[:80]
    if code in ("invalid_client", "unauthorized_client"):
        return ("Google didn't accept the sign-in settings (the client ID or client secret). "
                "Check them in Setup and save them again.")
    if code == "redirect_uri_mismatch":
        return ("Google didn't accept this computer's return address. Make sure the sign-in "
                'client was made with the type "Desktop app".')
    if code == "invalid_grant":
        return "Google said that sign-in had run out or was already used. Please try signing in again."
    if status >= 500:
        return "Google's sign-in service is having trouble right now. Please try again in a few minutes."
    return f"Google turned the request down ({code or 'error ' + str(status)}). Please try again."


class GoogleSignIn:
    """Signing in to Google ("OAuth"), done the way Google recommends for programs
    on your own computer: the browser goes to Google, you say yes there, and Google
    sends the browser back here with a one-time code. This program swaps that code
    for a lasting sign-in, which it keeps in a private file and uses to hand the
    TV page short-lived passes (about an hour each)."""

    def __init__(self, port, config_dir=None):
        self.port = port
        self.dir = config_dir or os.path.join(os.path.expanduser("~"), ".config", "channel-surf")
        self.client_file = os.path.join(self.dir, "google-oauth.json")
        self.token_file = os.path.join(self.dir, "google-token.json")
        # the tests point these at a pretend Google
        self.auth_url = os.environ.get("CS_GOOGLE_AUTH_URL") or "https://accounts.google.com/o/oauth2/v2/auth"
        self.token_url = os.environ.get("CS_GOOGLE_TOKEN_URL") or "https://oauth2.googleapis.com/token"
        self.revoke_url = os.environ.get("CS_GOOGLE_REVOKE_URL") or "https://oauth2.googleapis.com/revoke"
        # Google lets "Desktop app" clients come back to any port on this computer, and
        # recommends 127.0.0.1 over "localhost". The page there then sends the browser on
        # to http://localhost, where the TV's settings live (the browser keeps them per address).
        self.redirect_uri = f"http://127.0.0.1:{port}/api/oauth/callback"
        self.home = f"http://localhost:{port}/"
        self.pending = {}                  # sign-ins in progress: state -> (secret check word, when started)
        self.pending_lock = threading.Lock()
        self.lock = threading.Lock()       # one change to the saved sign-in at a time

    # ----- the private files -----
    def _read(self, path):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            return None
        return data if isinstance(data, dict) else None

    def _write(self, path, data):
        """Save a file so that only you can read it (and never half-written)."""
        os.makedirs(self.dir, mode=0o700, exist_ok=True)
        os.chmod(self.dir, 0o700)
        fd, tmp = tempfile.mkstemp(dir=self.dir, prefix=".saving-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                os.fchmod(f.fileno(), 0o600)
                json.dump(data, f, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def _forget_token(self):
        try:
            os.remove(self.token_file)
        except FileNotFoundError:
            pass

    def client(self):
        c = self._read(self.client_file)
        if c and all(isinstance(c.get(k), str) and c[k] for k in ("client_id", "client_secret")):
            return c
        return None

    def token(self):
        t = self._read(self.token_file)
        if t and isinstance(t.get("refresh_token"), str) and t["refresh_token"]:
            return t
        return None

    def _forget_pending(self):
        with self.pending_lock:
            self.pending.clear()

    # ----- talking to Google -----
    def _ask_google(self, url, form):
        """Send a form to Google. Returns (status number, Google's reply)."""
        req = urllib.request.Request(
            url, data=urllib.parse.urlencode(form).encode("ascii"), method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=GOOGLE_TIMEOUT) as r:
                status, raw = r.status, r.read(256 * 1024)
        except urllib.error.HTTPError as e:   # Google answered, but with an error
            status = e.code
            try:
                raw = e.read(256 * 1024)
            except (OSError, http.client.HTTPException):
                raw = b""
            finally:
                e.close()
        except (OSError, http.client.HTTPException, ValueError):   # no answer at all
            raise SignInProblem(NO_INTERNET, 502)
        try:
            reply = json.loads(raw.decode("utf-8"))
        except ValueError:
            reply = {}
        return status, (reply if isinstance(reply, dict) else {})

    @staticmethod
    def _lifetime(reply):
        try:
            return max(0, min(int(reply.get("expires_in", 3600)), 24 * 3600))
        except (TypeError, ValueError):
            return 3600

    # ----- what the TV page can ask for -----
    def status(self):
        c = self.client()
        t = self.token() if c else None
        return {"configured": c is not None, "signedIn": t is not None,
                "scope": (t.get("scope") or SCOPE) if t else None}

    def save_client(self, body):
        cid, secret = body.get("client_id"), body.get("client_secret")
        cid = cid.strip() if isinstance(cid, str) else ""
        secret = secret.strip() if isinstance(secret, str) else ""
        if not cid:
            raise SignInProblem("Please enter the client ID.", 400)
        if len(cid) > 300 or not CLIENT_ID_SHAPE.fullmatch(cid):
            raise SignInProblem('That client ID doesn\'t look right. It should be one long line ending in '
                                '".apps.googleusercontent.com". Copy it again from Google Cloud.', 400)
        if not secret:
            raise SignInProblem("Please enter the client secret too.", 400)
        if len(secret) > 300 or any(ch.isspace() for ch in secret):
            raise SignInProblem("That client secret doesn't look right (it shouldn't have spaces). "
                                "Copy it again from Google Cloud.", 400)
        with self.lock:
            old = self.client()
            try:
                self._write(self.client_file, {"client_id": cid, "client_secret": secret})
                # a different client can't use the old sign-in, so sign out
                if not old or (old["client_id"], old["client_secret"]) != (cid, secret):
                    self._forget_token()
            except OSError as e:
                raise SignInProblem(f"Couldn't save the settings on this computer ({e.strerror or e}).", 500)
        self._forget_pending()

    def start(self):
        """The web address of Google's "Allow Channel Surf?" page, or None if not set up."""
        c = self.client()
        if not c:
            return None
        # PKCE: a secret word only we know, and a scrambled copy that goes to Google.
        # When the code comes back we show Google the word, so a stolen code is useless.
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode()
        state = secrets.token_urlsafe(32)   # proves the answer belongs to a sign-in we started
        now = time.time()
        with self.pending_lock:
            self._drop_old(now)
            self.pending[state] = (verifier, now)
            while len(self.pending) > MAX_WAITING:
                self.pending.pop(next(iter(self.pending)))
        params = {
            "client_id": c["client_id"], "redirect_uri": self.redirect_uri, "response_type": "code",
            "scope": SCOPE, "access_type": "offline", "prompt": "consent", "include_granted_scopes": "true",
            "state": state, "code_challenge": challenge, "code_challenge_method": "S256",
        }
        return self.auth_url + ("&" if "?" in self.auth_url else "?") + urllib.parse.urlencode(params)

    def _drop_old(self, now):
        for s, (_, started) in list(self.pending.items()):
            if now - started > STATE_LIFETIME:
                del self.pending[s]

    def finish(self, query):
        """Google sent the browser back here. Swap the one-time code for the lasting sign-in."""
        state = query.get("state") or ""
        with self.pending_lock:
            self._drop_old(time.time())
            waiting = self.pending.pop(state, None) if state else None
        error = query.get("error")
        if error:
            if error == "access_denied":
                raise SignInProblem("You chose not to sign in, so nothing changed. "
                                    "You can try again any time from Setup.", 400)
            raise SignInProblem(f"Google stopped the sign-in (Google said: {error[:80]}). Please try again.", 400)
        if not waiting:
            raise SignInProblem("This sign-in ran out of time or was already used. "
                                "Please start again from Setup on the TV.", 400)
        if not query.get("code"):
            raise SignInProblem("Google didn't send back a sign-in code. Please try again.", 400)
        c = self.client()
        if not c:
            raise SignInProblem("Google sign-in isn't set up on this computer any more. "
                                "Enter the client ID and secret in Setup, then try again.", 400)
        status, reply = self._ask_google(self.token_url, {
            "code": query["code"], "client_id": c["client_id"], "client_secret": c["client_secret"],
            "redirect_uri": self.redirect_uri, "grant_type": "authorization_code", "code_verifier": waiting[0]})
        if status != 200 or not isinstance(reply.get("access_token"), str) or not reply["access_token"]:
            raise SignInProblem(google_trouble(reply, status), 502)
        granted = reply.get("scope") if isinstance(reply.get("scope"), str) and reply.get("scope") else SCOPE
        if SCOPE not in granted.split():
            raise SignInProblem("You didn't tick the box that lets Channel Surf use your YouTube account. "
                                "Please sign in again and tick it.", 400)
        if not isinstance(reply.get("refresh_token"), str) or not reply["refresh_token"]:
            raise SignInProblem("Google didn't give a lasting sign-in. Please try again.", 502)
        token = {"refresh_token": reply["refresh_token"], "access_token": reply["access_token"],
                 "expires_at": int(time.time()) + self._lifetime(reply), "scope": granted}
        with self.lock:
            try:
                self._write(self.token_file, token)
            except OSError as e:
                raise SignInProblem(f"Couldn't save the sign-in on this computer ({e.strerror or e}).", 500)

    def access_token(self):
        """A short-lived pass for YouTube. Gets a new one from Google when it's nearly used up.
        The lock means that if several requests come at once, only one asks Google."""
        with self.lock:
            c, t = self.client(), self.token()
            if not c or not t:
                raise SignedOut()
            at, exp = t.get("access_token"), t.get("expires_at")
            if isinstance(at, str) and at and isinstance(exp, (int, float)) and exp - time.time() >= REFRESH_EARLY:
                return {"access_token": at, "expires_at": exp}
            status, reply = self._ask_google(self.token_url, {
                "client_id": c["client_id"], "client_secret": c["client_secret"],
                "refresh_token": t["refresh_token"], "grant_type": "refresh_token"})
            if status == 200 and isinstance(reply.get("access_token"), str) and reply["access_token"]:
                t["access_token"] = reply["access_token"]
                t["expires_at"] = int(time.time()) + self._lifetime(reply)
                if isinstance(reply.get("scope"), str) and reply["scope"]:
                    t["scope"] = reply["scope"]
                if isinstance(reply.get("refresh_token"), str) and reply["refresh_token"]:
                    t["refresh_token"] = reply["refresh_token"]
                try:
                    self._write(self.token_file, t)
                except OSError:
                    pass   # the new pass still works; we'll just ask again next time
                return {"access_token": t["access_token"], "expires_at": t["expires_at"]}
            if reply.get("error") == "invalid_grant":
                # you removed Channel Surf in your Google account, or the sign-in ran out
                self._forget_token()
                raise SignedOut()
            raise SignInProblem(google_trouble(reply, status), 502)

    def sign_out(self):
        with self.lock:
            t = self.token()
            self._forget_token()
        self._forget_pending()
        if t:
            try:   # also tell Google, so the sign-in stops working everywhere
                self._ask_google(self.revoke_url, {"token": t["refresh_token"]})
            except SignInProblem:
                pass   # offline: it's gone from this computer, which is what matters


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{refresh}<title>{title}</title>
<style>
@font-face {{ font-family: "Barlow Condensed"; font-weight: 700; src: url(/fonts/barlow-condensed-700.woff2) format("woff2"); }}
html, body {{ margin: 0; height: 100%; }}
body {{ background: #0b1f6b; color: #fff; font-family: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif;
  font-weight: 700; display: flex; align-items: center; justify-content: center; text-align: center;
  padding: 0 24px; box-sizing: border-box; }}
main {{ max-width: 28em; }}
h1 {{ color: #ffd23f; font-size: clamp(44px, 8vw, 104px); line-height: 1; margin: 0 0 .35em; letter-spacing: .02em; }}
p {{ font-size: clamp(24px, 3.4vw, 46px); line-height: 1.25; margin: 0 0 .7em; }}
a {{ color: #ffd23f; }}
</style>
</head>
<body><main>
<h1>{title}</h1>
<p>{message}</p>
<p><a href="{link}">Back to the TV</a></p>
</main></body>
</html>
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
        ".woff2": "font/woff2", ".svg": "image/svg+xml", ".json": "application/json",
    }
    cache_control = "no-cache"
    referrer_policy = "strict-origin-when-cross-origin"

    def end_headers(self):
        # always serve the newest files; tell other sites only which site we are
        # (YouTube's player needs that), never the full address
        self.send_header("Cache-Control", self.cache_control)
        self.send_header("Referrer-Policy", self.referrer_policy)
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the terminal quiet
        pass

    # ----- the app's own files -----
    def send_head(self):
        # never hand out anything outside the app folder, whatever the address says
        root = os.path.realpath(self.directory)
        real = os.path.realpath(self.translate_path(self.path))
        if real != root and not real.startswith(root + os.sep):
            self.send_error(404, "File not found")
            return None
        return super().send_head()

    def _api_path(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        return path if path == "/api" or path.startswith("/api/") else None

    def do_GET(self):
        if self._api_path():
            return self._api("GET")
        super().do_GET()

    def do_HEAD(self):
        if self._api_path():
            return self._api("HEAD")
        super().do_HEAD()

    def do_POST(self):
        if self._api_path():
            return self._api("POST")
        self.send_error(405, "Method not allowed")

    def do_OPTIONS(self):
        # Other websites ask this before sending us anything unusual. We never say
        # yes (no "Access-Control-Allow-..." headers), so their browser stops them.
        self.send_error(405, "Method not allowed")

    # ----- sign-in requests from the TV page -----
    ROUTES = {
        "/api/health": "GET", "/api/oauth/status": "GET", "/api/oauth/start": "GET",
        "/api/oauth/callback": "GET", "/api/oauth/token": "GET",
        "/api/oauth/config": "POST", "/api/oauth/signout": "POST",
    }

    def _host_ok(self):
        # Only answer to this computer's own address. This stops a trick where a
        # website renames itself to point at this computer ("DNS rebinding").
        hosts = self.headers.get_all("Host") or []
        port = self.server.server_address[1]
        return len(hosts) == 1 and hosts[0].strip().lower() in (f"localhost:{port}", f"127.0.0.1:{port}")

    def _from_the_tv(self):
        # Browsers tell us which website a request came from. Refuse other websites.
        port = self.server.server_address[1]
        site = self.headers.get("Sec-Fetch-Site")
        if site is not None and site.strip().lower() not in ("same-origin", "none"):
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin.strip().lower() not in (f"http://localhost:{port}", f"http://127.0.0.1:{port}"):
            return False
        return True

    def _api(self, method):
        self.cache_control = "no-store"     # passes must never be kept in a cache
        self.referrer_policy = "no-referrer"
        path = self._api_path()
        query = self.path.split("#", 1)[0].partition("?")[2]
        body = b""
        if method == "POST":
            # read what was sent first, so the answer always gets through
            try:
                size = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                size = -1
            if size < 0 or size > MAX_BODY:
                return self._json(413, {"error": "That's more than the TV should ever send."})
            body = self.rfile.read(size) if size else b""

        blocked = {"error": "Blocked: this only works from the TV page on this computer."}
        if not self._host_ok():
            return self._json(403, blocked)
        if (method == "POST" or path in ("/api/oauth/token", "/api/oauth/start")) and not self._from_the_tv():
            return self._json(403, blocked)
        # Other websites can't add this header without asking first (and we never say yes)
        if method == "POST" and self.headers.get("X-Channel-Surf", "").strip() != "1":
            return self._json(403, blocked)
        if path not in self.ROUTES:
            return self._json(404, {"error": "not_found"})
        if self.ROUTES[path] != method:
            return self._json(405, {"error": "method_not_allowed"}, [("Allow", self.ROUTES[path])])

        signin = self.server.signin
        try:
            if path == "/api/health":
                return self._json(200, {"ok": True, "oauth": True})
            if path == "/api/oauth/status":
                return self._json(200, signin.status())
            if path == "/api/oauth/config":
                try:
                    data = json.loads(body.decode("utf-8") or "null")
                except ValueError:
                    data = None
                if not isinstance(data, dict):
                    return self._json(400, {"error": "Please enter the client ID and the client secret."})
                signin.save_client(data)
                return self._json(200, {"ok": True})
            if path == "/api/oauth/start":
                return self._redirect(signin.start() or "/?oauth=notconfigured")
            if path == "/api/oauth/callback":
                return self._callback(signin, query)
            if path == "/api/oauth/token":
                try:
                    return self._json(200, signin.access_token())
                except SignedOut:
                    return self._json(401, {"error": "signed_out"})
            if path == "/api/oauth/signout":
                signin.sign_out()
                return self._json(200, {"ok": True})
        except SignInProblem as p:
            return self._json(p.status, {"error": p.message})
        except ConnectionError:
            raise   # the browser hung up; there's nobody to answer
        except Exception as e:   # a bug or a broken disk: say so instead of hanging up
            return self._json(500, {"error": f"Something went wrong in the Channel Surf program ({type(e).__name__})."})

    def _callback(self, signin, query):
        try:
            fields = urllib.parse.parse_qs(query, max_num_fields=20)
        except ValueError:
            fields = {}
        try:
            signin.finish({k: v[0] for k, v in fields.items()})
        except SignInProblem as p:
            return self._page(p.status, "Sign-in didn't work", p.message, signin.home + "?oauth=failed")
        except Exception as e:
            return self._page(500, "Sign-in didn't work",
                              f"Something went wrong in the Channel Surf program ({type(e).__name__}). "
                              "Please try again.", signin.home + "?oauth=failed")
        return self._page(200, "Signed in to YouTube",
                          "You can now like videos, subscribe, comment and make playlists. "
                          "Taking you back to the TV now...", signin.home + "?oauth=ok", refresh=2)

    def _send(self, status, ctype, body, extra=()):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status, data, extra=()):
        self._send(status, "application/json; charset=utf-8", json.dumps(data).encode("utf-8"), extra)

    def _redirect(self, location):
        self._send(302, "text/plain; charset=utf-8", b"", [("Location", location)])

    def _page(self, status, title, message, link, refresh=None):
        page = PAGE.format(
            title=html.escape(title), message=html.escape(message), link=html.escape(link),
            refresh=f'<meta http-equiv="refresh" content="{refresh};url={html.escape(link)}">\n' if refresh else "")
        self._send(status, "text/html; charset=utf-8", page.encode("utf-8"), [
            ("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'"),
            ("X-Frame-Options", "DENY")])


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    signin = None


def make_server(port, app_dir=APP, config_dir=None):
    """The little web server for the TV, only reachable from this computer.
    Port 0 means "any free port" (the tests use that)."""
    httpd = Server(("127.0.0.1", port), functools.partial(Handler, directory=app_dir))
    httpd.signin = GoogleSignIn(httpd.server_address[1], config_dir)
    return httpd


def profile_dir(path, snap_name):
    """A separate browser profile just for the TV (no sign-ins, no history mixed in).
    Ubuntu's snap browsers can't use hidden folders, so they get one inside ~/snap."""
    home = os.path.expanduser("~")
    if "/snap/" in os.path.realpath(path) or path.startswith("/snap/"):
        d = os.path.join(home, "snap", snap_name, "common", "channel-surf")
    else:
        d = os.path.join(home, ".config", "channel-surf-browser-" + snap_name)
    os.makedirs(d, exist_ok=True)
    return d


def find_browser(window):
    """Prefer Chrome/Chromium (best YouTube support), then Firefox."""
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            flags = [f"--user-data-dir={profile_dir(path, 'chromium')}", "--no-first-run", "--no-default-browser-check",
                     "--disable-translate", "--disable-features=Translate", "--password-store=basic",
                     "--disable-session-crashed-bubble", "--noerrdialogs", "--overscroll-history-navigation=0",
                     # the power button is a click anyway; this just makes sure sound is never blocked
                     "--autoplay-policy=no-user-gesture-required"]
            flags += ["--start-maximized"] if window else ["--kiosk"]
            return path, flags
    path = shutil.which("firefox")
    if path:
        flags = ["--new-instance", "--profile", profile_dir(path, "firefox")]
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
    try:
        httpd = make_server(args.port)
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
