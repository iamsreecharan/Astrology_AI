import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBirthPanchanga } from '../server/birth-panchanga.mjs';
import { calculateVedicChart } from '../server/vedic-chart.mjs';

const profile = {
  name: 'Mira', birthDate: '1995-05-21', birthTime: '10:30',
  birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867,
  timeZone: 'Asia/Kolkata',
};
const chartFor = (sun, moon) => ({ planets: [{ name: 'Sun', longitude: sun }, { name: 'Moon', longitude: moon }] });
const panchangaFor = (sun, moon, birth = profile) => calculateBirthPanchanga(birth, chartFor(sun, moon));

test('tithi distinguishes waxing, full-moon, waning and new-moon divisions', () => {
  const cases = [
    [0.5, 1, 'Pratipada', 'Shukla', 1],
    [12.5, 2, 'Dwitiya', 'Shukla', 2],
    [77, 7, 'Saptami', 'Shukla', 7],
    [179, 15, 'Purnima', 'Shukla', 15],
    [180.5, 16, 'Pratipada', 'Krishna', 1],
    [266, 23, 'Ashtami', 'Krishna', 8],
    [359.5, 30, 'Amavasya', 'Krishna', 15],
  ];
  for (const [elongation, index, name, paksha, day] of cases) {
    const { tithi } = panchangaFor(40, 40 + elongation);
    assert.deepEqual(
      [tithi.index, tithi.name, tithi.paksha, tithi.dayInPaksha],
      [index, name, paksha, day], `${elongation}° elongation`,
    );
  }
  // The exact conjunction/opposition starts the next division; it is not
  // the whole interval traditionally named Amavasya/Purnima.
  assert.equal(panchangaFor(120, 120).tithi.name, 'Pratipada');
  assert.equal(panchangaFor(120, 300).tithi.paksha, 'Krishna');
  assert.equal(panchangaFor(359, 1).tithi.elongationDegrees, 2);
  assert.equal(panchangaFor(1, 359).tithi.name, 'Amavasya');
});

test('karana follows the repeated seven names between its four fixed divisions', () => {
  const cases = [
    [3, 0, 'Kimstughna'], [9, 1, 'Bava'], [15, 2, 'Balava'],
    [21, 3, 'Kaulava'], [27, 4, 'Taitila'], [33, 5, 'Garaja'],
    [39, 6, 'Vanija'], [45, 7, 'Vishti'], [51, 8, 'Bava'],
    [339, 56, 'Vishti'], [345, 57, 'Shakuni'],
    [351, 58, 'Chatushpada'], [357, 59, 'Naga'],
  ];
  for (const [elongation, index, name] of cases) {
    assert.deepEqual(panchangaFor(0, elongation).karana, { index, name });
  }
  assert.equal(panchangaFor(359, 362).karana.name, 'Kimstughna');
});

test('yoga uses the sidereal sum, including the last interval and longitude wrap', () => {
  assert.deepEqual(panchangaFor(20, 5).yoga, { index: 2, name: 'Priti', combinedLongitudeDegrees: 25 });
  assert.equal(panchangaFor(100, 74).yoga.name, 'Harshana');
  assert.equal(panchangaFor(200, 159).yoga.name, 'Vaidhriti');
  assert.deepEqual(panchangaFor(359, 1).yoga, { index: 1, name: 'Vishkambha', combinedLongitudeDegrees: 0 });
  assert.equal(panchangaFor(-1, 361).yoga.name, 'Vishkambha');
});

test('birth Panchanga warns on both sides of a division and keeps ordinary values clear', () => {
  for (const elongation of [11.95, 11.96, 12, 12.04, 12.05, 359.95, 359.96, 0.04]) {
    const warnings = panchangaFor(20, 20 + elongation).boundaryWarnings;
    assert.ok(warnings.some((value) => value.includes('tithi boundary')), `${elongation}° tithi`);
    assert.ok(warnings.some((value) => value.includes('karana boundary')), `${elongation}° karana`);
  }
  const karanaOnly = panchangaFor(20, 26.02).boundaryWarnings;
  assert.ok(karanaOnly.some((value) => value.includes('karana boundary')));
  assert.ok(!karanaOnly.some((value) => value.includes('tithi boundary')));
  for (const elongation of [11.94, 12.06]) {
    assert.ok(!panchangaFor(20, 20 + elongation).boundaryWarnings.some((value) => value.includes('tithi boundary')));
  }
  for (const sum of [13.3, 13.333333333333334, 13.36, 359.98, 0.02]) {
    assert.ok(panchangaFor(0, sum).boundaryWarnings.some((value) => value.includes('yoga boundary')), `${sum}° yoga`);
  }
  assert.equal(panchangaFor(35.9, 302.47).boundaryWarnings.length, 0);
});

