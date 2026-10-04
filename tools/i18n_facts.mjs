#!/usr/bin/env node
/* The facts in a translation: does every translated text say the same numbers, prices, times, days, dates, ages, group sizes and names as its English?
 * A wrong number, day or price in one language is the worst translation mistake, and nobody who reads that language has to be present to catch it here.
 * No browser, no network, nothing is written. tests/i18n-facts.test.mjs runs this on every text of lang/src/{es,hi,zh,vi}.json.
 *
 *   node tools/i18n_facts.mjs                 every difference that is not on the allow list (tools/i18n_facts_allow.json), grouped by language
 *   node tools/i18n_facts.mjs --lang zh       one language (es hi zh vi, comma separated)
 *   node tools/i18n_facts.mjs --kind time     only one kind of fact (price time date days numbers units bound name words ...)
 *   node tools/i18n_facts.mjs --all           also the differences that are on the allow list, with the reason
 *   node tools/i18n_facts.mjs --show t1c41eab2   what was read from one text (an id such as t1c41eab2) in every language, side by side
 *
 * What is read from each English text and each translation, and compared (the kind is the word you see in a failure):
 *   price       every $ amount, and the thing it is for ($3 per person / per child / per student / per pound / per stem / per party)
 *   percent     every percentage
 *   numbers     every other number (digits in any script, and numbers written out: "six", "六", "seis", "छह", "sáu"), thousands signs and decimal commas understood
 *   units       a number and what it counts: 45 minutes, 2 hours, 5 days, 3 weeks, 12 inches, 1,500 miles, ages 3 (a number next to the wrong unit is an error)
 *   time        every clock time, as a time of day: "4 pm" = "下午 4 点" = "16:00" = "4 giờ chiều" = "शाम 4 बजे"; the 12 and 24 hour clocks are the same; am / pm matter
 *   date        every month and day: "Oct 6" = "6 de oct" = "6 अक्टूबर" = "10 月 6 日" = "6 thg 10"; 9/29 and 29/9 are read with the local order
 *   month       every month named on its own ("April", "4 月", "tháng 4")
 *   early/mid/late   "late April through early May" keeps its early / mid / late (上旬 中旬 下旬, principios mediados finales, đầu giữa cuối)
 *   days        every day of the week, a range written out ("Friday through Sunday" = "viernes a domingo" = "周五至周日" = "Thứ Sáu đến Chủ Nhật") and a list are the same set
 *   bound       "ages 3 and up" is not "ages 3 and under"; "minimum 100" is not "up to 100"; "up to 50 guests" is not "50+"
 *   words       the little words that carry a promise: free, only, always, never, no / not / without, weekend, about, usually, a dozen, half, one-third,
 *               the seasons (spring summer fall winter), Thanksgiving, Christmas, Easter
 *   name        Wise Acres, Wise Pie, The GreenHouse, Poplin Rd, Hartis Rd, Instagram, Google, Waze ... kept as the farm writes them (places have the usual local spelling)
 *   contact     e-mail addresses, phone numbers, web addresses, @handles, #hashtags, links inside a text, {placeholders}
 * Reading is by regular expressions and tables (below), not by understanding. Where a difference is meant, it goes on tools/i18n_facts_allow.json with the reason. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LANGS = ['es', 'hi', 'zh', 'vi'];

/* ------------------------------------------------------------------ text */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', middot: '·', copy: '©', times: '×', ntilde: 'ñ', thinsp: ' ', ensp: ' ', emsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : NAMED[e.toLowerCase()] ?? m));
const DEV = '०१२३४५६७८९';
/** A text as a visitor reads it: no tags, entities decoded, one kind of space, digits in every script written 0-9, one kind of dash. */
export function plain(raw) {
  return decode(String(raw).replace(/<[^>]*>/g, ' '))
    .replace(/[\u00a0\u202f\u2009\u200a\u2007\u2002\u2003]/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[०-९]/g, (c) => String(DEV.indexOf(c))).replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
    .replace(/[\u2012\u2013\u2014\u2212\u2015\uff5e\u301c~]/g, '–').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ tables */
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTH_RX = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\b\\.?';   // capital letter: "may" and "mar" are words
const enMonthNo = (w) => MONTH_EN.findIndex((x) => x.startsWith(w.slice(0, 3))) + 1;
const EN_DAY_RX = '(Sun(?:day)?|Mon(?:day)?|Tue(?:s(?:day)?)?|Wed(?:nesday)?|Thu(?:r(?:s(?:day)?)?)?|Fri(?:day)?|Sat(?:urday)?)s?\\b';
const enDayNo = (w) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w.slice(0, 3));

const L = '\\p{L}\\p{M}';   // a letter (with its marks): Devanagari and Vietnamese words are not cut in the middle
const MONTHS = {   // month names (full names first, then the short forms that are used), one entry per month; [^L] before and after is added below
  es: ['enero|ene', 'febrero|feb', 'marzo|mar', 'abril|abr', 'mayo|may', 'junio|jun', 'julio|jul', 'agosto|ago', 'septiembre|setiembre|sept|sep', 'octubre|oct', 'noviembre|nov', 'diciembre|dic'],
  hi: ['जनवरी|Jan', 'फ़रवरी|फरवरी|Feb', 'मार्च|Mar', 'अप्रैल|Apr', 'मई|May', 'जून|Jun', 'जुलाई|Jul', 'अगस्त|Aug', 'सितंबर|सितम्बर|Sep', 'अक्टूबर|अक्तूबर|Oct', 'नवंबर|नवम्बर|Nov', 'दिसंबर|दिसम्बर|Dec'],
};
const DAYS = {   // names of the days of the week, Sunday first; short forms after the bar
  es: ['domingo|dom', 'lunes|lun', 'martes', 'mi[eé]rcoles|mi[eé]', 'jueves|jue', 'viernes|vie', 's[aá]bado|s[aá]b'],
  hi: ['रविवार|रवि', 'सोमवार|सोम', 'मंगलवार|मंगल', 'बुधवार|बुध', 'गुरुवार|गुरु', 'शुक्रवार|शुक्र', 'शनिवार|शनि'],
  vi: ['chủ nhật|cn', 'thứ hai|t2', 'thứ ba|t3', 'thứ tư|t4', 'thứ năm|t5', 'thứ sáu|t6', 'thứ bảy|t7'],
};
const ZH_DAY = '日一二三四五六';

