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
const LORD_FOCUS = Object.freeze(Object.fromEntries(
  ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu']
    .map((lord, index) => [lord, Object.values(GRAHA_FOCUS)[index]]),
));
const THEME_LORD = Object.freeze(Object.fromEntries(
  Object.keys(GRAHA_FOCUS).map((theme, index) => [theme, Object.keys(LORD_FOCUS)[index]]),
));
const LORD_PATTERN = '(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Rahu|Ketu)';
const PERIOD_REASON = new RegExp(`^(?:Calculated )?Vimshottari period: ${LORD_PATTERN} mahadasha / ${LORD_PATTERN} antardasha\\.$`);
const ROLE_REASON = new RegExp(`^${LORD_PATTERN}, the (?:mahadasha|antardasha) lord, (?:rules|occupies) D1 house (\\d{1,2})\\.$`);

// These descriptions translate the engines' existing themes; they do not add
// event forecasts, strength assessments or new timing rules.
const AREA_READINGS = Object.freeze({
  'married-life': {
    Sun: ['Make expectations clear', 'You may feel a stronger need to be heard and respected in your relationship. Clear expectations can keep decisions from becoming a contest of wills.'],
    Moon: ['Make room for emotional closeness', 'Feeling understood at home may matter more to you in this period. Small changes in mood or routine may need reassurance and a gentler conversation.'],
    Mercury: ['Understand each other better', 'Your relationship may ask for clearer conversations about everyday decisions. Listening carefully and checking assumptions can help you understand each other better.'],
    Venus: ['Give your relationship time', 'Affection and shared enjoyment may become more central to your relationship. Making time for each other can help you see where your values fit together.'],
    Mars: ['Handle friction with care', 'Disagreements may feel more immediate, and you may want quicker answers from each other. Use that energy to solve a shared problem rather than rush an argument.'],
    Jupiter: ['Look at the bigger picture together', 'You may start looking more closely at the future you want together. Advice from someone experienced can help you discuss values without losing sight of each other.'],
    Saturn: ['Build trust through consistency', 'Your relationship may need more patience around responsibilities and expectations. Consistency may matter more than quick reassurance, so make commitments you can both keep.'],
    Rahu: ['Check new expectations together', 'New desires or unfamiliar choices may change what you expect from your relationship. Talk through those expectations before assuming your partner sees things the same way.'],
    Ketu: ['Reconnect with what matters', 'You may want more personal space or question habits that no longer feel meaningful. Explain what you need gently, so reflection does not turn into unexplained distance.'],
  },
  general: {
    Sun: ['Clarify your direction', 'You may feel ready to choose a clearer direction and take more ownership of your decisions. A manageable next step can turn that sense of responsibility into progress.'],
    Moon: ['Build a steadier rhythm', 'Your emotional needs and everyday rhythm may become harder to ignore. Give yourself a steadier routine before making decisions in a passing mood.'],
    Mercury: ['Learn and communicate clearly', 'You may find yourself comparing options, learning something new or returning to unfinished details. Clear conversations and careful checking can make the next step easier to understand.'],
    Venus: ['Make room for connection', 'You may give more attention to relationships, enjoyment and the kind of life you want to share. Make room for what you value without losing track of your commitments.'],
    Mars: ['Put plans into action', 'You may feel more impatient to move forward. Put that energy into practical steps, and pause before treating a disagreement as something you must win.'],
    Jupiter: ['Seek guidance and perspective', 'You may be reconsidering your direction through experience, learning or advice. A wider perspective can help you choose a next step that fits your longer-term priorities.'],
    Saturn: ['Build routines you can keep', 'Progress may feel more gradual, with responsibilities asking for steady attention. Break large plans into commitments you can keep instead of judging everything by quick results.'],
    Rahu: ['Explore with realistic expectations', 'An unfamiliar direction may seem especially compelling to you. Explore it carefully, and check whether the promise fits the practical reality before committing.'],
    Ketu: ['Simplify and review priorities', 'You may question goals or routines that once felt important. Give yourself room to simplify and decide what still deserves your time.'],
  },
  education: {
    Sun: ['Take ownership of your learning', 'You may feel a stronger need to choose your own study direction. A clear goal can help you use that independence without overlooking feedback.'],
    Moon: ['Make studying feel manageable', 'Your concentration may feel more tied to your mood and daily routine. A comfortable study rhythm may help you stay engaged when motivation varies.'],
    Mercury: ['Work through the details', 'You may spend more time understanding details and explaining what you learn. Questions, revision and feedback can help you see what still needs practice.'],
    Venus: ['Find a way to enjoy learning', 'You may want learning to feel more engaging or shared with others. A study partner or a creative approach may help you stay involved with the work.'],
    Mars: ['Turn effort into steady practice', 'You may want to tackle your studies with more energy and urgency. Set focused practice targets so that effort does not become frustration with slower topics.'],
    Jupiter: ['Learn with useful guidance', 'You may be drawn toward deeper study or guidance from a teacher. Use that broader interest to strengthen understanding, rather than expect an exam result from the chart.'],
    Saturn: ['Build understanding patiently', 'Learning may ask for repetition and patience, especially when results feel slow. A steady study routine can help you work through difficult material without rushing it.'],
    Rahu: ['Explore a new learning direction', 'An unfamiliar subject or learning route may attract you. Check course requirements and what the opportunity actually offers before changing direction.'],
    Ketu: ['Review how you learn', 'You may question whether your current study approach still suits you. Simplify distractions and return to the parts of learning you want to understand well.'],
  },
  finances: {
    Sun: ['Take charge of your commitments', 'You may want more control over financial decisions and responsibilities. Make the commitments clear before taking on an expense to prove independence.'],
    Moon: ['Build a steadier money routine', 'Financial comfort may feel closely tied to your sense of security at home. A predictable budget can make everyday choices feel less reactive.'],
    Mercury: ['Check the numbers carefully', 'Your financial choices may need more comparison, paperwork or discussion. Read the details carefully and clarify assumptions before making a commitment.'],
    Venus: ['Balance enjoyment and spending', 'Comfort, shared experiences or enjoyable purchases may take more of your attention. Decide what fits your budget before a pleasant choice becomes an ongoing commitment.'],
    Mars: ['Pause before a quick money decision', 'You may feel an urge to act quickly on a financial choice. Give yourself time to check costs and consequences before committing money.'],
    Jupiter: ['Review your longer-term plans', 'You may be looking for a broader plan for your resources or income goals. Useful guidance can help you weigh options, but the chart does not establish investment returns.'],
    Saturn: ['Keep financial commitments realistic', 'Your money responsibilities may call for more patience and consistency. Keep a realistic budget and work through existing commitments before adding new ones.'],
    Rahu: ['Check an attractive offer carefully', 'An unfamiliar financial opportunity may look especially attractive. Verify its terms and risks with reliable information before deciding whether it fits your circumstances.'],
    Ketu: ['Simplify your financial priorities', 'You may question whether certain expenses still feel worthwhile. Review what you use and value before making a sudden change to your financial plans.'],
  },
  family: {
    Sun: ['Clarify your role at home', 'You may feel a stronger need to define your role within the family. Clear expectations can help you take responsibility while leaving room for others to be heard.'],
    Moon: ['Make home feel more supportive', 'Emotional comfort and everyday support at home may matter more to you. Small changes in routine and a calm conversation may help everyone feel better understood.'],
    Mercury: ['Understand family expectations', 'Your family life may need more discussion about plans, arrangements or everyday expectations. Check what each person means before acting on an assumption.'],
    Venus: ['Make time for family connection', 'Shared time and a comfortable home may become more important to you. Simple, thoughtful gestures can make affection easier to express without ignoring boundaries.'],
    Mars: ['Work through tension calmly', 'Disagreements in your family may feel more immediate, especially around who should do what. Choose a practical shared task and give a tense conversation time to settle.'],
    Jupiter: ['Look at family choices with perspective', 'You may be considering family choices in a wider or longer-term way. Guidance can be useful, while still allowing each person to speak for their own needs.'],
    Saturn: ['Share responsibilities fairly', 'Your family responsibilities may feel more demanding or slower to resolve. Agree on practical support and realistic limits rather than expect one person to carry everything.'],
    Rahu: ['Discuss changes before assuming agreement', 'Unfamiliar plans or changing expectations may come into your family discussions. Explain the practical details before assuming everyone feels ready for the same change.'],
    Ketu: ['Make space without losing connection', 'You may want more space or question familiar family habits. Explain that need gently and keep a practical way to stay connected.'],
  },
  travel: {
    Sun: ['Choose the purpose of your journey', 'You may want a journey or relocation to reflect your own direction. Be clear about its purpose and the responsibilities it brings before deciding.'],
    Moon: ['Plan for comfort while away', 'Being away from familiar routines may bring your need for comfort into focus. Plan for rest and everyday support alongside the journey itself.'],
    Mercury: ['Check the practical details', 'Travel plans may ask for more research, documents or communication. Checking arrangements carefully can help you understand what is ready and what still needs work.'],
    Venus: ['Balance enjoyment and practical plans', 'You may be drawn to a journey for enjoyment, connection or a change of surroundings. Check shared preferences and costs so the plan works for those involved.'],
    Mars: ['Plan before moving quickly', 'You may feel eager to move or take a journey quickly. Put that energy into preparation and leave room to check details before committing.'],
    Jupiter: ['Explore with a wider perspective', 'Travel may appeal as a way to learn, study or experience a different perspective. Useful guidance can help you prepare for an unfamiliar setting.'],
    Saturn: ['Give your plans enough preparation', 'Your journey or relocation may need more patient preparation and realistic commitments. Work through documents, costs and responsibilities one step at a time.'],
    Rahu: ['Explore an unfamiliar setting carefully', 'An unfamiliar place or way of living may seem especially attractive. Research its practical realities before deciding whether the change suits you.'],
    Ketu: ['Review what you want from time away', 'You may want distance from a familiar routine or time to reflect. Clarify what a journey would offer before expecting a new place to solve an existing problem.'],
  },
  wellbeing: {
    Sun: ['Keep your responsibilities manageable', 'You may feel a stronger need to stay in control of responsibilities. Make room for rest rather than measure your wellbeing by how much you can carry.'],
    Moon: ['Give your daily rhythm more care', 'Your emotional needs and daily comfort may deserve more attention. A gentler, steadier rhythm may help you notice when you need rest or support.'],
    Mercury: ['Simplify a busy routine', 'A busy mind or schedule may make it harder to settle into your routine. Clarify priorities and create small pauses instead of trying to handle every detail at once.'],
    Venus: ['Make room for restorative time', 'Enjoyment, connection and a comfortable routine may become more important. Give them a place in your day while keeping responsibilities manageable.'],
    Mars: ['Use energy without overextending', 'You may want to keep moving or deal with tasks quickly. Use that energy in manageable steps and leave enough room for rest.'],
    Jupiter: ['Seek perspective and practical support', 'You may benefit from looking at your routines with a wider perspective. Useful guidance can help you choose manageable habits; persistent symptoms need qualified care.'],
    Saturn: ['Choose a routine you can sustain', 'Your responsibilities may feel more demanding, making consistency and realistic limits important. Keep a sustainable rhythm and ask for support before taking on more.'],
    Rahu: ['Check a new routine before committing', 'An unfamiliar approach to your routine may seem appealing. Check reliable information and practical fit instead of treating a new approach as a promised solution.'],
    Ketu: ['Make room to reflect and rest', 'You may want quieter time or less stimulation in everyday life. Make space for reflection while staying connected to practical support.'],
  },
});
const AREA_HOUSES = Object.freeze({
  'married-life': { 2: 'shared resources and family values', 4: 'home life and emotional comfort', 7: 'partnership' },
  general: {}, education: { 5: 'study and creative learning', 9: 'advanced learning and mentors' },
  finances: { 2: 'resources and budgeting', 11: 'income networks and longer-term goals' },
  family: { 2: 'family values and communication', 4: 'home and everyday support' },
  travel: { 9: 'long-distance journeys and cultural learning', 12: 'time away and unfamiliar settings' },
  wellbeing: { 6: 'daily routines and responsibilities', 12: 'rest and reflection' },
});
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

