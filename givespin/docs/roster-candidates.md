# What was left out of the roster, and what to check

The roster is at 1,180 charities (see the README, "Charity list"). This note is about what was **not** added.

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

The website of every one of the 658 register-derived entries was checked by web search: does the organisation's own site have the host written in the roster? One search each (a few needed a second). 18 were on a different host and were changed: Medical Aid for Palestinians, Baptist World Aid Australia, Library For All, Playgroup Australia, Campbell Page, Afrika Tikkun UK, Good Cycles, First Languages Australia, Hand in Hand International, Stella Maris (formerly Apostleship of the Sea), Near East Foundation UK, Rapid Relief Team, Education Development Trust, Orphans in Need, Wayside Chapel, Dialogue Earth (formerly China Dialogue), The Shaw Trust and Parkinson's South Australia.

Left as they are, on purpose:

- International Rescue Committee UK: it lives on a path of a wider site (rescue.org).
- Working Animals International (formerly SPANA): a search summary names workinganimals.org, but no page on either host was listed, so spana.org stays until someone checks it by hand.
- A few charities that use two hosts (for example Tikva UK, Reprieve UK, Lighthouse Construction Charity, Interact Australia, Epic Employment Service, Good Things Foundation Australia): the roster host is one of the charity's own, so nothing was changed.
- Names that changed but whose host is right (for example Release International now operating as Voice of Persecuted Christians, Girl Guides Association (New South Wales) now Girl Guides NSW, ACT & NT, Conservation Volunteers Australia now Conservation Volunteers): the register name is kept.

Several dozen of the "same" calls rest on a host that a search summary names while the listed links were directories or encyclopedia pages (marked "summary-only" in the helpers' notes). A search only shows which host the charity's own pages use; it cannot show that a host answers today. `tools/check-links.mjs` does that from a normal connection and reports the ones that are dead or have moved.