/** Words that are small but carry the promise. en / es / hi / zh / vi, case-insensitive. Presence is compared (a word dropped or added is a difference). */
const WORDS = {   // compared both ways: a promise of free that is not in the English is a wrong price
  free: [/(?<![-\w])(?<!(?:nitrate|gluten|dairy|sugar|nut|fat|dye|allergen) )free(?![-\w])|\bcomplimentary\b|\bat no (?:charge|cost)\b/i, /gratis|gratuit[oa]s?|sin (?:costo|cargo)/i, /मुफ़्त|मुफ्त|निःशुल्क|बिना (?:कोई )?शुल्क/, /免费|免費|不收费|无需付费|不收取费用|买一送一/, /miễn phí|không (?:mất|tính|thu) (?:phí|tiền)|mua một tặng một/i],
};
/** Words the English text has that the translation must also have (the other way round is not asked: a translation may say "solo" for "simply", or name the Christmas trees as such). */
const WORDS_ONE_WAY = {
  always: [/\balways\b|\bat all times\b/i, /\bsiempre\b|en todo momento/i, /हमेशा|सदैव|हर समय|हर वक़्त/, /始终|总是|总有|一直|永远|每次都|时刻/, /\bluôn\b|mọi lúc|bất cứ lúc nào|suốt|lúc nào/i],
  never: [/\bnever\b/i, /\bnunca\b|\bjamás\b/i, /कभी (?:भी )?नहीं|कभी न/, /从不|绝不|永不|从来不|决不/, /không bao giờ|chẳng bao giờ/i],
  spring: [/\bspring\b/i, /primavera/i, /वसंत|बसंत/, /春/, /mùa xuân/i],
  summer: [/\bsummer\b/i, /verano/i, /ग्रीष्म|गर्मी|गर्मियों/, /夏(?!洛)/, /mùa hè|mùa hạ/i],
  fall: [/(?:\b(?:in|this|every|each|next|a|the|for|during|of|early|late|mid|until|through) |[.:] |^)fall\b|\b(?:Fall|Autumn)\b|\bfall (?:visits?|school|tours?|party|parties|hours|prices?|menu|special|reservations?|schedule|season|weekends?|days?|trips?|events?|fun)/i, /otoño/i, /शरद|पतझड़|पतझर|पतझड/, /秋/, /mùa thu/i],
  winter: [/\bwinter\b/i, /invierno/i, /सर्दी|सर्दियों|शीत|जाड़े/, /冬/, /mùa đông/i],
  thanksgiving: [/\bThanksgiving\b/i, /Acción de Gracias/i, /थैंक्सगिविंग|थैंक्स गिविंग|धन्यवाद दिवस/, /感恩节/, /Lễ Tạ ơn|Tạ ơn|Thanksgiving/i],
  christmas: [/\bChristmas\b/i, /Navidad|navideñ/i, /क्रिसमस|क्रिस्मस|बड़ा दिन/, /圣诞|聖誕/, /Giáng sinh|Giáng Sinh|Noel/i],
  easter: [/\bEaster\b/i, /Pascua/i, /ईस्टर/, /复活节/, /Phục sinh|Phục Sinh/i],
  fathersday: [/Father'?s Day/i, /Día del Padre/i, /पिता दिवस|फ़ादर्स डे|फादर्स डे/, /父亲节/, /Ngày của Cha|Ngày Cha|Ngày của bố|Ngày của Bố|Ngày của ba/i],
  only: [/\bonly\b|-only\b/i, /\bsolo\b|\bsólo\b|solamente|únicamente|exclusivamente|\búnic[oa]s?\b/i, /केवल|सिर्फ़|सिर्फ|मात्र|ही|बस\s/, /仅|只有|只能|只需|只在|唯一|才|(?<![一二三四五六七八九十两几\d])只(?![山羊狗猫鸡])/, /\bchỉ\b|duy nhất/i],
  weekend: [/\bweekends?\b/i, /fin(?:es)? de semana/i, /वीकेंड|सप्ताहांत|सप्ताह के अंत/, /周末|週末/, /cuối tuần/i],
  about: [/\b(?:about|around|approximately|roughly|nearly|almost)\s*(?:\d|\$|one|two|three|four|five|six|seven|eight|nine|ten|a (?:few|dozen|week|month|year|mile|couple)|half)/i,
    /(?:aproximadamente|aprox\.?|alrededor de|cerca de|casi|unos|unas|más o menos)\s*(?:\$|\d|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|un |una |media)/i,
    /(?:लगभग|करीब|क़रीब|तकरीबन)\s*(?:\$|\d|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|एक|आधा)/, /(?:约|大约|大概|将近|近|差不多)\s*\d|\d\s*(?:个|岁|人|天|分钟|小时|周|块|只)?\s*左右|(?:约|大约|大概|将近|近|差不多)\s*[二两三四五六七八九十]/, /(?:khoảng|tầm|chừng|xấp xỉ|gần|cỡ)\s*(?:\$|\d|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|một|nửa)/i],
  usually: [/\b(?:usually|typically|often|generally|normally|commonly)\b/i, /normalmente|generalmente|por lo general|suele|suelen|habitualmente|usualmente|a menudo|en general|casi siempre|con frecuencia|muchas veces|frecuentemente|comúnmente|típicamente|por lo común/i, /आमतौर पर|आम तौर पर|अक्सर|प्रायः|सामान्यतः|ज़्यादातर|ज्यादातर|अधिकतर|प्राय:|आम तौर|सामान्य तौर पर/, /通常|一般|往往|常常|多在|大多|经常|常在|多数|常用|常见/, /\bthường\b|thông thường|nhìn chung|phần lớn|\bhay\b/i],
  dozen: [/(?<!Dirty )\bdozen\b/i, /docena|\bdoce\b/i, /दर्जन|बारह/, /十几|十多|十余|一打|十二/, /\bchục\b|\btá\b|mười hai/i],
  half: [/\bhalf\b/i, /\bmitad\b|½|\bmedia (?:hora|docena|libra|taza)\b|\bmedio (?:kilo|litro|día)\b/i, /आधा|आधे|आधी|½/, /一半|半|½/, /một nửa|\bnửa\b|phân nửa|½/i],
  third: [/\bthirds?\b|one-third/i, /tercio|tercera parte|1\/3/i, /तिहाई|1\/3/, /三分之一|1\/3|⅓/, /một phần ba|1\/3|⅓/i],
  negation: [/\b(?:no|not|never|without|cannot|neither|nor|none|nothing|nobody|unable|prohibit(?:s|ed)?|forbid(?:s|den)?|ban(?:s|ned)?|unsupervised|unbleached|unattended|unapproved|unsafe|unavailable|inaccessible)\b|n't\b|-free\b|\b(?:nitrate|gluten|dairy|sugar|nut|fat|dye|allergen) free\b/i,
    /\b(?:no|sin|nunca|jamás|ni|ningún|ninguna|ninguno|nadie|nada|tampoco|prohíbe|prohíben|prohibido|prohibida|prohibimos|prohibir|prohibe)\b/i, /नहीं|नही|बिना|बगैर|\bन\b|\bमत\b|बिन\b|मना|मनाही|निषेध|वर्जित|प्रतिबंध|मुक्त|फ़्री|फ्री/, /不|没|無|无|别|勿|禁止|未|严禁|免/, /\bkhông\b|chưa|chẳng|đừng|khỏi|chớ|\bcấm\b|nghiêm cấm|miễn/i],
};

/** The things a price is for. */
const PER = {
  person: [/\bper (?:person|adult|guest|visitor)|\bpp\b|\/person/i, /por (?:persona|adulto|invitado|visitante)|por cabeza|cada persona|por persona/i, /प्रति (?:व्यक्ति|वयस्क|अतिथि|सदस्य)|प्रति व्यक्ति|हर व्यक्ति|प्रत्येक व्यक्ति/, /每人|每位(?:成人|客人|访客)?|每个人|人均|每名(?:成人|客人)|\/人/, /mỗi (?:người|khách|người lớn)|\/người|một người|trên mỗi người/i],
  child: [/\bper child|\bper kid/i, /por (?:niño|niña|menor|hijo|chico)|por cada niño/i, /प्रति बच्चा|प्रति बच्चे|हर बच्चे|प्रत्येक बच्चे|प्रति बच्चों/, /每名儿童|每个孩子|每位孩子|每名孩子|每个儿童|每个小孩|每位儿童|每名小孩|每个小朋友|每位小朋友|每名小朋友|每童|每孩/, /mỗi (?:trẻ|em|bé|cháu)|mỗi trẻ em|trên mỗi trẻ/i],
  student: [/\bper student|\bper pupil/i, /por (?:estudiante|alumno|alumna)|por cada estudiante/i, /प्रति (?:छात्र|विद्यार्थी|स्टूडेंट)|हर (?:छात्र|विद्यार्थी)|प्रत्येक (?:छात्र|विद्यार्थी)/, /每名学生|每位学生|每个学生|每生|每名同学|每个孩子/, /mỗi (?:học sinh|em học sinh)|trên mỗi học sinh/i],
  pound: [/\bper (?:pound|lb)|\/lb/i, /por libra|\/lb|la libra|cada libra|la lb/i, /प्रति पाउंड|हर पाउंड|प्रति पौंड/, /每磅|每斤|\/磅|每\s?lb/, /mỗi (?:pound|cân|lb)|\/lb|một pound|trên mỗi pound/i],
  stem: [/\bper stem|\/stem/i, /por (?:tallo|rama|ramita)|cada tallo|el tallo|la rama/i, /प्रति (?:डंठल|डाली|टहनी|तना)|हर (?:डंठल|डाली|टहनी)|प्रत्येक डंठल/, /每(?:根|枝|支|茎|株|条|棵|把)|每一(?:根|枝|支)|\/枝/, /mỗi (?:cành|nhánh|cọng|thân)|trên mỗi cành|mỗi (?:ngọn)/i],
  party: [/\bper (?:party|group|booking|package|event|room)/i, /por (?:grupo|fiesta|reserva|paquete|evento|celebración)/i, /प्रति (?:पार्टी|समूह|बुकिंग|पैकेज|आयोजन|ग्रुप)|हर (?:पार्टी|समूह)/, /每(?:场|个|组|批|次)?(?:聚会|派对|团体|团|预约|套餐|活动|场)/, /mỗi (?:bữa tiệc|buổi tiệc|nhóm|tiệc|gói|đoàn|lần đặt)/i],
};
const PER_EN = /\b(each)\b|\bper[ -](person|adult|guest|visitor|child|kid|student|pupil|pound|lb|stem|party|group|booking|package|event|room)\b|\/(person|lb|stem)\b|\b(pp)\b/gi;
const PER_ALIAS = { adult: 'person', guest: 'person', visitor: 'person', pp: 'person', kid: 'child', pupil: 'student', lb: 'pound', group: 'party', booking: 'party', package: 'party', event: 'party', room: 'party' };

/** What a number counts. Each language: a regular expression for the word that follows (or precedes) the number. */
const UNITS = {
  minute: [/\bmin(?:ute)?s?\b/i, /\bminutos?\b|\bmin\b/i, /मिनट/, /分钟|分鐘/, /\bphút\b|\bp\b/i],
  hour: [/\b(?:hours?|hrs?)\b/i, /\bhoras?\b|\bhrs?\b/i, /घंट|घण्ट/, /小时|小時|钟头/, /\bgiờ\b|\btiếng\b/i],
  day: [/\bdays?\b/i, /\bd[ií]as?\b/i, /दिन/, /(?<![周星期每])天(?![气])/, /\bngày\b/i],
  week: [/\bweeks?\b/i, /\bsemanas?\b/i, /सप्ताह|हफ़्त|हफ्त/, /(?<![每])周(?![末一二三四五六日])(?!末)|星期(?![一二三四五六日天])|个星期|週(?![末一二三四五六日])/, /\btuần\b/i],
  month: [/\bmonths?\b/i, /\bmeses\b|\bmes\b/i, /महीन|माह/, /个月|個月/, /(?<![\p{L}])tháng(?!\s*\d)/iu],
  year: [/\byears?\b|\bages?\b|\bdecade\b/i, /\baños?\b|\bedad\b|\bdécada\b/i, /साल|वर्ष|उम्र|आयु|दशक/, /岁|歲|年(?![\d])/, /\btuổi\b|\bnăm\b/i],
  inch: [/\binch(?:es)?\b|"/i, /pulgadas?|"/i, /इंच/, /英寸|寸|"/, /\binch\b|\binches\b|"/i],
  mile: [/\bmiles?\b/i, /\bmillas?\b/i, /मील/, /英里/, /\bdặm\b|\bmile\b|\bmiles\b/i],
  pound: [/\bpounds?\b|\blbs?\b/i, /\blibras?\b|\blbs?\b/i, /पाउंड|पौंड/, /磅|\blbs?\b/, /\bpound\b|\blbs?\b|\bcân\b/i],
  acre: [/\bacres?\b/i, /\bacres?\b|\bacre\b/i, /एकड़/, /英亩/, /\bacre\b|\bmẫu\b/i],
};

/** Words for numbers (2 and more; "one" is also a pronoun, so it only counts as a digit). */
const NUMBER_WORDS = {
  en: { decade: 10, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 },
  es: { década: 10, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100, ciento: 100 },
  hi: { 'दशक': 10, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'छः': 6, 'छे': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'बीस': 20, 'तीस': 30, 'चालीस': 40, 'पचास': 50, 'सौ': 100 },
  vi: { 'thập kỷ': 10, hai: 2, ba: 3, 'bốn': 4, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10, 'mười một': 11, 'mười hai': 12, 'hai mươi': 20, 'ba mươi': 30, 'năm mươi': 50, 'trăm': 100 },
};
const ZH_NUM = { 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12, 二十: 20, 三十: 30, 四十: 40, 五十: 50, 一百: 100 };
const ZH_MEASURE = '个|岁|天|分钟|分|小时|人|位|种|周|月|点|块|条|只|次|倍|名|张|份|年|岁|成|折|页|颗|粒|盒|篮|桶|口|场|套|道|步|级|层|枚|根|支|对|双|副|把|辆|节|项|样|类|款|组|批|袋|瓶|罐|杯|碗|片|个月';
/** Names that stay as the farm writes them. Each: [English form, accepted forms per language (a string = the same letters, a RegExp = a local spelling), also accepted]. Places have the usual local spelling. */
const NAMES = [
  ['Wise Acres'], ['Wise Pie'], ['The GreenHouse', { es: /GreenHouse/, hi: /GreenHouse|ग्रीनहाउस/, zh: /GreenHouse|绿屋|温室/, vi: /GreenHouse/ }], ['Poplin R'], ['Hartis R'],
  ['Instagram', { hi: /Instagram|इंस्टाग्राम/ }], ['Facebook', { hi: /Facebook|फ़ेसबुक|फेसबुक/ }], ['Google Maps', { hi: /Google Maps|गूगल मैप्स|Google मैप्स|Google Maps/, zh: /Google (?:Maps|地图)|谷歌地图/, vi: /Google (?:Maps|Bản đồ)/, es: /Google Maps|Google Mapas/ }], ['Google Calendar', { hi: /Google Calendar|Google कैलेंडर|गूगल कैलेंडर/, zh: /Google (?:Calendar|日历)|谷歌日历/, vi: /Google (?:Calendar|Lịch)/, es: /Google Calendar|Google Calendario|Calendario de Google/ }],
  ['Apple Maps', { hi: /Apple Maps|Apple मैप्स|ऐप्पल मैप्स/, zh: /Apple (?:Maps|地图)|苹果地图/, vi: /Apple (?:Maps|Bản đồ)/, es: /Apple Maps|Apple Mapas/ }], ['Waze', { hi: /Waze|वेज़/ }], ['Apple Pay', { hi: /Apple Pay|ऐप्पल पे/ }], ['Google Pay', { hi: /Google Pay|गूगल पे/ }], ['Outlook', { hi: /Outlook|आउटलुक/ }], ['OpenStreetMap', { hi: /OpenStreetMap|ओपनस्ट्रीटमैप/ }],
  ['Bookeo', { hi: /Bookeo|बुकियो/ }], ['USDA', { es: /USDA|Departamento de Agricultura/, hi: /USDA|यूएसडीए|कृषि विभाग/, zh: /USDA|美国农业部/, vi: /USDA|Bộ Nông nghiệp/ }], ['Waxhaw Creamery'], ['Uno Alla Volta'], ['Follow Your Heart'], ['Wholly Wholesome'],
  ['Indian Trail', { es: /Indian Trail/, hi: /Indian Trail|इंडियन ट्रेल/, zh: /Indian Trail|印第安特雷尔|印第安小径/, vi: /Indian Trail/ }],
  ['Charlotte', { es: /Charlotte/, hi: /Charlotte|शार्लट/, zh: /Charlotte|夏洛特/, vi: /Charlotte/ }],
  ['North Carolina', { es: /Carolina del Norte|North Carolina/, hi: /नॉर्थ कैरोलिना|North Carolina|उत्तरी कैरोलिना|NC/, zh: /北卡罗来纳|北卡/, vi: /Bắc Carolina|North Carolina/ }],
  ['Chicago', { hi: /Chicago|शिकागो/, zh: /Chicago|芝加哥/ }], ['Monroe', { hi: /Monroe|मुनरो|मोनरो/, zh: /Monroe|门罗|梦露/ }],
  ['Cathy'], ['Pranee'], ['Vanessa'], ['Ava'], ['Bailey'], ['Morgan'], ['Mac'],
];
const NAME_PREFIX = new Set(['Poplin R', 'Hartis R']);   // Rd or Road

/* ------------------------------------------------------------------ tokens in text */
const UB = '(?:(?<=[\\p{L}\\p{M}\\d_])(?![\\p{L}\\p{M}\\d_])|(?<![\\p{L}\\p{M}\\d_])(?=[\\p{L}\\p{M}\\d_]))';   // \b that knows letters of every script
const uniCache = new Map();
/** A table regular expression for a language other than English: \b means a real word edge for ñ, ố, ा ... (the plain \b only knows a-z). */
const uni = (rx, lang) => { if (lang === 'en') return rx; let r = uniCache.get(rx); if (!r) { r = new RegExp(rx.source.replace(/\\b/g, UB), rx.flags.includes('u') ? rx.flags : rx.flags + 'u'); uniCache.set(rx, r); } return r; };
const mset = (a) => a.slice().sort();
const uniq = (a) => [...new Set(a)];
const nrm = (x) => String(parseFloat(x));

function blank(text, rx, fn) {   // run fn on each match of rx and cut the match out of the text (replace by a space), so the next reader does not count its digits again
  return text.replace(rx, (...m) => { const groups = m.slice(0, -2); fn(...groups, m[m.length - 2]); return ' '; });
}
const monthRx = (lang) => {   // a regular expression (source) that finds a month word, in groups by index 1..12: use monthOf()
  if (lang === 'en') return EN_MONTH_RX;
  return '(?<![' + L + '])(' + MONTHS[lang].map((m) => '(?:' + m + ')').join('|') + ')\\.?(?![' + L + '])';
};
const monthOf = (lang, word) => {
  if (lang === 'en') return enMonthNo(word);
  const w = word.replace(/\.$/, '');
  for (let i = 0; i < 12; i++) if (new RegExp('^(?:' + MONTHS[lang][i] + ')$', 'iu').test(w)) return i + 1;
  return 0;
};

/** Money: every $ amount, as numbers. */
function readMoney(text, f) {
  text = blank(text, /(?:US\s?)?\$\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:US\s?)?\$|(\d[\d,]*(?:[.,]\d+)?)\s?(?:美元|美金|USD|dólares|dólar|đô la|đô|डॉलर)/gi, (m, a, b, c) => f.money.push(nrm((a || b || c).replace(/,(?=\d{3}\b)/g, '').replace(',', '.'))));
  return text;
}
/** Percent. */
function readPercent(text, f) {
  return blank(text, /(\d+(?:[.,]\d+)?)\s?%|(\d+(?:[.,]\d+)?)\s?(?:percent|por ciento|प्रतिशत|百分之|phần trăm)|百分之\s?(\d+)/gi, (m, a, b, c) => f.percent.push(nrm((a || b || c).replace(',', '.'))));
}

