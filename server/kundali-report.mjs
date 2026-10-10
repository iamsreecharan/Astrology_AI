import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { buildKundaliMatch } from './kundali-matching.mjs';
import { reportTextRuns } from './horoscope-report.mjs';

const LEFT = 43;
const WIDTH = 509;
const TOP = 67;
const BOTTOM = 770;
const COLORS = { ink: '#192642', muted: '#596378', copper: '#987045', jade: '#32665f', cream: '#fcfaf5', pale: '#ecefe8', line: '#d8ded6' };
const FONTS = ['NotoSans-Regular', 'NotoSansDevanagari-Regular', 'NotoSansTelugu-Regular', 'NotoSansTamil-Regular', 'NotoSansKannada-Regular', 'NotoSansMalayalam-Regular', 'NotoSansBengali-Regular', 'NotoSansGujarati-Regular', 'NotoSansGurmukhi-Regular', 'NotoSansOriya-Regular', 'NotoSansSinhala-Regular', 'NotoSansThai-Regular', 'NotoSansArabic-Regular', 'NotoSansHebrew-Regular'];
const fontPath = name => fileURLToPath(new URL(`./fonts/${name}.ttf`, import.meta.url));

export function kundaliReportFilename(maleName, femaleName) {
  const stem = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'person';
  return `Astral-${stem(maleName)}-${stem(femaleName)}-English-Kundali-match.pdf`;
}

export function buildKundaliReportModel(input, options) {
  const match = buildKundaliMatch(input, options);
  return { ...match, filename: kundaliReportFilename(match.profiles.male.name, match.profiles.female.name) };
}

