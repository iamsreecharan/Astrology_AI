import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createApp } from '../server/app.mjs';
import { calculateVedicChart } from '../server/vedic-chart.mjs';
import { buildHoroscopeReportModel, renderHoroscopeReport, reportFilename, reportTextRuns, SOUTH_INDIAN_SIGN_CELLS } from '../server/horoscope-report.mjs';

const profile = {
  name: 'Mira Rao', birthDate: '1995-05-21', birthTime: '10:30',
  birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata',
};
const asOf = new Date('2026-10-08T12:00:00Z');
const topics = ['marriage', 'married-life', 'career', 'difficult-periods', 'general', 'education', 'finances', 'family', 'travel', 'wellbeing'];

async function withServer(run) {
  let providerCalls = 0;
  let clockCalls = 0;
  const application = await createApp({ production: true, aiKey: 'unused-test-key', today: () => { clockCalls++; return new Date(asOf); }, fetchImpl: () => { providerCalls++; throw new Error('Reports must not call a provider.'); } });
  const server = await new Promise((resolve, reject) => {
    const instance = application.app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) => fetch(`${base}/api/report`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  try {
    await run({ post, providerCalls: () => providerCalls, clockCalls: () => clockCalls });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await application.close();
  }
}

test('report model recomputes all supported facts at one server instant', () => {
  const model = buildHoroscopeReportModel({ ...profile, chart: { moon: { nakshatra: { name: 'Forged star' } } }, predictions: [{ topic: 'made-up' }] }, { asOf });
  assert.equal(model.asOf, asOf.toISOString());
  assert.equal(model.profile.name, profile.name);
  assert.deepEqual(model.chart, calculateVedicChart(profile, { asOf }));
  assert.equal(model.chart.moon.nakshatra.name, 'Dhanishta');
  assert.equal(model.chart.moon.pada, 3);
  assert.equal(model.panchanga.birthInstantUtc, '1995-05-21T05:00:00Z');
  assert.equal(model.panchanga.civilWeekday.name, 'Sunday');
  assert.equal(model.panchanga.tithi.name, 'Ashtami');
  assert.equal(model.panchanga.tithi.paksha, 'Krishna');
  assert.equal(model.panchanga.yoga.name, 'Indra');
  assert.equal(model.panchanga.karana.name, 'Balava');
  assert.deepEqual(model.predictions.map(prediction => prediction.topic), topics);
  for (const prediction of model.predictions) {
    assert.equal(prediction.asOf, '2026-10-08');
    assert.ok(prediction.method.length && prediction.limitations.length);
    for (const window of prediction.windows) {
      assert.ok(window.start >= '2026-10-08' && window.end >= window.start);
      assert.ok(window.reasons.length);
    }
  }
  assert.equal(model.chart.dasha.periods.length, 18);
  assert.equal(model.chart.dasha.periods.reduce((total, period) => total + period.antardashas.length, 0), 162);
  assert.ok(model.chart.dasha.periods[0].start < model.panchanga.birthInstantUtc);
  assert.ok(model.chart.dasha.periods[0].end > model.panchanga.birthInstantUtc);
  assert.equal(model.chart.transits.planets.length, 9);
  const career = model.predictions.find(prediction => prediction.topic === 'career');
  assert.equal(career.searchHorizonEnd, '2027-04-08');
  assert.ok(career.searchWindows.length > 0);
  assert.equal(career.planningDates.horizon.timeZone, profile.timeZone);
  assert.equal(career.planningDates.horizon.days, 90);
  assert.ok(career.planningDates.dates.length > 0 && career.planningDates.dates.length <= 8);
  for (const day of career.planningDates.dates) {
    assert.equal(day.displayDate, day.date.split('-').reverse().join('-'));
    assert.match(day.sampleLocal, /T12:00/);
    assert.equal(day.timeZone, profile.timeZone);
    assert.ok(day.reasons.length >= 3);
  }
  assert.ok(model.sharedLimits.some(limit => /not scientifically/i.test(limit)));
});

test('South Indian charts use twelve unique fixed sign cells, beginning with Aries in the top second cell', () => {
  assert.deepEqual(SOUTH_INDIAN_SIGN_CELLS[0], [1, 0]);
  assert.deepEqual(SOUTH_INDIAN_SIGN_CELLS[3], [3, 1]);
  assert.deepEqual(SOUTH_INDIAN_SIGN_CELLS[6], [2, 3]);
  assert.deepEqual(SOUTH_INDIAN_SIGN_CELLS[9], [0, 2]);
  assert.deepEqual(SOUTH_INDIAN_SIGN_CELLS[11], [0, 0]);
  assert.equal(new Set(SOUTH_INDIAN_SIGN_CELLS.map(cell => cell.join(','))).size, 12);
  for (const [column, row] of SOUTH_INDIAN_SIGN_CELLS) assert.ok(column === 0 || column === 3 || row === 0 || row === 3);
});

test('bundled fonts preserve accented and Indian-script names and explicitly identify unsupported characters', () => {
  for (const name of ['Élodie García', 'సీత రెడ్డి', 'मीरा शर्मा', 'அருண்', 'ಮೀರಾ', 'কিরণ']) {
    const result = reportTextRuns(name);
    assert.equal(result.unsupported, false, name);
    assert.equal(result.runs.map(run => run.text).join(''), name.normalize('NFC'));
    assert.ok(result.runs.every(run => run.font.startsWith('NotoSans')));
  }
  const unsupported = reportTextRuns('Mira \u{10FFFF}');
  assert.equal(unsupported.unsupported, true);
  assert.equal(unsupported.runs.map(run => run.text).join(''), 'Mira [U+10FFFF]');
});

test('report filenames never include header syntax or paths', () => {
  assert.equal(reportFilename('Élodie / "Rao"'), 'Astral-Elodie-Rao-English-horoscope.pdf');
  assert.equal(reportFilename('../../'), 'Astral-birth-chart-English-horoscope.pdf');
  assert.match(reportFilename('A'.repeat(1000)), /^Astral-A{48}-English-horoscope\.pdf$/);
  assert.match(reportFilename('Mira\r\nContent-Type: text/html'), /^[A-Za-z0-9.-]+\.pdf$/);
});

test('report renderer produces a complete A4 PDF with consistent page count and no scripted actions', async () => {
  const model = buildHoroscopeReportModel({ ...profile, name: 'Élodie García', birthPlace: 'Hyderābād, India' }, { asOf });
  const pdf = await renderHoroscopeReport(model);
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');
  const syntax = pdf.toString('latin1');
  assert.match(syntax, /%%EOF\s*$/);
  assert.match(syntax, /xref[\s\S]*trailer/);
  const pages = [...syntax.matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.ok(pages >= 15 && pages <= 45, `actual pages: ${pages}`);
  assert.match(syntax, new RegExp(`/Count ${pages}\\b`));
  assert.match(syntax, /\/MediaBox\s*\[0 0 595\.28 841\.89\]/);
  assert.doesNotMatch(syntax, /\/JavaScript|\/OpenAction|\/JS\b/);
  assert.ok(pdf.length > 30000 && pdf.length < 2 * 1024 * 1024);
  const textStreams = [...syntax.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => {
    try { return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { return ''; }
  }).join('\n');
  const actualText = [...textStreams.matchAll(/\/ActualText\s*\(([\s\S]*?)\)\s*>>/g)].map(match => {
    const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '(': '(', ')': ')' };
    const literal = match[1].replace(/\\([nrtbf\\()])/g, (_, character) => escapes[character]);
    return Buffer.from(literal, 'latin1').swap16().toString('utf16le').replace(/^\ufeff/, '');
  });
  assert.ok(actualText.includes(`Name: ${model.profile.name}`), 'Original Unicode name order must be present for text copying and extraction.');
});

test('PDF API is private, attachment-only, server-calculated and independent of AI credentials', async () => {
  await withServer(async ({ post, providerCalls, clockCalls }) => {
    const response = await post({ profile: { ...profile, name: 'Élodie / "Rao"' }, chart: { moon: 'forged' }, predictions: [{ topic: 'guaranteed-event' }], asOf: '1900-01-01' });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/pdf/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="Astral-Elodie-Rao-English-horoscope.pdf"');
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.toString('latin1').includes('(D:20261008120000Z)'), 'The PDF creation metadata must use the server clock.');
    assert.equal(providerCalls(), 0);
    assert.equal(clockCalls(), 1);
  });
});

test('report API gives useful JSON errors for incomplete birth details and rejects cross-origin requests', async () => {
  await withServer(async ({ post, providerCalls }) => {
    for (const input of [{}, { profile: { name: 'Mira', birthDate: profile.birthDate } }, { profile: { ...profile, birthTime: '25:10' } }, { profile: { ...profile, name: 'Mira\r\nX-Test: true' } }]) {
      const response = await post(input);
      assert.equal(response.status, 400);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.deepEqual(Object.keys(body), ['error']);
      assert.ok(body.error.length > 10);
    }
    const crossOrigin = await post({ profile }, { Origin: 'https://other-site.example' });
    assert.equal(crossOrigin.status, 403);
    assert.equal(providerCalls(), 0);
  });
});

test('report API shares the existing request size and rate limits', async () => {
  await withServer(async ({ post }) => {
    const large = await post({ profile, padding: 'x'.repeat(18000) });
    assert.equal(large.status, 413);
    for (let index = 0; index < 60; index++) assert.equal((await post({})).status, 400);
    const limited = await post({});
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
  });
});
