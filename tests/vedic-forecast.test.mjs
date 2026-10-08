import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateVedicChart } from '../server/vedic-chart.mjs';
import { estimateCareerWindows, describeDifficultPeriods } from '../server/vedic-forecast.mjs';

const profile = {
  name: 'Mira', birthDate: '2000-06-12', birthTime: '12:15',
  birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata',
};
const status400 = (error) => error.status === 400;
const careerSupport = () => [{ name: 'Jupiter', signIndex: 3 }];
const careerUnsupported = () => [{ name: 'Jupiter', signIndex: 0 }];

function period(start, end, lord = 'Venus') {
  return { start, end, lord };
}

function chartWith(antardashas, {
  lord = 'Saturn', start = '2026-01-01T00:00:00Z', end = '2036-01-01T00:00:00Z',
} = {}) {
  return {
    ascendant: { signIndex: 0, longitude: 15 },
    planets: [
      { name: 'Saturn', signIndex: 3 }, { name: 'Mercury', signIndex: 1 },
      { name: 'Venus', signIndex: 4 }, { name: 'Moon', signIndex: 1 },
    ],
    dasha: { periods: [{ lord, start, end, antardashas }] },
    limits: ['Fixture analytical precision limit.'], calculation: { warnings: ['Fixture rashi-boundary warning.'] },
  };
}

function saturn(signIndex) {
  return [{ name: 'Saturn', signIndex }];
}

test('both forecast methods require complete birth data, a calculated chart, and a supported horizon', () => {
  const chart = chartWith([period('2026-01-01', '2027-01-01')]);
  const options = { asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: () => saturn(3) };
  for (const forecast of [estimateCareerWindows, describeDifficultPeriods]) {
    assert.throws(() => forecast({ name: 'Mira', birthDate: profile.birthDate }, chart, options), status400);
    assert.throws(() => forecast({ ...profile, timeZone: 'Invalid/Zone' }, chart, options), status400);
    assert.throws(() => forecast(profile, null, options), status400);
    assert.throws(() => forecast(profile, { ...chart, dasha: { periods: [] } }, options), status400);
    assert.throws(() => forecast(profile, chart, { ...options, asOf: new Date('invalid') }), status400);
    assert.throws(() => forecast(profile, chart, { ...options, horizonYears: 0 }), status400);
    assert.throws(() => forecast(profile, chart, { ...options, asOf: new Date('2099-01-01'), horizonYears: 3 }), status400);
  }
});

test('career windows retain exact dasha cutoffs and future starts, with completed ages across a birthday', () => {
  const chart = chartWith([period('2026-04-20T08:00:00Z', '2026-07-13T00:00:00Z')], {
    start: '2026-04-01', end: '2027-04-01',
  });
  const asOf = new Date('2026-05-10T13:00:00Z');
  const samples = [];
  const result = estimateCareerWindows(profile, chart, {
    asOf, horizonYears: 1,
    transitProvider: (date) => { samples.push(date); return careerSupport(); },
  });
  assert.equal(result.topic, 'career');
  assert.equal(result.status, 'estimated');
  assert.deepEqual(result.windows.map(({ start, end, ageRange }) => ({ start, end, ageRange })), [
    { start: '2026-05-10', end: '2026-07-12', ageRange: { min: 25, max: 26 } },
  ]);
  assert.ok(samples.every((date) => date >= asOf && date < new Date('2026-07-13')));
  assert.match(result.windows[0].reasons.join(' '), /Saturn, the tenth-house ruler/);
  assert.match(result.limitations.join(' '), /cannot promise a job offer/);
});

