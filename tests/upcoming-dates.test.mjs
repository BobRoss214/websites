// order: 22
// browser: no
// covers: tools/upcoming_dates.py, index.html, pages/*, js/content.js, js/season.js, docs/OWNER_YEAR_CALENDAR.md
/* tools/upcoming_dates.py: the plain-English list of what changes or runs out in the next days (no browser; needs Python 3.8 or newer, no packages).
 * It is run with pretend "today" dates (--today) on a small made-up site, so the answers do not depend on the day the test runs on, and then on the
 * real files: the first and last day of every season, the Christmas tree weekends (last Saturday of November, first Saturday of December) in several years, the exit code (1 only when something runs out
 * within 7 days), what is NOT counted (dates inside comments, a day that does not exist), --markdown for GitHub's job summary, and a wrong command.
 * Nothing is written in the site folder: the made-up site lives in a temporary folder. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const TOOL = path.join(ROOT, 'tools', 'upcoming_dates.py');
if (!fs.existsSync(TOOL)) { ok('tools/upcoming_dates.py exists', false); await finish(); process.exit(); }
if (spawnSync(PY, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)']).status !== 0) skip(`${PY} (Python 3.8 or newer) is not available`);

const run = (args, root) => {
  const r = spawnSync(PY, [TOOL, ...(root ? ['--root', root] : []), ...args], { encoding: 'utf8', timeout: 60000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
// the part of the text under a heading, up to the next heading or the result line
const section = (text, heading) => { const i = text.indexOf(heading); if (i < 0) return ''; const rest = text.slice(i + heading.length); const m = /\n(Also coming up|Already past|Dates the check|Result:|Needs you)/.exec(rest); return m ? rest.slice(0, m.index) : rest; };

/* ---- a made-up site ---- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-upcoming-'));
const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); };
w('index.html', `<!doctype html><html><body>
<!-- an example for the owner: <li data-until="2026-10-03">this one is only in a comment</li> and data-release="2026-10-04" -->
<ul>
  <li data-until="2026-10-15"><strong>Special Day</strong> Thursday, Oct 15.</li>
  <li data-until="2026-09-20">An old line that is long past.</li>
  <li data-until="2026-11-31">A day that does not exist.</li>
</ul>
<table><tbody>
  <tr data-release="2026-10-06" data-until="2026-10-11"><td>Oct 6</td><td>Oct 9&ndash;11</td></tr>
  <tr data-release="2026-10-13" data-until="2026-10-18"><td>Oct 13</td><td>Oct 16&ndash;18</td></tr>
  <tr data-release="2026-10-20" data-until="2026-10-25"><td>Oct 20</td><td>Oct 23&ndash;25</td></tr>
</tbody></table>
<p data-until="2026-10-04"><br>Open now <svg><use href="#x"/></svg> until Sunday.</p>
</body></html>`);
w('pages/extra.html', '<p data-until="2026-10-05">A line on an extra page.</p>');
w('js/content.js', `/* the owner's notes, with examples that must not count:
 *   closures: ['2030-01-01'],   noticeUntil: '2030-01-02',   week: { updated: '2030-01-03', note: 'x' }
 */
