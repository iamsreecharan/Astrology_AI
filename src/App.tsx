import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import './App.css';

type Page = 'today' | 'compatibility' | 'chat';
type Focus = 'general' | 'love' | 'career' | 'wellbeing';
type Sign = { id: string; name: string; symbol: string; element: string; modality: string; dates: string; traits: string[]; description: string };
type Profile = { name: string; birthDate: string; sign: Sign };
type Reading = { date: string; focus: Focus; headline: string; overview: string; sections: { label: string; text: string }[]; affirmation: string; ritual: string; lucky: { color: string; number: number }; source: 'local' | 'ai' };
type Compatibility = { signA: Sign; signB: Sign; headline: string; summary: string; strengths: string[]; challenges: string[]; conversationStarter: string };
type Message = { id: number; role: 'user' | 'assistant'; text: string; source?: 'local' | 'ai' };
type Config = { aiEnabled: boolean; model: string | null; signs: Sign[] };
type ProfileInput = { name: string; birthDate: string };

const sampleProfile = { name: 'Alex', birthDate: '1995-05-21' };
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
    if (value && typeof value.name === 'string' && typeof value.birthDate === 'string') return { name: value.name, birthDate: value.birthDate };
  } catch { /* An unavailable or corrupted browser store should not prevent opening the app. */ }
  return null;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
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
  } finally { window.clearTimeout(timeout); }
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

