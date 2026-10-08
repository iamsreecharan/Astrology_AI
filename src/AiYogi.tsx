import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import CareerTiming from './CareerTiming';
import type { CareerPlanningDates, CareerSearchWindow } from './CareerTiming';
import './AiYogi.css';

const AiYogiAvatar = lazy(() => import('./AiYogiAvatar'));

export type YogiProfile = { name: string; birthDate: string; birthTime?: string; birthPlace?: string; latitude?: number; longitude?: number; timeZone?: string };
type YogiProps = { profile: YogiProfile | null; aiEnabled: boolean; onEditProfile: () => void };
type Reference = { id: string; title: string };
type Prediction = { topic?: string; searchWindows?: CareerSearchWindow[]; searchHorizonEnd?: string; planningDates?: CareerPlanningDates; factors?: string[]; themes?: string[]; method?: string[]; limitations?: string[]; windows?: { start: string; end: string; label?: string; reasons?: string[] }[] };
type Message = { id: number; role: 'user' | 'assistant'; text: string; source?: 'local' | 'ai'; responseLanguage?: string; references?: Reference[]; prediction?: Prediction };
type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';
type Meter = { context: AudioContext; ownsContext: boolean; frame: number | null; source: MediaStreamAudioSourceNode | AudioBufferSourceNode; analyser: AnalyserNode };

const LANGUAGES = [
  ['auto', 'Auto · English by default'], ['en', 'English'], ['hi', 'हिन्दी · Hindi'], ['te', 'తెలుగు · Telugu'],
  ['ta', 'தமிழ் · Tamil'], ['kn', 'ಕನ್ನಡ · Kannada'], ['ml', 'മലയാളം · Malayalam'], ['mr', 'मराठी · Marathi'],
  ['bn', 'বাংলা · Bengali'], ['gu', 'ગુજરાતી · Gujarati'], ['pa', 'ਪੰਜਾਬੀ · Punjabi'], ['ur', 'اردو · Urdu'],
  ['or', 'ଓଡ଼ିଆ · Odia'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'],
  ['ar', 'العربية · Arabic'], ['ja', '日本語 · Japanese'], ['ko', '한국어 · Korean'], ['zh', '中文 · Mandarin'],
] as const;
const MAX_RECORDING_BYTES = 8 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 45;

function answerLanguage(value: unknown, requestedLanguage: string): string {
  return typeof value === 'string' && (value === 'auto' || /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value)) ? value : requestedLanguage;
}

function voiceChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 2000) {
    const first = remaining.slice(0, 2000);
    const boundary = Math.max(first.lastIndexOf('. '), first.lastIndexOf('? '), first.lastIndexOf('! '), first.lastIndexOf('। '), first.lastIndexOf('\n'));
    const end = boundary >= 1000 ? boundary + 1 : 2000;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining.trim()) chunks.push(remaining);
  return chunks;
}

