import { calculateTransitPositions, validateBirthDetails } from './vedic-chart.mjs';
import { calculateCareerPlanningDates } from './career-planning-dates.mjs';

const RASHIS = Object.freeze([
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
  'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)',
]);
const RULERS = Object.freeze(['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter']);
const JUPITER_ASPECTS = [0, 4, 6, 8];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validSign(value) {
  return Number.isInteger(value) && value >= 0 && value < 12;
}

function ordinal(value) {
  const suffix = value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th';
  return `${value}${suffix}`;
}

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function leapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function birthday(birthDate, year) {
  const month = Number(birthDate.slice(5, 7));
  const day = Number(birthDate.slice(8, 10));
  return month === 2 && day === 29 && !leapYear(year)
    ? Date.UTC(year, 2, 1) : Date.UTC(year, month - 1, day);
}

function age(birthDate, value) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const civilDate = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  return year - Number(birthDate.slice(0, 4)) - (civilDate < birthday(birthDate, year) ? 1 : 0);
}

function horizon(asOf, horizonYears) {
  const end = new Date(asOf);
  const year = end.getUTCFullYear() + horizonYears;
  if (end.getUTCMonth() === 1 && end.getUTCDate() === 29 && !leapYear(year)) end.setUTCDate(28);
  end.setUTCFullYear(year);
  return end.getTime();
}

function nextCalendarMonth(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

function calendarMonthsAfter(value, count) {
  const date = new Date(value);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.getTime();
}

function readInterval(period, label) {
  const start = typeof period?.start === 'string' ? Date.parse(period.start) : NaN;
  const end = typeof period?.end === 'string' ? Date.parse(period.end) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || typeof period?.lord !== 'string' || !period.lord) {
    throw badRequest(`A valid calculated ${label} timeline is required.`);
  }
  return { start, end, lord: period.lord };
}

function readTimeline(chart) {
  const mahas = [];
  const antars = [];
  for (const source of chart.dasha.periods) {
    const maha = readInterval(source, 'mahadasha');
    mahas.push(maha);
    if (!Array.isArray(source.antardashas)) throw badRequest('The calculated Vimshottari timeline must include antardashas.');
    for (const sub of source.antardashas) {
      const antar = readInterval(sub, 'antardasha');
      const start = Math.max(antar.start, maha.start);
      const end = Math.min(antar.end, maha.end);
      if (end > start) antars.push({ ...antar, start, end, mahaLord: maha.lord });
    }
  }
  mahas.sort((a, b) => a.start - b.start);
  antars.sort((a, b) => a.start - b.start);
  return { mahas, antars };
}

function prepare(profile, chart, asOf, horizonYears, transitProvider) {
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) throw badRequest('The forecast date must be valid.');
  if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 30) throw badRequest('The forecast horizon must be 1–30 calendar years.');
  if (!validateBirthDetails(profile, { today: asOf })) {
    throw badRequest('Vedic forecasts require birth date, accurate birth time, birth place, coordinates, and the historical time zone.');
  }
  const longitude = chart?.ascendant?.longitude;
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360 || !Array.isArray(chart?.planets)
    || !Array.isArray(chart?.dasha?.periods) || !chart.dasha.periods.length) {
    throw badRequest('A calculated Vedic birth chart and Vimshottari timeline are required.');
  }
  const ascendantSign = validSign(chart.ascendant.signIndex) ? chart.ascendant.signIndex : Math.floor(longitude / 30);
  if (typeof transitProvider !== 'function') throw new TypeError('The transit provider must be a function.');
  const end = horizon(asOf, horizonYears);
  if (asOf.getUTCFullYear() < 1900 || new Date(end).getUTCFullYear() > 2100) {
    throw badRequest('Forecast transit calculations support dates between 1900 and 2100. Choose a shorter horizon.');
  }
  return { now: asOf.getTime(), end, ascendantSign, timeline: readTimeline(chart) };
}

function dashaFactors(timeline, now) {
  const factors = [];
  const maha = timeline.mahas.find((period) => period.start <= now && now < period.end);
  const antar = timeline.antars.find((period) => period.start <= now && now < period.end);
  if (maha) factors.push(`Current Vimshottari mahadasha: ${maha.lord}, from ${dateOnly(maha.start)} to ${dateOnly(maha.end - 1)}.`);
  if (antar) factors.push(`Current Vimshottari antardasha: ${antar.lord}, from ${dateOnly(antar.start)} to ${dateOnly(antar.end - 1)}.`);
  const next = timeline.antars.find((period) => period.start > now);
  if (next) factors.push(`Next calculated antardasha starts on ${dateOnly(next.start)}: ${next.lord} within ${next.mahaLord} mahadasha. This is a chart-period transition, not a promised change in circumstances.`);
  if (!maha || !antar) factors.push('The supplied calculated timeline has no complete current dasha segment; no missing period or transition is invented.');
  return factors;
}

