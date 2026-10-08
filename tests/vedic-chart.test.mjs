import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBirthDetails, calculateVedicChart, approximateLahiriAyanamsha,
  tropicalAscendant, moonNakshatra, buildVimshottariDasha, calculateTransitPlanets,
  calculateNavamsa,
} from '../server/vedic-chart.mjs';

const today = new Date('2026-10-08T00:00:00Z');
const fullProfile = {
  name: 'Mira', birthDate: '1995-05-21', birthTime: '10:30',
  birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867,
  timeZone: 'Asia/Kolkata',
};
const status400 = (error) => error.status === 400;
const angularError = (actual, expected) => Math.abs(((actual - expected + 540) % 360) - 180);

test('birth details remain optional but partial chart inputs cannot produce invented positions', () => {
  assert.equal(validateBirthDetails({ birthDate: '1995-05-21' }), null);
  assert.equal(calculateVedicChart({ name: 'Mira', birthDate: '1995-05-21' }), null);
  assert.equal(validateBirthDetails({ birthTime: '', birthPlace: '', latitude: null, longitude: null, timeZone: '' }), null);
  for (const key of ['birthTime', 'birthPlace', 'latitude', 'longitude', 'timeZone']) {
    const partial = { ...fullProfile };
    delete partial[key];
    assert.throws(() => validateBirthDetails(partial, { today }), status400, key);
  }
  assert.deepEqual(validateBirthDetails(fullProfile, { today }), {
    birthTime: '10:30', birthPlace: 'Hyderabad, India', latitude: 17.385,
    longitude: 78.4867, timeZone: 'Asia/Kolkata',
  });
  assert.equal(validateBirthDetails({ ...fullProfile, latitude: 0, longitude: 0 }, { today }).latitude, 0);
});

test('birth fields reject unsafe, impossible, and unsupported inputs with useful client errors', () => {
  for (const birthTime of ['24:00', '12:60', '9:00', '10:30:00', 10, ' 10:30', '']) {
    assert.throws(() => validateBirthDetails({ ...fullProfile, birthTime }, { today }), status400);
  }
  for (const latitude of [-91, 91, NaN, Infinity, '17.385']) {
    assert.throws(() => validateBirthDetails({ ...fullProfile, latitude }, { today }), status400);
  }
  for (const longitude of [-181, 181, NaN, Infinity, '78.4867']) {
    assert.throws(() => validateBirthDetails({ ...fullProfile, longitude }, { today }), status400);
  }
  for (const timeZone of ['Asia/Invented', '+05:30', 'UTC+05:30', '\nAsia/Kolkata', 42]) {
    assert.throws(() => validateBirthDetails({ ...fullProfile, timeZone }, { today }), status400);
  }
  for (const birthPlace of ['\nInjected', 'x'.repeat(121), 42]) {
    assert.throws(() => validateBirthDetails({ ...fullProfile, birthPlace }, { today }), status400);
  }
  for (const birthDate of ['1900-02-29', '1899-12-31', '2026-10-09', '2101-01-01', '1995-5-21']) {
    assert.throws(() => validateBirthDetails({ ...fullProfile, birthDate }, { today }), status400);
  }
  assert.throws(() => calculateVedicChart({ ...fullProfile, latitude: 90 }, { asOf: today }), status400);
  assert.throws(() => calculateVedicChart(fullProfile, { asOf: new Date('invalid') }), status400);
  assert.throws(() => calculateTransitPlanets(new Date('2101-01-01')), status400);
});

