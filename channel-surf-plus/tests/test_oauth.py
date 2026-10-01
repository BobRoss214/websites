"""Tests for tv.py's Google sign-in and file serving, against a pretend Google.

Run with:   cd channel-surf-plus && python3 -m unittest tests/test_oauth.py -v

Nothing here touches the real Google or your real settings: HOME points at a
throwaway folder and the CS_GOOGLE_* addresses point at a tiny fake server.
"""
import base64
import hashlib
import http.client
import http.server
import json
import os
import shutil
import socket
import stat
import sys
import tempfile
import threading
import time
import unittest
import urllib.parse
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import tv  # noqa: E402

CLIENT_ID = "1234567890-abcdefghijklmnop.apps.googleusercontent.com"
SECRET = "GOCSPX-test-secret"
SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl"


class FakeGoogle:
    """Just enough of Google's token and revoke endpoints."""

    def __init__(self):
        fake = self
        self.lock = threading.Lock()
        self.reset()

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0)
                form = {k: v[0] for k, v in urllib.parse.parse_qs(self.rfile.read(n).decode()).items()}
                path = self.path.split("?")[0]
                with fake.lock:
                    fake.calls.append((path, form))
                if path == "/token":
                    status, reply = fake.token(form)
                elif path == "/revoke":
                    status, reply = 200, {}
                else:
                    status, reply = 404, {"error": "not_found"}
                body = json.dumps(reply).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.httpd.daemon_threads = True
        threading.Thread(target=self.httpd.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def reset(self):
        with self.lock:
            self.calls = []
            self.refreshes = 0
        self.refresh_error = None
        self.refresh_delay = 0

    def grants(self, kind):
        with self.lock:
            return [f for p, f in self.calls if p == "/token" and f.get("grant_type") == kind]

    def revokes(self):
        with self.lock:
            return [f for p, f in self.calls if p == "/revoke"]

    def token(self, form):
        if form.get("client_id") != CLIENT_ID or form.get("client_secret") != SECRET:
            return 401, {"error": "invalid_client"}
        grant = form.get("grant_type")
        if grant == "authorization_code":
            if not form.get("code_verifier") or not form.get("redirect_uri"):
                return 400, {"error": "invalid_request"}
            if form.get("code") == "good-code":
                return 200, {"access_token": "access-1", "expires_in": 3599, "refresh_token": "refresh-1",
                             "scope": SCOPE, "token_type": "Bearer"}
            if form.get("code") == "narrow-code":   # the person unticked the YouTube box
                return 200, {"access_token": "access-x", "expires_in": 3599, "refresh_token": "refresh-x",
                             "scope": "openid", "token_type": "Bearer"}
            return 400, {"error": "invalid_grant", "error_description": "Bad Request"}
        if grant == "refresh_token":
            time.sleep(self.refresh_delay)
            if self.refresh_error:
                return 400, {"error": self.refresh_error}
            if form.get("refresh_token") != "refresh-1":
                return 400, {"error": "invalid_grant"}
            with self.lock:
                self.refreshes += 1
                n = self.refreshes
            return 200, {"access_token": f"access-refreshed-{n}", "expires_in": 3599, "scope": SCOPE,
                         "token_type": "Bearer"}
        return 400, {"error": "unsupported_grant_type"}

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()


def closed_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.google = FakeGoogle()

    @classmethod
    def tearDownClass(cls):
        cls.google.close()

    def setUp(self):
        self.google.reset()
        self.home = tempfile.mkdtemp(prefix="cs-home-")
        self.addCleanup(shutil.rmtree, self.home, True)
        no_proxy = "127.0.0.1,localhost," + os.environ.get("no_proxy", "")
        env = mock.patch.dict(os.environ, {
            "HOME": self.home,
            "CS_GOOGLE_AUTH_URL": self.google.url + "/auth",
            "CS_GOOGLE_TOKEN_URL": self.google.url + "/token",
            "CS_GOOGLE_REVOKE_URL": self.google.url + "/revoke",
            "no_proxy": no_proxy, "NO_PROXY": no_proxy,
        })
        env.start()
        self.addCleanup(env.stop)
        self.httpd = self.start_server(tv.APP)
        self.port = self.httpd.server_address[1]
        self.signin = self.httpd.signin
        self.dir = os.path.join(self.home, ".config", "channel-surf")
        self.token_file = os.path.join(self.dir, "google-token.json")
        self.client_file = os.path.join(self.dir, "google-oauth.json")

    def start_server(self, app_dir):
        httpd = tv.make_server(0, app_dir)
        threading.Thread(target=httpd.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True).start()
        self.addCleanup(httpd.server_close)
        self.addCleanup(httpd.shutdown)
        return httpd

    # ----- talking to tv.py like a browser would -----
    def call(self, method, path, body=None, headers=None, host="default", port=None):
        port = port or self.port
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=20)
        try:
            conn.putrequest(method, path, skip_host=True, skip_accept_encoding=True)
            if host == "default":
                host = f"localhost:{port}"
            if host is not None:
                conn.putheader("Host", host)
            for k, v in (headers or {}).items():
                conn.putheader(k, v)
            if body is not None:
                conn.putheader("Content-Length", str(len(body)))
            conn.endheaders(body)
            resp = conn.getresponse()
            data = resp.read()
        finally:
            conn.close()
        # we must never tell other websites they may read our answers
        for k, _ in resp.getheaders():
            self.assertFalse(k.lower().startswith("access-control-"), f"CORS header sent: {k}")
        return resp.status, resp, data

    def get(self, path, headers=None, **kw):
        h = {"Sec-Fetch-Site": "same-origin"}
        h.update(headers or {})
        status, resp, data = self.call("GET", path, headers=h, **kw)
        return status, resp, data

    def get_json(self, path, headers=None, **kw):
        status, resp, data = self.get(path, headers, **kw)
        self.assertEqual(resp.getheader("Content-Type"), "application/json; charset=utf-8")
        return status, json.loads(data)

    def post_json(self, path, payload=None, headers=None, raw=None):
        h = {"X-Channel-Surf": "1", "Origin": f"http://localhost:{self.port}", "Sec-Fetch-Site": "same-origin",
             "Content-Type": "application/json"}
        h.update(headers or {})
        h = {k: v for k, v in h.items() if v is not None}
        body = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else b"")
        status, resp, data = self.call("POST", path, body=body, headers=h)
        return status, json.loads(data)

    def configure(self):
        status, j = self.post_json("/api/oauth/config", {"client_id": CLIENT_ID, "client_secret": SECRET})
        self.assertEqual((status, j), (200, {"ok": True}))

    def start_sign_in(self):
        status, resp, _ = self.get("/api/oauth/start")
        self.assertEqual(status, 302)
        loc = resp.getheader("Location")
        parts = urllib.parse.urlsplit(loc)
        params = {k: v[0] for k, v in urllib.parse.parse_qs(parts.query).items()}
        return loc, params

    def come_back(self, query):
        # Google sends the browser back from its own site, so Sec-Fetch-Site is cross-site
        return self.call("GET", "/api/oauth/callback?" + urllib.parse.urlencode(query),
                         headers={"Sec-Fetch-Site": "cross-site"})

    def sign_in(self):
        self.configure()
        _, params = self.start_sign_in()
        status, resp, data = self.come_back({"code": "good-code", "state": params["state"], "scope": SCOPE})
        self.assertEqual(status, 200, data)
        return params

    def write_token(self, **changes):
        with open(self.token_file) as f:
            t = json.load(f)
        t.update(changes)
        with open(self.token_file, "w") as f:
            json.dump(t, f)

    def read_token(self):
        with open(self.token_file) as f:
            return json.load(f)