/** E-mail, phone, web address, @handle, #tag, placeholder: cut out of the text. */
function readContact(text, f) {
  text = blank(text, /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => f.contact.push('mail:' + m.toLowerCase()));
  text = blank(text, /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|org|net|us|co|io)\b(?:\/[^\s"'<>)]*)?/gi, (m) => f.contact.push('web:' + m.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')));
  text = blank(text, /(?<![\d])\(?(\d{3})\)?[-. ](\d{3})[-. ](\d{4})(?!\d)/g, (m, a, b, c) => f.contact.push('tel:' + a + b + c));
  text = blank(text, /(?<![\w])([#@])([A-Za-z]\w+)/g, (m, a, b) => f.contact.push(a + b.toLowerCase()));
  text = blank(text, /\{[A-Za-z]+\}/g, (m) => f.contact.push('slot:' + m));
  return text;
}

/** Dates: month and day. */
function readDates(text, f, lang) {
  const push = (mo, d) => { if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) f.date.push(mo + '/' + d); };
  if (lang === 'en') {
    text = blank(text, new RegExp(EN_MONTH_RX + '\\s+(\\d{1,2})(?!\\d)(?:\\s*(?:–|-|&|and|to|through)\\s*(?:' + EN_MONTH_RX.replace(/\\b\\\.\?$/, '') + '\\s+)?(\\d{1,2})(?!\\d))?', 'g'), (m, mo, d, mo2, d2) => { push(enMonthNo(mo), +d); if (d2) push(mo2 ? enMonthNo(mo2) : enMonthNo(mo), +d2); });
    text = blank(text, /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g, (m, a, b) => push(+a, +b));
  } else if (lang === 'zh') {
    text = blank(text, /(\d{1,2})\s*月\s*(\d{1,2})(?:\s*[日号]|(?=\s*(?:–|-|至|到|和|与|及|、|&)\s*\d{1,2}\s*[日号]))(?:\s*(?:–|-|至|到|和|与|及|、|&)\s*(?:(\d{1,2})\s*月\s*)?(\d{1,2})\s*[日号]?)?/g, (m, mo, d, mo2, d2) => { push(+mo, +d); if (d2) push(mo2 ? +mo2 : +mo, +d2); });
    text = blank(text, /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g, (m, a, b) => push(+a, +b));
  } else if (lang === 'vi') {
    text = blank(text, /(?:ngày\s*)?(?<![\d–-])(?<!(?:tháng|thg)\s*)(\d{1,2})\s*(?:–|-|đến|tới|và)?\s*(\d{1,2})?\s*(?:tháng|thg)\s*(\d{1,2})(?!\d)(?:\s*(?:–|-|đến|tới|và)\s*(?:ngày\s*)?(\d{1,2})\s*(?:(?:tháng|thg)\s*(\d{1,2}))?)?/gi, (m, d, d2, mo, d3, mo2) => { push(+mo, +d); if (d2) push(+mo, +d2); if (d3) push(mo2 ? +mo2 : +mo, +d3); });
    text = blank(text, /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g, (m, a, b) => { +a > 12 || +b <= 12 ? push(+b, +a) : push(+a, +b); });   // 29/9 and 6/10 are day / month; 9/29 is month / day
  } else {   // es, hi: "3 de nov", "23–25 de oct", "30 de oct al 8 de nov" (es); "3 नवंबर", "23–25 अक्टूबर" (hi)
    const mr = monthRx(lang);
    const de = lang === 'es' ? '(?:\\s*de\\s*|\\s+)' : '\\s*';
    text = blank(text, new RegExp('(?<![\\d/])(\\d{1,2})(?:\\s*(?:–|-|y|al|e|और|से|तक)\\s*(\\d{1,2}))?' + de + mr + '(?:\\s*(?:–|-|al|से|तक)\\s*(\\d{1,2})' + de + mr + ')?', 'giu'), (m, d, d2, w, d3, w2) => { const mo = monthOf(lang, w); push(mo, +d); if (d2) push(mo, +d2); if (d3 && w2) push(monthOf(lang, w2), +d3); });
    text = blank(text, /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g, (m, a, b) => { +a > 12 || +b <= 12 ? push(+b, +a) : push(+a, +b); });
  }
  return text;
}

/** Months named on their own, with early / mid / late. */
const QUAL = {
  en: { early: /\bearly\b/i, mid: /\bmid\b-?/i, late: /\blate\b/i },
  es: { early: /principios|comienzos|inicios|primeros d[ií]as/i, mid: /mediados/i, late: /finales|fines|últimos d[ií]as|fin de|final de/i },
  hi: { early: /शुरुआत|शुरूआत|आरंभ|प्रारंभ|आरम्भ|शुरुआती/, mid: /मध्य|बीच/, late: /अंत|अंतिम|आख़िर|आखिर|आख़िरी|आखिरी|देर/ },
  zh: { early: /上旬|(?<=月)初/, mid: /中旬|(?<=月)中(?=下旬)|(?<=月)中(?![\u4e00-\u9fff])/, late: /下旬|(?<=月)[底末]/ },
  vi: { early: /\bđầu\b/i, mid: /\bgiữa\b/i, late: /\bcuối\b/i },
};
function readMonths(text, f, lang) {
  const tokens = [];   // {at, end, kind: 'M'|'Q', v}
  const pushM = (m, v) => tokens.push({ at: m.index, end: m.index + m[0].length, kind: 'M', v });
  if (lang === 'en') for (const m of text.matchAll(new RegExp('(?<![\\w])' + EN_MONTH_RX, 'g'))) pushM(m, enMonthNo(m[1]));
  else if (lang === 'zh') for (const m of text.matchAll(/(?:(\d{1,2})\s*[–-]\s*)?(\d{1,2})\s*月/g)) { pushM(m, +m[2]); if (m[1]) pushM(m, +m[1]); }
  else if (lang === 'vi') for (const m of text.matchAll(/(?:tháng|thg)\s*(\d{1,2})(?:\s*[–-]\s*(\d{1,2})(?!\d|\s*(?:tháng|thg)))?(?!\d)/gi)) { pushM(m, +m[1]); if (m[2]) pushM(m, +m[2]); }
  else for (const m of text.matchAll(new RegExp(monthRx(lang), 'giu'))) pushM(m, monthOf(lang, m[1]));
  for (const t of tokens) f.month.push(t.v);
  // early / mid / late: attach to the month it stands next to (before the month in English, Spanish, Vietnamese; after it in Chinese; Hindi: either)
  const q = QUAL[lang];
  for (const [name, rx0] of Object.entries(q)) { const rx = uni(rx0, lang); for (const m of text.matchAll(new RegExp(rx.source, rx.flags.replace(/[gu]/g, '') + 'gu'))) tokens.push({ at: m.index, end: m.index + m[0].length, kind: 'Q', v: name }); }
  tokens.sort((a, b) => a.at - b.at);
  const glue = /^[\s,.\-–()]*(?:to|through|thru|and|or|a|al|y|e|o|hasta|de|del|के|की|का|से|तक|और|या|में|đến|tới|và|hoặc|至|到|及|或|与|和)?[\s,.\-–()]*(?:(?:of|de|del)\s*)?$/iu;
  const attached = new Map();   // month token -> set of qualifiers
  const take = (mTok, qTok) => { if (!attached.has(mTok)) attached.set(mTok, new Set()); attached.get(mTok).add(qTok.v); qTok.used = true; };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]; if (t.kind !== 'M') continue;
    const before = lang !== 'zh';   // qualifiers before the month
    if (before) {   // walk back over qualifiers
      let j = i - 1, edge = t.at;
      while (j >= 0 && tokens[j].kind === 'Q' && glue.test(text.slice(tokens[j].end, edge)) && edge - tokens[j].end <= 14) { if (!tokens[j].used) take(t, tokens[j]); edge = tokens[j].at; j--; }
    }
    if (!before || lang === 'hi') {   // walk forward over qualifiers
      let j = i + 1, edge = t.end;
      while (j < tokens.length && tokens[j].kind === 'Q' && glue.test(text.slice(edge, tokens[j].at)) && tokens[j].at - edge <= 14) { if (!tokens[j].used) take(t, tokens[j]); edge = tokens[j].end; j++; }
    }
  }
  for (const [mTok, set] of attached) f.qual.push(mTok.v + ':' + [...set].sort().join('+'));
  return text;
}

/** Days of the week; a range written out is a set of days. */
function readDays(text, f, lang) {
  const found = [];   // {at, end, d}
  if (lang === 'en') for (const m of text.matchAll(new RegExp('(?<![\\w])' + EN_DAY_RX, 'g'))) found.push({ at: m.index, end: m.index + m[0].length, d: enDayNo(m[1]) });
  else if (lang === 'zh') for (const m of text.matchAll(/(?:周|週|星期)([日一二三四五六天])/g)) found.push({ at: m.index, end: m.index + m[0].length, d: m[1] === '天' ? 0 : ZH_DAY.indexOf(m[1]) });
  else for (let d = 0; d < 7; d++) for (const m of text.matchAll(new RegExp('(?<![' + L + '])(?<!bên )(?:' + DAYS[lang][d] + ')\\.?(?![' + L + '\\d])', 'giu'))) found.push({ at: m.index, end: m.index + m[0].length, d });
  found.sort((a, b) => a.at - b.at);
  const RANGE = /^[\s]*(?:–|-|to|through|thru|until|a|al|hasta|से|तक|至|到|đến|tới)[\s]*$/i;
  const set = new Set();
  for (let i = 0; i < found.length; i++) {
    set.add(found[i].d);
    if (i + 1 < found.length) {
      const gap = text.slice(found[i].end, found[i + 1].at).replace(/\s*(?:de|के|से|từ)\s*$/i, '');
      let between = text.slice(found[i].end, found[i + 1].at).trim();
      if (RANGE.test(between) || (/^(?:से|तक)$/.test(between)) || (lang === 'es' && /^(?:a|al|hasta|a los|a la)$/i.test(between))) { for (let d = found[i].d; ; d = (d + 1) % 7) { set.add(d); if (d === found[i + 1].d) break; } }
    }
  }
  f.days = [...set].sort((a, b) => a - b);
  let cut = text; for (const t of found.slice().sort((a, b) => b.at - a.at)) cut = cut.slice(0, t.at) + ' '.repeat(t.end - t.at) + cut.slice(t.end);
  return cut;   // the same text without the names of the days (their words are numbers in some languages: Thứ Sáu = Friday = "six")
}

/** Clock times, as minutes after midnight (or after noon, when am / pm is not written). */
const PERIOD = {   // words that say am / pm / noon / night, before the hour (hi zh) or after it (es vi)
  hi: { am: /^(?:सुबह|सवेरे|तड़के|प्रातः|भोर)/, noon: /^(?:दोपहर)/, pm: /^(?:शाम|सायं)/, night: /^(?:रात|देर रात)/ },
  zh: { am: /^(?:凌晨|清晨|早上|早晨|上午)/, noon: /^(?:中午)/, pm: /^(?:下午|傍晚|晚上)/, night: /^(?:夜里|夜间|半夜)/ },
};
const PERIOD_AFTER = {
  es: { am: /^\s*(?:de la mañana|de la madrugada|a\.?\s?m\.?)/i, noon: /^\s*(?:del mediodía|de la mañana del mediodía)/i, pm: /^\s*(?:de la tarde|de la noche|p\.?\s?m\.?)/i, night: /^\s*(?:de la madrugada)/i },
  vi: { am: /^\s*(?:giờ\s*)?(?:sáng|SA\b)/i, noon: /^\s*(?:giờ\s*)?trưa/i, pm: /^\s*(?:giờ\s*)?(?:chiều|tối|CH\b)/i, night: /^\s*(?:giờ\s*)?đêm/i },
};
function to24(h, kind) {
  if (kind === 'am') return h === 12 ? 0 : h;
  if (kind === 'pm') return h < 12 ? h + 12 : h;
  if (kind === 'noon') return h === 12 ? 12 : h <= 5 ? h + 12 : h;
  if (kind === 'night') return h === 12 ? 0 : h <= 5 ? h : h < 12 ? h + 12 : h;
  return null;
}
function readTimes(text, f, lang) {
  const toks = [];   // {at, end, h, m, kind ('am','pm','noon','night','24', or null)}
  const add = (m, h, min, kind) => {   // a time that overlaps one already found is the same time: the one that says am / pm wins
    if (h < 0 || h > 24 || min < 0 || min > 59) return;
    const at = m.index, end = m.index + m[0].length, ov = toks.findIndex((t) => t.at < end && at < t.end);
    if (ov >= 0) { if (toks[ov].kind || !kind) return; toks.splice(ov, 1); }
    toks.push({ at, end, h, m: min || 0, kind });
  };
  // Latin am / pm, in every language
  const latin = /(?<![\d:])(\d{1,2})(?::(\d{2}))?\s*(a|p)\.?\s?m\b\.?/gi;
  for (const m of text.matchAll(latin)) add(m, +m[1], +m[2] || 0, m[3].toLowerCase() === 'a' ? 'am' : 'pm');
  // "from 10 to 4" (en), "de 10 a 4" (es): two bare hours, the morning and the afternoon
  if (lang === 'en' || lang === 'es') {
    const rx = lang === 'en' ? /\bfrom (\d{1,2})(?::(\d{2}))? (?:to|until|till) (\d{1,2})(?::(\d{2}))?(?!\d)(?!\s*(?:[ap]\.?m|:|days?|hours?|minutes?|years?|people|persons?|guests?|students?|adults?|children|inches|miles))/gi
      : /(?<![\p{L}])de (\d{1,2})(?::(\d{2}))? a (?:las )?(\d{1,2})(?::(\d{2}))?(?!\d)(?!\s*(?:[ap]\.?\s?m|:|de la|del|años?|d[ií]as?|horas?|minutos?|semanas?|personas?|adultos?|niños|estudiantes|invitados|libras|pulgadas|millas))/giu;
    for (const m of text.matchAll(rx)) {
      if (toks.some((t) => m.index < t.end && t.at < m.index + m[0].length)) continue;
      const first = m.index + m[0].indexOf(m[1]), last = m.index + m[0].length - m[3].length - (m[4] ? m[4].length + 1 : 0);
      add({ index: first, 0: m[1] + (m[2] ? ':' + m[2] : '') }, +m[1], +m[2] || 0, null); add({ index: last, 0: m[3] + (m[4] ? ':' + m[4] : '') }, +m[3], +m[4] || 0, null);
    }
  }
  // a clock written with a colon and no am / pm: 24-hour or bare
  for (const m of text.matchAll(/(?<![\d:/.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!\s*(?:a|p)\.?\s?m\b)/gi)) { if (toks.some((t) => m.index >= t.at && m.index < t.end)) continue; add(m, +m[1], +m[2], +m[1] >= 13 || m[1][0] === '0' ? '24' : null); }
  if (lang === 'hi' || lang === 'zh') {
    const kinds = PERIOD[lang];
    const rx = lang === 'hi' ? /(सुबह|सवेरे|तड़के|प्रातः|भोर|दोपहर|शाम|सायं|देर रात|रात)\s*(\d{1,2})(?::(\d{2}))?(?:\s*बजे)?/g : /(凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|夜间|半夜)\s*(\d{1,2})\s*(?:[:：]\s*(\d{2})|点\s*(\d{1,2})?\s*分?|时|時)?/g;
    for (const m of text.matchAll(rx)) { if (toks.some((t) => m.index >= t.at && m.index < t.end)) continue; const kind = Object.keys(kinds).find((k) => kinds[k].test(m[1])); add(m, +m[2], +(m[3] || m[4] || 0), kind); }
    if (lang === 'zh') for (const m of text.matchAll(/(?<![\d:])(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分?|半|整)?/g)) { if (toks.some((t) => m.index >= t.at && m.index < t.end)) continue; add(m, +m[1], m[0].includes('半') ? 30 : +m[2] || 0, null); }
    if (lang === 'hi') for (const m of text.matchAll(/(?<![\d:])(\d{1,2})(?::(\d{2}))?\s*बजे/g)) { if (toks.some((t) => m.index >= t.at && m.index < t.end)) continue; add(m, +m[1], +m[2] || 0, null); }
  }
  if (lang === 'es' || lang === 'vi') {
    const kinds = PERIOD_AFTER[lang];
    const rx = lang === 'es' ? /(?<![\d:])(\d{1,2})(?::(\d{2}))?(?=\s*(?:de la (?:mañana|tarde|noche|madrugada)|del mediodía))/gi : /(?<![\d:])(\d{1,2})(?:\s*giờ|\s*h|:)\s*(\d{1,2})?\s*(?:phút)?(?=\s*(?:sáng|chiều|tối|trưa|đêm|SA\b|CH\b))/gi;
    for (const m of text.matchAll(rx)) { if (toks.some((t) => m.index >= t.at && m.index < t.end)) continue; const rest = text.slice(m.index + m[0].length); const kind = Object.keys(kinds).find((k) => kinds[k].test(rest)); const t2 = rest.match(/^\s*(?:de la \p{L}+|del mediodía|(?:giờ\s*)?\p{L}+)/iu); add({ index: m.index, 0: m[0] + (t2 ? t2[0] : '') }, +m[1], +(m[2] || 0), kind); }
  }
  // "10 to 4", "4 to 8 pm": a bare number next to a time that has an am / pm joins it (the same period, or the one before / after it for a range that crosses noon)
  if (lang === 'en' || lang === 'es' || lang === 'vi' || lang === 'hi' || lang === 'zh') {
    const RNG = lang === 'en' ? /^\s*(?:–|-|to|through|until|till)\s*$/i : lang === 'es' ? /^\s*(?:–|-|a|al|hasta|y)\s*(?:las\s*)?$/i : lang === 'hi' ? /^\s*(?:–|-|से|तक)\s*$/ : lang === 'zh' ? /^\s*(?:–|-|至|到|~)\s*$/ : /^\s*(?:–|-|đến|tới|hoặc)\s*$/i;
    // bare number before a time: "4 to 8 pm" (en), "de 4 a 8 p. m." (es), "4 đến 8 giờ tối" (vi), "शाम 4 से रात 8 बजे" has periods already
    for (const t of toks.slice()) {
      const prev = text.slice(0, t.at);
      const b = prev.match(lang === 'en' ? /(\d{1,2})(?::(\d{2}))?(\s*(?:–|-|to|through|until|till)\s*)$/i : lang === 'es' ? /(\d{1,2})(?::(\d{2}))?(\s*(?:–|-|a|al|hasta|y)\s*(?:las\s*)?)$/i : lang === 'vi' ? /(\d{1,2})(?:\s*(?:giờ|h)\s*)?(\s*(?:–|-|đến|tới|hoặc)\s*(?:ngày\s*)?)$/i : lang === 'hi' ? /(\d{1,2})(?::(\d{2}))?(\s*(?:–|-|से)\s*)$/ : /(\d{1,2})(?:\s*点)?(\s*(?:–|-|至|到|~)\s*)$/);
      if (b && !toks.some((o) => o !== t && o.at <= prev.length - b[0].length && o.end > prev.length - b[0].length)) {
        const at = prev.length - b[0].length;
        if (/\d\s*$/.test(prev.slice(0, at)) && lang === 'en') continue;
        if (/(?:Oct|Nov|Sep|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug)[a-z]*\.?\s*$/.test(prev.slice(0, at)) && lang === 'en') continue;   // "Oct 30–Nov 8" is a date
        const h = +b[1], mi = lang === 'hi' || lang === 'en' || lang === 'es' ? +b[2] || 0 : 0;
        let kind = t.kind;
        toks.push({ at, end: at + b[1].length, h, m: mi, kind: kind === '24' ? '24' : kind, borrowed: true });
      }
    }
    // bare number after a time: "10 am to 4", "4 点至 8 点"
    for (const t of toks.slice()) {
      const rest = text.slice(t.end);
      const a = !(lang === 'en' || lang === 'zh' || lang === 'hi') ? null : rest.match(lang === 'en' ? /^(\s*(?:–|-|to|through|until|till)\s*)(\d{1,2})(?::(\d{2}))?(?!\d)(?!\s*(?:[ap]\.?m|:|\/|days?|hours?|minutes?|years?|people|persons?|guests?|students?|inches|miles|%))/i : lang === 'zh' ? /^(\s*(?:–|-|至|到|~)\s*)(\d{1,2})(?:\s*点|[:：](\d{2}))(?!\s*(?:分钟|小时))/ : lang === 'hi' ? /^(\s*(?:–|-|से|तक)\s*)(\d{1,2})(?::(\d{2}))?\s*बजे/ : null);
      if (a && !toks.some((o) => o.at === t.end + a[1].length)) toks.push({ at: t.end + a[1].length, end: t.end + a[0].length, h: +a[2], m: +a[3] || 0, kind: null, borrowed: true, after: t });
    }
  }
  toks.sort((a, b) => a.at - b.at);
  // fill in missing periods from the neighbour of the same range
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    let kind = t.kind;
    if (kind === null) {
      const nb = toks[i + 1] && toks[i + 1].kind && toks[i + 1].kind !== '24' && toks[i + 1].at - t.end < 14 ? toks[i + 1] : toks[i - 1] && toks[i - 1].kind && toks[i - 1].at !== undefined && t.at - toks[i - 1].end < 14 ? toks[i - 1] : null;
      if (nb) kind = nb.kind === 'noon' || nb.kind === 'night' ? 'pm' : nb.kind;
    }
    let min = null, mod12 = null;
    if (kind === '24') min = t.h * 60 + t.m;
    else if (kind) { const h24 = to24(t.h, kind); if (h24 !== null) min = h24 * 60 + t.m; }
    if (min === null) mod12 = (t.h % 12) * 60 + t.m;
    out.push({ min, mod12 });
  }
  // a range whose first time is after its second ("10 to 4 pm" read as 10 pm to 4 pm): the first is the morning
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i], b = out[i + 1];
    if (a.min !== null && b.min !== null && a.min > b.min && toks[i + 1].at - toks[i].end < 8 && a.min - 720 >= 0 && toks[i].borrowed) a.min -= 720;
    if (a.min !== null && b.min !== null && b.min < a.min && toks[i + 1].borrowed && toks[i + 1].at - toks[i].end < 8) b.min += 720;
  }
  for (const o of out) f.time.push(o);
  // cut the times out of the text so their digits are not read again as numbers
  let cut = text; for (const t of toks.slice().sort((a, b) => b.at - a.at)) cut = cut.slice(0, t.at) + ' '.repeat(Math.max(1, t.end - t.at)) + cut.slice(t.end);
  return cut;
}

