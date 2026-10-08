import PDFDocument from 'pdfkit';
import { openSync } from 'fontkit';
import { fileURLToPath } from 'node:url';
import { validateProfile } from './astrology.mjs';
import { calculateVedicChart } from './vedic-chart.mjs';
import { calculateBirthPanchanga } from './birth-panchanga.mjs';
import { estimateMarriageWindows } from './vedic-timing.mjs';
import { estimateCareerWindows, describeDifficultPeriods } from './vedic-forecast.mjs';
import { analyzeLifeArea } from './vedic-life.mjs';
import { attachPredictionSupport } from './prediction-support.mjs';

const TOPICS = [
  ['marriage', 'Marriage timing'], ['married-life', 'Married life and relationships'],
  ['career', 'Career and employment'], ['difficult-periods', 'Difficult periods'],
  ['general', 'General life outlook'], ['education', 'Education and learning'],
  ['finances', 'Finances and resources'], ['family', 'Family and home'],
  ['travel', 'Travel and relocation'], ['wellbeing', 'Wellbeing and routines'],
];
const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const SIGN_RULERS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
const GRAHA_LABELS = { Sun: 'Su', Moon: 'Mo', Mercury: 'Me', Venus: 'Ve', Mars: 'Ma', Jupiter: 'Ju', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' };
// South Indian charts keep signs fixed; these positions are not house numbers.
export const SOUTH_INDIAN_SIGN_CELLS = Object.freeze([[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]].map(Object.freeze));
const FONT_NAMES = ['NotoSans-Regular', 'NotoSansDevanagari-Regular', 'NotoSansTelugu-Regular', 'NotoSansTamil-Regular', 'NotoSansKannada-Regular', 'NotoSansMalayalam-Regular', 'NotoSansBengali-Regular', 'NotoSansGujarati-Regular', 'NotoSansGurmukhi-Regular', 'NotoSansOriya-Regular', 'NotoSansSinhala-Regular', 'NotoSansThai-Regular', 'NotoSansArabic-Regular', 'NotoSansHebrew-Regular'];
const fontPath = name => fileURLToPath(new URL(`./fonts/${name}.ttf`, import.meta.url));
const fontCache = new Map();
const COLORS = { ink: '#15233b', muted: '#566379', gold: '#ac833a', line: '#ddd8cd', cream: '#fcfaf5', pale: '#f1ede4' };
const LEFT = 43;
const WIDTH = 509;
const TOP = 67;
const BOTTOM = 770;

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function reportFilename(name) {
  const stem = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'birth-chart';
  return `Astral-${stem}-English-horoscope.pdf`;
}

export function buildHoroscopeReportModel(input, { asOf = new Date() } = {}) {
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) throw badRequest('The report date must be valid.');
  const profile = validateProfile(input, { today: asOf });
  const chart = calculateVedicChart(profile, { asOf });
  if (!chart) throw badRequest('Add your recorded birth time, birth place, coordinates, and historical time zone to download a personal horoscope.');
  const panchanga = calculateBirthPanchanga(profile, chart);
  const predictions = TOPICS.map(([topic, title]) => {
    const options = { asOf };
    const calculation = topic === 'marriage' ? estimateMarriageWindows(profile, chart, options)
      : topic === 'career' ? estimateCareerWindows(profile, chart, options)
        : topic === 'difficult-periods' ? describeDifficultPeriods(profile, chart, options)
          : analyzeLifeArea(profile, chart, topic, options);
    return { title, ...attachPredictionSupport(calculation) };
  });
  return {
    profile, asOf: asOf.toISOString(), chart, panchanga, predictions,
    filename: reportFilename(profile.name),
    sharedLimits: [...new Set([...chart.limits, ...chart.calculation.warnings, ...panchanga.notes, ...panchanga.boundaryWarnings])],
  };
}

function degrees(value) {
  return `${Number(value).toFixed(4)}°`;
}
function withinSign(value) {
  return degrees((value % 30 + 30) % 30);
}
function utcBoundary(value) {
  return new Date(value).toISOString().replace('T', ' ').replace(/Z$/, ' UTC');
}
function periodLabel(period) {
  return period ? `${period.lord}: ${utcBoundary(period.start)} to ${utcBoundary(period.end)} (end exclusive)` : 'No current period in the returned timeline';
}