test('career uses the actual tenth house/ruler for a Cancer ascendant and supports its ruler’s natal sign', () => {
  const chart = chartWith([period('2026-01-01', '2026-02-01', 'Mars')], { lord: 'Venus' });
  chart.ascendant = { longitude: 105, signIndex: 3 };
  chart.planets.push({ name: 'Mars', signIndex: 5 });
  const result = estimateCareerWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: () => [{ name: 'Jupiter', signIndex: 5 }],
  });
  assert.equal(result.status, 'estimated');
  assert.match(result.factors.join(' '), /tenth house: Mesha \(Aries\); traditional ruler: Mars/);
  assert.match(result.windows[0].reasons.join(' '), /Mars, the tenth-house ruler, is the antardasha lord/);
  assert.match(result.windows[0].reasons.join(' '), /Jupiter.*its ruler Mars/);
});

test('career does not fabricate dates when no dasha lord qualifies or Jupiter offers no required support', () => {
  const noDasha = chartWith([period('2026-01-01', '2027-01-01', 'Moon')], { lord: 'Venus' });
  let calls = 0;
  const result = estimateCareerWindows(profile, noDasha, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: () => { calls += 1; return careerSupport(); },
  });
  assert.equal(result.status, 'no-window');
  assert.deepEqual(result.windows, []);
  assert.equal(calls, 0);
  const noJupiter = estimateCareerWindows(profile, chartWith([period('2026-01-01', '2027-01-01')]), {
    asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: careerUnsupported,
  });
  assert.equal(noJupiter.status, 'no-window');
  assert.deepEqual(noJupiter.windows, []);
  assert.match(noJupiter.limitations.join(' '), /does not mean professional progress is impossible/);
});

test('career retains unsupported monthly gaps and does not merge adjacent antardashas', () => {
  const chart = chartWith([
    period('2026-01-01', '2026-05-01'), period('2026-05-01', '2026-06-01', 'Sun'),
  ]);
  const result = estimateCareerWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: (date) => date.getUTCMonth() === 1 ? careerUnsupported() : careerSupport(),
  });
  assert.deepEqual(result.windows.map(({ start, end }) => ({ start, end })), [
    { start: '2026-01-01', end: '2026-01-31' },
    { start: '2026-03-01', end: '2026-04-30' },
    { start: '2026-05-01', end: '2026-05-31' },
  ]);
  assert.match(result.windows[2].reasons.join(' '), /Sun antardasha/);
});

test('career bounds are adult-only and February 29 births turn eighteen on March 1 in non-leap years', () => {
  const chart = chartWith([period('2026-01-01', '2036-01-01')]);
  const result = estimateCareerWindows({ ...profile, birthDate: '2008-02-29' }, chart, {
    asOf: new Date('2026-02-01'), horizonYears: 1, transitProvider: careerSupport,
  });
  assert.equal(result.windows[0].start, '2026-03-01');
  assert.equal(result.windows[0].ageRange.min, 18);
  const noAdultDate = estimateCareerWindows({ ...profile, birthDate: '2010-12-20' }, chart, {
    asOf: new Date('2026-10-07'), horizonYears: 1, transitProvider: careerSupport,
  });
  assert.equal(noAdultDate.status, 'no-window');
  assert.deepEqual(noAdultDate.windows, []);
});

test('career ranks at most three supported periods by the declared rule without likelihood scores', () => {
  const chart = chartWith([
    period('2026-01-01', '2026-02-01', 'Mercury'),
    period('2026-02-01', '2026-03-01', 'Saturn'),
    period('2026-03-01', '2026-04-01'),
    period('2026-04-01', '2026-05-01', 'Sun'),
    period('2026-05-01', '2026-06-01', 'Moon'),
  ]);
  const result = estimateCareerWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: careerSupport,
  });
  assert.deepEqual(result.windows.map((window) => window.start), ['2026-02-01', '2026-01-01', '2026-03-01']);
  for (const window of result.windows) {
    assert.equal('probability' in window, false);
    assert.equal('confidence' in window, false);
    assert.equal('score' in window, false);
  }
});

