import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import BirthplaceAutocomplete from './BirthplaceAutocomplete';
import type { Birthplace } from './BirthplaceAutocomplete';
import WelcomeIntro from './WelcomeIntro';
import PersonalizationPrompt from './PersonalizationPrompt';
import CareerTiming from './CareerTiming';
import type { CareerPlanningDates, CareerSearchWindow } from './CareerTiming';
import './App.css';
import './AstralTheme.css';

const CelestialScene = lazy(() => import('./CelestialScene'));
const AiYogi = lazy(() => import('./AiYogi'));
const About = lazy(() => import('./About'));

type Page = 'today' | 'chart' | 'compatibility' | 'chat' | 'about';
type Focus = 'general' | 'love' | 'career' | 'wellbeing';
type Sign = { id: string; name: string; symbol: string; element: string; modality: string; dates: string; traits: string[]; description: string };
type ProfileInput = { name: string; birthDate: string; birthTime?: string; birthPlace?: string; latitude?: number; longitude?: number; timeZone?: string };
type Profile = ProfileInput & { sign: Sign };
type Reading = { date: string; focus: Focus; headline: string; overview: string; sections: { label: string; text: string }[]; affirmation: string; ritual: string; lucky: { color: string; number: number }; source: 'local' | 'ai' };
type Compatibility = { signA: Sign; signB: Sign; headline: string; summary: string; strengths: string[]; challenges: string[]; conversationStarter: string };
type Reference = { id: string; title: string };
type PredictionTopic = 'marriage' | 'career' | 'difficult-periods' | 'married-life' | 'general' | 'education' | 'finances' | 'family' | 'travel' | 'wellbeing';
type PredictionSupport = { kind: 'relative' | 'interpretation' | 'calculated-phase' | 'unavailable' | 'planning'; label: string; explanation: string; comparison?: 'unique-top' | 'tied-top' | 'single' | 'lower' };
type Prediction = { topic: PredictionTopic; status: 'estimated' | 'no-window' | 'interpreted'; asOf: string; horizonEnd: string; support?: PredictionSupport; seventhHouse?: { rashi: string; lord: string }; windows: { start: string; end: string; ageRange?: { min: number; max: number }; label?: string; reasons: string[]; themes?: string[]; support?: PredictionSupport }[]; searchWindows?: CareerSearchWindow[]; searchHorizonEnd?: string; planningDates?: CareerPlanningDates; factors?: string[]; themes?: string[]; currentPhase?: { name: string; description: string }; method: string[]; limitations: string[] };
type Planet = { name: string; rashi: string; signIndex: number; longitude: number; degreeInSign: number; house: number; retrograde: boolean | null };
type DashaPeriod = { lord: string; start: string; end: string };
type VedicChart = { calculation: { system: string; ayanamsha: string; ayanamshaDegrees: number; ephemeris: string; houses: string; nodeType: string; warnings: string[] }; moon: { rashi: string; nakshatra: { name: string; lord: string; index: number }; pada: number; longitude: number }; ascendant: { rashi: string; longitude: number }; planets: Planet[]; dasha: { birthBalance: { lord: string; years: number }; currentMahadasha: DashaPeriod | null; currentAntardasha: DashaPeriod | null; periods: (DashaPeriod & { antardashas: DashaPeriod[] })[] }; transits: { asOf: string; planets: Planet[] }; navamsa?: { ascendant: { rashi: string; longitude: number }; planets: Planet[] }; limits: string[] };
type Message = { id: number; role: 'user' | 'assistant'; text: string; source?: 'local' | 'ai'; references?: Reference[]; prediction?: Prediction };
type Config = { aiEnabled: boolean; model: string | null; signs: Sign[] };

const predictionTopics: { id: PredictionTopic; label: string; heading: string; question: string; icon: string }[] = [
  { id: 'marriage', label: 'Marriage timing', heading: 'Possibility, with perspective.', question: 'When might I get married?', icon: 'heart' },
  { id: 'married-life', label: 'Married life', heading: 'A shared life, in perspective.', question: 'How might my married life be?', icon: 'heart' },
  { id: 'career', label: 'Career & job timing', heading: 'Your next working chapter.', question: 'When might I get a job?', icon: 'compass' },
  { id: 'difficult-periods', label: 'Challenging periods', heading: 'Finding perspective in a hard season.', question: 'When might a difficult period ease?', icon: 'moon' },
  { id: 'education', label: 'Education & learning', heading: 'Make room for what you’ll learn.', question: 'What does my chart suggest about education?', icon: 'star' },
  { id: 'finances', label: 'Money & finances', heading: 'A considered view of your resources.', question: 'What financial themes does my chart suggest?', icon: 'compass' },
  { id: 'family', label: 'Family', heading: 'The people you call home.', question: 'What does my chart suggest about family life?', icon: 'heart' },
  { id: 'travel', label: 'Travel & change', heading: 'A little room for new horizons.', question: 'What does my chart suggest about travel?', icon: 'compass' },
  { id: 'general', label: 'Life direction', heading: 'See your next chapter more clearly.', question: 'What life themes are active in my chart?', icon: 'sun' },
  { id: 'wellbeing', label: 'Wellbeing', heading: 'Find a rhythm that supports you.', question: 'What wellbeing themes does my chart suggest?', icon: 'leaf' },
];

const sampleProfile: ProfileInput = { name: 'Alex', birthDate: '1995-05-21', birthTime: '10:30', birthPlace: 'Hyderabad, India', latitude: 17.385, longitude: 78.4867, timeZone: 'Asia/Kolkata' };

function profilePayload(value: ProfileInput): ProfileInput {
  const result: ProfileInput = { name: value.name, birthDate: value.birthDate };
  for (const key of ['birthTime', 'birthPlace', 'timeZone'] as const) if (typeof value[key] === 'string') result[key] = value[key];
  for (const key of ['latitude', 'longitude'] as const) if (typeof value[key] === 'number' && Number.isFinite(value[key])) result[key] = value[key];
  return result;
}
function hasBirthDetails(value: ProfileInput | null): boolean {
  return Boolean(value?.birthTime && value.birthPlace && value.timeZone && Number.isFinite(value.latitude) && Number.isFinite(value.longitude));
}
function formatDate(value: string): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function formatAge(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
function formatMonth(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function degrees(value: number): string { return `${value.toFixed(2)}°`; }
const focusOptions: { id: Focus; label: string; icon: string }[] = [
  { id: 'general', label: 'Your day', icon: 'sun' },
  { id: 'love', label: 'Love', icon: 'heart' },
  { id: 'career', label: 'Career', icon: 'compass' },
  { id: 'wellbeing', label: 'Wellbeing', icon: 'leaf' },
];
const ritualColors: Record<string, string> = { Sage: '#a3b49a', Amber: '#aa7e35', Indigo: '#737097', Terracotta: '#bd8169', Rose: '#c3949c', 'Ocean blue': '#7e9ca9', Lavender: '#baa4c8', Gold: '#c4aa72', 'Forest green': '#6f8465', Pearl: '#d8d6c6' };
const allSigns: [string, string, string][] = [
  ['aries', 'Aries', '♈'], ['taurus', 'Taurus', '♉'], ['gemini', 'Gemini', '♊'], ['cancer', 'Cancer', '♋'],
  ['leo', 'Leo', '♌'], ['virgo', 'Virgo', '♍'], ['libra', 'Libra', '♎'], ['scorpio', 'Scorpio', '♏'],
  ['sagittarius', 'Sagittarius', '♐'], ['capricorn', 'Capricorn', '♑'], ['aquarius', 'Aquarius', '♒'], ['pisces', 'Pisces', '♓'],
];

function savedProfile(): ProfileInput | null {
  try {
    const value = JSON.parse(localStorage.getItem('astral-profile') || 'null');
    if (value && typeof value.name === 'string' && typeof value.birthDate === 'string') return profilePayload(value);
  } catch { /* Open the app even if saved browser data is unavailable or invalid. */ }
  return null;
}

async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Astral couldn’t complete that request. Please try again.');
    if (!data) throw new Error('Astral received an unexpected response. Please try again.');
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('This is taking longer than expected. Please try again.');
    if (error instanceof TypeError) throw new Error('We couldn’t reach Astral. Check your connection and try again.');
    throw error;
  } finally { window.clearTimeout(timeout); signal?.removeEventListener('abort', forwardAbort); }
}

