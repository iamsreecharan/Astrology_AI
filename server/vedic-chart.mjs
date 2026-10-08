import * as Astronomy from 'astronomy-engine';
import { Temporal } from '@js-temporal/polyfill';

// Calculate positions here so the language model can explain the chart
// without supplying its own planetary positions.
const DAY_MS = 86_400_000;
const YEAR_MS = 365.2425 * DAY_MS;
const RAD = Math.PI / 180;
const NAKSHATRA_SIZE = 360 / 27;
const PADA_SIZE = NAKSHATRA_SIZE / 4;
const RASHIS = Object.freeze([
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
  'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)',
]);
const NAKSHATRAS = Object.freeze([
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
]);
const DASHA = Object.freeze([
  { lord: 'Ketu', years: 7 }, { lord: 'Venus', years: 20 }, { lord: 'Sun', years: 6 },
  { lord: 'Moon', years: 10 }, { lord: 'Mars', years: 7 }, { lord: 'Rahu', years: 18 },
  { lord: 'Jupiter', years: 16 }, { lord: 'Saturn', years: 19 }, { lord: 'Mercury', years: 17 },
]);
const PLANET_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const BIRTH_FIELDS = ['birthTime', 'birthPlace', 'latitude', 'longitude', 'timeZone'];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function normalizeDegrees(value) {
  if (value >= 0 && value < 360) return value === 0 ? 0 : value;
  const remainder = value % 360;
  return remainder < 0 ? remainder + 360 : remainder === 0 ? 0 : remainder;
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundLongitude(value) {
  // Rounding must not move a longitude into the next sign, even within
  // 0.0000005° of the boundary. signIndex keeps the unrounded classification.
  const sign = Math.floor(value / 30);
  return Math.max(sign * 30, Math.min(round(value), (sign + 1) * 30 - 0.000001));
}

function validDate(value, label) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw badRequest(`${label} must be a valid date.`);
  }
  return value;
}

function parseBirthDate(birthDate) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw badRequest('Birth date must use YYYY-MM-DD.');
  }
  try {
    return Temporal.PlainDate.from(birthDate, { overflow: 'reject' });
  } catch {
    throw badRequest('Birth date must be a real calendar date.');
  }
}

function birthInstant(profile) {
  const date = parseBirthDate(profile.birthDate);
  const [hour, minute] = profile.birthTime.split(':').map(Number);
  try {
    const zoned = Temporal.ZonedDateTime.from({
      timeZone: profile.timeZone,
      year: date.year, month: date.month, day: date.day, hour, minute,
    }, { disambiguation: 'reject', overflow: 'reject' });
    return new Date(Number(zoned.epochMilliseconds));
  } catch {
    throw badRequest('Birth time is ambiguous or does not exist in this time zone. Check the historical local time and time zone.');
  }
}

/** Birth details are optional, but all fields are needed to calculate a chart. */
export function validateBirthDetails(input, { today = new Date() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('A birth profile is required.');
  }
  const hasValue = (value) => value !== undefined && value !== null && value !== '';
  if (!BIRTH_FIELDS.some((field) => hasValue(input[field]))) return null;
  if (!BIRTH_FIELDS.every((field) => hasValue(input[field]))) {
    throw badRequest('For a Vedic chart, provide birth time, birth place, latitude, longitude, and the historical time zone together.');
  }
  validDate(today, 'The current date');
  const birthDate = parseBirthDate(input.birthDate);
  if (birthDate.year < 1900 || birthDate.year > 2100 || input.birthDate > today.toISOString().slice(0, 10)) {
    throw badRequest('Vedic birth dates must be between 1900 and today, within the supported 1900–2100 calculation range.');
  }
  if (typeof input.birthTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)) {
    throw badRequest('Birth time must use the 24-hour HH:mm format.');
  }
  if (typeof input.birthPlace !== 'string') throw badRequest('Birth place must be text.');
  const birthPlace = input.birthPlace.trim();
  if (birthPlace.length < 1 || birthPlace.length > 120 || /[\u0000-\u001f\u007f]/.test(input.birthPlace)) {
    throw badRequest('Birth place must contain 1–120 characters without control characters.');
  }
  if (typeof input.latitude !== 'number' || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90) {
    throw badRequest('Latitude must be a number between −90 and 90 degrees.');
  }
  if (typeof input.longitude !== 'number' || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) {
    throw badRequest('Longitude must be a number between −180 and 180 degrees.');
  }
  if (typeof input.timeZone !== 'string') throw badRequest('Choose a valid IANA time zone, such as Asia/Kolkata.');
  const timeZone = input.timeZone.trim();
  // Birth dates need historical offsets, which a fixed UTC offset cannot supply.
  if (!timeZone || timeZone.length > 80 || /[\u0000-\u001f\u007f]/.test(input.timeZone) || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(timeZone)) {
    throw badRequest('Choose a valid IANA time zone, such as Asia/Kolkata, instead of a fixed UTC offset.');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    throw badRequest('Choose a valid IANA time zone, such as Asia/Kolkata.');
  }
  const details = { birthTime: input.birthTime, birthPlace, latitude: input.latitude, longitude: input.longitude, timeZone };
  const instant = birthInstant({ birthDate: input.birthDate, ...details });
  if (instant.getTime() > today.getTime()) {
    throw badRequest('Birth date and time must describe an instant that has already occurred. Check the birth time and time zone.');
  }
  return details;
}

