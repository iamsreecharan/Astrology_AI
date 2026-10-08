import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLifeArea } from '../server/vedic-life.mjs';
import { calculateVedicChart } from '../server/vedic-chart.mjs';

const now = new Date('2026-01-15T12:00:00Z');
const profile = {
  name: 'Mira', birthDate: '1995-05-21', birthTime: '10:30',
  birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867,
  timeZone: 'Asia/Kolkata',
};
const status400 = (error) => error.status === 400;
const names = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];
const signs = [4, 1, 2, 6, 2, 8, 9, 5, 11];

function part(ascendantSign = 0, planetSigns = signs) {
  return {
    ascendant: { signIndex: ascendantSign, longitude: ascendantSign * 30 + 5 },
    planets: names.map((name, index) => ({
      name, signIndex: planetSigns[index], longitude: planetSigns[index] * 30 + 5,
      house: (planetSigns[index] - ascendantSign + 12) % 12 + 1, retrograde: false,
    })),
  };
}

function period(lord, start, end) {
  return { lord, start: `${start}T00:00:00.000Z`, end: `${end}T00:00:00.000Z` };
}

function chart(ascendantSign = 0) {
  // Deliberately synthetic supplied intervals isolate filtering and clipping;
  // the final smoke test uses the ephemeris's complete actual Vimshottari chart.
  return {
    ...part(ascendantSign), navamsa: part(4),
    dasha: {
      periods: [
        {
          ...period('Mars', '2025-01-01', '2027-01-01'),
          antardashas: [
            period('Saturn', '2025-01-01', '2026-02-01'),
            period('Sun', '2026-02-01', '2026-04-01'),
            period('Mercury', '2026-04-01', '2026-06-01'),
            period('Jupiter', '2026-06-01', '2026-08-01'),
            period('Venus', '2026-08-01', '2027-01-01'),
          ],
        },
        {
          ...period('Venus', '2027-01-01', '2030-01-01'),
          antardashas: [
            period('Venus', '2027-01-01', '2029-01-01'),
            period('Moon', '2029-01-01', '2030-01-01'),
          ],
        },
      ],
    },
    limits: ['The fixture uses approximate positions.'], calculation: { warnings: [] },
  };
}

test('education selects actual topic-linked antardashas instead of inventing an outcome date', () => {
  const reading = analyzeLifeArea(profile, chart(), 'education', { asOf: now });
  assert.equal(reading.topic, 'education');
  assert.equal(reading.status, 'interpreted');
  assert.deepEqual(reading.windows.map(({ start, end, label }) => ({ start, end, label })), [
    { start: '2026-02-01', end: '2026-03-31', label: 'Mars / Sun period themes' },
    { start: '2026-04-01', end: '2026-05-31', label: 'Mars / Mercury period themes' },
    { start: '2026-06-01', end: '2026-07-31', label: 'Mars / Jupiter period themes' },
  ]);
  assert.ok(reading.factors.some((factor) => /D1 house 5.*Simha.*ruled by Sun/.test(factor)));
  assert.ok(reading.windows[0].reasons.some((reason) => /Sun.*rules D1 house 5/.test(reason)));
  assert.ok(reading.windows[1].reasons.some((reason) => /Mercury.*traditional significator/.test(reason)));
  assert.ok(reading.factors.some((factor) => /Current Vimshottari period: Mars.*Saturn/.test(factor)));
  assert.ok(reading.limitations.some((limit) => /not scientifically established/.test(limit)));
});

test('different ascendants change actual house rulers, occupants, and linked periods', () => {
  const aries = analyzeLifeArea(profile, chart(0), 'education', { asOf: now });
  const cancer = analyzeLifeArea(profile, chart(3), 'education', { asOf: now });
  assert.ok(cancer.factors.some((factor) => /D1 house 5.*Vrischika.*ruled by Mars/.test(factor)));
  assert.ok(cancer.windows[0].reasons.some((reason) => /Mars.*mahadasha.*rules D1 house 5/.test(reason)));
  assert.equal(cancer.windows[0].start, '2026-01-15');
  assert.equal(cancer.windows[0].end, '2026-01-31');
  assert.notDeepEqual(cancer.windows, aries.windows);
  assert.ok(cancer.factors.some((factor) => /Jupiter.*D1 house 6/.test(factor)));
});

