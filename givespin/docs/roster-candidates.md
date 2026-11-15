# What was left out of the roster, and what to check

The roster is at 500 charities (see the README, "Charity list"). This note is about what was **not** added or was left out.

## The final cut to 500
The researched roster reached 1,180 charities. For the final roster the owner asked for 500 real, legitimate, good and popular charities. Five readers ranked all 1,180 from
what they already knew (no searches), scoring how widely known and reputable each one is from 1 to 5 and noting any reason for concern. The roster keeps every
charity scored 5 or 4 and the best of those scored 3, and leaves out: any charity with a scandal, a regulator problem or a governance dispute behind it
(Wounded Warrior Project, Feed the Children, Islamic Relief and Islamic Relief Australia, Crisis Text Line, Sentebale), doubt that it still operates or what it is
(Medaille Trust, Repat Foundation, Lifeline Direct), a mainly commercial structure (a zoo operator, an aquarium operator, a fee-charging treatment provider, a
festival), a near-duplicate arm of another listed charity, and, among the less well-known ones (score 3), those with a very narrow political, abortion or
religious-mission focus. Well-known charities with older controversies (Oxfam, WWF, the Red Cross, Save the Children, the Salvation Army, Amnesty) stay because
they are household names that are still legitimate charities; check them against your own comfort before launch. The ranking is the readers' knowledge, not a
fresh search, so it is an informed judgement, not a measured popularity score. About 680 charities, mostly small UK and Australian register entries, were
dropped; the lists below describe the longer 1,180-charity roster.


## How the last 658 were chosen
They come from two official registers, not from web searches:

- **England and Wales Charity Commission**: registered charities that report working overseas, income at least about GBP 120,000.
- **Australia ACNC register**: charities of "Large" or "Medium" size with a website.

Each record had to be a currently registered charity, have a website that resolves in DNS, and not match the name patterns of
institutions (universities, schools, dioceses, professional bodies, funds, clubs and so on). Each remaining record was then reviewed by an AI agent (not a person), which wrote the entry or left the record out; about
half were left out. The reasons, in short:

- universities, schools and colleges, and training or employment companies
- professional, learned, trade and membership bodies, and peak bodies
- grant-making trusts, private or corporate foundations and donor-advised-fund intermediaries
- religious bodies whose purpose is mainly to advance a religion (orders, parishes, dioceses, evangelism-only bodies). A charity that is run by a religious body but whose work is care, such as the Little Sisters of the Poor homes for older people, was kept and flagged `faith`. An audit later found eight Australian records whose register purpose is only (or mainly) advancing a religion and whose entry describes no care work, and they were removed: Anglican Youthworks, the Australian Fellowship of Evangelical Students, Bible Society Australia, Far East Broadcasting Co (Australia), Local Leaders International, MAF Australia, SIM Australia and The Crusader Union of Australia. Six more list "advancing religion" among their register purposes but their described work is care, health, refugees, homelessness or reconciliation (HammondCare, Muslim Care, Interserve Development, Together For Humanity, the Wayside Chapel and World Villages for Children), so they were kept and are flagged as faith-based.
- think tanks and research institutes with no public-giving route
- commercial arms of charities, aged-care and housing operators, local-only service providers whose mission could not be described from the record
- a website that belongs to a different brand than the registered name
- national branches or sub-brands of an organisation already in the roster (branches that are separate registered charities with their own site, such as Oxfam GB or UNICEF UK, were kept)

## Leave out (found while researching)
- Anything with misuse-of-funds findings or scam warnings (for example Operation Underground Railroad, Narconon and the Foundation for a Drug-Free World).
- White Ribbon Australia (went into administration in 2023).
- Bodies that are not donation-eligible charities in the usual sense: Alcoholics Anonymous, Al-Anon, Narcotics Anonymous; 501(c)(4) and (c)(19) organisations such as the VFW and AMVETS.
- JNF Charitable Trust, left out to keep the roster politically neutral (it is a registered UK charity).

## Things to check before going live
- The register entries are as good as the registers: names, websites and activities change. Re-check each one you actually promote.
- Descriptions of Australian entries are generic (the ACNC extract carries purpose and beneficiary flags, not a mission statement).
- A handful of entries lean on the reviewer's general knowledge of the charity for a cause tag or a town; the sources file says which.
- `faith: true` is set where a register lists "advancing religion" or the activities are plainly faith-based; review it if your platform has rules about faith-based giving.
- The roster has no European (non-UK) charities: the `where` vocabulary has no Europe value, so work in Europe is only mentioned in the description.

