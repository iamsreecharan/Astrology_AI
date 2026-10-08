import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCareerPlanningDates } from '../server/career-planning-dates.mjs';
import { calculateTransitPlanets, calculateVedicChart, normalizeDegrees } from '../server/vedic-chart.mjs';

const profile = {
  name: 'Mira', birthDate: '1995-05-21', birthTime: '10:30',
  birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867,
  timeZone: 'Asia/Kolkata',
};
const now = new Date('2026-10-08T00:00:00Z');
const chartFor = (moon = 10) => ({ ascendant: { longitude: 101.839 }, planets: [{ name: 'Moon', longitude: moon }] });
const positionsFor = (moon, elongation = 15) => [
  { name: 'Sun', longitude: normalizeDegrees(moon - elongation) },
  { name: 'Moon', longitude: moon },
];
const calendarFor = (moon, elongation = 15, birthMoon = 10, options = {}) => calculateCareerPlanningDates(profile, chartFor(birthMoon), {
  asOf: now, horizonDays: 1, transitProvider: () => positionsFor(moon, elongation), ...options,
});

test('Tarabala counts across the 27-star wrap and requires explicitly supportive relationships', () => {
  const cases = [
    [10, 20, 2, 'Sampat', 2],
    [10, 167, 4, 'Kshema', 13],
    [10, 73, 6, 'Sadhana', 6],
    [55, 33, 8, 'Mitra', 26],
    [55, 46, 9, 'Parama Mitra', 27],
  ];
  for (const [birthMoon, moon, index, name, countFromBirthStar] of cases) {
    const calendar = calendarFor(moon, 15, birthMoon);
    assert.equal(calendar.dates.length, 1, `${name} qualifies`);
    assert.deepEqual(calendar.dates[0].tara, { index, name, countFromBirthStar });
  }
  // These retain otherwise acceptable sign/tithi support, isolating the Tara rule.
  for (const moon of [10, 153, 183, 87]) {
    const result = calendarFor(moon);
    assert.equal(result.dates.length, 0, `10° to ${moon}° is not supportive`);
  }
  assert.deepEqual(calendarFor(33, 15, 350).dates[0].tara, { index: 4, name: 'Kshema', countFromBirthStar: 4 });
  assert.equal(calendarFor(20, 15, 350).dates.length, 0, 'Revati to Bharani is Vipat (3), not a wraparound positive');
});

test('Chandrabala counts from the natal Moon, rather than the natal ascendant', () => {
  for (const [moon, expectedHouse] of [[20, 1], [73, 3], [167, 6], [187, 7], [287, 10], [313, 11]]) {
    const row = calendarFor(moon).dates[0];
    assert.ok(row, `${expectedHouse}th Moon-relative sign qualifies`);
    assert.equal(row.moonRelativeHouse, expectedHouse);
  }
  for (const moon of [47, 113, 140, 233, 260, 353]) {
    assert.equal(calendarFor(moon).dates.length, 0, `${moon}° is outside supported Moon-relative signs`);
  }
});

test('the tithi filter excludes Rikta in both halves and Amavasya without excluding every waning date', () => {
  for (const elongation of [42, 102, 162, 222, 282, 342, 354]) {
    assert.equal(calendarFor(20, elongation).dates.length, 0, `${elongation}° is excluded`);
  }
  assert.deepEqual(calendarFor(20, 15).dates[0].tithi, { index: 2, name: 'Dwitiya', paksha: 'Shukla', dayInPaksha: 2 });
  assert.deepEqual(calendarFor(20, 195).dates[0].tithi, { index: 17, name: 'Dwitiya', paksha: 'Krishna', dayInPaksha: 2 });
  assert.deepEqual(calendarFor(20, 174).dates[0].tithi, { index: 15, name: 'Purnima', paksha: 'Shukla', dayInPaksha: 15 });
});

test('near-boundary samples are excluded and uncertain natal classifications yield no invented dates', () => {
  for (const [moon, elongation] of [[26.65, 15], [29.97, 15], [20, 11.98], [20, 12.02]]) {
    const result = calendarFor(moon, elongation);
    assert.equal(result.dates.length, 0);
    assert.equal(result.excludedBoundaryDays, 1);
    assert.equal(result.status, 'no-dates');
  }
  for (const birthMoon of [13.34, 29.98]) {
    const result = calendarFor(20, 15, birthMoon, { transitProvider: () => { throw new Error('Uncertain natal chart must not choose dates.'); } });
    assert.equal(result.status, 'uncertain-natal');
    assert.equal(result.evaluatedDays, 0);
    assert.equal(result.dates.length, 0);
    assert.ok(result.limits.some((value) => value.includes('verify')));
  }
});

