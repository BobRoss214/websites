// The pages added after the first release each open from their address, show one heading and cause no console problems, at a laptop and a phone size.
// (A feature's own checks go in their own files in this folder; this one is the minimum every new page must pass.)
export default async function (h) {
  if (!h.section('19z. The newer pages open: #me, #quests, #boards, #spotlights, #make-it-real')) { return; }
  const problems0 = h.problems.length;
  for (const [name, size, mobile] of [['a laptop', { width: 1366, height: 768 }, false], ['a phone', { width: 390, height: 844 }, true]]) {
    const page = await h.newPage({ viewport: size, mobile });
    await h.openApp(page);
    const bad = [];
    for (const r of h.NEW_PAGES) {
      await h.go(page, r);
      await page.waitForTimeout(250);
      const m = await page.evaluate((route) => {
        const v = document.querySelector('#view-' + route.slice(1));
        return { shown: !!v && !v.hidden, h1: v ? v.querySelectorAll('h1').length : 0, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, title: document.title };
      }, r);
      if (!m.shown || m.h1 !== 1 || m.sideways || !/GiveSpin/.test(m.title)) { bad.push(r + ' ' + JSON.stringify(m)); }
    }
    h.check(bad.length === 0, 'on ' + name + ' each newer page opens with one heading, a GiveSpin title and no sideways scroll', bad);
    await page.close();
  }
  h.check(h.problems.length === problems0, 'section 19z: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
}
