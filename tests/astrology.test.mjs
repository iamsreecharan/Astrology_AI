import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNS, getSign, validateProfile, buildReading, buildCompatibility, buildLocalReply } from '../server/astrology.mjs';

const today = new Date('2026-10-07T23:30:00.000Z');
const profile = validateProfile({ name: '  Mira  ', birthDate: '1994-03-21' }, { today });
const status400 = (error) => error.status === 400;

test('all twelve conventional calendar cusp boundaries are correctly assigned', () => {
  const cusps = [
    ['01-19', 'capricorn', '01-20', 'aquarius'],
    ['02-18', 'aquarius', '02-19', 'pisces'],
    ['03-20', 'pisces', '03-21', 'aries'],
    ['04-19', 'aries', '04-20', 'taurus'],
    ['05-20', 'taurus', '05-21', 'gemini'],
    ['06-20', 'gemini', '06-21', 'cancer'],
    ['07-22', 'cancer', '07-23', 'leo'],
    ['08-22', 'leo', '08-23', 'virgo'],
    ['09-22', 'virgo', '09-23', 'libra'],
    ['10-22', 'libra', '10-23', 'scorpio'],
    ['11-21', 'scorpio', '11-22', 'sagittarius'],
    ['12-21', 'sagittarius', '12-22', 'capricorn'],
  ];
  for (const [before, oldSign, after, newSign] of cusps) {
    assert.equal(getSign(`2000-${before}`).id, oldSign);
    assert.equal(getSign(`2000-${after}`).id, newSign);
  }
  assert.equal(getSign('2000-01-01').id, 'capricorn');
  assert.equal(getSign('2000-12-31').id, 'capricorn');
  assert.equal(SIGNS.length, 12);
  assert.equal(new Set(SIGNS.map((sign) => sign.id)).size, 12);
});

test('profile validation trims the name, ignores unknown fields, and uses calculated sign', () => {
  assert.equal(profile.name, 'Mira');
  assert.equal(profile.birthDate, '1994-03-21');
  assert.equal(profile.sign.id, 'aries');
  assert.deepEqual(validateProfile({ name: 'Mira', birthDate: '1994-03-21', sign: 'leo', unrelated: true }, { today }), profile);
  assert.equal(validateProfile({ name: 'José 李', birthDate: '1900-01-01' }, { today }).name, 'José 李');
  assert.equal(validateProfile({ name: 'Today', birthDate: '2026-10-07' }, { today }).birthDate, '2026-10-07');
});

test('birth dates reject invalid calendars, future dates, and formats without normalizing input', () => {
  for (const birthDate of ['1900-02-29', '2001-02-29', '2000-02-30', '2000-04-31', '2000-00-01', '2000-13-01', '2000-01-00', '2000-1-01', '20-01-01', ' 2000-01-01', '2000-01-01T00:00:00Z', '1899-12-31', '2026-10-08', '2030-01-01']) {
    assert.throws(() => validateProfile({ name: 'Mira', birthDate }, { today }), status400, birthDate);
  }
  assert.equal(validateProfile({ name: 'Leap', birthDate: '2000-02-29' }, { today }).sign.id, 'pisces');
  assert.equal(validateProfile({ name: 'Leap', birthDate: '2024-02-29' }, { today }).sign.id, 'pisces');
});

test('untrusted profile values fail with useful 400 errors', () => {
  for (const input of [null, undefined, [], 'Mira', {}, { name: 42, birthDate: '2000-01-01' }, { name: '', birthDate: '2000-01-01' }, { name: ' '.repeat(5), birthDate: '2000-01-01' }, { name: 'a'.repeat(61), birthDate: '2000-01-01' }, { name: 'Mira\nInjected', birthDate: '2000-01-01' }, { name: 'Mira', birthDate: null }]) {
    assert.throws(() => validateProfile(input, { today }), status400);
  }
  assert.throws(() => validateProfile({ name: 'Mira', birthDate: '2000-01-01' }, { today: new Date('invalid') }), status400);
  assert.throws(() => getSign('2000-04-31'), status400);
});

test('readings are reproducible and vary with date, sign, and focus', () => {
  const options = { date: '2026-10-07', focus: 'general' };
  const reading = buildReading(profile, options);
  assert.deepEqual(buildReading(profile, options), reading);
  assert.deepEqual(buildReading({ ...profile, name: 'Someone else' }, options), reading);
  const nextDay = buildReading(profile, { ...options, date: '2026-10-08' });
  assert.notEqual(nextDay.overview, reading.overview);
  assert.notDeepEqual(nextDay.sections, reading.sections);
  assert.notDeepEqual(buildReading(validateProfile({ name: 'Mira', birthDate: '1994-07-23' }, { today }), options), reading);
  assert.equal(reading.source, 'local');
  assert.equal(reading.sections.length, 3);
  assert.ok(reading.sections.every((section) => section.label.length && section.text.length));
  assert.ok(Number.isInteger(reading.lucky.number) && reading.lucky.number >= 1 && reading.lucky.number <= 99);
  for (const focus of ['love', 'career', 'wellbeing']) {
    const focused = buildReading(profile, { ...options, focus });
    assert.equal(focused.focus, focus);
    assert.notEqual(focused.overview, reading.overview);
    assert.notDeepEqual(focused.sections, reading.sections);
  }
  assert.throws(() => buildReading(profile, { focus: 'fortune' }), status400);
  assert.throws(() => buildReading(profile, { date: '2026-02-30' }), status400);
  assert.throws(() => buildReading({ sign: 'not-a-sign' }), status400);
});

