import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { buildKundaliMatch } from '../server/kundali-matching.mjs';
import { kundaliReportFilename } from '../server/kundali-report.mjs';

const today = new Date('2026-10-08T12:00:00Z');
const male = { name: 'Arun Rao', birthDate: '1992-08-14', birthTime: '06:45', birthPlace: 'Bengaluru, India', latitude: 12.9716, longitude: 77.5946, timeZone: 'Asia/Kolkata' };
const female = { name: 'Mira Rao', birthDate: '1995-05-21', birthTime: '10:30', birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata' };

async function withServer(run) {
  let providerCalls = 0;
  let clockCalls = 0;
  const application = await createApp({ production: true, aiKey: 'test-key-unused-for-matching', today: () => { clockCalls++; return new Date(today); }, fetchImpl: () => { providerCalls++; throw new Error('Matching must not call an AI provider.'); } });
  const server = await new Promise((resolve, reject) => {
    const instance = application.app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, headers = {}) => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  try {
    await run({ post, base, providerCalls: () => providerCalls, clockCalls: () => clockCalls });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await application.close();
  }
}

async function expectError(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ['error']);
  assert.ok(typeof body.error === 'string' && body.error.length > 5);
  return body.error;
}

test('Kundali API calculates all eight categories at one server instant without provider calls', async () => {
  await withServer(async ({ post, providerCalls, clockCalls }) => {
    const response = await post('/api/kundali-match', { male, female, total: 36, moons: { male: { nakshatra: { index: 0 } } }, generatedAt: '1900-01-01', chart: 'client supplied scores' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const match = await response.json();
    assert.deepEqual(match, buildKundaliMatch({ male, female }, { today }));
    assert.equal(match.max, 36);
    assert.equal(match.kootas.length, 8);
    assert.equal(match.generatedAt, today.toISOString());
    assert.equal(match.total, match.kootas.reduce((sum, koota) => sum + koota.score, 0));
    assert.equal(match.counts.fullyMatched + match.counts.partiallyMatched + match.counts.notMatched, 8);
    assert.equal(match.benchmark.minimum, 18);
    assert.equal(providerCalls(), 0);
    assert.equal(clockCalls(), 1);
    assert.doesNotMatch(JSON.stringify(match), /test-key-unused|client supplied scores/);
  });
});

test('Kundali PDF is a private attachment calculated from the same two profiles', async () => {
  await withServer(async ({ post, providerCalls, clockCalls }) => {
    const response = await post('/api/kundali-report', { male: { ...male, name: 'Élodie / "Rao"' }, female, total: 36, generatedAt: '1900-01-01' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-type'), /^application\/pdf/);
    assert.equal(response.headers.get('content-disposition'), `attachment; filename="${kundaliReportFilename('Élodie / "Rao"', female.name)}"`);
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');
    assert.ok(pdf.toString('latin1').includes('(D:20261008120000Z)'));
    assert.ok(pdf.length > 15000 && pdf.length < 2 * 1024 * 1024);
    assert.equal(providerCalls(), 0);
    assert.equal(clockCalls(), 1);
  });
});

test('both matching routes require complete, valid birth records and return bounded JSON errors', async () => {
  await withServer(async ({ post, providerCalls }) => {
    const invalidPairs = [
      {}, { male, female: null }, { male: [], female },
      { male: { name: male.name, birthDate: male.birthDate }, female },
      { male, female: { ...female, birthTime: '25:10' } },
      { male: { ...male, latitude: 91 }, female },
      { male, female: { ...female, timeZone: 'not/a-real-zone' } },
      { male: { ...male, name: 'Arun\r\nPrivate marker' }, female },
      { male, female: { ...female, birthDate: '2026-10-09' } },
      { male: { ...male, birthDate: '2024-03-10', birthTime: '02:30', birthPlace: 'New York, USA', latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' }, female },
    ];
    for (const route of ['/api/kundali-match', '/api/kundali-report']) {
      for (const pair of invalidPairs) {
        const message = await expectError(await post(route, pair), 400);
        assert.doesNotMatch(message, /Private marker|test-key-unused/);
      }
    }
    assert.equal(providerCalls(), 0);
  });
});

test('matching and report routes use the existing origin, JSON size and shared rate limits', async () => {
  await withServer(async ({ post, base, providerCalls }) => {
    for (const route of ['/api/kundali-match', '/api/kundali-report']) {
      await expectError(await post(route, { male, female }, { Origin: 'https://other-site.example' }), 403);
      await expectError(await post(route, { male, female }, { Origin: 'not a URL' }), 403);
      await expectError(await post(route, { male, female, padding: 'x'.repeat(18000) }), 413);
    }
    const malformed = await fetch(`${base}/api/kundali-match`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"male":', signal: AbortSignal.timeout(5000) });
    await expectError(malformed, 400);
    for (let index = 0; index < 60; index++) await expectError(await post(index % 2 ? '/api/kundali-match' : '/api/kundali-report', {}), 400);
    const limited = await post('/api/kundali-report', {});
    await expectError(limited, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
    assert.equal(providerCalls(), 0);
  });
});
