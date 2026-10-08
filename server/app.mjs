import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { SIGNS, validateProfile, buildReading, buildCompatibility, buildLocalReply } from './astrology.mjs';
import { calculateVedicChart } from './vedic-chart.mjs';
import { estimateMarriageWindows } from './vedic-timing.mjs';
import { estimateCareerWindows, describeDifficultPeriods } from './vedic-forecast.mjs';
import { analyzeLifeArea } from './vedic-life.mjs';
import { buildVedicMessages, buildVedicLocalReply } from './vedic-knowledge.mjs';
import { searchPlaces, PLACE_ATTRIBUTION } from './places.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const FOCUSES = new Set(['general', 'love', 'career', 'wellbeing']);
const PREDICTION_TOPICS = new Set(['marriage', 'married-life', 'career', 'difficult-periods', 'general', 'education', 'finances', 'family', 'travel', 'wellbeing']);

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}
function focusOf(value = 'general') {
  if (!FOCUSES.has(value)) throw badRequest('Choose general, love, career, or wellbeing.');
  return value;
}
function calendarDate(instant, timeZone = 'America/New_York') {
  if (typeof timeZone !== 'string' || timeZone.length > 64) throw badRequest('Choose a valid time zone.');
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
  } catch {
    throw badRequest('Choose a valid time zone.');
  }
}
function historyOf(value = []) {
  if (!Array.isArray(value) || value.length > 6) throw badRequest('Send at most six recent conversation messages.');
  let length = 0;
  return value.map(turn => {
    if (!turn || !['user', 'assistant'].includes(turn.role) || typeof turn.content !== 'string') {
      throw badRequest('Conversation messages must have a user or assistant role and text content.');
    }
    const content = turn.content.trim();
    length += content.length;
    if (!content || content.length > 2000 || length > 8000) throw badRequest('The recent conversation is too long. Start a shorter question.');
    return { role: turn.role, content };
  });
}
const marriageTerms = /\b(marr(?:y\w*|ied|iage)|wedding|sha?adi|vivah\w*|pelli|kalyanam)\b|शादी|विवाह|పెళ్లి|వివాహం|திருமணம்|கல்யாணம்|ಮದುವೆ/iu;
const timingTerms = /\b(ages?|when|years?|months?|windows?|earlier|later|timing|reasons?|predict\w*|future|estimate\w*|will|soon|change\w*|ease|end)\b|उम्र|कब|ఎప్పుడు|எப்போது/iu;
function explicitTopic(message) {
  if (/\b(married life|marriage life|marital|after marriage|love life|relationship\w*|spouse|husband|wife|partner|divorce|separat\w*)\b|वैवाहिक|दांपत्य|దాంపత్య/iu.test(message)) return 'married-life';
  if (marriageTerms.test(message)) return timingTerms.test(message) ? 'marriage' : 'married-life';
  if (/\b(jobs?|career|work|profession\w*|promotion|business|employment|hired|hiring|job offer)\b|नौकरी|करियर|ఉద్యోగం|வேலை|ಕೆಲಸ/iu.test(message)) return 'career';
  if (/\b(bad days?|difficult\w*|hardship\w*|struggl\w*|pressure|setbacks?|obstacles?|unlucky|sade[ -]?sati|ashtama)\b|बुरे दिन|कठिन|కష్టాలు|கஷ்டம்/iu.test(message)) return 'difficult-periods';
  if (/\b(education|stud\w*|exams?|learning|college|university|school)\b|पढ़ाई|शिक्षा|చదువు/iu.test(message)) return 'education';
  if (/\b(financ\w*|money|wealth|income|invest\w*|stock\w*|crypto\w*|lottery|gambl\w*)\b|पैसा|धन|డబ్బు/iu.test(message)) return 'finances';
  if (/\b(family|parents?|home|children|siblings?)\b|परिवार|కుటుంబం/iu.test(message)) return 'family';
  if (/\b(travel|abroad|foreign|relocat\w*|journey|move overseas)\b|विदेश|यात्रा|విదేశం/iu.test(message)) return 'travel';
  if (/\b(wellbeing|well-being|health|illness|symptom\w*|pregnan\w*|medical)\b|स्वास्थ्य|ఆరోగ్యం/iu.test(message)) return 'wellbeing';
  if (/\b(my future|life outlook|general outlook|overall life)\b/iu.test(message)) return 'general';
  return null;
}
function forecastTopic(message, history) {
  const topic = explicitTopic(message);
  if (topic) return topic;
  const asksChartFact = /\b(nakshatra|birth star|lagna|ascendant|navamsa|d9|pada|rashi)\b/iu.test(message);
  if (!asksChartFact && timingTerms.test(message)) {
    for (const turn of history.filter(turn => turn.role === 'user').slice(-2).reverse()) {
      const previousTopic = explicitTopic(turn.content);
      if (previousTopic) return previousTopic;
    }
  }
  return 'general';
}
function predictionFor(profile, chart, topic, asOf) {
  if (topic === 'marriage') return estimateMarriageWindows(profile, chart, { asOf });
  if (topic === 'career') return estimateCareerWindows(profile, chart, { asOf });
  if (topic === 'difficult-periods') return describeDifficultPeriods(profile, chart, { asOf });
  return analyzeLifeArea(profile, chart, topic, { asOf });
}
const missingBirthDetails = 'Add your recorded birth time, birth place, coordinates, and time zone in your birth profile to calculate a Vedic chart. A birth date alone cannot determine your lagna or birth star.';

