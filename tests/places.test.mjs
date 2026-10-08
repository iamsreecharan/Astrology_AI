import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { searchPlaces } from '../server/places.mjs';

function findPlace(query, name, country) {
  const places = searchPlaces(query);
  const place = places.find(value => value.name === name && value.country === country);
  assert.ok(place, `${name}, ${country} should be suggested for ${query}`);
  return place;
}

function assertPlace(place) {
  assert.deepEqual(Object.keys(place).sort(), [
    'country', 'id', 'label', 'latitude', 'longitude', 'name', 'region', 'timeZone',
  ]);
  assert.match(place.id, /^\d+$/);
  assert.ok(place.name.length > 0);
  assert.ok(place.label.includes(place.name));
  assert.ok(place.label.includes(place.country));
  assert.ok(place.label.length <= 120);
  assert.ok(Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90);
  assert.ok(Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180);
  assert.equal(typeof place.region, 'string');
  assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: place.timeZone }));
}

test('the bundled place database matches its recorded source snapshot', () => {
  const databaseUrl = new URL('../server/data/places.sqlite', import.meta.url);
  const metadata = JSON.parse(readFileSync(new URL('../server/data/places-metadata.json', import.meta.url), 'utf8'));
  const bytes = readFileSync(databaseUrl);
  assert.equal(bytes.length, metadata.databaseBytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.databaseSha256);
  const database = new DatabaseSync(databaseUrl.pathname, { readOnly: true });
  try {
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM places').get().count, metadata.placeCount);
    assert.ok(metadata.placeCount > 200_000);
    assert.ok(metadata.countryCount > 200);
    assert.deepEqual(database.prepare('PRAGMA quick_check').all().map(row => row.quick_check), ['ok']);
  } finally {
    database.close();
  }
});

test('suggestions provide birth-chart facts across continents and for small towns', () => {
  const cases = [
    ['Hyder', 'Hyderabad', 'India', 'Asia/Kolkata', 17.38405, 78.45636],
    ['Tokyo', 'Tokyo', 'Japan', 'Asia/Tokyo', 35.6895, 139.69171],
    ['Nairobi', 'Nairobi', 'Kenya', 'Africa/Nairobi', -1.28333, 36.81667],
    ['São Paulo', 'São Paulo', 'Brazil', 'America/Sao_Paulo', -23.5475, -46.63611],
    ['London', 'London', 'United Kingdom', 'Europe/London', 51.50853, -0.12574],
    ['Wickwar', 'Wickwar', 'United Kingdom', 'Europe/London', 51.59404, -2.39968],
  ];
  for (const [query, name, country, timeZone, latitude, longitude] of cases) {
    const place = findPlace(query, name, country);
    assertPlace(place);
    assert.equal(place.timeZone, timeZone);
    assert.equal(place.latitude, latitude);
    assert.equal(place.longitude, longitude);
  }
});

test('accented, decomposed, and alternate native names find the same city', () => {
  const saoPaulo = findPlace('Sao Paulo', 'São Paulo', 'Brazil');
  assert.equal(findPlace('SÃO PAULO', 'São Paulo', 'Brazil').id, saoPaulo.id);
  assert.equal(findPlace('Sa\u0303o Paulo', 'São Paulo', 'Brazil').id, saoPaulo.id);
  const hyderabad = findPlace('Hyderabad India', 'Hyderabad', 'India');
  assert.equal(findPlace('హైదరాబాద్', 'Hyderabad', 'India').id, hyderabad.id);
  assert.equal(findPlace('हैदराबाद', 'Hyderabad', 'India').id, hyderabad.id);
  assert.equal(findPlace('東京', 'Tokyo', 'Japan').id, findPlace('Tokyo', 'Tokyo', 'Japan').id);
});

test('country and region words distinguish cities with the same name', () => {
  const hyderabad = searchPlaces('Hyderabad');
  assert.equal(hyderabad[0].country, 'India');
  assert.equal(findPlace('Hyderabad Pakistan', 'Hyderabad', 'Pakistan').timeZone, 'Asia/Karachi');
  assert.equal(findPlace('Hyderabad Telangana', 'Hyderabad', 'India').region, 'Telangana');
  assert.equal(findPlace('London Canada', 'London', 'Canada').region, 'Ontario');
  const springfield = findPlace('Springfield Oregon', 'Springfield', 'United States');
  assert.equal(springfield.region, 'Oregon');
  assert.equal(springfield.timeZone, 'America/Los_Angeles');
  assert.ok(springfield.label.includes('Oregon'));
  assert.equal(searchPlaces('Paris France')[0].timeZone, 'Europe/Paris');
});

test('a matching city name ranks ahead of an alternate-name match', () => {
  const places = searchPlaces('New York');
  assert.equal(places[0].name, 'New York City');
  assert.equal(places[0].country, 'United States');
  assert.equal(searchPlaces('London')[0].name, 'London');
  assert.equal(searchPlaces('London')[0].country, 'United Kingdom');
});

test('short, broad, and missing-result queries remain bounded', () => {
  for (const query of ['', ' ', 'a', '1a', '12', '***']) assert.deepEqual(searchPlaces(query), []);
  const broad = searchPlaces('Sa');
  assert.ok(broad.length > 0 && broad.length <= 8);
  assert.equal(new Set(broad.map(place => place.id)).size, broad.length);
  broad.forEach(assertPlace);
  assert.deepEqual(searchPlaces('zzzznotarealplacexxxx'), []);
  assert.deepEqual(searchPlaces('  Tokyo  '), searchPlaces('Tokyo'));
});

test('invalid values and oversized text are rejected', () => {
  for (const query of [undefined, null, 42, ['Tokyo'], { q: 'Tokyo' }]) {
    assert.throws(() => searchPlaces(query));
  }
  assert.throws(() => searchPlaces('a'.repeat(121)));
});

test('SQL and FTS punctuation is treated as text rather than a query language', () => {
  for (const query of [
    'London OR Tokyo',
    'Hyderabad\'); DROP TABLE places;--',
    '"London" OR "Tokyo"',
    'name:Tokyo',
  ]) {
    assert.deepEqual(searchPlaces(query), []);
  }
  assert.equal(searchPlaces('"Tokyo"')[0].name, 'Tokyo');
  assert.equal(findPlace('Tokyo', 'Tokyo', 'Japan').id, '1850147');
});

test('place lookup works without a network connection', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Place lookup must use bundled data'); };
  try {
    assert.equal(findPlace('Nairobi', 'Nairobi', 'Kenya').timeZone, 'Africa/Nairobi');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
