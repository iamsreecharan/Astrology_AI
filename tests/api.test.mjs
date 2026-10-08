import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';

const profile = { name: 'Maya Rao', birthDate: '1994-04-12' };
const fixedDate = '2026-10-08';
const privateKey = 'test-server-only-key-do-not-expose';

async function withServer(options, run) {
  const application = await createApp({
    production: true,
    aiKey: '',
    today: () => new Date(`${fixedDate}T12:00:00Z`),
    ...options,
  });
  const server = await new Promise((resolve, reject) => {
    const instance = application.app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, options = {}) => fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(5000),
    ...options,
  });
  const post = (path, body, options = {}) => get(path, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
  });
  try {
    await run({ base, get, post });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await application.close();
  }
}

async function expectError(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const result = await response.json();
  assert.equal(typeof result.error, 'string');
  assert.ok(result.error.length > 0);
  assert.deepEqual(Object.keys(result), ['error']);
  return result;
}

test('health and public configuration expose twelve signs without credentials', async () => {
  await withServer({}, async ({ get }) => {
    const health = await get('/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', service: 'astral' });
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('x-powered-by'), null);

    const response = await get('/api/config');
    assert.equal(response.status, 200);
    const config = await response.json();
    assert.equal(config.aiEnabled, false);
    assert.equal(config.model, null);
    assert.equal(config.signs.length, 12);
    assert.equal(new Set(config.signs.map(sign => sign.id)).size, 12);
    for (const sign of config.signs) {
      assert.equal(typeof sign.id, 'string');
      assert.equal(typeof sign.name, 'string');
      assert.equal(typeof sign.element, 'string');
    }
  });

  await withServer({ aiKey: privateKey, model: 'test-model' }, async ({ get }) => {
    const response = await get('/api/config');
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.equal(text.includes(privateKey), false);
    assert.equal(JSON.parse(text).aiEnabled, true);
    assert.equal(JSON.parse(text).model, 'test-model');
  });
});

test('profile returns the calendar sun sign and rejects invalid profile data', async () => {
  await withServer({}, async ({ post }) => {
    const valid = await post('/api/profile', profile);
    assert.equal(valid.status, 200);
    const result = await valid.json();
    assert.equal(result.name, profile.name);
    assert.equal(result.birthDate, profile.birthDate);
    assert.equal(result.sign.id, 'aries');

    for (const invalid of [
      null,
      [],
      {},
      { ...profile, birthDate: '1994-4-12' },
      { ...profile, birthDate: '1994-02-30' },
      { ...profile, birthDate: '2025-02-29' },
      { ...profile, birthDate: '2026-10-09' },
      { ...profile, birthDate: 19940412 },
      { ...profile, name: 'x'.repeat(61) },
      { ...profile, name: '   ' },
      { ...profile, name: 'Maya\nRao' },
    ]) {
      await expectError(await post('/api/profile', invalid), 400);
    }

    const leapDay = await post('/api/profile', { ...profile, birthDate: '2000-02-29' });
    assert.equal(leapDay.status, 200);
    assert.equal((await leapDay.json()).sign.id, 'pisces');
  });
});

test('malformed and oversized JSON return useful errors without echoing input', async () => {
  await withServer({}, async ({ get, post }) => {
    const malformed = await get('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"private-user-input",',
    });
    const parseError = await expectError(malformed, 400);
    assert.equal(parseError.error, 'Send a valid JSON request.');
    assert.equal(JSON.stringify(parseError).includes('private-user-input'), false);

    const large = await post('/api/profile', { ...profile, name: 'x'.repeat(17000) });
    const sizeError = await expectError(large, 413);
    assert.equal(sizeError.error, 'The request is too large.');
  });
});