/** Number words and digits. */
function readNumbers(text, f, lang) {
  let s = text.replace(/(?<=\d)[,\u202f.](?=\d{3}(?!\d))/g, '').replace(/(?<=\d),(?=\d{1,2}(?!\d))/g, '.');
  // a decimal point that ends a sentence is not a decimal: "2.5" stays, "ages 3. Fri" does not occur because a space follows
  const numbers = [];   // {at, end, v}
  for (const m of s.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w])/g)) numbers.push({ at: m.index, end: m.index + m[0].length, v: nrm(m[1]) });
  for (const m of s.matchAll(/(?<=\d)(?=\p{L})/gu)) void m;   // letters glued to digits (5pm) are not numbers handled here
  const words = NUMBER_WORDS[lang];
  if (words) {
    const keys = Object.keys(words).sort((a, b) => b.length - a.length);
    const VI_NEXT = '';
    const rx = new RegExp(lang === 'en' ? '(?<![\\w-])(' + keys.join('|') + ')(?![\\w])' : '(?<![' + L + '])(' + keys.join('|') + ')(?![' + L + '])' + VI_NEXT, 'giu');
    for (const m of s.matchAll(rx)) { if (lang === 'vi' && /^(?:hai|ba)$/i.test(m[1]) && (/cả $/i.test(s.slice(0, m.index)) || /^\s*mẹ/.test(s.slice(m.index + m[0].length)))) continue; if (lang === 'vi' && /^chín$/i.test(m[1]) && !/^\s*(?:người|tuổi|ngày|giờ|phút|tuần|loại|cái|chiếc|lần|đô|học sinh|khách|trẻ|em)/.test(s.slice(m.index + m[0].length))) continue; numbers.push({ at: m.index, end: m.index + m[0].length, v: String(words[m[1].toLowerCase()]), word: true }); }
  }
  if (lang === 'vi') for (const m of s.matchAll(/(?<![\p{L}\p{M}])năm(?=\s+(?:người|tuổi|ngày|phút|loại|cái|chiếc|lần|học sinh|khách|trẻ|em|đô|món|tuần))/gu)) numbers.push({ at: m.index, end: m.index + m[0].length, v: '5', word: true });
  if (lang === 'hi') for (const m of s.matchAll(/(दूसरा|तीसरा|चौथा)\s*कदम/g)) numbers.push({ at: m.index, end: m.index + m[0].length, v: String({ 'दूसरा': 2, 'तीसरा': 3, 'चौथा': 4 }[m[1]]), word: true });
  if (lang === 'zh') {
    for (const m of s.matchAll(/十(?=多年|余年)/g)) numbers.push({ at: m.index, end: m.index + m[0].length, v: '10', word: true });
    for (const m of s.matchAll(new RegExp('(二十|三十|四十|五十|十二|十一|一百|[二两三四五六七八九十])(?=' + ZH_MEASURE + ')', 'g'))) numbers.push({ at: m.index, end: m.index + m[0].length, v: String(ZH_NUM[m[1]]), word: true });
    for (const m of s.matchAll(/(?<![\p{L}])([二两三四五六七八九十]+)(?![\p{L}])/gu)) if (ZH_NUM[m[1]] && !numbers.some((n) => n.at === m.index)) numbers.push({ at: m.index, end: m.index + m[0].length, v: String(ZH_NUM[m[1]]), word: true });
    for (const m of s.matchAll(/第([一二三四五六七八九十])/g)) void m;
  }
  numbers.sort((a, b) => a.at - b.at);
  return numbers;
}