window.WISE_ACRES = {
  seasonPicker: false,
  notice: "We're closed Saturday for rain.",   // it's a quote: https://example.com/ is not a comment start inside the quote marks
  noticeUntil: '2026-10-05',
  closures: ['2026-10-09', '2026-10-20..2026-10-22', '2026-11-31', '2026-12-24..2026-12-26'],
  hours: { greenhouse: { days: [5, 6, 0], open: '10:00', close: '20:00' } },
  week: { updated: '2026-09-28', note: 'Tomatoes are ripe!', crops: { tomatoes: 'peak' }, days: [ { date: '2026-10-03', farm: 'few', pizza: 'open' } ] },
  signup: { action: '', interests: {}, tags: '' },
};`);
fs.mkdirSync(path.join(tmp, 'js'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'js', 'season.js'), path.join(tmp, 'js', 'season.js'));

try {
  /* ---- the made-up site, Friday 2 October 2026 ---- */
  let r = run(['--today', '2026-10-02'], tmp);
  ok('made-up site, 2 Oct: runs and starts with the heading and today\'s date in words', /^Things that change or expire on the website in the next 14 days\nToday is Friday, Oct 2, 2026/.test(r.out), r.out.slice(0, 120));
  ok('exit code 1 (the notice bar, the line of 4 Oct and the extra-page line run out within 7 days)', r.code === 1, 'exit code ' + r.code);
  const red = section(r.out, 'Needs you: something runs out within 7 days');
  ok('"Needs you" lists the line that ends 4 Oct, the extra page line (5 Oct) and the notice bar (5 Oct), with where to find each', /Sunday, Oct 4 \(in 2 days\)[^\n]*Last day of the line "Open now until Sunday\."/.test(red) && /Monday, Oct 5 \(in 3 days\)[^\n]*A line on an extra page/.test(red) && /yellow notice bar \("We're closed Saturday for rain\."\)/.test(red) && /pages\/extra\.html at data-until="2026-10-05"/.test(red) && /js\/content\.js at noticeUntil: 2026-10-05/.test(red), red.slice(0, 600));
  ok('a line inside an HTML comment is not counted (data-until 2026-10-03 and the example data-release)', !/this one is only in a comment/.test(r.out) && !/Oct 3\b.*Last day/.test(r.out), '');
  ok('the special day (15 Oct) is under "Also coming up", not red (it is 13 days away)', /Thursday, Oct 15 \(in 13 days\)[^\n]*Special Day/.test(section(r.out, 'Also coming up')) && !/Special Day/.test(red));
  const more = section(r.out, 'Also coming up');
  ok('the "This week" box: last day is 12 Oct (updated 28 Sep + 14 days), listed with what to do', /Monday, Oct 12 \(in 10 days\)[^\n]*"This week at the farm" box \(it was updated Sep 28, 2026 and stays 14 days\)/.test(more), more.slice(0, 300));
  ok('a closed day is listed as a change (it never makes the check fail)', /Friday, Oct 9 \(in 7 days\)[^\n]*CLOSED on Friday, Oct 9/.test(more) && !/CLOSED/.test(red), '');
  ok('pizza weekends: 16-18 Oct opens on 13 Oct; 9-11 Oct drops off after 11 Oct; the LAST row (23-25 Oct) is not listed yet (it ends 23 days away)', /Tuesday, Oct 13[^\n]*Reservations for the pizza weekend Oct 16.18 open/.test(more) && /Sunday, Oct 11[^\n]*pizza weekend Oct 9.11 in the schedule table/.test(more) && !/LAST one/.test(r.out), more.slice(0, 500));
  ok('a closure range 20-22 Oct is outside the 14 days, the one in December too', !/Oct 20|Dec 24/.test(r.out.split('Already past')[0]), '');
  ok('a day that does not exist (2026-11-31, in closures and in data-until) is reported, not listed, and does not crash', /closures "2026-11-31" is not a day/.test(r.out) && /data-until="2026-11-31" is not a real day/.test(r.out), r.out.slice(-500));
  ok('a line already past (20 Sep) is listed as "Already past and still in the files", not as coming up', /Already past[\s\S]*Sep 20, 2026[^\n]*An old line that is long past/.test(r.out) && !/Needs you[\s\S]*An old line/.test(r.out.split('Already past')[0]), '');
  ok('the result line says how many things run out', /Result: 3 things run out within 7 days\. This check stays red/.test(r.out), r.out.split('\n').slice(-2).join(' | '));

  /* ---- exit codes and options ---- */
  r = run(['--today', '2026-10-02', '--fail-on', 'runs-out'], tmp);
  ok('--fail-on runs-out: the same day gives exit code 0 (only lines that hide themselves run out; the week box ends in 10 days)', r.code === 0 && /Result: nothing runs out within 7 days\./.test(r.out), 'exit code ' + r.code);
  r = run(['--today', '2026-10-06', '--fail-on', 'runs-out'], tmp);
  ok('--fail-on runs-out on 6 Oct: the week box ends 12 Oct, 6 days away: exit code 1 and it is under "Needs you"', r.code === 1 && /Monday, Oct 12 \(in 6 days\)[^\n]*This week at the farm/.test(section(r.out, 'Needs you: something runs out within 7 days')), 'exit code ' + r.code);
  r = run(['--today', '2026-10-02', '--fail-within', '1'], tmp);
  ok('--fail-within 1: nothing runs out by tomorrow, exit code 0, and the same things are now "Also coming up"', r.code === 0 && /Sunday, Oct 4 \(in 2 days\)/.test(section(r.out, 'Also coming up')), 'exit code ' + r.code);
  r = run(['--today', '2026-10-02', '--days', '3'], tmp);
  ok('--days 3: only the next 3 days are listed (the 4 Oct line yes, the 15 Oct day no)', /Sunday, Oct 4/.test(r.out) && !/Special Day/.test(r.out), '');
  r = run(['--today', '2026-10-02', '--markdown'], tmp);
  ok('--markdown: headings with ###, bullets with - and bold dates (for the job summary)', /^## Things that change/.test(r.out) && /\n### Needs you/.test(r.out) && /\n- \*\*Sunday, Oct 4 \(in 2 days\)\*\*: /.test(r.out) && /\*\*Result:\*\*/.test(r.out), r.out.slice(0, 300));
  r = run(['--today', '2026-12-20'], tmp);
  ok('26 days later (20 Dec): the closure 24-26 Dec is listed as a range, nothing runs out, exit code 0', r.code === 0 && /Thursday, Dec 24 \(in 4 days\)[^\n]*CLOSED from Thursday, Dec 24 to Saturday, Dec 26/.test(r.out), r.out.slice(0, 500));

  /* ---- the seasons, read from js/season.js ---- */
  r = run(['--today', '2026-09-01'], tmp);
  ok('1 Sep: the fall season starts on 13 Sep (in 12 days), a change, not red', r.code === 0 && /Sunday, Sep 13 \(in 12 days\)[^\n]*The fall season starts/.test(r.out), r.out.slice(0, 300));
  r = run(['--today', '2026-11-02'], tmp);
  ok('2 Nov: the last day of fall is 8 Nov, "the day after the home page shows the season that starts next" (the builder, 10 Nov 2026), not the one that is closest', /Sunday, Nov 8 \(in 6 days\)[^\n]*Last day of the fall season\. The day after, the home page shows the season that starts next\./.test(r.out) && !/closest/.test(r.out), r.out.slice(0, 300));
  // The Christmas tree weekends, written out independently here (a walk over the calendar, not the formula of js/season.js or of the tool): the LAST Saturday of
  // November and the Sunday after it, the FIRST Saturday of December and the Sunday after it (the builder, 10 Nov 2026). Winter runs from the first Saturday to the last Sunday.
  const treeDays = (y) => {
    const sats = (m) => { const out = []; for (let d = new Date(Date.UTC(y, m, 1)); d.getUTCMonth() === m; d = new Date(d.getTime() + 864e5)) if (d.getUTCDay() === 6) out.push(d); return out; };
    const nov = sats(10), dec = sats(11), plus1 = (d) => new Date(d.getTime() + 864e5);
    return { a: nov[nov.length - 1], aSun: plus1(nov[nov.length - 1]), b: dec[0], bSun: plus1(dec[0]) };
  };
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOWNAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const said = (d) => `${DOWNAME[d.getUTCDay()]}, ${MON3[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const iso10 = (d) => d.toISOString().slice(0, 10), minus = (d, n) => new Date(d.getTime() - n * 864e5);
  const bad = [], badEnd = [], shape = [];
  for (const y of [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]) {
    const t = treeDays(y);
    const out = run(['--today', iso10(minus(t.a, 3))], tmp).out;
    if (!out.includes(`${said(t.a)} (in 3 days): The winter season starts`)) bad.push(y + ': ' + said(t.a));
    const endOut = run(['--today', iso10(minus(t.bSun, 2))], tmp).out;
    if (!endOut.includes(`${said(t.bSun)} (in 2 days): Last day of the winter season`)) badEnd.push(y + ': ' + said(t.bSun));
    const gap = (t.b - t.a) / 864e5;
    if (t.a.getUTCDay() !== 6 || t.b.getUTCDay() !== 6 || t.aSun.getUTCDay() !== 0 || t.bSun.getUTCDay() !== 0 || gap !== 7 || t.a.getUTCMonth() !== 10 || t.a.getUTCDate() < 24) shape.push(y);
  }
  ok('the winter season starts on the first tree day, the LAST Saturday of November, in 2026 to 2033 (2026: Sat Nov 28; 2027: Sat Nov 27; 2028: Sat Nov 25; 2029: Sat Nov 24; 2030: Sat Nov 30)', bad.length === 0, bad.join('; '));
  ok('the winter season ends on the last tree day, the Sunday after the FIRST Saturday of December, in 2026 to 2033 (2026: Sun Dec 6; 2027: Sun Dec 5; 2028: Sun Dec 3; 2029: Sun Dec 2; 2030: Sun Dec 8)', badEnd.length === 0, badEnd.join('; '));
  ok('the two weekends are one week apart every year (the next Saturday after the last one in November is the first one in December), Saturday and Sunday, never a Friday', shape.length === 0, shape.join(', '));
  {
    const explicit = { 2026: ['Saturday, Nov 28', 'Sunday, Dec 6'], 2027: ['Saturday, Nov 27', 'Sunday, Dec 5'], 2028: ['Saturday, Nov 25', 'Sunday, Dec 3'], 2029: ['Saturday, Nov 24', 'Sunday, Dec 2'], 2030: ['Saturday, Nov 30', 'Sunday, Dec 8'] };
    const wrongYears = Object.entries(explicit).filter(([y, [a, b]]) => { const t = treeDays(+y); return said(t.a) !== a || said(t.bSun) !== b; }).map(([y]) => y);
    ok('the dates the builder named (Nov 28-29 and Dec 5-6 in 2026, Nov 27-28 and Dec 4-5 in 2027, Nov 24-25 and Dec 1-2 in 2029, Nov 30-Dec 1 and Dec 7-8 in 2030) are what the calendar gives', wrongYears.length === 0, wrongYears.join(', '));
  }
  {   // the day before the window and the day after it: nothing about winter that day, and a Friday is no tree day
    const fri = run(['--today', '2026-11-27', '--days', '2'], tmp).out, sat = run(['--today', '2026-11-28', '--days', '1'], tmp).out;
    ok('Fri Nov 27, 2026 (the day before the first tree day) is not a day the winter season starts; Sat Nov 28 is', !/Friday, Nov 27[^\n]*winter season starts/.test(fri) && /Saturday, Nov 28 \(tomorrow\)[^\n]*The winter season starts/.test(fri) && /Saturday, Nov 28 \(today\)[^\n]*The winter season starts/.test(sat), fri.slice(0, 300));
    ok('the tool names no Thanksgiving rule any more (the tree weekends are worked out from the calendar)', !/thanksgiving/i.test(fs.readFileSync(path.join(ROOT, 'tools/upcoming_dates.py'), 'utf8')), '');   // winter-scan: allow
  }
  const ex = spawnSync(PY, ['-c', `import sys, datetime as dt; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'tools'))}); import upcoming_dates as u
f = lambda y, m, d, h, mi: str(u.eastern_today(dt.datetime(y, m, d, h, mi)))
print(f(2026, 7, 1, 3, 30), f(2026, 12, 1, 4, 30), f(2026, 3, 8, 4, 30), f(2026, 3, 9, 4, 30), f(2026, 11, 1, 4, 30), f(2026, 11, 2, 4, 30))`], { encoding: 'utf8' });
  ok('"today" is the farm\'s day (New York), with daylight saving: 03:30 UTC on 1 Jul is still 30 Jun; 04:30 UTC on 1 Dec is still 30 Nov; the days the clocks change (8 Mar, 1 Nov) are right', ex.stdout.trim() === '2026-06-30 2026-11-30 2026-03-07 2026-03-09 2026-11-01 2026-11-01', (ex.stdout + ex.stderr).trim());

  /* ---- the year calendar document, when it exists ---- */
  w('docs/OWNER_YEAR_CALENDAR.md', '# Year calendar\n\n| Date | What |\n|---|---|\n| 2026-10-08 | Fall festival: put up the banner |\n| 2026-02-30 | not a day |\n\n- Nov 12, 2026: send the tax papers\n- 15 Oct 2026 pumpkin delivery\n- no date on this line\n');
  r = run(['--today', '2026-10-02'], tmp);
  ok('docs/OWNER_YEAR_CALENDAR.md (if it exists): dated lines are listed in their own words (2026-10-08, 15 Oct 2026), not the ones with no date or a day that does not exist', /Thursday, Oct 8 \(in 6 days\): Fall festival: put up the banner/.test(r.out) && /Thursday, Oct 15 \(in 13 days\): [^\n]*pumpkin delivery/.test(r.out) && !/no date on this line/.test(r.out) && !/days\): not a day/.test(r.out), r.out.slice(0, 600));
  ok('...and a dated line there never makes the check fail (it exits as before: 1, because of the lines above)', r.code === 1, 'exit code ' + r.code);
  // the examples the owner copies keep their dates: a date inside quote marks is part of the example, a date written alone (a table's date column) is not repeated
  w('docs/OWNER_YEAR_CALENDAR.md', [
    '| Date | What |', '|---|---|', '| 2026-10-08 | Fall festival: put up the banner |',
    "- **Close the day.** Add the date to `closures` in `js/content.js` (`'2026-10-09'` for one day, `'2026-10-20..2026-10-22'` for a run).",
    '| `data-until="2026-10-15"` | the "Special Day" line | Thu Oct 15, 2026 |',
    '- **By itself:** rows with `data-release="2026-10-06"`, `data-release="2026-10-13"` and `data-release="2026-10-20"`, opening at 5:00 PM (`data-release-time="17:00"`).', ''].join('\n'));
  for (const extra of [[], ['--markdown']]) {
    r = run(['--today', '2026-10-02', ...extra], tmp);
    const how = extra.join(' ') || 'text';
    ok(`year calendar (${how}): a "closures" example keeps its two dates ('2026-10-09' for one day, '2026-10-20..2026-10-22' for a run), not '' and '..'`, /Friday, Oct 9 \(in 7 days\)[^\n]*Add the date to closures in js\/content\.js \('2026-10-09' for one day, '2026-10-20\.\.2026-10-22' for a run\)\./.test(r.out), r.out.slice(0, 700));
    ok(`year calendar (${how}): data-until and data-release examples keep their dates, with no space before the comma`, /Thursday, Oct 15 \(in 13 days\)[^\n]*data-until="2026-10-15" the "Special Day" line/.test(r.out) && /Tuesday, Oct 6 \(in 4 days\)[^\n]*rows with data-release="2026-10-06", data-release="2026-10-13" and data-release="2026-10-20", opening at 5:00 PM \(data-release-time="17:00"\)\./.test(r.out), r.out.slice(0, 700));
    ok(`year calendar (${how}): the date column of a table row is still not repeated, and no example is left empty`, /Thursday, Oct 8 \(in 6 days\)[^\n]*Fall festival: put up the banner/.test(r.out) && !/2026-10-08[^\n]*Fall festival/.test(r.out) && !/data-\w+=""|\[''\]|'' for one day/.test(r.out), r.out.slice(0, 700));
  }
  fs.rmSync(path.join(tmp, 'docs'), { recursive: true });
  r = run(['--today', '2026-10-02'], tmp);
  ok('without that document nothing is missing and nothing is said about it', r.code === 1 && !/OWNER_YEAR_CALENDAR/.test(r.out), '');

  /* ---- a wrong command ---- */
  const wrong = [['--today', '2026-02-30'], ['--today', 'tomorrow'], ['--fail-on', 'everything'], ['--days', '0']];
  for (const a of wrong) { r = run(a, tmp); ok(`wrong command ${a.join(' ')}: exit code 2 and a plain sentence, no Python error`, r.code === 2 && !/Traceback/.test(r.out) && r.out.trim().length > 10, r.code + ' ' + r.out.trim().split('\n')[0]); }
  r = run(['--today', '2026-10-02'], path.join(tmp, 'js'));
  ok('a folder that is not the site (no index.html): exit code 2 and a sentence', r.code === 2 && /does not look like the site folder/.test(r.out), r.out.trim());

  /* ---- the real site files ---- */
  r = run(['--today', '2026-10-02']);
  ok('the real site, 2 Oct 2026: runs, exit code 0 or 1, starts with the heading, no Python error', (r.code === 0 || r.code === 1) && /^Things that change or expire/.test(r.out) && !/Traceback/.test(r.out), r.out.slice(0, 200));
  r = run(['--today', '2026-11-20']);
  ok('the real site, 20 Nov 2026: the winter season starts on Saturday, Nov 28 (the first tree day), in 8 days', /Saturday, Nov 28 \(in 8 days\)[^\n]*The winter season starts/.test(r.out), r.out.slice(0, 300));
  for (const args of [['--today', '2026-10-02', '--days', '450'], ['--today', '2026-11-20', '--days', '450', '--markdown'], ['--days', '450']]) {
    r = run(args);
    ok(`the real site (${args.join(' ')}): no example from the owner's notes is left empty (data-until="", data-release="", closures: [''], '' for one day)`, !/data-\w+=""|\[''\]|'' for one day|\( '' |'\.\.'/.test(r.out) && !/Traceback/.test(r.out), (r.out.match(/[^\n]*(data-\w+=""|\[''\]|'' for one day)[^\n]*/) || [''])[0].slice(0, 300));
  }
  r = run(['--today', '2026-10-02', '--days', '450']);
  ok('the real site: the owner\'s notes\' own examples show real dates (data-until="2026-..", a closures line with \'2026-..\')', /data-until="20\d\d-\d\d-\d\d"/.test(r.out) && /closures[^\n]*'20\d\d-\d\d-\d\d'/.test(r.out), r.out.slice(0, 300));
  r = run([]);
  ok('without --today it uses today in New York and still works', (r.code === 0 || r.code === 1) && /Today is \w+day, \w{3} \d+, 20\d\d \(farm time, Eastern\)/.test(r.out), r.out.slice(0, 160));
  const before = fs.readFileSync(path.join(ROOT, 'index.html'));
  run(['--today', '2026-10-02']);
  ok('the site files are not changed', Buffer.compare(before, fs.readFileSync(path.join(ROOT, 'index.html'))) === 0);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
await finish({});