function sourceReasons(window) {
  return (Array.isArray(window?.reasons) ? window.reasons : []).filter(reason => typeof reason === 'string');
}

function calculatedPeriod(window) {
  for (const reason of sourceReasons(window)) {
    const match = reason.match(PERIOD_REASON);
    if (match) return { main: match[1], sub: match[2] };
  }
  return null;
}

function lifeReading(topic, window, previous) {
  return AREA_READINGS[topic]?.[THEME_LORD[primaryTheme(window, previous)]]
    || ['Review your next steps', `This period is linked to ${TOPICS[topic].area}, but no planet-specific emphasis is supplied. Keep your next step manageable and suited to your circumstances.`];
}

function lifeExplanation(topic, window) {
  const period = calculatedPeriod(window);
  const lead = period
    ? `Your calculated ${period.main} / ${period.sub} period sets these dates.`
    : 'These dates come from the supplied life-topic period calculation.';
  const links = [];
  for (const reason of sourceReasons(window)) {
    const match = reason.match(ROLE_REASON);
    const area = match && AREA_HOUSES[topic]?.[match[2]];
    if (area) links.push(`${match[1]} connects this period with ${area} in your birth chart.`);
    const significator = reason.match(new RegExp(`^${LORD_PATTERN}, the (?:mahadasha|antardasha) lord, is a traditional significator used for this topic\\.$`));
    if (significator) links.push(`${significator[1]} is also a traditional marker used for ${TOPICS[topic].area}.`);
  }
  const uniqueLinks = [...new Set(links)].slice(0, 2);
  if (uniqueLinks.length) return `${lead} ${uniqueLinks.join(' ')}`;
  const emphases = grahaThemes(window.themes).map(theme => GRAHA_FOCUS[theme]);
  return `${lead}${emphases.length ? ` The supplied themes emphasize ${emphases.join(' alongside ')}.` : ''}`;
}