test('local birth times reject daylight-saving gaps and overlaps instead of guessing UTC', () => {
  const london = { ...fullProfile, latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' };
  assert.throws(() => validateBirthDetails({ ...london, birthDate: '2020-03-29', birthTime: '01:30' }, { today }), /does not exist|ambiguous/);
  assert.throws(() => validateBirthDetails({ ...london, birthDate: '1990-10-28', birthTime: '01:30' }, { today }), /does not exist|ambiguous/);
  assert.equal(validateBirthDetails({ ...london, birthDate: '1990-10-28', birthTime: '02:30' }, { today }).timeZone, 'Europe/London');
});

test('a birth time later on the current calendar day is rejected after resolving its time zone', () => {
  const noon = new Date('2026-10-08T12:00:00Z');
  const currentDay = { ...fullProfile, birthDate: '2026-10-08', timeZone: 'UTC' };
  assert.throws(() => validateBirthDetails({ ...currentDay, birthTime: '13:00' }, { today: noon }), /already occurred/);
  assert.equal(validateBirthDetails({ ...currentDay, birthTime: '12:00' }, { today: noon }).birthTime, '12:00');
  assert.equal(validateBirthDetails({ ...currentDay, birthTime: '11:59' }, { today: noon }).birthTime, '11:59');
  assert.throws(() => validateBirthDetails({ ...currentDay, birthTime: '08:00', timeZone: 'America/New_York' }, { today: new Date('2026-10-08T11:59:00Z') }), /already occurred/);
  assert.equal(validateBirthDetails({ ...currentDay, birthTime: '17:30', timeZone: 'Asia/Kolkata' }, { today: noon }).birthTime, '17:30');
});

// Independent reference values from pyswisseph 2.10.3.2 / Swiss Ephemeris 2.10.03:
// Lahiri, Moshier geocentric apparent grahas, mean lunar nodes, whole sign houses.
// These are numerical results, not copied code. The tolerance allows for the
// approximation used by our calculation model.
const referenceCharts = [
  {
    profile: fullProfile,
    longitude: { Sun: 35.9014265698, Moon: 302.4716630275, Mercury: 54.1699763800, Venus: 11.3390009926, Mars: 124.2288383956, Jupiter: 228.1335362333, Saturn: 329.2418459393, Rahu: 190.5474156254, Ketu: 10.5474156254 },
    ascendant: 101.8393914872, nakshatra: 22, pada: 3, lord: 'Mars', balance: 2.2023769105,
    retrograde: ['Jupiter', 'Rahu', 'Ketu'],
  },
  {
    profile: { ...fullProfile, birthDate: '2000-01-01', birthTime: '12:00', birthPlace: 'Delhi, India', latitude: 28.6139, longitude: 77.209 },
    longitude: { Sun: 256.2820886281, Moon: 196.7116876905, Mercury: 247.6795581668, Venus: 217.4355427613, Mars: 303.9323419780, Jupiter: 1.3905643658, Saturn: 16.5470440780, Rahu: 101.1995675732, Ketu: 281.1995675732 },
    ascendant: 343.1891240243, nakshatra: 14, pada: 4, lord: 'Rahu', balance: 4.4392216179,
    retrograde: ['Saturn', 'Rahu', 'Ketu'],
  },
  {
    // UTC is intentional: 01:30 Europe/London on this date is ambiguous.
    profile: { ...fullProfile, birthDate: '1990-10-28', birthTime: '01:30', birthPlace: 'London, UK', latitude: 51.5074, longitude: -0.1278, timeZone: 'UTC' },
    longitude: { Sun: 190.6405407494, Moon: 294.5342260226, Mercury: 194.4504429202, Venus: 189.4763069640, Mars: 50.4424727340, Jupiter: 108.1372630953, Saturn: 265.9605730744, Rahu: 278.8398473954, Ketu: 98.8398473954 },
    ascendant: 134.1121011197, nakshatra: 22, pada: 1, lord: 'Mars', balance: 6.3695313381,
    retrograde: ['Mars', 'Rahu', 'Ketu'],
  },
];

test('natal positions, eastern ascendant, and birth star agree with independent reference charts', () => {
  for (const reference of referenceCharts) {
    const chart = calculateVedicChart(reference.profile, { asOf: today });
    assert.equal(chart.calculation.ayanamsha, 'Approximate Lahiri');
    assert.equal(chart.calculation.nodeType, 'Mean');
    assert.equal(chart.calculation.houses, 'Whole sign');
    for (const planet of chart.planets) {
      const error = angularError(planet.longitude, reference.longitude[planet.name]);
      assert.ok(error < 0.05, `${reference.profile.birthPlace} ${planet.name}: ${error}° error`);
      assert.equal(planet.retrograde, reference.retrograde.includes(planet.name), planet.name);
      assert.equal(planet.signIndex, Math.floor(reference.longitude[planet.name] / 30));
      assert.equal(planet.house, (planet.signIndex - Math.floor(reference.ascendant / 30) + 12) % 12 + 1);
    }
    assert.ok(angularError(chart.ascendant.longitude, reference.ascendant) < 0.05, reference.profile.birthPlace);
    assert.equal(chart.moon.nakshatra.index, reference.nakshatra);
    assert.equal(chart.moon.pada, reference.pada);
    assert.equal(chart.dasha.birthBalance.lord, reference.lord);
    assert.ok(Math.abs(chart.dasha.birthBalance.years - reference.balance) < 0.001);
    assert.equal(chart.planets.find((planet) => planet.name === 'Moon').longitude, chart.moon.longitude);
  }
});

test('historical Kolkata births use the historical 05:21:10 offset instead of modern 05:30', () => {
  // Independent Swiss reference at 1900-01-01T06:38:50Z: historical
  // Asia/Kolkata noon, geocentric apparent Lahiri Moon and whole sign ascendant.
  const historical = {
    ...fullProfile, birthDate: '1900-01-01', birthTime: '12:00',
    birthPlace: 'Kolkata, India', latitude: 22.5726, longitude: 88.3639,
  };
  const chart = calculateVedicChart(historical, { asOf: today });
  assert.ok(angularError(chart.moon.longitude, 253.93003027405013) < 0.005);
  assert.ok(angularError(chart.ascendant.longitude, 1.8224261825416157) < 0.005);
  const modernOffsetGuess = calculateVedicChart({ ...historical, birthTime: '06:30', timeZone: 'UTC' }, { asOf: today });
  assert.ok(angularError(chart.moon.longitude, modernOffsetGuess.moon.longitude) > 0.05);
});

test('high-latitude ascendant selects the rising eastern antipode of the horizon intersection', () => {
  // At 80°N and GAST 272.342°, the usual atan2 formula selects the western
  // intersection. Swiss houses_ex(whole-sign) supplies the eastern apparent
  // tropical ascendant independently, including nutation.
  const ascendant = tropicalAscendant(new Date('2026-10-08T17:00:00Z'), 80, 0);
  assert.ok(angularError(ascendant, 358.2517521196096) < 0.001);
});

test('approximate Lahiri tracks independent mean ayanamshas across the supported century range', () => {
  const references = [
    ['1900-01-01T12:00:00Z', 22.460549706335215],
    ['1956-03-21T00:00:00Z', 23.245560968496193],
    ['2000-01-01T12:00:00Z', 23.857092353708822],
    ['2026-10-08T00:00:00Z', 24.23101374020024],
    ['2100-01-01T12:00:00Z', 25.2542874035733],
  ];
  for (const [instant, expected] of references) {
    assert.ok(Math.abs(approximateLahiriAyanamsha(new Date(instant)) - expected) < 0.0001, instant);
  }
});

test('nakshatra and pada edges use canonical half-open intervals with the traditional lord sequence', () => {
  assert.deepEqual(moonNakshatra(0), { name: 'Ashwini', lord: 'Ketu', index: 0, pada: 1 });
  assert.deepEqual(moonNakshatra(360), moonNakshatra(0));
  assert.equal(moonNakshatra(13.333333 - 0.000001).name, 'Ashwini');
  assert.deepEqual(moonNakshatra(360 / 27), { name: 'Bharani', lord: 'Venus', index: 1, pada: 1 });
  assert.equal(moonNakshatra(360 / 108).pada, 2);
  assert.equal(moonNakshatra(359.999999).name, 'Revati');
  assert.throws(() => moonNakshatra(Infinity), status400);
});

test('Vimshottari retains the prebirth mahadasha start so birth antardasha is correctly timed', () => {
  const birth = new Date('2000-01-01T00:00:00Z');
  // Halfway through Bharani means 10 years of a 20-year Venus period elapsed.
  const dasha = buildVimshottariDasha(birth, 20, birth);
  const yearMs = 365.2425 * 86_400_000;
  assert.deepEqual(dasha.birthBalance, { lord: 'Venus', years: 10 });
  assert.equal(dasha.periods[0].lord, 'Venus');
  assert.equal(Date.parse(dasha.periods[0].start), birth.getTime() - 10 * yearMs);
  assert.equal(Date.parse(dasha.periods[0].end), birth.getTime() + 10 * yearMs);
  assert.equal(dasha.currentMahadasha.lord, 'Venus');
  assert.equal(dasha.currentAntardasha.lord, 'Rahu');
  assert.equal(dasha.periods[0].antardashas[0].lord, 'Venus');
  assert.equal(dasha.periods[0].antardashas[0].start, dasha.periods[0].start);
  assert.ok(Date.parse(dasha.periods.at(-1).end) >= birth.getTime() + 120 * yearMs);
  for (let index = 0; index < dasha.periods.length; index += 1) {
    const period = dasha.periods[index];
    assert.equal(period.antardashas.at(-1).end, period.end);
    if (index) assert.equal(dasha.periods[index - 1].end, period.start);
    for (let subIndex = 1; subIndex < 9; subIndex += 1) {
      assert.equal(period.antardashas[subIndex - 1].end, period.antardashas[subIndex].start);
    }
  }
  const boundary = buildVimshottariDasha(birth, 20, new Date(dasha.periods[0].end));
  assert.equal(boundary.currentMahadasha.lord, 'Sun');
  assert.equal(boundary.currentAntardasha.lord, 'Sun');
  const beforeBirth = buildVimshottariDasha(birth, 20, new Date(birth.getTime() - 1));
  assert.equal(beforeBirth.currentMahadasha, null);
  assert.equal(beforeBirth.currentAntardasha, null);
});

test('classical Navamsa handles movable, fixed, and dual sign starts and independent house wrapping', () => {
  const d9 = calculateNavamsa([
    { name: 'Sun', longitude: 0, retrograde: false },
    { name: 'Moon', longitude: 30, retrograde: false },
    { name: 'Mercury', longitude: 60, retrograde: true },
    { name: 'Venus', longitude: 90, retrograde: false },
  ], 30);
  assert.equal(d9.ascendant.longitude, 270);
  assert.match(d9.ascendant.rashi, /Makara/);
  assert.deepEqual(d9.planets.map((planet) => [planet.signIndex, planet.longitude, planet.house]), [
    [0, 0, 4], [9, 270, 1], [6, 180, 10], [3, 90, 7],
  ]);
  assert.equal(d9.planets[2].retrograde, true);
  const edges = calculateNavamsa([
    { name: 'Before', longitude: 30 / 9 - 0.000001 },
    { name: 'After', longitude: 30 / 9 },
    { name: 'Wrap', longitude: 360 },
  ], 0);
  assert.equal(edges.planets[0].signIndex, 0);
  assert.equal(edges.planets[1].signIndex, 1);
  assert.equal(edges.planets[2].signIndex, 0);
  const roundingEdge = calculateNavamsa([
    { name: 'Below', longitude: 30 / 9 - 0.000000001 },
    { name: 'Above', longitude: 30 / 9 + 0.000000001 },
    { name: 'Final', longitude: 360 - 0.000000001 },
  ], 30 / 9 - 0.000000001);
  assert.equal(roundingEdge.ascendant.signIndex, 0);
  assert.ok(roundingEdge.ascendant.longitude < 30);
  assert.equal(roundingEdge.planets[0].signIndex, 0);
  assert.ok(roundingEdge.planets[0].longitude < 30);
  assert.equal(roundingEdge.planets[1].signIndex, 1);
  assert.equal(roundingEdge.planets[2].signIndex, 11);
  assert.ok(roundingEdge.planets[2].longitude < 360);
  const actual = calculateVedicChart(fullProfile, { asOf: today });
  assert.equal(actual.navamsa.planets.length, 9);
  assert.ok(actual.limits.some((limit) => /D9.*sensitive/.test(limit)));
});

test('chart and transits expose computations and limitations without forwarding birth identity', () => {
  const chart = calculateVedicChart(fullProfile, { asOf: today });
  assert.deepEqual(calculateVedicChart({ ...fullProfile, name: 'Other name', birthPlace: 'Other label' }, { asOf: today }), chart);
  const serialized = JSON.stringify(chart);
  for (const privateValue of ['Mira', 'Hyderabad', '1995-05-21', 'Asia/Kolkata']) {
    assert.equal(serialized.includes(privateValue), false, privateValue);
  }
  assert.equal(chart.transits.asOf, today.toISOString());
  assert.equal(chart.transits.planets.length, 9);
  assert.ok(chart.limits.some((limit) => /365\.2425/.test(limit)));
  assert.ok(chart.limits.some((limit) => /True nodes/.test(limit)));
  assert.ok(chart.calculation.warnings.some((warning) => /0\.05°/.test(warning)));
  assert.deepEqual(chart.transits.planets, calculateTransitPlanets(today, Math.floor(chart.ascendant.longitude / 30)));
  assert.throws(() => tropicalAscendant(today, 90, 0), status400);
});
