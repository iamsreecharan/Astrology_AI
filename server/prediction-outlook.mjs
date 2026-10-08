const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const GRAHA_FOCUS = Object.freeze({
  'Personal direction and responsibility': 'clearer direction and responsibility',
  'Emotional needs and a comfortable daily rhythm': 'emotional needs and a steadier daily rhythm',
  'Learning, clear communication, and reviewing details': 'learning, clear communication and checking details',
  'Cooperation, shared values, and enjoyment': 'cooperation, shared values and enjoyment',
  'Direct effort and constructive ways to handle friction': 'direct effort and handling disagreements constructively',
  'Learning from experience, mentors, and wider perspectives': 'learning from experience and useful guidance',
  'Patience, consistent routines, and realistic commitments': 'patience, steady routines and realistic commitments',
  'Exploring unfamiliar choices while checking expectations': 'unfamiliar choices and keeping expectations realistic',
  'Reflection, simplification, and reviewing priorities': 'reflection, simplifying and reviewing priorities',
});
const GRAHA_READING = Object.freeze({
  'Personal direction and responsibility': ['Clarify your direction', 'This may be a period for clearer decisions and taking ownership of your next steps.'],
  'Emotional needs and a comfortable daily rhythm': ['Build a steadier rhythm', 'Attention may shift toward emotional needs and everyday habits, making a steadier rhythm useful.'],
  'Learning, clear communication, and reviewing details': ['Learn and communicate clearly', 'Careful learning, clear conversations and reviewing details may be especially useful in this period.'],
  'Cooperation, shared values, and enjoyment': ['Make room for connection', 'This may be a time to give more attention to cooperation, shared values and enjoyment.'],
  'Direct effort and constructive ways to handle friction': ['Put plans into action', 'Direct effort may come into focus; turn it into practical steps and handle disagreements constructively.'],
  'Learning from experience, mentors, and wider perspectives': ['Seek guidance and perspective', 'This may be a useful chapter for learning from experience, asking for guidance and considering a wider perspective.'],
  'Patience, consistent routines, and realistic commitments': ['Build routines you can keep', 'Patience, consistent routines and realistic commitments may be the most useful focus of this period.'],
  'Exploring unfamiliar choices while checking expectations': ['Explore with realistic expectations', 'Unfamiliar options may stand out; check expectations before committing to a new direction.'],
  'Reflection, simplification, and reviewing priorities': ['Simplify and review priorities', 'This may feel like a time to simplify, reflect and reconsider what deserves your attention.'],
});
const LORD_FOCUS = Object.freeze(Object.fromEntries(
  ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu']
    .map((lord, index) => [lord, Object.values(GRAHA_FOCUS)[index]]),
));
const TOPICS = Object.freeze({
  'married-life': {
    area: 'your relationship', intro: 'Shared expectations, affection and honest conversations are the focus.',
    fallback: 'communication and shared responsibilities',
    actions: ['Talk about one shared expectation or responsibility without blame.', 'Make time for affection while respecting each other’s boundaries.'],
  },
  general: {
    area: 'your life direction', intro: 'This outlook is about the next chapter and where to put your attention.',
    fallback: 'your priorities and a manageable next step',
    actions: ['Choose one priority for the coming month.', 'Review your commitments and make room for the support you need.'],
  },
  education: {
    area: 'your learning', intro: 'Learning and preparation are the focus of this reading.',
    fallback: 'regular practice and useful feedback',
    actions: ['Set a small study target and keep a repeatable routine.', 'Ask a teacher or mentor for specific feedback.'],
  },
  finances: {
    area: 'your finances', intro: 'This reading focuses on how you manage resources and commitments.',
    fallback: 'a realistic budget and informed decisions',
    actions: ['Review your budget and upcoming commitments.', 'Check financial decisions against reliable information about your circumstances.'],
  },
  family: {
    area: 'family and home', intro: 'Everyday support, expectations and a comfortable home are the focus.',
    fallback: 'family communication and practical support',
    actions: ['Discuss one expectation or source of tension calmly.', 'Agree on a practical way to share responsibilities or offer support.'],
  },
  travel: {
    area: 'travel and relocation', intro: 'This reading is about preparing for unfamiliar places and choices.',
    fallback: 'preparation, realistic costs and openness to learning',
    actions: ['Check costs, documents and the practical steps your plan needs.', 'Keep flexible options while you explore places or opportunities.'],
  },
  wellbeing: {
    area: 'your everyday wellbeing', intro: 'Rest, boundaries and manageable routines are the focus.',
    fallback: 'sustainable routines and enough rest',
    actions: ['Protect time for rest and keep daily responsibilities manageable.', 'Seek qualified care for persistent health symptoms or concerns.'],
  },
});

