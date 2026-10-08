import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { buildKundaliMatch } from '../server/kundali-matching.mjs';
import { buildKundaliReportModel, renderKundaliReport, kundaliReportFilename } from '../server/kundali-report.mjs';

const today = new Date('2026-10-08T12:00:00Z');
const male = { name: 'Arun Rao', birthDate: '1992-08-14', birthTime: '06:45', birthPlace: 'Bengaluru, India', latitude: 12.9716, longitude: 77.5946, timeZone: 'Asia/Kolkata' };
const female = { name: 'Mira Rao', birthDate: '1995-05-21', birthTime: '10:30', birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata' };

function copiedText(pdf) {
  const syntax = pdf.toString('latin1');
  const streams = [...syntax.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => {
    try { return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { return ''; }
  }).join('\n');
  return [...streams.matchAll(/\/ActualText\s*\(([\s\S]*?)\)\s*>>/g)].map(match => {
    const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '(': '(', ')': ')' };
    const literal = match[1].replace(/\\([nrtbf\\()])/g, (_, character) => escapes[character]);
    const bytes = Buffer.from(literal, 'latin1');
    return bytes[0] === 0xfe && bytes[1] === 0xff
      ? bytes.swap16().toString('utf16le').replace(/^\ufeff/, '')
      : bytes.toString('latin1');
  });
}

test('PDF model preserves the server matching score and explains each weighted category', () => {
  const pair = { male, female, total: 36, kootas: [{ id: 'invented', score: 36 }], filename: 'unsafe/filename.pdf' };
  const { filename, ...model } = buildKundaliReportModel(pair, { today });
  assert.deepEqual(model, buildKundaliMatch({ male, female }, { today }));
  assert.equal(filename, kundaliReportFilename(male.name, female.name));
  assert.equal(model.kootas.reduce((sum, koota) => sum + koota.max, 0), 36);
  assert.equal(model.total, model.kootas.reduce((sum, koota) => sum + koota.score, 0));
  for (const koota of model.kootas) {
    assert.ok(koota.method.length > 15, `${koota.name} calculation should be explained`);
    assert.ok(koota.explanation.length > 15, `${koota.name} result should be explained`);
    assert.ok(koota.score >= 0 && koota.score <= koota.max);
  }
  assert.equal(model.benchmark.minimum, 18);
  assert.ok(model.cautions.some(caution => /not a measured probability/i.test(caution)));
  assert.ok(model.method.sources.length > 0);
});

test('matching report filenames are short attachment-safe ASCII even for Unicode names and punctuation', () => {
  assert.equal(kundaliReportFilename('Élodie / "Rao"', 'Mira Rao'), 'Astral-Elodie-Rao-Mira-Rao-English-Kundali-match.pdf');
  assert.equal(kundaliReportFilename('../../', 'సీత'), 'Astral-person-person-English-Kundali-match.pdf');
  assert.match(kundaliReportFilename('A'.repeat(1000), 'B'.repeat(1000)), /^Astral-A{30}-B{30}-English-Kundali-match\.pdf$/);
  assert.match(kundaliReportFilename('Arun\r\nContent-Type: text/html', 'Mira'), /^[A-Za-z0-9.-]+\.pdf$/);
});

test('report renderer produces a paginated searchable A4 PDF with exact Unicode names and no active actions', async () => {
  const model = buildKundaliReportModel({ male: { ...male, name: 'అరుణ్ రెడ్డి', birthPlace: 'బెంగళూరు, India' }, female: { ...female, name: 'मीरा शर्मा' } }, { today });
  const pdf = await renderKundaliReport(model);
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');
  assert.ok(pdf.length > 15000 && pdf.length < 2 * 1024 * 1024);
  const syntax = pdf.toString('latin1');
  assert.match(syntax, /%%EOF\s*$/);
  assert.match(syntax, /xref[\s\S]*trailer/);
  assert.match(syntax, /\/MediaBox\s*\[0 0 595\.28 841\.89\]/);
  assert.doesNotMatch(syntax, /\/JavaScript|\/OpenAction|\/JS\b/);
  const pages = [...syntax.matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.ok(pages >= 6 && pages <= 10, `actual pages: ${pages}`);
  assert.match(syntax, new RegExp(`/Count ${pages}\\b`));
  const originals = copiedText(pdf);
  assert.ok(originals.includes(`Name: ${model.profiles.male.name}`));
  assert.ok(originals.includes(`Name: ${model.profiles.female.name}`));
  assert.ok(originals.includes(`Birth place: ${model.profiles.male.birthPlace}`));
});

test('report model rejects incomplete records and invalid calculation dates before rendering', () => {
  for (const pair of [{}, { male: { name: male.name, birthDate: male.birthDate }, female }, { male, female: { ...female, longitude: 200 } }]) {
    assert.throws(() => buildKundaliReportModel(pair, { today }), error => error.status === 400);
  }
  assert.throws(() => buildKundaliReportModel({ male, female }, { today: new Date('invalid') }), error => error.status === 400);
});