function lowerFirst(text) {
  return `${text[0].toLowerCase()}${text.slice(1)}`;
}

function finish(summary, timing, actions, periods = [], explanation) {
  return {
    summary: bounded(summary, 360),
    ...(explanation ? { explanation: bounded(explanation, 360) } : {}),
    timing: timing ? { label: bounded(timing.label, 60), text: bounded(timing.text, 360), ...(calendarDate(timing.date) ? { date: timing.date } : {}) } : null,
    actions: actions.slice(0, 3).map(action => bounded(action, 160)),
    periods: periods.slice(0, 3).map(period => ({
      ...period, label: bounded(period.label, 90), text: bounded(period.text, 280),
      ...(period.explanation ? { explanation: bounded(period.explanation, 360) } : {}),
    })),
  };
}

function lifeOutlook(prediction, definition, windows) {
  const current = windows.find(window => isCurrent(window, prediction));
  const upcoming = earliest(windows.filter(window => window.start > prediction.asOf));
  const selected = current || upcoming;
  let summary = selected
    ? `${current ? 'Right now' : 'During your next shown period'}, ${lowerFirst(lifeReading(prediction.topic, selected)[1])}`
    : `${definition.intro} No dated period is available here; focus on ${definition.fallback}.`;
  let timing = null;
  if (upcoming) {
    const reading = lifeReading(prediction.topic, upcoming, current);
    timing = {
      label: 'Your next shift', date: upcoming.start,
      text: `From ${formatted(upcoming.start)}, ${lowerFirst(reading[1].split(/(?<=[.!?]) /)[0])} This is a change in emphasis, not a promised improvement.`,
    };
  } else if (current) {
    timing = {
      label: 'The period in focus now', date: current.end,
      text: `The shown period runs through ${formatted(current.end)}. No later relevant period is shown within this reading’s horizon.`,
    };
  } else if (calendarDate(prediction.asOf)) {
    summary = `${definition.intro} No matching period was found for this topic within the reading’s horizon; the everyday focus is ${definition.fallback}.`;
  }
  const periods = windows.map((window, index) => {
    const current = isCurrent(window, prediction);
    const reading = lifeReading(prediction.topic, window, index ? windows[index - 1] : undefined);
    return {
      start: window.start, end: window.end, current,
      label: reading[0], text: reading[1], explanation: lifeExplanation(prediction.topic, window),
    };
  });
  return finish(summary, timing, definition.actions, periods, selected ? lifeExplanation(prediction.topic, selected) : undefined);
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
    'The highlighted period looks supportive for exploring marriage under the supplied traditional timing rules. Introductions or conversations about commitment may be more relevant then, if you and the relationship are ready.',
    { label: current ? 'Marriage period in focus now' : 'Next shown marriage period', date: first.start, text: `${windowRange(first)}${ageText(first)}. This is the earliest qualifying period shown in your reading.` },
    actions,
    windows.map(window => ({
      start: window.start, end: window.end, current: isCurrent(window, prediction), label: 'Possible marriage period',
      text: `Marriage discussions or introductions may feel more timely in this period${ageText(window)}. ${supportDescription(window)}`,
      explanation: eventExplanation(window, 'marriage'),
    })),
    eventExplanation(first, 'marriage'),
  );
}