function bounded(value, limit) {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}

function formatted(value) {
  return DATE_FORMAT.format(new Date(`${value}T00:00:00Z`));
}

function windowRange(window) {
  return window.start === window.end ? formatted(window.start) : `${formatted(window.start)}–${formatted(window.end)}`;
}

function futureDate(value, prediction) {
  const date = calendarDate(value);
  return date && calendarDate(prediction.asOf) && date >= prediction.asOf
    && (!calendarDate(prediction.horizonEnd) || date <= prediction.horizonEnd) ? date : null;
}

function validWindows(prediction, source = prediction.windows) {
  if (!calendarDate(prediction.asOf) || !Array.isArray(source)) return [];
  return source.filter(window => calendarDate(window?.start) && calendarDate(window?.end)
    && window.end >= window.start && window.end >= prediction.asOf
    && (!calendarDate(prediction.horizonEnd) || window.start <= prediction.horizonEnd));
}

function isCurrent(window, prediction) {
  return window.start <= prediction.asOf && prediction.asOf <= window.end;
}

function earliest(windows) {
  return [...windows].sort((first, second) => first.start.localeCompare(second.start))[0] || null;
}

function grahaThemes(value) {
  return [...new Set((Array.isArray(value) ? value : []).filter(theme => Object.hasOwn(GRAHA_FOCUS, theme)))].slice(0, 2);
}

function focusOf(window, fallback, previous) {
  const themes = grahaThemes(window?.themes);
  const previousThemes = grahaThemes(previous?.themes);
  const changed = themes.filter(theme => !previousThemes.includes(theme));
  return (changed.length ? changed : themes).map(theme => GRAHA_FOCUS[theme]).join(', alongside ') || fallback;
}

function primaryTheme(window, previous) {
  const themes = grahaThemes(window.themes);
  const previousThemes = grahaThemes(previous?.themes);
  const changed = themes.filter(theme => !previousThemes.includes(theme));
  return (changed.length ? changed : themes).at(-1);
}

function ageText(window) {
  const min = window.ageRange?.min;
  const max = window.ageRange?.max;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || max > 250) return '';
  return min === max ? `, at age ${min}` : `, at ages ${min}–${max}`;
}

function finish(summary, timing, actions, periods = []) {
  return {
    summary: bounded(summary, 360),
    timing: timing ? { label: bounded(timing.label, 60), text: bounded(timing.text, 360), ...(calendarDate(timing.date) ? { date: timing.date } : {}) } : null,
    actions: actions.slice(0, 3).map(action => bounded(action, 160)),
    periods: periods.slice(0, 3).map(period => ({ ...period, label: bounded(period.label, 90), text: bounded(period.text, 280) })),
  };
}

function lifeOutlook(prediction, definition, windows) {
  const current = windows.find(window => isCurrent(window, prediction));
  const upcoming = earliest(windows.filter(window => window.start > prediction.asOf));
  const fallback = definition.fallback;
  const currentFocus = focusOf(current || { themes: prediction.themes }, fallback);
  let summary = `${definition.intro} Right now, this may feel like a time for ${currentFocus}.`;
  let timing = null;
  if (upcoming) {
    const nextFocus = focusOf(upcoming, fallback, current || { themes: prediction.themes });
    timing = {
      label: 'Your next shift', date: upcoming.start,
      text: `From ${formatted(upcoming.start)}, the period themes bring ${nextFocus} into focus. A shift in themes does not promise an improvement in circumstances.`,
    };
  } else if (current) {
    timing = {
      label: 'The period in focus now', date: current.end,
      text: `The shown period runs through ${formatted(current.end)}. No later relevant period is shown within this reading’s horizon.`,
    };
  } else if (calendarDate(prediction.asOf)) {
    summary = `${definition.intro} No matching period was found for this topic within the reading’s horizon; the everyday focus is ${currentFocus}.`;
  }
  const periods = windows.map((window, index) => {
    const current = isCurrent(window, prediction);
    const focus = focusOf(window, fallback, index ? windows[index - 1] : undefined);
    const reading = GRAHA_READING[primaryTheme(window, index ? windows[index - 1] : undefined)];
    return {
      start: window.start, end: window.end, current,
      label: reading?.[0] || 'Review your next steps',
      text: reading ? `${reading[1]} Bring that focus to ${definition.area}.` : `This period may put ${focus} at the centre of ${definition.area}.`,
    };
  });
  return finish(summary, timing, definition.actions, periods);
}

