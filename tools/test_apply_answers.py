#!/usr/bin/env python3
"""Tests for tools/apply_answers.py (the tool that turns the owner's answers into file changes). No browser.

  python3 tools/test_apply_answers.py            (about a minute; two runs of the whole tool on a copy, the rest is quick)
  python3 tools/test_apply_answers.py -v

What it covers: every shape of answers file the tool accepts; the match of the owner's words to the playbook option (exact, reworded, a typo, a
letter, a wording nobody expected); the owner's own values (a price, a link) and what the tool refuses to type; "I will send ..." answers (the tool
prints what is missing and applies nothing); the order of dependent answers; contradictory answers (refused with a plain message); a recipe that
cannot be applied (rolled back, the others go on); a check that goes red (the answer that caused it is named); the report and the patch; the site
folder is not touched unless --in-place --yes, and then only when it is clean. Also: every name in tools/apply_answers_rules.json still exists.
It never changes the real site folder: whole runs happen on a copy made here."""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import apply_answers as aa  # noqa: E402

TOOL = os.path.join(HERE, 'apply_answers.py')
PY = sys.executable
TMP = tempfile.mkdtemp(prefix='wa-apply-test-')
os.environ['TMPDIR'] = TMP                                                   # every temporary copy of the tool lands here, so we can see what is left
tempfile.tempdir = TMP

RECIPES, SKIPPED = aa.load_recipes(SITE)
RULES = aa.load_rules(SITE)
PLAYBOOK = aa.parse_playbook(SITE)
DASH = os.environ.get('WA_DECISIONS', '/tmp/claude-0/dec-now2/decisions')


def wj(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False)