function supportDescription(window) {
  if (window.support?.kind === 'relative') {
    if (window.support.comparison === 'unique-top') return 'Most supported: it has the strongest traditional support among the shown periods.';
    if (window.support.comparison === 'tied-top') return 'Joint most supported: other shown periods have equal traditional support.';
    if (window.support.comparison === 'single') return 'Supported: it is the only qualifying period shown, so no comparison is made.';
    if (window.support.comparison === 'lower') return 'Supported: it qualifies, with less traditional support than the strongest shown period.';
  }
  const label = window.support?.label;
  return ['Most supported', 'Joint most supported', 'Supported'].includes(label)
    ? `${label} under the calculated traditional rules.` : 'It meets the supplied traditional timing rules.';
}

function eventExplanation(window, topic) {
  const period = calculatedPeriod(window);
  const reasons = sourceReasons(window);
  const ruler = reasons.map(reason => reason.match(new RegExp(`^${LORD_PATTERN}, the ${topic === 'marriage' ? 'seventh' : 'tenth'}-house ruler, is the (?:antardasha|mahadasha) lord\\.$`))).find(Boolean);
  const marker = topic === 'marriage'
    ? reasons.some(reason => /^Venus, a traditional marriage significator, is the (?:antardasha|mahadasha) lord\.$/.test(reason))
    : reasons.some(reason => /^(?:Mercury|Saturn), a traditional professional significator used by this method, is the (?:antardasha|mahadasha) lord\.$/.test(reason));
  const transitMatches = (name) => reasons.some(reason => new RegExp(`^${name} in [A-Za-z ()]+ (?:occupies|traditionally aspects) [A-Za-z ()]+, the natal sign of .+\\.$`).test(reason)
    && (topic === 'marriage' ? /(?:the seventh house|its ruler (?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Rahu|Ketu)|Venus)\.$/.test(reason)
      : /(?:the tenth house|its ruler (?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Rahu|Ketu))\.$/.test(reason)));
  const parts = [];
  if (period) parts.push(`Your calculated ${period.main} / ${period.sub} period sets the timing.`);
  if (ruler) parts.push(`${ruler[1]} connects this period to ${topic === 'marriage' ? 'partnership' : 'professional responsibilities'} in your birth chart.`);
  else if (marker) parts.push(`${topic === 'marriage' ? 'Venus adds the traditional relationship link' : 'A traditional professional marker is active'} in this period.`);
  if (transitMatches('Jupiter')) parts.push(`Jupiter's sampled movement also connects with ${topic === 'marriage' ? 'marriage-related' : 'career-related'} parts of your chart.`);
  if (topic === 'marriage' && transitMatches('Saturn')) parts.push('Saturn adds a further timing cue; it does not create the marriage window on its own.');
  return parts.join(' ') || `These dates come from the supplied traditional ${topic} timing calculation. They describe a period to consider, rather than the day an event must happen.`;
}