const readCache = new Map();
/** One text, read: every fact it holds, by kind. */
export function read(raw, lang) {
  const key = lang + '\u0000' + raw; let f = readCache.get(key);
  if (!f) { f = readText(raw, lang); readCache.set(key, f); }
  return f;
}
function readText(raw, lang) {
  const f = { money: [], percent: [], contact: [], date: [], month: [], qual: [], days: [], time: [], numbers: [], pairs: [], per: [], words: [], words1: [], bound: [], names: [], hrefs: [], slots: [] };
  let text = plain(raw);
  // links inside the text
  for (const m of String(raw).matchAll(/href\s*=\s*"([^"]*)"/gi)) f.hrefs.push(decode(m[1]).replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, '').toLowerCase());
  text = readContact(text, f);
  text = text.replace(/Dirty Dozen/gi, ' ');
  text = readDays(text, f, lang);
  { const idx0 = lang === 'en' ? 0 : LANGS.indexOf(lang) + 1; text = text.replace(new RegExp(uni(WORDS_ONE_WAY.third[idx0], lang).source, 'giu'), ' '); }   // one-third, 三分之一, một phần ba
  text = readMoney(text, f);
  text = readPercent(text, f);
  text = readDates(text, f, lang);
  text = readTimes(text, f, lang);
  if (lang === 'zh') text = text.replace(/(?:\d{1,2}\s*[–-]\s*)?\d{1,2}\s*月/g, ' '); if (lang === 'vi') text = text.replace(/(?:tháng|thg)\s*\d{1,2}(?:\s*[–-]\s*\d{1,2}(?!\d|\s*(?:tháng|thg)))?(?!\d)/gi, ' ');   // a month written as a number is a month, not a number
  readMonths(plain(raw), f, lang);   // months and their early / mid / late are read on the whole text (a date also names a month)
  // what a price is for
  const whole = plain(raw);
  if (lang === 'en') for (const m of whole.matchAll(PER_EN)) { const k = (m[1] || m[2] || m[3] || m[4]).toLowerCase(); f.per.push(PER_ALIAS[k] || k); }
  else for (const [k, rxs] of Object.entries(PER)) { const rx = uni(rxs[LANGS.indexOf(lang) + 1], lang); const n = (whole.match(new RegExp(rx.source, rx.flags.replace('g', '') + 'g')) || []).length; for (let i = 0; i < Math.min(n, 1); i++) f.per.push(k); }
  f.per = uniq(f.per).sort();
  // words
  const idx = lang === 'en' ? 0 : LANGS.indexOf(lang) + 1;
  for (const [k, rxs] of Object.entries(WORDS)) if (uni(rxs[idx], lang).test(whole) || (lang !== 'en' && rxs[0].test(whole))) f.words.push(k);   // a quoted English phrase (the words printed on a photo) counts as the word
  for (const [k, rxs] of Object.entries(WORDS_ONE_WAY)) if (uni(rxs[idx], lang).test(whole) || (lang !== 'en' && k !== 'negation' && rxs[0].test(whole))) f.words1.push(k);
  // numbers
  const nums = readNumbers(text, f, lang);
  f.numbers = uniq(nums.map((n) => n.v)).sort((a, b) => a - b);
  // a number and the unit it counts
  for (const [u, rxs] of Object.entries(UNITS)) {
    const rx = uni(rxs[idx], lang); for (const m of text.matchAll(new RegExp(rx.source, rx.flags.replace('g', '') + 'g'))) {
      const before = nums.filter((n) => n.end <= m.index && m.index - n.end <= 4 + (lang === 'es' ? 1 : 0)), after = nums.filter((n) => n.at >= m.index + m[0].length && n.at - (m.index + m[0].length) <= 3);
      // the number before it, and the first number of a range ("30–45 minutes")
      const near = before.length ? before.slice(-1) : after.slice(0, 1);
      for (const n of near) { f.pairs.push(n.v + ' ' + u); const i = nums.indexOf(n); if (i > 0 && nums[i - 1].end <= n.at && n.at - nums[i - 1].end <= 3 && /^[\s–-]+$|^\s*(?:to|a|y|至|到|và|đến|tới|से)\s*$/i.test(text.slice(nums[i - 1].end, n.at))) f.pairs.push(nums[i - 1].v + ' ' + u); }
    }
  }
  f.pairs = uniq(f.pairs).sort();
  // up / down: "ages 3 and up", "minimum 100", "up to 50", "2 and younger"
  const UP = [/(\d+)\s*(?:\+|and (?:up|older|over|above)|or (?:older|more|over)|plus)(?![\w])|\b(?:more than|over)\s*(?:of\s*)?(\d+)|\b(?:minimum|at least)\b[^.\d]{0,90}?(\d+)/i,
    /(\d+)\s*(?:\+|años? en adelante|años? o más|años? y más|años? y mayores|años? o mayores|en adelante|o más|y más|y mayores|o mayores)|(?:a partir de(?: los| las)?|desde(?: los| las)?|mayores? de|más de)\s*(\d+)|(?:mínimo|al menos|como mínimo)\b[^.\d]{0,90}?(\d+)/i,
    /(\d+)\s*(?:\+|(?:साल\s*)?(?:और|या)\s*(?:उससे\s*)?(?:ऊपर|बड़े|बड़ों|बड़ी|ज़्यादा|अधिक)|से\s*(?:ऊपर|अधिक|ज़्यादा|बड़े|बड़ों))|(?:से अधिक|से ज़्यादा|से ऊपर)\s*(\d+)|(?:कम से कम|न्यूनतम)[^।.\d]{0,90}?(\d+)/,
    /(\d+)\s*[位个人名岁]*\s*(?:\+|及以上|以上|或以上|起)|(?:超过|多于|满)\s*(\d+)|(?:至少|最少|不少于|最低)[^。.\d]{0,12}?(\d+)/,
    /(\d+)\s*(?:tuổi\s*)?(?:\+|trở lên|trở đi|hoặc hơn)|(?:trên|hơn)\s*(\d+)|(?:ít nhất|tối thiểu)[^.\d]{0,90}?(\d+)/i];
  const DOWN = [/(\d+)\s*(?:and|or) (?:under|younger|below|less|fewer|smaller)|(?:up to|under|no more than|fewer than|less than|below)\s*(\d+)|\b(?:maximum|at most)\b[^.\d]{0,90}?(\d+)/i,
    /(\d+)\s*(?:años? o menos|años? y menos|años? y menores|años? o menores|o menos|y menos|y menores|o menores)|(?:hasta(?: los| las)?|menos de|menores de|menor de|no más de|por debajo de)\s*(\d+)|(?:máximo|como máximo)\b[^.\d]{0,90}?(\d+)/i,
    /(\d+)\s*(?:साल\s*)?(?:और|या)\s*(?:उससे\s*)?(?:कम|छोटे|छोटों|छोटी|नीचे)|(?:(?<!कम )से कम|से छोटे|से नीचे)\s*(\d+)|(?:अधिकतम|ज़्यादा से ज़्यादा)[^।.\d]{0,90}?(\d+)/,
    /(\d+)\s*[位个人名岁]*\s*(?:及以下|以下|或以下|以内)|(?:少于|低于|不到)\s*(\d+)|(?:最多|至多|不超过|上限)[^。.\d]{0,12}?(\d+)/,
    /(\d+)\s*(?:tuổi\s*)?(?:trở xuống|hoặc ít hơn)|(?:dưới)\s*(\d+)|(?:tối đa|không quá|lên đến|nhiều nhất)[^.\d]{0,90}?(\d+)/i];
  const upRx = UP[idx], downRx = DOWN[idx];
  for (const [dir, rx] of [['up', upRx], ['down', downRx]]) for (const m of text.matchAll(new RegExp(rx.source, rx.flags.replace('g', '') + 'g'))) { const n = m.slice(1).find((x) => x !== undefined); if (n && +n <= 500) f.bound.push(n + ' ' + dir); }
  f.bound = uniq(f.bound).sort();
  // names: the ones the English text has, found as the farm writes them (in a translation also in the usual local spelling listed in NAMES)
  for (const [en, forms] of NAMES) {
    const local = lang === 'en' ? null : forms instanceof RegExp ? forms : forms && forms[lang] ? forms[lang] : null;
    if (nameRx(en).test(whole) || (local && local.test(whole))) f.names.push(en);
  }
  return f;
}
const nameRx = (en) => new RegExp('(?<![\\w])' + en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (NAME_PREFIX.has(en) ? '' : '(?![\\w])'));

