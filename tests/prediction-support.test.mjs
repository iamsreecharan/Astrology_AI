import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPredictionSupport } from '../server/prediction-support.mjs';
import { estimateMarriageWindows } from '../server/vedic-timing.mjs';
import { estimateCareerWindows } from '../server/vedic-forecast.mjs';
import { buildHoroscopeReportModel } from '../server/horoscope-report.mjs';
import { createApp } from '../server/app.mjs';

const profile = {
  name: 'Mira Rao', birthDate: '1995-05-21', birthTime: '10:30',
  birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata',
};
const asOf = new Date('2026-10-08T12:00:00Z');
const window = (start, dashaWeight = 3, jupiterTargetAverage = 1, saturnTargetAverage = 0) => ({
  start, end: `${start.slice(0, 7)}-28`, ageRange: { min: 31, max: 31 }, reasons: ['Calculated period and transit support.'],
  supportFactors: { dashaWeight, jupiterTargetAverage, saturnTargetAverage },
});
const prediction = (windows, topic = 'marriage') => ({ topic, status: 'estimated', asOf: '2026-10-08', windows });

test('relative labels use dasha before Jupiter and Saturn while preserving dates, ages, and input order', () => {
  const raw = prediction([
    window('2026-11-01', 3, 3, 3), window('2027-01-01', 4, 1, 0), window('2027-03-01', 3, 2, 1),
  ]);
  const original = structuredClone(raw);
  const result = attachPredictionSupport(raw);
  assert.deepEqual(raw, original);
  assert.deepEqual(result.windows.map(({ support, ...entry }) => entry), original.windows);
  assert.deepEqual(result.windows.map(entry => [entry.support.label, entry.support.rank]), [
    ['Supported', 2], ['Most supported', 1], ['Supported', 3],
  ]);
  assert.match(result.support.explanation, /not measured chances/);
  assert.doesNotMatch(JSON.stringify(result.support), /%/);
});

test('Jupiter and Saturn corroboration break equal dasha weights without introducing an outcome score', () => {
  const result = attachPredictionSupport(prediction([
    window('2026-11-01', 3, 1, 3), window('2027-01-01', 3, 2, 0), window('2027-03-01', 3, 2, 1),
  ]));
  assert.deepEqual(result.windows.map(entry => entry.support.rank), [3, 2, 1]);
  assert.equal(result.windows[2].support.label, 'Most supported');
  for (const entry of result.windows) {
    for (const key of ['probability', 'confidence', 'score', 'percentage']) assert.equal(key in entry.support, false);
  }
});

test('equal computed support shares the top label and does not treat the earlier date as more likely', () => {
  const result = attachPredictionSupport(prediction([
    window('2026-11-01', 4, 1.5, 0.5), window('2027-01-01', 4, 1.5 + 1e-12, 0.5), window('2027-03-01', 3, 2, 3),
  ]));
  assert.deepEqual(result.windows.map(entry => entry.support.label), ['Joint most supported', 'Joint most supported', 'Supported']);
  assert.deepEqual(result.windows.map(entry => entry.support.rank), [1, 1, 3]);
  assert.equal(result.windows[0].support.tiedWindows, 2);
  assert.match(result.windows[0].support.explanation, /No tied window is assigned a higher outcome likelihood/);
});

test('one qualifying interval is supported without a fabricated best-window comparison', () => {
  const result = attachPredictionSupport(prediction([window('2026-11-01', 7, 3, 3)]));
  assert.equal(result.windows[0].support.label, 'Supported');
  assert.equal(result.windows[0].support.comparison, 'single');
  assert.equal(result.windows[0].support.comparedWindows, 1);
  assert.match(result.windows[0].support.explanation, /no second shown window to compare/);
});

test('no strict window leaves independently calculated career planning dates as planning suggestions', () => {
  const raw = {
    topic: 'career', status: 'no-window', windows: [],
    searchWindows: [{ start: '2026-10-12', end: '2026-10-18', reasons: ['Mercury planning support.'] }],
    planningDates: { dates: [{ date: '2026-10-16', displayDate: '16-10-2026', reasons: ['Tara and Moon support.'] }] },
  };
  const result = attachPredictionSupport(raw);
  assert.equal(result.support.label, 'No timing window found');
  assert.equal(result.searchWindows[0].support.label, 'Planning suggestion');
  assert.equal(result.planningDates.support.label, 'Planning suggestion');
  assert.equal(result.planningDates.dates[0].support.kind, 'planning');
  assert.match(result.searchWindows[0].support.explanation, /not a probable hiring date/);
  assert.equal(result.planningDates.dates[0].date, '2026-10-16');
  assert.equal('support' in raw.searchWindows[0], false);
});