export async function createApp({
  production = process.env.NODE_ENV === 'production',
  aiKey = process.env.ASTROLOGY_AI_API_KEY || '',
  model = process.env.ASTROLOGY_AI_MODEL || 'gpt-4.1-mini',
  fetchImpl = globalThis.fetch,
  today = () => new Date(),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (production) {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    }
    next();
  });
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST') {
      const origin = req.get('origin');
      if (origin) {
        try {
          if (new URL(origin).host !== req.get('host')) {
            return res.status(403).json({ error: 'Cross-origin requests are not supported.' });
          }
        } catch {
          return res.status(403).json({ error: 'Invalid request origin.' });
        }
      }
    }
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));
  const buckets = new Map();
  app.use('/api', (req, res, next) => {
    if (req.method !== 'POST') return next();
    const now = Date.now();
    const id = req.socket.remoteAddress || 'local';
    const entry = buckets.get(id);
    const bucket = !entry || now - entry.start >= 60000 ? { start: now, count: 0 } : entry;
    bucket.count++;
    buckets.set(id, bucket);
    if (buckets.size > 1000) {
      for (const [key, value] of buckets) if (now - value.start >= 60000) buckets.delete(key);
    }
    if (bucket.count > 60) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'Please pause for a minute before sending more requests.' });
    }
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'astral' }));
  app.get('/api/config', (_req, res) => res.json({ aiEnabled: Boolean(aiKey), model: aiKey ? model : null, signs: SIGNS }));
  app.get('/api/places', (req, res) => res.json({ places: searchPlaces(req.query.q), attribution: PLACE_ATTRIBUTION }));
  app.post('/api/profile', (req, res) => res.json(validateProfile(req.body, { today: today() })));
  app.post('/api/chart', (req, res) => {
    const profile = validateProfile(req.body?.profile, { today: today() });
    const chart = calculateVedicChart(profile, { asOf: today() });
    if (!chart) throw badRequest(missingBirthDetails);
    res.json(chart);
  });
  app.post('/api/prediction', (req, res) => {
    if (!PREDICTION_TOPICS.has(req.body?.topic)) throw badRequest('Choose a supported life topic: marriage, married-life, career, difficult-periods, general, education, finances, family, travel, or wellbeing.');
    const asOf = today();
    const profile = validateProfile(req.body?.profile, { today: asOf });
    const chart = calculateVedicChart(profile, { asOf });
    if (!chart) throw badRequest(missingBirthDetails);
    res.json(predictionFor(profile, chart, req.body.topic, asOf));
  });
  app.post('/api/reading', (req, res) => {
    const profile = validateProfile(req.body?.profile, { today: today() });
    res.json(buildReading(profile, { date: calendarDate(today(), req.body?.timeZone), focus: focusOf(req.body?.focus) }));
  });
  app.post('/api/compatibility', (req, res) => {
    if (!SIGNS.some(sign => sign.id === req.body?.signA) || !SIGNS.some(sign => sign.id === req.body?.signB)) {
      throw badRequest('Select two valid zodiac signs.');
    }
    res.json(buildCompatibility(req.body.signA, req.body.signB));
  });
  app.post('/api/chat', async (req, res) => {
    const asOf = today();
    const profile = validateProfile(req.body?.profile, { today: asOf });
    const focus = focusOf(req.body?.focus);
    if (typeof req.body?.message !== 'string') throw badRequest('Enter a question.');
    const message = req.body.message.trim();
    if (!message || message.length > 1000) throw badRequest('Your question must contain between 1 and 1,000 characters.');
    const mode = req.body.mode || (aiKey ? 'ai' : 'local');
    if (!['local', 'ai'].includes(mode)) throw badRequest('Choose local or AI mode.');
    const history = historyOf(req.body.history);
    const topic = forecastTopic(message, history);
    const chart = calculateVedicChart(profile, { asOf });
    const prediction = chart ? predictionFor(profile, chart, topic, asOf) : null;
    if (mode === 'local') {
      if (!chart) {
        const needsChart = explicitTopic(message) || timingTerms.test(message);
        const needsProfessionalHelp = /\b(suicid\w*|self[- ]?harm|kill myself|health|illness|symptom\w*|diagnos\w*|treat\w*|pregnan\w*|medicine|death|invest\w*|stock\w*|crypto\w*|lottery|gambl\w*)\b/iu.test(message);
        return res.json({ reply: needsChart && !needsProfessionalHelp ? missingBirthDetails : buildLocalReply(profile, { message, focus }), source: 'local' });
      }
      return res.json({ ...buildVedicLocalReply(chart, { message, focus, prediction }), source: 'local', ...(prediction ? { prediction } : {}) });
    }
    if (!aiKey) return res.status(503).json({ error: 'Live AI needs ASTROLOGY_AI_API_KEY in environment settings. The calculated Vedic guide is available in Local mode.' });
    if (!chart) throw badRequest(missingBirthDetails);
    const grounded = buildVedicMessages(chart, { message, focus, history, prediction });
    try {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model,
          max_completion_tokens: 550,
          store: false,
          messages: grounded.messages,
        }),
      });
      if (!response.ok) {
        // Provider error bodies may echo private request details, so keep them out of logs.
        return res.status(502).json({ error: 'The AI provider could not complete this request. Check the configured key, model, and billing, or switch to Local reflection.' });
      }
      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty provider response');
      return res.json({ reply: reply.trim(), source: 'ai', references: grounded.references, ...(prediction ? { prediction } : {}) });
    } catch {
      return res.status(502).json({ error: 'Live AI is temporarily unavailable. Try again or switch to Local reflection.' });
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  let vite;
  if (production) {
    if (!existsSync(path.join(root, 'dist/index.html'))) throw new Error('Production assets are missing. Run npm run build first.');
    app.use(express.static(path.join(root, 'dist'), { dotfiles: 'deny' }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
  } else {
    const { createServer } = await import('vite');
    // The runner avoids temporary config imports that make Node's watcher restart.
    vite = await createServer({ root, configLoader: 'runner', server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    const message = error.type === 'entity.too.large' ? 'The request is too large.'
      : error.type === 'entity.parse.failed' ? 'Send a valid JSON request.'
        : status < 500 ? error.message : 'Something went wrong. Please try again.';
    res.status(status).json({ error: message });
  });
  return { app, close: async () => { if (vite) await vite.close(); } };
}
