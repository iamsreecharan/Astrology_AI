/**
 * Calendar-based Western sun signs and curated readings for reflection.
 * Date-only profiles cannot supply a natal chart or support event predictions.
 * These local readings do not come from a language model.
 */
import { validateBirthDetails } from './vedic-chart.mjs';

export const SIGNS = Object.freeze([
  { id: 'aries', name: 'Aries', symbol: '♈', element: 'Fire', modality: 'Cardinal', dates: 'Mar 21 – Apr 19', traits: ['Brave', 'Energetic', 'Direct'], description: 'Aries invites you to begin with courage, then give your enthusiasm a clear direction.' },
  { id: 'taurus', name: 'Taurus', symbol: '♉', element: 'Earth', modality: 'Fixed', dates: 'Apr 20 – May 20', traits: ['Grounded', 'Patient', 'Devoted'], description: 'Taurus invites you to build trust through steady care and enjoy the small comforts along the way.' },
  { id: 'gemini', name: 'Gemini', symbol: '♊', element: 'Air', modality: 'Mutable', dates: 'May 21 – Jun 20', traits: ['Curious', 'Adaptable', 'Expressive'], description: 'Gemini invites you to follow your curiosity, exchange ideas, and listen as closely as you speak.' },
  { id: 'cancer', name: 'Cancer', symbol: '♋', element: 'Water', modality: 'Cardinal', dates: 'Jun 21 – Jul 22', traits: ['Caring', 'Intuitive', 'Protective'], description: 'Cancer invites you to care for your inner world while letting trusted people share the work of caring.' },
  { id: 'leo', name: 'Leo', symbol: '♌', element: 'Fire', modality: 'Fixed', dates: 'Jul 23 – Aug 22', traits: ['Warm', 'Creative', 'Generous'], description: 'Leo invites you to express yourself with warmth and make space for other people to shine too.' },
  { id: 'virgo', name: 'Virgo', symbol: '♍', element: 'Earth', modality: 'Mutable', dates: 'Aug 23 – Sep 22', traits: ['Thoughtful', 'Observant', 'Practical'], description: 'Virgo invites you to turn careful observation into useful action without demanding perfection from yourself.' },
  { id: 'libra', name: 'Libra', symbol: '♎', element: 'Air', modality: 'Cardinal', dates: 'Sep 23 – Oct 22', traits: ['Diplomatic', 'Social', 'Balanced'], description: 'Libra invites you to seek connection and fairness while giving your own needs a voice.' },
  { id: 'scorpio', name: 'Scorpio', symbol: '♏', element: 'Water', modality: 'Fixed', dates: 'Oct 23 – Nov 21', traits: ['Focused', 'Loyal', 'Reflective'], description: 'Scorpio invites you to explore what matters deeply, with openness and respect for your boundaries.' },
  { id: 'sagittarius', name: 'Sagittarius', symbol: '♐', element: 'Fire', modality: 'Mutable', dates: 'Nov 22 – Dec 21', traits: ['Adventurous', 'Optimistic', 'Candid'], description: 'Sagittarius invites you to look beyond the familiar and turn an inspiring idea into a grounded step.' },
  { id: 'capricorn', name: 'Capricorn', symbol: '♑', element: 'Earth', modality: 'Cardinal', dates: 'Dec 22 – Jan 19', traits: ['Steady', 'Responsible', 'Ambitious'], description: 'Capricorn invites you to make patient progress and measure success in a way that leaves room for rest.' },
  { id: 'aquarius', name: 'Aquarius', symbol: '♒', element: 'Air', modality: 'Fixed', dates: 'Jan 20 – Feb 18', traits: ['Independent', 'Inventive', 'Community-minded'], description: 'Aquarius invites you to bring a fresh perspective while staying connected to the people behind an idea.' },
  { id: 'pisces', name: 'Pisces', symbol: '♓', element: 'Water', modality: 'Mutable', dates: 'Feb 19 – Mar 20', traits: ['Imaginative', 'Compassionate', 'Sensitive'], description: 'Pisces invites you to make space for imagination and feeling, supported by gentle, practical boundaries.' },
].map((sign) => Object.freeze({ ...sign, traits: Object.freeze(sign.traits) })));

