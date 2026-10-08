import { validateBirthDetails } from './vedic-chart.mjs';

const RASHIS = Object.freeze([
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
  'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)',
]);
const RULERS = Object.freeze(['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter']);
const GRAHAS = Object.freeze(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu']);
const GRAHA_THEMES = Object.freeze({
  Sun: 'Personal direction and responsibility',
  Moon: 'Emotional needs and a comfortable daily rhythm',
  Mercury: 'Learning, clear communication, and reviewing details',
  Venus: 'Cooperation, shared values, and enjoyment',
  Mars: 'Direct effort and constructive ways to handle friction',
  Jupiter: 'Learning from experience, mentors, and wider perspectives',
  Saturn: 'Patience, consistent routines, and realistic commitments',
  Rahu: 'Exploring unfamiliar choices while checking expectations',
  Ketu: 'Reflection, simplification, and reviewing priorities',
});
const TOPICS = Object.freeze({
  'married-life': {
    houses: [2, 4, 7], significators: ['Venus'],
    themes: ['Talk openly about shared values and responsibilities', 'Make room for affection, boundaries, and each partner’s preferences'],
    houseThemes: { 2: 'shared resources and family values', 4: 'home life and emotional comfort', 7: 'partnership and cooperation' },
  },
  general: {
    houses: [], significators: [],
    themes: ['Review your priorities and choose one practical next step'], houseThemes: {},
  },
  education: {
    houses: [5, 9], significators: ['Mercury', 'Jupiter'],
    themes: ['Build a regular study routine', 'Seek useful feedback and learning opportunities'],
    houseThemes: { 5: 'study and creative learning', 9: 'advanced learning and mentors' },
  },
  finances: {
    houses: [2, 11], significators: ['Jupiter'],
    themes: ['Review resources, commitments, and a realistic budget', 'Use reliable information when weighing financial choices'],
    houseThemes: { 2: 'resources and budgeting', 11: 'income networks and long-term goals' },
  },
  family: {
    houses: [2, 4], significators: ['Moon'],
    themes: ['Discuss expectations and practical support with family', 'Consider what would make home life more comfortable'],
    houseThemes: { 2: 'family values and communication', 4: 'home, belonging, and everyday support' },
  },
  travel: {
    houses: [9, 12], significators: [],
    themes: ['Explore plans with realistic costs and preparation', 'Leave room to learn from unfamiliar places and perspectives'],
    houseThemes: { 9: 'long-distance journeys and cultural learning', 12: 'time away and unfamiliar settings' },
  },
  wellbeing: {
    houses: [6, 12], significators: [],
    themes: ['Balance daily responsibilities with rest', 'Choose sustainable routines and ask for practical support when needed'],
    houseThemes: { 6: 'daily routines and responsibilities', 12: 'rest, boundaries, and reflection' },
  },
});

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validSign(value) {
  return Number.isInteger(value) && value >= 0 && value < 12;
}

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function calendarHorizon(asOf, years) {
  const end = new Date(asOf);
  const targetYear = end.getUTCFullYear() + years;
  if (end.getUTCMonth() === 1 && end.getUTCDate() === 29) {
    const leap = targetYear % 4 === 0 && (targetYear % 100 !== 0 || targetYear % 400 === 0);
    if (!leap) end.setUTCDate(28);
  }
  end.setUTCFullYear(targetYear);
  return end.getTime();
}

function chartPart(value, label) {
  const longitude = value?.ascendant?.longitude;
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360 || !Array.isArray(value?.planets)) {
    throw badRequest(`A calculated ${label} chart with an ascendant and planetary positions is required.`);
  }
  if (value.ascendant.signIndex !== undefined && !validSign(value.ascendant.signIndex)) {
    throw badRequest(`The calculated ${label} ascendant sign index must be between 0 and 11.`);
  }
  const signIndex = validSign(value.ascendant.signIndex) ? value.ascendant.signIndex : Math.floor(longitude / 30);
  if (signIndex !== Math.floor(longitude / 30)) throw badRequest(`The ${label} ascendant sign and longitude are inconsistent.`);
  const planets = new Map();
  for (const planet of value.planets) {
    if (!GRAHAS.includes(planet?.name) || planets.has(planet.name)
      || !validSign(planet.signIndex) || !Number.isFinite(planet.longitude)
      || planet.longitude < 0 || planet.longitude >= 360 || Math.floor(planet.longitude / 30) !== planet.signIndex) {
      throw badRequest(`The calculated ${label} chart must contain consistent, unique graha positions.`);
    }
    const house = (planet.signIndex - signIndex + 12) % 12 + 1;
    if (planet.house !== house) throw badRequest(`The ${label} graha houses must use the calculated whole sign ascendant.`);
    planets.set(planet.name, { name: planet.name, signIndex: planet.signIndex, house });
  }
  if (GRAHAS.some((name) => !planets.has(name))) {
    throw badRequest(`The calculated ${label} chart must include all nine grahas, including mean Rahu and Ketu.`);
  }
  return { signIndex, planets };
}

