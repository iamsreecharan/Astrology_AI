import test from 'node:test';
import assert from 'node:assert/strict';
import { focusYogiPrediction } from '../server/yogi-focus.mjs';
import { buildVedicMessages, buildYogiLocalReply } from '../server/vedic-knowledge.mjs';

const earlier = { start: '2027-01-01', end: '2027-03-31', ageRange: { min: 31, max: 31 }, reasons: [], support: { kind: 'relative', label: 'Supported', comparison: 'lower' } };
const strongest = { start: '2028-02-01', end: '2028-06-30', ageRange: { min: 32, max: 33 }, reasons: [], support: { kind: 'relative', label: 'Most supported', comparison: 'unique-top' } };
const reading = {
  topic: 'marriage', status: 'estimated', asOf: '2026-10-08', horizonEnd: '2029-10-08',
  support: { kind: 'relative', label: 'Relative astrological support' }, windows: [earlier, strongest], method: [], limitations: [],
};

test('Yogi focuses the strongest supplied window even when a weaker window is nearer', () => {
  const original = structuredClone(reading);
  const focused = focusYogiPrediction(reading);
  assert.deepEqual(focused.windows, [strongest]);
  assert.equal(focused.outlook.timing.date, '2028-02-01');
  assert.doesNotMatch(JSON.stringify(focused.outlook), /2027|2029/);
  assert.deepEqual(reading, original);
});

test('one earliest tied period is focused while its joint label and ages stay intact', () => {
  const joint = { kind: 'relative', label: 'Joint most supported', comparison: 'tied-top', tiedWindows: 2 };
  const first = { ...earlier, support: joint };
  const later = { ...strongest, support: joint };
  const focused = focusYogiPrediction({ ...reading, windows: [later, first] });
  assert.deepEqual(focused.windows, [first]);
  assert.equal(focused.windows[0].support.label, 'Joint most supported');
  assert.equal(focused.windows[0].support.tiedWindows, 2);
});

test('qualitative and unavailable readings never gain a strongest-window claim', () => {
  for (const source of [null, { topic: 'general', status: 'interpreted', windows: [] }, { ...reading, status: 'no-window', support: { kind: 'unavailable' }, windows: [] }]) {
    assert.equal(focusYogiPrediction(source), source);
  }
});

test('Yogi grounding and local speech use one strongest range while Astral retains the complete reading', () => {
  const chart = { moon: {}, ascendant: {}, planets: [], dasha: {}, limits: [] };
  const yogi = buildVedicMessages(chart, { assistant: 'yogi', message: 'When might I marry?', prediction: reading });
  const context = JSON.parse(yogi.messages.at(-1).content).prediction;
  assert.deepEqual(context.windows.map(window => [window.start, window.end, window.ageRange]), [['2028-02-01', '2028-06-30', { min: 32, max: 33 }]]);
  assert.match(yogi.messages[0].content, /one focused answer, without listing weaker windows/);
  const reply = buildYogiLocalReply(chart, { message: 'When might I marry?', prediction: reading }).reply;
  assert.match(reply, /Most supported: 2028-02-01 to 2028-06-30/);
  assert.doesNotMatch(reply, /2027-01-01|2027-03-31/);
  const astral = buildVedicMessages(chart, { assistant: 'astral', message: 'When might I marry?', prediction: reading });
  assert.equal(JSON.parse(astral.messages.at(-1).content).prediction.windows.length, 2);
});