test('readings support every documented focus and default to general', async () => {
  await withServer({}, async ({ post }) => {
    for (const focus of ['general', 'love', 'career', 'wellbeing']) {
      const response = await post('/api/reading', { profile, focus });
      assert.equal(response.status, 200);
      const reading = await response.json();
      assert.equal(reading.date, fixedDate);
      assert.equal(reading.focus, focus);
      assert.equal(reading.source, 'local');
      for (const key of ['headline', 'overview', 'affirmation', 'ritual']) {
        assert.equal(typeof reading[key], 'string');
        assert.ok(reading[key].trim().length > 0);
      }
      assert.ok(reading.sections.length > 0);
      for (const section of reading.sections) {
        assert.equal(typeof section.label, 'string');
        assert.equal(typeof section.text, 'string');
      }
      assert.equal(typeof reading.lucky.color, 'string');
      assert.equal(typeof reading.lucky.number, 'number');
    }
    const defaultReading = await post('/api/reading', { profile });
    assert.equal(defaultReading.status, 200);
    assert.equal((await defaultReading.json()).focus, 'general');
    await expectError(await post('/api/reading', { profile, focus: 'unknown' }), 400);
    await expectError(await post('/api/reading', { profile, focus: null }), 400);
    await expectError(await post('/api/reading', { profile: { ...profile, birthDate: 'bad' } }), 400);
  });
});

test('reading dates follow the requested time zone across midnight', async () => {
  await withServer({ today: () => new Date('2026-10-08T00:30:00Z') }, async ({ post }) => {
    for (const [timeZone, date] of [['America/New_York', '2026-10-07'], ['UTC', '2026-10-08']]) {
      const response = await post('/api/reading', { profile, timeZone });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).date, date);
    }
    const defaultZone = await post('/api/reading', { profile });
    assert.equal(defaultZone.status, 200);
    assert.equal((await defaultZone.json()).date, '2026-10-07');
    await expectError(await post('/api/reading', { profile, timeZone: 'Invalid/Zone' }), 400);
  });
});

test('compatibility requires two valid zodiac signs', async () => {
  await withServer({}, async ({ post }) => {
    const response = await post('/api/compatibility', { signA: 'aries', signB: 'libra' });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.signA.id, 'aries');
    assert.equal(result.signB.id, 'libra');
    assert.equal(typeof result.headline, 'string');
    assert.equal(typeof result.summary, 'string');
    assert.ok(result.strengths.length > 0);
    assert.ok(result.challenges.length > 0);
    assert.equal(typeof result.conversationStarter, 'string');
    for (const invalid of [
      {},
      { signA: 'aries' },
      { signA: 'unknown', signB: 'libra' },
      { signA: 'aries', signB: 'unknown' },
      { signA: null, signB: 'libra' },
    ]) {
      await expectError(await post('/api/compatibility', invalid), 400);
    }
  });
});

test('local chat works without credentials and explicit live AI explains missing configuration', async () => {
  await withServer({}, async ({ post }) => {
    for (const mode of [undefined, 'local']) {
      const response = await post('/api/chat', { profile, message: 'What should I reflect on at work?', mode });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.source, 'local');
      assert.equal(typeof result.reply, 'string');
      assert.ok(result.reply.trim().length > 0);
    }
    const unavailable = await expectError(await post('/api/chat', { profile, message: 'Help me reflect.', mode: 'ai' }), 503);
    assert.match(unavailable.error, /ASTROLOGY_AI_API_KEY/);
    assert.match(unavailable.error, /Local reflection/);
    for (const invalid of [
      { profile },
      { profile, message: '' },
      { profile, message: '   ' },
      { profile, message: 'x'.repeat(1001) },
      { profile, message: 12 },
      { profile, message: 'Hello', mode: 'unknown' },
      { profile, message: 'Hello', focus: 'unknown' },
    ]) {
      await expectError(await post('/api/chat', invalid), 400);
    }
  });
});

