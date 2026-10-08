import { calculateTransitPlanets, validateBirthDetails } from './vedic-chart.mjs';

const RASHIS = Object.freeze([
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
  'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)',
]);
const RULERS = Object.freeze(['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter']);
const JUPITER_ASPECTS = [0, 4, 6, 8];
const SATURN_ASPECTS = [0, 2, 6, 9];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validSignIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < 12;
}

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

// February 29 birthdays fall on March 1 for completed-age calculations in
// non-leap years. Counting birthdays avoids rounding a fractional year.
function birthdayInYear(birthDate, year) {
  const month = Number(birthDate.slice(5, 7));
  const day = Number(birthDate.slice(8, 10));
  return month === 2 && day === 29 && !isLeapYear(year)
    ? Date.UTC(year, 2, 1) : Date.UTC(year, month - 1, day);
}

function completedAge(birthDate, value) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const age = year - Number(birthDate.slice(0, 4));
  const civilDay = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  return age - (civilDay < birthdayInYear(birthDate, year) ? 1 : 0);
}

function calendarHorizon(asOf, years) {
  const end = new Date(asOf);
  const targetYear = end.getUTCFullYear() + years;
  // setUTCFullYear rolls February 29 into March. Clamp the horizon to the last
  // day of February so adding calendar years does not add an extra day.
  if (end.getUTCMonth() === 1 && end.getUTCDate() === 29 && !isLeapYear(targetYear)) {
    end.setUTCDate(28);
  }
  end.setUTCFullYear(targetYear);
  return end.getTime();
}

function interval(period, label) {
  const start = typeof period?.start === 'string' ? Date.parse(period.start) : NaN;
  const end = typeof period?.end === 'string' ? Date.parse(period.end) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || typeof period?.lord !== 'string') {
    throw badRequest(`A valid ${label} timeline from the calculated birth chart is required.`);
  }
  return { start, end };
}

function dashaSupport(mahaLord, antarLord, seventhLord) {
  const reasons = [];
  let points = 0;
  if (antarLord === seventhLord) {
    points += 4;
    reasons.push(`${seventhLord}, the seventh-house ruler, is the antardasha lord.`);
  }
  if (mahaLord === seventhLord) {
    points += 3;
    reasons.push(`${seventhLord}, the seventh-house ruler, is the mahadasha lord.`);
  }
  if (antarLord === 'Venus' && seventhLord !== 'Venus') {
    points += 2;
    reasons.push('Venus, a traditional marriage significator, is the antardasha lord.');
  }
  if (mahaLord === 'Venus' && seventhLord !== 'Venus') {
    points += 1;
    reasons.push('Venus, a traditional marriage significator, is the mahadasha lord.');
  }
  return { points, reasons };
}

function supportFromTransit(planet, aspectOffsets, targets, label) {
  if (!planet || !validSignIndex(planet.signIndex)) {
    throw new Error(`The ephemeris did not supply a valid ${label} transit sign.`);
  }
  const supported = [...targets].filter(([signIndex]) => aspectOffsets.includes((signIndex - planet.signIndex + 12) % 12));
  return {
    count: supported.length,
    reasons: supported.map(([signIndex, roles]) => `${label} in ${RASHIS[planet.signIndex]} ${signIndex === planet.signIndex ? 'occupies' : 'traditionally aspects'} ${RASHIS[signIndex]}, the natal sign of ${roles.join(' and ')}.`),
  };
}

function addTarget(targets, signIndex, role) {
  targets.set(signIndex, [...(targets.get(signIndex) || []), role]);
}

/**
 * Estimate traditional marriage windows from D1 positions, Vimshottari periods,
 * and future ephemeris samples. The rules rank windows; they do not measure
 * probability or establish that an event will happen.
 * Tests can replace transitProvider; the app uses the ephemeris.
 */
