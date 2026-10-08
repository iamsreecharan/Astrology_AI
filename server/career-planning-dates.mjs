import { Temporal } from '@js-temporal/polyfill';
import { calculateTransitPositions, normalizeDegrees, validateBirthDetails } from './vedic-chart.mjs';

const STAR_SIZE = 360 / 27;
const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];
const TARAS = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyak', 'Sadhana', 'Naidhana', 'Mitra', 'Parama Mitra'];
const SUPPORTIVE_TARAS = new Set([2, 4, 6, 8, 9]);
const SUPPORTIVE_MOON_HOUSES = new Set([1, 3, 6, 7, 10, 11]);
const TITHIS = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
  'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi',
  'Trayodashi', 'Chaturdashi',
];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validLongitude(value) {
  return Number.isFinite(value) && value >= 0 && value < 360;
}

function nearBoundary(value, size) {
  const within = value % size;
  return Math.min(within, size - within) <= 0.05 + Number.EPSILON * 360;
}

function eighteenthBirthday(date) {
  const birth = Temporal.PlainDate.from(date);
  const year = birth.year + 18;
  const february = Temporal.PlainDate.from({ year, month: 2, day: 1 });
  if (birth.month === 2 && birth.day === 29 && february.daysInMonth === 28) {
    return Temporal.PlainDate.from({ year, month: 3, day: 1 });
  }
  return Temporal.PlainDate.from({ year, month: birth.month, day: birth.day });
}

function readTransit(positions, name) {
  const value = Array.isArray(positions) ? positions.find((planet) => planet?.name === name)?.longitude : undefined;
  if (!validLongitude(value)) throw new Error(`The ephemeris did not supply a valid ${name} sidereal longitude.`);
  return value;
}