function planningExplanation(day, search) {
  if (day) {
    const reasons = sourceReasons(day);
    const star = reasons.some(reason => /^Tarabala: (?:Sampat|Kshema|Sadhana|Mitra|Parama Mitra) \((?:2|4|6|8|9)\/9\), a supportive birth-star relationship in this method\.$/.test(reason));
    const moon = reasons.some(reason => /^Chandrabala: the transit Moon is in the (?:1st|3rd|6th|7th|10th|11th) sign from the natal Moon, one of this method’s supportive signs\.$/.test(reason));
    if (star && moon) return 'At the sampled time, the Moon has a supportive relationship to your birth star and birth Moon under this calendar’s checks. That is a cue for planning your effort, not a calculation of when an employer will make an offer.';
    return 'The supplied calendar selected this date for job-search planning. It does not calculate an offer date or mean you need to delay a real opportunity.';
  }
  if (sourceReasons(search).some(reason => /^Mercury in [A-Za-z ()]+ transits the natal (?:6th|10th|11th) whole-sign house, used here as a traditional prompt for /.test(reason))) {
    return 'Mercury’s sampled passage through a work-related part of your chart is the cue for applications, interviews or networking. This is a planning period, separate from the broader career timing calculation.';
  }
  return 'This interval comes from the supplied application and interview planning calculation. It is a prompt for taking action, rather than a predicted offer window.';
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
  let summary = 'This reading is most useful for deciding where to put your effort in the job search. Clear applications and prepared conversations can help you make use of actual opportunities.';
  let timing = null;
  let explanation;
  if (!calendarDate(prediction.asOf)) return finish(`${summary} A dated planning calendar is not available in this reading.`, null, actions);
  if (search || day) {
    summary = 'Your nearer calendar highlights times to give applications, interviews or networking more attention. Use this to build momentum now; it is a planning cue, not a forecast of an offer.';
    const current = search && isCurrent(search, prediction);
    const dayFirst = day && (!search || current || day.date < search.start);
    explanation = planningExplanation(dayFirst ? day : null, search);
    timing = dayFirst ? {
      label: 'Next selected planning date', date: day.date,
      text: `${formatted(day.date)} is a selected date for applications, preparation or interviews.${current ? ` A search-planning period is also in focus through ${formatted(search.end)}.` : ''} Continue pursuing real opportunities on other dates too.`,
    } : {
      label: current ? 'Search-planning period now' : 'Next search-planning period', date: search.start,
      text: `${windowRange(search)} is a period to focus on applications, interviews or networking. Continue searching before and outside this interval.`,
    };
  } else if (broader) {
    summary = 'Your chart highlights a broader period with traditional support for professional direction. It may be a useful time to pursue a role or discuss responsibilities, while continuing your search now.';
    explanation = eventExplanation(broader, 'career');
    timing = { label: isCurrent(broader, prediction) ? 'Broader career period now' : 'Next broader career period', date: broader.start, text: `${windowRange(broader)} is the earliest combined period shown. It is a traditional career marker, rather than an offer deadline.` };
  } else {
    summary += ' No qualifying timing period was found here; let current openings and your progress guide your next step.';
  }
  return finish(summary, timing, actions, windows.map(window => ({
    start: window.start, end: window.end, current: isCurrent(window, prediction), label: 'Broader career period',
    text: `Work-related conversations and decisions may be more relevant in this period. Keep pursuing actual openings and preparation. ${supportDescription(window)}`,
    explanation: eventExplanation(window, 'career'),
  })), explanation);
}

