import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPredictionOutlook } from '../server/prediction-outlook.mjs';
import { buildHoroscopeReportModel } from '../server/horoscope-report.mjs';

const asOf = '2026-10-08';
const horizonEnd = '2029-10-08';
const themes = {
  Jupiter: 'Learning from experience, mentors, and wider perspectives',
  Sun: 'Personal direction and responsibility',
  Moon: 'Emotional needs and a comfortable daily rhythm',
  Mercury: 'Learning, clear communication, and reviewing details',
  Mars: 'Direct effort and constructive ways to handle friction',
  Venus: 'Cooperation, shared values, and enjoyment',
  Saturn: 'Patience, consistent routines, and realistic commitments',
  Rahu: 'Exploring unfamiliar choices while checking expectations',
  Ketu: 'Reflection, simplification, and reviewing priorities',
};
const window = (start, end, lords = ['Jupiter', 'Sun'], extra = {}) => ({ start, end, label: `${lords.join(' / ')} period themes`, themes: lords.map(lord => themes[lord]), reasons: ['Calculated source detail.'], ...extra });
const life = (topic = 'general', windows = [window(asOf, '2026-12-02'), window('2026-12-02', '2028-04-02', ['Jupiter', 'Moon'])]) => ({ topic, status: 'interpreted', asOf, horizonEnd, themes: [themes.Jupiter, themes.Sun], windows });
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test('all ten real prediction topics get concise outlooks without changing calculated facts', () => {
  const profile = { name: 'Mira', birthDate: '1995-05-21', birthTime: '10:30', birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata' };
  const model = buildHoroscopeReportModel(profile, { asOf: new Date(`${asOf}T12:00:00Z`) });
  assert.equal(model.predictions.length, 10);
  for (const prediction of model.predictions) {
    const original = structuredClone(prediction);
    freeze(prediction);
    const outlook = buildPredictionOutlook(prediction);
    assert.deepEqual(prediction, original);
    assert.ok(outlook.summary.length > 30 && outlook.summary.length <= 360, prediction.topic);
    if (outlook.explanation) assert.ok(outlook.explanation.length <= 360, prediction.topic);
    assert.equal(outlook.actions.length, 2, prediction.topic);
    assert.ok(outlook.actions.every(action => action.length <= 160));
    assert.ok(outlook.periods.length <= 3);
    for (const period of outlook.periods) {
      assert.ok(prediction.windows.some(source => source.start === period.start && source.end === period.end));
      assert.ok(period.label.length <= 90 && period.text.length <= 280);
      if (period.explanation) assert.ok(period.explanation.length <= 360);
      assert.equal(typeof period.current, 'boolean');
    }
    if (outlook.timing) {
      assert.ok(outlook.timing.text.length <= 360 && outlook.timing.label.length <= 60);
      assert.match(outlook.timing.date, /^\d{4}-\d{2}-\d{2}$/);
    }
    assert.doesNotMatch(JSON.stringify(outlook), /\b(?:mahadasha|antardasha|D1 house|D9 house|occupies|scientifically|percentage)\b|\d+%/i);
  }
});

test('a Jupiter/Sun to Jupiter/Moon transition explains the actual new emphasis and exact supplied date', () => {
  const prediction = life();
  prediction.windows.push(window('2028-04-02', '2029-03-09', ['Jupiter', 'Mars']));
  const outlook = buildPredictionOutlook(prediction);
  assert.match(outlook.summary, /choose a clearer direction/);
  assert.match(outlook.summary, /ownership of your decisions/);
  assert.match(outlook.explanation, /learning from experience/);
  assert.equal(outlook.timing.date, '2026-12-02');
  assert.match(outlook.timing.text, /2 December 2026/);
  assert.match(outlook.timing.text, /emotional needs and everyday rhythm/);
  assert.doesNotMatch(outlook.timing.text, /clearer direction/);
  assert.deepEqual(outlook.periods.map(period => period.current), [true, false, false]);
  assert.deepEqual(outlook.periods.map(period => period.label), ['Clarify your direction', 'Build a steadier rhythm', 'Put plans into action']);
  assert.match(outlook.periods[1].text, /emotional needs/);
  assert.match(outlook.periods[2].text, /practical steps/);
  assert.match(outlook.timing.text, /not a promised improvement/);
});

test('the seven life-area summaries and actions stay specific to the selected topic', () => {
  const topics = ['married-life', 'general', 'education', 'finances', 'family', 'travel', 'wellbeing'];
  const outlooks = topics.map(topic => buildPredictionOutlook(life(topic)));
  assert.equal(new Set(outlooks.map(outlook => outlook.summary)).size, topics.length);
  assert.equal(new Set(outlooks.map(outlook => outlook.actions.join(' '))).size, topics.length);
  assert.match(outlooks[0].actions.join(' '), /shared expectation|affection/);
  assert.match(outlooks[2].actions.join(' '), /study target|teacher/);
  assert.match(outlooks[3].actions.join(' '), /budget/);
  assert.match(outlooks[4].summary, /family/);
  assert.match(outlooks[5].actions.join(' '), /documents/);
  assert.match(outlooks[6].actions.join(' '), /qualified care/);
});

test('a single current period reports its shown end without inventing a next-day shift or improvement', () => {
  const outlook = buildPredictionOutlook(life('education', [window(asOf, horizonEnd)]));
  assert.equal(outlook.timing.date, horizonEnd);
  assert.match(outlook.timing.text, /runs through 8 October 2029/);
  assert.match(outlook.timing.text, /No later relevant period is shown/);
  assert.doesNotMatch(JSON.stringify(outlook), /2029-10-09|9 October 2029|will improve|good period|better fortune/i);
});

test('timing chooses the nearest future period while preserving supplied period order and omitting expired windows', () => {
  const source = life('family', [window('2028-01-01', '2028-07-01', ['Jupiter', 'Moon']), window('2027-01-01', '2027-07-01', ['Jupiter', 'Mercury']), window('2025-01-01', '2026-10-07')]);
  const outlook = buildPredictionOutlook(source);
  assert.equal(outlook.timing.date, '2027-01-01');
  assert.deepEqual(outlook.periods.map(period => period.start), ['2028-01-01', '2027-01-01']);
  assert.ok(outlook.periods.every(period => !period.current));
  assert.doesNotMatch(JSON.stringify(outlook), /2025-01-01/);
});

test('no-window and incomplete dates remain honest and do not create a favorable date', () => {
  const empty = buildPredictionOutlook(life('travel', []));
  assert.equal(empty.timing, null);
  assert.deepEqual(empty.periods, []);
  assert.match(empty.summary, /No matching period was found for this topic/);
  for (const topic of ['marriage', 'career', 'difficult-periods', 'education']) {
    const incomplete = buildPredictionOutlook({ topic, status: 'estimated', windows: [window('2026-11-01', '2026-12-01')] });
    assert.equal(incomplete.timing, null, topic);
    assert.deepEqual(incomplete.periods, [], topic);
  }
  const invalid = buildPredictionOutlook(life('education', [window('2027-02-30', '2027-03-10')]));
  assert.equal(invalid.timing, null);
  assert.deepEqual(invalid.periods, []);
});

test('marriage timing keeps complete computed ages and dates and does not move the source support ranking', () => {
  const source = {
    topic: 'marriage', status: 'estimated', asOf, horizonEnd,
    windows: [
      window('2028-01-01', '2029-01-01', [], { ageRange: { min: 32, max: 33 }, support: { label: 'Most supported' } }),
      window('2026-11-01', '2027-02-28', [], { ageRange: { min: 31, max: 31 }, support: { label: 'Supported' } }),
    ],
  };
  const original = structuredClone(source);
  const outlook = buildPredictionOutlook(freeze(source));
  assert.equal(outlook.timing.date, '2026-11-01');
  assert.match(outlook.timing.text, /1 November 2026–28 February 2027, at age 31/);
  assert.deepEqual(outlook.periods.map(period => period.start), original.windows.map(period => period.start));
  assert.match(outlook.periods[0].text, /ages 32–33/);
  assert.match(outlook.periods[0].text, /Most supported/);
  assert.deepEqual(source, original);
  const missing = buildPredictionOutlook({ ...source, status: 'no-window', windows: [] });
  assert.equal(missing.timing, null);
  assert.match(missing.summary, /does not rule out marriage/);
});

test('career highlights a nearer planning date ahead of later combined career windows', () => {
  const source = {
    topic: 'career', status: 'estimated', asOf, horizonEnd, windows: [window('2028-04-02', '2028-07-31', [])],
    searchWindows: [window('2026-11-01', '2026-11-21', [])],
    planningDates: { status: 'available', sampledAt: `${asOf}T12:00:00Z`, horizon: { start: asOf, end: '2027-01-05' }, dates: [{ date: '2026-10-16', sampleUtc: '2026-10-16T06:30:00Z' }] },
  };
  const outlook = buildPredictionOutlook(source);
  assert.equal(outlook.timing.date, '2026-10-16');
  assert.match(outlook.timing.text, /16 October 2026/);
  assert.doesNotMatch(outlook.timing.text, /2028/);
  assert.match(outlook.summary, /not a forecast of an offer/);
  assert.match(outlook.actions[0], /Keep applying now/);
  assert.equal(outlook.periods[0].start, '2028-04-02');
});

test('career planning uses sample instants for local-date relevance and ignores incomplete or past calendars', () => {
  const source = {
    topic: 'career', status: 'no-window', asOf: '2026-10-08', horizonEnd, windows: [],
    planningDates: { status: 'available', sampledAt: '2026-10-08T00:00:00Z', horizon: { start: '2026-10-07', end: '2026-10-10', timeZone: 'Etc/GMT+12' }, dates: [{ date: '2026-10-07', sampleUtc: '2026-10-08T00:00:00Z' }] },
  };
  assert.equal(buildPredictionOutlook(source).timing.date, '2026-10-07');
  const past = structuredClone(source);
  past.planningDates.dates[0].sampleUtc = '2026-10-07T23:59:59Z';
  assert.equal(buildPredictionOutlook(past).timing, null);
  const incomplete = { ...source, planningDates: { dates: [{ date: '2026-10-09' }] } };
  assert.equal(buildPredictionOutlook(incomplete).timing, null);
});

test('difficult-period timing chooses an actual earlier dasha shift without calling it the end of hardship', () => {
  const source = {
    topic: 'difficult-periods', status: 'interpreted', asOf, horizonEnd,
    currentPhase: { name: 'Sade Sati — closing passage' },
    factors: ['Next calculated antardasha starts on 2026-12-02: Moon within Jupiter mahadasha. This is a chart-period transition, not a promised change in circumstances.'],
    windows: [{ start: asOf, end: '2027-06-30', label: 'Current Sade Sati — closing passage', reasons: ['At the sample on 2027-07-01, the classification changes to outside the Sade Sati/Ashtama Shani sign markers. Monthly samples do not establish an exact ingress date.'] }],
  };
  const outlook = buildPredictionOutlook(source);
  assert.equal(outlook.timing.date, '2026-12-02');
  assert.match(outlook.timing.text, /emotional needs and a steadier daily rhythm/);
  assert.match(outlook.timing.text, /does not promise that circumstances improve/);
  assert.doesNotMatch(JSON.stringify(outlook), /bad days will end|will recover|will get easier|fortune improves/i);
  assert.equal(outlook.periods[0].end, '2027-06-30');
});

test('a sampled phase change uses the supplied sample date while a clipped phase invents no exit', () => {
  const source = {
    topic: 'difficult-periods', status: 'interpreted', asOf, horizonEnd, factors: [], currentPhase: { name: 'Ashtama Shani passage' },
    windows: [{ start: asOf, end: '2027-06-30', label: 'Current Ashtama Shani passage', reasons: ['At the sample on 2027-07-01, the classification changes to outside the Sade Sati/Ashtama Shani sign markers. Monthly samples do not establish an exact ingress date.'] }],
  };
  const shift = buildPredictionOutlook(source);
  assert.equal(shift.timing.date, '2027-07-01');
  assert.match(shift.timing.text, /approximate chart marker, not a date when real-life difficulties end/);
  const clipped = { ...source, windows: [{ ...source.windows[0], end: horizonEnd, reasons: ['This window is clipped to the requested horizon; no exit from this passage was found within that horizon.'] }], factors: ['Next calculated antardasha starts on 2035-12-02: Moon within Jupiter mahadasha.'] };
  assert.equal(buildPredictionOutlook(clipped).timing, null);
  const absent = buildPredictionOutlook({ ...source, status: 'no-window', windows: [], currentPhase: { name: 'No current Sade Sati or Ashtama Shani' } });
  assert.equal(absent.timing, null);
  assert.match(absent.summary, /circumstances still deserve attention/);
});

test('the deterministic view is bounded, ignores unknown source prose and returns fresh output objects', () => {
  const source = life('general', Array.from({ length: 100 }, (_, index) => window(`2027-${String(index % 9 + 1).padStart(2, '0')}-01`, `2027-${String(index % 9 + 1).padStart(2, '0')}-28`, ['Jupiter', 'Moon'], { themes: ['Untrusted or private source text '.repeat(10000), themes.Moon] })));
  const first = buildPredictionOutlook(source);
  assert.equal(first.periods.length, 3);
  assert.doesNotMatch(JSON.stringify(first), /private source text/);
  first.actions[0] = 'Changed by caller';
  first.periods[0].text = 'Changed by caller';
  assert.doesNotMatch(JSON.stringify(buildPredictionOutlook(source)), /Changed by caller/);
  for (const value of [null, undefined, [], 'general', { topic: '__proto__' }]) {
    const outlook = buildPredictionOutlook(value);
    assert.equal(outlook.timing, null);
    assert.deepEqual(outlook.actions, []);
    assert.deepEqual(outlook.periods, []);
  }
});

test('every known planet emphasis has a distinct natural reading in each of the seven life topics', () => {
  const topics = ['married-life', 'general', 'education', 'finances', 'family', 'travel', 'wellbeing'];
  for (const topic of topics) {
    const readings = Object.keys(themes).map(lord => buildPredictionOutlook(life(topic, [window(asOf, horizonEnd, [lord])])).periods[0]);
    assert.equal(new Set(readings.map(reading => reading.text)).size, 9, topic);
    assert.ok(readings.every(reading => /\b(?:you|your)\b/i.test(reading.text)), topic);
    assert.ok(readings.every(reading => !/Bring that focus|period themes|mahadasha|antardasha|D1 house|will happen|\d+%/.test(reading.text)), topic);
  }
});

test('the relationship Saturn interpretation comes before a short explanation of the actual chart link', () => {
  const source = life('married-life', [window(asOf, '2027-02-10', ['Rahu', 'Saturn'], { reasons: [
    'Calculated Vimshottari period: Rahu mahadasha / Saturn antardasha.',
    'Saturn, the antardasha lord, rules D1 house 2.',
    'Saturn is in D1 house 5, Vrishabha (Taurus).',
  ] })]);
  const original = structuredClone(source);
  const outlook = buildPredictionOutlook(freeze(source));
  assert.match(outlook.summary, /relationship may need more patience around responsibilities/);
  assert.match(outlook.periods[0].text, /Consistency may matter more/);
  assert.match(outlook.explanation, /calculated Rahu \/ Saturn period/);
  assert.match(outlook.explanation, /Saturn connects this period with shared resources and family values/);
  assert.equal(outlook.periods[0].explanation, outlook.explanation);
  assert.doesNotMatch(outlook.summary, /Saturn|Rahu|mahadasha|D1|bad phase|misfortune|divorce/);
  assert.doesNotMatch(outlook.explanation, /D1|house 5|Vrishabha|always difficult/);
  assert.deepEqual(source, original);
});

test('future-only life readings describe the future chapter and use its own rationale instead of saying it is active now', () => {
  const source = life('education', [window('2027-01-01', '2027-07-01', ['Jupiter', 'Saturn'], { reasons: [
    'Calculated Vimshottari period: Jupiter mahadasha / Saturn antardasha.',
    'Saturn, the antardasha lord, occupies D1 house 9.',
  ] })]);
  const outlook = buildPredictionOutlook(source);
  assert.match(outlook.summary, /^During your next shown period/);
  assert.match(outlook.summary, /repetition and patience/);
  assert.doesNotMatch(outlook.summary, /Right now|current period/);
  assert.equal(outlook.timing.date, '2027-01-01');
  assert.equal(outlook.periods[0].current, false);
  assert.match(outlook.explanation, /advanced learning and mentors/);
});

test('marriage rationale translates supplied period and transit evidence while keeping unique, tied and single comparisons distinct', () => {
  const reasons = [
    'Vimshottari period: Jupiter mahadasha / Venus antardasha.',
    'Venus, a traditional marriage significator, is the antardasha lord.',
    'Jupiter in Simha (Leo) traditionally aspects Kumbha (Aquarius), the natal sign of the seventh house.',
    'Saturn in Mesha (Aries) traditionally aspects Tula (Libra), the natal sign of Venus.',
  ];
  const source = { topic: 'marriage', status: 'estimated', asOf, horizonEnd, windows: [
    window('2026-11-01', '2027-01-31', [], { ageRange: { min: 31, max: 31 }, reasons, support: { kind: 'relative', label: 'Joint most supported', comparison: 'tied-top' } }),
    window('2028-03-01', '2028-09-30', [], { ageRange: { min: 32, max: 33 }, reasons, support: { kind: 'relative', label: 'Joint most supported', comparison: 'tied-top' } }),
  ] };
  const original = structuredClone(source);
  const outlook = buildPredictionOutlook(freeze(source));
  assert.match(outlook.periods[0].text, /Joint most supported: other shown periods have equal traditional support/);
  assert.match(outlook.periods[1].text, /ages 32–33/);
  assert.match(outlook.explanation, /calculated Jupiter \/ Venus period/);
  assert.match(outlook.explanation, /Venus adds the traditional relationship link/);
  assert.match(outlook.explanation, /Jupiter's sampled movement/);
  assert.match(outlook.explanation, /Saturn adds a further timing cue/);
  assert.doesNotMatch(JSON.stringify(outlook), /higher chances|high probability|\d+%|wedding will/);
  assert.deepEqual(source, original);
  const unique = buildPredictionOutlook({ ...source, windows: [{ ...source.windows[0], support: { kind: 'relative', label: 'Most supported', comparison: 'unique-top' } }] });
  assert.match(unique.periods[0].text, /strongest traditional support among the shown periods/);
  const single = buildPredictionOutlook({ ...source, windows: [{ ...source.windows[0], support: { kind: 'relative', label: 'Supported', comparison: 'single' } }] });
  assert.match(single.periods[0].text, /only qualifying period shown, so no comparison/);
  assert.doesNotMatch(single.periods[0].text, /strongest|Most supported/);
});

test('nearer career rationale follows the selected planning evidence without borrowing stronger later timing factors', () => {
  const source = {
    topic: 'career', status: 'estimated', asOf, horizonEnd,
    windows: [window('2028-01-01', '2028-03-31', [], { reasons: ['Vimshottari period: Sun mahadasha / Saturn antardasha.', 'Saturn, the tenth-house ruler, is the antardasha lord.'] })],
    planningDates: { status: 'available', sampledAt: `${asOf}T12:00:00Z`, horizon: { start: asOf, end: '2027-01-05' }, dates: [{
      date: '2026-10-16', sampleUtc: '2026-10-16T06:30:00Z', reasons: [
        'Tarabala: Mitra (8/9), a supportive birth-star relationship in this method.',
        'Chandrabala: the transit Moon is in the 10th sign from the natal Moon, one of this method’s supportive signs.',
      ],
    }] },
  };
  const outlook = buildPredictionOutlook(source);
  assert.equal(outlook.timing.date, '2026-10-16');
  assert.match(outlook.explanation, /birth star and birth Moon/);
  assert.doesNotMatch(outlook.explanation, /Saturn|2028|professional responsibilities/);
  assert.match(outlook.periods[0].explanation, /Saturn connects this period to professional responsibilities/);
});

test('the marriage overview explains its earliest timing period even when a later card has stronger support', () => {
  const source = {
    topic: 'marriage', status: 'estimated', asOf, horizonEnd, windows: [
      window('2028-02-01', '2028-06-30', [], { reasons: ['Vimshottari period: Jupiter mahadasha / Venus antardasha.'], support: { kind: 'relative', label: 'Most supported', comparison: 'unique-top' } }),
      window('2026-11-01', '2027-02-28', [], { reasons: ['Vimshottari period: Saturn mahadasha / Mercury antardasha.'], support: { kind: 'relative', label: 'Supported', comparison: 'lower' } }),
    ],
  };
  const outlook = buildPredictionOutlook(source);
  assert.equal(outlook.timing.date, '2026-11-01');
  assert.match(outlook.explanation, /Saturn \/ Mercury/);
  assert.doesNotMatch(outlook.explanation, /Jupiter \/ Venus/);
  assert.match(outlook.periods[0].explanation, /Jupiter \/ Venus/);
  assert.match(outlook.periods[0].text, /Most supported/);
});

test('Saturn passage experience stays specific to the supplied stage and the rationale uses the sampled Moon relationship', () => {
  const source = {
    topic: 'difficult-periods', status: 'interpreted', asOf, horizonEnd, factors: [],
    currentPhase: { name: 'Sade Sati — middle passage' },
    windows: [{ start: asOf, end: horizonEnd, label: 'Current Sade Sati — middle passage', reasons: [
      'Saturn sampled in Meena (Pisces) is the 1st sign from the natal Moon in Meena (Pisces).',
      'This window is clipped to the requested horizon; no exit from this passage was found within that horizon.',
    ] }],
  };
  const outlook = buildPredictionOutlook(source);
  assert.match(outlook.summary, /more aware of responsibilities and need more breathing room/);
  assert.match(outlook.explanation, /same sign as your birth Moon/);
  assert.equal(outlook.timing, null);
  assert.doesNotMatch(JSON.stringify(outlook), /stars are not supporting|bad phase|hardship will end|misfortune is destined/);
  const future = buildPredictionOutlook({ ...source, currentPhase: { name: 'No current Sade Sati or Ashtama Shani' }, windows: [{ ...source.windows[0], start: '2027-01-01', label: 'Future Sade Sati — middle passage' }] });
  assert.match(future.summary, /No current Saturn passage/);
  assert.equal(future.periods[0].current, false);
  assert.equal(future.explanation, undefined);
});

test('plain explanations copy only recognized calculation facts, ignore arbitrary prose and remain bounded', () => {
  const secret = 'PRIVATE NAME, KEY AND FREE-FORM INSTRUCTION';
  const source = life('family', [window(asOf, horizonEnd, ['Saturn'], { reasons: [
    secret.repeat(1000),
    'Calculated Vimshottari period: Jupiter mahadasha / Saturn antardasha.',
    'Saturn, the antardasha lord, rules D1 house 2.',
    'Saturn, the antardasha lord, rules D1 house 4.',
    `Saturn, the antardasha lord, rules D1 house 2. ${secret}`,
  ], method: [secret], profile: { name: secret } })]);
  const outlook = buildPredictionOutlook(source);
  assert.match(outlook.explanation, /family values and communication/);
  assert.match(outlook.explanation, /home and everyday support/);
  assert.ok(outlook.explanation.length <= 360);
  assert.ok(outlook.periods[0].explanation.length <= 360);
  assert.doesNotMatch(JSON.stringify(outlook), /PRIVATE|INSTRUCTION|KEY|D1 house/);
  const noEvidence = buildPredictionOutlook({ topic: 'marriage', status: 'estimated', asOf, horizonEnd, windows: [window(asOf, horizonEnd, [], { reasons: [secret] })] });
  assert.match(noEvidence.explanation, /supplied traditional marriage timing calculation/);
  assert.doesNotMatch(noEvidence.explanation, /Jupiter|Venus|Saturn/);
});
