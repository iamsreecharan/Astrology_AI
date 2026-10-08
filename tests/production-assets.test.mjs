import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access } from 'node:fs/promises';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { productionAssets } from '../server/production-assets.mjs';
import { compressAssets } from '../scripts/compress-assets.mjs';

const assetName = 'main-AbCd1234.js';
const outsideText = 'Outside the public build: private fixture text.';
const fixtures = {
  'index.html': '<!doctype html><html><body>' + '<p>Welcome to Astral.</p>'.repeat(400) + '</body></html>',
  [`assets/${assetName}`]: 'const greeting = ' + JSON.stringify('Welcome to Astral. '.repeat(1500)) + ';',
  'assets/styles-Qwerty12.css': '.planet { transform: rotate(30deg); color: #abc; }\n'.repeat(500),
  'assets/orbits.svg': '<svg xmlns="http://www.w3.org/2000/svg">' + '<circle cx="100" cy="100" r="40" />'.repeat(500) + '</svg>',
  'assets/settings.json': JSON.stringify({ welcome: 'Astral '.repeat(2000) }),
  'assets/tiny.json': '0',
  'assets/font.woff2': Buffer.from([0, 1, 2, 3, 4, 5]),
  'assets/planet.png': Buffer.from([137, 80, 78, 71, 0, 1, 2, 3]),
};

async function withFixture(run, { compress = true } = {}) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'astral-assets-test-'));
  const directory = path.join(temporary, 'site');
  const outside = path.join(temporary, 'outside-secret.js');
  let server;
  try {
    await mkdir(path.join(directory, 'assets'), { recursive: true });
    await Promise.all(Object.entries(fixtures).map(([name, value]) => writeFile(path.join(directory, name), value)));
    await writeFile(outside, outsideText);
    if (compress) await compressAssets(directory);
    const app = express();
    app.use(productionAssets(directory));
    app.get('/{*path}', (_req, res) => res.set('Cache-Control', 'public, max-age=0, must-revalidate').sendFile(path.join(directory, 'index.html')));
    app.use((error, _req, res, _next) => res.status(error.status || 500).set('Cache-Control', 'no-store').send('Asset request failed.'));
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
      instance.once('error', reject);
    });
    const request = (pathname, { method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
      const call = http.request({ hostname: '127.0.0.1', port: server.address().port, path: pathname, method, headers }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.once('error', reject);
        response.once('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      });
      call.setTimeout(5000, () => call.destroy(new Error('Asset fixture request timed out.')));
      call.once('error', reject);
      call.end();
    });
    await run({ directory, outside, request });
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    await rm(temporary, { recursive: true, force: true });
  }
}

test('production text assets negotiate Brotli, gzip and identity without changing their contents', async () => {
  await withFixture(async ({ request }) => {
    const expected = Buffer.from(fixtures[`assets/${assetName}`]);
    for (const [accept, encoding, decode] of [
      ['br, gzip', 'br', brotliDecompressSync],
      ['gzip, br;q=0.5', 'gzip', gunzipSync],
      ['br;q=0, gzip;q=0, identity;q=1', undefined, value => value],
      [undefined, undefined, value => value],
    ]) {
      const response = await request(`/assets/${assetName}`, { headers: accept ? { 'Accept-Encoding': accept } : {} });
      assert.equal(response.status, 200);
      assert.equal(response.headers['content-encoding'], encoding);
      assert.match(response.headers['content-type'], /javascript/);
      assert.match(response.headers.vary, /Accept-Encoding/);
      assert.equal(Number(response.headers['content-length']), response.body.length);
      assert.deepEqual(decode(response.body), expected);
    }
    const unacceptable = await request(`/assets/${assetName}`, { headers: { 'Accept-Encoding': 'br;q=0, gzip;q=0, identity;q=0' } });
    assert.equal(unacceptable.status, 406);
    assert.equal(unacceptable.headers['cache-control'], 'no-store');
  });
});

test('compressed HEAD and conditional requests retain the selected representation metadata', async () => {
  await withFixture(async ({ request }) => {
    for (const encoding of ['br', 'gzip', 'identity']) {
      const headers = { 'Accept-Encoding': encoding };
      const get = await request(`/assets/${assetName}`, { headers });
      const head = await request(`/assets/${assetName}`, { method: 'HEAD', headers });
      assert.equal(head.status, 200);
      assert.equal(head.body.length, 0);
      assert.equal(head.headers.etag, get.headers.etag);
      assert.equal(head.headers['content-length'], get.headers['content-length']);
      assert.equal(head.headers['content-encoding'], get.headers['content-encoding']);
      assert.ok(Number.isFinite(Date.parse(get.headers['last-modified'])));
      const cached = await request(`/assets/${assetName}`, { headers: { ...headers, 'If-None-Match': get.headers.etag } });
      assert.equal(cached.status, 304);
      assert.equal(cached.body.length, 0);
      assert.equal(cached.headers.etag, get.headers.etag);
      assert.equal(cached.headers['cache-control'], 'public, max-age=31536000, immutable');
      assert.match(cached.headers.vary, /Accept-Encoding/);
    }
    const plain = await request(`/assets/${assetName}`, { headers: { 'Accept-Encoding': 'identity' } });
    const compressed = await request(`/assets/${assetName}`, { headers: { 'Accept-Encoding': 'br', 'If-None-Match': plain.headers.etag } });
    assert.equal(compressed.status, 200, 'an identity ETag must not validate a different compressed representation');
  });
});