function limits(chart, extra) {
  return [...new Set([
    ...extra,
    ...(Array.isArray(chart.limits) ? chart.limits : []),
    ...(Array.isArray(chart.calculation?.warnings) ? chart.calculation.warnings : []),
  ])];
}

function transitPlanet(transitProvider, sample, ascendantSign, name) {
  const positions = transitProvider === calculateTransitPositions
    ? transitProvider(new Date(sample), ascendantSign, [name])
    : transitProvider(new Date(sample), ascendantSign);
  const planet = Array.isArray(positions) ? positions.find((position) => position.name === name) : null;
  if (!validSign(planet?.signIndex)) throw new Error(`The ephemeris did not supply a valid ${name} transit sign.`);
  return planet;
}

function careerDashaSupport(maha, antar, tenthLord) {
  let points = 0;
  const reasons = [];
  if (antar === tenthLord) {
    points += 4;
    reasons.push(`${tenthLord}, the tenth-house ruler, is the antardasha lord.`);
  }
  if (maha === tenthLord) {
    points += 3;
    reasons.push(`${tenthLord}, the tenth-house ruler, is the mahadasha lord.`);
  }
  for (const significator of ['Mercury', 'Saturn']) {
    if (significator === tenthLord) continue;
    if (antar === significator) {
      points += 2;
      reasons.push(`${significator}, a traditional professional significator used by this method, is the antardasha lord.`);
    }
    if (maha === significator) {
      points += 1;
      reasons.push(`${significator}, a traditional professional significator used by this method, is the mahadasha lord.`);
    }
  }
  return { points, reasons };
}

function careerSearchWindows(profile, ascendantSign, start, end, transitProvider) {
  const candidates = [];
  const houseThemes = {
    6: 'workplace tasks, practical skills, and applications',
    10: 'professional responsibilities and interviews',
    11: 'networking, referrals, and professional goals',
  };
  let cursor = start;
  let current = null;
  while (cursor < end) {
    const segmentEnd = Math.min(end, cursor + 7 * 86_400_000);
    const sample = cursor + Math.floor((segmentEnd - cursor) / 2);
    const mercury = transitPlanet(transitProvider, sample, ascendantSign, 'Mercury');
    const house = (mercury.signIndex - ascendantSign + 12) % 12 + 1;
    if (houseThemes[house]) {
      if (!current) current = { start: cursor, end: segmentEnd, reasons: new Set() };
      current.end = segmentEnd;
      current.reasons.add(`Mercury in ${RASHIS[mercury.signIndex]} transits the natal ${ordinal(house)} whole-sign house, used here as a traditional prompt for ${houseThemes[house]}.`);
    } else if (current) {
      candidates.push(current);
      current = null;
    }
    cursor = segmentEnd;
  }
  if (current) candidates.push(current);
  return candidates.slice(0, 3).map(candidate => ({
    start: dateOnly(candidate.start), end: dateOnly(candidate.end - 1),
    ageRange: { min: age(profile.birthDate, candidate.start), max: age(profile.birthDate, candidate.end - 1) },
    label: 'Approximate application and interview planning window', reasons: [...candidate.reasons],
  }));
}