test('career clips long periods to the calendar horizon and handles a leap-day assessment', () => {
  const chart = chartWith([period('2024-01-01', '2036-01-01')], { start: '2024-01-01' });
  const result = estimateCareerWindows(profile, chart, {
    asOf: new Date('2024-02-29'), horizonYears: 1, transitProvider: careerSupport,
  });
  assert.equal(result.horizonEnd, '2025-02-28');
  assert.equal(result.windows[0].start, '2024-02-29');
  assert.equal(result.windows[0].end, '2025-02-27');
});

test('Saturn Sade Sati passage changes do not falsely end the broader three-sign classification', () => {
  const chart = chartWith([
    period('2026-01-01', '2026-05-15', 'Venus'),
    period('2026-05-15', '2027-01-01', 'Mercury'),
  ]);
  const asOf = new Date('2026-01-10');
  const result = describeDifficultPeriods(profile, chart, {
    asOf, horizonYears: 1,
    transitProvider: (date) => {
      const month = (date.getUTCFullYear() - 2026) * 12 + date.getUTCMonth();
      return saturn([0, 1, 2][month] ?? 3);
    },
  });
  assert.equal(result.status, 'interpreted');
  assert.match(result.currentPhase.name, /Sade Sati.*opening/);
  assert.deepEqual(result.windows.map(({ start, end }) => ({ start, end })), [
    { start: '2026-01-10', end: '2026-01-31' },
    { start: '2026-02-01', end: '2026-02-28' },
    { start: '2026-03-01', end: '2026-03-31' },
  ]);
  assert.match(result.windows[0].reasons.join(' '), /broader three-sign Sade Sati classification continues/);
  assert.match(result.factors.join(' '), /first absent.*2026-04-01/);
  assert.doesNotMatch(result.factors.join(' '), /first absent.*2026-02-01/);
  assert.match(result.factors.join(' '), /not a date when personal hardship will end/);
});

test('a current Saturn passage is clipped at the assessment/horizon without fabricating its historical onset or exit', () => {
  const chart = chartWith([period('2026-01-01', '2036-01-01')]);
  const asOf = new Date('2026-10-07');
  const samples = [];
  const result = describeDifficultPeriods(profile, chart, {
    asOf, horizonYears: 1,
    transitProvider: (date) => { samples.push(date); return saturn(0); },
  });
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].start, '2026-10-07');
  assert.equal(result.windows[0].end, '2027-10-06');
  assert.match(result.windows[0].reasons.join(' '), /not its historical onset/);
  assert.match(result.windows[0].reasons.join(' '), /clipped.*no exit/);
  assert.match(result.factors.join(' '), /no exit date is supplied/);
  assert.ok(samples.every((date) => date >= asOf && date < new Date('2027-10-07')));
  assert.ok(samples.slice(1).every((date) => date.getUTCDate() === 1));
});

test('no current or future conventional Saturn marker returns no window rather than manufacturing relief dates', () => {
  const result = describeDifficultPeriods(profile, chartWith([period('2026-01-01', '2027-01-01')]), {
    asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: () => saturn(3),
  });
  assert.equal(result.status, 'no-window');
  assert.deepEqual(result.windows, []);
  assert.match(result.currentPhase.name, /No current Sade Sati or Ashtama Shani/);
  assert.match(result.currentPhase.description, /3rd sign/);
  assert.match(result.factors.join(' '), /no phase dates are invented/);
});

test('a future Ashtama passage is clearly future-labeled while the present classification remains absent', () => {
  const result = describeDifficultPeriods(profile, chartWith([period('2026-01-01', '2027-01-01')]), {
    asOf: new Date('2026-01-15'), horizonYears: 1,
    transitProvider: (date) => saturn(date.getUTCMonth() >= 3 && date.getUTCMonth() <= 4 ? 8 : 3),
  });
  assert.match(result.currentPhase.name, /No current/);
  assert.equal(result.windows.length, 1);
  assert.match(result.windows[0].label, /^Future Ashtama Shani/);
  assert.equal(result.windows[0].start, '2026-04-01');
  assert.equal(result.windows[0].end, '2026-05-31');
  assert.match(result.windows[0].reasons.join(' '), /8th sign/);
  assert.match(result.factors.join(' '), /next conventional Saturn marker.*2026-04-01/);
});