test('the calendar preserves chronological civil dates, a 90-date horizon and its hard result limit', () => {
  const result = calculateCareerPlanningDates(profile, chartFor(), { asOf: now, transitProvider: () => positionsFor(20) });
  assert.equal(result.status, 'available');
  assert.deepEqual(result.horizon, { start: '2026-10-08', end: '2027-01-05', endExclusive: '2027-01-06', days: 90, timeZone: 'Asia/Kolkata' });
  assert.deepEqual(result.dates.map((row) => row.date), [
    '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
  ]);
  assert.equal(result.qualifyingDays, 90);
  assert.equal(result.evaluatedDays, 90);
  assert.equal(result.dates[0].displayDate, '08-10-2026');
  assert.equal(result.dates[0].weekday, 'Thursday');
  assert.equal(result.dates[0].sampleLocal, '2026-10-08T12:00+05:30[Asia/Kolkata]');
  assert.equal(result.dates[0].sampleUtc, '2026-10-08T06:30:00.000Z');
  assert.ok(result.dates[0].reasons.some((value) => value.includes('Jupiter and guidance')));
  assert.equal(result.dates[1].weekday, 'Friday');
  assert.equal(result.dates[1].reasons.length, 3, 'Wednesday/Thursday context is optional');
  assert.ok(result.limits.some((value) => value.includes('not a full muhurta')));
  assert.ok(result.limits.some((value) => value.includes('Continue searching now')));
});

test('empty calendars stay empty and a passed noon is skipped rather than advertised as upcoming', () => {
  const empty = calendarFor(47, 15, 10, { horizonDays: 5 });
  assert.equal(empty.status, 'no-dates');
  assert.equal(empty.qualifyingDays, 0);
  assert.deepEqual(empty.dates, []);
  const late = calendarFor(20, 15, 10, { asOf: new Date('2026-10-08T06:31:00Z'), horizonDays: 3 });
  assert.deepEqual(late.dates.map((row) => row.date), ['2026-10-09', '2026-10-10']);
  assert.equal(late.evaluatedDays, 2);
  assert.ok(late.dates.every((row) => Date.parse(row.sampleUtc) > Date.parse(late.sampledAt)));
});

