import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateVedicChart } from '../server/vedic-chart.mjs';
import { estimateMarriageWindows } from '../server/vedic-timing.mjs';

const profile = {
  name: 'Mira', birthDate: '2000-06-12', birthTime: '12:15',
  birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata',
};
const status400 = (error) => error.status === 400;
const supporting = () => [{ name: 'Jupiter', signIndex: 0 }, { name: 'Saturn', signIndex: 3 }];
const unsupported = () => [{ name: 'Jupiter', signIndex: 3 }, { name: 'Saturn', signIndex: 0 }];

function chartWith(antardashas, { lord = 'Venus', start = '2026-01-01T00:00:00Z', end = '2036-01-01T00:00:00Z' } = {}) {
  return {
    ascendant: { longitude: 15 }, planets: [{ name: 'Venus', signIndex: 1 }],
    dasha: { periods: [{ lord, start, end, antardashas }] },
    limits: ['Test chart precision limit.'], calculation: { warnings: ['Test boundary warning.'] },
  };
}

function period(start, end, lord = 'Mercury') {
  return { start, end, lord };
}

test('requires complete birth data and a computed natal chart instead of inventing a marriage age', () => {
  const chart = chartWith([period('2026-01-01', '2027-01-01')]);
  const options = { asOf: new Date('2026-01-01'), transitProvider: supporting };
  assert.throws(() => estimateMarriageWindows({ name: 'Mira', birthDate: profile.birthDate }, chart, options), status400);
  assert.throws(() => estimateMarriageWindows({ ...profile, birthTime: '' }, chart, options), status400);
  assert.throws(() => estimateMarriageWindows({ ...profile, timeZone: 'Invalid/Zone' }, chart, options), status400);
  assert.throws(() => estimateMarriageWindows(profile, null, options), status400);
  assert.throws(() => estimateMarriageWindows(profile, { ...chart, planets: [] }, options), status400);
  assert.throws(() => estimateMarriageWindows(profile, chart, { ...options, asOf: new Date('invalid') }), status400);
  assert.throws(() => estimateMarriageWindows(profile, chart, { ...options, horizonYears: 0 }), status400);
  assert.throws(() => estimateMarriageWindows(profile, chart, { ...options, horizonYears: 31 }), status400);
});

test('clips a marriage window to the real antardasha cutoff and exact future start, with birthday-aware ages', () => {
  const chart = chartWith([period('2026-04-20T08:00:00Z', '2026-07-13T00:00:00Z')], {
    start: '2026-04-01T00:00:00Z', end: '2027-04-01T00:00:00Z',
  });
  const sampled = [];
  const asOf = new Date('2026-05-10T13:00:00Z');
  const result = estimateMarriageWindows(profile, chart, {
    asOf, horizonYears: 1,
    transitProvider: (date) => { sampled.push(date); return supporting(); },
  });
  assert.equal(result.status, 'estimated');
  assert.deepEqual(result.windows.map(({ start, end, ageRange }) => ({ start, end, ageRange })), [
    { start: '2026-05-10', end: '2026-07-12', ageRange: { min: 25, max: 26 } },
  ]);
  assert.equal(sampled.length, 3);
  assert.ok(sampled.every((date) => date >= asOf && date < new Date('2026-07-13T00:00:00Z')));
  assert.match(result.windows[0].reasons.join(' '), /Venus mahadasha \/ Mercury antardasha/);
});

test('limits even a very long dasha to the requested calendar-year horizon', () => {
  const chart = chartWith([period('2026-01-01', '2036-01-01')]);
  const result = estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-10-07'), horizonYears: 1, transitProvider: supporting,
  });
  assert.equal(result.horizonEnd, '2027-10-07');
  assert.equal(result.windows[0].start, '2026-10-07');
  assert.equal(result.windows[0].end, '2027-10-06');
  assert.deepEqual(result.windows[0].ageRange, { min: 26, max: 27 });
});

test('excludes all dates before the eighteenth birthday without forcing an early adult date', () => {
  const younger = { ...profile, birthDate: '2010-12-20' };
  const chart = chartWith([period('2026-01-01', '2036-01-01')]);
  const result = estimateMarriageWindows(younger, chart, {
    asOf: new Date('2026-10-07'), horizonYears: 3, transitProvider: supporting,
  });
  assert.equal(result.windows[0].start, '2028-12-20');
  assert.equal(result.windows[0].ageRange.min, 18);
  const tooSoon = estimateMarriageWindows(younger, chart, {
    asOf: new Date('2026-10-07'), horizonYears: 1, transitProvider: supporting,
  });
  assert.equal(tooSoon.status, 'no-window');
  assert.deepEqual(tooSoon.windows, []);
});

test('February 29 birth ages and the adult boundary use the declared March 1 convention', () => {
  const chart = chartWith([period('2026-02-01', '2026-03-02')]);
  const options = { asOf: new Date('2026-02-01'), horizonYears: 1, transitProvider: supporting };
  const result = estimateMarriageWindows({ ...profile, birthDate: '2000-02-29' }, chart, options);
  assert.deepEqual(result.windows[0].ageRange, { min: 25, max: 26 });
  const turningAdult = estimateMarriageWindows({ ...profile, birthDate: '2008-02-29' }, chart, options);
  assert.equal(turningAdult.windows[0].start, '2026-03-01');
  assert.equal(turningAdult.windows[0].end, '2026-03-01');
  assert.deepEqual(turningAdult.windows[0].ageRange, { min: 18, max: 18 });
  assert.match(turningAdult.method.join(' '), /February 29 birthdays use March 1/);
});