export default function App() {
  const [initialProfile] = useState(() => savedProfile());
  const profileInputRef = useRef<ProfileInput>(initialProfile || sampleProfile);
  const [page, setPage] = useState<Page>('today');
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState('');
  const [configRetry, setConfigRetry] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSaved, setIsSaved] = useState(Boolean(initialProfile));
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
  const [chatMode, setChatMode] = useState<'local' | 'ai'>('local');
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

  useEffect(() => {
    let active = true;
    setConfigError('');
    api<Config>('/api/config').then(data => { if (active) setConfig(data); }).catch(error => { if (active) setConfigError(error.message); });
    return () => { active = false; };
  }, [configRetry]);

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
    api<Reading>('/api/reading', { profile: { name: profile.name, birthDate: profile.birthDate }, focus, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).then(data => {
      if (active) { setReading(data); setReadingLoading(false); }
    }).catch(error => { if (active) { setReadingError(error.message); setReadingLoading(false); } });
    return () => { active = false; };
  }, [profile, focus, readingRetry]);

  useEffect(() => {
    if (editorOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!editorOpen && dialogRef.current?.open) dialogRef.current?.close();
  }, [editorOpen]);

  useEffect(() => {
    if (page === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, chatLoading, page]);

  function openProfileEditor() {
    setNameInput(currentName);
    setDateInput(profile?.birthDate || profileInputRef.current.birthDate);
    setSaveError('');
    setEditorOpen(true);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    const input = { name: nameInput.trim(), birthDate: dateInput };
    try {
      const data = await api<Profile>('/api/profile', input);
      profileInputRef.current = input;
      setProfile(data);
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
    try { localStorage.removeItem('astral-profile'); } catch { /* Reset this session even if browser storage is restricted. */ }
    setIsSaved(false);
    setStorageNotice('');
    profileInputRef.current = sampleProfile;
    setProfile(null);
    setNameInput('');
    setDateInput('');
    setSaveError('');
    ++chatRequestRef.current;
    setMessages([]);
    setChatLoading(false);
    setChatError('');
    setProfileError('');
    api<Profile>('/api/profile', sampleProfile).then(data => { setProfile(data); setSignA(data.sign.id); }).catch(error => setProfileError(error.message));
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
    setLastChat(text);
    setChatError('');
    setChatInput('');
    setChatLoading(true);
    if (!retry) setMessages(previous => [...previous, { id: ++messageIdRef.current, role: 'user', text }]);
    try {
      const result = await api<{ reply: string; source: 'local' | 'ai' }>('/api/chat', {
        profile: { name: profile.name, birthDate: profile.birthDate }, message: text, focus, mode: chatMode,
      });
      if (requestId === chatRequestRef.current) setMessages(previous => [...previous, { id: ++messageIdRef.current, role: 'assistant', text: result.reply, source: result.source }]);
    } catch (error) { if (requestId === chatRequestRef.current) setChatError(error instanceof Error ? error.message : 'Your reflection couldn’t be created. Please try again.'); }
    finally { if (requestId === chatRequestRef.current) setChatLoading(false); }
  }

  const signOptions = signs.length ? signs.map(sign => ({ id: sign.id, name: sign.name, symbol: sign.symbol })) : allSigns.map(([id, name, symbol]) => ({ id, name, symbol }));
  const signALabel = signOptions.find(sign => sign.id === signA);
  const signBLabel = signOptions.find(sign => sign.id === signB);
  const navigation: { page: Page; label: string; icon: string }[] = [{ page: 'today', label: 'Today', icon: 'sun' }, { page: 'compatibility', label: 'Compatibility', icon: 'heart' }, { page: 'chat', label: 'Ask Astral', icon: 'star' }];

  return <div className="app-shell">
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
              <div className="signature-bottom"><span>{isSaved ? 'Saved only in this browser' : 'Exploring with a sample profile'}</span><button onClick={openProfileEditor}>{isSaved ? 'Edit' : 'Make it yours'} <Icon name="arrow" size={14} /></button></div>
            </section>
            <section className="ritual-card"><div className="ritual-heading"><span className="ritual-icon"><Icon name="leaf" size={20} /></span><h3>A small daily ritual</h3></div><p>{readingLoading ? 'Taking a quiet moment is always a good place to begin.' : reading?.ritual || 'Pause, take a slow breath, and notice one thing you’re grateful for.'}</p>{reading && !readingLoading && <div className="daily-symbols"><span><span className="color-dot" style={{ backgroundColor: ritualColors[reading.lucky.color] || ritualColors.Gold }} /><small>YOUR COLOR</small><strong>{reading.lucky.color}</strong></span><span><span className="number-symbol">{reading.lucky.number}</span><small>YOUR NUMBER</small><strong>A playful daily symbol</strong></span></div>}</section>
          </aside>
        </div>
        <div className="quiet-note"><span>✧</span><p>There’s no perfect way to be you. Just a little more room to grow.</p><span>✧</span></div>
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
        <div className="chat-layout"><aside className="chat-context"><span className="eyebrow">YOUR REFLECTION SPACE</span><SunWheel symbol={profile?.sign.symbol || '✧'} compact /><h2>{currentName}’s perspective</h2><p>{profile?.sign.name || 'Your sun sign'} · {focusOptions.find(option => option.id === focus)?.label}</p><div className="chat-context-rule" /><h3>Start with a little curiosity.</h3><p>Astral uses astrology as a creative lens for reflection. You know your life best.</p><div className="chat-mode-status"><span className={`status-dot ${chatMode === 'ai' ? 'ai' : ''}`} /><div><strong>{chatMode === 'ai' ? 'AI reflection' : 'Local reflection'}</strong><span>{chatMode === 'ai' ? 'Responses generated by AI' : 'No AI key needed · guided prompts'}</span></div></div><p className="chat-disclaimer">For entertainment and self-reflection. For health, legal, or financial decisions, speak with a qualified professional.</p></aside>
          <section className="chat-panel" aria-label="Ask Astral conversation"><div className="chat-panel-header"><span><Icon name="star" size={21} /><strong>Ask Astral</strong></span>{config?.aiEnabled ? <div className="chat-mode-switch" role="group" aria-label="Reflection mode"><button className={chatMode === 'local' ? 'selected' : ''} onClick={() => setChatMode('local')} aria-pressed={chatMode === 'local'} disabled={chatLoading}>Local</button><button className={chatMode === 'ai' ? 'selected' : ''} onClick={() => setChatMode('ai')} aria-pressed={chatMode === 'ai'} disabled={chatLoading}>AI <Icon name="star" size={12} /></button></div> : <span className="small-tag">LOCAL REFLECTION</span>}</div>
            <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversation messages"><div className="assistant-message"><span className="message-avatar"><Icon name="star" size={18} /></span><div className="message-bubble"><p>Hi {currentName}. What would you like to make space for today? We can explore relationships, work, wellbeing, or a fresh perspective on your day.</p><span className="message-source">A welcome from Astral</span></div></div>{messages.map(message => <div className={`${message.role}-message`} key={message.id}>{message.role === 'assistant' && <span className="message-avatar"><Icon name="star" size={18} /></span>}<div className="message-bubble"><p>{message.text}</p>{message.role === 'assistant' && <span className="message-source">{message.source === 'ai' ? 'AI reflection' : 'Local reflection'}</span>}</div></div>)}{chatLoading && <div className="assistant-message"><span className="message-avatar"><Icon name="star" size={18} /></span><div className="message-bubble typing-indicator" role="status" aria-label="Astral is preparing a reflection"><span /><span /><span /></div></div>}{chatError && <div className="chat-error" role="alert"><p>{chatError}</p><div><button className="text-button" onClick={() => void sendChat(lastChat, true)}>Retry <Icon name="arrow" size={15} /></button>{chatMode === 'ai' && <button className="text-button" onClick={() => { setChatMode('local'); setChatError(''); setChatInput(lastChat); }}>Switch to local reflection</button>}</div></div>}<div ref={chatEndRef} /></div>
            {!messages.length && <div className="suggested-prompts" aria-label="Suggested questions">{['What can I focus on today?', 'How can I communicate better?', 'Help me find balance.'].map(prompt => <button key={prompt} onClick={() => void sendChat(prompt)} disabled={chatLoading || !profile}>{prompt}<Icon name="arrow" size={14} /></button>)}</div>}
            <form className="chat-compose" onSubmit={event => { event.preventDefault(); void sendChat(); }}><label htmlFor="chat-message" className="sr-only">Your question for Astral</label><textarea id="chat-message" placeholder="Share what’s on your mind…" value={chatInput} onChange={event => setChatInput(event.target.value)} maxLength={1000} rows={2} disabled={chatLoading || !profile} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendChat(); } }} /><button type="submit" className="send-button" disabled={!chatInput.trim() || chatLoading || !profile} aria-label="Send question"><Icon name="arrowUp" size={20} /></button><span className="compose-note">{chatMode === 'ai' ? 'Your question and sun sign are sent to OpenAI. AI responses can be imperfect.' : 'A guided, locally generated reflection. Not a live AI conversation.'}</span></form>
          </section>
        </div>
      </>}
    </main>

    <footer className="site-footer"><div><span className="footer-brand"><Icon name="star" size={15} /> astral.</span><p>A little perspective. A little possibility.</p></div><p>Approximate Western sun signs. For entertainment &amp; self-reflection.</p><span className="footer-copyright">© {today.getFullYear()} Astral</span></footer>

    <dialog ref={dialogRef} className="profile-dialog" onCancel={() => setEditorOpen(false)} onClose={() => setEditorOpen(false)} aria-labelledby="profile-title"><div className="dialog-heading"><Icon name="star" size={27} /><button type="button" className="icon-button" onClick={() => setEditorOpen(false)} aria-label="Close profile editor"><Icon name="close" size={22} /></button></div><span className="eyebrow">A LITTLE MORE YOU</span><h2 id="profile-title">Make it <em>personal.</em></h2><p className="dialog-description">Your date of birth is all we need to find your approximate Western sun sign.</p><form onSubmit={saveProfile}><div className="form-field"><label htmlFor="profile-name">What should we call you?</label><input id="profile-name" value={nameInput} onChange={event => setNameInput(event.target.value)} placeholder="Your first name" maxLength={60} required autoComplete="given-name" autoFocus /></div><div className="form-field"><label htmlFor="profile-date">Date of birth</label><input id="profile-date" type="date" value={dateInput} onChange={event => setDateInput(event.target.value)} required max={todayISO} min="1900-01-01" /></div>{saveError && <ErrorNotice message={saveError} />}<button className="primary-button full-width" type="submit" disabled={saving}>{saving ? 'Saving your profile…' : 'Find my perspective'}<Icon name="arrow" size={18} /></button></form><p className="privacy-note"><Icon name="lock" size={14} />Saved only in this browser. Clear your profile any time.</p>{isSaved && <button className="reset-profile" onClick={resetProfile} disabled={saving}>Clear saved profile</button>}</dialog>
  </div>;
}