const SIGN_MAP = new Map(SIGNS.map((sign) => [sign.id, sign]));
const FOCUSES = ['general', 'love', 'career', 'wellbeing'];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseDate(value, label = 'Date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`${label} must use YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  // Date.UTC special-cases years 0–99, so set the year explicitly.
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(0, 0, 0, 0);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw badRequest(`${label} must be a real calendar date.`);
  }
  return { year, month, day, parsed };
}

function resolveSign(value) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : value?.id;
  const sign = SIGN_MAP.get(id);
  if (!sign) throw badRequest('Choose one of the twelve zodiac signs.');
  return sign;
}

function resolveFocus(focus) {
  if (!FOCUSES.includes(focus)) throw badRequest('Focus must be general, love, career, or wellbeing.');
  return focus;
}

function profileSign(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw badRequest('A profile is required.');
  return profile.sign ? resolveSign(profile.sign) : getSign(profile.birthDate);
}

export function getSign(birthDate) {
  const { month, day } = parseDate(birthDate, 'Birth date');
  const calendarDay = month * 100 + day;
  if (calendarDay >= 321 && calendarDay <= 419) return SIGN_MAP.get('aries');
  if (calendarDay >= 420 && calendarDay <= 520) return SIGN_MAP.get('taurus');
  if (calendarDay >= 521 && calendarDay <= 620) return SIGN_MAP.get('gemini');
  if (calendarDay >= 621 && calendarDay <= 722) return SIGN_MAP.get('cancer');
  if (calendarDay >= 723 && calendarDay <= 822) return SIGN_MAP.get('leo');
  if (calendarDay >= 823 && calendarDay <= 922) return SIGN_MAP.get('virgo');
  if (calendarDay >= 923 && calendarDay <= 1022) return SIGN_MAP.get('libra');
  if (calendarDay >= 1023 && calendarDay <= 1121) return SIGN_MAP.get('scorpio');
  if (calendarDay >= 1122 && calendarDay <= 1221) return SIGN_MAP.get('sagittarius');
  if (calendarDay >= 1222 || calendarDay <= 119) return SIGN_MAP.get('capricorn');
  if (calendarDay >= 120 && calendarDay <= 218) return SIGN_MAP.get('aquarius');
  return SIGN_MAP.get('pisces');
}

export function validateProfile(input, { today = new Date() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('Please provide your name and birth date.');
  if (typeof input.name !== 'string') throw badRequest('Name must be text.');
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw badRequest('Name must contain 1–60 characters without control characters.');
  }
  const { year, parsed } = parseDate(input.birthDate, 'Birth date');
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) throw badRequest('The current date is invalid.');
  const todayStart = new Date(today);
  todayStart.setUTCHours(0, 0, 0, 0);
  if (year < 1900 || parsed > todayStart) throw badRequest('Birth date must be between 1900 and today.');
  const birthDetails = validateBirthDetails(input, { today });
  return { name, birthDate: input.birthDate, sign: getSign(input.birthDate), ...(birthDetails || {}) };
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function pick(items, seed, offset = 0) {
  return items[hash(`${seed}:${offset}`) % items.length];
}

const ELEMENT_GUIDANCE = {
  Fire: 'Let your enthusiasm point to a manageable first step. A pause can help you choose where your energy goes.',
  Earth: 'Let steady effort be enough. A small, useful action can offer more clarity than trying to resolve everything at once.',
  Air: 'Give your ideas somewhere to land. Writing one thought down or asking a clear question can make room for perspective.',
  Water: 'Notice what you feel without needing to solve it immediately. Pair reflection with one small act of practical care.',
};

