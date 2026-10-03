/* The little people in the hero scene (tap a kid, a rider, a flower cutter, the scarecrow, the snowman): each one reacts and says something. */
import { run, open, ok, okSoon, until } from './lib.mjs';

const TAPS = [   // [season, selector of the tap target, which one of them, name]; the type is the data-npc value the tap must land on
  ['spring', '[data-npc=kid] .npc-hit', 1, 'a kid in the strawberry rows', 'kid'],
  ['spring', '.npc-hit[data-npc=rider]', 2, 'a rider on the wagon', 'rider'],
  ['spring', '.npc-hit[data-npc=barrel]', 1, 'a barrel-train kid', 'barrel'],
  ['summer', '[data-npc=cutter] .npc-hit', 0, 'the sunflower cutter', 'cutter'],
  ['fall', '[data-npc=scarecrow] .npc-hit', 0, 'the scarecrow', 'scarecrow'],
  ['winter', '.npc-hit[data-npc=snowman], [data-npc=snowman] .npc-hit', 0, 'the snowman', 'snowman'],
];

await run('npc', async ({ browser, base, errs }) => {
  const p = await open(browser, base, 'index.html', errs);
  // keep the headline text from covering the scene, hold the wagon still, and take the real kids away before tapping the barrel train
  await p.addStyleTag({ content: '.hero>:not(.hero-scene):not(.npc-say):not(.plus-one){visibility:hidden!important}.rig{animation:none!important;transform:translateX(640px)!important}' });
  let season = '';
  for (const [s, sel, nth, name, type] of TAPS) {
    if (s !== season) {
      season = s;
      await p.evaluate((x) => window.WISE_ACRES.hero.setSeason(x), s);
      await until(p, (x) => document.documentElement.dataset.season === x && document.querySelectorAll('#field [data-pick], #field [data-npc], #field .npc-hit').length > 0, s, 20000);
    }
    if (name === 'a barrel-train kid') await p.evaluate(() => document.querySelectorAll('[data-npc=kid]').forEach((e) => e.remove()));
    await until(p, ({ sel, nth }) => document.querySelectorAll(sel).length > nth, { sel, nth }, 20000);
    await until(p, () => !document.querySelector('.npc-say'), null, 20000);   // the last speech bubble is gone
    const hit = await p.evaluate(({ sel, nth, type }) => {
      const e = [...document.querySelectorAll(sel)][nth]; if (!e) return null;
      e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, top = document.elementFromPoint(x, y);
      const who = top && (top.closest('[data-npc]') || top).dataset.npc;   // neighbours may overlap a little: what matters is that a person of this kind is hit
      return { x, y, onIt: who === type, who };
    }, { sel, nth, type });
    ok(`${name}: can be tapped (the tap lands on this kind of person)`, !!hit && hit.onIt, JSON.stringify(hit));
    if (!hit) continue;
    await p.mouse.click(hit.x, hit.y);
    await okSoon(`${name}: a speech bubble with words appears`, () => p.evaluate(() => { const b = document.querySelector('.npc-say'); return b ? b.textContent.trim() : ''; }), (v) => v.length > 2, 20000);
    ok(`${name}: reacts (highlight class)`, await p.evaluate(() => !!document.querySelector('.is-hi')));
  }
  await p.context().close();
});