/* ------------------------------------------------------------------ comparing */
const setDiff = (a, b) => ({ missing: a.filter((x) => !b.includes(x)), extra: b.filter((x) => !a.includes(x)) });
const clock = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const showTime = (t) => (t.min !== null ? clock(t.min) : clock(t.mod12) + '?');
const sameTime = (a, b) => (a.min !== null && b.min !== null ? a.min === b.min : (a.min ?? a.mod12) % 720 === (b.min ?? b.mod12) % 720);
const listOf = (a) => (a.length ? a.join(' ') : '-');

/** The differences between an English text and its translation: [{kind, msg}]. */
export function compare(en, tr, lang) {
  const a = read(en, 'en'), b = read(tr, lang), out = [], flag = (kind, msg) => out.push({ kind, msg });
  if (a.money.slice().sort().join() !== b.money.slice().sort().join()) flag('price', `prices ${listOf(a.money)} in the English, ${listOf(b.money)} in the translation`);
  if (a.money.length + b.money.length > 0 && !a.per.includes('each') && a.per.join() !== b.per.join()) flag('price', `a price is for "${listOf(a.per)}" in the English and for "${listOf(b.per)}" in the translation (per person / child / student / pound / stem / party)`);
  if (a.percent.slice().sort().join() !== b.percent.slice().sort().join()) flag('percent', `percentages ${listOf(a.percent)} vs ${listOf(b.percent)}`);
  let d = setDiff(uniq(a.contact), uniq(b.contact)); if (d.missing.length || d.extra.length) flag('contact', `e-mail / phone / web address / handle / tag: ${d.missing.length ? 'not in the translation: ' + d.missing.join(' ') : ''}${d.extra.length ? ' only in the translation: ' + d.extra.join(' ') : ''}`.replace(/^(.*?): {2}/, '$1: '));
  d = setDiff(uniq(a.hrefs), uniq(b.hrefs)); if (d.missing.length || d.extra.length) flag('contact', `links inside the text: ${d.missing.length ? 'not in the translation: ' + d.missing.join(' ') : ''} ${d.extra.length ? 'only in the translation: ' + d.extra.join(' ') : ''}`.trim());
  d = setDiff(uniq(a.date).sort(), uniq(b.date).sort()); if (d.missing.length || d.extra.length) flag('date', `dates (month/day) ${listOf(uniq(a.date))} vs ${listOf(uniq(b.date))}`);
  d = setDiff(uniq(a.month.map(String)).sort(), uniq(b.month.map(String)).sort()); if (d.missing.length || d.extra.length) flag('month', `months ${listOf(uniq(a.month).sort((x, y) => x - y).map((m) => MONTH_EN[m - 1]?.slice(0, 3)))} vs ${listOf(uniq(b.month).sort((x, y) => x - y).map((m) => MONTH_EN[m - 1]?.slice(0, 3)))}`);
  if (a.qual.slice().sort().join() !== b.qual.slice().sort().join()) flag('early/mid/late', `${listOf(a.qual.map((q) => q.replace(/^(\d+):/, (m, n) => MONTH_EN[n - 1].slice(0, 3) + ' ')))} vs ${listOf(b.qual.map((q) => q.replace(/^(\d+):/, (m, n) => MONTH_EN[n - 1].slice(0, 3) + ' ')))} (an early / mid / late of a month, in the English and in the translation)`);
  if (a.days.join() !== b.days.join()) flag('days', `days of the week ${listOf(a.days.map((x) => DAY_EN[x].slice(0, 3)))} vs ${listOf(b.days.map((x) => DAY_EN[x].slice(0, 3)))}`);
  // times: in order, each English time needs a translated time
  {
    const left = b.time.slice(), missing = [];
    for (const t of a.time) { const i = left.findIndex((x) => sameTime(t, x)); if (i >= 0) left.splice(i, 1); else missing.push(t); }
    if (missing.length || left.length) flag('time', `times ${listOf(a.time.map(showTime))} vs ${listOf(b.time.map(showTime))} ("?" = am or pm is not written)`);
  }
  d = setDiff(a.numbers, b.numbers); if (d.missing.length || d.extra.length) flag('numbers', `numbers: ${d.missing.length ? d.missing.join(', ') + ' not in the translation' : ''}${d.missing.length && d.extra.length ? '; ' : ''}${d.extra.length ? d.extra.join(', ') + ' not in the English' : ''}`);
  { const keep = (x) => !/^(?:19|20)\d\d year$/.test(x); d = setDiff(a.pairs.filter(keep), b.pairs.filter(keep)); if (d.missing.length) flag('units', `a number and what it counts: "${d.missing.join('", "')}" in the English; the translation has ${listOf(b.pairs)}`); }
  d = setDiff(a.bound, b.bound); if (d.missing.length || d.extra.length) flag('bound', `"and up" / "and under" / "minimum" / "up to": English ${listOf(a.bound)}, translation ${listOf(b.bound)}`);
  d = setDiff(a.words, b.words); if (d.missing.length || d.extra.length) flag('words', `${d.missing.length ? 'the English has ' + d.missing.join(', ') + ' and the translation does not' : ''}${d.missing.length && d.extra.length ? '; ' : ''}${d.extra.length ? 'the translation has ' + d.extra.join(', ') + ' and the English does not' : ''}`);
  { const miss = a.words1.filter((x) => !b.words1.includes(x)); if (miss.length) flag('words', `the English has ${miss.join(', ')} and the translation does not`); }
  d = setDiff(a.names, b.names); if (d.missing.length) flag('name', `${d.missing.join(', ')} is not in the translation as the farm writes it`);
  return out;
}