test('local civil dates remain correct across UTC boundaries and daylight-saving transitions', () => {
  const newYork = { ...profile, birthPlace: 'New York, United States', latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' };
  const afterUtcMidnight = calculateCareerPlanningDates(newYork, chartFor(), {
    asOf: new Date('2026-10-09T00:30:00Z'), horizonDays: 2, transitProvider: () => positionsFor(20),
  });
  assert.equal(afterUtcMidnight.horizon.start, '2026-10-08');
  assert.equal(afterUtcMidnight.dates[0].date, '2026-10-09');
  const transition = calculateCareerPlanningDates(newYork, chartFor(), {
    asOf: new Date('2026-10-31T00:00:00Z'), horizonDays: 4, transitProvider: () => positionsFor(20),
  });
  assert.deepEqual(transition.dates.map((row) => row.sampleUtc), ['2026-10-31T16:00:00.000Z', '2026-11-01T17:00:00.000Z', '2026-11-02T17:00:00.000Z']);
  assert.match(transition.dates[0].sampleLocal, /12:00-04:00/);
  assert.match(transition.dates[1].sampleLocal, /12:00-05:00/);
  const samoa = calculateCareerPlanningDates({ ...profile, birthDate: '1990-05-21', timeZone: 'Pacific/Apia' }, chartFor(), {
    asOf: new Date('2011-12-29T00:00:00Z'), horizonDays: 3, transitProvider: () => positionsFor(20),
  });
  assert.deepEqual(samoa.dates.map((row) => row.date), ['2011-12-29']);
  assert.ok(!samoa.dates.some((row) => row.date === '2011-12-30'), 'Samoa skipped that civil date entirely');
});

test('adult eligibility clips dates and a February 29 birthday uses March 1 in a non-leap year', () => {
  const beforeEighteen = { ...profile, birthDate: '2008-10-18' };
  const clipped = calculateCareerPlanningDates(beforeEighteen, chartFor(), {
    asOf: now, horizonDays: 12, transitProvider: () => positionsFor(20),
  });
  assert.deepEqual(clipped.dates.map((row) => row.date), ['2026-10-18', '2026-10-19']);
  const child = calculateCareerPlanningDates({ ...profile, birthDate: '2010-05-21' }, chartFor(), {
    asOf: now, transitProvider: () => { throw new Error('No adult dates should be sampled.'); },
  });
  assert.equal(child.status, 'under-age');
  assert.equal(child.evaluatedDays, 0);
  const leapBirthday = calculateCareerPlanningDates({ ...profile, birthDate: '2008-02-29' }, chartFor(), {
    asOf: new Date('2026-02-28T00:00:00Z'), horizonDays: 3, transitProvider: () => positionsFor(20),
  });
  assert.deepEqual(leapBirthday.dates.map((row) => row.date), ['2026-03-01', '2026-03-02']);
});

test('real noon selections agree with independent Swiss Lahiri longitudes and recorded traditional divisions', () => {
  // Swiss Ephemeris 2.10.03, Moshier apparent geocentric Sun/Moon,
  // Lahiri sidereal mode, 12:00 Asia/Kolkata. The divisions below were
  // recorded independently alongside these numerical reference positions.
  const reference = [
    { date: '2026-10-16', sun: 178.6831392349, moon: 242.5770020611, star: 'Mula', tara: 'Sadhana', taraIndex: 6, house: 11, tithi: 'Shashthi', tithiIndex: 6 },
    { date: '2026-10-22', sun: 184.641546138, moon: 315.2510011737, star: 'Shatabhisha', tara: 'Sampat', taraIndex: 2, house: 1, tithi: 'Ekadashi', tithiIndex: 11 },
  ];
  const chart = calculateVedicChart(profile, { asOf: now });
  const result = calculateCareerPlanningDates(profile, chart, { asOf: now, horizonDays: 17 });
  assert.deepEqual(result.dates.map((row) => row.date), reference.map((row) => row.date));
  for (const expected of reference) {
    const row = result.dates.find((entry) => entry.date === expected.date);
    const transits = calculateTransitPlanets(new Date(row.sampleUtc), chart.ascendant.signIndex);
    assert.ok(Math.abs(transits.find((planet) => planet.name === 'Sun').longitude - expected.sun) < 0.05);
    assert.ok(Math.abs(transits.find((planet) => planet.name === 'Moon').longitude - expected.moon) < 0.05);
    assert.deepEqual([row.nakshatra.name, row.tara.name, row.tara.index, row.moonRelativeHouse, row.tithi.name, row.tithi.index],
      [expected.star, expected.tara, expected.taraIndex, expected.house, expected.tithi, expected.tithiIndex]);
    assert.equal(row.tithi.paksha, 'Shukla');
    assert.equal(row.warnings.length, 0);
  }
});

test('invalid chart, birth details, horizon, provider data and unsupported calculation years fail clearly', () => {
  const base = { asOf: now, horizonDays: 1, transitProvider: () => positionsFor(20) };
  const status400 = (error) => error.status === 400;
  for (const options of [{ asOf: new Date('invalid') }, { horizonDays: 0 }, { horizonDays: 91 }, { limit: 0 }, { limit: 9 }]) {
    assert.throws(() => calculateCareerPlanningDates(profile, chartFor(), { ...base, ...options }), status400);
  }
  assert.throws(() => calculateCareerPlanningDates({ name: 'Mira', birthDate: profile.birthDate }, chartFor(), base), status400);
  assert.throws(() => calculateCareerPlanningDates(profile, chartFor(NaN), base), status400);
  assert.throws(() => calculateCareerPlanningDates(profile, { planets: [{ name: 'Moon', longitude: 10 }] }, base), status400);
  assert.throws(() => calculateCareerPlanningDates(profile, { planets: {}, ascendant: { longitude: 10 } }, base), status400);
  assert.throws(() => calculateCareerPlanningDates(profile, chartFor(), { ...base, transitProvider: () => [{ name: 'Sun', longitude: 20 }] }), /valid Moon/);
  assert.throws(() => calculateCareerPlanningDates(profile, chartFor(), { ...base, transitProvider: null }), TypeError);
  assert.throws(() => calculateCareerPlanningDates(profile, chartFor(), { ...base, asOf: new Date('2100-12-31T00:00:00Z'), horizonDays: 2 }), status400);
});
