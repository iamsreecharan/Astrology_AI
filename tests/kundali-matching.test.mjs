import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKundaliMatch, calculateAshtaKoota, kundaliBenchmark } from '../server/kundali-matching.mjs';

const moon = longitude => ({ moon: { longitude, nakshatra: { index: Math.floor(longitude / (360 / 27)) } } });
const star = index => moon((index + 0.5) * (360 / 27));
const scores = result => result.kootas.map(koota => koota.score);
const score = (male, female, id) => calculateAshtaKoota(male, female).kootas.find(koota => koota.id === id).score;

// Hand-worked cases use the published North Indian tables referenced by the
// method. The Moon degrees make the sign and star inputs independently clear.
test('Rohini and Mrigashira in Taurus receive the full 36 points in the stated role convention', () => {
  const result = calculateAshtaKoota(moon(45), moon(55));
  assert.equal(result.moons.male.nakshatra.name, 'Rohini');
  assert.equal(result.moons.female.nakshatra.name, 'Mrigashira');
  assert.deepEqual(scores(result), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(result.total, 36);
  assert.equal(result.benchmark.id, 'excellent');
  assert.deepEqual(result.counts, { fullyMatched: 8, partiallyMatched: 0, notMatched: 0, withPoints: 8, totalCategories: 8 });
  assert.equal(calculateAshtaKoota(moon(55), moon(45)).total, 35);
});

test('Ashwini and Pushya give the hand-calculated 29.5-point base score', () => {
  const result = calculateAshtaKoota(star(0), star(7));
  assert.deepEqual(scores(result), [0, 1, 1.5, 2, 4, 6, 7, 8]);
  assert.equal(result.total, 29.5);
  assert.deepEqual(result.kootas[2].details.maleToFemale, { count: 8, position: 8, name: 'Mitra', favourable: true, score: 1.5 });
  assert.deepEqual(result.kootas[2].details.femaleToMale, { count: 21, position: 3, name: 'Vipat', favourable: false, score: 0 });
});

test('same birth star keeps Janma Tara and same Nadi at zero without cancellation upgrades', () => {
  const result = calculateAshtaKoota(star(0), star(0));
  assert.deepEqual(scores(result), [1, 2, 0, 4, 5, 6, 7, 0]);
  assert.equal(result.total, 25);
  assert.equal(result.kootas[2].details.maleToFemale.count, 1);
  assert.equal(result.kootas[7].details.cancellationApplied, false);
});

test('historical directional Vashya and Gana roles are retained rather than symmetrized', () => {
  assert.equal(score(moon(5), moon(220), 'vashya'), 1);
  assert.equal(score(moon(220), moon(5), 'vashya'), 2);
  assert.equal(score(moon(45), moon(55), 'gana'), 6);
  assert.equal(score(moon(55), moon(45), 'gana'), 5);
});

test('Sagittarius and Capricorn Vashya groups split at exactly 15 degrees', () => {
  const identity = longitude => calculateAshtaKoota(moon(longitude), moon(55)).moons.male;
  assert.equal(identity(254.999999).vashya, 'Manava (human)');
  assert.equal(identity(255).vashya, 'Chatushpada (quadruped)');
  assert.equal(identity(284.999999).vashya, 'Chatushpada (quadruped)');
  assert.equal(identity(285).vashya, 'Jalachara (water)');
});

test('rounded boundary longitudes preserve the calculated unrounded sign and pada', () => {
  const before = { moon: { longitude: 30, rashi: 'Mesha (Aries)', pada: 1, nakshatra: { index: 2 } }, planets: [{ name: 'Moon', signIndex: 0 }] };
  const after = { moon: { longitude: 30, rashi: 'Vrishabha (Taurus)', pada: 2, nakshatra: { index: 2 } }, planets: [{ name: 'Moon', signIndex: 1 }] };
  const result = calculateAshtaKoota(before, after);
  assert.equal(result.moons.male.signIndex, 0);
  assert.equal(result.moons.male.pada, 1);
  assert.equal(result.moons.female.signIndex, 1);
  assert.equal(result.moons.female.pada, 2);
  assert.throws(() => calculateAshtaKoota({ moon: { ...before.moon, pada: 4 } }, after), error => error.status === 400);
});

test('the seven traditional enemy-animal pairs receive zero Yoni points in either direction', () => {
  for (const [a, b] of [[0, 12], [1, 22], [2, 19], [3, 20], [5, 16], [6, 9], [11, 13]]) {
    assert.equal(score(star(a), star(b), 'yoni'), 0, `${a} / ${b}`);
    assert.equal(score(star(b), star(a), 'yoni'), 0, `${b} / ${a}`);
  }
});

test('Graha Maitri considers both natural relations including half-point pairs', () => {
  // Moon/Mercury are friend/enemy; Mars/Mercury are enemy/neutral.
  assert.equal(score(moon(100), moon(70), 'graha-maitri'), 1);
  assert.equal(score(moon(5), moon(70), 'graha-maitri'), 0.5);
  assert.equal(score(moon(5), moon(230), 'graha-maitri'), 5);
});

test('Bhakoot keeps the 2/12, 5/9 and 6/8 base rules with no inferred cancellations', () => {
  for (const longitude of [35, 125, 155]) {
    const result = calculateAshtaKoota(moon(5), moon(longitude));
    assert.equal(result.kootas[6].score, 0);
    assert.equal(result.kootas[6].details.cancellationApplied, false);
    assert.equal(score(moon(longitude), moon(5), 'bhakoot'), 0);
  }
  assert.equal(score(moon(5), moon(95), 'bhakoot'), 7);
});

test('all 27-star pairings have bounded half-point scores, valid classifications and complete counts', () => {
  const symmetric = ['tara', 'yoni', 'graha-maitri', 'bhakoot', 'nadi'];
  for (let a = 0; a < 27; a++) for (let b = 0; b < 27; b++) {
    const result = calculateAshtaKoota(star(a), star(b));
    const reverse = calculateAshtaKoota(star(b), star(a));
    assert.equal(result.kootas.length, 8);
    assert.equal(result.kootas.reduce((sum, koota) => sum + koota.max, 0), 36);
    assert.equal(result.total, result.kootas.reduce((sum, koota) => sum + koota.score, 0));
    assert.equal(result.counts.fullyMatched + result.counts.partiallyMatched + result.counts.notMatched, 8);
    for (const koota of result.kootas) {
      assert.ok(Number.isFinite(koota.score) && koota.score >= 0 && koota.score <= koota.max);
      assert.equal(koota.score * 2, Math.floor(koota.score * 2));
      if (symmetric.includes(koota.id)) assert.equal(koota.score, reverse.kootas.find(other => other.id === koota.id).score);
    }
  }
});

test('traditional benchmark bands cover half points and both 18 and 36 boundaries', () => {
  for (const [total, band] of [[0, 'below-minimum'], [17.5, 'below-minimum'], [18, 'acceptable'], [24.5, 'acceptable'], [25, 'good'], [32.5, 'good'], [33, 'excellent'], [36, 'excellent']]) {
    assert.equal(kundaliBenchmark(total).id, band);
    assert.equal(kundaliBenchmark(total).meetsMinimum, total >= 18);
  }
  for (const invalid of [-1, 36.5, NaN, Infinity]) assert.throws(() => kundaliBenchmark(invalid), error => error.status === 400);
});

test('names only label validated birth records and client scores are ignored', () => {
  const person = { name: 'Alex', birthDate: '1995-05-21', birthTime: '10:30', birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata' };
  const pair = { male: { ...person, privateExtra: 'PRIVATE EXTRA' }, female: { ...person, name: 'Mira' }, total: 36 };
  const original = structuredClone(pair);
  const result = buildKundaliMatch(pair, { today: new Date('2026-10-08T12:00:00Z') });
  assert.deepEqual(pair, original);
  assert.equal(result.total, 25);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE EXTRA/);
  assert.deepEqual(scores(result), scores(buildKundaliMatch({ male: { ...person, name: 'Another name' }, female: person }, { today: new Date('2026-10-08T12:00:00Z') })));
});

test('invalid or inconsistent derived Moon records cannot produce a score', () => {
  for (const input of [null, {}, moon(NaN), moon(360), { moon: { longitude: 20, nakshatra: { index: 0 } } }, { moon: { longitude: 5, rashi: 'not a sign', nakshatra: { index: 0 } } }]) {
    assert.throws(() => calculateAshtaKoota(input, moon(55)), error => error.status === 400);
  }
});