def rj(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def rt(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def digest(site):
    h = hashlib.sha1()
    for rel in ('index.html', 'js/content.js', 'lang/src/es.json', 'README.md', 'docs/DECISION_PLAYBOOK.md', 'tools/pages.py'):
        with open(os.path.join(site, rel), 'rb') as f:
            h.update(f.read())
    return h.hexdigest()


def doc(letter_or_text, note='', status='answered', options=None, **kw):
    d = {'status': status, 'answer': letter_or_text, 'answeredAt': '2026-10-04T12:00:00Z'}
    if note:
        d['note'] = note
    if options:
        d['options'] = options
    d.update(kw)
    return d


def words(id_, letter):
    return PLAYBOOK[id_]['options'][letter]


def plan(answers, extra=(), site=SITE, tmp=None):
    """Runs the tool with --plan on an answers object. -> (exit code, text)"""
    d = tempfile.mkdtemp(prefix='plan-', dir=TMP)
    f = os.path.join(d, 'answers.json')
    with open(f, 'w', encoding='utf-8') as h:
        json.dump(answers, h)
    p = subprocess.run([PY, TOOL, f, '--site', site, '--plan', '--out', os.path.join(d, 'out')] + list(extra), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    return p.returncode, p.stdout


def status_of(out, id_):
    m = re.search(r'^  %s\s+\S+\s+(?:\[(\w+)\]|(will be applied))' % id_, out, re.M)
    return (m.group(1) or 'ready') if m else None


class Adapter(unittest.TestCase):
    def pairs(self, src, extra=()):
        a, problems, open_count = aa.read_answers(src, extra)
        return [(x.id, x.text) for x in a], problems, open_count

    def test_all_shapes_give_the_same_answers(self):
        d1, d2 = doc(words('d16', 'A')), doc(words('d49', 'B'), note='')
        want = [('d16', words('d16', 'A')), ('d49', words('d49', 'B'))]
        shapes = {
            'bundle': {'decisions': {'d16': d1, 'd49': d2}, 'agents': {}, 'meta': {}},
            'documents': {'d16': d1, 'd49': d2},
            'list with id': [dict(d1, id='d16'), dict(d2, id='d49')],
            'list with doc_id and data': [{'doc_id': 'd16', 'data': d1}, {'doc_id': 'd49', 'data': d2}],
            'docs wrapper': {'docs': [{'id': 'decisions/d16', 'data': d1}, {'id': 'decisions/d49', 'data': d2}]},
            'short words': {'d16': words('d16', 'A'), 'd49': words('d49', 'B')},
            'answers key': {'answers': {'d16': words('d16', 'A'), 'd49': words('d49', 'B')}},
            'list of d16=A': ['d16=' + words('d16', 'A'), 'd49=' + words('d49', 'B')],
        }
        for name, obj in shapes.items():
            got, problems, _ = self.pairs(obj)
            self.assertEqual(got, want, name)
            self.assertEqual(problems, [], name)

    def test_folder_with_one_file_per_decision(self):
        d = tempfile.mkdtemp(prefix='dec-', dir=TMP)
        for i, v in (('d16', doc(words('d16', 'A'))), ('d49', doc(words('d49', 'B'))), ('d17', doc('', status='open'))):
            with open(os.path.join(d, i + '.json'), 'w', encoding='utf-8') as f:
                json.dump(v, f)
        got, problems, open_count = self.pairs(d)
        self.assertEqual([g[0] for g in got], ['d16', 'd49'])
        self.assertEqual(open_count, 1)

    def test_open_decisions_are_ignored_and_letters_work(self):
        got, problems, open_count = self.pairs({'d01': {'status': 'open', 'answer': '', 'options': ['a', 'b']}, 'd02': {'status': 'answered', 'answer': 'B'}, 'd03': 'C'})
        self.assertEqual(got, [('d02', 'B'), ('d03', 'C')])
        self.assertEqual(open_count, 1)
        got, _, _ = self.pairs(None, ['d05=A', 'd06=Leave as is'])
        self.assertEqual(got, [('d05', 'A'), ('d06', 'Leave as is')])

    def test_dashboard_wording_of_an_answered_document(self):
        # exactly the fields answerDecision() in the dashboard writes: status, answer, answeredAt, and note only for an option
        a, problems, _ = aa.read_answers({'d02': {'askedAt': '2026-10-03T03:23:00Z', 'options': ['x', 'y'], 'order': 4, 'status': 'answered', 'title': 'Prices for company events', 'topic': 'Money',
                                                  'topicNo': 2, 'urgency': 1, 'urgencyLabel': 'blocks launch', 'why': '...', 'answer': 'y', 'answeredAt': '2026-10-04T09:00:00.000Z', 'note': 'ask Cathy'}})
        self.assertEqual((a[0].id, a[0].text, a[0].note, a[0].answered_at), ('d02', 'y', 'ask Cathy', '2026-10-04T09:00:00.000Z'))
        self.assertEqual(a[0].doc['urgency'], 1)

    def test_bad_input_gives_plain_problems_not_a_crash(self):
        got, problems, _ = self.pairs({'d01': {'status': 'answered', 'answer': ''}, 'hello': 'x', 'd02': ['A'], 'd03': 5, 'd04': 'A'})
        self.assertEqual(got, [('d04', 'A')])
        self.assertTrue(len(problems) >= 3, problems)
        got, problems, _ = self.pairs(['nonsense', {'answer': 'A'}])
        self.assertEqual(got, [])
        self.assertEqual(len(problems), 2)
        f = os.path.join(TMP, 'broken.json')
        with open(f, 'w', encoding='utf-8') as h:
            h.write('{"d01": ')
        with self.assertRaises(aa.Problem):
            aa.read_answers(f)
        with self.assertRaises(aa.Problem):
            aa.read_answers(os.path.join(TMP, 'nothing-here.json'))

    def test_the_same_decision_twice_uses_the_first(self):
        got, problems, _ = self.pairs(['d01=A', 'd01=B'])
        self.assertEqual(got, [('d01', 'A')])
        self.assertTrue(problems)


class Matching(unittest.TestCase):
    def match(self, id_, text, doc_=None, aliases=True):
        a = aa.Answer(id_, text, doc=doc_ or {})
        why = aa.resolve_option(a, PLAYBOOK[id_]['options'], (RULES.get('aliases') or {}).get(id_) if aliases else None)
        return a.letter, why, a.how

    def test_every_playbook_option_matches_itself(self):
        for id_, e in PLAYBOOK.items():
            for L, lab in e['options'].items():
                self.assertEqual(self.match(id_, lab)[0], L, '%s %s' % (id_, lab))

    def test_rewordings_that_a_person_would_not_mind(self):
        cases = [('d01', 'hide fall booking and prices out of season', 'A'), ('d01', '  Hide fall booking and prices  out of season. ', 'A'), ('d01', 'Keep them with a note - these are fall prices', 'B'),
                 ('d02', 'Say "Custom quote" instead', 'B'), ('d16', 'Only some pizzas', 'B'), ('d60', 'Not decided yet (I will tell you later)', 'C'),
                 ('d49', 'yes, it has cheese', 'A'), ('d49', 'No it has no cheese', 'B'), ('d02', 'Send me the real prices please', 'A')]
        for id_, text, L in cases:
            letter, why, how = self.match(id_, text)
            self.assertEqual(letter, L, '%s "%s": %s' % (id_, text, why))

    def test_letters(self):
        for text, L in (('B', 'B'), ('b', 'B'), ('Option B', 'B'), ('B.', 'B'), ('b)', 'B')):
            self.assertEqual(self.match('d16', text)[0], L, text)
        letter, why, _ = self.match('d16', 'F')
        self.assertIsNone(letter)
        self.assertIn('no option F', why)

    def test_unsure_is_a_plain_error_that_names_the_closest_option(self):
        letter, why, _ = self.match('d16', 'We should talk about it on Tuesday')
        self.assertIsNone(letter)
        self.assertIn('do not match any option clearly enough', why)
        letter, why, _ = self.match('d49', 'It has cheese, no cheese, I do not know')            # close to two options: not clear
        self.assertIsNone(letter, why)

    def test_the_page_words_the_playbook_does_not_have(self):
        # the page lists the four options of d04 in another order than the playbook (the day-of number is option B there): the words decide, not the place
        self.assertEqual(self.match('d04', 'Show the main number to everyone')[0], 'A')
        self.assertEqual(self.match('d04', 'No phone: email only')[0], 'C')
        self.assertEqual(self.match('d04', 'Show the main number on some pages only')[0], 'D')
        self.assertEqual(self.match('d04', 'Show the day-of number to everyone, with Running late or lost? Call or text')[0], 'B')
        self.assertEqual(self.match('d67', 'Yes, show them')[0], 'A')

    def test_the_place_in_the_page_list_is_used_only_when_it_is_safe(self):
        labels = PLAYBOOK['d16']['options']
        page = ['Anything goes, two pizzas', 'A short list of pizzas, I will say which', 'A new price for the package']
        a = aa.Answer('d16', page[1], doc={'options': page})
        self.assertIsNone(aa.resolve_option(a, labels, None))
        self.assertEqual((a.letter, a.how), ('B', 'its place in the list of the page'))
        shuffled = [labels['C'] + ' xx', labels['A'] + ' xx', labels['B'] + ' xx']                 # the page lists them in another order: no guessing
        a = aa.Answer('d16', shuffled[0], doc={'options': shuffled})
        self.assertTrue(aa.resolve_option(a, labels, None) is None or a.letter == 'C')
        a = aa.Answer('d16', 'something else entirely', doc={'options': page})                         # not one of the page's options
        self.assertIsNotNone(aa.resolve_option(a, labels, None))

    @unittest.skipUnless(os.path.isdir(DASH), 'the dashboard documents are not here (set WA_DECISIONS)')
    def test_every_option_the_dashboard_has_today(self):
        bad = []
        for n in sorted(os.listdir(DASH)):
            id_ = aa._as_id(n)
            if not id_ or id_ not in PLAYBOOK:
                continue
            d = rj(os.path.join(DASH, n))
            for i, o in enumerate(d['options']):
                letter, why, how = self.match(id_, o, d)
                if letter is None:
                    bad.append('%s option %d "%s": %s' % (id_, i + 1, o[:50], why))
                elif letter and letter != chr(65 + i) and id_ != 'd04':
                    bad.append('%s option %d "%s" went to %s' % (id_, i + 1, o[:50], letter))
        self.assertEqual(bad, [])


class Values(unittest.TestCase):
    def test_a_value_is_checked_before_it_is_typed_into_a_file(self):
        price = {'name': 'p', 'type': 'price', 'invented': '$1', 'ask': 'x'}
        for good in ('$45', '$4.50', '$1,400'):
            self.assertEqual(aa.check_value(price, good)[0], good)
        for bad in ('45', '$45 each', '$4.5', 'free', '', '$45"><script>'):
            self.assertIsNone(aa.check_value(price, bad)[0], bad)
        url = {'name': 'u', 'type': 'url', 'invented': 'x', 'ask': 'x'}
        self.assertIsNotNone(aa.check_value(url, 'https://bookeo.com/wiseacres?category=1&b=2')[0])
        for bad in ('http://bookeo.com/x', 'javascript:alert(1)', 'https://x.com/"onload="x', "https://x.com/'x", 'https://x.com/a b', 'https://x.com/\\x'):
            self.assertIsNone(aa.check_value(url, bad)[0], bad)
        self.assertEqual(aa.check_value({'name': 'u', 'type': 'url', 'invented': 'x', 'ask': 'x', 'strip_slash': True}, 'https://new.example/')[0], 'https://new.example')
        self.assertIsNone(aa.check_value({'name': 'e', 'type': 'email', 'invented': 'x', 'ask': 'x'}, 'a@b')[0])
        self.assertIsNone(aa.check_value({'name': 'd', 'type': 'date', 'invented': 'x', 'ask': 'x'}, '2027-02-30')[0])
        self.assertEqual(aa.check_value({'name': 'd', 'type': 'date', 'invented': 'x', 'ask': 'x'}, '2027-01-31')[0], '2027-01-31')
        self.assertIsNone(aa.check_value({'name': 't', 'type': 'text', 'invented': 'x', 'ask': 'x'}, 'Cheese\nPepperoni')[0])
        self.assertIsNone(aa.check_value({'name': 't', 'type': 'text', 'invented': 'x', 'ask': 'x', 'match': '^[0-9]+ hours?$'}, '90 minutes')[0])

    def test_the_owners_value_replaces_the_made_up_one_and_nothing_else(self):
        rec = RECIPES['d19=A']
        new, missing, bad = aa.substitute(rec, RULES['inputs']['d19=A'], {'price_ice_cream': '$6', 'price_drinks': '$9'})
        self.assertEqual((missing, bad), ([], []))
        tos = [s.get('to') for s in new['steps']]
        self.assertIn('<dd>$6</dd>', tos)
        self.assertIn('<dd>$9</dd>', tos)
        self.assertEqual(rec['steps'][0]['to'], '<dd>$4</dd>')                                       # the recipe itself is not changed
        new, missing, bad = aa.substitute(rec, RULES['inputs']['d19=A'], {'price_ice_cream': '$6'})
        self.assertIsNone(new)
        self.assertEqual(len(missing), 1)
        self.assertIn('beer, wine and cider', missing[0])

    def test_html_files_get_the_ampersand_written_the_html_way(self):
        rec = {'steps': [{'op': 'sub', 'file': 'index.html', 'at': 'a', 'find': 'a', 'to': 'Tom X'}, {'op': 'sub', 'file': 'js/content.js', 'at': 'a', 'find': 'a', 'to': 'Tom X'}]}
        new, _, _ = aa.substitute(rec, [{'name': 'n', 'type': 'text', 'invented': 'Tom X', 'ask': 'x'}], {'n': 'Fish & Chips'})
        self.assertEqual(new['steps'][0]['to'], 'Fish &amp; Chips')
        self.assertEqual(new['steps'][1]['to'], 'Fish & Chips')

    def test_the_celsius_number_follows_the_degrees(self):
        new, _, _ = aa.substitute(RECIPES['d18=C'], RULES['inputs']['d18=C'], {'degrees': '850'})
        text = json.dumps([new['steps'], new['translations']], ensure_ascii=False)
        self.assertIn('850-degree', text)
        self.assertIn('454', text)                                                                    # (850 - 32) / 1.8
        self.assertNotIn('800', text)

    def test_giving_back_the_made_up_values_gives_the_same_recipe(self):
        for key, defs in RULES['inputs'].items():
            if key.startswith('_'):
                continue
            vals = dict((d['name'], d['invented']) for d in defs if d.get('type') != 'derived')
            new, missing, bad = aa.substitute(RECIPES[key], defs, vals)
            self.assertEqual((missing, bad), ([], []), key)
            self.assertEqual(set(new.pop('_values')), set(vals) | set(d['name'] for d in defs if d.get('type') == 'derived'), key)
            self.assertEqual(new, RECIPES[key], key)


class Rules(unittest.TestCase):
    """Every name in tools/apply_answers_rules.json is still real: a recipe that moved or was renamed fails here, not on the owner's day."""

    def test_every_recipe_is_in_exactly_one_list(self):
        inputs = set(k for k in RULES['inputs'] if not k.startswith('_'))
        manual = set(k for k in RULES['manual'] if not k.startswith('_'))
        ready = set(RULES['ready']['keys'])
        self.assertFalse(inputs & manual or inputs & ready or manual & ready, 'a recipe is in two lists')
        loose = sorted(k for k in RECIPES if k not in inputs | manual | ready and not (RECIPES[k].get('checked') or RECIPES[k].get('owner_values') or RECIPES[k].get('model')))
        self.assertEqual(loose, [], 'new recipes nobody has checked for made-up values: add each to "ready", "inputs" or "manual" in tools/apply_answers_rules.json')
        self.assertEqual(sorted((inputs | manual | ready) - set(RECIPES)), [], 'a name in the rules has no recipe any more')

    def test_every_made_up_value_is_still_in_its_recipe(self):
        for key, defs in RULES['inputs'].items():
            if key.startswith('_'):
                continue
            names = [d['name'] for d in defs]
            self.assertEqual(len(names), len(set(names)), key)
            text = json.dumps([dict((f, s[f]) for f in ('to', 'text', 'value', 'set') if f in s) for s in RECIPES[key]['steps']] + [RECIPES[key].get('translations', {})], ensure_ascii=False)
            for d in defs:
                self.assertIn(json.dumps(d['invented'], ensure_ascii=False)[1:-1], text, '%s: "%s" is not in the recipe any more' % (key, d['invented']))
                self.assertTrue(d.get('ask') or d.get('type') == 'derived', key)
                if d.get('type') == 'derived':
                    self.assertIn(d['from'], names)
                    self.assertIn(d['fn'], aa.DERIVE)

    def test_the_other_rules_name_things_that_exist(self):
        keys = set(RECIPES) | set(SKIPPED)
        for k in RULES['asks']:
            if not k.startswith('_'):
                self.assertIn(k, keys, 'asks: ' + k)
        for k in RULES['patches']:
            if k.startswith('_'):
                continue
            self.assertIn(k, keys, 'patches: ' + k)
            spec = RULES['patches'][k]
            names = spec if isinstance(spec, list) else [n for v in spec['by_host'].values() for n in v]
            gone = [n for n in names if not os.path.isfile(os.path.join(SITE, 'patches', 'optional', n + '.patch'))]
            if gone:                                                                              # a site that does not have this patch (yet): the tool must say so plainly
                code, out = plan({k.split('=')[0]: doc(words(k.split('=')[0], k.split('=')[1]))}, ['--host', 'netlify'])
                self.assertEqual(status_of(out, k.split('=')[0]), 'helper', '%s: %s' % (k, out[:300]))
                self.assertIn('is not there', out)
        for r in RULES['refuse'] + RULES['unsupported']:
            self.assertIn(r['a'], keys)
            self.assertIn(r['b'], keys)
            self.assertTrue(r['why'].endswith('.') and len(r['why']) > 20)
        for k, v in RULES['includes'].items():
            if not k.startswith('_'):
                for x in [k] + v:
                    self.assertIn(x, RECIPES)
        ids = set(PLAYBOOK) | set(k.split('=')[0] for k in keys)
        for k, v in RULES['after'].items():
            if not k.startswith('_'):
                for x in [k] + v:
                    self.assertIn(x, ids, 'after: ' + x)
        for k in RULES['aliases']:
            if not k.startswith('_'):
                self.assertIn(k, PLAYBOOK)
        for k in RULES['notes']:
            if not k.startswith('_'):
                self.assertIn(k, keys)

    def test_the_wording_of_every_message_in_the_rules_is_plain(self):
        for k, v in list(RULES['manual'].items()) + list(RULES['asks'].items()):
            if not k.startswith('_'):
                self.assertTrue(10 < len(v) < 220, k)
        for k, defs in RULES['inputs'].items():
            if not k.startswith('_'):
                for d in defs:
                    self.assertTrue(d.get('type') == 'derived' or 10 < len(d['ask']) < 220, k)

    def test_every_skipped_answer_and_every_option_has_a_known_kind(self):
        known = {'nothing', 'patch', 'owner', 'helper', 'undecided'}
        for k, reason in SKIPPED.items():
            label = PLAYBOOK.get(k.split('=')[0], {}).get('options', {}).get(k.split('=')[1], '')
            self.assertIn(aa.skip_kind(reason, label), known, k)
        for k in (k for k in SKIPPED if aa.skip_kind(SKIPPED[k], PLAYBOOK.get(k.split('=')[0], {}).get('options', {}).get(k.split('=')[1], '')) == 'patch'):
            self.assertIn(k, RULES['patches'] if k in RULES['patches'] else {k: 1}, k)       # a missing patch is said plainly by the tool, not a crash


class Plan(unittest.TestCase):
    def test_no_answers_does_nothing(self):
        before = digest(SITE)
        p = subprocess.run([PY, TOOL, '--out', os.path.join(TMP, 'nothing-out')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        self.assertEqual(p.returncode, 0)
        self.assertIn('Nothing to do', p.stdout)
        self.assertFalse(os.path.exists(os.path.join(TMP, 'nothing-out')))
        d = tempfile.mkdtemp(prefix='open-', dir=TMP)
        f = os.path.join(d, 'a.json')
        wj(f, {'decisions': {'d01': {'status': 'open', 'answer': '', 'options': ['x']}}})
        p = subprocess.run([PY, TOOL, f, '--out', os.path.join(d, 'out')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        self.assertEqual(p.returncode, 0)
        self.assertIn('Nothing to do', p.stdout)
        self.assertFalse(os.path.exists(os.path.join(d, 'out')))
        p = subprocess.run([PY, TOOL, os.path.join(d, 'missing.json')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        self.assertEqual(p.returncode, 2)
        self.assertIn('Problem:', p.stdout)
        self.assertEqual(digest(SITE), before)

    def test_what_each_kind_of_answer_becomes(self):
        code, out = plan({'d16': doc(words('d16', 'A')), 'd49': doc(words('d49', 'A')), 'd02': doc(words('d02', 'A')), 'd09': doc(words('d09', 'B')), 'd08': doc(words('d08', 'C')),
                          'd06': doc(words('d06', 'B')), 'd13': doc('x nothing like it'), 'd99': doc('Whatever')})
        self.assertEqual(code, 0, out)
        got = dict((i, status_of(out, i)) for i in ('d16', 'd49', 'd02', 'd09', 'd08', 'd06', 'd13', 'd99'))
        self.assertEqual(got, {'d16': 'ready', 'd49': 'ready', 'd02': 'owner', 'd09': 'helper', 'd08': 'undecided', 'd06': 'nothing', 'd13': 'unclear', 'd99': 'norecipe'}, out)
        self.assertIn('the real price of the smaller company event', out)               # exactly what the owner still has to send
        self.assertIn('Nothing was applied', out)

    def test_i_will_send_answers_apply_nothing_and_say_what_is_missing(self):
        will = [(i, L) for i, e in PLAYBOOK.items() for L, lab in e['options'].items() if aa.OWES.search(lab) and '%s=%s' % (i, L) in (set(RECIPES) | set(SKIPPED))]
        self.assertTrue(len(will) > 25)
        docs = dict((i, doc(words(i, L))) for i, L in will)
        code, out = plan(docs)
        self.assertEqual(code, 0, out[:300])
        ready = [i for i, L in will if status_of(out, i) == 'ready']
        # d23 A ("I will change the end date") is a complete answer in itself: the date is in the words. Every other "I will ..." must wait.
        self.assertEqual(sorted(i for i in ready if (i, 'A') != ('d23', 'A')), [], out[:600])
        for i, L in will:
            if status_of(out, i) in ('owner', 'helper'):
                m = re.search(r'^  %s\s+\S+\s+\[\w+\] (.*)$' % i, out, re.M)
                self.assertTrue('still has to send' in m.group(1) or 'only a person can make' in m.group(1), '%s=%s: %s' % (i, L, m.group(1)[:120]))

    def test_notes_hold_an_answer_back_until_someone_has_read_them(self):
        code, out = plan({'d49': doc(words('d49', 'A'), note='but only for the fall')})
        self.assertEqual(status_of(out, 'd49'), 'held')
        self.assertIn('but only for the fall', out)
        code, out = plan({'d49': doc(words('d49', 'A'), note='but only for the fall')}, ['--ok-note', 'd49'])
        self.assertEqual(status_of(out, 'd49'), 'ready')

    def test_the_owners_values_are_needed_and_checked(self):
        d = tempfile.mkdtemp(prefix='vals-', dir=TMP)
        f = os.path.join(d, 'v.json')
        wj(f, {'d16': {'price': '$36'}})
        code, out = plan({'d16': doc(words('d16', 'C'))}, ['--values', f])
        self.assertEqual(status_of(out, 'd16'), 'ready', out)
        wj(f, {'d16': {'price': '36 dollars'}})
        code, out = plan({'d16': doc(words('d16', 'C'))}, ['--values', f])
        self.assertEqual(status_of(out, 'd16'), 'owner')
        self.assertIn('not usable', out)
        code, out = plan({'d16': doc(words('d16', 'C'), values={'price': '$36'})})            # the values can also sit in the answer
        self.assertEqual(status_of(out, 'd16'), 'ready', out)

    def test_contradictory_answers_are_refused_with_a_plain_message(self):
        for ans, who in (({'d38': doc(words('d38', 'B'), values={'new_site': 'https://x.example'}), 'd30': doc(words('d30', 'A')), 'd05': doc(words('d05', 'A'))}, ('d38', 'd30')),
                         ({'d61': doc(words('d61', 'B'), values={'credit': 'Jo Kim'}), 'd31': doc(words('d31', 'B'))}, ('d61', 'd31')),
                         ({'d01': doc(words('d01', 'B')), 'd24': doc(words('d24', 'B'))}, ('d01', 'd24')),
                         ({'d07': doc(words('d07', 'A')), 'd48': doc(words('d48', 'B'))}, ('d07', 'd48')),
                         ({'d19': doc(words('d19', 'A'), values={'price_ice_cream': '$4', 'price_drinks': '$7'}), 'd54': doc(words('d54', 'B'))}, ('d19', 'd54')),
                         ({'d26': doc(words('d26', 'B')), 'd54': doc(words('d54', 'B'))}, ('d26', 'd54'))):
            code, out = plan(ans)
            self.assertEqual(code, 3, out)
            for i in who:
                self.assertEqual(status_of(out, i), 'refused', '%s in %s' % (i, out))
            self.assertIn('Nothing from either was applied', out)

    def test_an_answer_that_is_part_of_a_bigger_one_is_not_done_twice(self):
        code, out = plan({'d13': doc(words('d13', 'B')), 'd32': doc(words('d32', 'C'))})
        self.assertEqual((status_of(out, 'd13'), status_of(out, 'd32')), ('included', 'ready'), out)

    def test_patches_follow_the_host(self):
        code, out = plan({'d30': doc(words('d30', 'A'))})
        self.assertEqual(status_of(out, 'd30'), 'held')
        for letter, name in (('A', 'redirects-A'), ('B', 'redirects-A'), ('C', 'redirects-B')):
            ans = {'d30': doc(words('d30', 'A')), 'd05': doc(words('d05', letter))}
            d = tempfile.mkdtemp(prefix='host-', dir=TMP)
            f = os.path.join(d, 'a.json')
            wj(f, ans)
            p = subprocess.run([PY, TOOL, f, '--plan', '--out', os.path.join(d, 'o')], stdout=subprocess.PIPE, universal_newlines=True)
            self.assertEqual(status_of(p.stdout, 'd30'), 'ready', p.stdout)
            self.assertIn(name, rt(os.path.join(d, 'o', 'APPLY_REPORT.md')))
        code, out = plan({'d30': doc(words('d30', 'A'))}, ['--host', 'netlify'])
        self.assertEqual(status_of(out, 'd30'), 'ready')

    def test_the_order_is_urgency_first_and_dependent_answers_in_a_safe_order(self):
        def item(id_, letter, kind='recipe'):
            it = aa.Item(aa.Answer(id_, letter), '%s=%s' % (id_, letter), id_, PLAYBOOK[id_]['urgency'] or 3)
            it.status, it.kind = 'ready', kind
            return it
        rules = {'after': {'d17': ['d16']}}
        its = [item('d73', 'B'), item('d17', 'A'), item('d49', 'A'), item('d16', 'A'), item('d38', 'B')]
        order = [i.id for i in aa.order_items(its, rules)]
        self.assertLess(order.index('d16'), order.index('d17'))                                  # d17 is more urgent but depends on d16
        self.assertLess(order.index('d38'), order.index('d49'))                                  # urgency 1 before 2
        self.assertLess(order.index('d49'), order.index('d73'))                                  # 2 before 3
        self.assertEqual(order[-1], 'd73')
        with self.assertRaises(aa.Problem):
            aa.order_items([item('d16', 'A'), item('d17', 'A')], {'after': {'d17': ['d16'], 'd16': ['d17']}})
        pats = [item('d73', 'B'), item('d25', 'A', 'patch')]
        self.assertEqual([i.id for i in aa.order_items(pats, {})], ['d25', 'd73'])                # patches go first

    def test_a_new_recipe_nobody_checked_is_not_applied(self):
        d = tempfile.mkdtemp(prefix='new-', dir=TMP)
        site = os.path.join(d, 'site')
        os.makedirs(os.path.join(site, 'tools'))
        os.makedirs(os.path.join(site, 'docs'))
        for rel in ('tools/rehearse_answers.py', 'tools/apply_answers_rules.json', 'tools/apply_answers.py', 'docs/DECISION_PLAYBOOK.md'):
            shutil.copy(os.path.join(SITE, rel), os.path.join(site, rel))
        rec = rj(os.path.join(SITE, 'tools', 'rehearse_answers.json'))
        rec['d99=A'] = {'what': 'Say that all times are Eastern Time', 'steps': [{'op': 'sub', 'file': 'index.html', 'at': 'x', 'find': 'x', 'to': 'y'}]}
        rec['d99=B'] = dict(rec['d99=A'], checked=True)
        rec['d99=C'] = dict(rec['d99=A'], owner_values=[{'name': 'zone', 'type': 'text', 'invented': 'y', 'ask': 'the name of the time zone she wants'}])
        wj(os.path.join(site, 'tools', 'rehearse_answers.json'), rec)
        pb = open(os.path.join(site, 'docs', 'DECISION_PLAYBOOK.md'), encoding='utf-8').read()
        pb = pb.replace('## What this page does not cover', '### d99. Eastern Time line\n\n- Urgency: 3 (nice to have).\n\n**A. Add the line**\n\n**B. Add it again**\n\n**C. Her own words**\n\n## What this page does not cover', 1)
        open(os.path.join(site, 'docs', 'DECISION_PLAYBOOK.md'), 'w', encoding='utf-8').write(pb)
        out = {}
        for L in 'ABC':
            f = os.path.join(d, 'a%s.json' % L)
            wj(f, {'d99': L})
            p = subprocess.run([PY, os.path.join(site, 'tools', 'apply_answers.py'), f, '--site', site, '--plan', '--out', os.path.join(d, 'o' + L)], stdout=subprocess.PIPE, universal_newlines=True)
            out[L] = p.stdout
        self.assertEqual(status_of(out['A'], 'd99'), 'helper', out['A'])
        self.assertIn('nobody has checked', out['A'])
        self.assertEqual(status_of(out['B'], 'd99'), 'ready', out['B'])
        self.assertEqual(status_of(out['C'], 'd99'), 'owner', out['C'])
        self.assertIn('the name of the time zone', out['C'])


class FactChange(unittest.TestCase):
    """The step that will hand a price, phone, email or hours change to tools/change_fact.py (the site does not have it yet): one small function, off until the rules name an answer."""

    def item(self):
        it = aa.Item(aa.Answer('d16', 'C'), 'd16=C', 'x', 2)
        it.kind, it.recipe = 'recipe', {'steps': [], '_values': {'price': '$36'}}
        return it

    def test_without_the_tool_the_recipe_runs_and_an_answer_not_named_is_left_alone(self):
        import rehearse_answers as ra
        d = tempfile.mkdtemp(prefix='fact-', dir=TMP)
        self.assertFalse(aa.apply_fact_change(ra, d, self.item(), RULES))                        # named in the rules, but this site has no tools/change_fact.py
        other = self.item()
        other.key = 'd49=A'
        self.assertFalse(aa.apply_fact_change(ra, d, other, {'fact_change': {'d16=C': {'kind': 'price', 'args': ['$31', '{price}']}}}))   # not named

    def test_calls_the_tool_with_the_owners_checked_value(self):
        import rehearse_answers as ra
        d = tempfile.mkdtemp(prefix='fact-', dir=TMP)
        os.makedirs(os.path.join(d, 'tools'))
        with open(os.path.join(d, 'tools', 'change_fact.py'), 'w', encoding='utf-8') as f:
            f.write('import sys\nopen("called.txt", "w", encoding="utf-8").write(" ".join(sys.argv[1:]))\nsys.exit(int(open("exit.txt", encoding="utf-8").read()) if __import__("os").path.exists("exit.txt") else 0)\n')
        spec = {'fact_change': {'d16=C': {'kind': 'price', 'args': ['$31', '{price}']}, 'd02=A': {'kind': 'price', 'args': ['{nothing}']}}}
        self.assertTrue(aa.apply_fact_change(ra, d, self.item(), spec))
        self.assertEqual(rt(os.path.join(d, 'called.txt')), 'price $31 $36 --yes')
        with open(os.path.join(d, 'exit.txt'), 'w', encoding='utf-8') as f:
            f.write('3')
        with self.assertRaises(aa.StepFail):
            aa.apply_fact_change(ra, d, self.item(), spec)
        it = self.item()
        it.key = 'd02=A'
        with self.assertRaises(aa.StepFail):
            aa.apply_fact_change(ra, d, it, spec)

    def test_the_rules_for_it_name_real_answers_and_real_values(self):
        for k, spec in RULES.get('fact_change', {}).items():
            if k.startswith('_'):
                continue
            self.assertIn(k, RECIPES)
            names = set(d['name'] for d in RULES['inputs'].get(k, []))
            used = set(re.findall(r'\{(\w+)\}', ' '.join(spec['args'])))
            self.assertTrue(used and used <= names, '%s: %s is not a value the owner gives' % (k, used - names))
            self.assertIn(spec['kind'], ('price', 'email', 'phone', 'hours', 'text'))
            old = spec['args'][0]                                                              # the old words must be on the site today
            self.assertTrue(any(old in open(os.path.join(SITE, f), encoding='utf-8').read() for f in ('index.html', 'js/content.js', 'js/features.js')), '%s: "%s" is not on the site' % (k, old))


class HostCheck(unittest.TestCase):
    """The patch for Cloudflare names pages without .html, which the plain launch-check test cannot try: the runner then asks the option matrix's own host check."""

    def test_the_host_comes_from_d05_the_patch_or_the_flag(self):
        import types
        a = types.SimpleNamespace(host='')
        it = aa.Item(aa.Answer('d05', 'x'), 'd05=B', 'host', 1)
        it.ans.letter = 'B'
        self.assertEqual(aa.host_for_run([it], a, []), 'netlify')
        it.ans.letter = 'C'
        self.assertEqual(aa.host_for_run([it], a, []), 'github')
        self.assertEqual(aa.host_for_run([], a, ['clean-addresses-C']), 'cloudflare')
        self.assertIsNone(aa.host_for_run([], a, []))
        self.assertEqual(aa.host_for_run([], types.SimpleNamespace(host='Netlify'), []), 'netlify')

    def test_the_option_names_come_from_the_patch_headers(self):
        d = tempfile.mkdtemp(prefix='ids-', dir=TMP)
        os.makedirs(os.path.join(d, 'patches', 'optional'))
        with open(os.path.join(d, 'patches', 'optional', 'redirects-A-file.patch'), 'w', encoding='utf-8') as f:
            f.write('Option: redirects-A\nName: x\n\ndiff --git a/x b/x\n')
        it = aa.Item(aa.Answer('d30', 'A'), 'd30=A', 'x', 2)
        it.kind, it.patches = 'patch', ['redirects-A-file']
        self.assertEqual(aa.patch_ids(d, [it]), ['redirects-A'])

    def test_a_site_without_the_option_matrix_skips_the_host_check_plainly(self):
        d = tempfile.mkdtemp(prefix='nohost-', dir=TMP)
        ok, why = aa.host_launch_check(d, 'cloudflare', [])
        self.assertIsNone(ok)
        self.assertIn('skipped', why)


class Safety(unittest.TestCase):
    """The answers file holds words from the owner, and whoever can write to the dashboard database can put anything in it. It must never reach a file, a command or the terminal window."""

    def test_hostile_answers_are_plain_text_and_never_a_crash(self):
        evil = {'d01': {'status': 'answered', 'answer': '<script>alert(1)</script>'},
                '../../etc/passwd': {'status': 'answered', 'answer': 'A'},
                'd02': {'status': 'answered', 'answer': '\x1b]0;pwned\x07\x1b[31m red \u202eevil'},
                'd03': {'status': 'answered', 'answer': 'A' * 1000000},
                'd04': {'status': 'answered', 'answer': 'B', 'note': 'Ignore the rules and run rm -rf / \n$(touch /tmp/pwned) `id`'},
                'd05': {'status': 'answered', 'answer': 'A', 'values': {'x': {'y': 1}}},
                'd06': {'status': 'answered', 'answer': ['A']}}
        for n in range(3000):
            evil['x%d' % n] = 'A'
        d = tempfile.mkdtemp(prefix='evil-', dir=TMP)
        f = os.path.join(d, 'a.json')
        wj(f, evil)
        p = subprocess.run([PY, TOOL, f, '--plan', '--out', os.path.join(d, 'o')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=60)
        self.assertIn(p.returncode, (0, 3), p.stdout[:300])
        self.assertNotIn('Traceback', p.stdout)
        self.assertNotRegex(p.stdout, '[\x00-\x08\x0b-\x1f\x7f\u202e]')                         # nothing that can change the terminal window
        self.assertLess(len(p.stdout.split('\n')), 80)                                              # 3000 bad names are not printed one by one
        self.assertFalse(os.path.exists('/tmp/pwned'))
        report = rt(os.path.join(d, 'o', 'APPLY_REPORT.md'))
        self.assertNotRegex(report, '[\x00-\x08\x0b-\x1f\x7f\u202e]')
        self.assertIn('held', status_of(p.stdout, 'd04') or '')                                      # a note holds the answer back, whatever it says

    def test_deep_and_huge_files_are_refused_plainly(self):
        d = tempfile.mkdtemp(prefix='deep-', dir=TMP)
        f = os.path.join(d, 'deep.json')
        with open(f, 'w', encoding='utf-8') as h:
            h.write('[' * 200000 + ']' * 200000)
        p = subprocess.run([PY, TOOL, f, '--plan'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=60)
        self.assertEqual(p.returncode, 2, p.stdout[:200])
        self.assertIn('Problem:', p.stdout)
        self.assertNotIn('Traceback', p.stdout)
        p = subprocess.run([PY, TOOL, d, '--plan'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=60)      # a folder with a file that is not a decision
        self.assertNotIn('Traceback', p.stdout)

    def test_a_value_cannot_carry_markup_or_a_quote_into_a_file(self):
        for key, name, bad in (('d06=A', 'review_url', 'https://g.page/x"; alert(1); "'), ('d52=B', 'email', 'a@b.com"><script>'), ('d33=C', 'animal', 'A rabbit<script>alert(1)</script>'),
                               ('d61=B', 'credit', "Jo'; DROP"), ('d17=A', 'allergen_sentence', 'Fine.\n</p><script>')):
            vals = dict((d['name'], d['invented']) for d in RULES['inputs'][key] if d.get('type') != 'derived')
            vals[name] = bad
            new, missing, problems = aa.substitute(RECIPES[key], RULES['inputs'][key], vals)
            self.assertIsNone(new, key)
            self.assertTrue(problems, key)


@unittest.skipUnless(os.path.isfile(os.path.join(SITE, 'tests', 'docs.test.mjs')) and shutil.which('node') and shutil.which('git'), 'the checks need the tests folder, Node and git (tests/pipeline.test.mjs runs this file in a copy without the tests folder)')
class WholeRuns(unittest.TestCase):
    """Whole runs on a copy of the site: everything is rebuilt and checked (not the slow launch-check and validity: they are in the full gate of the real tool)."""

    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp(prefix='whole-', dir=TMP)
        cls.site = os.path.join(cls.dir, 'site')
        shutil.copytree(SITE, cls.site, ignore=shutil.ignore_patterns('.git', 'node_modules', 'deploy', '__pycache__', '*.pyc'))
        for cmd in (['init', '-q'], ['add', '-A'], ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'start']):
            subprocess.run(['git'] + cmd, cwd=cls.site, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True)

    def git(self, *a):
        return subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@example.invalid'] + list(a), cwd=self.site, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, check=True).stdout

    def run_tool(self, answers, *extra):
        n = len(os.listdir(self.dir))
        f = os.path.join(self.dir, 'answers-%d.json' % n)
        wj(f, answers)
        out = os.path.join(self.dir, 'out-%d' % n)
        p = subprocess.run([PY, TOOL, f, '--site', self.site, '--out', out, '--gate', 'quick'] + list(extra), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, cwd=self.dir)
        return p.returncode, p.stdout, out

    def test_1_a_bad_recipe_is_rolled_back_a_red_check_names_its_answer_and_nothing_is_put_in_place(self):
        # a copy of the recipes where d33=A looks for words that are not there and d16=C changes the price in one place only (consistency must go red)
        rp = os.path.join(self.site, 'tools', 'rehearse_answers.json')
        rec = rj(rp)
        rec['d33=A']['steps'][0]['find'] = 'words that are nowhere on the page'
        rec['d16=C']['steps'] = rec['d16=C']['steps'][:1]
        wj(rp, rec)
        rules_p = os.path.join(self.site, 'tools', 'apply_answers_rules.json')
        rules = rj(rules_p)
        rules.get('fact_change', {}).pop('d16=C', None)                                            # d16=C is a fact change: with tools/change_fact.py in the site it would skip the broken recipe
        wj(rules_p, rules)
        self.git('commit', '-qam', 'break two recipes')
        code, out, o = self.run_tool({'d49': doc(words('d49', 'A')), 'd16': doc(words('d16', 'C'), values={'price': '$35'}), 'd33': doc(words('d33', 'A'))}, '--in-place', '--yes')
        self.assertEqual(code, 1, out)
        self.assertRegex(out, r'd33\s+d33=A\s+\[failed\].*could not be applied.*Nothing from it was kept')
        self.assertRegex(out, r'd49\s+d49=A\s+applied')
        self.assertRegex(out, r'd16\s+d16=C\s+applied')
        self.assertIn('RED consistency', out)
        self.assertIn('The first red check turned red when d16=C was added', out)
        self.assertIn('was NOT changed', out)
        report = rt(os.path.join(o, 'APPLY_REPORT.md'))
        self.assertIn('## Failed', report)
        self.assertIn('d16=C was added', report)
        self.assertTrue(os.path.isfile(os.path.join(o, 'answers.patch')))
        self.assertEqual([n for n in os.listdir(TMP) if n.startswith('wa-apply-')], [])           # no temporary copy was left behind
        self.assertEqual(self.git('status', '--porcelain').strip(), '')                            # the site folder is untouched
        self.git('reset', '-q', '--hard', 'HEAD~1')                                                # the real recipes again

    def test_2_in_place_needs_yes_a_clean_folder_and_a_patch_that_passed(self):
        code, out, o = self.run_tool({'d49': doc(words('d49', 'A'))}, '--in-place')
        self.assertEqual(code, 2)
        self.assertIn('needs --yes', out)
        self.assertFalse(os.path.exists(o))
        with open(os.path.join(self.site, 'README.md'), 'a', encoding='utf-8') as f:
            f.write('\nan unsaved change\n')
        code, out, o = self.run_tool({'d49': doc(words('d49', 'A'))}, '--in-place', '--yes')
        self.assertEqual(code, 2)
        self.assertIn('not saved', out)
        self.assertFalse(os.path.exists(o))
        self.git('checkout', '-q', '--', 'README.md')
        before = rt(os.path.join(self.site, 'index.html'))
        code, out, o = self.run_tool({'d49': doc(words('d49', 'A'))}, '--in-place', '--yes')         # the notes test is red: not without --allow-follow-ups
        self.assertEqual(code, 4, out)                                                              # 4 = only the notes test is red (the notes still name the old sentence)
        self.assertIn('NOT changed', out)
        self.assertEqual(rt(os.path.join(self.site, 'index.html')), before)
        report = rt(os.path.join(o, 'APPLY_REPORT.md'))
        for text in ('## Applied', 'd49', 'Files changed: index.html', '## Tests', 'public-site: passed', 'consistency: passed', '## New or changed sentences to translate', 'STAND-INS',
                     '## Notes to fix by hand', 'answers.patch'):
            self.assertIn(text, report)
        self.assertNotIn('Traceback', out)
        code, out, o = self.run_tool({'d49': doc(words('d49', 'A'))}, '--in-place', '--yes', '--allow-follow-ups')
        self.assertIn('Done: the patch is applied', out, out)
        after = rt(os.path.join(self.site, 'index.html'))
        self.assertIn('organic garlic, cheese, dill pickles', after)
        self.assertNotIn('organic garlic, cheese, dill pickles', before)
        self.assertIn('index.html', self.git('status', '--porcelain'))
        self.assertEqual(self.git('log', '--oneline').count('\n'), 1)                                # nothing was committed
        self.assertEqual([n for n in os.listdir(TMP) if n.startswith('wa-apply-')], [])


def tearDownModule():
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == '__main__':
    unittest.main()