test('weekday and birth instant respect the historical local civil date', () => {
  const losAngeles = {
    ...profile, birthDate: '2000-01-01', birthTime: '23:30',
    birthPlace: 'Los Angeles, United States', latitude: 34.0522, longitude: -118.2437,
    timeZone: 'America/Los_Angeles',
  };
  const local = panchangaFor(35.9, 302.47, losAngeles);
  assert.equal(local.birthInstantUtc, '2000-01-02T07:30:00Z');
  assert.deepEqual(local.civilWeekday, {
    name: 'Saturday', index: 6, date: '2000-01-01', timeZone: 'America/Los_Angeles',
  });
  const historical = panchangaFor(35.9, 302.47, {
    ...profile, birthDate: '1900-01-01', birthTime: '12:00',
    birthPlace: 'Kolkata, India', latitude: 22.5726, longitude: 88.3639,
  });
  assert.equal(historical.birthInstantUtc, '1900-01-01T06:38:50Z');
  assert.equal(historical.civilWeekday.name, 'Monday');
  assert.match(historical.sunrise.local, /\+05:21:10/);
  assert.ok(historical.notes.some((value) => value.includes('sunrise-based')));
});

test('actual calculated samples match divisions from independent Swiss Lahiri reference longitudes', () => {
  // References also used in vedic-chart.test.mjs: Swiss Ephemeris 2.10.03,
  // geocentric apparent Sun/Moon, Lahiri. Expected divisions are recorded
  // explicitly rather than running our classification formula in the test.
  const cases = [
    {
      birth: profile,
      referenceSun: 35.9014265698, referenceMoon: 302.4716630275,
      expected: ['Ashtami', 'Krishna', 23, 'Indra', 26, 'Balava', 44],
    },
    {
      birth: { ...profile, birthDate: '2000-01-01', birthTime: '12:00', birthPlace: 'Delhi, India', latitude: 28.6139, longitude: 77.209 },
      referenceSun: 256.2820886281, referenceMoon: 196.7116876905,
      expected: ['Ekadashi', 'Krishna', 26, 'Sukarma', 7, 'Bava', 50],
    },
  ];
  for (const sample of cases) {
    const chart = calculateVedicChart(sample.birth, { asOf: new Date('2026-10-08T00:00:00Z') });
    for (const [name, longitude] of [['Sun', sample.referenceSun], ['Moon', sample.referenceMoon]]) {
      assert.ok(Math.abs(chart.planets.find((planet) => planet.name === name).longitude - longitude) < 0.05);
    }
    const { tithi, yoga, karana, boundaryWarnings } = calculateBirthPanchanga(sample.birth, chart);
    assert.deepEqual(
      [tithi.name, tithi.paksha, tithi.index, yoga.name, yoga.index, karana.name, karana.index],
      sample.expected,
    );
    assert.equal(boundaryWarnings.length, 0);
  }
});

test('sunrise and sunset belong to the birth civil day even across daylight-saving changes', () => {
  const ordinary = panchangaFor(35.9, 302.47);
  assert.match(ordinary.sunrise.local, /^1995-05-21T05:[34]\d\+05:30\[Asia\/Kolkata\]$/);
  assert.match(ordinary.sunset.local, /^1995-05-21T18:[34]\d\+05:30\[Asia\/Kolkata\]$/);
  assert.ok(Date.parse(ordinary.sunset.utc) > Date.parse(ordinary.sunrise.utc));
  for (const birthDate of ['2020-03-08', '2020-11-01']) {
    const changed = panchangaFor(35.9, 302.47, {
      ...profile, birthDate, birthTime: '12:00', birthPlace: 'New York, United States',
      latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York',
    });
    assert.ok(changed.sunrise.local.startsWith(`${birthDate}T`));
    assert.ok(changed.sunset.local.startsWith(`${birthDate}T`));
    assert.ok(Date.parse(changed.sunset.utc) > Date.parse(changed.sunrise.utc));
  }
});

test('polar day and night return absent events without inventing clock times', () => {
  for (const birthDate of ['2000-06-21', '2000-12-21']) {
    const polar = panchangaFor(35.9, 302.47, {
      ...profile, birthDate, birthTime: '12:00', birthPlace: 'Longyearbyen, Norway',
      latitude: 78.2232, longitude: 15.6469, timeZone: 'Arctic/Longyearbyen',
    });
    assert.equal(polar.sunrise, null);
    assert.equal(polar.sunset, null);
    assert.ok(polar.notes.some((value) => value.includes('no corresponding horizon crossing')));
  }
});

test('Panchanga requires complete valid details and actual Sun/Moon longitudes', () => {
  const status400 = (error) => error.status === 400;
  assert.throws(() => calculateBirthPanchanga({ name: 'Mira', birthDate: '1995-05-21' }, chartFor(20, 50)), status400);
  assert.throws(() => calculateBirthPanchanga({ ...profile, birthTime: '25:00' }, chartFor(20, 50)), status400);
  assert.throws(() => calculateBirthPanchanga({ ...profile, timeZone: 'Asia/Invented' }, chartFor(20, 50)), status400);
  for (const chart of [null, {}, { planets: {} }, { planets: [{ name: 'Sun', longitude: 20 }] }, chartFor(NaN, 50), chartFor(20, Infinity)]) {
    assert.throws(() => calculateBirthPanchanga(profile, chart), status400);
  }
  const report = panchangaFor(35.9, 302.47);
  assert.ok(report.notes.some((value) => value.includes('not calculated')));
  assert.equal(report.tithi.endTime, undefined);
  assert.equal(report.lunarMonth, undefined);
});