/** Explicit traditional career heuristic; the ephemeris supplies every transit. */
export function estimateCareerWindows(profile, chart, {
  asOf = new Date(), horizonYears = 3, transitProvider = calculateTransitPositions,
  planningTransitProvider = calculateTransitPositions,
} = {}) {
  const { now, end: horizonEnd, ascendantSign, timeline } = prepare(profile, chart, asOf, horizonYears, transitProvider);
  const tenthSign = (ascendantSign + 9) % 12;
  const tenthLord = RULERS[tenthSign];
  const ruler = chart.planets.find((planet) => planet.name === tenthLord);
  const mercury = chart.planets.find((planet) => planet.name === 'Mercury');
  const saturn = chart.planets.find((planet) => planet.name === 'Saturn');
  if (!validSign(ruler?.signIndex) || !validSign(mercury?.signIndex) || !validSign(saturn?.signIndex)) {
    throw badRequest('The calculated chart must include the tenth-house ruler, Mercury, and Saturn.');
  }
  const targets = new Map();
  targets.set(tenthSign, ['the tenth house']);
  targets.set(ruler.signIndex, [...(targets.get(ruler.signIndex) || []), `its ruler ${tenthLord}`]);
  const earliest = Math.max(now, birthday(profile.birthDate, Number(profile.birthDate.slice(0, 4)) + 18));
  const candidates = [];
  for (const antar of timeline.antars) {
    const support = careerDashaSupport(antar.mahaLord, antar.lord, tenthLord);
    const start = Math.max(earliest, antar.start);
    const end = Math.min(horizonEnd, antar.end);
    if (!support.points || end <= start) continue;
    let cursor = start;
    let current = null;
    while (cursor < end) {
      const segmentEnd = Math.min(end, nextCalendarMonth(cursor));
      const sample = cursor + Math.floor((segmentEnd - cursor) / 2);
      const jupiter = transitPlanet(transitProvider, sample, ascendantSign, 'Jupiter');
      const supported = [...targets].filter(([sign]) => JUPITER_ASPECTS.includes((sign - jupiter.signIndex + 12) % 12));
      if (supported.length) {
        if (!current) {
          current = {
            start: cursor, end: segmentEnd, duration: 0, jupiterTotal: 0, dashaPoints: support.points,
            reasons: new Set([`Vimshottari period: ${antar.mahaLord} mahadasha / ${antar.lord} antardasha.`, ...support.reasons]),
          };
        }
        const duration = segmentEnd - cursor;
        current.end = segmentEnd;
        current.duration += duration;
        current.jupiterTotal += duration * supported.length;
        for (const [sign, roles] of supported) {
          current.reasons.add(`Jupiter in ${RASHIS[jupiter.signIndex]} ${sign === jupiter.signIndex ? 'occupies' : 'traditionally aspects'} ${RASHIS[sign]}, the natal sign of ${roles.join(' and ')}.`);
        }
      } else if (current) {
        candidates.push(current);
        current = null;
      }
      cursor = segmentEnd;
    }
    if (current) candidates.push(current);
  }
  candidates.sort((a, b) => a.start - b.start
    || b.dashaPoints - a.dashaPoints
    || b.jupiterTotal / b.duration - a.jupiterTotal / a.duration);
  const windows = candidates.slice(0, 3).map((candidate) => ({
    start: dateOnly(candidate.start), end: dateOnly(candidate.end - 1),
    ageRange: { min: age(profile.birthDate, candidate.start), max: age(profile.birthDate, candidate.end - 1) },
    label: 'Traditional career opportunity window', reasons: [...candidate.reasons],
    supportFactors: {
      dashaWeight: candidate.dashaPoints,
      jupiterTargetAverage: candidate.jupiterTotal / candidate.duration,
    },
  }));
  const searchEnd = Math.min(horizonEnd, calendarMonthsAfter(now, 6));
  const searchWindows = careerSearchWindows(profile, ascendantSign, earliest, searchEnd, transitProvider);
  const natalMoon = chart.planets.find(planet => planet.name === 'Moon')?.longitude;
  const planningDates = Number.isFinite(natalMoon) && natalMoon >= 0 && natalMoon < 360
    ? calculateCareerPlanningDates(profile, chart, { asOf, transitProvider: planningTransitProvider }) : undefined;
  return {
    topic: 'career', status: windows.length ? 'estimated' : 'no-window',
    asOf: dateOnly(now), horizonEnd: dateOnly(horizonEnd), windows,
    searchHorizonEnd: dateOnly(searchEnd), searchWindows,
    ...(planningDates ? { planningDates } : {}),
    factors: [
      `D1 tenth house: ${RASHIS[tenthSign]}; traditional ruler: ${tenthLord}, placed in ${RASHIS[ruler.signIndex]}.`,
      `Professional significators used here: Mercury in ${RASHIS[mercury.signIndex]} and Saturn in ${RASHIS[saturn.signIndex]}.`,
      ...dashaFactors(timeline, now),
    ],
    themes: [
      'The tenth house is traditionally interpreted through work, public responsibilities, and professional direction.',
      'Mercury is used as a prompt for skills and communication; Saturn for sustained effort and responsibility.',
      'Use any timing window to plan applications, learning, and conversations alongside actual employment opportunities.',
      'Continue searching now. A later combined period is not a required waiting time, and employment can begin outside any highlighted interval.',
    ],
    method: [
      'D1 whole-sign tenth house and its traditional ruler, using the calculated approximate Lahiri sidereal chart.',
      'Qualifying Vimshottari periods require the tenth-house ruler, Mercury, or Saturn as mahadasha or antardasha lord; preserve their actual interval boundaries.',
      'A qualifying period also requires monthly future Jupiter occupation or traditional 5th, 7th, or 9th sign aspect to the natal tenth-house sign or its ruler’s sign.',
      'Dasha support adds 4 for the tenth-house ruler as antardasha lord and 3 as mahadasha lord; Mercury and Saturn each add 2 as antardasha lord or 1 as mahadasha lord when they are not already that ruler. Compare this sum first, then the duration-weighted mean number of Jupiter target signs; these weights are not outcome probabilities.',
      'Return the first three qualifying combined dasha/Jupiter windows in chronological order, so a stronger later period does not hide a nearer supported interval. Display-order support weights break same-start ties only; the separate support labels compare shown windows without moving them and are not probabilities.',
      'Merge contiguous supported calendar-month samples within each antardasha. Ages below 18 are excluded; February 29 birthdays use March 1 in non-leap years.',
      'Separately sample Mercury weekly across the next six calendar months. Occupation of the natal whole-sign sixth, tenth, or eleventh house is a limited traditional planning heuristic for applications, interviews, and networking; it does not require or imply the combined dasha/Jupiter rule.',
      'Return up to three chronological application/interview planning windows. Merge contiguous supported weekly samples and preserve unsupported gaps; these are approximate periods rather than exact transit ingress dates or auspicious-day selections.',
    ],
    limitations: limits(chart, [
      'These are traditional astrological estimates, not scientifically validated forecasts. They cannot promise a job offer, promotion, salary, or date of employment.',
      'Monthly transit sampling gives approximate window boundaries, not exact event dates. Dasha cutoffs retain the calculated timeline boundaries.',
      'Application/interview planning windows use weekly Mercury samples and a weaker, separate transit heuristic. They are not calculated offer dates, a guarantee of favorable days, or evidence of a job within six months.',
      'This limited heuristic does not evaluate Dashamsa (D10), planetary strength, yogas, or real labor-market conditions.',
      'No window means this method found no qualifying interval within the selected horizon; it does not mean professional progress is impossible.',
    ]),
  };
}