/* ------------------------------------------------------------------ the whole site */
const readJson = (f, root) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
/** Everything translated: [{id, en, tr: {es, hi, zh, vi}}]. ui texts have an id (tXXXXXXXX); a text written by JavaScript has the English words as its id ("js:..."). */
export function load(root = ROOT) {
  const EN = readJson('lang/en.json', root), src = Object.fromEntries(LANGS.map((l) => [l, readJson(`lang/src/${l}.json`, root)]));
  const items = [];
  for (const [id, en] of Object.entries(EN)) items.push({ id, en, tr: Object.fromEntries(LANGS.map((l) => [l, src[l].ui[id]])) });
  for (const en of Object.keys(src.es.js)) items.push({ id: 'js:' + en, en, tr: Object.fromEntries(LANGS.map((l) => [l, src[l].js[en]])) });
  return items;
}
export function loadAllow(root = ROOT) { try { return readJson('tools/i18n_facts_allow.json', root).filter((x) => x && x.id); } catch (e) { return []; } }

/** Every difference in every translation: [{lang, id, kind, msg, en, tr}]. Entries of the allow list are marked allowed (with the reason); allow entries that matched nothing are returned as stale. */
export function audit({ root = ROOT, langs = LANGS, items = null, allow = null } = {}) {
  items = items || load(root); allow = allow || loadAllow(root);
  const flags = [], used = new Set();
  for (const it of items) for (const lang of langs) {
    const tr = it.tr[lang]; if (tr === undefined || tr === null) continue;
    for (const d of compare(it.en, tr, lang)) {
      const i = allow.findIndex((a) => (a.lang === lang || a.lang === '*') && a.kind === d.kind && (it.id.startsWith('js:') ? it.id.startsWith(a.id) : a.id === it.id));
      if (i >= 0) used.add(i);
      flags.push({ lang, id: it.id, kind: d.kind, msg: d.msg, en: plain(it.en), tr: plain(tr), allowed: i >= 0 ? allow[i].reason : null });
    }
  }
  const stale = allow.filter((a, i) => !used.has(i));
  return { flags, stale, checked: items.length };
}