function Icon({ name }: { name: 'spark' | 'mic' | 'send' | 'close' | 'stop' | 'speaker' }) {
  const paths = {
    spark: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" /><path d="m20 2 .8 2.2L23 5l-2.2.8L20 8l-.8-2.2L17 5l2.2-.8L20 2Z" /></>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
    send: <><path d="m4 12 16-8-6 16-3-7-7-1Z" /><path d="m11 13 9-9" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    speaker: <><path d="m11 4-5 4H2v8h4l5 4V4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function profileSnapshot(profile: YogiProfile | null): YogiProfile | null {
  if (!profile) return null;
  const result: YogiProfile = { name: profile.name, birthDate: profile.birthDate };
  for (const key of ['birthTime', 'birthPlace', 'timeZone'] as const) if (typeof profile[key] === 'string') result[key] = profile[key];
  for (const key of ['latitude', 'longitude'] as const) if (Number.isFinite(profile[key])) result[key] = profile[key];
  return result;
}

async function checkedResponse(response: Response): Promise<Response> {
  if (response.ok) return response;
  let message = 'The connection couldn’t be completed. Please try again.';
  try {
    const body = await response.json() as { error?: string; message?: string };
    if (typeof body.error === 'string') message = body.error;
    else if (typeof body.message === 'string') message = body.message;
  } catch { /* A failed connection may have no response body. */ }
  throw new Error(message);
}

function CalculationDetails({ message }: { message: Message }) {
  const prediction = message.prediction;
  if (!prediction && !message.references?.length) return null;
  return <details className="yogi-calculations"><summary>Calculation details</summary>
    {prediction?.topic === 'career' && <CareerTiming planningDates={prediction.planningDates} searchWindows={prediction.searchWindows} searchHorizonEnd={prediction.searchHorizonEnd} compact />}
    {Boolean(prediction?.windows?.length) && <ul>{prediction?.windows?.map((window, index) => <li key={`${window.start}-${index}`}><strong>{window.label || `${window.start.slice(0, 10)} – ${window.end.slice(0, 10)}`}</strong>{window.reasons?.slice(0, 3).map(reason => <p key={reason}>{reason}</p>)}</li>)}</ul>}
    {Boolean(prediction?.factors?.length) && <ul>{prediction?.factors?.slice(0, 5).map(factor => <li key={factor}>{factor}</li>)}</ul>}
    {Boolean(prediction?.method?.length) && <p>{prediction?.method?.join(' ')}</p>}
    {Boolean(message.references?.length) && <ul>{message.references?.map(reference => <li key={reference.id}>{reference.id} · {reference.title}</li>)}</ul>}
    {Boolean(prediction?.limitations?.length) && <p>{prediction?.limitations?.join(' ')}</p>}
  </details>;
}

export default function AiYogi({ profile, aiEnabled, onEditProfile }: YogiProps) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('auto');
  const languageRef = useRef('auto');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [conversationPaused, setConversationPaused] = useState(false);
  const [micPending, setMicPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceMessageId, setVoiceMessageId] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [error, setError] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationButtonRef = useRef<HTMLButtonElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const openRef = useRef(false);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const voiceIdRef = useRef(0);
  const micIdRef = useRef(0);
  const conversationRef = useRef(false);
  const rearmTimerRef = useRef<number | null>(null);
  const messageIdRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const voiceRequestRef = useRef<AbortController | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const micMeterRef = useRef<Meter | null>(null);
  const voiceMeterRef = useRef<Meter | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingLimitRef = useRef<number | null>(null);
  const recordingSendRef = useRef(false);
  const speechSeenRef = useRef(false);
  const voiceContextRef = useRef<AudioContext | null>(null);
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const profileValue = profileSnapshot(profile);
  const profileKey = JSON.stringify(profileValue);
  const previousProfileRef = useRef(profileKey);
  const busy = loading || transcribing || recording || micPending;
  const state: AvatarState = recording ? 'listening' : loading || transcribing ? 'thinking' : speaking ? 'speaking' : 'idle';
  const hasBirthDetails = Boolean(profile?.birthTime && profile.birthPlace && profile.timeZone && Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude));

  function updateMessages(next: Message[]) {
    messagesRef.current = next;
    setMessages(next);
  }

  function stopMeter(ref: { current: Meter | null }) {
    const meter = ref.current;
    ref.current = null;
    if (!meter) return;
    if (meter.frame !== null) cancelAnimationFrame(meter.frame);
    meter.source.disconnect();
    meter.analyser.disconnect();
    if (meter.ownsContext) void meter.context.close().catch(() => {});
  }

  function startMeter(source: MediaStream | AudioBufferSourceNode, ref: { current: Meter | null }, onLevel?: (rms: number, time: number) => void, voiceContext?: AudioContext) {
    stopMeter(ref);
    let context: AudioContext | null = null;
    try {
      context = voiceContext ?? new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      const node = source instanceof MediaStream ? context.createMediaStreamSource(source) : source;
      node.connect(analyser);
      if (!(source instanceof MediaStream)) analyser.connect(context.destination);
      const meter: Meter = { context, ownsContext: !voiceContext, source: node, analyser, frame: null };
      ref.current = meter;
      const samples = new Uint8Array(analyser.fftSize);
      let lastUpdate = 0;
      const sample = (time: number) => {
        if (ref.current !== meter) return;
        if (time - lastUpdate >= 50 && document.visibilityState !== 'hidden') {
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (const value of samples) energy += ((value - 128) / 128) ** 2;
          const rms = Math.sqrt(energy / samples.length);
          setAudioLevel(Math.min(1, rms * 4));
          onLevel?.(rms, time);
          lastUpdate = time;
        }
        meter.frame = requestAnimationFrame(sample);
      };
      meter.frame = requestAnimationFrame(sample);
      void context.resume().catch(() => {});
    } catch {
      if (!voiceContext) void context?.close().catch(() => {});
      if (onLevel) throw new Error('This browser couldn’t start speech detection. Type your question instead.');
    }
  }

  function unlockVoice() {
    if (!aiEnabled || !openRef.current) return;
    try {
      let context = voiceContextRef.current;
      if (!context || context.state === 'closed') {
        context = new AudioContext();
        voiceContextRef.current = context;
      }
      // A user gesture unlocks this output once; every reply uses the same context.
      void context.resume().catch(() => {});
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(context.destination);
      source.onended = () => { source.disconnect(); source.buffer = null; };
      source.start();
    } catch { /* Voice playback will show a readable error if audio is unavailable. */ }
  }

  function releaseVoiceContext() {
    const context = voiceContextRef.current;
    voiceContextRef.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  function stopVoice(updateState = true) {
    ++voiceIdRef.current;
    voiceRequestRef.current?.abort();
    voiceRequestRef.current = null;
    const source = voiceSourceRef.current;
    voiceSourceRef.current = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* The last chunk may have already ended. */ }
      source.disconnect();
      source.buffer = null;
    }
    stopMeter(voiceMeterRef);
    if (updateState && mountedRef.current) {
      setSpeaking(false);
      setVoiceLoading(false);
      setVoiceMessageId(null);
      setAudioLevel(0);
    }
  }

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    stopMeter(micMeterRef);
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    if (recordingLimitRef.current !== null) window.clearTimeout(recordingLimitRef.current);
    recordingTimerRef.current = null;
    recordingLimitRef.current = null;
  }

  function discardRecording(updateState = true) {
    ++micIdRef.current;
    recordingSendRef.current = false;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    releaseMicrophone();
    if (updateState && mountedRef.current) {
      setRecording(false);
      setMicPending(false);
      setElapsed(0);
      setAudioLevel(0);
    }
  }

  function cancelConversation(updateState = true) {
    clearRearm();
    ++requestIdRef.current;
    requestRef.current?.abort();
    requestRef.current = null;
    discardRecording(updateState);
    stopVoice(updateState);
    if (updateState && mountedRef.current) {
      setLoading(false);
      setTranscribing(false);
    }
  }

  function clearRearm() {
    if (rearmTimerRef.current !== null) window.clearTimeout(rearmTimerRef.current);
    rearmTimerRef.current = null;
  }

  function endConversation(updateState = true, paused = false) {
    conversationRef.current = false;
    clearRearm();
    cancelConversation(updateState);
    releaseVoiceContext();
    if (updateState && mountedRef.current) {
      setConversationActive(false);
      setConversationPaused(paused);
    }
  }

  function listenAgain() {
    clearRearm();
    if (!conversationRef.current || !openRef.current || document.visibilityState === 'hidden') return;
    rearmTimerRef.current = window.setTimeout(() => {
      rearmTimerRef.current = null;
      if (conversationRef.current && openRef.current && document.visibilityState !== 'hidden') void startRecording();
    }, 200);
  }

  function changeLanguage(next: string) {
    languageRef.current = next;
    cancelConversation();
    setLanguage(next);
    setError('');
    setVoiceError('');
    listenAgain();
  }

  function beginConversation() {
    if (!aiEnabled || !openRef.current) return;
    endConversation();
    unlockVoice();
    conversationRef.current = true;
    setConversationActive(true);
    setConversationPaused(false);
    void startRecording();
  }

  function closeAssistant() {
    openRef.current = false;
    endConversation();
    setOpen(false);
  }

  async function playVoice(message: Message) {
    if (!aiEnabled || message.role !== 'assistant' || message.source !== 'ai') return;
    clearRearm();
    stopVoice();
    const requestId = voiceIdRef.current;
    const controller = new AbortController();
    voiceRequestRef.current = controller;
    setVoiceMessageId(message.id);
    setVoiceLoading(true);
    setVoiceError('');
    try {
      for (const text of voiceChunks(message.text)) {
        if (!openRef.current || requestId !== voiceIdRef.current) return;
        setVoiceLoading(true);
        const timeout = window.setTimeout(() => controller.abort(), 60000);
        let bytes: ArrayBuffer;
        try {
          const response = await checkedResponse(await fetch('/api/voice', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, language: message.responseLanguage ?? 'auto' }), signal: controller.signal,
          }));
          bytes = await response.arrayBuffer();
        } finally { window.clearTimeout(timeout); }
        if (!bytes.byteLength) throw new Error('No voice audio was returned. You can still read the answer.');
        if (!openRef.current || requestId !== voiceIdRef.current) return;
        const context = voiceContextRef.current;
        if (!context || context.state === 'closed') throw new DOMException('Voice needs a user gesture', 'NotAllowedError');
        const buffer = await context.decodeAudioData(bytes);
        if (!openRef.current || requestId !== voiceIdRef.current || controller.signal.aborted) return;
        if (context.state !== 'running') {
          let resumeTimeout: number | undefined;
          try {
            await Promise.race([
              context.resume(),
              new Promise<void>(resolve => { resumeTimeout = window.setTimeout(resolve, 1000); }),
            ]);
          } finally { window.clearTimeout(resumeTimeout); }
        }
        if (!openRef.current || requestId !== voiceIdRef.current || controller.signal.aborted) return;
        if (context.state !== 'running') throw new DOMException('Your browser paused voice playback. Tap Play voice once to enable audio.', 'NotAllowedError');
        const source = context.createBufferSource();
        source.buffer = buffer;
        voiceSourceRef.current = source;
        await new Promise<void>((resolve, reject) => {
          let playbackLimit: number | undefined;
          const cleanUp = () => {
            controller.signal.removeEventListener('abort', aborted);
            context.removeEventListener('statechange', interrupted);
            window.clearTimeout(playbackLimit);
          };
          const aborted = () => { cleanUp(); reject(new DOMException('Voice stopped', 'AbortError')); };
          const interrupted = () => {
            if (context.state === 'running') return;
            cleanUp();
            reject(new Error('Voice playback was interrupted. You can play the answer again or resume the conversation.'));
          };
          controller.signal.addEventListener('abort', aborted, { once: true });
          context.addEventListener('statechange', interrupted);
          source.onended = () => {
            cleanUp();
            stopMeter(voiceMeterRef);
            source.onended = null;
            source.disconnect();
            source.buffer = null;
            if (voiceSourceRef.current === source) voiceSourceRef.current = null;
            setSpeaking(false);
            setAudioLevel(0);
            resolve();
          };
          try {
            startMeter(source, voiceMeterRef, undefined, context);
            if (!voiceMeterRef.current) source.connect(context.destination);
            source.start();
            playbackLimit = window.setTimeout(() => {
              cleanUp();
              reject(new Error('Voice playback didn’t finish. You can play the answer again or resume the conversation.'));
            }, Math.ceil(buffer.duration * 1000) + 10000);
            setSpeaking(true);
            setVoiceLoading(false);
            setVoiceError('');
          } catch (cause) {
            cleanUp();
            reject(cause);
          }
        });
      }
      if (requestId === voiceIdRef.current) {
        stopVoice();
        listenAgain();
      }
    } catch (cause) {
      if (requestId !== voiceIdRef.current || !openRef.current) return;
      const message = controller.signal.aborted ? 'Voice took too long to connect. You can retry or read the answer.' : cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Your browser paused voice playback. Tap Play voice once to enable audio.' : cause instanceof Error ? cause.message : 'Voice couldn’t connect. The written answer is still available.';
      if (conversationRef.current) endConversation(true, true);
      else stopVoice();
      setVoiceError(message);
    } finally {
      if (voiceRequestRef.current === controller) voiceRequestRef.current = null;
    }
  }

  async function askQuestion(question: string, retry = false, existingController?: AbortController, existingRequestId?: number, requestedLanguage = languageRef.current) {
    const text = question.trim();
    if (!text || !openRef.current) return;
    if (text.length > 1000) {
      setError('Please shorten your question to 1,000 characters before sending.');
      return;
    }
    if (!existingController) cancelConversation();
    const requestId = existingRequestId ?? ++requestIdRef.current;
    const controller = existingController ?? new AbortController();
    requestRef.current = controller;
    const history = messagesRef.current.filter(message => !(retry && message.role === 'user' && message.text === text && message.id === messagesRef.current.at(-1)?.id)).slice(-6).map(message => ({ role: message.role, content: message.text.slice(0, 1000) }));
    if (!retry) updateMessages([...messagesRef.current, { id: ++messageIdRef.current, role: 'user', text }]);
    setLastQuestion(text);
    setInput('');
    setError('');
    setVoiceError('');
    setTranscribing(false);
    setLoading(true);
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const response = await checkedResponse(await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ profile: profileSnapshot(profile), assistant: 'yogi', mode: aiEnabled ? 'ai' : 'local', language: requestedLanguage, message: text, history }),
      }));
      const answer = await response.json() as { reply: string; source: 'local' | 'ai'; responseLanguage?: string; references?: Reference[]; prediction?: Prediction };
      if (typeof answer.reply !== 'string' || !answer.reply.trim()) throw new Error('No answer was returned. Please try again.');
      if (requestId !== requestIdRef.current || !openRef.current) return;
      const message: Message = { id: ++messageIdRef.current, role: 'assistant', text: answer.reply, source: answer.source, responseLanguage: answerLanguage(answer.responseLanguage, requestedLanguage), references: answer.references, prediction: answer.prediction };
      updateMessages([...messagesRef.current, message]);
      setLoading(false);
      if (aiEnabled && answer.source === 'ai' && document.visibilityState !== 'hidden') void playVoice(message);
    } catch (cause) {
      if (requestId !== requestIdRef.current || !openRef.current) return;
      const errorMessage = controller.signal.aborted ? 'AI Yogi took too long to reply. Please retry your question.' : cause instanceof Error ? cause.message : 'Your question couldn’t be answered. Please try again.';
      if (conversationRef.current) endConversation(true, true);
      setError(errorMessage);
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestIdRef.current && mountedRef.current) setLoading(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  async function transcribeRecording(blob: Blob, requestedLanguage: string) {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setTranscribing(true);
    setError('');
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const response = await checkedResponse(await fetch(`/api/transcribe?language=${encodeURIComponent(requestedLanguage)}`, {
        method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob, signal: controller.signal,
      }));
      const body = await response.json() as { text?: string };
      if (requestId !== requestIdRef.current || !openRef.current) return;
      if (!body.text?.trim()) throw new Error('I didn’t hear a clear question. Try again or type it below.');
      if (body.text.length > 1000) {
        endConversation(true, true);
        setInput(body.text);
        setError('Your recognized question is shown below. Please shorten it to 1,000 characters, then send it.');
        return;
      }
      window.clearTimeout(timeout);
      await askQuestion(body.text, false, controller, requestId, requestedLanguage);
    } catch (cause) {
      if (requestId !== requestIdRef.current || !openRef.current) return;
      const errorMessage = controller.signal.aborted ? 'The recording took too long to transcribe. Please try again or type your question.' : cause instanceof Error ? cause.message : 'The recording couldn’t be transcribed. You can type your question instead.';
      if (conversationRef.current) endConversation(true, true);
      setError(errorMessage);
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestIdRef.current && mountedRef.current) setTranscribing(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  function finishRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (conversationRef.current && !speechSeenRef.current) {
      discardRecording();
      listenAgain();
      return;
    }
    recordingSendRef.current = true;
    setRecording(false);
    setTranscribing(true);
    recorder.stop();
    releaseMicrophone();
    setAudioLevel(0);
  }

  async function startRecording() {
    if (!aiEnabled || !conversationRef.current || !openRef.current || document.visibilityState === 'hidden') return;
    if (recorderRef.current || streamRef.current) return;
    cancelConversation();
    setError('');
    setVoiceError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone recording needs a supported browser and an HTTPS connection. You can type your question below.');
      endConversation(true, true);
      return;
    }
    const micId = ++micIdRef.current;
    const recordingLanguage = languageRef.current;
    setMicPending(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (micId !== micIdRef.current || !openRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recordingSendRef.current = false;
      speechSeenRef.current = false;
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.ondataavailable = event => {
        if (micId !== micIdRef.current || !event.data.size) return;
        bytes += event.data.size;
        if (bytes > MAX_RECORDING_BYTES) {
          discardRecording();
          endConversation(true, true);
          setError('That recording was too large. Please record a shorter question or type it.');
          return;
        }
        chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (micId !== micIdRef.current) return;
        discardRecording();
        endConversation(true, true);
        setError('The microphone stopped unexpectedly. Please try again or type your question.');
      };
      recorder.onstop = () => {
        if (micId !== micIdRef.current) return;
        recorderRef.current = null;
        releaseMicrophone();
        setRecording(false);
        if (!recordingSendRef.current || !openRef.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (!blob.size) {
          setTranscribing(false);
          setError('The recording was empty. Try again or type your question.');
          return;
        }
        void transcribeRecording(blob, recordingLanguage);
      };
      recorder.start(1000);
      setMicPending(false);
      setRecording(true);
      setElapsed(0);
      const started = Date.now();
      recordingTimerRef.current = window.setInterval(() => setElapsed(Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - started) / 1000))), 250);
      recordingLimitRef.current = window.setTimeout(finishRecording, MAX_RECORDING_SECONDS * 1000);
      let speechStarted = 0;
      let lastSpeech = 0;
      startMeter(stream, micMeterRef, (rms, time) => {
        if (micId !== micIdRef.current || !conversationRef.current || recorder.state !== 'recording') return;
        if (rms >= 0.022) {
          if (!speechStarted) speechStarted = time;
          if (time - speechStarted >= 100) speechSeenRef.current = true;
          lastSpeech = time;
        } else {
          speechStarted = 0;
          if (speechSeenRef.current && time - lastSpeech >= 1200) finishRecording();
        }
      });
    } catch (cause) {
      stream?.getTracks().forEach(track => track.stop());
      if (micId !== micIdRef.current || !openRef.current) return;
      discardRecording();
      endConversation(true, true);
      const denied = cause instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(cause.name);
      setError(denied ? 'Microphone access wasn’t granted. Allow it in your browser or type your question below.' : 'The microphone isn’t available. Check your device or type your question below.');
    }
  }

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const ownsScrollLock = previousOverflow !== 'hidden';
    if (ownsScrollLock) document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    if (aiEnabled) conversationButtonRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      if (ownsScrollLock && document.body.style.overflow === 'hidden') document.body.style.overflow = previousOverflow;
      launcherRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (open && transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [open, messages, loading, transcribing, error]);

  useEffect(() => {
    if (previousProfileRef.current === profileKey) return;
    previousProfileRef.current = profileKey;
    endConversation();
    updateMessages([]);
    setError('');
    setVoiceError('');
    setLastQuestion('');
  }, [profileKey]);

  useEffect(() => {
    if (!aiEnabled) {
      endConversation();
    }
  }, [aiEnabled]);

  useEffect(() => {
    mountedRef.current = true;
    const pauseOnHide = () => {
      if (document.visibilityState !== 'hidden') return;
      if (conversationRef.current) endConversation(true, true);
      else { discardRecording(); stopVoice(); releaseVoiceContext(); }
    };
    document.addEventListener('visibilitychange', pauseOnHide);
    return () => {
      mountedRef.current = false;
      openRef.current = false;
      endConversation(false);
      document.removeEventListener('visibilitychange', pauseOnHide);
    };
  }, []);

  const avatarStatus = recording ? `Listening · ${elapsed}s / ${MAX_RECORDING_SECONDS}s` : transcribing ? 'Turning your voice into text…' : loading ? 'Considering your question…' : speaking ? 'Speaking with you' : voiceLoading ? 'Preparing a natural voice…' : micPending ? 'Waiting for microphone access…' : 'Here to listen';

  return <>
    <button ref={launcherRef} type="button" className="yogi-launcher" aria-haspopup="dialog" aria-expanded={open} aria-controls="ai-yogi-dialog" onClick={() => { openRef.current = true; setOpen(true); }}>
      <span className="yogi-launcher-symbol"><Icon name="spark" /></span><span>AI Yogi<small>Talk in your language</small></span><span className="yogi-launcher-dot" aria-hidden="true" />
    </button>
    {open && <dialog ref={dialogRef} id="ai-yogi-dialog" className="yogi-dialog" aria-labelledby="yogi-title" aria-describedby="yogi-description" onCancel={event => { event.preventDefault(); closeAssistant(); }}>
      <div className="yogi-panel">
        <header className="yogi-header"><div><span className="yogi-eyebrow">A LITTLE WISDOM, A LITTLE WONDER</span><h2 id="yogi-title">Meet <em>AI Yogi.</em></h2></div><button type="button" className="yogi-icon-button" aria-label="Close AI Yogi" onClick={closeAssistant}><Icon name="close" /></button></header>
        <div className={`yogi-avatar-stage yogi-state-${state}`}>
          <Suspense fallback={<div className="yogi-avatar-placeholder" aria-hidden="true">✧</div>}><AiYogiAvatar state={state} audioLevel={audioLevel} /></Suspense>
          <span className="yogi-avatar-status" role="status"><span aria-hidden="true" />{avatarStatus}</span>
        </div>
        <p id="yogi-description" className="yogi-description">Ask about the stars, life, or something you’d like explained. Speak or type in your language.</p>
        <div className="yogi-controls"><label htmlFor="yogi-language">Conversation language</label><select id="yogi-language" value={language} onChange={event => changeLanguage(event.target.value)}>{LANGUAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><span className="yogi-mode"><span aria-hidden="true" />{aiEnabled ? 'Live Vedic AI' : 'Local guide · English'}</span></div>
        {!hasBirthDetails && <button type="button" className="yogi-profile-link" onClick={() => { closeAssistant(); onEditProfile(); }}>{profile ? 'Add birth time and place for personal Vedic answers' : 'Add your birth details for personal Vedic answers'}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>}
        <div ref={transcriptRef} className="yogi-transcript" role="log" aria-label="AI Yogi conversation" aria-live="polite" aria-relevant="additions text">
          {!messages.length && <div className="yogi-greeting"><span aria-hidden="true">✧</span><p>Namaste. What’s on your mind?</p><small>{aiEnabled ? 'I’ll start in English and switch to the language you speak or select. Every reply has words you can read and a voice you can hear.' : 'The local guide can share short Vedic notes in English. Live voice becomes available when this server’s AI connection is configured.'}</small></div>}
          {messages.map(message => <article key={message.id} className={`yogi-message yogi-message-${message.role}`}><span className="yogi-message-label">{message.role === 'user' ? 'You' : 'AI Yogi'}{message.source === 'local' ? ' · Local guide' : ''}</span><p dir="auto">{message.text}</p>{message.role === 'assistant' && <><CalculationDetails message={message} />{aiEnabled && message.source === 'ai' && <button type="button" className="yogi-read-button" disabled={voiceLoading || loading || transcribing || micPending} onClick={() => { if (voiceMessageId === message.id && speaking) { stopVoice(); listenAgain(); } else { discardRecording(); unlockVoice(); void playVoice(message); } }}><Icon name={voiceMessageId === message.id && speaking ? 'stop' : 'speaker'} />{voiceMessageId === message.id && speaking ? 'Stop voice' : voiceMessageId === message.id && voiceLoading ? 'Preparing voice…' : 'Play voice'}</button>}</>}</article>)}
          {(loading || transcribing) && <div className="yogi-thinking" role="status"><span /><span /><span /><p>{transcribing ? 'Listening to your recording…' : 'AI Yogi is thinking…'}</p></div>}
          {error && <div className="yogi-error" role="alert"><p>{error}</p>{lastQuestion && !busy && <button type="button" onClick={() => { unlockVoice(); void askQuestion(lastQuestion, true); }}>Retry question</button>}</div>}
        </div>
        {voiceError && <p className="yogi-voice-error" role="status">{voiceError}</p>}
        <form className="yogi-compose" onSubmit={event => { event.preventDefault(); if (!loading && !transcribing && !micPending && input.trim()) { unlockVoice(); void askQuestion(input); } }}>
          <label className="sr-only" htmlFor="yogi-question">Your question for AI Yogi</label><textarea ref={inputRef} id="yogi-question" dir="auto" placeholder="Type your question in any language…" rows={2} value={input} maxLength={1000} disabled={loading || transcribing || micPending} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!loading && !transcribing && !micPending && input.trim()) { unlockVoice(); void askQuestion(input); } } }} /><button type="submit" className="yogi-send-button" aria-label="Send question to AI Yogi" disabled={!input.trim() || input.trim().length > 1000 || loading || transcribing || micPending}><Icon name="send" /></button>
        </form>
        <div className="yogi-talk-row"><button ref={conversationButtonRef} type="button" className={`yogi-talk-button ${conversationActive ? 'is-recording' : ''}`} disabled={!aiEnabled || (!conversationActive && (loading || transcribing || micPending))} onClick={() => { if (conversationActive) endConversation(); else beginConversation(); }}><Icon name={conversationActive ? 'stop' : 'mic'} />{conversationActive ? 'End conversation' : conversationPaused ? 'Resume conversation' : 'Start conversation'}</button>{recording && <button type="button" className="yogi-cancel-button" onClick={finishRecording}>Send now</button>}{(speaking || voiceLoading) && <button type="button" className="yogi-cancel-button" onClick={() => { stopVoice(); listenAgain(); }}>Stop voice</button>}</div>
        <p className="yogi-privacy-note">{recording ? 'Listening now. I’ll reply when you finish speaking, then listen again. Close or End conversation turns the microphone off.' : conversationActive ? 'Conversation is on. Your microphone pauses while I think and speak. AI-generated voice.' : aiEnabled ? 'Audio, questions, recent conversation and calculated chart facts go to OpenAI. Saved name and exact birth details are excluded from chart context. AI-generated voice.' : 'Local answers use traditional notes. Live AI and natural voice aren’t connected to this server yet.'}</p>
      </div>
    </dialog>}
  </>;
}
