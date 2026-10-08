import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';

async function withServer(run) {
  let providerCalls = 0;
  const application = await createApp({
    production: true,
    aiKey: '',
    fetchImpl: () => {
      providerCalls += 1;
      throw new Error('Place suggestions should not contact an AI provider');
    },
  });
  const server = await new Promise((resolve, reject) => {
    const instance = application.app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) });
  try {
    await run(get);
    assert.equal(providerCalls, 0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await application.close();
  }
}

test('the places endpoint returns global suggestions with selection facts and credit', async () => {
  await withServer(async get => {
    const response = await get('/api/places?q=Hyderabad');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const result = await response.json();
    assert.deepEqual(Object.keys(result).sort(), ['attribution', 'places']);
    assert.deepEqual(result.attribution, {
      label: 'Place names from GeoNames',
      url: 'https://www.geonames.org/',
    });
    assert.ok(result.places.length > 0 && result.places.length <= 8);
    const india = result.places.find(place => place.country === 'India');
    const pakistan = result.places.find(place => place.country === 'Pakistan');
    assert.equal(india.timeZone, 'Asia/Kolkata');
    assert.equal(pakistan.timeZone, 'Asia/Karachi');
    assert.notEqual(india.id, pakistan.id);
    assert.notEqual(india.latitude, pakistan.latitude);
    assert.ok(india.label.includes('Telangana'));
    assert.ok(pakistan.label.includes('Sindh'));
    for (const place of result.places) {
      assert.equal(typeof place.id, 'string');
      assert.deepEqual(Object.keys(place).sort(), [
        'country', 'id', 'label', 'latitude', 'longitude', 'name', 'region', 'timeZone',
      ]);
    }
  });
});

test('native-language and country-qualified searches work through the HTTP endpoint', async () => {
  await withServer(async get => {
    for (const [query, name, timeZone] of [
      ['東京', 'Tokyo', 'Asia/Tokyo'],
      ['హైదరాబాద్', 'Hyderabad', 'Asia/Kolkata'],
      ['Sao Paulo Brazil', 'São Paulo', 'America/Sao_Paulo'],
      ['London Canada', 'London', 'America/Toronto'],
      ['Springfield Oregon', 'Springfield', 'America/Los_Angeles'],
    ]) {
      const response = await get(`/api/places?q=${encodeURIComponent(query)}`);
      assert.equal(response.status, 200);
      const { places } = await response.json();
      assert.ok(places.some(place => place.name === name && place.timeZone === timeZone), query);
    }
  });
});

test('missing, repeated, and oversized query values are rejected without internal details', async () => {
  await withServer(async get => {
    for (const path of [
      '/api/places',
      '/api/places?q=Tokyo&q=London',
      '/api/places?q[name]=Tokyo',
      `/api/places?q=${'a'.repeat(121)}`,
    ]) {
      const response = await get(path);
      assert.equal(response.status, 400, path);
      const result = await response.json();
      assert.deepEqual(Object.keys(result), ['error']);
      assert.equal(typeof result.error, 'string');
      assert.ok(result.error.length > 0);
      assert.doesNotMatch(result.error, /sqlite|SELECT|\/workspace|stack/i);
    }
  });
});

test('short queries and absent places return an empty successful response', async () => {
  await withServer(async get => {
    for (const query of ['', 'a', '1a', '*', 'zzzznotarealplacexxxx']) {
      const response = await get(`/api/places?q=${encodeURIComponent(query)}`);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.deepEqual(result.places, []);
      assert.equal(result.attribution.url, 'https://www.geonames.org/');
    }
  });
});

test('literal punctuation cannot broaden the search or damage later requests', async () => {
  await withServer(async get => {
    const query = 'London\'); DROP TABLE places;--';
    const response = await get(`/api/places?q=${encodeURIComponent(query)}`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).places, []);
    const healthy = await get('/api/places?q=London');
    assert.equal(healthy.status, 200);
    const { places } = await healthy.json();
    assert.equal(places[0].country, 'United Kingdom');
  });
});