class HealthAndConfig(Base):
    def test_health(self):
        status, j = self.get_json("/api/health")
        self.assertEqual((status, j), (200, {"ok": True, "oauth": True, "app": "Channel Surf", "version": tv.VERSION}))

    def test_api_answers_are_never_cached(self):
        status, resp, _ = self.get("/api/oauth/status")
        self.assertEqual(status, 200)
        self.assertEqual(resp.getheader("Cache-Control"), "no-store")
        self.assertEqual(resp.getheader("X-Content-Type-Options"), "nosniff")

    def test_status_before_and_after_config(self):
        self.assertEqual(self.get_json("/api/oauth/status"),
                         (200, {"configured": False, "signedIn": False, "scope": None}))
        self.configure()
        self.assertEqual(self.get_json("/api/oauth/status"),
                         (200, {"configured": True, "signedIn": False, "scope": None}))
        self.sign_in()
        self.assertEqual(self.get_json("/api/oauth/status"),
                         (200, {"configured": True, "signedIn": True, "scope": SCOPE}))

    def test_config_validation(self):
        bad = [
            {"client_id": "1234-abc.example.com", "client_secret": SECRET},
            {"client_id": ".apps.googleusercontent.com", "client_secret": SECRET},
            {"client_id": "12 34.apps.googleusercontent.com", "client_secret": SECRET},
            {"client_id": "", "client_secret": SECRET},
            {"client_id": CLIENT_ID, "client_secret": ""},
            {"client_id": CLIENT_ID, "client_secret": "   "},
            {"client_id": CLIENT_ID},
            {"client_secret": SECRET},
            {"client_id": 42, "client_secret": SECRET},
        ]
        for payload in bad:
            with self.subTest(payload=payload):
                status, j = self.post_json("/api/oauth/config", payload)
                self.assertEqual(status, 400)
                self.assertIsInstance(j.get("error"), str)
                self.assertGreater(len(j["error"]), 10)
        for raw in (b"not json", b"[1, 2]", b""):
            with self.subTest(raw=raw):
                status, j = self.post_json("/api/oauth/config", raw=raw)
                self.assertEqual(status, 400)
                self.assertIsInstance(j.get("error"), str)
        self.assertFalse(os.path.exists(self.client_file))
        self.assertEqual(self.get_json("/api/oauth/status")[1]["configured"], False)

    def test_config_too_big(self):
        status, j = self.post_json("/api/oauth/config", raw=b"x" * (tv.MAX_BODY + 1))
        self.assertEqual(status, 413)

    def test_config_saved_privately(self):
        status, j = self.post_json("/api/oauth/config",
                                   {"client_id": "  " + CLIENT_ID + " ", "client_secret": SECRET + "\n"})
        self.assertEqual((status, j), (200, {"ok": True}))
        self.assertEqual(stat.S_IMODE(os.stat(self.dir).st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(os.stat(self.client_file).st_mode), 0o600)
        with open(self.client_file) as f:
            self.assertEqual(json.load(f), {"client_id": CLIENT_ID, "client_secret": SECRET})
        self.assertEqual([n for n in os.listdir(self.dir) if n.startswith(".")], [])   # no leftovers

    def test_new_client_signs_out(self):
        self.sign_in()
        self.configure()   # same client again: still signed in
        self.assertTrue(os.path.exists(self.token_file))
        other = {"client_id": "999-other.apps.googleusercontent.com", "client_secret": "other"}
        self.assertEqual(self.post_json("/api/oauth/config", other), (200, {"ok": True}))
        self.assertFalse(os.path.exists(self.token_file))
        self.assertEqual(self.get_json("/api/oauth/status")[1],
                         {"configured": True, "signedIn": False, "scope": None})


class SignIn(Base):
    def test_start_when_not_configured(self):
        status, resp, _ = self.get("/api/oauth/start")
        self.assertEqual(status, 302)
        self.assertEqual(resp.getheader("Location"), "/?oauth=notconfigured")

    def test_start_redirects_to_google_with_everything(self):
        self.configure()
        loc, params = self.start_sign_in()
        self.assertTrue(loc.startswith(self.google.url + "/auth?"), loc)
        self.assertEqual(params["client_id"], CLIENT_ID)
        self.assertEqual(params["redirect_uri"], f"http://127.0.0.1:{self.port}/api/oauth/callback")
        self.assertEqual(params["response_type"], "code")
        self.assertEqual(params["scope"], SCOPE)
        self.assertEqual(params["access_type"], "offline")
        self.assertEqual(params["prompt"], "consent")
        self.assertEqual(params["include_granted_scopes"], "true")
        self.assertEqual(params["code_challenge_method"], "S256")
        self.assertGreaterEqual(len(params["state"]), 32)
        self.assertRegex(params["code_challenge"], r"^[A-Za-z0-9_-]{43}$")
        # the secret word kept here really scrambles to the challenge sent to Google
        verifier, _ = self.signin.pending[params["state"]]
        self.assertTrue(43 <= len(verifier) <= 128)
        digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        self.assertEqual(digest, params["code_challenge"])
        # every sign-in gets its own state and secret word
        _, again = self.start_sign_in()
        self.assertNotEqual(again["state"], params["state"])
        self.assertNotEqual(again["code_challenge"], params["code_challenge"])

    def test_callback_happy_path(self):
        self.configure()
        _, params = self.start_sign_in()
        before = time.time()
        status, resp, data = self.come_back({"code": "good-code", "state": params["state"], "scope": SCOPE})
        self.assertEqual(status, 200)
        self.assertEqual(resp.getheader("Content-Type"), "text/html; charset=utf-8")
        self.assertIn("default-src 'none'", resp.getheader("Content-Security-Policy"))
        self.assertEqual(resp.getheader("Referrer-Policy"), "no-referrer")
        page = data.decode()
        self.assertIn("Signed in to YouTube", page)
        # back to http://localhost, where the TV's settings live (Google came back to 127.0.0.1)
        self.assertIn(f'<meta http-equiv="refresh" content="2;url=http://localhost:{self.port}/?oauth=ok">', page)
        for colour in ("#0b1f6b", "#ffd23f", "#fff"):
            self.assertIn(colour, page)

        # what Google was sent: the code, the client, the same return address, and the PKCE word
        [form] = self.google.grants("authorization_code")
        self.assertEqual(form["code"], "good-code")
        self.assertEqual(form["client_id"], CLIENT_ID)
        self.assertEqual(form["client_secret"], SECRET)
        self.assertEqual(form["redirect_uri"], params["redirect_uri"])
        digest = base64.urlsafe_b64encode(hashlib.sha256(form["code_verifier"].encode()).digest()).rstrip(b"=")
        self.assertEqual(digest.decode(), params["code_challenge"])

        # the sign-in is saved privately
        self.assertEqual(stat.S_IMODE(os.stat(self.token_file).st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(os.stat(self.dir).st_mode), 0o700)
        t = self.read_token()
        self.assertEqual(t["refresh_token"], "refresh-1")
        self.assertEqual(t["access_token"], "access-1")
        self.assertEqual(t["scope"], SCOPE)
        self.assertTrue(before + 3500 <= t["expires_at"] <= time.time() + 3600)
        self.assertEqual(self.signin.pending, {})

    def assert_failed_page(self, status, resp, data, code=400):
        self.assertEqual(status, code)
        self.assertEqual(resp.getheader("Content-Type"), "text/html; charset=utf-8")
        page = data.decode()
        self.assertIn("Sign-in didn&#x27;t work", page)
        self.assertIn(f'href="http://localhost:{self.port}/?oauth=failed"', page)
        self.assertIn("#0b1f6b", page)
        self.assertNotIn("http-equiv=\"refresh\"", page)
        self.assertFalse(os.path.exists(self.token_file))
        return page

    def test_callback_bad_state(self):
        self.configure()
        self.start_sign_in()
        page = self.assert_failed_page(*self.come_back({"code": "good-code", "state": "made-up"}))
        self.assertIn("start again", page)
        self.assertEqual(self.google.grants("authorization_code"), [])   # Google never asked

    def test_callback_without_state(self):
        self.configure()
        self.assert_failed_page(*self.come_back({"code": "good-code"}))

    def test_callback_state_only_works_once(self):
        self.configure()
        _, params = self.start_sign_in()
        self.assertEqual(self.come_back({"code": "good-code", "state": params["state"]})[0], 200)
        os.remove(self.token_file)
        self.assert_failed_page(*self.come_back({"code": "good-code", "state": params["state"]}))

    def test_callback_state_runs_out_after_ten_minutes(self):
        self.configure()
        _, params = self.start_sign_in()
        verifier, _ = self.signin.pending[params["state"]]
        self.signin.pending[params["state"]] = (verifier, time.time() - 601)
        self.assert_failed_page(*self.come_back({"code": "good-code", "state": params["state"]}))

    def test_callback_access_denied(self):
        self.configure()
        _, params = self.start_sign_in()
        page = self.assert_failed_page(*self.come_back({"error": "access_denied", "state": params["state"]}))
        self.assertIn("You chose not to sign in", page)
        self.assertEqual(self.signin.pending, {})

    def test_callback_google_rejects_code(self):
        self.configure()
        _, params = self.start_sign_in()
        self.assert_failed_page(*self.come_back({"code": "stale-code", "state": params["state"]}), code=502)

    def test_callback_youtube_box_not_ticked(self):
        self.configure()
        _, params = self.start_sign_in()
        page = self.assert_failed_page(*self.come_back({"code": "narrow-code", "state": params["state"]}))
        self.assertIn("tick", page)

    def test_callback_google_unreachable(self):
        self.configure()
        _, params = self.start_sign_in()
        self.signin.token_url = f"http://127.0.0.1:{closed_port()}/token"
        page = self.assert_failed_page(*self.come_back({"code": "good-code", "state": params["state"]}), code=502)
        self.assertIn("internet", page)

    def test_callback_escapes_what_google_says(self):
        self.configure()
        page = self.assert_failed_page(*self.come_back({"error": "<script>alert(1)</script>"}))
        self.assertNotIn("<script>", page)


class Tokens(Base):
    def test_token_when_signed_out(self):
        self.assertEqual(self.get_json("/api/oauth/token"), (401, {"error": "signed_out"}))
        self.configure()
        self.assertEqual(self.get_json("/api/oauth/token"), (401, {"error": "signed_out"}))

    def test_token_cached(self):
        self.sign_in()
        status, j = self.get_json("/api/oauth/token")
        self.assertEqual(status, 200)
        self.assertEqual(set(j), {"access_token", "expires_at"})
        self.assertEqual(j["access_token"], "access-1")
        self.assertEqual(j["expires_at"], self.read_token()["expires_at"])
        self.assertEqual(self.get_json("/api/oauth/token")[1]["access_token"], "access-1")
        self.assertEqual(self.google.grants("refresh_token"), [])

    def test_token_refreshed_when_nearly_used_up(self):
        self.sign_in()
        self.write_token(expires_at=int(time.time()) + 60)   # less than 2 minutes left
        status, j = self.get_json("/api/oauth/token")
        self.assertEqual(status, 200)
        self.assertEqual(j["access_token"], "access-refreshed-1")
        self.assertGreater(j["expires_at"], time.time() + 3500)
        [form] = self.google.grants("refresh_token")
        self.assertEqual(form, {"client_id": CLIENT_ID, "client_secret": SECRET, "refresh_token": "refresh-1",
                                "grant_type": "refresh_token"})
        t = self.read_token()
        self.assertEqual((t["access_token"], t["refresh_token"]), ("access-refreshed-1", "refresh-1"))
        self.assertEqual(stat.S_IMODE(os.stat(self.token_file).st_mode), 0o600)
        # and now it's cached again
        self.assertEqual(self.get_json("/api/oauth/token")[1]["access_token"], "access-refreshed-1")
        self.assertEqual(len(self.google.grants("refresh_token")), 1)

    def test_token_refreshed_when_expired(self):
        self.sign_in()
        self.write_token(expires_at=int(time.time()) - 600)
        self.assertEqual(self.get_json("/api/oauth/token")[1]["access_token"], "access-refreshed-1")

    def test_many_requests_at_once_refresh_only_once(self):
        self.sign_in()
        self.write_token(expires_at=0)
        self.google.refresh_delay = 0.3
        results = []

        def ask():
            results.append(self.get_json("/api/oauth/token"))

        threads = [threading.Thread(target=ask) for _ in range(8)]
        for th in threads:
            th.start()
        for th in threads:
            th.join(30)
        self.assertEqual(len(results), 8)
        self.assertEqual({(s, j["access_token"]) for s, j in results}, {(200, "access-refreshed-1")})
        self.assertEqual(len(self.google.grants("refresh_token")), 1)

    def test_invalid_grant_signs_out(self):
        self.sign_in()
        self.write_token(expires_at=0)
        self.google.refresh_error = "invalid_grant"
        self.assertEqual(self.get_json("/api/oauth/token"), (401, {"error": "signed_out"}))
        self.assertFalse(os.path.exists(self.token_file))
        self.assertEqual(self.get_json("/api/oauth/status")[1]["signedIn"], False)

    def test_other_google_errors_keep_the_sign_in(self):
        self.sign_in()
        self.write_token(expires_at=0)
        self.google.refresh_error = "invalid_client"
        status, j = self.get_json("/api/oauth/token")
        self.assertEqual(status, 502)
        self.assertIn("client", j["error"])
        self.assertTrue(os.path.exists(self.token_file))

    def test_network_error(self):
        self.sign_in()
        self.write_token(expires_at=0)
        self.signin.token_url = f"http://127.0.0.1:{closed_port()}/token"
        status, j = self.get_json("/api/oauth/token")
        self.assertEqual(status, 502)
        self.assertIn("internet", j["error"])
        self.assertTrue(os.path.exists(self.token_file))


class SignOut(Base):
    def test_signout_revokes_and_forgets(self):
        self.sign_in()
        self.assertEqual(self.post_json("/api/oauth/signout"), (200, {"ok": True}))
        self.assertEqual(self.google.revokes(), [{"token": "refresh-1"}])
        self.assertFalse(os.path.exists(self.token_file))
        self.assertTrue(os.path.exists(self.client_file))   # the client settings stay
        self.assertEqual(self.get_json("/api/oauth/status")[1],
                         {"configured": True, "signedIn": False, "scope": None})
        self.assertEqual(self.get_json("/api/oauth/token"), (401, {"error": "signed_out"}))

    def test_signout_when_signed_out(self):
        self.assertEqual(self.post_json("/api/oauth/signout"), (200, {"ok": True}))
        self.assertEqual(self.google.revokes(), [])

    def test_signout_works_offline(self):
        self.sign_in()
        self.signin.revoke_url = f"http://127.0.0.1:{closed_port()}/revoke"
        self.assertEqual(self.post_json("/api/oauth/signout"), (200, {"ok": True}))
        self.assertFalse(os.path.exists(self.token_file))


class OtherWebsitesAreBlocked(Base):
    good_config = {"client_id": CLIENT_ID, "client_secret": SECRET}

    def test_post_from_another_website(self):
        for origin in ("http://evil.example", "null", f"http://localhost:{self.port + 1}",
                       f"https://localhost:{self.port}"):
            with self.subTest(origin=origin):
                status, j = self.post_json("/api/oauth/config", self.good_config,
                                           headers={"Origin": origin, "Sec-Fetch-Site": None})
                self.assertEqual(status, 403)
                self.assertIn("error", j)
        self.assertFalse(os.path.exists(self.client_file))

    def test_post_needs_the_channel_surf_header(self):
        for value in (None, "0", "yes"):
            with self.subTest(value=value):
                status, _ = self.post_json("/api/oauth/config", self.good_config, headers={"X-Channel-Surf": value})
                self.assertEqual(status, 403)
        self.sign_in()
        status, _ = self.post_json("/api/oauth/signout", headers={"X-Channel-Surf": None})
        self.assertEqual(status, 403)
        self.assertTrue(os.path.exists(self.token_file))

    def test_post_with_cross_site_fetch(self):
        for site in ("cross-site", "same-site"):
            with self.subTest(site=site):
                status, _ = self.post_json("/api/oauth/config", self.good_config,
                                           headers={"Sec-Fetch-Site": site, "Origin": None})
                self.assertEqual(status, 403)

    def test_token_from_another_website(self):
        self.sign_in()
        for headers in ({"Sec-Fetch-Site": "cross-site"}, {"Sec-Fetch-Site": "same-site"},
                        {"Origin": "http://evil.example"}):
            with self.subTest(headers=headers):
                status, j = self.get_json("/api/oauth/token", headers=headers)
                self.assertEqual(status, 403)
                self.assertNotIn("access_token", j)
        # typed into the address bar, or asked by the TV page itself: fine
        for headers in ({"Sec-Fetch-Site": "none"}, {"Origin": f"http://127.0.0.1:{self.port}"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.get_json("/api/oauth/token", headers=headers)[0], 200)

    def test_start_from_another_website(self):
        self.configure()
        status, resp, _ = self.get("/api/oauth/start", headers={"Sec-Fetch-Site": "cross-site"})
        self.assertEqual(status, 403)
        self.assertEqual(self.signin.pending, {})

    def test_wrong_host(self):
        for host in ("evil.example", f"evil.example:{self.port}", f"localhost:{self.port + 1}",
                     f"localhost.evil.example:{self.port}", "localhost", None):
            with self.subTest(host=host):
                status, resp, data = self.get("/api/health", host=host)
                self.assertEqual(status, 403)
                status, resp, data = self.get("/api/oauth/callback?code=x&state=y", host=host)
                self.assertEqual(status, 403)
        self.assertEqual(self.get("/api/health", host=f"127.0.0.1:{self.port}")[0], 200)
        self.assertEqual(self.get("/api/health", host=f"LOCALHOST:{self.port}")[0], 200)

    def test_preflight_is_never_approved(self):
        status, resp, _ = self.call("OPTIONS", "/api/oauth/config", headers={
            "Origin": "http://evil.example", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-channel-surf,content-type"})
        self.assertNotEqual(status // 100, 2)   # (the CORS-header check is in call())

    def test_unknown_paths_and_wrong_methods(self):
        self.assertEqual(self.get_json("/api/nope")[0], 404)
        self.assertEqual(self.get_json("/api/oauth/signout")[0], 405)
        self.assertEqual(self.post_json("/api/health")[0], 405)
        self.assertEqual(self.call("HEAD", "/api/oauth/token")[0], 405)


class AppFiles(Base):
    def test_index_and_assets(self):
        for path, ctype in (("/", "text/html"), ("/index.html", "text/html"), ("/?oauth=ok", "text/html"),
                            ("/css/tv.css", "text/css"), ("/js/main.js", "text/javascript"),
                            ("/fonts/barlow-condensed-700.woff2", "font/woff2"), ("/icon.svg", "image/svg+xml")):
            with self.subTest(path=path):
                status, resp, data = self.call("GET", path)
                self.assertEqual(status, 200)
                self.assertTrue(resp.getheader("Content-Type").startswith(ctype), resp.getheader("Content-Type"))
                self.assertEqual(resp.getheader("Cache-Control"), "no-cache")
                self.assertEqual(resp.getheader("Referrer-Policy"), "strict-origin-when-cross-origin")
                self.assertGreater(len(data), 0)
        with open(os.path.join(tv.APP, "index.html"), "rb") as f:
            self.assertEqual(self.call("GET", "/index.html")[2], f.read())

    def test_static_files_work_from_any_address(self):
        # the app's own files aren't secret, so the Host check is only for /api/
        self.assertEqual(self.call("GET", "/index.html", host="127.0.0.1")[0], 200)

    def test_nothing_outside_the_app_folder(self):
        for path in ("/../tv.py", "/..%2ftv.py", "/%2e%2e/tv.py", "/js/../../tv.py", "/js/..%2f..%2ftv.py",
                     "//../tv.py", "/../tests/test_oauth.py", "/..\\tv.py", "/%2e%2e%5ctv.py", "/../../../etc/passwd"):
            with self.subTest(path=path):
                status, resp, data = self.call("GET", path)
                self.assertIn(status, (403, 404))
                self.assertNotIn(b"make_server", data)
                self.assertNotIn(b"root:", data)

    def test_links_out_of_the_app_folder_are_not_followed(self):
        app = tempfile.mkdtemp(prefix="cs-app-")
        self.addCleanup(shutil.rmtree, app, True)
        with open(os.path.join(app, "index.html"), "w") as f:
            f.write("<p>hi</p>")
        os.symlink(os.path.join(os.path.dirname(HERE), "tv.py"), os.path.join(app, "sneaky.py"))
        os.symlink(os.path.dirname(HERE), os.path.join(app, "up"))
        httpd = self.start_server(app)
        port = httpd.server_address[1]
        self.assertEqual(self.call("GET", "/index.html", port=port)[0], 200)
        for path in ("/sneaky.py", "/up/tv.py", "/up/"):
            with self.subTest(path=path):
                status, _, data = self.call("GET", path, port=port)
                self.assertEqual(status, 404)
                self.assertNotIn(b"make_server", data)


if __name__ == "__main__":
    unittest.main()