export function estimateMarriageWindows(profile, chart, {
  asOf = new Date(), horizonYears = 10, transitProvider = calculateTransitPlanets,
} = {}) {
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) throw badRequest('The marriage timing date must be valid.');
  if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 30) throw badRequest('The marriage timing horizon must be 1–30 calendar years.');
  const details = validateBirthDetails(profile, { today: asOf });
  if (!details) throw badRequest('Marriage timing requires birth date, accurate birth time, birth place, coordinates, and the historical time zone.');
  const ascendant = chart?.ascendant?.longitude;
  if (!Number.isFinite(ascendant) || ascendant < 0 || ascendant >= 360 || !Array.isArray(chart?.planets) || !Array.isArray(chart?.dasha?.periods)) {
    throw badRequest('Marriage timing requires a calculated Vedic birth chart and Vimshottari timeline.');
  }
  if (typeof transitProvider !== 'function') throw new TypeError('The transit provider must be a function.');
  const horizonEnd = calendarHorizon(asOf, horizonYears);
  if (asOf.getUTCFullYear() < 1900 || new Date(horizonEnd).getUTCFullYear() > 2100) {
    throw badRequest('Marriage transit calculations support dates between 1900 and 2100. Choose a shorter horizon.');
  }
  // Use the sign index calculated before rounding, so a displayed longitude
  // near a rashi boundary cannot change the house ruler.
  const ascendantSign = validSignIndex(chart.ascendant.signIndex)
    ? chart.ascendant.signIndex : Math.floor(ascendant / 30);
  const seventhSign = (ascendantSign + 6) % 12;
  const seventhLord = RULERS[seventhSign];
  const seventhLordPlanet = chart.planets.find((planet) => planet.name === seventhLord);
  const venus = chart.planets.find((planet) => planet.name === 'Venus');
  if (!validSignIndex(seventhLordPlanet?.signIndex) || !validSignIndex(venus?.signIndex)) {
    throw badRequest('The calculated chart must include Venus and the seventh-house ruler.');
  }
  const targets = new Map();
  addTarget(targets, seventhSign, 'the seventh house');
  addTarget(targets, seventhLordPlanet.signIndex, `its ruler ${seventhLord}`);
  if (seventhLord !== 'Venus') addTarget(targets, venus.signIndex, 'Venus');
  const adultStart = birthdayInYear(profile.birthDate, Number(profile.birthDate.slice(0, 4)) + 18);
  const earliest = Math.max(asOf.getTime(), adultStart);
  const candidates = [];

  for (const maha of chart.dasha.periods) {
    const mahaInterval = interval(maha, 'mahadasha');
    if (mahaInterval.end <= earliest || mahaInterval.start >= horizonEnd) continue;
    if (!Array.isArray(maha.antardashas)) throw badRequest('The calculated Vimshottari timeline must include antardashas.');
    for (const antar of maha.antardashas) {
      const antarInterval = interval(antar, 'antardasha');
      const support = dashaSupport(maha.lord, antar.lord, seventhLord);
      if (!support.points) continue;
      const start = Math.max(earliest, mahaInterval.start, antarInterval.start);
      const end = Math.min(horizonEnd, mahaInterval.end, antarInterval.end);
      if (end <= start) continue;
      let cursor = start;
      let current = null;
      while (cursor < end) {
        const cursorDate = new Date(cursor);
        const nextMonth = Date.UTC(cursorDate.getUTCFullYear(), cursorDate.getUTCMonth() + 1, 1);
        const segmentEnd = Math.min(end, nextMonth);
        // Sample the midpoint of the month/dasha overlap to keep the transit
        // inside the qualifying period and requested future horizon.
        const sample = new Date(cursor + Math.floor((segmentEnd - cursor) / 2));
        const planets = transitProvider(sample, ascendantSign);
        if (!Array.isArray(planets)) throw new Error('The ephemeris did not supply transit positions.');
        const jupiter = supportFromTransit(planets.find((planet) => planet.name === 'Jupiter'), JUPITER_ASPECTS, targets, 'Jupiter');
        const saturn = supportFromTransit(planets.find((planet) => planet.name === 'Saturn'), SATURN_ASPECTS, targets, 'Saturn');
        if (jupiter.count) {
          if (!current) {
            current = {
              start: cursor, end: segmentEnd, dashaPoints: support.points,
              jupiterTotal: 0, saturnTotal: 0, duration: 0,
              reasons: new Set([`Vimshottari period: ${maha.lord} mahadasha / ${antar.lord} antardasha.`, ...support.reasons]),
            };
          }
          const duration = segmentEnd - cursor;
          current.end = segmentEnd;
          current.duration += duration;
          current.jupiterTotal += duration * jupiter.count;
          current.saturnTotal += duration * saturn.count;
          [...jupiter.reasons, ...saturn.reasons].forEach((reason) => current.reasons.add(reason));
        } else if (current) {
          candidates.push(current);
          current = null;
        }
        cursor = segmentEnd;
      }
      if (current) candidates.push(current);
    }
  }

  candidates.sort((a, b) => b.dashaPoints - a.dashaPoints
    || b.jupiterTotal / b.duration - a.jupiterTotal / a.duration
    || b.saturnTotal / b.duration - a.saturnTotal / a.duration
    || a.start - b.start);
  const windows = candidates.slice(0, 3).map((candidate) => ({
    start: dateOnly(candidate.start),
    // Periods are half-open. A midnight cutoff belongs to the next period,
    // so use the last included millisecond for the displayed inclusive end day.
    end: dateOnly(candidate.end - 1),
    ageRange: { min: completedAge(profile.birthDate, candidate.start), max: completedAge(profile.birthDate, candidate.end - 1) },
    reasons: [...candidate.reasons],
    supportFactors: {
      dashaWeight: candidate.dashaPoints,
      jupiterTargetAverage: candidate.jupiterTotal / candidate.duration,
      saturnTargetAverage: candidate.saturnTotal / candidate.duration,
    },
  }));
  return {
    topic: 'marriage', status: windows.length ? 'estimated' : 'no-window',
    asOf: dateOnly(asOf), horizonEnd: dateOnly(horizonEnd),
    seventhHouse: { rashi: RASHIS[seventhSign], lord: seventhLord }, windows,
    method: [
      'D1 whole-sign seventh house, its traditional ruler, and Venus, using the chart’s approximate Lahiri sidereal positions.',
      'Qualifying Vimshottari mahadasha/antardasha: either lord is the seventh-house ruler or Venus; the actual period boundaries are preserved.',
      'Monthly future Jupiter sign sampling requires occupation or traditional 5th, 7th, or 9th aspect to the seventh-house sign, its ruler’s sign, or Venus’s sign.',
      'Saturn occupation or traditional 3rd, 7th, or 10th aspect adds corroboration; Saturn alone cannot create a window.',
      'Dasha ranking adds 4 for the seventh-house ruler as antardasha lord, 3 as mahadasha lord, 2 for Venus as antardasha lord, and 1 as mahadasha lord. Venus receives no separate significator points when it is the seventh-house ruler; simultaneous support is combined.',
      'Jupiter and Saturn comparisons use duration-weighted mean counts of distinct occupied or aspected natal target signs. A sign shared by several natal roles counts once.',
      'At most three windows, ranked by seventh-ruler/Venus dasha support, then Jupiter target support, then Saturn corroboration; earlier windows break ties. The ranking is not a probability.',
      'Completed calendar ages; February 29 birthdays use March 1 in non-leap years. Ages below 18 are excluded.',
    ],
    limitations: [...new Set([
      'These are traditional astrological estimates, not scientifically validated predictions or a promise of marriage. Marriage may occur outside these windows or not occur.',
      'Transit boundaries are approximate because positions are sampled monthly; these are periods to interpret, not exact event dates.',
      'This limited heuristic does not evaluate Navamsha, planetary strength, yogas, afflictions, or birth-time rectification.',
      'A missing window means this method found no qualifying interval in the selected horizon; it does not mean marriage is impossible.',
      ...(Array.isArray(chart.limits) ? chart.limits : []),
      ...(Array.isArray(chart.calculation?.warnings) ? chart.calculation.warnings : []),
    ])],
  };
}