test('byte ranges use the original file and respect an explicitly forbidden identity encoding', async () => {
  await withFixture(async ({ request }) => {
    const original = Buffer.from(fixtures[`assets/${assetName}`]);
    const response = await request(`/assets/${assetName}`, { headers: { Range: 'bytes=5-29', 'Accept-Encoding': 'br, gzip' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers['content-encoding'], undefined);
    assert.equal(response.headers['content-range'], `bytes 5-29/${original.length}`);
    assert.match(response.headers.vary, /Accept-Encoding/);
    assert.deepEqual(response.body, original.subarray(5, 30));
    const refused = await request(`/assets/${assetName}`, { headers: { Range: 'bytes=5-29', 'Accept-Encoding': 'br, identity;q=0' } });
    assert.equal(refused.status, 406);
    assert.equal(refused.headers['cache-control'], 'no-store');
  });
});

test('only hashed build assets are immutable and missing assets never become SPA HTML', async () => {
  await withFixture(async ({ request }) => {
    for (const pathname of ['/', '/index.html', '/about', '/assets/orbits.svg', '/assets/settings.json', '/assets/font.woff2']) {
      const response = await request(pathname, { headers: { 'Accept-Encoding': 'identity' } });
      assert.equal(response.status, 200, pathname);
      assert.equal(response.headers['cache-control'], 'public, max-age=0, must-revalidate', pathname);
    }
    for (const pathname of ['/assets/missing-AbCd1234.js', '/assets/missing.css', `/assets/${assetName}.br`, `/assets/${assetName}.gz`]) {
      const response = await request(pathname);
      assert.equal(response.status, 404, pathname);
      assert.equal(response.headers['cache-control'], 'no-store', pathname);
      assert.doesNotMatch(response.body.toString(), /<!doctype html>|Welcome to Astral/);
    }
  });
});

test('malformed or escaping paths cannot expose a file outside the public build', async () => {
  await withFixture(async ({ request }) => {
    for (const pathname of ['/assets/%E0%A4%A', '/assets/%2e%2e/%2e%2e/outside-secret.js', '/assets/%5c..%5coutside-secret.js', '/assets/%00outside-secret.js', '/assets/%252e%252e/%252e%252e/outside-secret.js']) {
      const response = await request(pathname, { headers: { 'Accept-Encoding': 'identity' } });
      assert.ok([400, 403, 404].includes(response.status), `${pathname}: ${response.status}`);
      assert.doesNotMatch(response.body.toString(), /private fixture text/);
    }
  });
});

test('linked original files and compressed variants cannot expose files outside the build', async () => {
  await withFixture(async ({ directory, outside, request }) => {
    await symlink(outside, path.join(directory, 'assets/private-AbCd1234.js'));
    await rm(path.join(directory, `assets/${assetName}.br`));
    await symlink(outside, path.join(directory, `assets/${assetName}.br`));
    for (const [pathname, encoding] of [[`/assets/private-AbCd1234.js`, 'identity'], [`/assets/${assetName}`, 'br, gzip;q=0, identity;q=0']]) {
      const response = await request(pathname, { headers: { 'Accept-Encoding': encoding } });
      assert.ok([400, 403, 404, 406].includes(response.status), `${pathname}: ${response.status}`);
      assert.doesNotMatch(response.body.toString(), /private fixture text/);
      assert.equal(response.headers['cache-control'], 'no-store');
    }
  });
});

test('the build creates only smaller text representations and removes stale oversized variants', async () => {
  await withFixture(async ({ directory, outside }) => {
    await mkdir(path.join(directory, '.hidden'));
    await writeFile(path.join(directory, '.hidden/secret.js'), 'Hidden text '.repeat(100));
    await writeFile(path.join(directory, 'assets/.secret.js'), 'Hidden text '.repeat(100));
    await symlink(outside, path.join(directory, 'assets/linked.js'));
    await writeFile(path.join(directory, 'assets/tiny.json.br'), 'Stale encoded text');
    await writeFile(path.join(directory, 'assets/tiny.json.gz'), 'Stale encoded text');
    const result = await compressAssets(directory);
    assert.equal(result.files, 6);
    assert.equal(result.representations, 10);
    for (const name of ['index.html', `assets/${assetName}`, 'assets/styles-Qwerty12.css', 'assets/orbits.svg', 'assets/settings.json']) {
      const original = await readFile(path.join(directory, name));
      for (const [extension, decode] of [['br', brotliDecompressSync], ['gz', gunzipSync]]) {
        const encoded = await readFile(path.join(directory, `${name}.${extension}`));
        assert.ok(encoded.length < original.length, `${name}.${extension}`);
        assert.deepEqual(decode(encoded), original);
      }
    }
    for (const name of ['assets/tiny.json', 'assets/font.woff2', 'assets/planet.png', 'assets/linked.js', 'assets/.secret.js', '.hidden/secret.js']) {
      for (const extension of ['br', 'gz']) await assert.rejects(access(path.join(directory, `${name}.${extension}`)), { code: 'ENOENT' });
    }
    assert.equal((await readFile(outside)).toString(), outsideText);
  }, { compress: false });
});