// IAU 2006 general precession in longitude, in arcseconds from J2000.
// Uses the P03 polynomial by Capitaine, Wallace & Chapront.
function generalPrecession(t) {
  return t * (5028.796195 + t * (1.1054348 + t * (0.00007964 + t * (-0.000023857 - t * 0.0000000383))));
}

/** Approximate mean Lahiri: a published mean anchor plus IAU 2006 precession. */
export function approximateLahiriAyanamsha(date) {
  const time = Astronomy.MakeTime(validDate(date, 'Calculation date'));
  // Mean Lahiri reference at TT JD 2435553.5, 1956-03-21. Applying scalar
  // precession gives an approximation, not an exact Swiss Lahiri result.
  const anchorT = (2435553.5 - 2451545.0) / 36525;
  return 23.245524743 + (generalPrecession(time.tt / 36525) - generalPrecession(anchorT)) / 3600;
}

/** Apparent tropical longitude on the eastern horizon, with true obliquity. */
export function tropicalAscendant(date, latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) >= 90 || Math.abs(longitude) > 180) {
    throw badRequest('An ascendant cannot be calculated at the geographic poles. Check the birth coordinates.');
  }
  const time = Astronomy.MakeTime(validDate(date, 'Calculation date'));
  const epsilon = Astronomy.e_tilt(time).tobl * RAD;
  const theta = normalizeDegrees(Astronomy.SiderealTime(time) * 15 + longitude) * RAD;
  const numerator = Math.cos(theta);
  const denominator = -Math.sin(theta) * Math.cos(epsilon) - Math.tan(latitude * RAD) * Math.sin(epsilon);
  if (Math.hypot(numerator, denominator) < 1e-10) {
    throw badRequest('The ascendant is undefined where the ecliptic coincides with the horizon. Check the birth time and coordinates.');
  }
  let angle = normalizeDegrees(Math.atan2(numerator, denominator) / RAD);
  const rightAscension = Math.atan2(Math.sin(angle * RAD) * Math.cos(epsilon), Math.cos(angle * RAD));
  const hourAngle = theta - rightAscension;
  // At polar latitudes the usual atan2 formula can choose the western point.
  // Both horizon intersections are antipodal; select the point that is rising.
  if (Math.sin(hourAngle) > 0) angle = normalizeDegrees(angle + 180);
  if (Math.abs(Math.sin(hourAngle)) < 1e-10) {
    throw badRequest('The ascendant is tangent to the horizon at this location and time. A reliable rising sign is unavailable.');
  }
  return angle;
}

function meanLunarNode(date) {
  const t = Astronomy.MakeTime(date).tt / 36525;
  // Meeus mean longitude of the ascending lunar node, degrees of mean date.
  return normalizeDegrees(125.04452 - 1934.136261 * t + 0.0020708 * t * t + t * t * t / 450000);
}

function siderealPositions(date) {
  const time = Astronomy.MakeTime(date);
  const meanAyanamsha = approximateLahiriAyanamsha(date);
  const trueAyanamsha = meanAyanamsha + Astronomy.e_tilt(time).dpsi / 3600;
  const positions = PLANET_BODIES.map((name) => {
    const tropical = name === 'Moon'
      ? Astronomy.EclipticGeoMoon(time).lon
      : Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body[name], time, true)).elon;
    return { name, longitude: normalizeDegrees(tropical - trueAyanamsha) };
  });
  const rahu = normalizeDegrees(meanLunarNode(date) - meanAyanamsha);
  positions.push({ name: 'Rahu', longitude: rahu }, { name: 'Ketu', longitude: normalizeDegrees(rahu + 180) });
  return positions;
}

function signedDelta(after, before) {
  return normalizeDegrees(after - before + 180) - 180;
}

function planetsAt(date, ascendantSign) {
  const positions = siderealPositions(date);
  const before = siderealPositions(new Date(date.getTime() - DAY_MS / 4));
  const after = siderealPositions(new Date(date.getTime() + DAY_MS / 4));
  return positions.map((planet, index) => {
    const signIndex = Math.floor(planet.longitude / 30);
    return {
      name: planet.name,
      rashi: RASHIS[signIndex],
      signIndex,
      longitude: roundLongitude(planet.longitude),
      degreeInSign: Math.min(29.999999, round(planet.longitude % 30)),
      house: (signIndex - ascendantSign + 12) % 12 + 1,
      retrograde: planet.name === 'Rahu' || planet.name === 'Ketu'
        ? true : signedDelta(after[index].longitude, before[index].longitude) < 0,
    };
  });
}