function marriageOutlook(prediction, windows) {
  const first = prediction.status === 'no-window' ? null : earliest(windows);
  const actions = ['Discuss readiness, shared values and expectations about marriage.', 'Explore introductions or relationships when they fit your circumstances.'];
  if (!calendarDate(prediction.asOf)) return finish('Marriage timing needs the dated windows in your calculated reading. Focus first on readiness and shared expectations.', null, actions);
  if (!first) return finish(
    'No qualifying marriage period was found in this reading’s horizon. That leaves the timing open; it does not rule out marriage.', null, actions,
  );
  const current = isCurrent(first, prediction);
  return finish(
    'Your chart highlights a possible period for marriage. Use it as a prompt for introductions and conversations about commitment, rather than an expected wedding date.',
    { label: current ? 'Marriage period in focus now' : 'Next shown marriage period', date: first.start, text: `${windowRange(first)}${ageText(first)}. This is the earliest qualifying period shown in your reading.` },
    actions,
    windows.map(window => ({
      start: window.start, end: window.end, current: isCurrent(window, prediction), label: 'Possible marriage period',
      text: `A period to consider readiness and commitment${ageText(window)}. ${['Most supported', 'Joint most supported', 'Supported'].includes(window.support?.label) ? `${window.support.label} under the calculated traditional rules.` : 'It meets the supplied traditional timing rules.'}`,
    })),
  );
}

function selectedPlanningDate(prediction) {
  const planning = prediction.planningDates;
  if (planning?.status !== 'available' || !calendarDate(planning.horizon?.start) || !calendarDate(planning.horizon?.end) || !Array.isArray(planning.dates)) return null;
  const sampledAt = Date.parse(planning.sampledAt);
  return [...planning.dates].filter(day => {
    if (!calendarDate(day?.date) || day.date < planning.horizon.start || day.date > planning.horizon.end) return false;
    const sample = Date.parse(day.sampleUtc);
    return Number.isFinite(sampledAt) && Number.isFinite(sample)
      ? sample >= sampledAt : Boolean(futureDate(day.date, prediction));
  }).sort((first, second) => first.date.localeCompare(second.date))[0] || null;
}

function careerOutlook(prediction, windows) {
  const search = earliest(validWindows(prediction, prediction.searchWindows));
  const day = calendarDate(prediction.asOf) ? selectedPlanningDate(prediction) : null;
  const broader = prediction.status === 'no-window' ? null : earliest(windows);
  const actions = ['Keep applying now and tailor your CV to each role.', 'Follow up on applications and practise clear interview answers.'];
  let summary = 'Focus on practical momentum: clear applications, conversations and interview preparation.';
  let timing = null;
  if (!calendarDate(prediction.asOf)) return finish(`${summary} A dated planning calendar is not available in this reading.`, null, actions);
  if (search || day) {
    summary += ' Your nearer calendar is a prompt for taking action, not a forecast of an offer.';
    const current = search && isCurrent(search, prediction);
    const dayFirst = day && (!search || current || day.date < search.start);
    timing = dayFirst ? {
      label: 'Next selected planning date', date: day.date,
      text: `${formatted(day.date)} is a selected date for applications, preparation or interviews.${current ? ` A search-planning period is also in focus through ${formatted(search.end)}.` : ''} Continue pursuing real opportunities on other dates too.`,
    } : {
      label: current ? 'Search-planning period now' : 'Next search-planning period', date: search.start,
      text: `${windowRange(search)} is a period to focus on applications, interviews or networking. Continue searching before and outside this interval.`,
    };
  } else if (broader) {
    summary += ' A broader career period is shown, but you do not need to wait for it to pursue a role.';
    timing = { label: isCurrent(broader, prediction) ? 'Broader career period now' : 'Next broader career period', date: broader.start, text: `${windowRange(broader)} is the earliest combined period shown. It is a traditional career marker, rather than an offer deadline.` };
  } else {
    summary += ' No qualifying timing period was found here; let current openings and your progress guide your next step.';
  }
  return finish(summary, timing, actions, windows.map(window => ({
    start: window.start, end: window.end, current: isCurrent(window, prediction), label: 'Broader career period',
    text: 'The combined timing rules highlight this period for professional direction. Use it alongside current applications and actual opportunities.',
  })));
}