test('compatibility reflections are symmetric while preserving requested sign labels', () => {
  const forward = buildCompatibility('Aries', 'libra');
  const reverse = buildCompatibility('libra', 'aries');
  assert.equal(forward.signA.id, 'aries');
  assert.equal(reverse.signA.id, 'libra');
  for (const key of ['headline', 'summary', 'strengths', 'challenges', 'conversationStarter']) {
    assert.deepEqual(forward[key], reverse[key]);
  }
  assert.ok(forward.strengths.length >= 2);
  assert.ok(forward.challenges.length >= 2);
  assert.equal('score' in forward, false);
  assert.equal(buildCompatibility(SIGNS[0], SIGNS[0]).signB.id, 'aries');
  assert.throws(() => buildCompatibility('aries', 'ophiuchus'), status400);
  assert.throws(() => buildCompatibility('__proto__', 'aries'), status400);
});

test('local replies are transparent, relevant, bounded, and never echo hostile markup', () => {
  const career = buildLocalReply(profile, { message: 'How can I prepare for a job interview?' });
  assert.match(career, /local reflection guide, not an AI-generated response/);
  assert.match(career, /Aries/);
  assert.match(career, /practical next step/);
  const hostile = buildLocalReply(profile, { message: '<script>alert("hi")</script>' });
  assert.equal(hostile.includes('<script>'), false);
  const health = buildLocalReply(profile, { message: 'Should I stop my medication?' });
  assert.match(health, /qualified health professional/);
  const financial = buildLocalReply(profile, { message: 'Which stocks will make me rich?' });
  assert.match(financial, /cannot predict financial outcomes/);
  const crisis = buildLocalReply(profile, { message: 'I want to kill myself' });
  assert.match(crisis, /988/);
  assert.match(crisis, /local emergency services/);
  const relationship = buildLocalReply(profile, { message: 'Does my partner love me?' });
  assert.match(relationship, /cannot tell you how someone feels/);
  for (const message of ['', '   ', null, 3, 'x'.repeat(2001), '\u0000']) {
    assert.throws(() => buildLocalReply(profile, { message }), status400);
  }
  assert.throws(() => buildLocalReply(profile, { message: 'Hello', focus: 'unknown' }), status400);
});

test('exported zodiac records cannot be mutated between users', () => {
  assert.throws(() => { SIGNS[0].name = 'Changed'; }, TypeError);
  assert.throws(() => { SIGNS[0].traits.push('Changed'); }, TypeError);
  assert.equal(getSign('1994-03-21').name, 'Aries');
});

test('Cancer sign questions receive zodiac reflection while cancer illness receives medical guidance', () => {
  for (const message of ['Tell me about Cancer', 'What are Cancer traits?', 'I am a Cancer', 'Tell me about the Cancer zodiac sign']) {
    const reply = buildLocalReply(profile, { message });
    assert.match(reply, /Cancer \(Jun 21 – Jul 22\)/, message);
    assert.match(reply, /water sign/, message);
    assert.doesNotMatch(reply, /qualified health professional/, message);
  }
  for (const message of ['I have cancer, can astrology guide treatment?', 'Tell me about cancer treatment', 'Will I get cancer according to my zodiac sign?', 'Can my Cancer sign tell me whether my tumor is dangerous?', 'I am a cancer patient. What should I eat?', 'I am a cancer survivor. How should I prepare for follow-up?']) {
    const reply = buildLocalReply(profile, { message });
    assert.match(reply, /qualified health professional/, message);
    assert.match(reply, /cannot diagnose a condition or guide treatment/, message);
  }
});

test('communication and ordinary bet-prefix words are distinct from betting requests', () => {
  const communication = buildLocalReply(profile, { message: 'How can I communicate better?' });
  assert.match(communication, /respectful conversation/);
  assert.doesNotMatch(communication, /financial outcomes|lucky wins/);
  for (const message of ['How can I communicate better?', 'How do I improve communication?', 'How can I find a better balance between work and rest?']) {
    assert.doesNotMatch(buildLocalReply(profile, { message }), /financial outcomes|lucky wins/, message);
  }
  for (const message of ['Where should I bet today?', 'Which bets should I place?', 'How will betting go for me?', 'Is a bettor lucky today?', 'Are bettors lucky today?']) {
    assert.match(buildLocalReply(profile, { message }), /cannot predict financial outcomes or lucky wins/, message);
  }
});