test('live AI uses server credentials and sends sign context without the profile identity', async () => {
  const calls = [];
  await withServer({
    aiKey: privateKey,
    model: 'test-model',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ choices: [{ message: { content: '  Make space for one useful conversation.  ' } }] });
    },
  }, async ({ post }) => {
    const response = await post('/api/chat', {
      profile,
      message: 'How can I approach a career decision?',
      focus: 'career',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply: 'Make space for one useful conversation.', source: 'ai' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, `Bearer ${privateKey}`);
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.model, 'test-model');
    assert.equal(body.max_completion_tokens, 650);
    assert.deepEqual(body.messages.map(message => message.role), ['system', 'user']);
    assert.match(body.messages[1].content, /Aries/);
    assert.match(body.messages[1].content, /career/);
    assert.equal(calls[0].options.body.includes(profile.name), false);
    assert.equal(calls[0].options.body.includes(profile.birthDate), false);
    assert.equal(calls[0].options.body.includes(privateKey), false);

    const local = await post('/api/chat', { profile, message: 'A practical step?', mode: 'local' });
    assert.equal(local.status, 200);
    assert.equal((await local.json()).source, 'local');
    assert.equal(calls.length, 1);
  });
});

test('provider rejection, exceptions, and invalid replies return sanitized errors', async t => {
  const upstreamPrivateText = `provider-private-detail:${privateKey}:${profile.name}`;
  const cases = [
    ['rejected request', async () => new Response(upstreamPrivateText, { status: 401 })],
    ['fetch exception', async () => { throw new Error(upstreamPrivateText); }],
    ['empty content', async () => Response.json({ choices: [{ message: { content: '   ' } }] })],
    ['missing content', async () => Response.json({ choices: [] })],
    ['invalid JSON', async () => new Response(upstreamPrivateText, { status: 200 })],
  ];
  for (const [name, fetchImpl] of cases) {
    await t.test(name, async () => {
      await withServer({ aiKey: privateKey, fetchImpl }, async ({ post }) => {
        const error = await expectError(await post('/api/chat', { profile, message: 'Reflect with me.', mode: 'ai' }), 502);
        const text = JSON.stringify(error);
        assert.equal(text.includes(privateKey), false);
        assert.equal(text.includes(profile.name), false);
        assert.equal(text.includes('provider-private-detail'), false);
      });
    });
  }
});

test('cross-origin writes are rejected and same-origin writes work', async () => {
  await withServer({}, async ({ base, post }) => {
    await expectError(await post('/api/profile', profile, {
      headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' },
    }), 403);
    await expectError(await post('/api/profile', profile, {
      headers: { 'Content-Type': 'application/json', Origin: 'invalid-origin' },
    }), 403);
    const response = await post('/api/profile', profile, {
      headers: { 'Content-Type': 'application/json', Origin: base },
    });
    assert.equal(response.status, 200);
  });
});

test('production serves the app, built assets, favicon, and SPA routes', async () => {
  await withServer({}, async ({ get }) => {
    const response = await get('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    const html = await response.text();
    assert.match(html, /<div id="root"><\/div>/);
    const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"/);
    assert.ok(script, 'Production HTML must reference a built JavaScript asset.');
    const asset = await get(script[1]);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.ok((await asset.text()).length > 100);
    const favicon = await get('/favicon.svg');
    assert.equal(favicon.status, 200);
    assert.match(favicon.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(await favicon.text(), /<svg/);
    const deepLink = await get('/reading');
    assert.equal(deepLink.status, 200);
    assert.equal(await deepLink.text(), html);
  });
});

test('unknown API routes return JSON 404 rather than the SPA document', async () => {
  await withServer({}, async ({ get, post }) => {
    const missing = await expectError(await get('/api/not-a-real-route'), 404);
    assert.equal(missing.error, 'API route not found.');
    await expectError(await post('/api/not-a-real-route', {}), 404);
  });
});

test('write rate limiting allows sixty requests and supplies retry guidance', async () => {
  await withServer({}, async ({ post }) => {
    for (let count = 0; count < 60; count++) {
      const response = await post('/api/compatibility', { signA: 'aries', signB: 'libra' });
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    }
    const limited = await post('/api/compatibility', { signA: 'aries', signB: 'libra' });
    assert.equal(limited.headers.get('retry-after'), '60');
    await expectError(limited, 429);
  });
});