function difficultyOutlook(prediction, windows) {
  const current = windows.find(window => isCurrent(window, prediction));
  const next = earliest(windows.filter(window => window.start > prediction.asOf));
  const changes = [];
  for (const reason of Array.isArray(current?.reasons) ? current.reasons : []) {
    const match = typeof reason === 'string' && reason.match(/^At the sample on (\d{4}-\d{2}-\d{2}), the classification changes to /);
    if (match && futureDate(match[1], prediction) && match[1] > prediction.asOf) changes.push({ date: match[1], kind: 'phase' });
  }
  if (!current && next) changes.push({ date: next.start, kind: 'phase' });
  for (const factor of Array.isArray(prediction.factors) ? prediction.factors : []) {
    const match = typeof factor === 'string' && factor.match(/^Next calculated antardasha starts on (\d{4}-\d{2}-\d{2}): (Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Rahu|Ketu) within /);
    if (match && futureDate(match[1], prediction) && match[1] > prediction.asOf) changes.push({ date: match[1], kind: 'period', lord: match[2] });
  }
  changes.sort((first, second) => first.date.localeCompare(second.date));
  const change = changes[0];
  const timing = change ? {
    label: change.kind === 'phase' ? 'Next sampled phase change' : 'Next calculated period shift', date: change.date,
    text: change.kind === 'phase'
      ? `A change in the sampled Saturn phase appears on ${formatted(change.date)}. This is an approximate chart marker, not a date when real-life difficulties end.`
      : `From ${formatted(change.date)}, period themes turn toward ${LORD_FOCUS[change.lord]}. A chart-period change does not promise that circumstances improve then.`,
  } : null;
  const absent = /^No current Sade Sati or Ashtama Shani$/.test(prediction.currentPhase?.name || '');
  const summary = absent
    ? 'No current Saturn passage of this type is marked in your chart. Your circumstances still deserve attention; focus on manageable steps and practical support.'
    : 'This reading puts patience, steady routines and realistic commitments in focus. It offers a way to approach a demanding season, rather than a deadline for when difficulties must end.';
  return finish(summary, timing, ['Reduce one avoidable pressure and take the next manageable step.', 'Ask someone you trust for practical support with what is difficult now.'], windows.map(window => {
    const phase = /opening passage/.test(window.label || '') ? 'opening'
      : /middle passage/.test(window.label || '') ? 'middle'
        : /closing passage/.test(window.label || '') ? 'closing' : 'adjustment';
    const reading = {
      opening: ['Build a steadier foundation', 'A useful focus is to simplify commitments and establish routines you can keep.'],
      middle: ['Work with manageable commitments', 'A useful focus is to protect your energy, ask for support and handle one responsibility at a time.'],
      closing: ['Review what you want to carry forward', 'A useful focus is to review what you have learned and keep commitments realistic.'],
      adjustment: ['Make room for patient adjustment', 'A useful focus is to leave room for adjustments and seek practical support while making plans.'],
    }[phase];
    return { start: window.start, end: window.end, current: isCurrent(window, prediction), label: reading[0], text: reading[1] };
  }));
}

/** Translate the supplied calculation into a short outlook without adding timing rules. */
export function buildPredictionOutlook(prediction) {
  if (!prediction || typeof prediction !== 'object' || Array.isArray(prediction)) return finish('Choose a life topic to see its outlook.', null, []);
  const windows = validWindows(prediction);
  if (Object.hasOwn(TOPICS, prediction.topic)) return lifeOutlook(prediction, TOPICS[prediction.topic], windows);
  if (prediction.topic === 'marriage') return marriageOutlook(prediction, windows);
  if (prediction.topic === 'career') return careerOutlook(prediction, windows);
  if (prediction.topic === 'difficult-periods') return difficultyOutlook(prediction, windows);
  return finish('Choose a supported life topic to see its outlook.', null, []);
}