const FOCUS_CONTENT = {
  general: {
    intention: 'Notice what deserves your attention',
    intros: ['Make a little space between your first impulse and your next choice.', 'Choose one thing you can influence, and let that be your starting point.', 'A useful shift may begin with an honest check-in about what you need.'],
    sections: [
      { label: 'Your energy', texts: ['Start with a task that feels manageable, then reassess your capacity before adding more.', 'Check whether your pace matches your energy. A shorter list can help you follow through.', 'Take a quiet moment to name your priority. Giving it a clear boundary can protect your attention.'] },
      { label: 'Connections', texts: ['Ask someone how they are doing, and leave enough room to hear the answer.', 'Share one specific need or appreciation with a person you trust.', 'You can be caring and clear at the same time. Choose words that leave room for both.'] },
      { label: 'A small next step', texts: ['Choose one unfinished task and give it ten focused minutes.', 'Write down what is within your control, then select one action from that list.', 'Clear a little space in your schedule or surroundings for something that matters to you.'] },
    ],
  },
  love: {
    intention: 'Let connection begin with curiosity',
    intros: ['Connection grows through attention, consent, and honest conversation.', 'Treat your feelings as information, and give the other person room to share theirs.', 'Small, sincere gestures can help you express care without assuming how someone feels.'],
    sections: [
      { label: 'Connection', texts: ['Ask an open question instead of guessing what another person needs.', 'Offer an appreciation tied to something specific you noticed.', 'Choose a relaxed moment to check in about how you each like to receive care.'] },
      { label: 'Your boundaries', texts: ['Name what feels comfortable for you. Healthy connection leaves room for a clear yes and a clear no.', 'Consider whether you are agreeing from enthusiasm or pressure. You are allowed to take time.', 'Speak about your experience using “I” statements, and listen without trying to win the conversation.'] },
      { label: 'Try today', texts: ['Invite someone to a simple, pressure-free conversation or shared activity.', 'Write down one relationship need you can communicate clearly.', 'Give yourself the same patience and care you would offer a close friend.'] },
    ],
  },
  career: {
    intention: 'Turn a good intention into a clear step',
    intros: ['Progress becomes easier to see when you give it a specific shape.', 'Consider what useful progress would look like with the time and resources you actually have.', 'Let practical information guide your decisions, and use this reading as a prompt for reflection.'],
    sections: [
      { label: 'Your direction', texts: ['Define one concrete outcome for your next work session, and stop to review it afterward.', 'Separate the urgent from the useful. Choose one task connected to a goal you care about.', 'Ask what information you need before making a commitment, and seek it from a reliable source.'] },
      { label: 'Working together', texts: ['A clear request can be more useful than extra effort. State the context, the need, and the deadline.', 'Invite feedback on a small draft before investing in a bigger version.', 'Notice a contribution from someone around you and acknowledge it specifically.'] },
      { label: 'Try today', texts: ['Break one project into a next action that takes less than twenty minutes.', 'Reserve a short block for focused work and silence one avoidable distraction.', 'Document a decision or useful lesson so your future self can find it.'] },
    ],
  },
  wellbeing: {
    intention: 'Make room for a gentler pace',
    intros: ['Use this moment to notice your needs without turning rest into another performance.', 'A small, accessible act of care can fit into the day you already have.', 'Your capacity can change from day to day. Let your plans make room for that.'],
    sections: [
      { label: 'Check in', texts: ['Notice your posture, energy, and surroundings. Adjust one thing that would make the next hour more comfortable.', 'Ask yourself what feels supportive right now, rather than what you think you should be doing.', 'Pause for a few comfortable breaths, without forcing a particular pace.'] },
      { label: 'Give yourself room', texts: ['Consider one commitment you could simplify. Making room for rest is a practical choice.', 'Let one task be good enough today, and notice the space that creates.', 'If reflection brings up something difficult, reach out to a trusted person or qualified professional for support.'] },
      { label: 'Try today', texts: ['Step away from a screen briefly and notice something in your surroundings.', 'Set aside five minutes for an activity you find calming or enjoyable.', 'Create a simple end-of-day cue that helps you leave one unfinished task for tomorrow.'] },
    ],
  },
};

const AFFIRMATIONS = ['I can take one clear step at a time.', 'My needs deserve thoughtful attention.', 'I can stay curious without having every answer.', 'I am allowed to adjust my pace.', 'I can be both kind and clear.', 'Small acts of care count.'];
const RITUALS = ['Write down one thing to keep, one thing to release, and one next step.', 'Spend two quiet minutes noticing your surroundings, then choose an intention for the day.', 'Put a small reminder of your priority where you will see it.', 'Take a brief screen break and name three things you appreciate in this moment.', 'Write a sentence beginning “Today, I can make room for…” and choose a practical way to do it.'];
const COLORS = ['Sage', 'Amber', 'Indigo', 'Terracotta', 'Rose', 'Ocean blue', 'Lavender', 'Gold', 'Forest green', 'Pearl'];

