import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

export async function compressAssets(directory) {
  const files = [];
  async function discover(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) await discover(filename);
      else if (/\.(?:js|css|html|svg|json)$/.test(entry.name)) files.push(filename);
    }
  }
  await discover(directory);
  let representations = 0;
  await Promise.all(files.map(async filename => {
    const original = await readFile(filename);
    const encoded = await Promise.all([
      brotli(original, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }),
      gz(original, { level: 6 }),
    ]);
    for (const [index, extension] of ['br', 'gz'].entries()) {
      if (encoded[index].length < original.length) {
        await writeFile(`${filename}.${extension}`, encoded[index]);
        representations++;
      } else await rm(`${filename}.${extension}`, { force: true });
    }
  }));
  return { files: files.length, representations };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await compressAssets(fileURLToPath(new URL('../dist/', import.meta.url)));
  console.log(`Prepared ${result.representations} compressed asset representations.`);
}