function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, ReactNode> = {
    star: <><path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    heart: <path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></>,
    leaf: <><path d="M20 4s-12-3-15 5 6 14 11 8S20 4 20 4Z" /><path d="m5 20 10-11" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    arrowUp: <><path d="M12 19V5m-6 6 6-6 6 6" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    edit: <><path d="m15 4 5 5M4 20l5-1L21 7a2.8 2.8 0 0 0-4-4L5 15Z" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9.4 9.4 0 0 1-4-.9L3 21l1.9-5.5a9.4 9.4 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    moon: <path d="M20.8 13a9 9 0 0 1-9.8-9.8A9 9 0 1 0 20.8 13Z" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" /></>,
    book: <><path d="M12 5C8 2 3 3 2 4v15c3-2 7-1 10 1 3-2 7-3 10-1V4c-1-1-6-2-10 1Z" /><path d="M12 5v15" /></>,
  };
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.star}</svg>;
}

function SunWheel({ symbol = '✧', compact = false }: { symbol?: string; compact?: boolean }) {
  return <div className={`sun-wheel ${compact ? 'compact' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 300 300" fill="none">
      <circle cx="150" cy="150" r="132" stroke="currentColor" strokeWidth=".7" />
      <circle cx="150" cy="150" r="115" stroke="currentColor" strokeWidth=".7" />
      <circle cx="150" cy="150" r="86" stroke="currentColor" strokeWidth=".7" />
      <circle cx="150" cy="150" r="76" stroke="currentColor" strokeWidth=".5" strokeDasharray="2 7" />
      {Array.from({ length: 60 }, (_, i) => {
        const angle = i * Math.PI / 30;
        const inner = i % 5 === 0 ? 116 : 125;
        return <line key={i} x1={150 + Math.cos(angle) * inner} y1={150 + Math.sin(angle) * inner} x2={150 + Math.cos(angle) * 132} y2={150 + Math.sin(angle) * 132} stroke="currentColor" strokeWidth={i % 5 === 0 ? '.9' : '.5'} />;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * Math.PI / 6;
        return <line key={i} x1={150 + Math.cos(angle) * 86} y1={150 + Math.sin(angle) * 86} x2={150 + Math.cos(angle) * 115} y2={150 + Math.sin(angle) * 115} stroke="currentColor" strokeWidth=".5" />;
      })}
      <path d="M150 9v17M150 274v17M9 150h17m248 0h17" stroke="currentColor" />
      <path d="m37 42 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm223 200 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="currentColor" />
    </svg>
    <span>{`${symbol}\uFE0E`}</span>
  </div>;
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-notice" role="alert"><span>{message}</span>{onRetry && <button className="text-button" onClick={onRetry}>Try again <Icon name="arrow" size={16} /></button>}</div>;
}

function LoadingReading() {
  return <div className="reading-loading" role="status" aria-label="Loading your daily reading"><div className="skeleton skeleton-label" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line shorter" /><span className="loading-caption">Finding a little perspective for your day…</span></div>;
}

function PlanetTable({ planets, navamsa }: { planets: Planet[]; navamsa?: Planet[] }) {
  return <div className="planet-table-scroll" tabIndex={0} role="region" aria-label="Planet positions table"><table className="planet-table"><thead><tr><th scope="col">Graha</th><th scope="col">D1 rashi</th>{navamsa && <th scope="col">D9 rashi</th>}<th scope="col">Sidereal longitude</th><th scope="col">Within sign</th><th scope="col">House</th><th scope="col">Motion</th></tr></thead><tbody>{planets.map(planet => <tr key={planet.name}><th scope="row">{planet.name}</th><td>{planet.rashi}</td>{navamsa && <td>{navamsa.find(item => item.name === planet.name)?.rashi || '—'}</td>}<td>{degrees(planet.longitude)}</td><td>{degrees(planet.degreeInSign)}</td><td>{planet.house}</td><td><span className={planet.retrograde ? 'motion-tag retrograde' : 'motion-tag'}>{planet.retrograde === null ? '—' : planet.retrograde ? 'Retrograde' : 'Direct'}</span></td></tr>)}</tbody></table></div>;
}

function PredictionResults({ prediction, compact = false, insideDetails = false }: { prediction: Prediction; compact?: boolean; insideDetails?: boolean }) {
  const topic = predictionTopics.find(item => item.id === prediction.topic);
  const isMarriage = prediction.topic === 'marriage';
  const isInterpretation = prediction.status === 'interpreted';
  const introduction = isMarriage
    ? 'These conditional windows combine chart factors and period timing. They estimate possible ages; they do not promise a marriage event.'
    : prediction.topic === 'career'
      ? 'Start with the upcoming dates and months for applications, interviews, and preparation. Broader career periods add context while you keep pursuing real opportunities.'
    : prediction.topic === 'difficult-periods'
      ? 'These are traditional transit and dasha themes. A phase date does not determine when real-life difficulties or bad days will end.'
      : isInterpretation
        ? 'These themes interpret calculated placements and life periods. They offer a lens for reflection rather than a fixed outcome.'
        : 'These conditional windows combine chart factors and period timing. They describe traditional opportunities, not a promised event.';
  return <div className={`marriage-results prediction-results ${compact ? 'compact' : ''}`}>
    <p className="forecast-context">{prediction.support?.label || (isInterpretation ? 'Calculated chart interpretation' : prediction.topic === 'difficult-periods' ? 'Traditional period themes' : 'Calculated timing estimate')} · {topic?.label || prediction.topic}</p>
    <p className="forecast-intro">{introduction}</p>
    {prediction.support?.kind === 'relative' && prediction.windows.length > 0 && <div className="prediction-support-note"><strong>{prediction.support.label}</strong><p>{prediction.support.explanation}</p></div>}
    {prediction.topic === 'career' && <CareerTiming planningDates={prediction.planningDates} searchWindows={prediction.searchWindows} searchHorizonEnd={prediction.searchHorizonEnd} compact={compact} />}
    {prediction.currentPhase && <section className="current-phase-card"><span className="eyebrow">CURRENT TRADITIONAL PHASE</span><h3>{prediction.currentPhase.name}</h3><p>{prediction.currentPhase.description}</p></section>}
    {Boolean(prediction.themes?.length) && <section className="prediction-themes"><h3>What this brings into focus</h3><ul>{prediction.themes?.map((theme, index) => <li key={index}>{theme}</li>)}</ul></section>}
    {Boolean(prediction.factors?.length) && (insideDetails
      ? <section className="prediction-factors"><h3>Chart factors behind these themes</h3><ul>{prediction.factors?.map((factor, index) => <li key={index}>{factor}</li>)}</ul></section>
      : <details className="prediction-factors"><summary>Chart factors behind these themes</summary><ul>{prediction.factors?.map((factor, index) => <li key={index}>{factor}</li>)}</ul></details>)}
    {prediction.topic === 'career' && prediction.windows.length > 0 && <h3 className="career-period-heading">Broader career periods, in date order</h3>}
    {prediction.windows.length ? <div className="marriage-windows">{prediction.windows.map((window, index) => {
      const leading = window.support?.comparison === 'unique-top' || window.support?.comparison === 'tied-top';
      return <section className={`marriage-window ${isMarriage && window.ageRange ? '' : 'theme-window'} ${leading ? 'window-most-supported' : ''}`} key={`${window.start}-${index}`}>
        <div className="window-number">{String(index + 1).padStart(2, '0')}</div>
        <div>
          <span className="eyebrow">{isMarriage && window.ageRange ? 'ESTIMATED AGE WINDOW' : prediction.topic === 'career' ? 'BROADER CAREER PERIOD' : prediction.topic === 'difficult-periods' ? 'TRADITIONAL PHASE DATES' : isInterpretation ? 'PERIOD THEMES' : 'CONDITIONAL TIMING WINDOW'}</span>
          {isMarriage && window.ageRange ? <h3>{formatAge(window.ageRange.min)}{window.ageRange.min !== window.ageRange.max && <>–{formatAge(window.ageRange.max)}</>} <span>years</span></h3> : <h3>{prediction.topic === 'career' ? `${formatMonth(window.start)} – ${formatMonth(window.end)}` : window.label || `Period ${index + 1}`}</h3>}
          {window.support && <span className={`prediction-support-badge prediction-support-${window.support.kind} ${leading ? 'is-leading' : ''}`}>{window.support.label}</span>}
          <p className="window-dates">{formatDate(window.start)} – {formatDate(window.end)}</p>
          {Boolean(window.themes?.length) && <ul className="window-themes">{window.themes?.map((theme, themeIndex) => <li key={themeIndex}>{theme}</li>)}</ul>}
          {(!compact || insideDetails) && <ul className="window-reasons">{window.reasons.map((reason, reasonIndex) => <li key={reasonIndex}>{reason}</li>)}</ul>}
        </div>
      </section>;
    })}</div> : prediction.status === 'no-window' ? <div className="no-window"><h3>{prediction.topic === 'career' ? 'No broader career window found.' : 'No qualifying window in this horizon.'}</h3><p>The combined rules did not identify a timing window through {formatDate(prediction.horizonEnd)}. {isMarriage ? 'This is not a prediction that marriage will not happen.' : prediction.topic === 'career' ? 'Keep applying and following actual openings; these periods do not set an employment deadline.' : 'This does not rule out real-life opportunities or change.'}</p></div> : null}
    {(!compact || insideDetails) && (insideDetails
      ? <section className="method-details"><h3>Method and interpretation limits</h3><p>{prediction.seventhHouse && <>Seventh house: {prediction.seventhHouse.rashi} · lord: {prediction.seventhHouse.lord}. </>}Calculated as of {formatDate(prediction.asOf)}.</p><ul>{prediction.method.map((item, index) => <li key={`method-${index}`}>{item}</li>)}{prediction.limitations.map((item, index) => <li key={`limit-${index}`}>{item}</li>)}</ul></section>
      : <details className="method-details"><summary>Method and interpretation limits</summary><p>{prediction.seventhHouse && <>Seventh house: {prediction.seventhHouse.rashi} · lord: {prediction.seventhHouse.lord}. </>}Calculated as of {formatDate(prediction.asOf)}.</p><ul>{prediction.method.map((item, index) => <li key={`method-${index}`}>{item}</li>)}{prediction.limitations.map((item, index) => <li key={`limit-${index}`}>{item}</li>)}</ul></details>)}
  </div>;
}

export default function App() {
  const [introMotion, setIntroMotion] = useState<boolean | null>(null);
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return sessionStorage.getItem('astral-welcome') !== 'seen'; }
    catch { return true; }
  });
  const welcomeExitedRef = useRef(false);
  const [initialProfile] = useState(() => savedProfile());
  const [showPersonalization, setShowPersonalization] = useState(() => {
    if (showWelcome || hasBirthDetails(initialProfile)) return false;
    try { return sessionStorage.getItem('astral-personalization') !== 'seen'; }
    catch { return true; }
  });
  const profileInputRef = useRef<ProfileInput>(initialProfile || sampleProfile);
  const [page, setPage] = useState<Page>('today');
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState('');
  const [configRetry, setConfigRetry] = useState(0);
  const [configLoading, setConfigLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSaved, setIsSaved] = useState(Boolean(initialProfile));
  const [isPersonalProfile, setIsPersonalProfile] = useState(Boolean(initialProfile));
  const [profileError, setProfileError] = useState('');
  const [profileRetry, setProfileRetry] = useState(0);
  const [focus, setFocus] = useState<Focus>('general');
  const [reading, setReading] = useState<Reading | null>(null);
  const [readingLoading, setReadingLoading] = useState(true);
  const [readingError, setReadingError] = useState('');
  const [readingRetry, setReadingRetry] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [nameInput, setNameInput] = useState(initialProfile?.name || sampleProfile.name);
  const [dateInput, setDateInput] = useState(initialProfile?.birthDate || sampleProfile.birthDate);
  const [includeBirthDetails, setIncludeBirthDetails] = useState(Boolean(initialProfile && hasBirthDetails(initialProfile)));
  const [timeInput, setTimeInput] = useState(initialProfile?.birthTime || '');
  const [placeSelected, setPlaceSelected] = useState(Boolean(initialProfile && hasBirthDetails(initialProfile)));
  const [manualLocation, setManualLocation] = useState(false);
  const [placeInput, setPlaceInput] = useState(initialProfile?.birthPlace || '');
  const [latitudeInput, setLatitudeInput] = useState(initialProfile?.latitude !== undefined ? String(initialProfile.latitude) : '');
  const [longitudeInput, setLongitudeInput] = useState(initialProfile?.longitude !== undefined ? String(initialProfile.longitude) : '');
  const [timeZoneInput, setTimeZoneInput] = useState(initialProfile?.timeZone || '');
  const [chart, setChart] = useState<VedicChart | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState('');
  const [chartRetry, setChartRetry] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const reportRequestRef = useRef<AbortController | null>(null);
  const reportIdRef = useRef(0);
  const [predictionTopic, setPredictionTopic] = useState<PredictionTopic>('marriage');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState('');
  const [predictionRetry, setPredictionRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const [signA, setSignA] = useState('gemini');
  const [signB, setSignB] = useState('libra');
  const [compatibility, setCompatibility] = useState<Compatibility | null>(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [lastChat, setLastChat] = useState('');
  const lastHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [preferredChatMode, setChatMode] = useState<'local' | 'ai'>('ai');
  const chatMode = config?.aiEnabled ? preferredChatMode : 'local';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  const compatibilityRequestRef = useRef(0);
  const chatRequestRef = useRef(0);
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dateLabel = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const currentName = profile?.name || profileInputRef.current.name;
  const signs = config?.signs || [];
  const initial = currentName.slice(0, 1).toUpperCase();

  function enterAstral() {
    try { sessionStorage.setItem('astral-welcome', 'seen'); } catch { /* Entry still works if browser storage is unavailable. */ }
    welcomeExitedRef.current = true;
    if (!isPersonalProfile || !hasBirthDetails(profile || profileInputRef.current)) {
      let alreadySeen = false;
      try { alreadySeen = sessionStorage.getItem('astral-personalization') === 'seen'; } catch { /* The invitation still works without browser storage. */ }
      if (!alreadySeen) setShowPersonalization(true);
    }
    setShowWelcome(false);
  }

  function dismissPersonalization() {
    try { sessionStorage.setItem('astral-personalization', 'seen'); } catch { /* Keep the choice for this visit even if storage is blocked. */ }
    welcomeExitedRef.current = true;
    setShowPersonalization(false);
  }

  function personalizeAstrology() {
    dismissPersonalization();
    openProfileEditor();
    setIncludeBirthDetails(true);
    if (!isPersonalProfile) {
      setNameInput('');
      setDateInput('');
    }
  }

  useEffect(() => {
    if (showWelcome || showPersonalization || editorOpen || !welcomeExitedRef.current) return;
    let frame = 0;
    let attempts = 0;
    const restoreFocus = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement && active.getClientRects().length && !active.closest('dialog:not([open])')) {
        welcomeExitedRef.current = false;
        return;
      }
      const target = document.querySelector<HTMLButtonElement>('.wordmark');
      if (target?.isConnected && getComputedStyle(target).visibility === 'visible') {
        target.focus({ preventScroll: true });
        if (document.activeElement === target) {
          welcomeExitedRef.current = false;
          return;
        }
      }
      if (++attempts < 60) frame = requestAnimationFrame(restoreFocus);
      else welcomeExitedRef.current = false;
    };
    frame = requestAnimationFrame(restoreFocus);
    return () => cancelAnimationFrame(frame);
  }, [showWelcome, showPersonalization, editorOpen]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setConfigError('');
    setConfigLoading(true);
    api<Config>('/api/config', undefined, controller.signal).then(data => {
      if (active) {
        setConfig(data);
      }
    }).catch(error => {
      if (active) { setConfigError(error.message); setConfig(null); }
    }).finally(() => { if (active) setConfigLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [configRetry]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setConfigRetry(value => value + 1); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  useEffect(() => {
    let active = true;
    setProfileError('');
    api<Profile>('/api/profile', profileInputRef.current).then(data => {
      if (active) { setProfile(data); setSignA(data.sign.id); }
    }).catch(error => { if (active) { setProfileError(error.message); setReadingLoading(false); } });
    return () => { active = false; };
  }, [initialProfile, profileRetry]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setReadingLoading(true);
    setReadingError('');
    api<Reading>('/api/reading', { profile: profilePayload(profile), focus, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).then(data => {
      if (active) { setReading(data); setReadingLoading(false); }
    }).catch(error => { if (active) { setReadingError(error.message); setReadingLoading(false); } });
    return () => { active = false; };
  }, [profile, focus, readingRetry]);

  useEffect(() => {
    let active = true;
    setChart(null);
    setChartError('');
    if (!profile || !hasBirthDetails(profile)) { setChartLoading(false); return; }
    setChartLoading(true);
    api<VedicChart>('/api/chart', { profile: profilePayload(profile) }).then(data => { if (active) setChart(data); }).catch(error => { if (active) setChartError(error.message); }).finally(() => { if (active) setChartLoading(false); });
    return () => { active = false; };
  }, [profile, chartRetry]);

  useEffect(() => {
    ++reportIdRef.current;
    reportRequestRef.current?.abort();
    reportRequestRef.current = null;
    setReportLoading(false);
    setReportError('');
    return () => {
      ++reportIdRef.current;
      reportRequestRef.current?.abort();
      reportRequestRef.current = null;
    };
  }, [profile]);

  useEffect(() => {
    let active = true;
    setPrediction(null);
    setPredictionError('');
    if (!profile || !hasBirthDetails(profile)) { setPredictionLoading(false); return; }
    setPredictionLoading(true);
    const controller = new AbortController();
    api<Prediction>('/api/prediction', { profile: profilePayload(profile), topic: predictionTopic }, controller.signal).then(data => { if (active) setPrediction(data); }).catch(error => { if (active) setPredictionError(error.message); }).finally(() => { if (active) setPredictionLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [profile, predictionRetry, predictionTopic]);

  useEffect(() => {
    if (editorOpen && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
      document.getElementById('profile-name')?.focus({ preventScroll: true });
    }
    if (!editorOpen && dialogRef.current?.open) dialogRef.current?.close();
  }, [editorOpen]);

  useEffect(() => {
    if (page === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, chatLoading, page]);

  function openProfileEditor() {
    setNameInput(currentName);
    setDateInput(profile?.birthDate || profileInputRef.current.birthDate);
    const details = profile || profileInputRef.current;
    const existingDetails = isPersonalProfile && hasBirthDetails(details);
    setIncludeBirthDetails(existingDetails);
    setTimeInput(existingDetails ? details.birthTime || '' : '');
    setPlaceInput(existingDetails ? details.birthPlace || '' : '');
    setLatitudeInput(existingDetails ? String(details.latitude) : '');
    setLongitudeInput(existingDetails ? String(details.longitude) : '');
    setTimeZoneInput(existingDetails ? details.timeZone || '' : '');
    setPlaceSelected(existingDetails);
    setManualLocation(false);
    setSaveError('');
    setEditorOpen(true);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaveError('');
    if (includeBirthDetails && !manualLocation && !placeSelected) {
      setSaveError('Choose a birth place from the suggestions, or enter its coordinates and time zone manually.');
      document.getElementById('profile-place')?.focus();
      return;
    }
    if (includeBirthDetails && !validLocationInputs()) {
      setSaveError('Enter a valid latitude, longitude and IANA time zone for your birth place.');
      return;
    }
    setSaving(true);
    const input: ProfileInput = { name: nameInput.trim(), birthDate: dateInput };
    if (includeBirthDetails) Object.assign(input, { birthTime: timeInput, birthPlace: placeInput.trim(), latitude: Number(latitudeInput), longitude: Number(longitudeInput), timeZone: timeZoneInput.trim() });
    try {
      const data = await api<Profile>('/api/profile', input);
      profileInputRef.current = input;
      setProfile(data);
      setIsPersonalProfile(true);
      setProfileError('');
      setSignA(data.sign.id);
      ++chatRequestRef.current;
      setMessages([]);
      setChatLoading(false);
      setChatError('');
      try {
        localStorage.setItem('astral-profile', JSON.stringify(input));
        setIsSaved(true);
        setStorageNotice('');
      } catch {
        setIsSaved(false);
        setStorageNotice('Your profile is ready for this visit. This browser couldn’t save it for next time.');
      }
      setEditorOpen(false);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Couldn’t save your profile. Please try again.'); }
    finally { setSaving(false); }
  }

  function resetProfile() {
    try { localStorage.removeItem('astral-profile'); } catch { /* Reset the session even if the browser blocks storage. */ }
    setIsSaved(false);
    setIsPersonalProfile(false);
    setStorageNotice('');
    profileInputRef.current = sampleProfile;
    setProfile(null);
    setNameInput('');
    setDateInput('');
    setIncludeBirthDetails(false);
    setTimeInput('');
    setPlaceSelected(false);
    setManualLocation(false);
    setPlaceInput('');
    setLatitudeInput('');
    setLongitudeInput('');
    setTimeZoneInput('');
    setSaveError('');
    ++chatRequestRef.current;
    setMessages([]);
    setChatLoading(false);
    setChatError('');
    setProfileError('');
    api<Profile>('/api/profile', sampleProfile).then(data => { setProfile(data); setSignA(data.sign.id); }).catch(error => setProfileError(error.message));
  }

  async function downloadReport() {
    if (!profile || !isPersonalProfile || !hasBirthDetails(profile) || reportRequestRef.current) return;
    const requestId = ++reportIdRef.current;
    const controller = new AbortController();
    reportRequestRef.current = controller;
    setReportLoading(true);
    setReportError('');
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch('/api/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profilePayload(profile) }), signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Your report couldn’t be created. Please try again.');
      }
      if (response.headers.get('content-type')?.split(';')[0] !== 'application/pdf') throw new Error('An unexpected report was returned. Please try again.');
      const blob = await response.blob();
      if (!blob.size || blob.size > 16 * 1024 * 1024 || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('The PDF couldn’t be downloaded. Please try again.');
      if (requestId !== reportIdRef.current || controller.signal.aborted) return;
      const disposition = response.headers.get('content-disposition') || '';
      const rawName = /filename="([^"]+)"/i.exec(disposition)?.[1] || 'astral-vedic-report.pdf';
      const filename = rawName.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '-').slice(0, 160);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      document.body.append(link);
      try { link.click(); } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (cause) {
      if (requestId !== reportIdRef.current) return;
      setReportError(controller.signal.aborted ? 'Your report took too long to create. Please try again.' : cause instanceof Error ? cause.message : 'Your report couldn’t be downloaded. Please try again.');
    } finally {
      window.clearTimeout(timeout);
      if (reportRequestRef.current === controller) reportRequestRef.current = null;
      if (requestId === reportIdRef.current) setReportLoading(false);
    }
  }

  async function findCompatibility(event?: FormEvent) {
    event?.preventDefault();
    const requestId = ++compatibilityRequestRef.current;
    setCompatibilityLoading(true);
    setCompatibilityError('');
    setCompatibility(null);
    try {
      const result = await api<Compatibility>('/api/compatibility', { signA, signB });
      if (requestId === compatibilityRequestRef.current) setCompatibility(result);
    } catch (error) {
      if (requestId === compatibilityRequestRef.current) setCompatibilityError(error instanceof Error ? error.message : 'Couldn’t explore this pairing. Please try again.');
    } finally { if (requestId === compatibilityRequestRef.current) setCompatibilityLoading(false); }
  }

  function changeSign(which: 'a' | 'b', value: string) {
    ++compatibilityRequestRef.current;
    if (which === 'a') setSignA(value); else setSignB(value);
    setCompatibility(null);
    setCompatibilityLoading(false);
    setCompatibilityError('');
  }

  async function sendChat(message = chatInput, retry = false) {
    const text = message.trim();
    if (!text || !profile || chatLoading) return;
    const requestId = ++chatRequestRef.current;
    if (!retry) lastHistoryRef.current = messages.slice(-6).map(item => ({ role: item.role, content: item.text.slice(0, 1000) }));
    setLastChat(text);
    setChatError('');
    setChatInput('');
    setChatLoading(true);
    if (!retry) setMessages(previous => [...previous, { id: ++messageIdRef.current, role: 'user', text }]);
    try {
      const result = await api<{ reply: string; source: 'local' | 'ai'; references?: Reference[]; prediction?: Prediction }>('/api/chat', {
        profile: profilePayload(profile), message: text, focus, mode: chatMode, history: lastHistoryRef.current,
      });
      if (requestId === chatRequestRef.current) setMessages(previous => [...previous, { id: ++messageIdRef.current, role: 'assistant', text: result.reply, source: result.source, references: result.references, prediction: result.prediction }]);
    } catch (error) { if (requestId === chatRequestRef.current) setChatError(error instanceof Error ? error.message : 'Your reflection couldn’t be created. Please try again.'); }
    finally { if (requestId === chatRequestRef.current) setChatLoading(false); }
  }

  const selectedPredictionTopic = predictionTopics.find(topic => topic.id === predictionTopic)!;
  const fullBirthProfile = hasBirthDetails(profile);
  const localChatLabel = fullBirthProfile ? 'Calculated Vedic guide' : 'Local reflection';
  const aiChatLabel = fullBirthProfile ? 'Vedic AI' : 'AI reflection';

  function changeBirthPlace(value: string) {
    setPlaceInput(value);
    setPlaceSelected(false);
    setLatitudeInput('');
    setLongitudeInput('');
    setTimeZoneInput('');
    setSaveError('');
  }

  function chooseBirthPlace(place: Birthplace) {
    setPlaceInput(place.label.slice(0, 120));
    setLatitudeInput(String(place.latitude));
    setLongitudeInput(String(place.longitude));
    setTimeZoneInput(place.timeZone);
    setPlaceSelected(true);
    setManualLocation(false);
    setSaveError('');
  }

  function validLocationInputs() {
    if (!placeInput.trim() || !latitudeInput.trim() || !longitudeInput.trim() || !timeZoneInput.trim()) return false;
    const latitude = Number(latitudeInput);
    const longitude = Number(longitudeInput);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: timeZoneInput.trim() }); } catch { return false; }
    return true;
  }

  const signOptions = signs.length ? signs.map(sign => ({ id: sign.id, name: sign.name, symbol: sign.symbol })) : allSigns.map(([id, name, symbol]) => ({ id, name, symbol }));
  const signALabel = signOptions.find(sign => sign.id === signA);
  const signBLabel = signOptions.find(sign => sign.id === signB);
  const navigation: { page: Page; label: string; icon: string }[] = [{ page: 'today', label: 'Today', icon: 'sun' }, { page: 'chart', label: 'Birth chart', icon: 'compass' }, { page: 'compatibility', label: 'Compatibility', icon: 'heart' }, { page: 'chat', label: 'Ask Astral', icon: 'star' }, { page: 'about', label: 'About', icon: 'book' }];

  return <div className={`app-shell${showWelcome ? ' is-welcoming' : ''}`}>
    <Suspense fallback={null}><CelestialScene intro={showWelcome} motionOverride={introMotion} /></Suspense>
    {showWelcome && <WelcomeIntro onEnter={enterAstral} motionOverride={introMotion} onMotionChange={setIntroMotion} />}
    {!showWelcome && showPersonalization && <PersonalizationPrompt onPersonalize={personalizeAstrology} onSkip={dismissPersonalization} />}
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <div className="header-inner">
        <button className="wordmark" onClick={() => setPage('today')} aria-label="Astral home"><Icon name="star" size={29} /><span>astral<span className="wordmark-period">.</span></span></button>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(item => <button key={item.page} className={`nav-link ${page === item.page ? 'active' : ''}`} aria-current={page === item.page ? 'page' : undefined} onClick={() => setPage(item.page)}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}
        </nav>
        <button className="header-profile" onClick={openProfileEditor} aria-label={`Edit ${currentName}’s birth profile`}><span className="avatar">{initial}</span><span className="header-profile-name">{currentName}</span><Icon name="chevron" size={15} /></button>
      </div>
    </header>

    <main id="main-content" className="main-container">
      <p className="brand-note"><span aria-hidden="true">✧</span><span>No astrologer can remember all of Vedic wisdom. Astral brings key calculations to your chart.</span></p>
      {configError && <ErrorNotice message={configError} onRetry={() => setConfigRetry(value => value + 1)} />}
      {profileError && <ErrorNotice message={profileError} onRetry={() => setProfileRetry(value => value + 1)} />}
      {storageNotice && <div className="storage-notice" role="status">{storageNotice}</div>}
      {page === 'today' && <>
        <section className="page-heading">
          <div><p className="eyebrow"><span className="tiny-star">✦</span> A LITTLE CLARITY, EVERY DAY</p><h1>Your day, in a new <em>light.</em></h1><p className="heading-description">Hello, {currentName}. Make a little space for possibility.</p></div>
          <div className="date-stamp"><span className="date-stamp-line" />{dateLabel}<span>YOUR DAILY MOMENT</span></div>
        </section>
        <div className="today-grid">
          <div className="daily-column">
            <div className="focus-bar"><span className="focus-label">Explore your</span><div className="focus-options" role="group" aria-label="Reading focus">{focusOptions.map(option => <button key={option.id} className={`focus-button ${focus === option.id ? 'selected' : ''}`} aria-pressed={focus === option.id} onClick={() => setFocus(option.id)}><Icon name={option.icon} size={17} />{option.label}</button>)}</div></div>
            <section className="daily-card" aria-label="Your daily reading" aria-busy={readingLoading}>
              <div className="daily-card-top"><span className="eyebrow"><Icon name="sun" size={16} /> YOUR DAILY READING</span><span className="small-tag">CURATED REFLECTION</span></div>
              {readingLoading ? <LoadingReading /> : readingError ? <div className="card-error"><Icon name="moon" size={35} /><h2>A pause in your day.</h2><ErrorNotice message={readingError} onRetry={() => setReadingRetry(value => value + 1)} /></div> : reading ? <>
                <h2 className="reading-headline">{reading.headline}</h2><p className="reading-overview">{reading.overview}</p>
                <div className="reading-sections">{reading.sections.map((section, index) => <div className="reading-section" key={`${section.label}-${index}`}><span className="section-symbol">{index % 2 === 0 ? '✧' : '◌'}</span><div><h3>{section.label}</h3><p>{section.text}</p></div></div>)}</div>
                <div className="affirmation"><Icon name="star" size={23} /><div><span className="eyebrow">A THOUGHT TO TAKE WITH YOU</span><blockquote>“{reading.affirmation}”</blockquote></div></div>
              </> : <div className="empty-state"><h2>Your reading is waiting.</h2><p>Add your birth profile to get started.</p><button className="primary-button" onClick={openProfileEditor}>Create your profile <Icon name="arrow" size={17} /></button></div>}
            </section>
            <button className="ask-teaser" onClick={() => setPage('chat')}><span className="teaser-icon"><Icon name="star" size={24} /></span><span><strong>A question on your mind?</strong><span>Find a fresh perspective with Astral.</span></span><span className="teaser-action">Let’s explore <Icon name="arrow" size={19} /></span></button>
          </div>
          <aside className="sky-column">
            <section className="signature-card" aria-label="Your sun sign profile">
              <div className="signature-top"><span className="eyebrow">YOUR SKY SIGNATURE</span><button className="icon-button" onClick={openProfileEditor} aria-label="Edit birth profile"><Icon name="edit" size={16} /></button></div>
              <SunWheel symbol={profile?.sign.symbol || '✧'} />
              <div className="signature-name"><h2>{profile?.sign.name || 'Your sun sign'}</h2><span>SUN SIGN</span></div>
              <p className="signature-description">{profile?.sign.description || 'A little self-discovery begins with your date of birth.'}</p>
              {profile && <div className="signature-details"><span><small>ELEMENT</small>{profile.sign.element}</span><span><small>MODALITY</small>{profile.sign.modality}</span></div>}
              <div className="signature-bottom"><span>{isSaved ? 'Saved only in this browser' : isPersonalProfile ? 'Profile for this visit' : 'Exploring with a sample profile'}</span><button onClick={openProfileEditor}>{isSaved ? 'Edit' : 'Make it yours'} <Icon name="arrow" size={14} /></button></div>
            </section>
            <section className="ritual-card"><div className="ritual-heading"><span className="ritual-icon"><Icon name="leaf" size={20} /></span><h3>A small daily ritual</h3></div><p>{readingLoading ? 'Taking a quiet moment is always a good place to begin.' : reading?.ritual || 'Pause, take a slow breath, and notice one thing you’re grateful for.'}</p>{reading && !readingLoading && <div className="daily-symbols"><span><span className="color-dot" style={{ backgroundColor: ritualColors[reading.lucky.color] || ritualColors.Gold }} /><small>YOUR COLOR</small><strong>{reading.lucky.color}</strong></span><span><span className="number-symbol">{reading.lucky.number}</span><small>YOUR NUMBER</small><strong>A playful daily symbol</strong></span></div>}</section>
          </aside>
        </div>
        <div className="quiet-note"><span>✧</span><p>There’s no perfect way to be you. Just a little more room to grow.</p><span>✧</span></div>
      </>}

      {page === 'chart' && <>
        <section className="page-heading"><div><p className="eyebrow"><span className="tiny-star">✦</span> YOUR CALCULATED VEDIC BLUEPRINT</p><h1>A fuller view of <em>you.</em></h1><p className="heading-description">Sidereal placements, life periods, and thoughtfully estimated timing.</p></div><div className="chart-heading-actions"><button className="chart-edit-button" onClick={openProfileEditor}><Icon name="edit" size={16} />Edit birth details</button><button type="button" className="chart-download-button" onClick={() => void downloadReport()} disabled={!isPersonalProfile || !fullBirthProfile || !chart || reportLoading} aria-busy={reportLoading}><Icon name="download" size={17} />{reportLoading ? 'Creating your PDF…' : 'Download English PDF'}</button></div></section>
        {!isPersonalProfile || !fullBirthProfile ? <p className="report-profile-note">Your English report includes your birth record, charts, periods and life topics. <button type="button" className="text-button" onClick={() => { openProfileEditor(); setIncludeBirthDetails(true); if (!isPersonalProfile) { setNameInput(''); setDateInput(''); } }}>Add your birth details</button> to download it.</p> : <p className="report-profile-note">Download your birth record, charts, periods and life topics as an English PDF.</p>}
        {reportError && <ErrorNotice message={reportError} onRetry={() => void downloadReport()} />}
        {!isPersonalProfile && fullBirthProfile && <div className="demo-chart-notice"><Icon name="compass" size={19} /><div><strong>You’re exploring Alex’s demo chart.</strong><span>21 May 1995 · 10:30 · Hyderabad, India · Asia/Kolkata. Replace these example details to calculate your own chart.</span></div><button className="text-button" onClick={openProfileEditor}>Make it yours <Icon name="arrow" size={15} /></button></div>}
        {!fullBirthProfile ? <section className="chart-onboarding"><SunWheel symbol="✧" compact /><span className="eyebrow">YOUR RECORDED DETAILS MATTER</span><h2>More than a sun sign.</h2><p>A Vedic birth chart needs your recorded birth time and place as well as your date of birth. We’ll use them to calculate your Moon rashi, nakshatra, ascendant, and Vimshottari periods.</p><button className="primary-button" onClick={() => { openProfileEditor(); setIncludeBirthDetails(true); }}>Add birth time &amp; place <Icon name="arrow" size={17} /></button><p className="chart-onboarding-note">Don’t know your birth time? Keep your basic profile and explore daily reflections. We won’t guess it.</p></section> : <div className="birth-chart-content">
          <div className="birth-record-bar"><span><Icon name="lock" size={14} />{isSaved ? 'Birth profile saved only in this browser' : isPersonalProfile ? 'Birth profile for this visit' : 'Example birth record · not saved'}</span><span>{profile?.birthPlace} · {profile?.birthTime} · {profile?.timeZone}</span></div>
          {chartLoading ? <section className="chart-loading-card"><LoadingReading /><span className="eyebrow">CALCULATING SIDEREAL POSITIONS &amp; PERIODS</span></section> : chartError ? <ErrorNotice message={chartError} onRetry={() => setChartRetry(value => value + 1)} /> : chart && <>
            <div className="chart-summary-grid"><section className="chart-summary-card moon-summary"><Icon name="moon" size={24} /><span className="eyebrow">MOON RASHI · CHANDRA</span><h2>{chart.moon.rashi}</h2><span className="chart-stat-detail">Sidereal longitude {degrees(chart.moon.longitude)}</span></section><section className="chart-summary-card"><Icon name="star" size={24} /><span className="eyebrow">BIRTH NAKSHATRA</span><h2>{chart.moon.nakshatra.name}</h2><span className="chart-stat-detail">Pada {chart.moon.pada} · lord {chart.moon.nakshatra.lord}</span></section><section className="chart-summary-card"><Icon name="compass" size={24} /><span className="eyebrow">ASCENDANT · LAGNA</span><h2>{chart.ascendant.rashi}</h2><span className="chart-stat-detail">Sidereal longitude {degrees(chart.ascendant.longitude)}</span></section></div>
            <section className="chart-section dasha-section"><div className="chart-section-heading"><div><span className="eyebrow">VIMSHOTTARI DASHA</span><h2>Your current chapter.</h2></div><span className="small-tag">CALCULATED LIFE PERIODS</span></div><div className="dasha-grid"><div><span className="eyebrow">CURRENT MAHADASHA</span><h3>{chart.dasha.currentMahadasha?.lord || 'Outside calculated timeline'}</h3>{chart.dasha.currentMahadasha && <p>{formatDate(chart.dasha.currentMahadasha.start)} – {formatDate(chart.dasha.currentMahadasha.end)}</p>}</div><div><span className="eyebrow">CURRENT ANTARDASHA</span><h3>{chart.dasha.currentAntardasha?.lord || 'Outside calculated timeline'}</h3>{chart.dasha.currentAntardasha && <p>{formatDate(chart.dasha.currentAntardasha.start)} – {formatDate(chart.dasha.currentAntardasha.end)}</p>}</div><div><span className="eyebrow">BALANCE AT BIRTH</span><h3>{chart.dasha.birthBalance.lord}</h3><p>{chart.dasha.birthBalance.years.toFixed(2)} years remaining at birth</p></div></div><details className="method-details"><summary>Explore the full dasha timeline</summary><div className="dasha-timeline">{chart.dasha.periods.map((period, index) => <details key={`${period.lord}-${index}`}><summary><strong>{period.lord}</strong><span>{formatDate(period.start)} – {formatDate(period.end)}</span></summary><ul>{period.antardashas.map((subperiod, subIndex) => <li key={subIndex}><strong>{subperiod.lord}</strong><span>{formatDate(subperiod.start)} – {formatDate(subperiod.end)}</span></li>)}</ul></details>)}</div></details></section>
            <section className="chart-section graha-section"><div className="chart-section-heading"><div><span className="eyebrow">D1 RASHI{chart.navamsa ? ' + D9 NAVAMSA' : ''}</span><h2>Your planetary placements.</h2></div><span className="small-tag">SIDEREAL · WHOLE SIGN</span></div><p className="chart-method-label">{chart.navamsa ? 'D1 + D9 · Lahiri approximation · mean nodes' : 'Approximate Lahiri · whole-sign D1 · mean nodes'}</p><PlanetTable planets={chart.planets} navamsa={chart.navamsa?.planets} />{chart.navamsa && <p className="navamsa-note"><strong>D9 ascendant:</strong> {chart.navamsa.ascendant.rashi}. Navamsa is derived from the natal longitudes and is sensitive to your recorded birth time.</p>}<details className="method-details"><summary>Calculation details &amp; precision</summary><p>{chart.navamsa ? 'D1 + D9 · Lahiri approximation · mean nodes' : 'Approximate Lahiri · whole-sign D1 · mean nodes'}.</p><dl className="calculation-details"><div><dt>System</dt><dd>{chart.calculation.system}</dd></div><div><dt>Ephemeris</dt><dd>{chart.calculation.ephemeris}</dd></div><div><dt>Ayanamsha</dt><dd>{chart.calculation.ayanamsha} · {degrees(chart.calculation.ayanamshaDegrees)}</dd></div><div><dt>Houses / nodes</dt><dd>{chart.calculation.houses} / {chart.calculation.nodeType}</dd></div></dl><ul>{[...chart.calculation.warnings, ...chart.limits].map((limit, index) => <li key={index}>{limit}</li>)}</ul></details></section>
            <details className="chart-section transit-section"><summary>Current transit placements <span>{formatDate(chart.transits.asOf)}</span></summary><PlanetTable planets={chart.transits.planets} /></details>
          </>}
          <section className="chart-section forecast-section" aria-busy={predictionLoading}><div className="chart-section-heading"><div><span className="eyebrow"><Icon name={selectedPredictionTopic.icon} size={15} /> {selectedPredictionTopic.label.toUpperCase()}</span><h2>{selectedPredictionTopic.heading}</h2></div><div className="forecast-topic-control"><label htmlFor="prediction-topic">Explore a life topic</label><select id="prediction-topic" value={predictionTopic} onChange={event => setPredictionTopic(event.target.value as PredictionTopic)}>{predictionTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></div></div>{predictionLoading ? <div className="prediction-loading" role="status">Bringing together your chart factors and traditional period themes…</div> : predictionError ? <ErrorNotice message={predictionError} onRetry={() => setPredictionRetry(value => value + 1)} /> : prediction && prediction.topic === predictionTopic ? <PredictionResults prediction={prediction} /> : <p className="forecast-intro">Your topic guide will appear when the calculation is ready.</p>}<button className="forecast-chat-link" onClick={() => { setPage('chat'); setChatInput(selectedPredictionTopic.question); }}>Ask Astral about {selectedPredictionTopic.label.toLowerCase()} <Icon name="arrow" size={17} /></button></section>
        </div>}
        <div className="quiet-note"><span>✧</span><p>Your chart is a lens for interpretation. Your life is yours to shape.</p><span>✧</span></div>
      </>}

      {page === 'compatibility' && <>
        <section className="page-heading"><div><p className="eyebrow"><span className="tiny-star">✦</span> TWO SIGNS. NEW PERSPECTIVES.</p><h1>The art of <em>connection.</em></h1><p className="heading-description">Explore what comes easily — and where you can grow together.</p></div><div className="heading-decoration" aria-hidden="true">♡</div></section>
        <div className="compatibility-layout">
          <section className="pairing-card"><span className="eyebrow">EXPLORE A PAIRING</span><div className="pair-symbols" aria-hidden="true"><span>{`${signALabel?.symbol || '✧'}\uFE0E`}</span><Icon name="star" size={24} /><span>{`${signBLabel?.symbol || '✧'}\uFE0E`}</span></div><form onSubmit={findCompatibility}><div className="form-field"><label htmlFor="sign-a">Your sign</label><select id="sign-a" value={signA} onChange={event => changeSign('a', event.target.value)}>{signOptions.map(sign => <option value={sign.id} key={sign.id}>{sign.symbol} {sign.name}</option>)}</select></div><div className="form-field"><label htmlFor="sign-b">Their sign</label><select id="sign-b" value={signB} onChange={event => changeSign('b', event.target.value)}>{signOptions.map(sign => <option value={sign.id} key={sign.id}>{sign.symbol} {sign.name}</option>)}</select></div><button type="submit" className="primary-button full-width" disabled={compatibilityLoading}>{compatibilityLoading ? 'Exploring your connection…' : 'Explore your connection'}<Icon name="arrow" size={18} /></button></form><p className="pairing-note">Sun signs offer a starting point for reflection. Your choices, communication, and lived experience shape your relationships.</p></section>
          <section className="compatibility-result" aria-live="polite" aria-busy={compatibilityLoading}>
            {compatibilityLoading ? <LoadingReading /> : compatibilityError ? <ErrorNotice message={compatibilityError} onRetry={() => void findCompatibility()} /> : compatibility ? <><span className="eyebrow">{compatibility.signA.name.toUpperCase()} + {compatibility.signB.name.toUpperCase()}</span><h2>{compatibility.headline}</h2><p className="compatibility-summary">{compatibility.summary}</p><div className="connection-columns"><div><h3><Icon name="sun" size={18} /> Your natural strengths</h3><ul>{compatibility.strengths.map((strength, index) => <li key={index}>{strength}</li>)}</ul></div><div><h3><Icon name="leaf" size={18} /> Room to grow</h3><ul>{compatibility.challenges.map((challenge, index) => <li key={index}>{challenge}</li>)}</ul></div></div><div className="conversation-card"><span className="eyebrow">START A REAL CONVERSATION</span><blockquote>“{compatibility.conversationStarter}”</blockquote></div></> : <div className="connection-empty"><div className="connection-orbits" aria-hidden="true"><span>✧</span><span>✦</span></div><h2>Every connection has<br />its own <em>constellation.</em></h2><p>Choose two signs to discover shared strengths, different rhythms, and a question worth asking.</p><span className="small-tag">CURIOSITY OVER CERTAINTY</span></div>}
          </section>
        </div>
      </>}

      {page === 'chat' && <>
        <section className="page-heading"><div><p className="eyebrow"><span className="tiny-star">✦</span> A LITTLE ROOM TO REFLECT</p><h1>What’s on your <em>mind?</em></h1><p className="heading-description">Bring a question. Leave with a different way to look at it.</p></div><div className="heading-decoration chat-decoration" aria-hidden="true">✧</div></section>
        <div className="chat-layout"><aside className="chat-context"><span className="eyebrow">YOUR REFLECTION SPACE</span><SunWheel symbol={chart ? allSigns[Math.floor(chart.moon.longitude / 30)]?.[2] || '☾' : profile?.sign.symbol || '✧'} compact /><h2>{currentName}’s perspective</h2><p>{chart ? `${chart.moon.rashi} Moon · ${chart.ascendant.rashi} lagna` : `${profile?.sign.name || 'Your sun sign'} · ${focusOptions.find(option => option.id === focus)?.label}`}</p><div className="chat-context-rule" /><h3>Start with a little curiosity.</h3><p>{fullBirthProfile ? 'Your calculated chart and life periods provide the context. Traditional interpretation is a guide, and your choices still matter.' : 'Astral uses astrology as a creative lens for reflection. Add recorded birth details for a Vedic chart.'}</p><div className="chat-mode-status"><span className={`status-dot ${chatMode === 'ai' ? 'ai' : ''}`} /><div><strong>{chatMode === 'ai' ? aiChatLabel : localChatLabel}</strong><span>{chatMode === 'ai' ? 'Chart-informed language model' : fullBirthProfile ? 'Calculated chart · traditional rules' : 'No AI key needed · guided prompts'}</span></div></div><p className="chat-disclaimer">For entertainment and self-reflection. For health, legal, or financial decisions, speak with a qualified professional.</p></aside>
          <section className="chat-panel" aria-label="Ask Astral conversation"><div className="chat-panel-header"><span><Icon name="star" size={21} /><strong>Ask Astral</strong></span>{config?.aiEnabled ? <div className="chat-mode-switch" role="group" aria-label="Reflection mode"><button className={chatMode === 'ai' ? 'selected' : ''} onClick={() => setChatMode('ai')} aria-pressed={chatMode === 'ai'} disabled={chatLoading}>{fullBirthProfile ? 'Vedic AI' : 'AI'} <Icon name="star" size={12} /></button><button className={chatMode === 'local' ? 'selected' : ''} onClick={() => setChatMode('local')} aria-pressed={chatMode === 'local'} disabled={chatLoading}>Local</button></div> : <span className="small-tag">{localChatLabel.toUpperCase()}</span>}</div><div className="ai-connection-row"><span role="status">{configLoading ? 'Checking live AI availability…' : configError ? 'Couldn’t check live AI availability.' : config?.aiEnabled ? 'Live AI is configured on this server.' : 'Live AI is not configured on this server.'}</span><button type="button" onClick={() => setConfigRetry(value => value + 1)} disabled={configLoading}>{configLoading ? 'Checking…' : 'Check connection'}</button></div>{!config?.aiEnabled && !configLoading && <details className="ai-setup-help"><summary>Set up live Vedic AI</summary><p>Add <code>ASTROLOGY_AI_API_KEY</code> securely in your cloud or Render server environment settings, then restart or redeploy. Check the connection here afterward. Keep the key out of chat.</p></details>}
            <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversation messages"><div className="assistant-message"><span className="message-avatar"><Icon name="star" size={18} /></span><div className="message-bubble"><p>Hi {currentName}. {fullBirthProfile ? 'We can explore marriage, married life, jobs, challenging periods, and other life topics through your calculated chart. What would you like to understand?' : 'What would you like to make space for today? We can explore relationships, work, wellbeing, or a fresh perspective on your day.'}</p><span className="message-source">A welcome from Astral</span></div></div>{messages.map(message => <div className={`${message.role}-message`} key={message.id}>{message.role === 'assistant' && <span className="message-avatar"><Icon name="star" size={18} /></span>}<div className="message-bubble"><p>{message.text}</p>{message.role === 'assistant' && <span className="message-source">{message.source === 'ai' ? aiChatLabel : localChatLabel}</span>}{message.role === 'assistant' && (message.prediction || Boolean(message.references?.length)) && <details className="message-calculations"><summary>Calculation details</summary>{message.prediction && <PredictionResults prediction={message.prediction} compact insideDetails />}{Boolean(message.references?.length) && <section className="message-references"><h3>References considered</h3><ul>{message.references?.map((reference, index) => <li key={`${reference.id}-${index}`}><strong>{reference.id}</strong> {reference.title}</li>)}</ul></section>}</details>}</div></div>)}{chatLoading && <div className="assistant-message"><span className="message-avatar"><Icon name="star" size={18} /></span><div className="message-bubble typing-indicator" role="status" aria-label="Astral is preparing a reflection"><span /><span /><span /></div></div>}{chatError && <div className="chat-error" role="alert"><p>{chatError}</p><div><button className="text-button" onClick={() => void sendChat(lastChat, true)}>Retry <Icon name="arrow" size={15} /></button>{chatMode === 'ai' && <button className="text-button" onClick={() => { setChatMode('local'); setChatError(''); setChatInput(lastChat); }}>Switch to local reflection</button>}</div></div>}<div ref={chatEndRef} /></div>
            {!messages.length && <div className="suggested-prompts" aria-label="Suggested questions">{(fullBirthProfile ? ['How might my married life be?', 'When might I get a job?', 'When might a difficult period ease?', 'When might I get married?'] : ['What can I focus on today?', 'How can I communicate better?', 'Help me find balance.']).map(prompt => <button key={prompt} onClick={() => void sendChat(prompt)} disabled={chatLoading || !profile}>{prompt}<Icon name="arrow" size={14} /></button>)}</div>}
            <form className="chat-compose" onSubmit={event => { event.preventDefault(); void sendChat(); }}><label htmlFor="chat-message" className="sr-only">Your question for Astral</label><textarea id="chat-message" placeholder="Share what’s on your mind…" value={chatInput} onChange={event => setChatInput(event.target.value)} maxLength={1000} rows={2} disabled={chatLoading || !profile} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendChat(); } }} /><button type="submit" className="send-button" disabled={!chatInput.trim() || chatLoading || !profile} aria-label="Send question"><Icon name="arrowUp" size={20} /></button><span className="compose-note">{chatMode === 'ai' ? 'Your derived chart, question and recent conversation are sent to OpenAI; name and exact birth details are excluded.' : fullBirthProfile ? 'A calculated Vedic guide using chart factors and traditional rules. No language model is used in this mode.' : 'A guided, locally generated reflection. Not a live AI conversation.'}</span></form>
          </section>
        </div>
      </>}
      {page === 'about' && <Suspense fallback={<div className="reading-loading" role="status">Opening the story of Astral…</div>}><About onExplore={() => { setPage('chart'); window.scrollTo({ top: 0 }); }} /></Suspense>}
    </main>

    {!showWelcome && !showPersonalization && <Suspense fallback={null}><AiYogi profile={isPersonalProfile ? profile : null} aiEnabled={Boolean(config?.aiEnabled)} onEditProfile={openProfileEditor} /></Suspense>}
    <footer className="site-footer"><div><span className="footer-brand"><Icon name="star" size={15} /> astral.</span><p>A little perspective. A little possibility.</p></div><p>Approximate Western sun signs &amp; calculated Vedic charts. For entertainment &amp; self-reflection.</p><span className="footer-copyright">© {today.getFullYear()} Sree Charan Reddy Kailasam</span></footer>

    <dialog ref={dialogRef} className="profile-dialog" onCancel={() => setEditorOpen(false)} onClose={() => setEditorOpen(false)} aria-labelledby="profile-title"><div className="dialog-heading"><Icon name="star" size={27} /><button type="button" className="icon-button" onClick={() => setEditorOpen(false)} aria-label="Close profile editor"><Icon name="close" size={22} /></button></div><span className="eyebrow">A LITTLE MORE YOU</span><h2 id="profile-title">Make it <em>personal.</em></h2><p className="dialog-description">Start with your date of birth, or add your recorded time and place for a calculated Vedic chart.</p><form onSubmit={saveProfile}><div className="form-field"><label htmlFor="profile-name">What should we call you?</label><input id="profile-name" value={nameInput} onChange={event => setNameInput(event.target.value)} placeholder="Your first name" maxLength={60} required autoComplete="given-name" autoFocus /></div><div className="form-field"><label htmlFor="profile-date">Date of birth</label><input id="profile-date" type="date" value={dateInput} onChange={event => setDateInput(event.target.value)} required max={todayISO} min="1900-01-01" /></div><div className="birth-details-opt-in"><label className="checkbox-label"><input type="checkbox" checked={includeBirthDetails} onChange={event => setIncludeBirthDetails(event.target.checked)} /><span>Add birth time and place for a Vedic chart</span></label><p>Use your recorded birth time. If it’s unknown, leave this off — we won’t guess.</p></div>{includeBirthDetails && <fieldset className="birth-details-fields"><legend>Vedic birth details</legend><div className="form-field"><label htmlFor="profile-time">Recorded birth time (local)</label><input id="profile-time" type="time" step={60} value={timeInput} onChange={event => setTimeInput(event.target.value)} required /><small>Enter the time recorded at your birth place, not today’s time zone.</small></div>{!manualLocation && <BirthplaceAutocomplete value={placeInput} selected={placeSelected} onQueryChange={changeBirthPlace} onSelect={chooseBirthPlace} />}
{!manualLocation && placeSelected && <p className="preset-place-details"><Icon name="compass" size={14} />{placeInput} · {timeZoneInput}</p>}
<details className="manual-location" open={manualLocation} onToggle={event => {
  const open = event.currentTarget.open;
  if (!open && manualLocation) setPlaceSelected(validLocationInputs());
  setManualLocation(open);
}}><summary>Enter location manually</summary><p>If your place isn’t listed, you can enter its coordinates and historical time-zone identifier here.</p>
{manualLocation && <><div className="form-field"><label htmlFor="profile-place">Place of birth</label><input id="profile-place" value={placeInput} onChange={event => { setPlaceInput(event.target.value); setPlaceSelected(false); setSaveError(''); }} placeholder="City, country" maxLength={120} required /></div><div className="coordinates-fields"><div className="form-field"><label htmlFor="profile-latitude">Latitude</label><input id="profile-latitude" type="number" min={-90} max={90} step="any" value={latitudeInput} onChange={event => { setLatitudeInput(event.target.value); setPlaceSelected(false); setSaveError(''); }} placeholder="17.385" required /></div><div className="form-field"><label htmlFor="profile-longitude">Longitude</label><input id="profile-longitude" type="number" min={-180} max={180} step="any" value={longitudeInput} onChange={event => { setLongitudeInput(event.target.value); setPlaceSelected(false); setSaveError(''); }} placeholder="78.4867" required /></div></div><div className="form-field"><label htmlFor="profile-timezone">Birth place time zone (IANA)</label><input id="profile-timezone" value={timeZoneInput} onChange={event => { setTimeZoneInput(event.target.value); setPlaceSelected(false); setSaveError(''); }} placeholder="Asia/Kolkata" required maxLength={100} /><small>Use an IANA identifier so historical time-zone rules can be applied.</small></div></>}
</details></fieldset>}
{saveError && <ErrorNotice message={saveError} />}<button className="primary-button full-width" type="submit" disabled={saving}>{saving ? 'Saving your profile…' : 'Find my perspective'}<Icon name="arrow" size={18} /></button></form><p className="privacy-note"><Icon name="lock" size={14} />Saved only in this browser. Clear your profile any time.</p>{isPersonalProfile && <button className="reset-profile" onClick={resetProfile} disabled={saving}>{isSaved ? 'Clear saved profile' : 'Clear profile'}</button>}</dialog>
  </div>;
}