/** A short calendar for planning effort, using explicit traditional Moon-based rules. */
export function calculateCareerPlanningDates(profile, chart, {
  asOf = new Date(), horizonDays = 90, limit = 8, transitProvider = calculateTransitPositions,
} = {}) {
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) throw badRequest('The planning date must be valid.');
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 90) {
    throw badRequest('The planning calendar must cover 1–90 civil dates.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw badRequest('The planning calendar can return 1–8 dates.');
  if (typeof transitProvider !== 'function') throw new TypeError('The transit provider must be a function.');
  const details = validateBirthDetails(profile, { today: asOf });
  if (!details) throw badRequest('Complete birth details are required for a personal planning calendar.');
  const natalMoon = Array.isArray(chart?.planets) ? chart.planets.find((planet) => planet?.name === 'Moon')?.longitude : undefined;
  const ascendant = chart?.ascendant?.longitude;
  if (!validLongitude(natalMoon) || !validLongitude(ascendant)) {
    throw badRequest('A calculated chart with a valid natal Moon and ascendant is required.');
  }
  const timeZone = details.timeZone;
  const localNow = Temporal.Instant.fromEpochMilliseconds(asOf.getTime()).toZonedDateTimeISO(timeZone);
  const start = localNow.toPlainDate();
  const endExclusive = start.add({ days: horizonDays });
  const lastDate = endExclusive.subtract({ days: 1 });
  const firstSample = start.toZonedDateTime({ timeZone, plainTime: '12:00' });
  const lastSample = lastDate.toZonedDateTime({ timeZone, plainTime: '12:00' });
  if (new Date(Number(firstSample.epochMilliseconds)).getUTCFullYear() < 1900
    || new Date(Number(lastSample.epochMilliseconds)).getUTCFullYear() > 2100) {
    throw badRequest('Planning-date transit calculations support dates between 1900 and 2100. Choose a shorter horizon.');
  }
  const adultOn = eighteenthBirthday(profile.birthDate);
  const natalStarIndex = Math.floor(natalMoon / STAR_SIZE);
  const natalMoonSign = Math.floor(natalMoon / 30);
  const ascendantSign = Math.floor(ascendant / 30);
  const dates = [];
  let evaluatedDays = 0;
  let qualifyingDays = 0;
  let excludedBoundaryDays = 0;
  const sharedWarnings = [];
  if (nearBoundary(natalMoon, STAR_SIZE)) {
    sharedWarnings.push('The natal Moon is within 0.05° of a birth-star boundary; verify the birth time and star before using Tarabala.');
  }
  if (nearBoundary(natalMoon, 30)) {
    sharedWarnings.push('The natal Moon is within 0.05° of a sign boundary; verify its sign before using Chandrabala.');
  }

  for (let date = start; Temporal.PlainDate.compare(date, endExclusive) < 0; date = date.add({ days: 1 })) {
    if (sharedWarnings.length) break;
    if (Temporal.PlainDate.compare(date, adultOn) < 0) continue;
    const sample = date.toZonedDateTime({ timeZone, plainTime: '12:00' });
    if (sample.toPlainDate().toString() !== date.toString() || sample.hour !== 12 || sample.minute !== 0) continue;
    const sampleMs = Number(sample.epochMilliseconds);
    // A past noon sample cannot be presented as an upcoming planning time.
    if (sampleMs < asOf.getTime()) continue;
    const positions = transitProvider === calculateTransitPositions
      ? transitProvider(new Date(sampleMs), ascendantSign, ['Sun', 'Moon'])
      : transitProvider(new Date(sampleMs), ascendantSign);
    const sun = readTransit(positions, 'Sun');
    const moon = readTransit(positions, 'Moon');
    evaluatedDays += 1;
    const starIndex = Math.floor(moon / STAR_SIZE);
    const starCount = (starIndex - natalStarIndex + 27) % 27 + 1;
    const taraIndex = (starCount - 1) % 9 + 1;
    const moonRelativeHouse = (Math.floor(moon / 30) - natalMoonSign + 12) % 12 + 1;
    const elongation = normalizeDegrees(moon - sun);
    const tithiIndex = Math.floor(elongation / 12) + 1;
    const dayInPaksha = (tithiIndex - 1) % 15 + 1;
    if (nearBoundary(moon, STAR_SIZE) || nearBoundary(moon, 30) || nearBoundary(elongation, 12)) {
      excludedBoundaryDays += 1;
      continue;
    }
    if (!SUPPORTIVE_TARAS.has(taraIndex) || !SUPPORTIVE_MOON_HOUSES.has(moonRelativeHouse)
      || [4, 9, 14].includes(dayInPaksha) || tithiIndex === 30) continue;
    qualifyingDays += 1;
    if (dates.length >= limit) continue;
    const tithiName = dayInPaksha === 15 ? 'Purnima' : TITHIS[dayInPaksha - 1];
    const paksha = tithiIndex <= 15 ? 'Shukla' : 'Krishna';
    const weekday = WEEKDAYS[date.dayOfWeek - 1];
    const reasons = [
      `Tarabala: ${TARAS[taraIndex - 1]} (${taraIndex}/9), a supportive birth-star relationship in this method.`,
      `Chandrabala: the transit Moon is in the ${moonRelativeHouse}${moonRelativeHouse === 1 ? 'st' : moonRelativeHouse === 3 ? 'rd' : 'th'} sign from the natal Moon, one of this method’s supportive signs.`,
      `Sampled tithi: ${paksha} ${tithiName}; outside Rikta tithis 4, 9 and 14 and Amavasya.`,
    ];
    if (date.dayOfWeek === 3 || date.dayOfWeek === 4) {
      reasons.push(`${weekday} is also traditionally associated with ${date.dayOfWeek === 3 ? 'Mercury and communication' : 'Jupiter and guidance'}; use it as a prompt for applications or interviews.`);
    }
    const isoDate = date.toString();
    dates.push({
      date: isoDate, displayDate: `${isoDate.slice(8, 10)}-${isoDate.slice(5, 7)}-${isoDate.slice(0, 4)}`,
      weekday, timeZone,
      nakshatra: { index: starIndex + 1, name: NAKSHATRAS[starIndex] },
      tithi: { index: tithiIndex, name: tithiName, paksha, dayInPaksha },
      tara: { index: taraIndex, name: TARAS[taraIndex - 1], countFromBirthStar: starCount },
      moonRelativeHouse, reasons, warnings: [],
      sampleLocal: sample.toString({ smallestUnit: 'minute' }),
      sampleUtc: new Date(sampleMs).toISOString(),
    });
  }

  return {
    status: sharedWarnings.length ? 'uncertain-natal' : dates.length ? 'available'
      : Temporal.PlainDate.compare(adultOn, endExclusive) >= 0 ? 'under-age' : 'no-dates',
    sampledAt: asOf.toISOString(),
    horizon: { start: start.toString(), end: lastDate.toString(), endExclusive: endExclusive.toString(), days: horizonDays, timeZone },
    natal: { nakshatra: { index: natalStarIndex + 1, name: NAKSHATRAS[natalStarIndex] }, moonSignIndex: natalMoonSign },
    dates, evaluatedDays, qualifyingDays, excludedBoundaryDays,
    method: [
      'Sample the calculated approximate Lahiri geocentric Sun and Moon at 12:00 on each upcoming local civil date. Today is skipped if its noon sample has already passed; a civil date with no valid local noon is skipped.',
      'Count inclusively from the natal nakshatra to the transit nakshatra around the 27-star cycle; repeat nine Taras. Sampat (2), Kshema (4), Sadhana (6), Mitra (8) and Parama Mitra (9) qualify. Janma (1) is neutral; Vipat (3), Pratyak (5) and Naidhana (7) do not qualify.',
      'Require Chandrabala as transit Moon signs 1, 3, 6, 7, 10 or 11 counted inclusively from the natal Moon sign.',
      'Exclude Rikta tithis 4, 9 and 14 in either paksha and Amavasya (30), using each 12° Sun–Moon elongation division. Wednesday or Thursday adds context but is not required.',
      'Exclude samples within 0.05° of a Moon sign, nakshatra or tithi boundary. If the natal Moon is within 0.05° of a sign or birth-star boundary, return no selected dates until the natal classification is verified.',
      `Return at most ${limit} qualifying dates in chronological order, never filling an empty calendar with invented positive dates. Exclude dates before age 18; February 29 birthdays use March 1 in non-leap years.`,
    ],
    limits: [
      'These are conditional traditional planning suggestions for job applications, preparation or interviews. They do not predict an offer, guarantee a favorable day, or require you to delay a real opportunity.',
      `Dates and noon samples use the saved birth time zone (${timeZone}) because the user’s current location is unknown. Confirm your current location before choosing an actual appointment time.`,
      'A noon sample describes one instant, not the entire civil day. Moon signs, nakshatras and tithis can change during the day; exact transition times are not calculated here.',
      'This limited selection is not a full muhurta. It does not evaluate sunrise-based vara, Rahu Kalam, Yamaganda, Gulika, daily yoga and karana, Bhadra, eclipse restrictions, local appointment ascendants, or regional rules.',
      'These traditional criteria are not scientifically validated predictors of employment. Continue searching now, including dates not selected by this method.',
      ...sharedWarnings,
    ],
  };
}