test('married life uses supplied D9 seventh-house and Venus context without outcome certainty', () => {
  const reading = analyzeLifeArea(profile, chart(), 'married-life', { asOf: now });
  assert.ok(reading.factors.some((factor) => /D1 house 7.*Tula.*ruled by Venus/.test(factor)));
  assert.ok(reading.factors.some((factor) => /D9 house 7.*Kumbha.*ruled by Saturn.*house 6/.test(factor)));
  assert.ok(reading.factors.some((factor) => /Venus is in D9 house 3/.test(factor)));
  assert.equal(reading.windows[0].label, 'Mars / Venus period themes');
  assert.ok(reading.limitations.some((limit) => /cannot establish marital success, divorce/.test(limit)));
  assert.ok(reading.method.some((item) => /D9 placements do not select or rank/.test(item)));
  const differentD9 = chart();
  differentD9.navamsa = part(0);
  const other = analyzeLifeArea(profile, differentD9, 'married-life', { asOf: now });
  assert.ok(other.factors.some((factor) => /D9 house 7.*Tula.*ruled by Venus/.test(factor)));
  assert.deepEqual(other.windows, reading.windows);
  delete differentD9.navamsa;
  const d1Only = analyzeLifeArea(profile, differentD9, 'married-life', { asOf: now });
  assert.ok(d1Only.limitations.some((limit) => /D9 Navamsa context is unavailable/.test(limit)));
  assert.equal(d1Only.factors.some((factor) => /D9/.test(factor)), false);
});

test('all supported topics use their own stated houses and neutral themes', () => {
  const expected = { education: [5, 9], finances: [2, 11], family: [2, 4], travel: [9, 12], wellbeing: [6, 12] };
  for (const [topic, houses] of Object.entries(expected)) {
    const reading = analyzeLifeArea(profile, chart(), topic, { asOf: now });
    for (const house of houses) assert.ok(reading.factors.some((factor) => factor.startsWith(`D1 house ${house} (`)), topic);
    assert.ok(reading.themes.length > 0);
    assert.ok(reading.windows.every((window) => window.themes.length > 0));
  }
  const finances = analyzeLifeArea(profile, chart(), 'finances', { asOf: now });
  assert.ok(finances.limitations.some((limit) => /cannot establish returns or lucky wins/.test(limit)));
  const wellbeing = analyzeLifeArea(profile, chart(), 'wellbeing', { asOf: now });
  assert.ok(wellbeing.limitations.some((limit) => /clinical evidence/.test(limit)));
});

test('general periods preserve current and next actual antardasha boundaries with inclusive displayed end days', () => {
  const reading = analyzeLifeArea(profile, chart(), 'general', { asOf: now });
  assert.equal(reading.horizonEnd, '2029-01-15');
  assert.deepEqual(reading.windows.map((window) => [window.start, window.end]), [
    ['2026-01-15', '2026-01-31'], ['2026-02-01', '2026-03-31'], ['2026-04-01', '2026-05-31'],
  ]);
  const boundary = analyzeLifeArea(profile, chart(), 'general', { asOf: new Date('2026-02-01T00:00:00Z') });
  assert.equal(boundary.windows[0].label, 'Mars / Sun period themes');
  assert.equal(boundary.windows[0].start, '2026-02-01');
});

test('life windows clip at future horizon and do not invent a continuation outside the supplied timeline', () => {
  const reading = analyzeLifeArea(profile, chart(), 'married-life', { asOf: now });
  assert.equal(reading.windows.at(-1).start, '2029-01-01');
  assert.equal(reading.windows.at(-1).end, '2029-01-15');
  const truncated = chart();
  truncated.dasha.periods = [truncated.dasha.periods[0]];
  truncated.dasha.periods[0].antardashas = [period('Saturn', '2025-01-01', '2026-02-01')];
  const empty = analyzeLifeArea(profile, truncated, 'education', { asOf: now });
  assert.deepEqual(empty.windows, []);
  assert.equal(empty.status, 'interpreted');
  assert.ok(empty.limitations.some((limit) => /No matching antardasha period/.test(limit)));
  const beforeBirth = { ...profile, birthDate: '2026-01-15', birthTime: '13:00', timeZone: 'UTC' };
  assert.throws(() => analyzeLifeArea(beforeBirth, chart(), 'general', { asOf: now }), /already occurred/);
});

test('calendar-year horizons clamp February 29 and preserve midnight cutoff semantics', () => {
  const long = chart();
  long.dasha.periods = [{ ...period('Venus', '2020-01-01', '2030-01-01'), antardashas: [period('Venus', '2020-01-01', '2030-01-01')] }];
  const reading = analyzeLifeArea(profile, long, 'general', { asOf: new Date('2024-02-29T00:00:00Z') });
  assert.equal(reading.horizonEnd, '2027-02-28');
  assert.equal(reading.windows[0].start, '2024-02-29');
  assert.equal(reading.windows[0].end, '2027-02-27');
});