export function buildReading(profile, { date = new Date().toISOString().slice(0, 10), focus = 'general' } = {}) {
  const sign = profileSign(profile);
  parseDate(date, 'Reading date');
  resolveFocus(focus);
  const seed = `${date}:${sign.id}:${focus}`;
  const content = FOCUS_CONTENT[focus];
  return {
    date,
    focus,
    headline: `${sign.name}: ${content.intention.toLowerCase()}`,
    overview: `${pick(content.intros, seed)} ${ELEMENT_GUIDANCE[sign.element]}`,
    sections: content.sections.map(({ label, texts }, index) => ({ label, text: pick(texts, seed, index + 1) })),
    affirmation: pick(AFFIRMATIONS, seed, 4),
    ritual: pick(RITUALS, seed, 5),
    lucky: { color: pick(COLORS, seed, 6), number: (hash(`${seed}:number`) % 99) + 1 },
    source: 'local',
  };
}

const ELEMENT_PAIR_CONTENT = {
  same: {
    summary: 'A shared element offers a useful prompt to notice familiar preferences. Similarity can support understanding, while differences still deserve attention.',
    strengths: ['Recognizing a familiar pace or way of expressing yourself', 'Finding shared language for what feels important'],
    challenges: ['Making room for needs that differ despite the shared theme', 'Noticing when a familiar habit needs a fresh approach'],
  },
  complementary: {
    summary: 'These elements are traditionally paired as complementary. Use that idea to explore how you support each other, while remembering that real connection depends on your actions and communication.',
    strengths: ['Offering different perspectives that can support a shared goal', 'Balancing encouragement with thoughtful listening'],
    challenges: ['Checking whether the support you offer is the support wanted', 'Giving each person room to set their own pace'],
  },
  different: {
    summary: 'Different elements can be a prompt to get curious about how each of you approaches life. A zodiac pairing cannot measure or decide the quality of a relationship.',
    strengths: ['Learning a new way to approach a familiar situation', 'Expanding your understanding through honest curiosity'],
    challenges: ['Avoiding assumptions about what the other person means', 'Agreeing on a pace and boundaries that work for both people'],
  },
};

export function buildCompatibility(signA, signB) {
  const first = resolveSign(signA);
  const second = resolveSign(signB);
  const pair = [first, second].sort((a, b) => a.id.localeCompare(b.id));
  const elements = pair.map((sign) => sign.element).sort().join(':');
  const category = first.element === second.element ? 'same' : ['Air:Fire', 'Earth:Water'].includes(elements) ? 'complementary' : 'different';
  const content = ELEMENT_PAIR_CONTENT[category];
  const seed = pair.map((sign) => sign.id).join(':');
  return {
    signA: first,
    signB: second,
    headline: `${pair[0].name} & ${pair[1].name}: room to understand each other`,
    summary: content.summary,
    strengths: [...content.strengths],
    challenges: [...content.challenges],
    conversationStarter: pick(['What helps you feel understood when we see something differently?', 'What is one small thing we could do to make time together feel more thoughtful?', 'How do you like to ask for space or support?', 'What does a comfortable balance of togetherness and independence look like for you?'], seed),
  };
}

