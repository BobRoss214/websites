// Optional Google sign-in, for real likes, subscriptions, comments and
// playlists. The sign-in itself is handled by tv.py on this computer: the
// long-term sign-in stays in a private file there and never goes into the
// browser. The app only asks tv.py for a short-lived pass when it needs one.
// In demo mode there's a pretend account so the features can be tried.
import { S, save } from './store.js';

const H = { 'X-Channel-Surf': '1' };
const err = (kind, message) => Object.assign(new Error(message), { kind });
let tok = null;

export const account = {
  available: false,   // tv.py is running and supports sign-in
  configured: false,  // a Google sign-in client has been set up
  signedIn: false,
  demo: false,
  get name() { return (S.account && S.account.name) || ''; },

  async refresh() {
    if (!S.apiKey) {
      Object.assign(this, { available: true, configured: true, signedIn: !!S.demoSignedIn, demo: true });
      return this;
    }
    this.demo = false;
    try {
      const r = await fetch('/api/oauth/status', { headers: H, cache: 'no-store' });
      if (!r.ok) throw 0;
      const j = await r.json();
      Object.assign(this, { available: true, configured: !!j.configured, signedIn: !!j.signedIn });
    } catch { Object.assign(this, { available: false, configured: false, signedIn: false }); }
    if (!this.signedIn) tok = null;
    return this;
  },

  // a short-lived pass for one YouTube request
  async token() {
    if (tok && tok.expires_at * 1000 - Date.now() > 60e3) return tok.access_token;
    let r;
    try { r = await fetch('/api/oauth/token', { headers: H, cache: 'no-store' }); }
    catch { throw err('network', 'Can\'t reach the Channel Surf program on this computer.'); }
    if (r.status === 401) { this.signedIn = false; tok = null; throw err('signedOut', 'You\'re not signed in to YouTube.'); }
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw err('network', j.error || 'Signing in to YouTube didn\'t work just now.'); }
    tok = await r.json();
    return tok.access_token;
  },

  signIn() {
    if (this.demo) { S.demoSignedIn = true; S.account = { name: 'Demo Viewer' }; save(true); this.signedIn = true; return; }
    location.href = '/api/oauth/start';
  },
  // the pass stopped working (signed out on Google's side): ask again next time
  forget() { tok = null; this.signedIn = false; },
  async signOut() {
    tok = null;
    if (this.demo) S.demoSignedIn = false;
    else await fetch('/api/oauth/signout', { method: 'POST', headers: H }).catch(() => {});
    this.signedIn = false; S.account = null; save(true);
  },
  async saveClient(client_id, client_secret) {
    const r = await fetch('/api/oauth/config', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id, client_secret }) }).catch(() => null);
    if (!r) throw err('network', 'Can\'t reach the Channel Surf program. Is it running?');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw err('other', j.error || 'That didn\'t save.');
    await this.refresh();
    return true;
  },
};
