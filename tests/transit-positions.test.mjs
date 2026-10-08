import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTransitPlanets, calculateTransitPositions, calculateVedicChart } from '../server/vedic-chart.mjs';
import { estimateMarriageWindows } from '../server/vedic-timing.mjs';
import { estimateCareerWindows, describeDifficultPeriods } from '../server/vedic-forecast.mjs';
import { calculateCareerPlanningDates } from '../server/career-planning-dates.mjs';

const profile = {
  name: 'Mira', birthDate: '1995-05-21', birthTime: '10:30', birthPlace: 'Hyderabad, India',
  latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata',
};
const asOf = new Date('2026-10-08T12:00:00Z');
const positionFields = ({ retrograde, ...position }) => position;

test('selected instantaneous positions retain the full ephemeris classifications and rounded longitudes', () => {
  for (const instant of ['1900-01-01T00:00:00Z', '2000-02-29T12:30:00Z', '2026-10-08T12:00:00Z', '2050-12-31T18:00:00Z', '2100-12-31T23:59:59Z']) {
    const date = new Date(instant);
    const full = calculateTransitPlanets(date, 7);
    for (const names of [['Jupiter', 'Saturn'], ['Mercury'], ['Sun', 'Moon'], ['Ketu', 'Rahu']]) {
      assert.deepEqual(calculateTransitPositions(date, 7, names), names.map(name => positionFields(full.find(planet => planet.name === name))));
    }
    assert.deepEqual(calculateTransitPositions(date, 7), full.map(positionFields));
  }
});

test('instantaneous sampling validates the same supported dates and natal ascendant, plus body selections', () => {
  const status400 = error => error.status === 400;
  for (const date of [new Date('invalid'), new Date('1899-12-31'), new Date('2101-01-01')]) {
    assert.throws(() => calculateTransitPositions(date), status400);
  }
  for (const sign of [-1, 12, 1.5, '0']) assert.throws(() => calculateTransitPositions(asOf, sign), status400);
  for (const names of [null, [], ['Pluto'], ['Sun', 'Sun'], 'Moon']) {
    assert.throws(() => calculateTransitPositions(asOf, 0, names), status400);
  }
});

test('forecast dates, ages, ranking factors and planning details match full retrograde sampling', () => {
  const records = [
    { profile, asOf },
    { profile: { ...profile, birthDate: '2000-02-29', birthTime: '23:45' }, asOf: new Date('2027-02-28T20:00:00Z') },
    { profile: { ...profile, birthDate: '1988-09-11', birthTime: '08:05', birthPlace: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' }, asOf: new Date('2026-10-08T23:45:00Z') },
  ];
  for (const record of records) {
    const chart = calculateVedicChart(record.profile, { asOf: record.asOf });
    const options = { asOf: record.asOf, horizonYears: 3 };
    assert.deepEqual(estimateMarriageWindows(record.profile, chart, options), estimateMarriageWindows(record.profile, chart, { ...options, transitProvider: calculateTransitPlanets }));
    assert.deepEqual(estimateCareerWindows(record.profile, chart, options), estimateCareerWindows(record.profile, chart, { ...options, transitProvider: calculateTransitPlanets, planningTransitProvider: calculateTransitPlanets }));
    assert.deepEqual(describeDifficultPeriods(record.profile, chart, options), describeDifficultPeriods(record.profile, chart, { ...options, transitProvider: calculateTransitPlanets }));
    assert.deepEqual(calculateCareerPlanningDates(record.profile, chart, options), calculateCareerPlanningDates(record.profile, chart, { ...options, transitProvider: calculateTransitPlanets }));
  }
});

test('injected forecast providers retain their date and ascendant argument contract', () => {
  const chart = calculateVedicChart(profile, { asOf });
  let calls = 0;
  function provider(...args) {
    assert.equal(args.length, 2);
    assert.ok(args[0] instanceof Date);
    assert.equal(args[1], chart.ascendant.signIndex);
    calls++;
    return calculateTransitPlanets(...args);
  }
  estimateMarriageWindows(profile, chart, { asOf, horizonYears: 1, transitProvider: provider });
  estimateCareerWindows(profile, chart, { asOf, horizonYears: 1, transitProvider: provider, planningTransitProvider: provider });
  describeDifficultPeriods(profile, chart, { asOf, horizonYears: 1, transitProvider: provider });
  assert.ok(calls > 0);
});

test('instantaneous results are fresh for each instant and callers cannot alter subsequent samples', () => {
  const first = calculateTransitPositions(asOf, 0, ['Moon']);
  const expected = structuredClone(first);
  first[0].longitude = 0;
  first[0].signIndex = 11;
  assert.deepEqual(calculateTransitPositions(asOf, 0, ['Moon']), expected);
  const nextDay = new Date(asOf.getTime() + 86_400_000);
  assert.notEqual(calculateTransitPositions(nextDay, 0, ['Moon'])[0].longitude, expected[0].longitude);
});