function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) {
    throw badRequest('Calculated Vimshottari boundaries must be UTC ISO timestamps.');
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || dateOnly(timestamp) !== value.slice(0, 10)) {
    throw badRequest('Calculated Vimshottari boundaries must be real calendar instants.');
  }
  return timestamp;
}

function periodInterval(period, label) {
  if (!GRAHAS.includes(period?.lord)) throw badRequest(`A valid calculated ${label} lord is required.`);
  const start = instant(period.start);
  const end = instant(period.end);
  if (end <= start) throw badRequest(`Calculated ${label} boundaries must be ordered.`);
  return { lord: period.lord, start, end };
}

function timeline(chart) {
  if (!Array.isArray(chart?.dasha?.periods) || !chart.dasha.periods.length) {
    throw badRequest('A calculated Vimshottari mahadasha and antardasha timeline is required.');
  }
  const periods = [];
  let previousEnd = -Infinity;
  for (const rawMaha of chart.dasha.periods) {
    const maha = periodInterval(rawMaha, 'mahadasha');
    if (maha.start < previousEnd || !Array.isArray(rawMaha.antardashas) || !rawMaha.antardashas.length) {
      throw badRequest('Calculated mahadashas must be ordered without overlap and include antardashas.');
    }
    let previousSubEnd = maha.start;
    for (const rawAntar of rawMaha.antardashas) {
      const antar = periodInterval(rawAntar, 'antardasha');
      if (antar.start < previousSubEnd || antar.start < maha.start || antar.end > maha.end) {
        throw badRequest('Calculated antardashas must be ordered within their mahadasha without overlap.');
      }
      periods.push({ maha, antar });
      previousSubEnd = antar.end;
    }
    previousEnd = maha.end;
  }
  return periods;
}

function describePlacement(planet, label = 'D1') {
  return `${planet.name} is in ${label} house ${planet.house}, ${RASHIS[planet.signIndex]}.`;
}

function houseFacts(part, houses, label, houseThemes = {}) {
  const facts = [];
  const roles = new Map();
  for (const house of houses) {
    const sign = (part.signIndex + house - 1) % 12;
    const ruler = RULERS[sign];
    const planet = part.planets.get(ruler);
    facts.push(`${label} house ${house} (${houseThemes[house] || 'partnership context'}) is ${RASHIS[sign]}, ruled by ${ruler}; ${ruler} occupies ${label} house ${planet.house}.`);
    const rulerRoles = roles.get(ruler) || [];
    rulerRoles.push({ label, house, role: 'rules' });
    roles.set(ruler, rulerRoles);
    const occupants = [...part.planets.values()].filter((occupant) => occupant.house === house);
    if (occupants.length) facts.push(`${label} house ${house} contains ${occupants.map((occupant) => occupant.name).join(', ')}.`);
    for (const occupant of occupants) {
      const occupantRoles = roles.get(occupant.name) || [];
      occupantRoles.push({ label, house, role: 'occupies' });
      roles.set(occupant.name, occupantRoles);
    }
  }
  return { facts, roles };
}

function roleReasons(name, roles, significators, context) {
  const reasons = (roles.get(name) || []).map(({ label, house, role }) => `${name}, the ${context} lord, ${role} ${label} house ${house}.`);
  if (significators.includes(name)) reasons.push(`${name}, the ${context} lord, is a traditional significator used for this topic.`);
  return reasons;
}

/**
 * Explain life-area themes from computed placements and real dasha intervals.
 * Windows are periods of traditional interpretation, never event forecasts.
 */