test('retrograde-like re-entry stays a separate passage and a first sampled exit is not called permanent relief', () => {
  const result = describeDifficultPeriods(profile, chartWith([period('2026-01-01', '2027-01-01')]), {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: (date) => saturn(date.getUTCMonth() === 0 || date.getUTCMonth() === 2 ? 2 : 3),
  });
  assert.deepEqual(result.windows.map(({ start, end }) => ({ start, end })), [
    { start: '2026-01-01', end: '2026-01-31' },
    { start: '2026-03-01', end: '2026-03-31' },
  ]);
  assert.match(result.factors.join(' '), /first absent.*2026-02-01/);
  assert.match(result.factors.join(' '), /Later re-entries can occur/);
  assert.match(result.limitations.join(' '), /does not promise a permanent/);
});

test('difficult-period interpretation uses real dasha timeline boundaries rather than stale cached summaries', () => {
  const chart = chartWith([
    period('2026-01-01', '2026-05-15T12:00:00Z', 'Venus'),
    period('2026-05-15T12:00:00Z', '2027-01-01', 'Mercury'),
  ]);
  chart.dasha.currentAntardasha = { lord: 'Fake', start: '2020-01-01', end: '2030-01-01' };
  const result = describeDifficultPeriods(profile, chart, {
    asOf: new Date('2026-03-10'), horizonYears: 1, transitProvider: () => saturn(3),
  });
  assert.match(result.factors.join(' '), /Current Vimshottari mahadasha: Saturn/);
  assert.match(result.factors.join(' '), /Current Vimshottari antardasha: Venus/);
  assert.match(result.factors.join(' '), /Next calculated antardasha starts on 2026-05-15: Mercury/);
  assert.doesNotMatch(result.factors.join(' '), /Fake/);
});

test('both methods preserve calculation limitations, avoid mutating chart data, and reject missing ephemeris positions', () => {
  const chart = chartWith([period('2026-01-01', '2026-02-01')]);
  const original = structuredClone(chart);
  for (const [forecast, transitProvider] of [
    [estimateCareerWindows, careerSupport], [describeDifficultPeriods, () => saturn(0)],
  ]) {
    const result = forecast(profile, chart, { asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider });
    assert.ok(result.limitations.includes('Fixture analytical precision limit.'));
    assert.ok(result.limitations.includes('Fixture rashi-boundary warning.'));
    assert.match(result.limitations.join(' '), /not scientifically validated/);
    assert.deepEqual(chart, original);
    assert.throws(() => forecast(profile, chart, {
      asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: () => [],
    }), /ephemeris did not supply a valid/);
  }
});

test('production career and Saturn interpretation use actual ephemeris positions within their horizons', () => {
  const asOf = new Date('2026-10-07T12:00:00Z');
  const chart = calculateVedicChart(profile, { asOf });
  const career = estimateCareerWindows(profile, chart, { asOf, horizonYears: 2 });
  const phases = describeDifficultPeriods(profile, chart, { asOf, horizonYears: 2 });
  for (const result of [career, phases]) {
    assert.ok(['estimated', 'interpreted', 'no-window'].includes(result.status));
    assert.ok(result.method.length);
    assert.ok(result.limitations.length);
    assert.ok(result.factors.length);
    for (const window of result.windows) {
      assert.ok(window.start >= result.asOf);
      assert.ok(window.end <= result.horizonEnd);
      assert.ok(window.start <= window.end);
      assert.ok(window.reasons.length);
    }
  }
  assert.ok(career.windows.every((window) => window.ageRange.min >= 18));
  assert.ok(phases.currentPhase.name);
});
