import express from 'express';

const AUDIO_TYPES = new Map([
  ['audio/webm', 'webm'], ['audio/mp4', 'mp4'], ['audio/m4a', 'm4a'],
  ['audio/wav', 'wav'], ['audio/x-wav', 'wav'], ['audio/ogg', 'ogg'],
  ['audio/mpeg', 'mp3'], ['audio/mpga', 'mpga'], ['application/octet-stream', 'webm'],
]);
const MAX_PROVIDER_AUDIO = 12 * 1024 * 1024;

function requestError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function languageOf(value = 'auto') {
  if (value === 'auto') return value;
  if (typeof value !== 'string' || value.length > 35 || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)) {
    throw requestError('Choose Auto or a valid language tag such as en-US, hi-IN, or te-IN.');
  }
  try {
    return new Intl.Locale(value).toString();
  } catch {
    throw requestError('Choose a valid language tag.');
  }
}

async function boundedBody(response, maximum) {
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > maximum) throw new Error('Provider response too large');
  if (!response.body) throw new Error('Empty provider response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error('Provider response too large');
      chunks.push(Buffer.from(value));
    }
    if (!size) throw new Error('Empty provider response');
    return Buffer.concat(chunks, size);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export function installVoiceRoutes(app, {
  aiKey,
  fetchImpl,
  ttsModel = process.env.ASTROLOGY_AI_TTS_MODEL || 'gpt-4o-mini-tts',
  transcribeModel = process.env.ASTROLOGY_AI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
}) {
  app.post('/api/transcribe', express.raw({ type: () => true, limit: '8mb' }), async (req, res) => {
    const language = languageOf(req.query.language);
    const type = (req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const extension = AUDIO_TYPES.get(type);
    if (!extension) throw requestError('Record or upload supported WebM, MP4, WAV, OGG, or MP3 audio.', 415);
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw requestError('Send a nonempty audio recording.');
    if (!aiKey) return res.status(503).json({ error: 'Voice input needs the server AI connection. You can still type your question.' });
    const form = new FormData();
    form.append('model', transcribeModel);
    form.append('file', new Blob([req.body], { type }), `recording.${extension}`);
    if (language !== 'auto') {
      const base = new Intl.Locale(language).language;
      if (base.length === 2) form.append('language', base);
    }
    form.append('response_format', 'json');
    try {
      const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${aiKey}` },
        signal: AbortSignal.timeout(30000), body: form,
      });
      if (!response.ok) throw new Error('Provider rejected transcription');
      const data = JSON.parse((await boundedBody(response, 64 * 1024)).toString('utf8'));
      if (typeof data?.text !== 'string' || !data.text.trim() || data.text.length > 8000) throw new Error('Invalid transcript');
      return res.json({ text: data.text.trim() });
    } catch {
      return res.status(502).json({ error: 'The recording could not be transcribed. Try again or type your question.' });
    }
  });

  app.post('/api/voice', async (req, res) => {
    const language = languageOf(req.body?.language);
    if (typeof req.body?.text !== 'string') throw requestError('Enter the text to speak.');
    const text = req.body.text.trim();
    if (!text || text.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
      throw requestError('Speech text must contain 1–2,000 characters without control characters.');
    }
    if (!aiKey) return res.status(503).json({ error: 'Natural voice needs the server AI connection. The written answer is still available.' });
    try {
      const response = await fetchImpl('https://api.openai.com/v1/audio/speech', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: ttsModel, voice: 'sage', input: text, response_format: 'mp3',
          instructions: `Read the supplied text faithfully, without additions. Do not translate or replace the supplied words. Use a warm, calm, natural conversational voice with clear pronunciation and gentle pacing. ${language === 'auto' ? 'Speak in the language of the text. If the text’s language is ambiguous, use English. Names or Vedic terms alone do not imply a regional language. Preserve natural pronunciation of names and Vedic terms.' : `Speak naturally in the language identified by ${language}, pronouncing names and Vedic terms clearly.`} Avoid a theatrical or preachy delivery.`,
        }),
      });
      if (!response.ok) throw new Error('Provider rejected speech');
      const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (type && !type.startsWith('audio/') && type !== 'application/octet-stream') throw new Error('Invalid provider audio');
      const audio = await boundedBody(response, MAX_PROVIDER_AUDIO);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', String(audio.length));
      return res.send(audio);
    } catch {
      return res.status(502).json({ error: 'Natural voice is temporarily unavailable. You can read the answer or try speaking it again.' });
    }
  });
}