/* ------------------------------------------------------------------ command line */
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), arg = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
  const langs = arg('lang') ? arg('lang').split(',') : LANGS, kind = arg('kind'), all = args.includes('--all'), show = arg('show');
  const items = load();
  if (show) {
    const it = items.find((x) => x.id === show || x.id === 'js:' + show);
    if (!it) { console.log('no such text: ' + show); process.exit(1); }
    const dump = (t, l) => console.log(`${l.padEnd(3)} ${plain(t).slice(0, 200)}\n    ` + JSON.stringify(read(t, l), (k, v) => (Array.isArray(v) && !v.length ? undefined : v)));
    dump(it.en, 'en'); for (const l of langs) if (it.tr[l] != null) dump(it.tr[l], l);
    process.exit(0);
  }
  const { flags, stale, checked } = audit({ items });
  const shown = flags.filter((x) => langs.includes(x.lang) && (!kind || x.kind === kind) && (all || !x.allowed));
  const byLang = {}; for (const x of shown) (byLang[x.lang] ||= []).push(x);
  for (const [l, list] of Object.entries(byLang)) {
    console.log(`\n== ${l}: ${list.length} difference(s)`);
    for (const x of list) console.log(`  [${x.kind}] ${x.id.slice(0, 40)}  ${x.msg}${x.allowed ? '   (allowed: ' + x.allowed + ')' : ''}\n      EN ${x.en.slice(0, 150)}\n      ${l.toUpperCase()} ${x.tr.slice(0, 150)}`);
  }
  console.log(`\n${checked} texts x ${langs.length} languages read; ${shown.length} difference(s) shown${all ? '' : ' (allowed ones hidden)'}; ${stale.length} stale allow entr${stale.length === 1 ? 'y' : 'ies'}`);
  for (const s of stale) console.log('  stale: ' + JSON.stringify(s));
}
