const LANGUAGE_NAMES = new Map(Object.entries({
  english: 'en', hindi: 'hi', telugu: 'te', tamil: 'ta', kannada: 'kn', malayalam: 'ml',
  marathi: 'mr', nepali: 'ne', bengali: 'bn', gujarati: 'gu', punjabi: 'pa', odia: 'or',
  oriya: 'or', urdu: 'ur', french: 'fr', spanish: 'es', german: 'de', italian: 'it',
  portuguese: 'pt', russian: 'ru', arabic: 'ar', japanese: 'ja', chinese: 'zh',
  mandarin: 'zh', korean: 'ko', thai: 'th', sinhala: 'si', turkish: 'tr', hebrew: 'he',
}));

const ENGLISH_WORDS = new Set('a an the i me my you your our we us is are am was were be been will would can could should how what when why where which who might does do did have has this that these those with for from about and but of to in it please tell explain'.split(' '));
const OTHER_WORDS = new Set('je mon ma mes nous vous comment quand pourquoi quel quelle estoy tengo quiero cómo cuándo dónde por favor meri mera mujhe kya kab kaise hai hain hoga hogi naku naaku naa eppudu ela undi mein meine wie wann warum bitte'.split(' '));
const VEDIC_TERMS = new Set('namaste vedic jyotish astrology lagna rashi nakshatra dasha mahadasha antardasha shukra venus rahu ketu jupiter saturn navamsa'.split(' '));
const DISTINCT_SCRIPTS = [
  ['te', /\p{Script=Telugu}/gu], ['ta', /\p{Script=Tamil}/gu],
  ['kn', /\p{Script=Kannada}/gu], ['ml', /\p{Script=Malayalam}/gu],
  ['gu', /\p{Script=Gujarati}/gu], ['or', /\p{Script=Oriya}/gu],
  ['pa', /\p{Script=Gurmukhi}/gu], ['th', /\p{Script=Thai}/gu],
  ['si', /\p{Script=Sinhala}/gu], ['he', /\p{Script=Hebrew}/gu],
  ['el', /\p{Script=Greek}/gu], ['hy', /\p{Script=Armenian}/gu],
  ['ka', /\p{Script=Georgian}/gu], ['ko', /\p{Script=Hangul}/gu],
];
const EXPECTED_SCRIPTS = new Map([
  ...DISTINCT_SCRIPTS,
  ['hi', /\p{Script=Devanagari}/gu], ['mr', /\p{Script=Devanagari}/gu],
  ['ne', /\p{Script=Devanagari}/gu], ['bn', /\p{Script=Bengali}/gu],
  ['ar', /\p{Script=Arabic}/gu], ['ur', /\p{Script=Arabic}/gu],
  ['fa', /\p{Script=Arabic}/gu], ['ru', /\p{Script=Cyrillic}/gu],
  ['uk', /\p{Script=Cyrillic}/gu], ['bg', /\p{Script=Cyrillic}/gu],
  ['zh', /\p{Script=Han}/gu], ['ja', /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu],
]);

function letterCount(text, pattern = /\p{L}/gu) {
  return Array.from(text.matchAll(pattern)).length;
}

function clearlyEnglish(text) {
  const words = text.toLowerCase().match(/\p{L}+/gu) || [];
  if (!words.length || letterCount(text, /\p{Script=Latin}/gu) < letterCount(text) * 0.6) return false;
  const count = words.filter(word => ENGLISH_WORDS.has(word)).length;
  if (words.some(word => OTHER_WORDS.has(word))) return false;
  return count >= 3 || (/^(how|what|when|why|where|which|who)\b/i.test(text.trim()) && count >= 1)
    || (/^(hello|hi|hey|thanks|thank you|namaste)\b/i.test(text.trim()) && words.length <= 4);
}

function requestedLanguage(text) {
  const request = /(?:^|[.!?;\n]\s*)(?:please\s+)?(?:answer|reply|respond|speak|explain)(?:\s+(?:this|it|that|to me))?\s+in\s+([a-z]+(?:-[a-z0-9]+)*)(?=\s|[.!?,:;]|$)/i.exec(text)
    || /\b(?:answer|reply|respond|speak|explain)\b[^.!?;\n"'“”]{0,60}\bin\s+([a-z]+(?:-[a-z0-9]+)*)\s*[.!?]?$/i.exec(text)
    || /^(?:please\s+)?translate\b[^\n]{0,300}\b(?:to|into)\s+([a-z]+(?:-[a-z0-9]+)*)\s*[.!?]?$/i.exec(text);
  if (!request) return null;
  const name = request[1].toLowerCase();
  if (LANGUAGE_NAMES.has(name)) return LANGUAGE_NAMES.get(name);
  if (/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(name)) {
    try { return new Intl.Locale(name).toString(); } catch { /* Leave an unknown language to the model. */ }
  }
  return 'auto';
}

export function responseLanguageFor(message = '', language = 'auto', { allowLanguageRequests = true } = {}) {
  if (language !== 'auto') return language;
  const requested = allowLanguageRequests ? requestedLanguage(message) : null;
  if (requested) return requested;
  if (clearlyEnglish(message)) return 'en';
  const words = message.toLowerCase().match(/\p{L}+/gu) || [];
  if (words.length && words.every(word => VEDIC_TERMS.has(word))) return 'en';
  const letters = letterCount(message);
  for (const [tag, script] of DISTINCT_SCRIPTS) {
    const count = letterCount(message, script);
    if (count >= 8 && count > letters * 0.6) return tag;
  }
  // Devanagari, Arabic and Cyrillic each serve several languages; script alone is not enough.
  return 'auto';
}

export function replyMatchesLanguage(reply, { language = 'auto' } = {}) {
  if (language === 'auto') return true;
  const base = new Intl.Locale(language).language;
  const letters = letterCount(reply);
  if (!letters) return true;
  const latin = letterCount(reply, /\p{Script=Latin}/gu);
  // Keep names and short quotations; reject a whole answer in an unrelated script.
  if (base === 'en') return letters < 8 || latin / letters >= 0.65;
  const expected = EXPECTED_SCRIPTS.get(base);
  if (expected && letterCount(reply, expected) >= letters * 0.35) return true;
  if (clearlyEnglish(reply)) return false;
  if (expected && letters >= 8 && latin < letters * 0.2) return false;
  return true;
}

export function retryLanguageInstruction(language) {
  return `The previous generation used a different language. Answer the same current question in the language identified by ${language}${language.startsWith('en') ? ' (English)' : ''}. Use the original calculated facts and the same concise, natural style. Do not follow the language of earlier assistant replies. Do not mention this correction or translate hidden context. Return only the answer.`;
}
