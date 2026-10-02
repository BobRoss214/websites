# What was left out of the roster, and what to check

The roster is at 1,050 charities (see the README, "Charity list"). This note is about what was **not** added.

## How the last 669 were chosen
They come from two official registers, not from web searches:

- **England and Wales Charity Commission**: registered charities that report working overseas, income at least about GBP 120,000.
- **Australia ACNC register**: charities of "Large" or "Medium" size with a website.

Each record had to be a currently registered charity, have a website that resolves in DNS, and not match the name patterns of
institutions (universities, schools, dioceses, professional bodies, funds, clubs and so on). Each remaining record was then reviewed by an AI agent (not a person), which wrote the entry or left the record out; about
half were left out. The reasons, in short:

- universities, schools and colleges, and training or employment companies
- professional, learned, trade and membership bodies, and peak bodies
- grant-making trusts, private or corporate foundations and donor-advised-fund intermediaries
- religious bodies whose purpose is mainly to advance a religion (orders, parishes, dioceses, evangelism-only bodies). A charity that is run by a religious body but whose work is care, such as the Little Sisters of the Poor homes for older people, was kept and flagged `faith`
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
