import * as Astronomy from 'astronomy-engine';
import { Temporal } from '@js-temporal/polyfill';
import { normalizeDegrees, validateBirthDetails } from './vedic-chart.mjs';

const DAY_MS = 86_400_000;
const YOGA_SIZE = 360 / 27;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TITHIS = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
  'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi',
  'Trayodashi', 'Chaturdashi',
];
const YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
  'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata',
  'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha',
  'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra',
  'Vaidhriti',
];
const REPEATING_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja', 'Vanija', 'Vishti'];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function roundDegrees(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function nearBoundary(longitude, size) {
  const within = longitude % size;
  return Math.min(within, size - within) <= 0.05 + Number.EPSILON * 360;
}

function planetLongitude(chart, name) {
  const value = Array.isArray(chart?.planets)
    ? chart.planets.find((planet) => planet?.name === name)?.longitude : undefined;
  if (!Number.isFinite(value)) {
    throw badRequest('A calculated chart with valid Sun and Moon longitudes is required for the birth Panchanga.');
  }
  return normalizeDegrees(value);
}

function karanaName(index) {
  if (index === 0) return 'Kimstughna';
  if (index === 57) return 'Shakuni';
  if (index === 58) return 'Chatushpada';
  if (index === 59) return 'Naga';
  return REPEATING_KARANAS[(index - 1) % REPEATING_KARANAS.length];
}

function sunEvent(direction, observer, start, end, timeZone) {
  const startMs = Number(start.epochMilliseconds);
  const endMs = Number(end.epochMilliseconds);
  const event = Astronomy.SearchRiseSet(
    Astronomy.Body.Sun, observer, direction, new Date(startMs), (endMs - startMs) / DAY_MS,
  );
  // A civil day can last 23 or 25 hours, and some places have polar day/night.
  // Do not borrow a rise or set from the next date when this date has none.
  if (!event || event.date.getTime() < startMs || event.date.getTime() >= endMs) return null;
  const local = Temporal.Instant.fromEpochMilliseconds(event.date.getTime()).toZonedDateTimeISO(timeZone);
  return {
    local: `${local.toPlainDateTime().toString({ smallestUnit: 'minute' })}${local.offset}[${timeZone}]`,
    localTime: local.toPlainTime().toString({ smallestUnit: 'minute' }),
    utc: event.date.toISOString(),
    timeZone,
  };
}

/** Panchanga divisions at birth, using the chart's existing geocentric longitudes. */
export function calculateBirthPanchanga(profile, chart) {
  const details = validateBirthDetails(profile);
  if (!details) throw badRequest('Complete birth details are required for the birth Panchanga.');
  const sun = planetLongitude(chart, 'Sun');
  const moon = planetLongitude(chart, 'Moon');
  const date = Temporal.PlainDate.from(profile.birthDate);
  const [hour, minute] = details.birthTime.split(':').map(Number);
  const birth = Temporal.ZonedDateTime.from({
    timeZone: details.timeZone,
    year: date.year, month: date.month, day: date.day, hour, minute,
  }, { disambiguation: 'reject', overflow: 'reject' });
  const elongation = normalizeDegrees(moon - sun);
  const tithiIndex = Math.floor(elongation / 12) + 1;
  const dayInPaksha = (tithiIndex - 1) % 15 + 1;
  const yogaLongitude = normalizeDegrees(sun + moon);
  const yogaIndex = Math.floor(yogaLongitude / YOGA_SIZE) + 1;
  const karanaIndex = Math.floor(elongation / 6);
  const boundaryWarnings = [];
  if (nearBoundary(elongation, 12)) {
    boundaryWarnings.push('The Sun–Moon separation is within 0.05° of a tithi boundary; verify the birth tithi before interpreting it.');
  }
  if (nearBoundary(elongation, 6)) {
    boundaryWarnings.push('The Sun–Moon separation is within 0.05° of a karana boundary; verify the birth karana before interpreting it.');
  }
  if (nearBoundary(yogaLongitude, YOGA_SIZE)) {
    boundaryWarnings.push('The combined sidereal Sun–Moon longitude is within 0.05° of a yoga boundary; verify the birth yoga before interpreting it.');
  }
  const start = date.toZonedDateTime(details.timeZone);
  const end = date.add({ days: 1 }).toZonedDateTime(details.timeZone);
  const observer = new Astronomy.Observer(details.latitude, details.longitude, 0);
  const sunrise = sunEvent(1, observer, start, end, details.timeZone);
  const sunset = sunEvent(-1, observer, start, end, details.timeZone);
  const notes = [
    'Tithi, yoga and karana are calculated at the birth instant from the chart’s approximate Lahiri sidereal Sun and Moon positions. Names use English transliteration.',
    'Weekday follows the local civil date beginning at midnight. The traditional sunrise-based panchanga weekday can differ for births before sunrise.',
    'Sunrise and sunset use a sea-level horizon and standard atmospheric refraction. Terrain, elevation and actual weather can change the observed times.',
    'Exact tithi, yoga and karana end times, Hindu lunar month, lunar year, era names and regional calendar conventions are not calculated.',
  ];
  if (!sunrise || !sunset) {
    notes.push('A missing sunrise or sunset means no corresponding horizon crossing was found on the local birth date, as can happen during polar day or night.');
  }
  return {
    method: 'Approximate birth Panchanga; geocentric chart longitudes and historical local civil date',
    birthInstantUtc: birth.toInstant().toString(),
    civilWeekday: {
      name: WEEKDAYS[date.dayOfWeek - 1], index: date.dayOfWeek,
      date: date.toString(), timeZone: details.timeZone,
    },
    tithi: {
      index: tithiIndex,
      name: dayInPaksha === 15 ? (tithiIndex === 15 ? 'Purnima' : 'Amavasya') : TITHIS[dayInPaksha - 1],
      paksha: tithiIndex <= 15 ? 'Shukla' : 'Krishna',
      phase: tithiIndex <= 15 ? 'Waxing' : 'Waning',
      dayInPaksha,
      elongationDegrees: roundDegrees(elongation),
    },
    yoga: { index: yogaIndex, name: YOGAS[yogaIndex - 1], combinedLongitudeDegrees: roundDegrees(yogaLongitude) },
    karana: { index: karanaIndex, name: karanaName(karanaIndex) },
    sunrise,
    sunset,
    boundaryWarnings,
    notes,
  };
}