test('qualitative life themes and Saturn phases never acquire event likelihood labels', () => {
  for (const topic of ['married-life', 'general', 'education', 'finances', 'family', 'travel', 'wellbeing']) {
    const result = attachPredictionSupport({ ...prediction([window('2026-11-01')], topic), status: 'interpreted' });
    assert.equal(result.support.label, 'Traditional interpretation');
    assert.equal(result.windows[0].support.kind, 'interpretation');
    assert.equal('rank' in result.windows[0].support, false);
    const withoutPeriods = attachPredictionSupport({ topic, status: 'interpreted', windows: [] });
    assert.equal(withoutPeriods.support.label, 'Traditional interpretation');
    assert.deepEqual(withoutPeriods.windows, []);
  }
  const result = attachPredictionSupport({ topic: 'difficult-periods', status: 'interpreted', windows: [{ start: '2026-11-01', end: '2027-03-31' }] });
  assert.equal(result.support.label, 'Calculated phase');
  assert.equal(result.windows[0].support.label, 'Calculated phase');
  assert.match(result.windows[0].support.explanation, /not a probability of hardship/);
});

test('missing or invalid evidence cannot produce a relative ranking, and private metadata is not copied into display guidance', () => {
  for (const supportFactors of [undefined, { dashaWeight: 3, jupiterTargetAverage: NaN, saturnTargetAverage: 0 }, { dashaWeight: 99, jupiterTargetAverage: 1, saturnTargetAverage: 0 }]) {
    const raw = prediction([{ ...window('2026-11-01'), supportFactors }]);
    const result = attachPredictionSupport(raw);
    assert.equal(result.support.label, 'Support not compared');
    assert.equal('rank' in result.windows[0].support, false);
  }
  const raw = prediction([window('2026-11-01'), window('2027-01-01', 4)]);
  raw.support = { profileName: 'Private identity', latitude: 17.385, key: 'private-marker' };
  raw.windows[0].support = { birthPlace: 'Private location', apiKey: 'private-marker' };
  raw.windows[0].supportFactors.birthDate = 'Private date';
  const result = attachPredictionSupport(raw);
  const guidance = JSON.stringify([result.support, ...result.windows.map(entry => entry.support)]);
  assert.doesNotMatch(guidance, /Private|private-marker|latitude|birthPlace|birthDate|apiKey|profileName/);
});

test('timing engines retain their actual rule weights and duration-weighted transit targets', () => {
  const maha = (lord, antardashas) => ({ lord, start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z', antardashas });
  const antar = lord => ({ lord, start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z' });
  const marriageChart = { ascendant: { longitude: 15, signIndex: 0 }, planets: [{ name: 'Venus', signIndex: 1 }], dasha: { periods: [maha('Venus', [antar('Venus')])] } };
  const marriage = estimateMarriageWindows(profile, marriageChart, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: date => [{ name: 'Jupiter', signIndex: 0 }, { name: 'Saturn', signIndex: date.getUTCMonth() === 0 ? 1 : 2 }],
  });
  assert.deepEqual(marriage.windows[0].supportFactors, { dashaWeight: 7, jupiterTargetAverage: 1, saturnTargetAverage: 31 / 59 });
  const careerChart = {
    ascendant: { longitude: 15, signIndex: 0 },
    planets: [{ name: 'Saturn', signIndex: 3 }, { name: 'Mercury', signIndex: 1 }],
    dasha: { periods: [maha('Saturn', [antar('Mercury')])] },
  };
  const career = estimateCareerWindows(profile, careerChart, {
    asOf: new Date('2026-01-01'), horizonYears: 1,
    transitProvider: date => [{ name: 'Jupiter', signIndex: date.getUTCMonth() === 0 ? 3 : 1 }, { name: 'Mercury', signIndex: 0 }],
  });
  assert.deepEqual(career.windows[0].supportFactors, { dashaWeight: 5, jupiterTargetAverage: (31 * 2 + 28) / 59 });
});

test('prediction API, local chat, and all English report sections use the same support decoration', async () => {
  const application = await createApp({ production: true, aiKey: '', today: () => new Date(asOf) });
  const server = await new Promise(resolve => {
    const instance = application.app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (route, body) => {
    const response = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    const model = buildHoroscopeReportModel(profile, { asOf });
    for (const expected of model.predictions) {
      const { title, ...reportPrediction } = expected;
      const apiPrediction = await post('/api/prediction', { profile, topic: expected.topic });
      assert.deepEqual(apiPrediction, reportPrediction, expected.topic);
    }
    for (const message of ['When might I marry?', 'When might I get a job?', 'How might my married life be?']) {
      const result = await post('/api/chat', { profile, mode: 'local', message });
      const { title, ...reportPrediction } = model.predictions.find(entry => entry.topic === result.prediction.topic);
      assert.deepEqual(result.prediction, reportPrediction, message);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await application.close();
  }
});