export function renderKundaliReport(model) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', pdfVersion: '1.4', margins: { top: TOP, bottom: 72, left: LEFT, right: LEFT }, bufferPages: true,
      info: { Title: 'Astral — English Kundali Matching', Author: 'Sree Charan Reddy Kailasam', Subject: model.method.displayName, CreationDate: new Date(model.generatedAt), ModDate: new Date(model.generatedAt) },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.registerFont('regular', fontPath('NotoSans-Regular'));
    doc.registerFont('bold', fontPath('NotoSans-Bold'));
    for (const font of FONTS) doc.registerFont(font, fontPath(font));
    let y = TOP;

    function pageChrome() {
      doc.save().rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.cream).restore();
      doc.font('bold').fontSize(12).fillColor(COLORS.ink).text('ASTRAL', LEFT, 23, { lineBreak: false });
      doc.font('regular').fontSize(8).fillColor(COLORS.muted).text('ENGLISH KUNDALI MATCHING', LEFT + 83, 28, { lineBreak: false });
      doc.moveTo(LEFT, 48).lineTo(LEFT + WIDTH, 48).lineWidth(0.7).strokeColor(COLORS.copper).stroke();
      y = TOP;
    }
    doc.on('pageAdded', pageChrome);
    pageChrome();
    function newPage() { doc.addPage(); }
    function ensure(height) { if (y + height > BOTTOM) newPage(); }
    function text(value, { size = 9, bold = false, color = COLORS.ink, gap = 7 } = {}) {
      doc.font(bold ? 'bold' : 'regular').fontSize(size);
      const options = { width: WIDTH, lineGap: 2 };
      const height = doc.heightOfString(String(value), options);
      ensure(height + gap);
      doc.fillColor(color).text(String(value), LEFT, y, options);
      y += height + gap;
    }
    function heading(title, { page = false } = {}) {
      if (page && y !== TOP) newPage();
      ensure(55);
      text(title, { size: 20, bold: true, gap: 13 });
    }
    function subheading(title) {
      ensure(48);
      text(title, { size: 11, bold: true, gap: 8 });
    }
    function identity(label, value) {
      const content = `${label}: ${value}`;
      const { runs, unsupported } = reportTextRuns(content);
      ensure(Math.max(22, Math.ceil(content.length / 64) * 17) + (unsupported ? 30 : 0));
      doc.markContent('Span', { actual: content.normalize('NFC') });
      for (const [index, run] of runs.entries()) {
        const options = { width: WIDTH, continued: index < runs.length - 1, lineGap: 2 };
        doc.font(run.font).fontSize(9).fillColor(COLORS.ink);
        if (index === 0) doc.text(run.text, LEFT, y, options);
        else doc.text(run.text, options);
      }
      doc.endMarkedContent();
      y = doc.y + 8;
      if (unsupported) text('Characters unavailable in the bundled fonts are shown as U+ Unicode code points.', { size: 8, color: COLORS.muted });
    }
    function table(headers, rows, widths) {
      const size = 8.5;
      function header() {
        ensure(27);
        doc.save().rect(LEFT, y - 2, WIDTH, 23).fill(COLORS.pale).restore();
        let x = LEFT + 5;
        headers.forEach((label, index) => {
          doc.font('bold').fontSize(size).fillColor(COLORS.ink).text(label, x, y + 3, { width: widths[index] - 10, lineBreak: false });
          x += widths[index];
        });
        y += 26;
      }
      header();
      for (const row of rows) {
        doc.font('regular').fontSize(size);
        const height = Math.max(24, ...row.map((cell, index) => doc.heightOfString(String(cell), { width: widths[index] - 10, lineGap: 1 }) + 10));
        if (y + height > BOTTOM) { newPage(); header(); }
        let x = LEFT + 5;
        row.forEach((cell, index) => {
          doc.font('regular').fontSize(size).fillColor(COLORS.ink).text(String(cell), x, y + 2, { width: widths[index] - 10, lineGap: 1 });
          x += widths[index];
        });
        y += height;
        doc.moveTo(LEFT, y - 2).lineTo(LEFT + WIDTH, y - 2).lineWidth(0.35).strokeColor(COLORS.line).stroke();
      }
      y += 12;
    }

    heading('Your Kundali matching report');
    text('Eight traditional comparisons, calculated from both recorded birth profiles and explained in English.', { size: 10, color: COLORS.muted, gap: 17 });
    text(model.method.displayName, { size: 12, bold: true });
    text(`Matching convention: ${model.method.tradition}.`, { size: 9, color: COLORS.muted });
    text(model.method.calculationBasis, { size: 9, color: COLORS.muted });
    text(model.method.chartBasis, { size: 9, color: COLORS.muted, gap: 16 });
    text(`${model.total} / ${model.max} gunas`, { size: 34, bold: true, color: COLORS.jade, gap: 10 });
    text(model.benchmark.label, { size: 13, bold: true });
    text(model.benchmark.explanation, { color: COLORS.muted });
    text(`Minimum commonly used in this convention: ${model.benchmark.minimum} / 36. The score ${model.benchmark.meetsMinimum ? 'meets' : 'is below'} that traditional benchmark.`, { bold: true, gap: 15 });
    text(`${model.counts.fullyMatched} fully matched · ${model.counts.partiallyMatched} partially matched · ${model.counts.notMatched} without points — across ${model.counts.totalCategories} categories.`, { gap: 15 });
    text('This is a traditional comparison score, not a percentage chance of a successful marriage. Consent, shared values, safety and the relationship itself remain essential.', { color: COLORS.muted, gap: 15 });
    text(`Calculated on: ${model.generatedAt}`, { size: 8, color: COLORS.muted });
    text(`Scoring convention: ${model.method.name} · ${model.method.version}`, { size: 8, color: COLORS.muted });

    heading('The two birth records', { page: true });
    for (const role of ['male', 'female']) {
      const profile = model.profiles[role];
      const moon = model.moons[role];
      subheading(role === 'male' ? 'Male / groom profile' : 'Female / bride profile');
      identity('Name', profile.name);
      text(`Birth date: ${profile.birthDate} · Recorded local time: ${profile.birthTime}`);
      identity('Birth place', profile.birthPlace);
      text(`Historical time zone: ${profile.timeZone}`);
      text(`Coordinates: ${profile.latitude.toFixed(6)}° latitude, ${profile.longitude.toFixed(6)}° longitude`, { size: 8.5 });
      table(['Moon factor', 'Calculated value'], [
        ['Sidereal Moon longitude', `${moon.longitude.toFixed(6)}°`],
        ['Moon rashi / sign lord', `${moon.rashi} / ${moon.signLord}`],
        ['Birth star / pada', `${moon.nakshatra.name} / pada ${moon.pada}`],
        ['Traditional classifications', `Varna: ${moon.varna}; Vashya: ${moon.vashya}; Yoni: ${moon.yoni}; Gana: ${moon.gana}; Nadi: ${moon.nadi}`],
      ], [172, 337]);
    }

    heading('The 36-point comparison', { page: true });
    table(['Koota', 'Points', 'Maximum', 'Result'], model.kootas.map(koota => [koota.name, koota.score, koota.max, koota.status === 'full' ? 'Fully matched' : koota.status === 'partial' ? 'Partially matched' : 'No points']), [214, 75, 80, 140]);
    text(`Total: ${model.total} / ${model.max}`, { size: 15, bold: true, color: COLORS.jade });
    subheading('Traditional score bands');
    table(['Score range', 'Benchmark label'], model.benchmarks.map((band, index) => {
      const next = model.benchmarks[index + 1];
      const range = index === 0 && next ? `Below ${next.min} / 36` : next ? `${band.min} to below ${next.min} / 36` : `${band.min}–${band.max} / 36`;
      return [range, band.label];
    }), [165, 344]);
    text('The commonly used minimum is 18/36. Families and astrologers may use different thresholds, conventions and exception rules; the bands are a traditional guide, not a decision to marry.', { color: COLORS.muted });
    text('“Fully matched” means the category received all its available points; “partially matched” means some points; “no points” means zero under the chosen rule. Categories have different weights, so the count of matched categories is separate from the total score.', { color: COLORS.muted });

    for (let offset = 0; offset < model.kootas.length; offset += 4) {
      heading(offset === 0 ? 'How each category was calculated' : 'The remaining four comparisons', { page: true });
      for (const koota of model.kootas.slice(offset, offset + 4)) {
        ensure(145);
        subheading(`${koota.name} — ${koota.score} / ${koota.max}`);
        text(koota.description, { size: 8.5, color: COLORS.muted });
        text(`Male: ${koota.maleValue} · Female: ${koota.femaleValue}`, { size: 8.5 });
        text(`Calculation: ${koota.method}`);
        text(`Reading: ${koota.explanation}`, { color: COLORS.muted, gap: 16 });
      }
    }

    heading('Method, conventions and cautions', { page: true });
    text(model.method.displayName, { size: 12, bold: true });
    text(`Matching convention: ${model.method.tradition}.`, { color: COLORS.muted });
    text(`Moon calculation: ${model.calculation.ayanamsha} · ${model.calculation.ephemeris}.`, { bold: true });
    text(model.method.calculationBasis, { color: COLORS.muted });
    text(model.method.chartBasis, { color: COLORS.muted });
    text(model.method.roleConvention, { color: COLORS.muted });
    text(model.method.cancellations, { color: COLORS.muted });
    for (const caution of [...new Set([...model.cautions, ...model.calculation.warnings])]) text(`• ${caution}`, { size: 8.5, color: COLORS.muted });
    subheading('References for the documented convention');
    for (const source of model.method.sources) {
      text(source.title, { size: 8.5, bold: true, gap: 3 });
      text(source.url, { size: 8, color: COLORS.muted, gap: 11 });
    }
    text('This report was calculated and generated in memory. It does not use an AI model to supply scores, and it is not saved on the server. The downloaded file contains both birth profiles; share it only where both people intend to.', { size: 8.5, color: COLORS.muted, gap: 12 });

    const pages = doc.bufferedPageRange();
    for (let page = pages.start; page < pages.start + pages.count; page++) {
      doc.switchToPage(page);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.moveTo(LEFT, 792).lineTo(LEFT + WIDTH, 792).lineWidth(0.5).strokeColor(COLORS.line).stroke();
      doc.font('regular').fontSize(7).fillColor(COLORS.muted).text(`© ${new Date(model.generatedAt).getUTCFullYear()} Sree Charan Reddy Kailasam`, LEFT, 804, { lineBreak: false });
      doc.text(`Astral · ${page + 1} / ${pages.count}`, LEFT + WIDTH - 90, 804, { width: 90, align: 'right', lineBreak: false });
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
  });
}

export async function buildKundaliReport(input, options) {
  const model = buildKundaliReportModel(input, options);
  return { model, pdf: await renderKundaliReport(model) };
}