test('complete birth inputs and complete consistent charts are required', () => {
  for (const key of ['birthDate', 'birthTime', 'birthPlace', 'latitude', 'longitude', 'timeZone']) {
    const incomplete = { ...profile };
    delete incomplete[key];
    assert.throws(() => analyzeLifeArea(incomplete, chart(), 'general', { asOf: now }), status400, key);
  }
  assert.throws(() => analyzeLifeArea({ name: 'Mira', birthDate: profile.birthDate }, chart(), 'general', { asOf: now }), status400);
  for (const key of ['ascendant', 'planets', 'dasha']) {
    const incomplete = chart();
    delete incomplete[key];
    assert.throws(() => analyzeLifeArea(profile, incomplete, 'general', { asOf: now }), status400, key);
  }
  for (const name of names) {
    const missing = chart();
    missing.planets = missing.planets.filter((planet) => planet.name !== name);
    assert.throws(() => analyzeLifeArea(profile, missing, 'education', { asOf: now }), status400, name);
  }
  const inconsistent = chart();
  inconsistent.planets[0].house = 1;
  assert.throws(() => analyzeLifeArea(profile, inconsistent, 'general', { asOf: now }), /whole sign/);
  const invalidSign = chart();
  invalidSign.ascendant.signIndex = 12;
  assert.throws(() => analyzeLifeArea(profile, invalidSign, 'general', { asOf: now }), /sign index/);
  const badD9 = chart();
  badD9.navamsa.planets = badD9.navamsa.planets.filter((planet) => planet.name !== 'Venus');
  assert.throws(() => analyzeLifeArea(profile, badD9, 'married-life', { asOf: now }), status400);
});

test('malformed or overlapping dasha periods cannot become a forecast window', () => {
  const reversed = chart();
  reversed.dasha.periods[0].antardashas[0].end = reversed.dasha.periods[0].antardashas[0].start;
  assert.throws(() => analyzeLifeArea(profile, reversed, 'general', { asOf: now }), /ordered/);
  const overlap = chart();
  overlap.dasha.periods[0].antardashas[1].start = '2026-01-31T00:00:00.000Z';
  assert.throws(() => analyzeLifeArea(profile, overlap, 'general', { asOf: now }), /without overlap/);
  const outside = chart();
  outside.dasha.periods[0].antardashas[0].start = '2024-01-01T00:00:00.000Z';
  assert.throws(() => analyzeLifeArea(profile, outside, 'general', { asOf: now }), /within their mahadasha/);
  const impossible = chart();
  impossible.dasha.periods[0].antardashas[0].end = '2026-02-30T00:00:00.000Z';
  assert.throws(() => analyzeLifeArea(profile, impossible, 'general', { asOf: now }), /real calendar/);
});

test('unknown topics, invalid clocks, and unsupported horizons return client errors', () => {
  for (const topic of ['health', 'stocks', '__proto__', null, ['general']]) {
    assert.throws(() => analyzeLifeArea(profile, chart(), topic, { asOf: now }), status400);
  }
  assert.throws(() => analyzeLifeArea(profile, chart(), 'general', { asOf: new Date('invalid') }), status400);
  for (const horizonYears of [0, 11, 1.5, '3']) assert.throws(() => analyzeLifeArea(profile, chart(), 'general', { asOf: now, horizonYears }), status400);
  assert.throws(() => analyzeLifeArea(profile, chart(), 'general', { asOf: new Date('2099-01-01') }), /shorter horizon/);
});

test('life interpretations contain chart facts without raw birth identity', () => {
  const first = analyzeLifeArea(profile, chart(), 'family', { asOf: now });
  const renamed = analyzeLifeArea({ ...profile, name: 'Other name', birthPlace: 'Other label' }, chart(), 'family', { asOf: now });
  assert.deepEqual(first, renamed);
  const serialized = JSON.stringify(first);
  for (const value of ['Mira', 'Hyderabad', '1995-05-21', '10:30', '17.385', '78.4867', 'Asia/Kolkata']) {
    assert.equal(serialized.includes(value), false, value);
  }
});

test('all seven life topics interpret an actual ephemeris D1/D9 chart and its real timeline', () => {
  const actual = calculateVedicChart(profile, { asOf: now });
  for (const topic of ['married-life', 'general', 'education', 'finances', 'family', 'travel', 'wellbeing']) {
    const reading = analyzeLifeArea(profile, actual, topic, { asOf: now });
    assert.equal(reading.status, 'interpreted', topic);
    assert.ok(reading.factors.length > 1);
    assert.ok(reading.windows.length <= 3);
    for (const window of reading.windows) {
      assert.ok(window.start >= '2026-01-15');
      assert.ok(window.end <= reading.horizonEnd);
      const [mahaLord, antarLord] = window.label.split(' period themes')[0].split(' / ');
      assert.ok(actual.dasha.periods.some((maha) => maha.lord === mahaLord
        && maha.antardashas.some((antar) => antar.lord === antarLord
          && antar.start.slice(0, 10) <= window.start && antar.end.slice(0, 10) >= window.end)));
    }
  }
});