## Removed after being added

- Peaceful Change Initiative (UK): its own website says it closed at the end of 2025 and the site is now an archive, so it was removed.
- Disaster Relief Australia: the results of a web check say it ceased operations and went into liquidation in May 2026 (its home page shows an unavailable notice and the National Emergency Management Agency lists it), so it was removed.
- United Purpose (UK): the results of a web check say it merged with Self Help Africa in 2021 and the combined body took the Self Help name; its old website only carries a merger notice, so it was removed.

## Website checks

The website of every one of the 658 register-derived entries was checked by web search: does the organisation's own site have the host written in the roster? One search each (a few needed a second). 16 were on a different host and were changed: Medical Aid for Palestinians, Baptist World Aid Australia, Library For All, Playgroup Australia, Afrika Tikkun UK, Good Cycles, First Languages Australia, Hand in Hand International, Stella Maris (formerly Apostleship of the Sea), Rapid Relief Team, Education Development Trust, Orphans in Need, Wayside Chapel, Dialogue Earth (formerly China Dialogue), The Shaw Trust and Parkinson's South Australia.

Left as they are, on purpose:

- International Rescue Committee UK: it lives on a path of a wider site (rescue.org).
- Campbell Page and Near East Foundation UK: a first search suggested a different host, but an independent second search disagreed (one result named each host as the official site), so they keep the address from the register.
- Working Animals International (formerly SPANA): a search summary names workinganimals.org, but no page on either host was listed, so spana.org stays until someone checks it by hand.
- A few charities that use two hosts (for example Tikva UK, Reprieve UK, Lighthouse Construction Charity, Interact Australia, Epic Employment Service, Good Things Foundation Australia): the roster host is one of the charity's own, so nothing was changed.
- Names that changed but whose host is right (for example Release International now operating as Voice of Persecuted Christians, Girl Guides Association (New South Wales) now Girl Guides NSW, ACT & NT, Conservation Volunteers Australia now Conservation Volunteers): the register name is kept.

Several dozen of the "same" calls rest on a host that a search summary names while the listed links were directories or encyclopedia pages (marked "summary-only" in the helpers' notes). A search only shows which host the charity's own pages use; it cannot show that a host answers today. `tools/check-links.mjs` does that from a normal connection and reports the ones that are dead or have moved.

## Founding years of the register-dated entries

158 charities from the Australian register had only the register's "established year" (which can be later or earlier than when the organisation really began). A web search for each (one search per entry, a few with a second) looked for a source that says this same organisation was founded or established in a year. Results: 98 settled and now carry the organisation's own year (73 equal the register year, 17 are earlier, 8 are later, mostly by one year), 33 were ambiguous (a merger, a renamed or older predecessor, or two different years), 15 were weak (the year only in a search summary or on directory sites) and 3 were not stated; nine more were left out (six where an independent second search disagreed or could not confirm the year: ACSO 1983 or 1984, Library For All 2010 or 2012, Life Without Barriers 1994 or 1995, Deaf Children Australia 1860 or 1862, Ted Noffs Foundation 1970 or 1971, Noah's Ark 1971 from directory listings only; and three on purpose: Performing Lines: the 1982 year is a division of another body and the company dates from 1990; Rapid Relief Team: the year is for the multinational; Job Futures / CoAct: moderate confidence only). Those 60 keep the register year and the label "(register date)". The quotes come from search-result text; the pages themselves were not opened, so a visitor who wants a certain year should check the charity's own history page. An independent second search was run on 42 of the settled entries (all 30 that differed from the register year and 12 that equalled it) to see how reliable this is: 35 agreed, 4 disagreed by one or two years (ACSO, Library For All, Life Without Barriers, Ted Noffs Foundation) and 3 were unclear (Deaf Children Australia, Noah's Ark, The Smith Family). All of those were put back to the register date except The Smith Family, whose own centenary page points to the year used (1922; one result says it was formally created in 1923). The same second look at the 14 changed website addresses agreed on 12 and could not settle 2 (Campbell Page, Near East Foundation UK), which went back to their original addresses.
