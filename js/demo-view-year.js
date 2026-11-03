/* The account demo: the "My year" screen (account.html#year). Visits so far and this year, a year strip with a dot for each visit, and the badges
 * of the pick-and-play game on the home page, with how far each one is.
 * The game keeps nothing between visits (js/hero.js counts each visit on its own and stores nothing), so the pick counts here are SAMPLE numbers kept by
 * DemoStore (`badges`). The names, the 100 and 1,000 limits and the cheering lines below are the game's own words, copied from js/hero.js (ACH).
 * Pretend only. Needs js/demo-view-kit.js and the shell (js/demo-app.js). */
(function (W, D) {
  'use strict';
  var K = W.DemoViewKit;
  if (!K) { if (W.console) W.console.warn('Account demo: js/demo-view-kit.js is missing, so the "My year" screen cannot be drawn.'); return; }
  var h = K.h;

  // The six badges of the home page game. "at" is the number of picks that earns it; "time" counts the picks of all the others.
  var BADGES = [
    { kind: 'strawberry', art: 'strawberry', tint: 'c-pink', title: 'Berry Boss', rule: 'Pick 100 strawberries', unit: 'strawberries', at: 100, says: '100 strawberries! Your basket is overflowing. Time to make jam!' },
    { kind: 'blueberry', art: 'blueberry', tint: 'c-lilac', title: 'Blueberry Bandit', rule: 'Pick 100 blueberries', unit: 'blueberries', at: 100, says: '100 blueberries! Your fingers must be blue by now.' },
    { kind: 'sunflower', art: 'sunflower', tint: 'c-sun', title: 'Sunflower Whisperer', rule: 'Snip 100 sunflowers', unit: 'sunflowers', at: 100, says: '100 sunflowers snipped! You could open a flower stand.' },
    { kind: 'pumpkin', art: 'pumpkin', tint: 'c-orange', title: 'Pumpkin Champion', rule: 'Pick 100 pumpkins', unit: 'pumpkins', at: 100, says: '100 pumpkins! That is a lot of pie.' },
    { kind: 'winter', art: 'fir', tint: 'c-sky', title: 'Winter Sparkler', rule: 'Light trees and stoke fires: 100 in all', unit: 'lights and sparks', at: 100, says: '100 lights and sparks! You are lighting up the whole farm.' },
    { kind: 'time', art: 'trophy', tint: 'c-green', title: 'Wow, you’ve got a lot of time on your hands!', rule: '1,000 picks in all', unit: 'picks', at: 1000, says: 'That’s 1,000 picks!' }
  ];
  var PACKAGE = { pizza: 'Visit with pizza', farm: 'Farm fun only' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  K.css('dvy-css', [
    '.dvk .dvy-stats{display:grid;gap:clamp(12px,1.8vw,18px);grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr));margin:0;padding:0;list-style:none}',
    '.dvk .dvy-stat{display:grid;gap:2px;align-content:start;min-width:0;padding:14px 16px 16px;background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:0 4px 0 var(--ink)}',
    '.dvk .dvy-num{font:700 clamp(2.2rem,4vw,3rem)/1 var(--display);color:var(--red-deep)}',
    '.dvk .dvy-lab{font:800 1rem/1.25 var(--display)}',
    '.dvk .dvy-sub{margin:0;font-weight:600;font-size:.92rem;color:var(--ink-soft)}',
    '.dvk .dvy-months{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;margin:0;padding:0;list-style:none}',
    '.dvk .dvy-month{display:grid;justify-items:center;gap:4px;min-width:0;padding:7px 2px 8px;background:#fff;border:2.5px solid var(--ink);border-radius:14px;font:700 .86rem/1 var(--display)}',
    '.dvk .dvy-month.is-now{background:var(--sun);box-shadow:0 3px 0 var(--ink)}',
    '.dvk .dvy-dots{display:flex;flex-wrap:wrap;justify-content:center;gap:3px;min-height:14px}',
    '.dvk .dvy-dot{width:14px;height:14px;border:2.5px solid var(--ink);border-radius:50%;background:var(--ink)}',
    '.dvk .dvy-dot.is-next{background:#fff;border-style:dashed}',
    '@media (max-width:40em){.dvk .dvy-months{grid-template-columns:repeat(6,minmax(0,1fr))}}',
    '.dvk .dvy-legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin:10px 0 0;font-weight:700;font-size:.92rem}',
    '.dvk .dvy-legend .dvy-dot{display:inline-block;vertical-align:-2px;margin-right:6px}',
    '.dvk .dvy-visits{display:grid;gap:8px;margin:14px 0 0;padding:0;list-style:none}',
    '.dvk .dvy-visits li{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px;padding:.5em .9em;background:#fff;border:2.5px solid var(--ink);border-radius:16px;font-weight:700}',
    '.dvk .dvy-badges{display:grid;gap:clamp(14px,2vw,22px);grid-template-columns:repeat(auto-fit,minmax(min(100%,17.5rem),1fr));margin:0;padding:0;list-style:none}',
    '.dvk .dvy-badge{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;align-content:start;padding:16px 18px 18px}',
    '.dvk .dvy-badge.is-locked{--bg:#fff}',
    '.dvk .dvy-medal{grid-row:1/4;display:grid;place-items:center;width:72px;height:72px;padding:9px;background:#fff;border:3px solid var(--ink);border-radius:50%}',
    '.dvk .dvy-medal svg{width:100%;height:100%}',
    '.dvk .dvy-badge.is-locked .dvy-medal svg{opacity:.4;filter:grayscale(1)}',
    '.dvk .dvy-badge h4{margin:0;font:700 1.15rem/1.15 var(--display)}',
    '.dvk .dvy-badge .dvk-note{margin:0}',
    '.dvk .dvy-state{margin:2px 0 0}',
    '.dvk .dvy-bar{grid-column:1/-1;height:14px;margin-top:8px;background:#fff;border:2.5px solid var(--ink);border-radius:999px;overflow:hidden}',
    '.dvk .dvy-bar>span{display:block;height:100%;background:var(--green);border-right:2.5px solid var(--ink)}',
    '.dvk .dvy-bar>span[style*="width:0%"]{border-right:0}',
    '.dvk .dvy-prog{grid-column:1/-1;margin:2px 0 0;font:700 .92rem/1.3 var(--display)}',
    '.dvk .dvy-real{display:flex;flex-wrap:wrap;align-items:center;gap:12px 22px}',
    '.dvk .dvy-real p{margin:0;flex:1 1 20rem;font-weight:700}'
  ].join('\n'));

  var num = function (v) { v = Number(v); return isFinite(v) && v > 0 ? Math.floor(v) : 0; };
  var fmt = function (n) { try { return n.toLocaleString('en-US'); } catch (e) { return String(n); } };

  function paint(root, d) {
    var store = d.store, today = K.todayOf(d), year = today.slice(0, 4);
    var all = store.list('visits').filter(function (v) { return v && v.date && !v.closed; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var past = all.filter(function (v) { return v.date < today; });
    var next = all.filter(function (v) { return v.date >= today; });
    var thisYear = all.filter(function (v) { return v.date.slice(0, 4) === year; });
    var picks = store.get('badges') || {};
    var counts = { strawberry: num(picks.strawberry), blueberry: num(picks.blueberry), sunflower: num(picks.sunflower), pumpkin: num(picks.pumpkin), winter: num(picks.winter) };
    counts.time = counts.strawberry + counts.blueberry + counts.sunflower + counts.pumpkin + counts.winter;

    /* ---- the numbers */
    function stat(n, label, sub) {
      return h('li', { class: 'dvy-stat' }, [h('span', { class: 'dvy-num' }, fmt(n)), h('span', { class: 'dvy-lab' }, label), sub ? h('p', { class: 'dvy-sub' }, sub) : null]);
    }
    var stats = h('ul', { class: 'dvy-stats', 'aria-label': 'Your numbers' }, [
      stat(past.length, 'Visits so far', past.length ? 'Since your first visit.' : (next.length ? 'Your first one is coming up.' : 'Your first visit will show here.')),
      stat(past.filter(function (v) { return v.date.slice(0, 4) === year; }).length, 'Visits this year', 'In ' + year + '.'),
      stat(next.length, 'Coming up', next.length ? 'Next: ' + K.fmtDateShort(next[0].date) : 'Nothing booked yet.'),
      stat(counts.pumpkin, 'Pumpkins in the basket', counts.pumpkin >= 100 ? 'That is a Pumpkin Champion.' : 'Sample count from the game.')
    ]);

    /* ---- the year strip: one box for each month, a dot for each visit (a full dot is a visit that happened, a dashed one is coming up) */
    var nowMonth = +today.slice(5, 7) - 1;
    var strip = h('ol', { class: 'dvy-months', 'aria-hidden': 'true' }, MONTHS.map(function (m, i) {
      var inMonth = thisYear.filter(function (v) { return +v.date.slice(5, 7) - 1 === i; });
      return h('li', { class: 'dvy-month' + (i === nowMonth ? ' is-now' : '') }, [
        h('span', null, m),
        h('span', { class: 'dvy-dots' }, inMonth.slice(0, 6).map(function (v) { return h('span', { class: 'dvy-dot' + (v.date >= today ? ' is-next' : '') }); }))
      ]);
    }));
    var list = thisYear.length ? h('ul', { class: 'dvy-visits', 'aria-label': 'Your visits in ' + year }, thisYear.map(function (v) {
      return h('li', null, [h('span', null, K.fmtDate(v.date) + (v.time ? ' at ' + K.fmtTime(v.time) : '')), h('span', null, [PACKAGE[v.package] ? PACKAGE[v.package] + ' ' : '', K.chip(v.date >= today ? 'wait' : 'ok', v.date >= today ? 'Coming up' : 'Visited')])]);
    })) : h('p', { class: 'dvk-empty' }, 'No visits in ' + year + ' yet.');
    var yearCard = h('section', { class: 'dvk-card c-cream', 'aria-labelledby': 'dvy-h-year' }, [
      h('h3', { id: 'dvy-h-year' }, 'Visits in ' + year),
      strip,
      h('p', { class: 'dvy-legend', 'aria-hidden': 'true' }, [h('span', null, [h('span', { class: 'dvy-dot' }), 'Visited']), h('span', null, [h('span', { class: 'dvy-dot is-next' }), 'Coming up'])]),
      list
    ]);

    /* ---- the badges */
    var badgeCards = BADGES.map(function (b) {
      var n = counts[b.kind], earned = n >= b.at, pct = Math.min(100, Math.round(100 * n / b.at));
      var art = K.sprite(b.art);
      var id = K.uid('bd');
      return h('li', { class: 'dvk-card dvy-badge ' + (earned ? b.tint : 'is-locked') }, [
        h('span', { class: 'dvy-medal' }, art),
        h('h4', { id: id }, b.title),
        h('p', { class: 'dvk-note' }, b.rule),
        h('p', { class: 'dvy-state' }, earned ? K.chip('ok', 'Earned') : K.chip('info', 'Not yet')),
        earned ? h('p', { class: 'dvy-prog' }, b.says)
          : [h('div', { class: 'dvy-bar', 'aria-hidden': 'true' }, h('span', { style: 'width:' + pct + '%' })), h('p', { class: 'dvy-prog' }, fmt(n) + ' of ' + fmt(b.at) + ' ' + b.unit)]
      ]);
    });
    var shelf = h('section', { 'aria-labelledby': 'dvy-h-badges' }, [
      h('h3', { id: 'dvy-h-badges', class: 'dvy-shelf-h' }, 'The kids’ badges'),
      h('p', { class: 'dvk-note' }, 'From the picking game on the home page. These counts are samples for the demo.'),
      h('ul', { class: 'dvy-badges' }, badgeCards)
    ]);

    var real = h('section', { class: 'dvk-card c-sun dvy-real', 'aria-label': 'About these badges' }, [
      h('p', null, 'On the home page game, a badge lasts for one visit. On a real account it would be kept here and follow you to any phone.'),
      h('a', { class: 'btn btn-white btn-sm', href: 'index.html' }, 'Play the picking game')
    ]);

    K.add(root, h('div', { class: 'dvk dvk-screen', 'data-tour': 'acct-year' }, [
      K.head(null, null, null, 'How many times you came, and the badges the kids have earned in the picking game.'),
      stats, yearCard, shelf, real
    ]));
  }

  K.view('year', 'My year', { paint: paint, slice: function (d) { return d.store ? [d.store.list('visits'), d.store.get('badges')] : null; } });
})(window, document);