function fontFor(character) {
  const code = character.codePointAt(0);
  for (const name of FONT_NAMES) {
    let font = fontCache.get(name);
    if (!font) {
      font = openSync(fontPath(name));
      fontCache.set(name, font);
    }
    if (font.hasGlyphForCodePoint(code)) return name;
  }
  return null;
}

export function reportTextRuns(value) {
  const runs = [];
  let unsupported = false;
  for (const character of String(value).normalize('NFC')) {
    const font = fontFor(character);
    const name = font || FONT_NAMES[0];
    const text = font ? character : `[U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}]`;
    if (!font) unsupported = true;
    const previous = runs.at(-1);
    if (previous?.font === name) previous.text += text;
    else runs.push({ font: name, text });
  }
  return { runs, unsupported };
}

export function renderHoroscopeReport(model) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', pdfVersion: '1.4', margins: { top: TOP, bottom: 72, left: LEFT, right: LEFT }, bufferPages: true,
      info: { Title: 'Astral — English Vedic Horoscope', Author: 'Sree Charan Reddy Kailasam', Subject: 'Calculated birth chart, Panchanga, Vimshottari periods and traditional life-area interpretations', CreationDate: new Date(model.asOf), ModDate: new Date(model.asOf) },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.registerFont('regular', fontPath('NotoSans-Regular'));
    doc.registerFont('bold', fontPath('NotoSans-Bold'));
    for (const font of FONT_NAMES.slice(1)) doc.registerFont(font, fontPath(font));
    doc.registerFont(FONT_NAMES[0], fontPath(FONT_NAMES[0]));
    let y = TOP;

    function pageChrome() {
      doc.save().rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.cream).restore();
      doc.font('bold').fontSize(12).fillColor(COLORS.ink).text('ASTRAL', LEFT, 23, { lineBreak: false });
      doc.font('regular').fontSize(8).fillColor(COLORS.muted).text('ENGLISH VEDIC HOROSCOPE', LEFT + 83, 28, { lineBreak: false });
      doc.moveTo(LEFT, 48).lineTo(LEFT + WIDTH, 48).lineWidth(0.7).strokeColor(COLORS.gold).stroke();
      y = TOP;
    }
    doc.on('pageAdded', pageChrome);
    pageChrome();

    function newPage() { doc.addPage(); }
    function ensure(height) {
      if (y + height > BOTTOM) newPage();
    }
    function text(value, { size = 9, bold = false, color = COLORS.ink, gap = 6, indent = 0 } = {}) {
      doc.font(bold ? 'bold' : 'regular').fontSize(size);
      const options = { width: WIDTH - indent, lineGap: 2 };
      const height = doc.heightOfString(String(value), options);
      ensure(height + gap);
      doc.fillColor(color).text(String(value), LEFT + indent, y, options);
      y += height + gap;
    }
    function heading(title, { page = false } = {}) {
      if (page && y !== TOP) newPage();
      ensure(54);
      text(title, { size: 20, bold: true, gap: 13 });
    }
    function subheading(title) {
      ensure(45);
      text(title, { size: 11, bold: true, gap: 7 });
    }
    function list(values, { color = COLORS.ink } = {}) {
      for (const value of values || []) text(`• ${value}`, { color, indent: 3 });
    }
    function identity(label, value) {
      const content = `${label}: ${value}`;
      const { runs, unsupported } = reportTextRuns(content);
      // Birth names can use an Indian script even though the report is English.
      doc.font('regular').fontSize(9);
      const estimate = Math.max(18, Math.ceil(content.length / 66) * 16);
      ensure(estimate + (unsupported ? 30 : 0));
      // Keep the original character order when copying text from shaped names.
      doc.markContent('Span', { actual: content.normalize('NFC') });
      for (let index = 0; index < runs.length; index++) {
        const run = runs[index];
        const options = { width: WIDTH, continued: index < runs.length - 1, lineGap: 2 };
        doc.font(run.font).fontSize(9).fillColor(COLORS.ink);
        if (index === 0) doc.text(run.text, LEFT, y, options);
        else doc.text(run.text, options);
      }
      doc.endMarkedContent();
      y = doc.y + 8;
      if (unsupported) text('Characters unavailable in the bundled fonts are shown above as U+ Unicode code points.', { size: 8, color: COLORS.muted });
    }
    function table(headers, rows, widths, { size = 8.2 } = {}) {
      function header() {
        ensure(27);
        doc.save().rect(LEFT, y - 2, WIDTH, 23).fill(COLORS.pale).restore();
        let x = LEFT + 5;
        for (let index = 0; index < headers.length; index++) {
          doc.font('bold').fontSize(size).fillColor(COLORS.ink).text(headers[index], x, y + 3, { width: widths[index] - 10, lineBreak: false });
          x += widths[index];
        }
        y += 26;
      }
      header();
      for (const row of rows) {
        doc.font('regular').fontSize(size);
        const height = Math.max(22, ...row.map((cell, index) => doc.heightOfString(String(cell), { width: widths[index] - 10, lineGap: 1 }) + 9));
        if (y + height > BOTTOM) { newPage(); header(); }
        let x = LEFT + 5;
        for (let index = 0; index < row.length; index++) {
          doc.font('regular').fontSize(size).fillColor(COLORS.ink).text(String(row[index]), x, y + 2, { width: widths[index] - 10, lineGap: 1 });
          x += widths[index];
        }
        y += height;
        doc.moveTo(LEFT, y - 2).lineTo(LEFT + WIDTH, y - 2).lineWidth(0.35).strokeColor(COLORS.line).stroke();
      }
      y += 11;
    }
    function planetRows(planets) {
      return planets.map(planet => [planet.name, SIGN_NAMES[planet.signIndex], degrees(planet.longitude), degrees(planet.degreeInSign), planet.house, planet.retrograde ? 'Retrograde' : 'Direct']);
    }
    function southIndianChart(part, x, top, title) {
      const cell = 52;
      const size = cell * 4;
      doc.font('bold').fontSize(11).fillColor(COLORS.ink).text(title, x, top - 23, { width: size, align: 'center' });
      for (let sign = 0; sign < 12; sign++) {
        const [column, row] = SOUTH_INDIAN_SIGN_CELLS[sign];
        const left = x + column * cell;
        const at = top + row * cell;
        doc.rect(left, at, cell, cell).lineWidth(0.75).strokeColor(COLORS.gold).stroke();
        doc.font('regular').fontSize(7).fillColor(COLORS.muted).text(SIGN_NAMES[sign], left + 4, at + 4, { width: cell - 8, align: 'center' });
        const occupants = part.planets.filter(planet => planet.signIndex === sign).map(planet => `${GRAHA_LABELS[planet.name]}${planet.retrograde ? '*' : ''}`);
        if (part.ascendant.signIndex === sign) occupants.unshift('Asc');
        const labels = occupants.join('  ');
        let fontSize = 9;
        while (fontSize > 6 && doc.font('bold').fontSize(fontSize).heightOfString(labels, { width: cell - 8, lineGap: 1 }) > 30) fontSize -= 0.5;
        doc.font('bold').fontSize(fontSize).fillColor(COLORS.ink).text(labels, left + 4, at + 20, { width: cell - 8, align: 'center', lineGap: 1 });
      }
      doc.font('bold').fontSize(13).fillColor(COLORS.ink).text(title.startsWith('D1') ? 'RASHI' : 'NAVAMSA', x + cell + 2, top + cell + 28, { width: cell * 2 - 4, align: 'center' });
      doc.font('regular').fontSize(8).fillColor(COLORS.muted).text(`Ascendant\n${SIGN_NAMES[part.ascendant.signIndex]}`, x + cell + 2, top + cell + 51, { width: cell * 2 - 4, align: 'center', lineGap: 3 });
    }

    const { profile, chart, panchanga } = model;
    heading('Your English horoscope');
    text('A personal birth record with calculated chart positions and traditional period interpretations.', { size: 10, color: COLORS.muted, gap: 15 });
    identity('Name', profile.name);
    text(`Birth date: ${profile.birthDate}  •  Recorded local time: ${profile.birthTime}`);
    identity('Birth place', profile.birthPlace);
    text(`Historical time zone: ${profile.timeZone}`);
    text(`Coordinates: ${profile.latitude.toFixed(6)}° latitude, ${profile.longitude.toFixed(6)}° longitude`);
    text(`Birth instant: ${panchanga.birthInstantUtc}  •  Report as of: ${model.asOf}`, { size: 8, color: COLORS.muted, gap: 16 });
    subheading('Birth star, Moon sign and rising sign');
    table(['Birth factor', 'Calculated value'], [
      ['Nakshatra (birth star)', `${chart.moon.nakshatra.name} — pada ${chart.moon.pada}; lord ${chart.moon.nakshatra.lord}`],
      ['Moon rashi', chart.moon.rashi],
      ['Lagna (D1 ascendant)', `${chart.ascendant.rashi}; ${withinSign(chart.ascendant.longitude)} within sign`],
      ['D9 ascendant', chart.navamsa.ascendant.rashi],
    ], [168, 341], { size: 9 });
    subheading('Approximate Panchanga at birth');
    table(['Birth factor', 'Calculated value'], [
      ['Local civil weekday', panchanga.civilWeekday.name],
      ['Tithi', `${panchanga.tithi.paksha} ${panchanga.tithi.name} (${panchanga.tithi.index}/30)`],
      ['Paksha', `${panchanga.tithi.paksha} — ${panchanga.tithi.phase}`],
      ['Yoga', `${panchanga.yoga.name} (${panchanga.yoga.index}/27)`],
      ['Karana', panchanga.karana.name],
      ['Sunrise / sunset', `${panchanga.sunrise?.localTime || 'Not present'} / ${panchanga.sunset?.localTime || 'Not present'} — local birth date`],
      ['Sun–Moon separation', degrees(panchanga.tithi.elongationDegrees)],
    ], [168, 341], { size: 9 });
    text('Panchanga values describe the birth instant. Weekday uses the local civil date; a sunrise-based traditional weekday can differ before sunrise. See the calculation notes for accuracy and omitted calendar fields.', { size: 8, color: COLORS.muted });

    heading('D1 and D9 birth charts', { page: true });
    text('South Indian layout: the twelve signs stay fixed. Asc marks the rising sign; houses count forward from that sign. Planet abbreviations use their actual sign placements.', { color: COLORS.muted, gap: 37 });
    ensure(225);
    southIndianChart(chart, LEFT, y, 'D1 · Birth Rashi');
    southIndianChart(chart.navamsa, LEFT + 301, y, 'D9 · Navamsa');
    y += 225;
    text('Asc: ascendant · Su: Sun · Mo: Moon · Me: Mercury · Ve: Venus · Ma: Mars · Ju: Jupiter · Sa: Saturn · Ra: Rahu · Ke: Ketu · *: natal retrograde', { size: 8, color: COLORS.muted, gap: 12 });
    subheading('The twelve D1 whole sign houses');
    table(['House', 'Fixed sign', 'Traditional ruler', 'Occupants'], Array.from({ length: 12 }, (_, index) => {
      const sign = (chart.ascendant.signIndex + index) % 12;
      return [index + 1, SIGN_NAMES[sign], SIGN_RULERS[sign], chart.planets.filter(planet => planet.house === index + 1).map(planet => planet.name).join(', ') || '—'];
    }), [42, 101, 126, 240]);

    heading('Planetary positions at birth', { page: true });
    text('Longitudes are sidereal degrees from 0° Aries. Degree in sign runs from 0° to below 30°. Rahu and Ketu use the mean-node model.', { color: COLORS.muted });
    subheading('D1 · Birth Rashi');
    table(['Graha', 'Sign', 'Longitude', 'In sign', 'House', 'Motion'], planetRows(chart.planets), [69, 93, 91, 77, 53, 126]);
    text(`D1 ascendant: ${chart.ascendant.rashi} · ${degrees(chart.ascendant.longitude)} longitude · ${withinSign(chart.ascendant.longitude)} within sign`);
    subheading('D9 · Navamsa');
    table(['Graha', 'Sign', 'D9 longitude', 'In sign', 'House', 'Natal motion'], planetRows(chart.navamsa.planets), [69, 93, 91, 77, 53, 126]);
    text(`D9 ascendant: ${chart.navamsa.ascendant.rashi} · ${degrees(chart.navamsa.ascendant.longitude)} divisional longitude`);
    text('D9 longitudes are mathematical divisional positions, not a second set of sky observations. The motion column preserves each planet’s natal D1 retrograde status.', { size: 8, color: COLORS.muted });

    heading('Vimshottari dasha timeline', { page: true });
    text(`Balance at birth: ${chart.dasha.birthBalance.lord} mahadasha — ${chart.dasha.birthBalance.years.toFixed(4)} years remaining.`, { bold: true });
    text(`Current mahadasha: ${periodLabel(chart.dasha.currentMahadasha)}`);
    text(`Current antardasha: ${periodLabel(chart.dasha.currentAntardasha)}`);
    text('All returned mahadashas and antardashas are included below (two 120-year cycles). A birth mahadasha can begin before birth; its full start is retained. Dates use UTC; every end is exclusive. One dasha year is 365.2425 days.', { color: COLORS.muted, gap: 12 });
    for (const [index, period] of chart.dasha.periods.entries()) {
      subheading(`${index + 1}. ${period.lord} mahadasha`);
      text(`${utcBoundary(period.start)} → ${utcBoundary(period.end)}${index === 0 ? ' · contains the birth instant' : ''}`, { size: 8, color: COLORS.muted });
      table(['Antardasha lord', 'Start (UTC)', 'End (UTC, exclusive)'], period.antardashas.map(antar => [antar.lord, utcBoundary(antar.start).replace(' UTC', ''), utcBoundary(antar.end).replace(' UTC', '')]), [109, 200, 200], { size: 8 });
    }

    heading('Current planetary transits', { page: true });
    text(`Calculated at ${chart.transits.asOf}. Transit houses are relative to your natal D1 ascendant, rather than a new transit ascendant.`, { color: COLORS.muted });
    table(['Graha', 'Sign', 'Longitude', 'In sign', 'House', 'Motion'], planetRows(chart.transits.planets), [69, 93, 91, 77, 53, 126]);
    text('Current transits show positions at the report instant. Future windows below use their own stated dasha and transit rules; they are interpretive periods rather than promised events.', { color: COLORS.muted });

    const shared = new Set(model.sharedLimits);
    for (const prediction of model.predictions) {
      heading(prediction.title, { page: true });
      text(`As of ${prediction.asOf} · Horizon through ${prediction.horizonEnd} · ${prediction.status === 'estimated' ? 'Conditional estimated windows' : prediction.status === 'no-window' ? 'No qualifying window found' : 'Traditional period themes'}`, { size: 8, color: COLORS.muted, gap: 12 });
      if (prediction.outlook) {
        subheading('What this means for you');
        text(prediction.outlook.summary);
        if (prediction.outlook.timing) {
          subheading(prediction.outlook.timing.label);
          text(prediction.outlook.timing.text);
        }
        subheading('What you can do');
        list(prediction.outlook.actions);
      }
      if (prediction.support) {
        text(prediction.support.label, { bold: true, color: COLORS.gold });
        text(prediction.support.explanation, { size: 8, color: COLORS.muted, gap: 10 });
      }
      if (prediction.topic === 'career') {
        const planning = prediction.planningDates;
        if (planning) {
          subheading('Individual application and interview planning dates');
          text('These selected traditional planning days use the birth star, Moon and lunar-day rules. They concern applications, preparation and networking; they do not predict when an offer will arrive.', { color: COLORS.muted });
          text(`Daily planning horizon: ${planning.horizon.start} to ${planning.horizon.end} (${planning.horizon.days} days) · Time zone: ${planning.horizon.timeZone} · Calculated as of ${planning.sampledAt}`, { size: 8, color: COLORS.muted });
          text('Each day is evaluated at 12:00 local time in the saved birth time zone. A noon sample is not an exact muhurta or a guarantee that the whole day is auspicious.', { size: 8, color: COLORS.muted });
          if (planning.dates.length) {
            table(['Date · DD-MM-YYYY', 'Weekday', 'Nakshatra', 'Tithi / paksha', 'Tara / Moon house'], planning.dates.map(date => [
              date.displayDate, date.weekday, date.nakshatra.name,
              `${date.tithi.paksha} ${date.tithi.name}`,
              `${date.tara.name} (count ${date.tara.countFromBirthStar}) / house ${date.moonRelativeHouse}`,
            ]), [102, 74, 108, 115, 110], { size: 8 });
            for (const date of planning.dates) {
              subheading(`${date.displayDate} · ${date.weekday}`);
              text(`Local sample: ${date.sampleLocal} · UTC: ${date.sampleUtc}`, { size: 8, color: COLORS.muted });
              list(date.reasons);
              if (date.warnings.length) list(date.warnings, { color: COLORS.muted });
            }
          } else {
            const statusNotes = {
              'no-dates': 'No sampled date passed all the stated planning rules in this horizon. This does not rule out useful opportunities or employment.',
              'under-age': 'Adult career planning dates are not supplied for a profile below the supported employment-planning age.',
              'uncertain-natal': 'The natal star or Moon sign is close to a calculation boundary; planning dates are withheld rather than guessed.',
            };
            text(statusNotes[planning.status] || 'No daily planning dates are available for this calculation.');
          }
          text(`Days evaluated: ${planning.evaluatedDays} · Qualifying samples: ${planning.qualifyingDays} · Boundary samples excluded: ${planning.excludedBoundaryDays}`, { size: 8, color: COLORS.muted });
          subheading('Daily planning method');
          list(planning.method, { color: COLORS.muted });
          subheading('Daily planning limits');
          list(planning.limits, { color: COLORS.muted });
        }
        if (Array.isArray(prediction.searchWindows)) {
          subheading('Near-term application and interview planning periods');
          text(`Search horizon through ${prediction.searchHorizonEnd}. These periods use a weaker weekly Mercury-transit planning rule, separate from combined career windows below. They are not job-offer dates.`, { color: COLORS.muted });
          if (!prediction.searchWindows.length) text('No search-planning interval qualified within this horizon. Keep following real openings; a missing interval does not establish an employment outcome.');
          for (const window of prediction.searchWindows) {
            subheading(`${window.start} to ${window.end}`);
            text(window.label, { size: 8, color: COLORS.muted });
            if (window.ageRange) text(`Completed age range: ${window.ageRange.min}–${window.ageRange.max} years.`);
            list(window.reasons);
          }
        }
      }
      if (prediction.seventhHouse) text(`Seventh house: ${prediction.seventhHouse.rashi}; traditional ruler: ${prediction.seventhHouse.lord}.`);
      if (prediction.currentPhase) text(`Current Saturn marker: ${prediction.currentPhase.name}. ${prediction.currentPhase.description}`);
      if (prediction.factors?.length) { subheading('Calculated factors'); list(prediction.factors); }
      if (prediction.themes?.length) { subheading('Themes to consider'); list(prediction.themes); }
      subheading('Periods and timing');
      if (!prediction.windows.length) text('No qualifying interval was returned within this horizon. This does not establish whether or when a life event will happen.');
      for (const [index, window] of prediction.windows.entries()) {
        subheading(`${index + 1}. ${window.label || 'Conditional window'} · ${window.start} to ${window.end}`);
        if (window.ageRange) text(`Completed age range: ${window.ageRange.min}–${window.ageRange.max} years.`);
        if (window.support) {
          text(window.support.label, { bold: true, color: COLORS.gold });
          text(window.support.explanation, { size: 8, color: COLORS.muted });
        }
        list(window.reasons);
        if (window.themes?.length) list(window.themes, { color: COLORS.muted });
      }
      subheading('How this was calculated');
      list(prediction.method, { color: COLORS.muted });
      subheading('Limits of this interpretation');
      list(prediction.limitations.filter(limit => !shared.has(limit)), { color: COLORS.muted });
      text('The shared calculation cautions in the final section also apply to this topic.', { size: 8, color: COLORS.muted });
    }

    heading('Calculation methods and cautions', { page: true });
    text(`System: ${chart.calculation.system} · Ayanamsha: ${chart.calculation.ayanamsha} (${degrees(chart.calculation.ayanamshaDegrees)}) · Ephemeris: ${chart.calculation.ephemeris} · Houses: ${chart.calculation.houses} · Nodes: ${chart.calculation.nodeType}`, { bold: true });
    text(panchanga.method, { color: COLORS.muted });
    text('This report is calculated from the recorded birth details on the server. It does not use an LLM to invent positions, dates, or predictions. It covers the calculations available in Astral; unavailable traditional fields are omitted. Exact event dates and outcomes cannot be established by astrology.', { gap: 12 });
    list(model.sharedLimits, { color: COLORS.muted });
    text('Your report is generated in memory and sent directly to your browser. It is not saved on the server. The downloaded file contains your birth details; share it only where you intend to.', { color: COLORS.muted, gap: 12 });

    const pages = doc.bufferedPageRange();
    for (let page = pages.start; page < pages.start + pages.count; page++) {
      doc.switchToPage(page);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.moveTo(LEFT, 792).lineTo(LEFT + WIDTH, 792).lineWidth(0.5).strokeColor(COLORS.line).stroke();
      doc.font('regular').fontSize(7).fillColor(COLORS.muted).text(`© ${new Date(model.asOf).getUTCFullYear()} Sree Charan Reddy Kailasam`, LEFT, 804, { lineBreak: false });
      doc.text(`Astral · ${page + 1} / ${pages.count}`, LEFT + WIDTH - 90, 804, { width: 90, align: 'right', lineBreak: false });
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
  });
}

export async function buildHoroscopeReport(profile, options) {
  const model = buildHoroscopeReportModel(profile, options);
  return { model, pdf: await renderHoroscopeReport(model) };
}
