/*
 * Causes and charities.
 *
 * The roster is hand-picked: well-known, established nonprofits spread across every cause, so any
 * filter combination has plenty to draw from. Names are used only to identify each organisation;
 * GiveSpin is not affiliated with or endorsed by any of them, and no logos are used.
 *
 * Before launching with real money, confirm that every entry is still active, that you are happy with
 * the description, and (for mode 'redirect') add whatever link field your checkout builder needs.
 *
 * Each charity: { id, name, short (used on the wheel, slots and cards), url (hostname to learn more),
 *                 causes: [cause ids, first one sets the accent colour], blurb }
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});

  GS.causes = [
    { id: 'kids',      name: 'Kids',           icon: 'baby',           color: '#FF5FA2' },
    { id: 'animals',   name: 'Animals',        icon: 'paw-print',      color: '#E0A96D' },
    { id: 'planet',    name: 'Planet',         icon: 'leaf',           color: '#4ADE80' },
    { id: 'hunger',    name: 'Hunger',         icon: 'wheat',          color: '#FB923C' },
    { id: 'health',    name: 'Health',         icon: 'heart-pulse',    color: '#F43F5E' },
    { id: 'education', name: 'Education',      icon: 'graduation-cap', color: '#60A5FA' },
    { id: 'disaster',  name: 'Disaster Relief',icon: 'life-buoy',      color: '#FACC15' },
    { id: 'veterans',  name: 'Veterans',       icon: 'medal',          color: '#818CF8' },
    { id: 'mental',    name: 'Mental Health',  icon: 'brain',          color: '#C084FC' },
    { id: 'housing',   name: 'Housing',        icon: 'house',          color: '#2DD4BF' },
    { id: 'water',     name: 'Clean Water',    icon: 'droplet',        color: '#38BDF8' }
  ];

  GS.charities = [
    // Kids
    { id: 'st-jude', name: "St. Jude Children's Research Hospital", short: 'St. Jude', url: 'stjude.org', causes: ['kids', 'health'],
      blurb: 'Pioneering research and care for childhood cancer and other life-threatening diseases. Families never receive a bill from St. Jude.' },
    { id: 'save-the-children', name: 'Save the Children', short: 'Save the Children', url: 'savethechildren.org', causes: ['kids', 'education', 'disaster'],
      blurb: 'Gives children a healthy start, the chance to learn, and protection from harm, at home and in emergencies.' },
    { id: 'unicef-usa', name: 'UNICEF USA', short: 'UNICEF USA', url: 'unicefusa.org', causes: ['kids'],
      blurb: "Supports UNICEF's work for children's health, nutrition, education and protection in more than 190 countries and territories." },
    { id: 'make-a-wish', name: 'Make-A-Wish America', short: 'Make-A-Wish', url: 'wish.org', causes: ['kids', 'health'],
      blurb: 'Grants life-changing wishes to children facing critical illnesses.' },
    { id: 'bgca', name: 'Boys & Girls Clubs of America', short: 'Boys & Girls Clubs', url: 'bgca.org', causes: ['kids', 'education'],
      blurb: 'After-school and summer programs that help young people build skills and a safe, positive future.' },
    { id: 'no-kid-hungry', name: 'No Kid Hungry', short: 'No Kid Hungry', url: 'nokidhungry.org', causes: ['kids', 'hunger'],
      blurb: 'Works to end childhood hunger in America by connecting kids to school meals and food programs.' },
    { id: 'st-baldricks', name: "St. Baldrick's Foundation", short: "St. Baldrick's", url: 'stbaldricks.org', causes: ['kids', 'health'],
      blurb: 'A leading charity funder of childhood cancer research, powered by everyday people.' },
    { id: 'operation-smile', name: 'Operation Smile', short: 'Operation Smile', url: 'operationsmile.org', causes: ['kids', 'health'],
      blurb: 'Provides safe surgery for children born with cleft lip and cleft palate in communities around the world.' },
    { id: 'child-mind', name: 'Child Mind Institute', short: 'Child Mind Inst.', url: 'childmind.org', causes: ['kids', 'mental'],
      blurb: 'Transforms the lives of children and families struggling with mental health and learning disorders.' },
    { id: 'covenant-house', name: 'Covenant House', short: 'Covenant House', url: 'covenanthouse.org', causes: ['kids', 'housing'],
      blurb: 'Shelter, meals and support for young people experiencing homelessness.' },
    { id: 'room-to-read', name: 'Room to Read', short: 'Room to Read', url: 'roomtoread.org', causes: ['education', 'kids'],
      blurb: "Literacy and girls' education programs in low-income communities across Asia and Africa." },

    // Education
    { id: 'malala-fund', name: 'Malala Fund', short: 'Malala Fund', url: 'malala.org', causes: ['education'],
      blurb: 'Works for a world where every girl can learn and lead, by backing local education activists.' },
    { id: 'khan-academy', name: 'Khan Academy', short: 'Khan Academy', url: 'khanacademy.org', causes: ['education'],
      blurb: 'Free, world-class lessons and practice for anyone, anywhere.' },
    { id: 'donorschoose', name: 'DonorsChoose', short: 'DonorsChoose', url: 'donorschoose.org', causes: ['education'],
      blurb: 'Helps public school teachers fund the classroom projects and supplies their students need.' },

    // Animals
    { id: 'aspca', name: 'ASPCA', short: 'ASPCA', url: 'aspca.org', causes: ['animals'],
      blurb: 'Fights animal cruelty, rescues animals in need, and works to make communities safer for them.' },
    { id: 'best-friends', name: 'Best Friends Animal Society', short: 'Best Friends', url: 'bestfriends.org', causes: ['animals'],
      blurb: 'Leads the movement to bring the country to no-kill, where every shelter pet is safe.' },
    { id: 'wcs', name: 'Wildlife Conservation Society', short: 'WCS', url: 'wcs.org', causes: ['animals', 'planet'],
      blurb: 'Saves wildlife and wild places worldwide, and runs the Bronx Zoo and other New York wildlife parks.' },
    { id: 'jane-goodall', name: 'Jane Goodall Institute', short: 'Jane Goodall Inst.', url: 'janegoodall.org', causes: ['animals', 'planet'],
      blurb: 'Protects chimpanzees and their habitats while empowering the communities that live alongside them.' },
    { id: 'wwf', name: 'World Wildlife Fund', short: 'WWF', url: 'worldwildlife.org', causes: ['animals', 'planet'],
      blurb: 'Works to protect wildlife and the natural world, from tigers to forests to oceans.' },
    { id: 'rainforest-trust', name: 'Rainforest Trust', short: 'Rainforest Trust', url: 'rainforesttrust.org', causes: ['planet', 'animals'],
      blurb: 'Protects threatened tropical habitats acre by acre, working with local partners.' },

    // Planet
    { id: 'nature-conservancy', name: 'The Nature Conservancy', short: 'Nature Conservancy', url: 'nature.org', causes: ['planet'],
      blurb: 'Protects the lands and waters on which all life depends.' },
    { id: 'ocean-conservancy', name: 'Ocean Conservancy', short: 'Ocean Conservancy', url: 'oceanconservancy.org', causes: ['planet'],
      blurb: 'Takes on threats to the ocean, from plastic pollution to climate change.' },
    { id: 'arbor-day', name: 'Arbor Day Foundation', short: 'Arbor Day', url: 'arborday.org', causes: ['planet'],
      blurb: 'Plants trees and inspires people to care for them, in forests and communities.' },

    // Hunger
    { id: 'feeding-america', name: 'Feeding America', short: 'Feeding America', url: 'feedingamerica.org', causes: ['hunger'],
      blurb: 'A nationwide network of food banks, pantries and meal programs fighting hunger.' },
    { id: 'wck', name: 'World Central Kitchen', short: 'World Central Kitchen', url: 'wck.org', causes: ['hunger', 'disaster'],
      blurb: 'Serves fresh meals to people affected by disasters and crises.' },
    { id: 'meals-on-wheels', name: 'Meals on Wheels America', short: 'Meals on Wheels', url: 'mealsonwheelsamerica.org', causes: ['hunger'],
      blurb: 'Supports local programs that deliver meals and friendly visits to seniors.' },

    // Health
    { id: 'msf', name: 'Doctors Without Borders USA', short: 'Doctors Without Borders', url: 'doctorswithoutborders.org', causes: ['health', 'disaster'],
      blurb: 'Delivers emergency medical care to people affected by conflict, epidemics and disaster.' },
    { id: 'direct-relief', name: 'Direct Relief', short: 'Direct Relief', url: 'directrelief.org', causes: ['health', 'disaster'],
      blurb: 'Delivers medicines and medical supplies to communities in crisis and in everyday need.' },
    { id: 'acs', name: 'American Cancer Society', short: 'American Cancer Soc.', url: 'cancer.org', causes: ['health'],
      blurb: 'Funds cancer research and supports patients, families and prevention efforts.' },
    { id: 'alzheimers', name: "Alzheimer's Association", short: "Alzheimer's Assoc.", url: 'alz.org', causes: ['health'],
      blurb: "Advances research and provides care and support for people living with Alzheimer's and their families." },

    // Disaster relief
    { id: 'red-cross', name: 'American Red Cross', short: 'Red Cross', url: 'redcross.org', causes: ['disaster'],
      blurb: 'Provides emergency assistance, disaster relief and disaster preparedness education.' },

    // Veterans
    { id: 'team-rubicon', name: 'Team Rubicon', short: 'Team Rubicon', url: 'teamrubiconusa.org', causes: ['veterans', 'disaster'],
      blurb: 'Puts military veterans and first responders to work helping communities after disasters.' },
    { id: 'fisher-house', name: 'Fisher House Foundation', short: 'Fisher House', url: 'fisherhouse.org', causes: ['veterans', 'housing', 'health'],
      blurb: 'Provides free housing for military and veteran families near the hospital where their loved one is treated.' },
    { id: 'operation-homefront', name: 'Operation Homefront', short: 'Operation Homefront', url: 'operationhomefront.org', causes: ['veterans', 'housing'],
      blurb: 'Offers financial assistance, housing and family support to military families.' },
    { id: 'hire-heroes', name: 'Hire Heroes USA', short: 'Hire Heroes USA', url: 'hireheroesusa.org', causes: ['veterans'],
      blurb: 'Free job-search help for veterans, transitioning service members and military spouses.' },

    // Mental health
    { id: 'nami', name: 'NAMI', short: 'NAMI', url: 'nami.org', causes: ['mental'],
      blurb: 'The nation’s largest grassroots mental health organization, offering support, education and advocacy.' },
    { id: 'crisis-text-line', name: 'Crisis Text Line', short: 'Crisis Text Line', url: 'crisistextline.org', causes: ['mental'],
      blurb: 'Free, 24/7 text support for people in crisis.' },
    { id: 'mha', name: 'Mental Health America', short: 'Mental Health America', url: 'mhanational.org', causes: ['mental'],
      blurb: 'Promotes mental health and works to prevent mental illness through advocacy, education and services.' },

    // Housing
    { id: 'habitat', name: 'Habitat for Humanity', short: 'Habitat for Humanity', url: 'habitat.org', causes: ['housing'],
      blurb: 'Builds and repairs homes with families who need a decent, affordable place to live.' },
    { id: 'naeh', name: 'National Alliance to End Homelessness', short: 'End Homelessness', url: 'endhomelessness.org', causes: ['housing'],
      blurb: 'Works to prevent and end homelessness through research, policy and proven solutions.' },
    { id: 'rebuilding-together', name: 'Rebuilding Together', short: 'Rebuilding Together', url: 'rebuildingtogether.org', causes: ['housing'],
      blurb: 'Repairs homes and revitalizes communities for people in need, at no cost to homeowners.' },

    // Clean water
    { id: 'charity-water', name: 'charity: water', short: 'charity: water', url: 'charitywater.org', causes: ['water'],
      blurb: 'Brings clean, safe drinking water to people in developing countries.' },
    { id: 'water-org', name: 'Water.org', short: 'Water.org', url: 'water.org', causes: ['water'],
      blurb: 'Gives people access to safe water and sanitation through affordable financing.' },
    { id: 'wateraid', name: 'WaterAid America', short: 'WaterAid', url: 'wateraid.org/us', causes: ['water'],
      blurb: 'Works to make clean water, decent toilets and good hygiene normal for everyone, everywhere.' },
    { id: 'water-project', name: 'The Water Project', short: 'The Water Project', url: 'thewaterproject.org', causes: ['water'],
      blurb: 'Funds sustainable water projects for communities in sub-Saharan Africa.' }
  ];

  var causeById = {};
  GS.causes.forEach(function (c) { causeById[c.id] = c; });
  var charityById = {};
  GS.charities.forEach(function (c) {
    c.accent = causeById[c.causes[0]].color;
    charityById[c.id] = c;
  });

  GS.cause = function (id) { return causeById[id]; };
  GS.charity = function (id) { return charityById[id]; };

  /**
   * A 1-4 letter monogram for a charity ("SJ", "WWF"). Used in place of logos on tiles and cards.
   * Derived from the short name, with overrides where the automatic version reads badly.
   */
  var MONO_OVERRIDES = { 'unicef-usa': 'UN', 'water-org': 'W', 'charity-water': 'cw', 'wwf': 'WWF', 'wcs': 'WCS', 'aspca': 'ASPCA', 'nami': 'NAMI' };
  var STOP = { the: 1, of: 1, for: 1, to: 1, on: 1, a: 1, and: 1, in: 1 };
  GS.mono = function (charity) {
    if (MONO_OVERRIDES[charity.id]) { return MONO_OVERRIDES[charity.id]; }
    var words = charity.short.replace(/['’]/g, '').split(/[^A-Za-z0-9]+/).filter(function (w) { return w && !STOP[w.toLowerCase()]; });
    if (words.length >= 2) { return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase(); }
    return (words[0] || charity.short).slice(0, 2).toUpperCase();
  };
})();
