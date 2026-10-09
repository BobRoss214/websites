# Logo sources

Each charity listed in `js/logos.js` shows a logo instead of its initials circle. These files were collected on
2026-10-01 and 2026-10-06 from two places the build environment could reach:

- **GitHub organisation avatars** (`avatars.githubusercontent.com/<login>`): the picture the organisation chose for its own GitHub account. Each one was looked at by the AI assistant that built the site (the image has to show the charity's own name or an unmistakable mark); look-alike accounts and default placeholder avatars were rejected. This is a visual judgement, not an ownership check, so confirm each logo before you rely on it.
- **simple-icons** (the open icon set, CC0 licence for the files): single-colour brand marks, filled with the brand colour the set lists.

A logo is the charity's trademark. They are shown only to identify the organisation, GiveSpin is not affiliated with or endorsed by any of them, and any charity can ask for its logo to be removed. To turn all logos off, set `logos: false` in `js/config.js`; to drop one, delete its file and its line in `js/logos.js`. To add more from your own connection, run `node tools/fetch-logos.mjs`.

The second collection (October 2026) tried likely GitHub account names for each of the 500 charities. A great many of those names belong to
strangers, so every candidate picture was looked at by eye and only a clear match to the organisation's own logo or well-known mark was kept
(people, pets, cartoons, namesake organisations, chapters of a different charity and tiny or blurry pictures were rejected). A picture on a
GitHub account is not proof the account is the charity's official one; where a mark has no readable name, the note says what the picture shows.
Charities without a logo here show a generated emblem instead (see `js/marks.js`), labelled "Illustrated emblem, not the charity's official logo".

| Charity id | File | Source |
|---|---|---|
| `acs` | `assets/logos/acs.jpg` | GitHub account picture @american-cancer-society; looked at by eye: blue American Cancer Society wordmark with sword-and-serpent mark (older logo) |
| `actionaid-uk` | `assets/logos/actionaid-uk.png` | GitHub account picture @actionaid-uk; looked at by eye: white lowercase a on red square, ActionAid brand mark |
| `african-parks` | `assets/logos/african-parks.png` | GitHub organisation avatar @africanparks |
| `age-uk` | `assets/logos/age-uk.png` | GitHub account picture @ageuk; looked at by eye: age UK Love later life wordmark (136x136) |
| `ajws` | `assets/logos/ajws.png` | GitHub organisation avatar @ajws |
| `alcohol-and-drug-foundation` | `assets/logos/alcohol-and-drug-foundation.png` | GitHub account picture @alcohol-and-drug-foundation; looked at by eye: "ADF / Alcohol and Drug Foundation" wordmark on white |
| `als-association` | `assets/logos/als-association.png` | GitHub account picture @als-association; looked at by eye: red ALS ASSOCIATION wordmark |
| `alsf` | `assets/logos/alsf.png` | GitHub organisation avatar @alexslemonade |
| `americares` | `assets/logos/americares.jpg` | GitHub account picture @americares; looked at by eye: Americares figure emblem: yellow head, red arc body, blue pieces (no wordmark; unsure) |
| `amfar` | `assets/logos/amfar.jpg` | GitHub organisation avatar @amfar |
| `amnesty-international-uk` | `assets/logos/amnesty-international-uk.jpg` | GitHub account picture @amnestyinternational; looked at by eye: yellow square, candle in barbed wire, "AMNESTY INTERNATIONAL" text |
| `amref-health-africa` | `assets/logos/amref-health-africa.png` | GitHub account picture @amrefhealthafrica; looked at by eye: amref health africa wordmark with Africa outline |
| `arbor-day` | `assets/logos/arbor-day.png` | GitHub account picture @arbordayfoundation; looked at by eye: green circle with tree emblem; no text (transparent png) |
| `best-friends` | `assets/logos/best-friends.png` | GitHub organisation avatar @bestfriends |
| `birdlife-international` | `assets/logos/birdlife-international.png` | GitHub account picture @birdlifeinternational; looked at by eye: BirdLife International round logo with bird and wordmark |
| `black-dog-institute` | `assets/logos/black-dog-institute.jpg` | GitHub account picture @blackdoginstitute; looked at by eye: hand-shadow black dog emblem (the other candidate shows the same emblem beside the readable name) |
| `blue-star-families` | `assets/logos/blue-star-families.png` | GitHub account picture @bluestarfam; looked at by eye: blue star with red swoosh, the Blue Star Families emblem |
| `british-red-cross` | `assets/logos/british-red-cross.jpg` | GitHub account picture @britishredcrosssociety; looked at by eye: red cross with "BritishRedCross" text |
| `care-international-uk` | `assets/logos/care-international-uk.png` | GitHub account picture @careinternationaluk; looked at by eye: orange CARE logo with people mark and 'care' wordmark |
| `carnegie-hall` | `assets/logos/carnegie-hall.png` | GitHub account picture @carnegiehall; looked at by eye: red circle with script 'CH' monogram |
| `carter-center` | `assets/logos/carter-center.jpg` | GitHub account picture @thecartercenter; looked at by eye: THE CARTER CENTER wordmark with eagle (128x128) |
| `cerebral-palsy-alliance` | `assets/logos/cerebral-palsy-alliance.png` | GitHub account picture @cerebral-palsy-alliance; looked at by eye: green handprint with Australia as palm; no text (transparent png) |
| `cff` | `assets/logos/cff.png` | GitHub account picture @cffoundation; looked at by eye: "Cystic Fibrosis Foundation" wordmark with blue/yellow arcs (128px) |
| `charity-water` | `assets/logos/charity-water.jpg` | GitHub organisation avatar @charitywater |
| `child-mind` | `assets/logos/child-mind.png` | GitHub account picture @childmindinstitute; looked at by eye: 'Child Mind Institute' with blue head icon |
| `choose-love` | `assets/logos/choose-love.png` | GitHub account picture @choose-love; looked at by eye: CHOOSE LOVE wordmark, white on coral |
| `christian-aid` | `assets/logos/christian-aid.jpg` | GitHub account picture @christian-aid; looked at by eye: white christian aid arrow wordmark on red |
| `cleveland-orchestra` | `assets/logos/cleveland-orchestra.png` | GitHub organisation avatar @clevelandorchestra |
| `cmn` | `assets/logos/cmn.png` | GitHub account picture @cmnhospitals; looked at by eye: yellow balloon with blue basket, the Children's Miracle Network Hospitals balloon |
| `code-org` | `assets/logos/code-org.png` | GitHub account picture @code-org; looked at by eye: CODE letter-tile logo of Code.org |
| `compassion` | `assets/logos/compassion.png` | GitHub account picture @compassionintl; looked at by eye: white figure in blue circle, Compassion emblem (no wordmark; fairly sure) |
| `conservation-international` | `assets/logos/conservation-international.jpg` | GitHub account picture @conservationinternational; looked at by eye: blue ring over a green bar, the Conservation International mark (133px) |
| `convoy-of-hope` | `assets/logos/convoy-of-hope.jpg` | GitHub account picture @convoy-of-hope; looked at by eye: white hands-forming-heart icon on navy; no text |
| `creative-commons` | `assets/logos/creative-commons.svg` | simple-icons: Creative Commons |
| `dc-central-kitchen` | `assets/logos/dc-central-kitchen.png` | GitHub organisation avatar @dc-central-kitchen |
| `direct-relief` | `assets/logos/direct-relief.png` | GitHub organisation avatar @directrelief |
| `donorschoose` | `assets/logos/donorschoose.png` | GitHub account picture @donorschoose; looked at by eye: white D on blue square (exact handle; moderately sure) |
| `evidence-action` | `assets/logos/evidence-action.jpg` | GitHub organisation avatar @evidenceaction |
| `feed-my-starving-children` | `assets/logos/feed-my-starving-children.png` | GitHub account picture @feedmystarvingchildren; looked at by eye: 'Feed My Starving Children' wordmark with figures |
| `feeding-america` | `assets/logos/feeding-america.png` | GitHub organisation avatar @feedingamerica |
| `first-robotics` | `assets/logos/first-robotics.svg` | simple-icons: FIRST |
| `food-bank-for-nyc` | `assets/logos/food-bank-for-nyc.png` | GitHub organisation avatar @foodbanknyc |
| `foodbank-australia` | `assets/logos/foodbank-australia.png` | GitHub account picture @foodbank; looked at by eye: black apple with barcode on yellow, no text (Foodbank brand; moderately sure) |
| `girl-up` | `assets/logos/girl-up.png` | GitHub account picture @girl-up; looked at by eye: girl up wordmark with bird mark |
| `good-things-foundation` | `assets/logos/good-things-foundation.png` | GitHub account picture @goodthingsfoundation; looked at by eye: light blue fingerprint mark, no text (74px, slightly soft; moderately sure) |
| `gorilla-fund` | `assets/logos/gorilla-fund.png` | GitHub account picture @gorillafund; looked at by eye: white gorilla silhouette on dark purple square (exact domain-stem handle; no wordmark, moderately sure) |
| `great-barrier-reef-foundation` | `assets/logos/great-barrier-reef-foundation.jpg` | GitHub account picture @great-barrier-reef-foundation; looked at by eye: bannerfish with 'Great Barrier Reef Foundation' text |
| `greater-boston-food-bank` | `assets/logos/greater-boston-food-bank.png` | GitHub account picture @greater-boston-food-bank; looked at by eye: white wheat on red tile (no wordmark; handle is the exact name) |
| `greenpeace-environmental-trust` | `assets/logos/greenpeace-environmental-trust.jpg` | GitHub account picture @greenpeace; looked at by eye: green G with GREENPEACE wordmark (global Greenpeace logo) |
| `habitat` | `assets/logos/habitat.png` | GitHub account picture @habitat-for-humanity; looked at by eye: Habitat for Humanity house-people mark with wordmark |
| `headspace-national-youth-mental-health-foundation` | `assets/logos/headspace-national-youth-mental-health-foundation.jpg` | GitHub account picture @headspaceau; looked at by eye: green headspace wordmark with speech-bubble mark (Australian one, not the meditation app) |
| `hearing-dogs-for-deaf-people` | `assets/logos/hearing-dogs-for-deaf-people.png` | GitHub account picture @hearingdogs; looked at by eye: green person and burgundy dog emblem (no wordmark; fairly sure) |
| `hispanic-scholarship-fund` | `assets/logos/hispanic-scholarship-fund.png` | GitHub organisation avatar @hsf |
| `human-rights-watch` | `assets/logos/human-rights-watch.png` | GitHub account picture @humanrightswatch; looked at by eye: white spaced HUMAN RIGHTS WATCH on blue |
| `humane-world` | `assets/logos/humane-world.png` | GitHub account picture @humaneworld; looked at by eye: blue circular emblem of animal silhouettes; no text |
| `imagination-library` | `assets/logos/imagination-library.png` | GitHub organisation avatar @imaginationlibrary |
| `innocence-project` | `assets/logos/innocence-project.jpg` | GitHub account picture @innocenceproject; looked at by eye: INNOCENCE PROJECT wordmark |
| `internet-archive` | `assets/logos/internet-archive.svg` | simple-icons: Internet Archive |
| `irc` | `assets/logos/irc.png` | GitHub account picture @theirc; looked at by eye: yellow and black IRC arrow with "INTERNATIONAL RESCUE COMMITTEE" (150px) |
| `irc-uk` | `assets/logos/irc-uk.png` | GitHub account picture @theirc; looked at by eye: yellow International Rescue Committee logo with wordmark (parent org avatar, same brand) |
| `jane-goodall` | `assets/logos/jane-goodall.png` | GitHub account picture @janegoodallinstitute; looked at by eye: green circular emblem with Jane Goodall, child and chimp silhouettes |
| `jed` | `assets/logos/jed.png` | GitHub account picture @jed-foundation; looked at by eye: blue speech-bubble 'JED' logo |
| `kaboom` | `assets/logos/kaboom.png` | GitHub account picture @kaboom-org; looked at by eye: purple "KaBOOM!" wordmark in burst shape |
| `khalsa-aid-international` | `assets/logos/khalsa-aid-international.png` | GitHub account picture @khalsaaid; looked at by eye: blue khanda around an orange and blue globe, no text (moderately sure) |
| `khan-academy` | `assets/logos/khan-academy.svg` | simple-icons: Khan Academy |
| `kidney-health-australia` | `assets/logos/kidney-health-australia.png` | GitHub account picture @kidneyhealthaustralia; looked at by eye: red K with kidney-shaped cut-out |
| `lincoln-center` | `assets/logos/lincoln-center.jpg` | GitHub organisation avatar @lincoln-center |
| `los-angeles-philharmonic` | `assets/logos/los-angeles-philharmonic.png` | GitHub organisation avatar @laphil |
| `make-a-wish-australia` | `assets/logos/make-a-wish-australia.png` | GitHub account picture @makeawishfoundation; looked at by eye: white outlined star on gold, Make-A-Wish star (no wordmark) |
| `march-of-dimes` | `assets/logos/march-of-dimes.png` | GitHub account picture @march-of-dimes; looked at by eye: purple MoD mark with "MARCH OF DIMES" text |
| `marine-conservation-society` | `assets/logos/marine-conservation-society.png` | GitHub account picture @marine-conservation-society; looked at by eye: white stacked MARINE CONSER VATION SOCIETY on near-black |
| `marine-stewardship-council` | `assets/logos/marine-stewardship-council.jpg` | GitHub account picture @marinestewardshipcouncil; looked at by eye: MSC blue fish tick label, 'CERTIFIED SUSTAINABLE SEAFOOD MSC www.msc.org' readable (111px) |
| `mates-in-construction` | `assets/logos/mates-in-construction.png` | GitHub account picture @mates-in-construction; looked at by eye: round badge, two profile heads, "MATES" wordmark |
| `mha` | `assets/logos/mha.jpg` | GitHub organisation avatar @mhanational |
| `ms-society` | `assets/logos/ms-society.png` | GitHub organisation avatar @nationalmssociety |
| `msf` | `assets/logos/msf.png` | GitHub organisation avatar @doctorswithoutborders |
| `nami` | `assets/logos/nami.jpg` | GitHub account picture @namiorg; looked at by eye: blue circle with white swoosh lines, the NAMI emblem (no wordmark) |
| `national-space-centre` | `assets/logos/national-space-centre.png` | GitHub account picture @nationalspacecentre; looked at by eye: NATIONAL SPACE CENTRE round badge, name readable |
| `national-theatre` | `assets/logos/national-theatre.jpg` | GitHub account picture @national-theatre; looked at by eye: white National Theatre wordmark over night photo of the London building (composite; moderately sure) |
| `nature-conservancy` | `assets/logos/nature-conservancy.png` | GitHub organisation avatar @natureconservancy |
| `ncoa` | `assets/logos/ncoa.png` | GitHub account picture @ncoa; looked at by eye: teal circular a-swirl NCOA mark, tightly cropped (moderately sure) |
| `new-york-philharmonic` | `assets/logos/new-york-philharmonic.png` | GitHub organisation avatar @nyphil |
| `nkf` | `assets/logos/nkf.png` | GitHub account picture @nationalkidneyfoundation; looked at by eye: orange kidney-bean emblem with registered mark (no wordmark, moderately sure) |
| `nmcrs` | `assets/logos/nmcrs.png` | GitHub organisation avatar @nmcrs |
| `ocean-conservancy` | `assets/logos/ocean-conservancy.png` | GitHub account picture @ocean-conservancy; looked at by eye: blue ring of marine animals, Ocean Conservancy emblem |
| `one-acre-fund` | `assets/logos/one-acre-fund.jpg` | GitHub account picture @oneacrefund; looked at by eye: two green leaves on a stem, no text (matches the org's sprout mark; moderately sure) |
| `orbis` | `assets/logos/orbis.png` | GitHub account picture @orbis-international; looked at by eye: dark ring O between two cyan arcs, eyelid-like (no wordmark; unsure) |
| `oxfam` | `assets/logos/oxfam.png` | GitHub account picture @oxfam; looked at by eye: green circle with Oxfam figure emblem |
| `oxfam-america` | `assets/logos/oxfam-america.png` | GitHub organisation avatar @oxfamamerica |
| `parkrun-global` | `assets/logos/parkrun-global.jpg` | GitHub account picture @parkrun; looked at by eye: white parkrun tree glyph on dark aubergine square (exact domain-stem handle) |
| `penny-appeal` | `assets/logos/penny-appeal.png` | GitHub account picture @pennyappeal; looked at by eye: orange "penny appeal small change big difference" |
| `pih` | `assets/logos/pih.png` | GitHub account picture @partnersinhealth; looked at by eye: four white hands on orange square, Partners In Health mark |
| `planetary-society` | `assets/logos/planetary-society.svg` | simple-icons: The Planetary Society |
| `playing-for-change-foundation` | `assets/logos/playing-for-change-foundation.jpg` | GitHub organisation avatar @playingforchange |
| `polaris-project` | `assets/logos/polaris-project.jpg` | GitHub account picture @polarisproject; looked at by eye: white P with north star on navy (Polaris emblem) |
| `prison-reform-trust` | `assets/logos/prison-reform-trust.png` | GitHub account picture @prison-reform-trust; looked at by eye: red square, white "PRISON REFORM TRUST" text |
| `propublica` | `assets/logos/propublica.png` | GitHub organisation avatar @propublica |
| `rainforest-foundation-uk` | `assets/logos/rainforest-foundation-uk.jpg` | GitHub account picture @rainforestfoundationuk; looked at by eye: green patterned R mark (only 72 px; moderately sure) |
| `rainn` | `assets/logos/rainn.jpg` | GitHub account picture @rainnorg; looked at by eye: blue RAINN wordmark |
| `raspberry-pi-foundation` | `assets/logos/raspberry-pi-foundation.svg` | simple-icons: Raspberry Pi |
| `reading-is-fundamental` | `assets/logos/reading-is-fundamental.png` | GitHub account picture @readingisfundamental; looked at by eye: 'Reading Is Fundamental' wordmark with swoosh |
| `red-cross` | `assets/logos/red-cross.png` | GitHub account picture @americanredcross; looked at by eye: red cross emblem on white glossy button |
| `rmhc` | `assets/logos/rmhc.png` | GitHub account picture @ronald-mcdonald-house-charities; looked at by eye: red house with heart, the RMHC emblem |
| `royal-british-legion` | `assets/logos/royal-british-legion.png` | GitHub account picture @royal-british-legion; looked at by eye: blue R-B-L lettering with red poppy as the B (a cropped copy elsewhere reads Royal British Legion) |
| `salvation-army` | `assets/logos/salvation-army.png` | GitHub organisation avatar @salvationarmyusa |
| `save-the-children` | `assets/logos/save-the-children.png` | GitHub organisation avatar @savethechildren |
| `save-the-children-au` | `assets/logos/save-the-children-au.png` | GitHub account picture @savethechildren; looked at by eye: red Save the Children child figure in circle (handle is the global org; same shared mark) |
| `save-the-children-uk` | `assets/logos/save-the-children-uk.png` | GitHub account picture @savethechildren; looked at by eye: red child-with-raised-arms Save the Children emblem |
| `seeing-eye` | `assets/logos/seeing-eye.png` | GitHub account picture @seeingeye; looked at by eye: green round badge reading THE SEEING EYE, 95th anniversary version |
| `shelterbox` | `assets/logos/shelterbox.png` | GitHub account picture @shelterbox; looked at by eye: white ShelterBox box icon on teal circle |
| `sightsavers` | `assets/logos/sightsavers.png` | GitHub account picture @sightsaversofficial; looked at by eye: yellow loops with "Sightsavers" wordmark |
| `smile-train` | `assets/logos/smile-train.png` | GitHub account picture @smiletrainorg; looked at by eye: Smile Train wordmark with child figure, white background |
| `sos-childrens-villages` | `assets/logos/sos-childrens-villages.png` | GitHub organisation avatar @soschildrensvillages |
| `special-olympics` | `assets/logos/special-olympics.jpg` | GitHub organisation avatar @specialolympics |
| `surfrider` | `assets/logos/surfrider.png` | GitHub organisation avatar @surfrider |
| `sydney-film-festival` | `assets/logos/sydney-film-festival.png` | GitHub account picture @sydney-film-festival; looked at by eye: black SYDNEY FILM FESTIVAL wordmark on orange |
| `taps` | `assets/logos/taps.png` | GitHub account picture @tapsorg; looked at by eye: round T.A.P.S. seal reading Tragedy Assistance Program for Survivors |
| `team-rubicon` | `assets/logos/team-rubicon.png` | GitHub organisation avatar @teamrubiconusa |
| `transparency-international-uk` | `assets/logos/transparency-international-uk.png` | GitHub account picture @transparency-international-uk; looked at by eye: Transparency International globe-person emblem (global emblem, no UK text) |
| `uk-for-unhcr` | `assets/logos/uk-for-unhcr.jpg` | GitHub account picture @ukforunhcr; looked at by eye: UNHCR emblem, 'The UN Refugee Agency United Kingdom for UNHCR' text |
| `unicef-australia` | `assets/logos/unicef-australia.png` | GitHub account picture @unicef-australia; looked at by eye: unicef Australia for every child wordmark |
| `unicef-uk` | `assets/logos/unicef-uk.png` | GitHub account picture @unicef; looked at by eye: blue UNICEF wordmark with emblem (global UNICEF logo, same mark UK uses; unsure) |
| `usa-for-unhcr` | `assets/logos/usa-for-unhcr.png` | GitHub organisation avatar @usa-for-unhcr |
| `victim-support` | `assets/logos/victim-support.jpg` | GitHub account picture @victimsupport; looked at by eye: white VS VICTIM SUPPORT on red (198px) |
| `voa` | `assets/logos/voa.png` | GitHub account picture @volunteersofamerica; looked at by eye: blue triangle and red slashes forming a V (no wordmark; fairly sure) |
| `water-org` | `assets/logos/water-org.png` | GitHub account picture @waterdotorg; looked at by eye: water.org wordmark with loop mark on light blue |
| `wateraid` | `assets/logos/wateraid.jpg` | GitHub organisation avatar @wateraid |
| `wcs` | `assets/logos/wcs.png` | GitHub account picture @wildlife-conservation-society; looked at by eye: WCS wordmark with green/blue W mark |
| `wikimedia` | `assets/logos/wikimedia.svg` | simple-icons: Wikimedia Foundation |
| `withyou` | `assets/logos/withyou.png` | GitHub account picture @wearewithyou-org; looked at by eye: 'we are withyou' wordmark on blue |
| `woodland-trust` | `assets/logos/woodland-trust.png` | GitHub account picture @woodlandtrust; looked at by eye: light and dark green oak leaves, the Woodland Trust mark (99px) |
| `world-land-trust` | `assets/logos/world-land-trust.png` | GitHub account picture @worldlandtrust; looked at by eye: red-eyed tree frog on green striped circle (World Land Trust emblem); no text |
| `wwf` | `assets/logos/wwf.png` | GitHub account picture @wwfus; looked at by eye: WWF panda with WWF wordmark |
| `youth-villages` | `assets/logos/youth-villages.jpg` | GitHub organisation avatar @youth-villages |