export function analyzeLifeArea(profile, chart, topic, { asOf = new Date(), horizonYears = 3 } = {}) {
  if (typeof topic !== 'string' || !Object.hasOwn(TOPICS, topic)) throw badRequest('Choose married-life, general, education, finances, family, travel, or wellbeing.');
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) throw badRequest('The interpretation date must be valid.');
  if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 10) throw badRequest('The life-area horizon must be 1–10 calendar years.');
  if (!validateBirthDetails(profile, { today: asOf })) {
    throw badRequest('Life-area readings require birth date, birth time, birth place, coordinates, and the historical time zone.');
  }
  const end = calendarHorizon(asOf, horizonYears);
  if (asOf.getUTCFullYear() < 1900 || new Date(end).getUTCFullYear() > 2100) {
    throw badRequest('Life-area readings support dates between 1900 and 2100. Choose a shorter horizon.');
  }
  const now = asOf.getTime();
  const definition = TOPICS[topic];
  const d1 = chartPart(chart, 'D1');
  const periods = timeline(chart);
  const { facts: factors, roles } = houseFacts(d1, definition.houses, 'D1', definition.houseThemes);
  factors.unshift(`The D1 ascendant is ${RASHIS[d1.signIndex]}; houses use the whole sign system.`);
  for (const name of definition.significators) factors.push(describePlacement(d1.planets.get(name)));
  const limitations = [
    'These are traditional astrological period themes, not scientifically established predictions of events or outcomes.',
    'Dasha dates describe interpretive periods. They do not identify the day an event will occur.',
  ];
  const method = [
    'Use the supplied calculated D1 whole sign houses, their conventional rashi rulers, and actual occupants.',
    topic === 'general'
      ? 'Describe the active and next Vimshottari mahadasha/antardasha lords and their actual natal placements.'
      : `Select periods whose mahadasha or antardasha lord rules or occupies topic houses ${definition.houses.join(', ')}${definition.significators.length ? `, or is the stated traditional significator ${definition.significators.join(' or ')}` : ''}.`,
    'Show at most three periods in chronological order, clipped to the current instant and requested calendar-year horizon; displayed end days are inclusive.',
  ];
  if (topic === 'married-life') {
    if (chart.navamsa) {
      const d9 = chartPart(chart.navamsa, 'D9 Navamsa');
      const d9Context = houseFacts(d9, [7], 'D9', { 7: 'partnership context' });
      factors.push(`The D9 Navamsa ascendant is ${RASHIS[d9.signIndex]}.`, ...d9Context.facts, describePlacement(d9.planets.get('Venus'), 'D9'));
      method.push('Use the supplied D9 seventh house and Venus as additional relationship context; D9 placements do not select or rank these D1-linked periods.');
      limitations.push('D9 is especially sensitive to birth time. Its placements cannot establish marital success, divorce, or a partner’s behaviour.');
    } else {
      limitations.push('D9 Navamsa context is unavailable in this chart; this relationship reading uses D1 and the supplied dasha timeline.');
    }
    limitations.push('Relationship quality depends on communication, consent, and lived circumstances; these themes cannot decide another person’s intentions.');
  }
  if (topic === 'finances') limitations.push('Financial decisions need reliable information about your circumstances; these themes cannot establish returns or lucky wins.');
  if (topic === 'wellbeing') limitations.push('Wellbeing themes concern routines and rest. Health assessment and treatment require clinical evidence and qualified care.');
  const active = periods.find(({ antar }) => antar.start <= now && now < antar.end);
  if (active) {
    factors.push(`Current Vimshottari period: ${active.maha.lord} mahadasha / ${active.antar.lord} antardasha (${dateOnly(active.antar.start)}–${dateOnly(active.antar.end - 1)}).`);
    for (const name of new Set([active.maha.lord, active.antar.lord])) factors.push(describePlacement(d1.planets.get(name)));
  } else {
    limitations.push('The supplied timeline does not include an antardasha active at the interpretation date.');
  }
  const windows = [];
  for (const { maha, antar } of periods) {
    const start = Math.max(now, maha.start, antar.start);
    const finish = Math.min(end, maha.end, antar.end);
    if (finish <= start) continue;
    const links = [
      ...roleReasons(maha.lord, roles, definition.significators, 'mahadasha'),
      ...roleReasons(antar.lord, roles, definition.significators, 'antardasha'),
    ];
    if (topic !== 'general' && !links.length) continue;
    windows.push({
      start: dateOnly(start), end: dateOnly(finish - 1),
      label: `${maha.lord} / ${antar.lord} period themes`,
      reasons: [
        `Calculated Vimshottari period: ${maha.lord} mahadasha / ${antar.lord} antardasha.`,
        ...links,
        describePlacement(d1.planets.get(antar.lord)),
      ],
      themes: [...new Set([GRAHA_THEMES[maha.lord], GRAHA_THEMES[antar.lord], ...definition.themes])],
    });
    if (windows.length === 3) break;
  }
  if (!windows.length) limitations.push('No matching antardasha period was found within this horizon. This does not establish whether a life event will happen.');
  limitations.push(...(Array.isArray(chart.limits) ? chart.limits : []), ...(Array.isArray(chart.calculation?.warnings) ? chart.calculation.warnings : []));
  return {
    topic, status: 'interpreted', asOf: dateOnly(asOf), horizonEnd: dateOnly(end), windows,
    factors: [...new Set(factors)],
    themes: [...new Set([...definition.themes, ...(active ? [GRAHA_THEMES[active.maha.lord], GRAHA_THEMES[active.antar.lord]] : [])])],
    method, limitations: [...new Set(limitations)],
  };
}