/** Transit houses use the natal ascendant sign, not a transit ascendant. */
export function calculateTransitPlanets(date, ascendantSign = 0) {
  validDate(date, 'Transit date');
  if (!Number.isInteger(ascendantSign) || ascendantSign < 0 || ascendantSign > 11) {
    throw badRequest('The natal ascendant sign index must be between 0 and 11.');
  }
  if (date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) {
    throw badRequest('Transit calculations support dates between 1900 and 2100.');
  }
  return planetsAt(date, ascendantSign);
}

/** Classical ninefold D9 division; houses are relative to the D9 ascendant. */
export function calculateNavamsa(planets, ascendantLongitude) {
  if (!Number.isFinite(ascendantLongitude) || !Array.isArray(planets)) {
    throw badRequest('Valid natal longitudes are required for the Navamsa chart.');
  }
  const longitude = normalizeDegrees(ascendantLongitude * 9);
  const ascendantSign = Math.floor(longitude / 30);
  return {
    ascendant: { rashi: RASHIS[ascendantSign], signIndex: ascendantSign, longitude: roundLongitude(longitude) },
    planets: planets.map((planet) => {
      if (!planet || !Number.isFinite(planet.longitude)) throw badRequest('Valid natal planet longitudes are required for the Navamsa chart.');
      const planetLongitude = normalizeDegrees(planet.longitude * 9);
      const signIndex = Math.floor(planetLongitude / 30);
      return {
        name: planet.name, rashi: RASHIS[signIndex], signIndex,
        longitude: roundLongitude(planetLongitude), degreeInSign: Math.min(29.999999, round(planetLongitude % 30)),
        house: (signIndex - ascendantSign + 12) % 12 + 1,
        retrograde: planet.retrograde ?? null,
      };
    }),
  };
}

/** Zero-based nakshatra index, with traditional lord and one-based pada. */
export function moonNakshatra(longitude) {
  if (!Number.isFinite(longitude)) throw badRequest('Moon longitude must be finite.');
  const normalized = normalizeDegrees(longitude);
  const index = Math.min(26, Math.floor(normalized / NAKSHATRA_SIZE));
  const within = normalized - index * NAKSHATRA_SIZE;
  return {
    name: NAKSHATRAS[index], lord: DASHA[index % 9].lord, index,
    pada: Math.min(4, Math.floor(within / PADA_SIZE) + 1),
  };
}

/** Standard 120-year Vimshottari sequence using a 365.2425-day dasha year. */
export function buildVimshottariDasha(birthDate, moonLongitude, asOf = new Date()) {
  const birth = validDate(birthDate, 'Birth instant').getTime();
  const current = validDate(asOf, 'Current dasha date').getTime();
  const nakshatra = moonNakshatra(moonLongitude);
  const lordIndex = nakshatra.index % 9;
  const fraction = normalizeDegrees(moonLongitude) / NAKSHATRA_SIZE - nakshatra.index;
  const initial = DASHA[lordIndex];
  let start = birth - fraction * initial.years * YEAR_MS;
  const periods = [];
  // Two cycles cover the supported dates through 2100 and at least 120 years
  // after birth. Keep the birth mahadasha's start, even when it precedes birth.
  for (let index = 0; index < 18; index += 1) {
    const dashaIndex = (lordIndex + index) % 9;
    const { lord, years } = DASHA[dashaIndex];
    const end = start + years * YEAR_MS;
    let subStart = start;
    const antardashas = [];
    for (let subIndex = 0; subIndex < 9; subIndex += 1) {
      const sub = DASHA[(dashaIndex + subIndex) % 9];
      const subEnd = subIndex === 8 ? end : subStart + years * sub.years / 120 * YEAR_MS;
      antardashas.push({ lord: sub.lord, start: new Date(subStart).toISOString(), end: new Date(subEnd).toISOString() });
      subStart = subEnd;
    }
    periods.push({ lord, start: new Date(start).toISOString(), end: new Date(end).toISOString(), antardashas });
    start = end;
  }
  const active = current >= birth ? periods.find((period) => current >= Date.parse(period.start) && current < Date.parse(period.end)) : null;
  const activeSub = active?.antardashas.find((period) => current >= Date.parse(period.start) && current < Date.parse(period.end));
  return {
    birthBalance: { lord: initial.lord, years: round(initial.years * (1 - fraction)) },
    currentMahadasha: active ? { lord: active.lord, start: active.start, end: active.end } : null,
    currentAntardasha: activeSub || null,
    periods,
  };
}

