/* Wise Acres: privacy-friendly analytics (off until you choose a provider).
 *
 * No cookies, no ads, nothing personal. It is skipped completely for visitors who send
 * "Do Not Track" or "Global Privacy Control". Choose a provider in js/content.js:
 *
 *   analytics: { provider: 'plausible',   site: 'wiseacresorganic.com' }
 *   analytics: { provider: 'goatcounter', endpoint: 'https://YOURCODE.goatcounter.com/count' }
 *   analytics: { provider: 'umami',       site: 'YOUR-WEBSITE-ID', src: 'https://YOUR-UMAMI/script.js' }
 *   analytics: { provider: 'cloudflare',  token: 'YOUR-BEACON-TOKEN' }        (page views only)
 *   analytics: { provider: 'none' }                                            (default: nothing is sent)
 *
 * What it records: which buttons people tap (Reserve, Directions, Email, Pizza pre-order,
 * Email signup, Instagram), which sections they reach, season and language changes.
 */
(() => {
  'use strict';
  const W = window.WISE_ACRES;
  if (!W) return;
  const cfg = W.analytics || { provider: 'none' };
  const doc = document;
  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  const debug = /[?&]track=debug\b/.test(location.search);
  const log = [];

  const provider = dnt ? 'none' : (cfg.provider || 'none');
  const on = provider !== 'none' || debug;
  if (!on) return;
  W.analyticsLog = log;

  function addScript(attrs) {
    const s = doc.createElement('script');
    s.defer = true;
    Object.keys(attrs).forEach((k) => s.setAttribute(k, attrs[k]));
    doc.head.appendChild(s);
  }
  if (provider === 'plausible' && cfg.site) {
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    addScript({ 'data-domain': cfg.site, src: cfg.src || 'https://plausible.io/js/script.tagged-events.js' });
  } else if (provider === 'goatcounter' && cfg.endpoint) {
    addScript({ 'data-goatcounter': cfg.endpoint, src: cfg.src || 'https://gc.zgo.at/count.js' });
  } else if (provider === 'umami' && cfg.site && cfg.src) {
    addScript({ 'data-website-id': cfg.site, src: cfg.src });
  } else if (provider === 'cloudflare' && cfg.token) {
    addScript({ 'data-cf-beacon': JSON.stringify({ token: cfg.token }), src: 'https://static.cloudflareinsights.com/beacon.min.js' });
  }

  function track(name, props) {
    log.push({ name, props: props || {} });
    if (debug) console.log('[analytics]', name, props || {});
    try {
      if (provider === 'plausible' && window.plausible) window.plausible(name, { props: props || {} });
      else if (provider === 'goatcounter' && window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'event/' + name + (props && props.where ? '/' + props.where : ''), title: name, event: true });
      else if (provider === 'umami' && window.umami && window.umami.track) window.umami.track(name, props || {});
    } catch (e) { /* analytics must never break the page */ }
  }

  const where = (el) => { const s = el.closest('section[id], header, footer, .mobile-bar, .action-bar'); return s ? (s.id || s.className.split(' ')[0]) : 'page'; };
  const RULES = [
    [/bookeo\.com/, 'Reserve click'], [/^mailto:/, 'Email click'], [/google\.com\/maps/, 'Directions click'],
    [/square\.site/, 'Pizza pre-order click'], [/eepurl\.com/, 'Email signup click'], [/instagram\.com/, 'Instagram click'], [/^tel:/, 'Phone click'],
    [/docs\.google\.com\/forms/, 'School tour form click'],
  ];
  doc.addEventListener('click', (e) => {
    const a = e.target.closest('a[href], [data-track]');
    if (!a) return;
    const manual = a.getAttribute('data-track');
    if (manual) { track(manual, { where: where(a) }); return; }
    const href = a.getAttribute('href') || '';
    const hit = RULES.find(([rx]) => rx.test(href));
    if (hit) track(hit[1], { where: where(a) });
  }, true);

  doc.addEventListener('wa:season', (e) => track('Season preview', { season: e.detail }));
  doc.addEventListener('wa:lang', (e) => track('Language change', { lang: e.detail }));
  let picked = false;
  doc.addEventListener('click', (e) => { if (!picked && e.target.closest('[data-pick], #pick-btn, [data-rig], [data-fire]')) { picked = true; track('Hero played'); } }, true);

  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting && !seen.has(en.target.id)) { seen.add(en.target.id); track('Section view', { section: en.target.id }); }
    }), { threshold: 0.35 });
    ['visit', 'seasons', 'tomatoes', 'pizza', 'greenhouse', 'flowers', 'groups', 'about', 'faq', 'reserve', 'contact'].forEach((id) => { const el = doc.getElementById(id); if (el) io.observe(el); });
  }

  W.track = track;
})();