export function buildLocalReply(profile, { message, focus = 'general' } = {}) {
  const sign = profileSign(profile);
  resolveFocus(focus);
  if (typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) {
    throw badRequest('Please enter a message between 1 and 2,000 characters.');
  }
  const input = message.trim().toLowerCase();
  const framing = `This is a local reflection guide, not an AI-generated response. Using ${sign.name} as a reflection prompt: `;
  if (/\b(suicid\w*|self[- ]?harm|kill myself|end my life|hurt myself)\b/.test(input)) {
    return `${framing}your safety deserves immediate, human support. If you might act on these feelings or are in immediate danger, contact local emergency services now. In the U.S. or Canada, call or text 988; elsewhere, find a local crisis service at findahelpline.com. If you can, contact a trusted person and let them stay with you while you get support. Astrology cannot help assess an emergency.`;
  }
  // "Cancer" can mean the sign or the illness. Clear health or treatment
  // language takes precedence, even when the question also mentions the sign.
  const cancerSignQuestion = /\bcancer\s+(?:(?:zodiac|sun|star)\s+)?(?:sign|traits?|horoscope|compatibility)\b|\b(?:zodiac|sun|star)\s+sign(?:\s+of|\s+is)?\s+cancer\b|\b(?:tell me|what can you tell me|learn more|information|facts)\s+about\s+cancer(?:\s*[?!.]|\s*$)|\b(?:i am|i'm|my partner is|my friend is)\s+a\s+cancer\b/.test(input);
  const cancerIllnessContext = /\b(?:have|has|had|get|got|develop\w*|surviv\w*|cure\w*)\s+(?:\w+\s+){0,2}cancer\b|\bcancer\s+(?:patients?|survivors?|diagnosis|screening|follow[- ]?up|care|caregivers?|risk|history)\b/.test(input);
  const medicalQuestion = /\b(medical|medicine|medication|diagnos\w*|pregnan\w*|symptom\w*|illness|disease|health|treat\w*|chemotherap\w*|oncolog\w*|tumou?r\w*)\b/.test(input)
    || cancerIllnessContext
    || (/\bcancer\b/.test(input) && !cancerSignQuestion);
  if (medicalQuestion) {
    return `${framing}a zodiac sign cannot diagnose a condition or guide treatment. For health concerns, speak with a qualified health professional. You might write down what you are noticing and the questions you want to ask; that can make a conversation easier. For reflection, consider what support would help you feel more prepared.`;
  }
  if (/\b(invest\w*|stock\w*|crypto\w*|financial|money|gambl\w*|lottery|bet(?:s|ting|tors?)?)\b/.test(input)) {
    return `${framing}a reading cannot predict financial outcomes or lucky wins. Base financial decisions on reliable information, your circumstances, and qualified advice where appropriate. ${ELEMENT_GUIDANCE[sign.element]} A useful question is: what information or boundary would help me make a considered choice?`;
  }
  if (cancerSignQuestion) {
    const cancer = SIGN_MAP.get('cancer');
    return `${framing}Cancer (${cancer.dates}) is traditionally a ${cancer.element.toLowerCase()} sign, associated with ${cancer.traits.map((trait) => trait.toLowerCase()).join(', ')} themes. ${cancer.description} These are cultural reflection prompts, not fixed personality facts. What kind of care or connection feels most meaningful to you right now?`;
  }
  let reflection;
  if (/\b(love|relationship\w*|partner|dating|marri\w*|breakup|ex|crush|communicat(?:e|es|ed|ing|ion|ions))\b/.test(input) || focus === 'love') {
    reflection = 'A sign cannot tell you how someone feels or decide whether a relationship will work. Consider what you have observed, what you need, and what you could ask directly. What would a respectful conversation about that need sound like?';
  } else if (/\b(work|career|job|boss|study|exam|school|business)\b/.test(input) || focus === 'career') {
    reflection = 'For the decision you are considering, separate what you know from what you still need to learn. Choose one practical next step, such as clarifying expectations or getting feedback. What is the smallest action that would give you useful information?';
  } else if (/\b(stress\w*|anxious|anxiety|overwhelm\w*|tired|sad|rest|burnout)\b/.test(input) || focus === 'wellbeing') {
    reflection = 'Notice what feels demanding and what kind of support is available. You can simplify one task, take a brief comfortable pause, or talk to someone you trust. If these feelings persist or interfere with daily life, a qualified professional can offer support. What would make the next hour a little easier?';
  } else if (/\b(predict\w*|future|destiny|fate|when|will i)\b/.test(input)) {
    reflection = 'A calendar-based sign cannot predict events or determine your future. You can use the question as a prompt to name what you hope for and what you can influence. What is one choice you could make toward that hope?';
  } else {
    reflection = 'Try naming the part of your question that matters most, then separate what you can influence from what you cannot control. A small next step can make the situation clearer. What would useful progress look like today?';
  }
  return `${framing}${ELEMENT_GUIDANCE[sign.element]} ${reflection}`;
}