function saturnPhase(saturnSign, moonSign) {
  const houseFromMoon = (saturnSign - moonSign + 12) % 12 + 1;
  const phase = {
    12: { key: 'sade-sati-opening', family: 'sade-sati', name: 'Sade Sati — opening passage' },
    1: { key: 'sade-sati-middle', family: 'sade-sati', name: 'Sade Sati — middle passage' },
    2: { key: 'sade-sati-closing', family: 'sade-sati', name: 'Sade Sati — closing passage' },
    8: { key: 'ashtama-shani', family: 'ashtama-shani', name: 'Ashtama Shani passage' },
  }[houseFromMoon];
  if (!phase) return {
    key: 'none', family: null, name: 'No current Sade Sati or Ashtama Shani', houseFromMoon,
    description: `Saturn is in the ${ordinal(houseFromMoon)} sign from the natal Moon, outside the conventional sign markers assessed here. This does not establish whether life is easy or difficult.`,
  };
  return {
    ...phase, houseFromMoon,
    description: `Saturn is in the ${ordinal(houseFromMoon)} sign from the natal Moon. Some Jyotish traditions call this ${phase.name}; it is a traditional transit classification, not evidence that hardship is destined.`,
  };
}

/**
 * Describe conventional Saturn/Moon passages and calculated dasha transitions.
 * A chart phase changing cannot establish a date when real hardship will stop.
 */