function saturnReading(value) {
  if (/opening passage/.test(value || '')) return ['Build a steadier foundation', 'This passage may feel like a time of adjustment, with responsibilities asking for more attention. Simplify what you can and build routines you can keep.'];
  if (/middle passage/.test(value || '')) return ['Work with manageable commitments', 'You may feel more aware of responsibilities and need more breathing room in this passage. Handle one commitment at a time and ask for practical support.'];
  if (/closing passage/.test(value || '')) return ['Review what you want to carry forward', 'This passage may put unfinished responsibilities and lessons from recent experience into focus. Keep what is useful and make your next commitments realistic.'];
  if (/Ashtama Shani passage/.test(value || '')) return ['Make room for patient adjustment', 'Plans may need more patience and room for adjustment in this passage. Avoid adding unnecessary pressure and leave time to work through practical concerns.'];
  return ['Make room for patient adjustment', 'This passage is traditionally approached with patience and realistic commitments. Keep plans manageable and make room for practical support.'];
}

function saturnExplanation(window) {
  for (const reason of sourceReasons(window)) {
    const match = reason.match(/^Saturn sampled in [A-Za-z ()]+ is the (12th|1st|2nd|8th) sign from the natal Moon in [A-Za-z ()]+\.$/);
    if (match) {
      const position = { '12th': 'in the sign just before your birth Moon’s sign', '1st': 'in the same sign as your birth Moon', '2nd': 'in the sign just after your birth Moon’s sign', '8th': 'in the eighth sign from your birth Moon' }[match[1]];
      return `The calculation places Saturn ${position}. This is one of the traditional Saturn-passage markers used here, which is why patience and adjustment are emphasized; it does not determine whether your life will be difficult.`;
    }
  }
  return 'This explanation follows the supplied Saturn-passage classification and its sampled dates. A passage describes a traditional theme; it does not establish that hardship is destined.';
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
  const phaseKnown = /(?:Sade Sati — (?:opening|middle|closing) passage|Ashtama Shani passage)/.test(prediction.currentPhase?.name || '');
  const summary = absent
    ? 'No current Saturn passage of this type is marked in your chart. Your circumstances still deserve attention; focus on manageable steps and practical support.'
    : phaseKnown || current ? saturnReading(prediction.currentPhase?.name || current.label)[1]
      : 'No current Saturn-passage classification is supplied in this reading. Focus on the practical circumstances and support available to you now.';
  return finish(summary, timing, ['Reduce one avoidable pressure and take the next manageable step.', 'Ask someone you trust for practical support with what is difficult now.'], windows.map(window => {
    const reading = saturnReading(window.label);
    return {
      start: window.start, end: window.end, current: isCurrent(window, prediction), label: reading[0], text: reading[1],
      explanation: saturnExplanation(window),
    };
  }), !absent && (phaseKnown || current) ? saturnExplanation(current) : undefined);
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
