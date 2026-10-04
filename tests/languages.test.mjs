// order: 290
// browser: yes
// quick: yes
// covers: js/features.js, js/live.js, js/i18n.js, lang/*, tools/i18n.py
/* The countdown, the chip, the "This week" box and the drive times in every language (no English left over, no {placeholders}),
 * live switching back to English, and the Spanish calendar file. */
import fs from 'node:fs';
import { run, open, ok, okSoon, until } from './lib.mjs';

const EXTRA = `WISE_ACRES.week = { updated: '2026-10-01', note: { en: 'Tomatoes are at their best.', es: 'Los tomates están en su mejor momento.', zh: '番茄正当季。' }, crops: { tomatoes: 'peak', pumpkins: 'starting' },
  days: [ { date: '2026-10-02', farm: 'few', pizza: 'open', note: 'Rain possible' }, { date: '2026-10-03', farm: 'full', pizza: 'full' } ] };
WISE_ACRES.signup.demo = true;`;

// English words that must not be left in a translated page. textContent, not innerText: innerText applies the page's upper-case styling,
// so lower-case English words would never be found in the countdown title and tiles.
const ENGLISH = ['Next pizza reservations open', 'days', 'hour', 'about ', 'In season', 'Peak picking', 'Spots open', 'A few spots left', 'Full', 'Email us to join the waitlist', 'Usually starts', 'Updated '];

await run('languages', async ({ browser, base, errs }) => {
  for (const lang of ['es', 'hi', 'zh', 'vi']) {
    const p = await open(browser, base, 'index.html', errs, { lang, time: '2026-10-01T12:00:00-07:00', timezoneId: 'America/Los_Angeles', extra: EXTRA });
    await until(p, () => document.querySelector('[data-rel-eyebrow]') && document.querySelector('[data-rel-eyebrow]').textContent !== '' && document.querySelectorAll('[data-week-days] tbody tr').length > 0);
    const r = await p.evaluate((words) => {
      const text = document.querySelector('#schedule').textContent + document.querySelector('#this-week').textContent + document.querySelector('.drive').textContent;
      return { leak: /\{\w+\}|undefined|NaN/.test(text), enLeft: words.filter((w) => text.includes(w)), lang: document.documentElement.lang,
        eyebrow: document.querySelector('[data-rel-eyebrow]').textContent, chip: document.querySelector('[data-rel-chip-text]').textContent };
    }, ENGLISH);
    ok(lang + ': countdown, chip, week box and drive times are translated', !r.leak && r.enLeft.length === 0, JSON.stringify({ leak: r.leak, enLeft: r.enLeft }));
    ok(lang + ': page language attribute', r.lang === (lang === 'zh' ? 'zh-Hans' : lang), r.lang);
    ok(lang + ': the chip is not the English sentence', !/pizza reservations/i.test(r.chip), r.chip);
    // switching back to English re-renders the countdown (the title now ends in "in": it continues into the countdown tiles)
    await p.evaluate(() => WISE_ACRES.setLang('en'));
    await okSoon(lang + ': switching back to English re-renders the countdown', () => p.evaluate(() => document.querySelector('[data-rel-eyebrow]').textContent), (v) => v === 'Next pizza reservations open in');
    await p.context().close();
  }

  // the calendar file in another language
  const p = await open(browser, base, 'index.html', errs, { lang: 'es', time: '2026-10-01T12:00:00-04:00' });
  await p.locator('[data-rel-remind]').scrollIntoViewIfNeeded();
  await p.click('[data-rel-remind]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-rel-ics]')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8').replace(/\r\n /g, '');
  ok('Spanish calendar file has a Spanish title', /SUMMARY:Wise Acres: abren las reservas con pizza/.test(ics));
  await p.context().close();
});