function distanceToBoundary(longitude, size) {
  const within = normalizeDegrees(longitude) % size;
  return Math.min(within, size - within);
}

/** Calculate a chart from validated birth inputs; basic profiles have no chart. */
export function calculateVedicChart(profile, { asOf = new Date() } = {}) {
  const details = validateBirthDetails(profile);
  if (!details) return null;
  validDate(asOf, 'Transit date');
  if (asOf.getUTCFullYear() < 1900 || asOf.getUTCFullYear() > 2100) {
    throw badRequest('Transit calculations support dates between 1900 and 2100.');
  }
  const birth = birthInstant({ birthDate: profile.birthDate, ...details });
  const meanAyanamsha = approximateLahiriAyanamsha(birth);
  const trueAyanamsha = meanAyanamsha + Astronomy.e_tilt(Astronomy.MakeTime(birth)).dpsi / 3600;
  const ascendantLongitude = normalizeDegrees(tropicalAscendant(birth, details.latitude, details.longitude) - trueAyanamsha);
  const ascendantSign = Math.floor(ascendantLongitude / 30);
  const rawPlanets = siderealPositions(birth);
  const rawMoon = rawPlanets.find((planet) => planet.name === 'Moon').longitude;
  const nakshatra = moonNakshatra(rawMoon);
  const planets = planetsAt(birth, ascendantSign);
  const warnings = ['Approximate Lahiri model: verify positions within 0.05° of a sign, nakshatra, or pada boundary before interpreting them.'];
  for (const planet of planets) {
    if (distanceToBoundary(planet.longitude, 30) <= 0.05) warnings.push(`${planet.name} is within 0.05° of a rashi boundary; its sign and house may be uncertain.`);
    if (distanceToBoundary(planet.longitude, 30 / 9) <= 0.05) warnings.push(`${planet.name} is within 0.05° of a Navamsa division boundary; its D9 sign and house may be uncertain.`);
  }
  if (distanceToBoundary(ascendantLongitude, 30) <= 0.05) warnings.push('The ascendant is within 0.05° of a rashi boundary; the rising sign and whole sign houses may be uncertain.');
  if (distanceToBoundary(ascendantLongitude, 30 / 9) <= 0.05) warnings.push('The ascendant is within 0.05° of a Navamsa division boundary; the D9 rising sign and houses may be uncertain.');
  if (distanceToBoundary(rawMoon, NAKSHATRA_SIZE) <= 0.05) warnings.push('The Moon is within 0.05° of a nakshatra boundary; its birth star and dasha sequence may be uncertain.');
  if (distanceToBoundary(rawMoon, PADA_SIZE) <= 0.05) warnings.push('The Moon is within 0.05° of a pada boundary; its pada may be uncertain.');
  if (Math.abs(details.latitude) >= 66.5) warnings.push('At high latitudes, the ascendant can change very rapidly; precise birth time and location are especially important.');
  return {
    calculation: {
      system: 'Sidereal Vedic', ayanamsha: 'Approximate Lahiri', ayanamshaDegrees: round(meanAyanamsha),
      ephemeris: 'Astronomy Engine', houses: 'Whole sign', nodeType: 'Mean', warnings,
    },
    moon: {
      rashi: RASHIS[Math.floor(rawMoon / 30)],
      nakshatra: { name: nakshatra.name, lord: nakshatra.lord, index: nakshatra.index },
      pada: nakshatra.pada, longitude: roundLongitude(rawMoon),
    },
    ascendant: { rashi: RASHIS[ascendantSign], signIndex: ascendantSign, longitude: roundLongitude(ascendantLongitude) },
    planets,
    navamsa: calculateNavamsa(rawPlanets.map((planet, index) => ({ ...planet, retrograde: planets[index].retrograde })), ascendantLongitude),
    dasha: buildVimshottariDasha(birth, rawMoon, asOf),
    transits: { asOf: asOf.toISOString(), planets: planetsAt(asOf, ascendantSign) },
    limits: [
      'This is an approximate analytical chart using a mean Lahiri precession model, not an exact Swiss Ephemeris or professional panchang calculation.',
      'Birth time and the historical IANA time zone must be accurate. Coordinates are used for the ascendant; planetary longitudes are geocentric.',
      'D1 and D9 Navamsa use whole sign houses and mean Rahu/Ketu. True nodes, other divisional charts, yogas, strength scores, and exact panchang timings are unavailable.',
      'D9 Navamsa divides each natal sign into nine parts and is especially sensitive to birth time and longitude boundaries. Its presence does not validate marriage forecasts.',
      'Vimshottari dates use a 365.2425-day year. Other traditional year conventions can produce different dates.',
      'Transits use natal whole sign houses. Astrological interpretations are traditional beliefs, not scientifically established predictions of future events.',
    ],
  };
}