test('returns no window when neither dasha lord qualifies, even if transits would support marriage', () => {
  const chart = chartWith([period('2026-01-01', '2027-01-01', 'Moon')], { lord: 'Sun' });
  let calls = 0;
  const result = estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: () => { calls += 1; return supporting(); },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, 'no-window');
  assert.deepEqual(result.windows, []);
  assert.equal('predictedAge' in result, false);
  assert.match(result.limitations.join(' '), /does not mean marriage is impossible/);
});

test('Saturn corroboration cannot create a window without a qualifying Jupiter transit', () => {
  const chart = chartWith([period('2026-01-01', '2027-01-01')]);
  const result = estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: unsupported,
  });
  assert.equal(result.status, 'no-window');
  assert.deepEqual(result.windows, []);
  assert.equal('probability' in result, false);
});

test('merges only contiguous supported months and preserves an unsupported month as a real gap', () => {
  const chart = chartWith([period('2026-01-01', '2026-05-01')]);
  const result = estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: (date) => date.getUTCMonth() === 1 ? unsupported() : supporting(),
  });
  assert.deepEqual(result.windows.map(({ start, end }) => ({ start, end })), [
    { start: '2026-01-01', end: '2026-01-31' },
    { start: '2026-03-01', end: '2026-04-30' },
  ]);
});

test('adjacent antardashas stay separate so each window retains its real period and evidence', () => {
  const chart = chartWith([
    period('2026-01-01', '2026-02-01', 'Mercury'),
    period('2026-02-01', '2026-03-01', 'Sun'),
  ]);
  const result = estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: supporting,
  });
  assert.equal(result.windows.length, 2);
  assert.equal(result.windows[0].end, '2026-01-31');
  assert.equal(result.windows[1].start, '2026-02-01');
  assert.match(result.windows[0].reasons.join(' '), /Mercury antardasha/);
  assert.match(result.windows[1].reasons.join(' '), /Sun antardasha/);
});

test('returns at most three ranked windows, favoring seventh-lord antardasha without exposing likelihood scores', () => {
  const chart = chartWith([
    period('2026-01-01', '2026-02-01'),
    period('2026-02-01', '2026-03-01', 'Venus'),
    period('2026-03-01', '2026-04-01'),
    period('2026-04-01', '2026-05-01'),
    period('2026-05-01', '2026-06-01'),
  ]);
  const result = estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: supporting,
  });
  assert.equal(result.windows.length, 3);
  assert.deepEqual(result.windows.map((window) => window.start), ['2026-02-01', '2026-01-01', '2026-03-01']);
  for (const window of result.windows) {
    assert.equal('score' in window, false);
    assert.equal('probability' in window, false);
    assert.equal('confidence' in window, false);
  }
});

test('uses the computed seventh house and its ruler rather than treating every ascendant as Venus-ruled', () => {
  const chart = chartWith([period('2026-01-01', '2027-01-01', 'Saturn')], { lord: 'Moon' });
  chart.ascendant.longitude = 105; // Karka ascendant; seventh house is Makara.
  chart.planets.push({ name: 'Saturn', signIndex: 5 });
  const result = estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: () => [{ name: 'Jupiter', signIndex: 5 }, { name: 'Saturn', signIndex: 0 }],
  });
  assert.deepEqual(result.seventhHouse, { rashi: 'Makara (Capricorn)', lord: 'Saturn' });
  assert.equal(result.status, 'estimated');
  assert.match(result.windows[0].reasons.join(' '), /Saturn, the seventh-house ruler, is the antardasha lord/);
  assert.match(result.windows[0].reasons.join(' '), /Jupiter.*its ruler Saturn/);
});

test('includes Jupiter occupation and the traditional fifth, seventh, and ninth sign aspects', () => {
  const chart = chartWith([period('2026-01-01', '2026-02-01')]);
  chart.planets[0].signIndex = 6; // Both marriage targets are Tula.
  for (const signIndex of [6, 2, 0, 10]) {
    const result = estimateMarriageWindows(profile, chart, {
      asOf: new Date('2026-01-01'), horizonYears: 1,
      transitProvider: () => [{ name: 'Jupiter', signIndex }, { name: 'Saturn', signIndex: 3 }],
    });
    assert.equal(result.status, 'estimated', `Jupiter sign ${signIndex}`);
  }
});

test('preserves ephemeris limitations and rejects missing positions instead of fabricating support', () => {
  const chart = chartWith([period('2026-01-01', '2026-02-01')]);
  const original = structuredClone(chart);
  const result = estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1, transitProvider: supporting,
  });
  assert.ok(result.limitations.includes('Test chart precision limit.'));
  assert.ok(result.limitations.includes('Test boundary warning.'));
  assert.match(result.limitations.join(' '), /not scientifically validated/);
  assert.deepEqual(chart, original);
  assert.throws(() => estimateMarriageWindows(profile, chart, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: () => [{ name: 'Saturn', signIndex: 0 }],
  }), /valid Jupiter transit sign/);
});

test('production timing computes real ephemeris transits and keeps returned ages and dates in bounds', () => {
  const asOf = new Date('2026-10-07T12:00:00Z');
  const chart = calculateVedicChart(profile, { asOf });
  const result = estimateMarriageWindows(profile, chart, { asOf, horizonYears: 2 });
  assert.ok(['estimated', 'no-window'].includes(result.status));
  assert.ok(result.windows.length <= 3);
  for (const window of result.windows) {
    assert.ok(window.start >= result.asOf);
    assert.ok(window.end <= result.horizonEnd);
    assert.ok(window.start <= window.end);
    assert.ok(window.ageRange.min >= 18);
    assert.ok(window.ageRange.max >= window.ageRange.min);
    assert.match(window.reasons.join(' '), /Jupiter/);
  }
});