export function describeDifficultPeriods(profile, chart, {
  asOf = new Date(), horizonYears = 10, transitProvider = calculateTransitPositions,
} = {}) {
  const { now, end: horizonEnd, ascendantSign, timeline } = prepare(profile, chart, asOf, horizonYears, transitProvider);
  const moon = chart.planets.find((planet) => planet.name === 'Moon');
  if (!validSign(moon?.signIndex)) throw badRequest('The calculated natal Moon sign is required for Saturn passage interpretation.');
  const groups = [];
  let cursor = now;
  while (cursor < horizonEnd) {
    // Sample at the assessment instant and then the first day of each future
    // calendar month. Never invent a historical onset or an exact ingress.
    const saturn = transitPlanet(transitProvider, cursor, ascendantSign, 'Saturn');
    const phase = saturnPhase(saturn.signIndex, moon.signIndex);
    const end = Math.min(horizonEnd, nextCalendarMonth(cursor));
    const previous = groups.at(-1);
    if (previous?.phase.key === phase.key) previous.end = end;
    else groups.push({ start: cursor, end, phase, saturnSign: saturn.signIndex });
    cursor = end;
  }
  const current = groups[0].phase;
  const windows = groups.filter((group) => group.phase.family).slice(0, 6).map((group) => {
    const isCurrent = group.start === now;
    const reasons = [
      `Saturn sampled in ${RASHIS[group.saturnSign]} is the ${ordinal(group.phase.houseFromMoon)} sign from the natal Moon in ${RASHIS[moon.signIndex]}.`,
      isCurrent
        ? 'This passage is present at the assessment date; the displayed start is that assessment date, not its historical onset.'
        : `The passage first appears in the monthly samples on ${dateOnly(group.start)}; this is an approximate transit boundary.`,
    ];
    if (group.end === horizonEnd) {
      reasons.push('This window is clipped to the requested horizon; no exit from this passage was found within that horizon.');
    } else {
      const next = groups.find((candidate) => candidate.start === group.end);
      reasons.push(`At the sample on ${dateOnly(group.end)}, the classification changes to ${next.phase.family ? next.phase.name : 'outside the Sade Sati/Ashtama Shani sign markers'}. Monthly samples do not establish an exact ingress date.`);
      if (group.phase.family === 'sade-sati' && next.phase.family === 'sade-sati') {
        reasons.push('This is a change between passages within Sade Sati; the broader three-sign Sade Sati classification continues.');
      }
    }
    reasons.push('A change in this traditional chart marker does not predict the start or end of real hardship.');
    return { start: dateOnly(group.start), end: dateOnly(group.end - 1), label: `${isCurrent ? 'Current' : 'Future'} ${group.phase.name}`, reasons };
  });
  const factors = [
    `Natal Moon sign: ${RASHIS[moon.signIndex]}. Current Saturn sign: ${RASHIS[groups[0].saturnSign]}.`,
    `Current Saturn classification: ${current.name}.`,
    ...dashaFactors(timeline, now),
  ];
  if (current.family) {
    const firstExit = groups.find((group) => group.phase.family !== current.family);
    factors.push(firstExit
      ? `The current ${current.family === 'sade-sati' ? 'Sade Sati' : 'Ashtama Shani'} classification is first absent at the monthly sample on ${dateOnly(firstExit.start)}. This is only a sampled transit change; it is not a date when personal hardship will end. Later re-entries can occur.`
      : 'The current conventional Saturn classification remains in monthly samples through the requested horizon; no exit date is supplied.');
  } else {
    const next = groups.find((group) => group.phase.family);
    if (next) factors.push(`The next conventional Saturn marker first appears at the monthly sample on ${dateOnly(next.start)}: ${next.phase.name}. This does not predict a difficult event.`);
    else factors.push('No conventional Sade Sati or Ashtama Shani passage was found in this horizon; no phase dates are invented.');
  }
  return {
    topic: 'difficult-periods', status: windows.length ? 'interpreted' : 'no-window',
    asOf: dateOnly(now), horizonEnd: dateOnly(horizonEnd), windows, factors,
    currentPhase: { name: current.name, description: current.description },
    themes: [
      'Some Jyotish traditions interpret these Saturn passages through responsibility, patience, adaptation, and gradual change.',
      'A passage being present does not establish misfortune; its absence does not establish that present difficulties are over.',
      'Your circumstances, available support, and practical choices matter independently of a chart phase.',
    ],
    method: [
      'Use the calculated approximate Lahiri natal Moon sign and actual future geocentric Saturn transit signs.',
      'Conventional Sade Sati markers: Saturn in the 12th, 1st, or 2nd sign from the natal Moon; Ashtama Shani: the 8th sign. Other Saturn positions are outside this limited classification.',
      'Sample at the assessment instant and the start of each future calendar month. Merge consecutive samples of the same passage and show at most six marked passages in chronological order.',
      'Use all horizon samples to describe the first exit from the current classification; changes between Sade Sati passages do not end the broader three-sign classification.',
      'Current and next Vimshottari periods come from the calculated timeline; neither a dasha transition nor a transit boundary dates the end of real hardship.',
    ],
    limitations: limits(chart, [
      'These are traditional Jyotish interpretations, not scientifically validated predictions of events or an assessment of your actual wellbeing.',
      'The chart cannot determine why you are struggling or when difficulties will stop. It does not diagnose distress or predict inevitable harm.',
      'Transit boundaries are approximate monthly sampling boundaries, not exact ingress dates; short retrograde entries or exits may be missed.',
      'The current passage is clipped to the assessment date and requested horizon. Its historical onset is not calculated here, and a clipped end is not a phase exit.',
      'Saturn can re-enter a passage during retrograde motion. A first sampled exit does not promise a permanent transit change or improvement in circumstances.',
    ]),
  };
}
